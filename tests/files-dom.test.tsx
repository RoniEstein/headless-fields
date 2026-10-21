import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { files, MB } from '../src/core';
import {
    FieldLabel,
    FieldSkinProvider,
    FileDropField,
    FileField,
    FileItem,
    FileList,
    FileName,
    FilePickerField,
    FileRemove,
    FileTrigger,
    useFileField,
    type FieldSkin,
} from '../src/dom';

afterEach(cleanup);

const artwork = files({ accept: ['image/*', '.pdf', '.md'], maxSize: 10 * MB, maxFiles: 3 });
const png = (name = 'logo.png') => new File(['x'.repeat(10)], name, { type: 'image/png' });
const pdf = (name = 'brief.pdf') => new File(['%PDF'], name, { type: 'application/pdf' });

function pick(input: HTMLElement, chosen: File[]) {
    fireEvent.change(input, { target: { files: chosen } });
}

function drop(target: HTMLElement, dropped: File[]) {
    const items = dropped.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file }));
    const dataTransfer = { types: ['Files'], files: dropped, items, dropEffect: 'none' };
    fireEvent.dragEnter(target, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
}

function Controlled({ template = 'picker', onValue }: { template?: 'picker' | 'drop'; onValue?: (v: File[]) => void }) {
    const [value, setValue] = useState<File[]>([]);
    const props = {
        definition: artwork,
        label: 'Artwork',
        value,
        onChange: (v: File[]) => {
            setValue(v);
            onValue?.(v);
        },
        required: true,
    };
    return template === 'picker' ? <FilePickerField {...props} /> : <FileDropField {...props} />;
}

describe('FilePickerField', () => {
    test('the native input is the labelled control inside the trigger', () => {
        render(<Controlled />);
        const input = screen.getByLabelText(/Artwork/) as HTMLInputElement;
        expect(input.type).toBe('file');
        expect(input.multiple).toBe(true);
        expect(input.accept).toBe('image/*,.pdf,.md');
        expect(input.closest('label')?.textContent).toContain('Choose files');
        expect(input.getAttribute('aria-hidden')).toBeNull();
        expect(input.style.position).toBe('absolute');
        expect(screen.getByText('No files chosen')).toBeTruthy();
    });

    test('picking adds files, lists them, and announces', () => {
        const seen: File[][] = [];
        render(<Controlled onValue={(v) => seen.push(v)} />);
        pick(screen.getByLabelText(/Artwork/), [png(), pdf()]);
        expect(seen.at(-1)?.map((f) => f.name)).toEqual(['logo.png', 'brief.pdf']);
        expect(screen.getByText('2 files chosen')).toBeTruthy();
        expect(screen.getByRole('status').textContent).toBe('Added 2 files.');
        expect(screen.getByText('logo.png').closest('li')?.getAttribute('data-kind')).toBe('image');
        expect(screen.getByRole('button', { name: 'Remove brief.pdf' })).toBeTruthy();
    });

    test('refused files are listed with their reason and announced', () => {
        render(<Controlled />);
        const big = new File([new Uint8Array(11 * MB)], 'huge.png', { type: 'image/png' });
        pick(screen.getByLabelText(/Artwork/), [big, new File(['a'], 'notes.docx', { type: 'application/msword' })]);
        const reasons = screen.getAllByText(/isn't a file type|larger than/, { selector: 'li' });
        expect(reasons.map((r) => r.getAttribute('data-error-code'))).toEqual(['too-large', 'type']);
        expect(screen.getByRole('status').textContent).toContain('huge.png is larger than 10 MB.');
    });

    test('removing moves focus to the next file, then back to the input', () => {
        render(<Controlled />);
        const input = screen.getByLabelText(/Artwork/);
        pick(input, [png('a.png'), png('b.png')]);
        fireEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove b.png' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove b.png' }));
        expect(document.activeElement).toBe(input);
        expect(screen.getByRole('status').textContent).toBe('Removed b.png.');
    });

    test('a required field complains only after the user leaves it empty', () => {
        render(<Controlled />);
        const input = screen.getByLabelText(/Artwork/);
        expect(screen.queryByText('Choose a file')).toBeNull();
        fireEvent.blur(input);
        expect(screen.getByText('Choose a file').getAttribute('data-tone')).toBe('error');
        expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    test('the hint stays beside a required error and both describe the input', () => {
        render(<FilePickerField definition={artwork} label="Artwork" value={[]} onChange={() => {}} required hint="PNG or PDF, up to 10 MB" />);
        const input = screen.getByLabelText(/Artwork/);
        const hint = screen.getByText('PNG or PDF, up to 10 MB');
        expect(input.getAttribute('aria-describedby')).toBe(hint.id);
        fireEvent.blur(input);
        const error = screen.getByText('Choose a file');
        expect(screen.getByText('PNG or PDF, up to 10 MB')).toBe(hint);
        expect(input.getAttribute('aria-describedby')).toBe(`${hint.id} ${error.id}`);
    });
});

describe('FileDropField', () => {
    test('dropping adds files; the drop area is not a control', async () => {
        render(<Controlled template="drop" />);
        const area = screen.getByText('or drop files here').parentElement!;
        expect(area.getAttribute('role')).toBeNull();
        expect(area.getAttribute('tabindex')).toBeNull();
        await act(async () => drop(area, [png()]));
        await waitFor(() => expect(screen.getByText('logo.png')).toBeTruthy());
        expect(area.hasAttribute('data-dragging')).toBe(false);
    });

    test('dragging flags the area, and flags a drag it cannot take', () => {
        render(<Controlled template="drop" />);
        const area = screen.getByText('or drop files here').parentElement!;
        const items = Array.from({ length: 4 }, () => ({ kind: 'file', type: 'image/png' }));
        fireEvent.dragEnter(area, { dataTransfer: { types: ['Files'], items } });
        expect(area.hasAttribute('data-dragging')).toBe(true);
        expect(area.hasAttribute('data-drag-reject')).toBe(true);
        fireEvent.dragLeave(area, { dataTransfer: { types: ['Files'], items } });
        expect(area.hasAttribute('data-dragging')).toBe(false);
    });
});

describe('composition', () => {
    test('parts take your own elements and skins style every slot', () => {
        const skin: FieldSkin = {
            classNames: { trigger: 'btn', fileItem: 'row', fileRemove: 'x' },
            icons: { remove: <i>del</i> },
        };
        function Custom() {
            const [value, setValue] = useState<File[]>([]);
            return (
                <FieldSkinProvider skin={skin}>
                    <FileField definition={artwork} value={value} onChange={setValue}>
                        <FieldLabel>Directions</FieldLabel>
                        <FileTrigger render={<label data-custom="" />}>Browse</FileTrigger>
                        <FileList>
                            {(entry) => (
                                <FileItem entry={entry} render={<li data-row="" />}>
                                    <FileName />
                                    <FileRemove render={(props) => <button {...props} data-mine="" />} />
                                </FileItem>
                            )}
                        </FileList>
                    </FileField>
                </FieldSkinProvider>
            );
        }
        render(<Custom />);
        const input = screen.getByLabelText(/Directions/);
        const trigger = input.closest('label')!;
        expect(trigger.hasAttribute('data-custom')).toBe(true);
        expect(trigger.className).toBe('btn');
        pick(input, [pdf()]);
        const remove = screen.getByRole('button', { name: 'Remove brief.pdf' });
        expect(remove.hasAttribute('data-mine')).toBe(true);
        expect(remove.className).toBe('x');
        expect(remove.textContent).toBe('del');
        expect(remove.closest('li')?.className).toBe('row');
    });

    test('the hook alone drives fully custom markup', () => {
        function Bare() {
            const [value, setValue] = useState<File[]>([]);
            const f = useFileField(files({ accept: ['.pdf'] }), { value, onChange: setValue });
            return (
                <section {...f.getRootProps()}>
                    <h3 {...f.getLabelProps()}>Poster</h3>
                    <div {...f.getDropProps()}>
                        <label {...f.getTriggerProps({ className: 'mine' })}>
                            <input {...f.getInputProps()} /> Upload PDF
                        </label>
                    </div>
                    {f.entries.map((e) => (
                        <p key={e.id} {...f.getItemProps(e)}>
                            {e.name} <button {...f.getRemoveProps(e)}>x</button>
                        </p>
                    ))}
                    <div {...f.getAnnouncerProps()}>{f.announcement}</div>
                </section>
            );
        }
        render(<Bare />);
        const input = screen.getByLabelText('Poster Upload PDF') as HTMLInputElement;
        expect(input.multiple).toBe(false);
        pick(input, [pdf('one.pdf')]);
        pick(input, [pdf('two.pdf')]);
        expect(screen.queryByText('one.pdf')).toBeNull();
        expect(screen.getByText(/two\.pdf/, { selector: 'p' }).getAttribute('data-kind')).toBe('pdf');
        expect(screen.getByRole('status').textContent).toBe('Added two.pdf.');
    });

    test('consumer handlers run first and can opt out of ours', () => {
        let ran = 0;
        function Guarded() {
            const [value, setValue] = useState<File[]>([]);
            const f = useFileField(artwork, { value, onChange: setValue });
            return (
                <label {...f.getTriggerProps()}>
                    Pick
                    <input
                        {...f.getInputProps({
                            onChange: (event: Event) => {
                                ran++;
                                event.preventDefault();
                            },
                        })}
                    />
                    <span>{f.entries.length}</span>
                </label>
            );
        }
        render(<Guarded />);
        pick(screen.getByLabelText(/Pick/), [png()]);
        expect(ran).toBe(1);
        expect(screen.getByText('0')).toBeTruthy();
    });
});
