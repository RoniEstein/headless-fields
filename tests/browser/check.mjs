#!/usr/bin/env node
// Real-browser check for the file fields (Chromium via Playwright): keyboard
// picker, real DataTransfer drops, focus styling, native FileList/required,
// previews, removal focus. happy-dom can't prove these.
//
//   bun run test:browser
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as playwright from 'playwright';

const here = new URL('.', import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), 'headless-fields-browser-'));
execFileSync('bun', ['build', join(here, 'harness.tsx'), '--outdir', out, '--target', 'browser'], { stdio: 'inherit' });
copyFileSync(join(here, 'index.html'), join(out, 'index.html'));

const failures = [];
function check(name, ok, detail = '') {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
    if (!ok) failures.push(name);
}

const png = { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') };
const md = { name: 'directions.md', mimeType: '', buffer: Buffer.from('# Room 4\n') };
const docx = { name: 'notes.docx', mimeType: 'application/msword', buffer: Buffer.from('x') };

// Module scripts don't load from file://, so serve the bundle locally.
const server = createServer((req, res) => {
    const file = req.url === '/' ? 'index.html' : req.url.slice(1);
    try {
        const body = readFileSync(join(out, file));
        res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
        res.end(body);
    } catch {
        res.writeHead(404).end();
    }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

// BROWSER=chromium|webkit|firefox (default chromium).
const engine = process.env.BROWSER ?? 'chromium';
console.log(`engine: ${engine}`);
const browser = await playwright[engine].launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base);
await page.locator('#picker').waitFor({ state: 'attached' });

// 1. Keyboard: Tab reaches the real input, the label shows focus, Space opens the picker.
await page.keyboard.press('Tab');
const focused = await page.evaluate(() => ({ id: document.activeElement?.id, type: document.activeElement?.getAttribute('type') }));
check('Tab lands on the native file input', focused.id === 'picker' && focused.type === 'file', JSON.stringify(focused));
const outline = await page.locator('#picker-trigger').evaluate((el) => getComputedStyle(el).outlineColor);
check('trigger label shows keyboard focus via :has(:focus-visible)', outline === 'rgb(0, 90, 200)', outline);
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Space')]);
check('Space opens the file picker', chooser.isMultiple());
await chooser.setFiles([png, md, docx]);
check('picked files are listed', (await page.getByText('logo.png', { exact: true }).count()) === 1 && (await page.getByText('directions.md', { exact: true }).count()) === 1);
check('an extension rule accepts a typeless .md', (await page.locator('#picker').evaluate((el) => el.files.length)) === 2);
check('a refused file shows its reason', (await page.locator('.rejection').textContent())?.includes("notes.docx isn't a file type"));
check('announcement covers both', (await page.locator('[role=status]').first().textContent())?.startsWith('Added 2 files.'));
const preview = await page.locator('img').first().getAttribute('src');
check('image preview uses an object URL', preview?.startsWith('blob:'), preview);

// 2. Native validity and the FileList stay in step with the value.
const validity = await page.locator('#picker').evaluate((el) => el.checkValidity());
check('required input is valid with files', validity === true);
await page.getByRole('button', { name: 'Remove logo.png' }).focus();
await page.keyboard.press('Enter');
const afterRemove = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
check('removing moves focus to the next file', afterRemove === 'Remove directions.md', afterRemove);
await page.keyboard.press('Enter');
const backToInput = await page.evaluate(() => document.activeElement?.id);
check('removing the last file returns focus to the input', backToInput === 'picker', backToInput);
const empty = await page.locator('#picker').evaluate((el) => ({ n: el.files.length, valid: el.checkValidity() }));
check('emptied input is invalid again for native required', empty.n === 0 && empty.valid === false, JSON.stringify(empty));

// 3. Real drops with a DataTransfer built in the page.
const area = page.locator('.drop');
// React commits drag state asynchronously (drag events aren't discrete), so
// poll a few frames before reading the attribute.
const dropFiles = (names) =>
    area.evaluate(async (el, list) => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const dt = new DataTransfer();
        for (const [name, type] of list) dt.items.add(new File(['data'], name, { type }));
        const fire = (type) => {
            const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
            el.dispatchEvent(event);
            return event.defaultPrevented;
        };
        fire('dragenter');
        let dragging = false;
        for (let i = 0; i < 30 && !dragging; i++) {
            await frame();
            dragging = el.hasAttribute('data-dragging');
        }
        fire('dragover');
        const dropped = fire('drop');
        return { dragging, dropped };
    }, names);
const result = await dropFiles([['map.pdf', 'application/pdf']]);
check('drag sets data-dragging', result.dragging);
check('drop is handled (default prevented)', result.dropped);
await page.getByText('map.pdf', { exact: true }).waitFor();
check('dropped file is listed', true);
check('drop area clears data-dragging', !(await area.evaluate((el) => el.hasAttribute('data-dragging'))));
check('drop area is not a control', (await area.evaluate((el) => [el.getAttribute('role'), el.getAttribute('tabindex')])).every((v) => v === null));
const synced = await page.locator('#drop').evaluate((el) => [...el.files].map((f) => f.name).join());
check('dropped files are mirrored into the input FileList', synced === 'map.pdf', synced);

// 4. A file dropped beside the drop area doesn't navigate away.
const beside = await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'stray.png', { type: 'image/png' }));
    const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
});
check('a stray drop on the page is swallowed', beside);

// 5. Fully custom markup: the consumer's own button opens the picker.
const [own] = await Promise.all([page.waitForEvent('filechooser'), page.click('#own-button')]);
check('open() from a custom button opens a single-file picker', !own.isMultiple());
await own.setFiles([{ name: 'poster.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') }]);
check('custom field announces', (await page.locator('[role=status]').last().textContent()) === 'Added poster.pdf.');

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
server.close();
if (failures.length) {
    console.error(`${failures.length} browser check(s) failed`);
    process.exit(1);
}
console.log('All browser checks passed.');
