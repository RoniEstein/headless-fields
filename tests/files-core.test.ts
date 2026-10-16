import { describe, expect, test } from 'bun:test';
import {
    acceptAttribute,
    addFiles,
    checkFile,
    fileKind,
    files,
    formatBytes,
    MB,
    type FileDescriptor,
} from '../src/core';

const f = (name: string, size = 1000, type = ''): FileDescriptor => ({ name, size, type });
const same = (d: FileDescriptor) => d;

describe('files definition', () => {
    const artwork = files({ accept: ['image/*', '.pdf', '.md', 'text/markdown'], maxSize: 10 * MB, maxFiles: 3 });

    test('matches MIME wildcards, MIME types and extensions', () => {
        expect(checkFile(artwork, f('logo.png', 10, 'image/png'))).toBeNull();
        expect(checkFile(artwork, f('brief.pdf', 10, 'application/pdf'))).toBeNull();
        // Browsers often report Markdown with no type at all.
        expect(checkFile(artwork, f('directions.md', 10, ''))).toBeNull();
        expect(checkFile(artwork, f('notes.docx', 10, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))?.code).toBe('type');
    });

    test('size limits', () => {
        expect(checkFile(artwork, f('huge.png', 11 * MB, 'image/png'))).toEqual({
            code: 'too-large',
            message: 'huge.png is larger than 10 MB',
        });
        expect(checkFile(files({ minSize: 100 }), f('empty.txt', 0))?.code).toBe('too-small');
    });

    test('custom rules run after the built-in checks', () => {
        const noDrafts = files({ rules: [(d) => (d.name.startsWith('draft') ? { code: 'draft', message: 'No drafts' } : null)] });
        expect(checkFile(noDrafts, f('draft-1.pdf'))).toEqual({ code: 'draft', message: 'No drafts' });
    });

    test('accept attribute', () => {
        expect(acceptAttribute(artwork)).toBe('image/*,.pdf,.md,text/markdown');
        expect(acceptAttribute(files())).toBeUndefined();
    });
});

describe('addFiles', () => {
    test('adds in order, then refuses beyond the limit and duplicates', () => {
        const def = files({ maxFiles: 2 });
        const a = f('a.png'), b = f('b.png'), c = f('c.png');
        const first = addFiles(def, [], [a, a], same);
        expect(first.next).toEqual([a]);
        expect(first.rejected.map((r) => r.code)).toEqual(['duplicate']);
        const second = addFiles(def, first.next, [b, c], same);
        expect(second.next).toEqual([a, b]);
        expect(second.rejected).toMatchObject([{ code: 'too-many', message: "c.png wasn't added: up to 2 files" }]);
    });

    test('a single-file field replaces, and keeps its file when the new one is refused', () => {
        const def = files({ accept: ['.pdf'] });
        const one = f('one.pdf'), two = f('two.pdf'), bad = f('photo.png', 10, 'image/png');
        expect(addFiles(def, [one], [two], same).next).toEqual([two]);
        const refused = addFiles(def, [one], [bad], same);
        expect(refused.next).toEqual([one]);
        expect(refused.rejected[0].code).toBe('type');
        expect(addFiles(def, [], [one, two], same).rejected[0].code).toBe('too-many');
    });

    test('duplicates can be allowed', () => {
        expect(addFiles(files({ maxFiles: 3, rejectDuplicates: false }), [], [f('a'), f('a')], same).next).toHaveLength(2);
    });

    test('messages are overridable', () => {
        const fr = files({ maxSize: 1, messages: { tooLarge: (d) => `${d.name} est trop volumineux` } });
        expect(checkFile(fr, f('a.png', 5))?.message).toBe('a.png est trop volumineux');
    });
});

describe('helpers', () => {
    test('formatBytes', () => {
        expect(formatBytes(1)).toBe('1 byte');
        expect(formatBytes(830 * 1024)).toBe('830 KB');
        expect(formatBytes(2.44 * MB)).toBe('2.4 MB');
    });

    test('fileKind', () => {
        expect(fileKind(f('a.png', 1, 'image/png'))).toBe('image');
        expect(fileKind(f('a.pdf'))).toBe('pdf');
        expect(fileKind(f('a.md'))).toBe('text');
        expect(fileKind(f('a.zip', 1, 'application/zip'))).toBe('other');
    });
});
