import { useRef, useState } from 'react';
import {
    addFiles,
    fileKind,
    type FileDescriptor,
    type FileKind,
    type FileRejection,
    type FilesDefinition,
} from '../core/files';
import type { FieldView } from './view';

export interface FileEntry<H> extends FileDescriptor {
    /** Stable for the life of the handle; use it as a React key. */
    id: string;
    handle: H;
    kind: FileKind;
}

/** Text the field produces. Override for another language or tone. */
export interface FileStrings {
    added: (names: string[]) => string;
    removed: (name: string) => string;
    /** Accessible name of a remove button. */
    remove: (name: string) => string;
    /** Summary when nothing is chosen ("No file chosen"). */
    empty: (maxFiles: number) => string;
    /** Summary when files are chosen. */
    chosen: (names: string[]) => string;
}

export const defaultFileStrings: FileStrings = {
    added: (names) => (names.length === 1 ? `Added ${names[0]}.` : `Added ${names.length} files.`),
    removed: (name) => `Removed ${name}.`,
    remove: (name) => `Remove ${name}`,
    empty: (maxFiles) => (maxFiles === 1 ? 'No file chosen' : 'No files chosen'),
    chosen: (names) => (names.length === 1 ? names[0] : `${names.length} files chosen`),
};

export interface FileSelectionOptions<H> {
    value: readonly H[];
    onChange: (next: H[]) => void;
    /** Reads name, size and type from a platform handle. */
    describe: (handle: H) => FileDescriptor;
    required?: boolean;
    disabled?: boolean;
    /** An error from outside the field (a failed submit). Always shown. */
    serverError?: string;
    /** Help that stays visible ("PNG or PDF, up to 10 MB"). Errors show in
     *  the message and never replace it. */
    hint?: string;
    strings?: Partial<FileStrings>;
}

export interface FileSelection<H> {
    definition: FilesDefinition;
    entries: FileEntry<H>[];
    /** Files refused by the most recent add, with a message for each. */
    rejections: FileRejection<H>[];
    /** Text for a polite live region: what just changed. */
    announcement: string;
    /** "No file chosen", "brief.pdf", "3 files chosen". */
    summary: string;
    /** Frame state for labels and messages (FieldRoot, FieldMessage). */
    view: FieldView;
    maxReached: boolean;
    disabled: boolean;
    strings: FileStrings;
    add: (handles: readonly H[]) => void;
    remove: (id: string) => void;
    clear: () => void;
    /** The user has left the field; a required field may now complain. */
    touch: () => void;
}

/**
 * The behaviour of a file field for any React renderer: adding with the
 * definition's rules, removing, rejections, announcements and feedback.
 * Platform adapters supply the handles (browser File, Expo asset).
 */
export function useFileSelection<H>(
    definition: FilesDefinition,
    options: FileSelectionOptions<H>,
): FileSelection<H> {
    const { value, onChange, describe, required = false, disabled = false } = options;
    const strings = { ...defaultFileStrings, ...options.strings };
    const [rejections, setRejections] = useState<FileRejection<H>[]>([]);
    const [announcement, setAnnouncement] = useState('');
    const [touched, setTouched] = useState(false);
    const ids = useStableIds<H>();

    const entries: FileEntry<H>[] = value.map((handle) => {
        const file = describe(handle);
        return { ...file, id: ids(handle), handle, kind: fileKind(file) };
    });

    function add(handles: readonly H[]) {
        if (disabled || handles.length === 0) return;
        const result = addFiles(definition, value, handles, describe);
        setRejections(result.rejected);
        setTouched(true);
        const parts: string[] = [];
        if (result.added.length > 0) {
            parts.push(strings.added(result.added.map((h) => describe(h).name)));
        }
        parts.push(...result.rejected.map((r) => `${r.message}.`));
        setAnnouncement(parts.join(' '));
        if (result.added.length > 0) onChange(result.next);
    }

    function remove(id: string) {
        const entry = entries.find((e) => e.id === id);
        if (!entry || disabled) return;
        setRejections([]);
        setAnnouncement(strings.removed(entry.name));
        onChange(value.filter((h) => h !== entry.handle));
    }

    function clear() {
        setRejections([]);
        setAnnouncement('');
        if (value.length > 0) onChange([]);
    }

    const missing = required && touched && value.length === 0;
    const message = options.serverError || (missing ? definition.requiredMessage : '') || '';
    const invalid = !!options.serverError || missing;

    return {
        definition,
        entries,
        rejections,
        announcement,
        summary: value.length === 0 ? strings.empty(definition.maxFiles) : strings.chosen(entries.map((e) => e.name)),
        view: {
            status: invalid ? 'invalid' : value.length > 0 ? 'valid' : 'idle',
            hint: options.hint ?? '',
            message,
            tone: message ? 'error' : null,
            indicator: null,
            reservesIndicator: false,
            focused: false,
            touched,
            required,
            filled: value.length > 0,
        },
        maxReached: value.length >= definition.maxFiles && definition.maxFiles > 1,
        disabled,
        strings,
        add,
        remove,
        clear,
        touch: () => setTouched(true),
    };
}

/** Gives every handle an id that survives re-renders and reordering. */
function useStableIds<H>(): (handle: H) => string {
    const objects = useRef(new WeakMap<object, string>());
    const others = useRef(new Map<unknown, string>());
    const counter = useRef(0);
    return (handle) => {
        const store = typeof handle === 'object' && handle !== null ? objects.current : others.current;
        const key = handle as unknown as object;
        let id = store.get(key);
        if (!id) {
            id = `file-${++counter.current}`;
            store.set(key, id);
        }
        return id;
    };
}
