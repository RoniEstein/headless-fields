import acceptsType from 'attr-accept';
import { fromEvent, type FileWithPath } from 'file-selector';
import {
    useEffect,
    useId,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
} from 'react';
import { acceptAttribute, type FileDescriptor, type FileRejection, type FilesDefinition } from '../../core/files';
import {
    useFileSelection,
    type FileEntry,
    type FileSelection,
    type FileSelectionOptions,
} from '../../react/useFileSelection';
import { describedBy } from '../context';
import { mergeProps, visuallyHidden, type ElementProps } from './props';

export interface FileFieldOptions extends Omit<FileSelectionOptions<File>, 'describe'> {
    /** Id for the input; label and message ids derive from it. */
    id?: string;
    /** Form field name, so a plain form post carries the files. */
    name?: string;
}

export interface FileFieldIds {
    input: string;
    label: string;
    hint: string;
    message: string;
    trigger: string;
}

export interface FileField extends FileSelection<File> {
    ids: FileFieldIds;
    /** Files are being dragged over a drop area. */
    dragging: boolean;
    /** What is being dragged can't all be accepted. */
    dragReject: boolean;
    /** Opens the browser's file picker. Needs JavaScript and a user gesture;
     *  the label from getTriggerProps works without either. */
    open: () => void;
    /** An object URL for an image entry (revoked automatically), else undefined. */
    previewUrl: (entry: FileEntry<File>) => string | undefined;
    /** State attributes, also spread by every getter. */
    data: Record<string, string | undefined>;
    getRootProps: (props?: ElementProps) => ElementProps;
    getLabelProps: (props?: ElementProps) => ElementProps;
    getTriggerProps: (props?: ElementProps) => ElementProps;
    getInputProps: (props?: ElementProps) => ElementProps;
    getDropProps: (props?: ElementProps) => ElementProps;
    getItemProps: (entry: FileEntry<File>, props?: ElementProps) => ElementProps;
    getRemoveProps: (entry: FileEntry<File>, props?: ElementProps) => ElementProps;
    getRejectionProps: (rejection: FileRejection<File>, props?: ElementProps) => ElementProps;
    getHintProps: (props?: ElementProps) => ElementProps;
    getMessageProps: (props?: ElementProps) => ElementProps;
    getAnnouncerProps: (props?: ElementProps) => ElementProps;
}

const flag = (on: boolean) => (on ? '' : undefined);

const describe = (file: File): FileDescriptor => ({
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
});

function draggingFiles(event: { dataTransfer?: DataTransfer | null }): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

/** Whether a drag can be judged unacceptable before the drop. Only MIME types
 *  are visible while dragging (not names), so extension rules can't be checked
 *  yet and count as acceptable. */
function wouldReject(definition: FilesDefinition, items: DataTransferItemList | undefined, held: number): boolean {
    const files = Array.from(items ?? []).filter((item) => item.kind === 'file');
    const room = definition.maxFiles === 1 ? 1 : definition.maxFiles - held;
    if (files.length > room) return true;
    if (definition.accept.length === 0 || definition.accept.some((a) => a.startsWith('.'))) {
        return false;
    }
    return files.some((item) => item.type !== '' && !acceptsType({ name: '', type: item.type }, [...definition.accept]));
}

/**
 * Browser file selection with prop getters, for fully custom markup. The
 * native file input stays the real control: visually hidden, focusable,
 * labelled, inside the trigger label. A drop area is a plain region (no role,
 * no tab stop), so there are never nested controls.
 */
export function useFileField(definition: FilesDefinition, options: FileFieldOptions): FileField {
    const selection = useFileSelection(definition, { ...options, describe });
    const generated = useId();
    const input = options.id ?? `file-${generated}`;
    const ids: FileFieldIds = {
        input,
        label: `${input}-label`,
        hint: `${input}-hint`,
        message: `${input}-message`,
        trigger: `${input}-trigger`,
    };

    const inputRef = useRef<HTMLInputElement | null>(null);
    const depth = useRef(0);
    const [dragging, setDragging] = useState(false);
    const [dragReject, setDragReject] = useState(false);
    const [picks, setPicks] = useState(0);

    // Keep the input's own FileList equal to the value, so native `required`
    // and a plain form post agree with what the user sees.
    const { value } = options;
    useEffect(() => {
        const node = inputRef.current;
        if (!node) return;
        try {
            const transfer = new DataTransfer();
            for (const file of value) transfer.items.add(file);
            node.files = transfer.files;
        } catch {
            if (value.length === 0) node.value = '';
        }
    }, [value, picks]);

    // A file dropped beside a drop area would make the browser open it and
    // leave the form. Swallow those drops while the field is mounted.
    useEffect(() => {
        const prevent = (event: globalThis.DragEvent) => {
            if (draggingFiles(event)) event.preventDefault();
        };
        document.addEventListener('dragover', prevent);
        document.addEventListener('drop', prevent);
        return () => {
            document.removeEventListener('dragover', prevent);
            document.removeEventListener('drop', prevent);
        };
    }, []);

    const previews = usePreviews(selection.entries);
    const focusAfterRemove = useFocusAfterRemove(selection.entries, inputRef);

    const data = {
        'data-state': selection.view.status,
        'data-disabled': flag(selection.disabled),
        'data-required': flag(selection.view.required),
        'data-has-files': flag(selection.entries.length > 0),
        'data-max-reached': flag(selection.maxReached),
        'data-dragging': flag(dragging),
        'data-drag-reject': flag(dragging && dragReject),
    };

    const endDrag = () => {
        depth.current = 0;
        setDragging(false);
        setDragReject(false);
    };

    return {
        ...selection,
        ids,
        dragging,
        dragReject,
        data,
        previewUrl: previews,
        open() {
            const node = inputRef.current;
            if (!node || selection.disabled) return;
            // click() rather than showPicker(): WebKit doesn't open the
            // picker from showPicker() on a file input in every case, and
            // click() works in all engines (react-dropzone and React Aria
            // do the same).
            node.click();
        },
        getRootProps: (props) => mergeProps({ ...data }, props),
        getLabelProps: (props) => mergeProps({ ...data, id: ids.label, htmlFor: ids.input }, props),
        getTriggerProps: (props) =>
            mergeProps({ ...data, id: ids.trigger, htmlFor: ids.input }, props),
        getInputProps: (props) =>
            mergeProps(
                {
                    ref: (node: HTMLInputElement | null) => {
                        inputRef.current = node;
                    },
                    id: ids.input,
                    type: 'file',
                    name: options.name,
                    accept: acceptAttribute(definition),
                    multiple: definition.maxFiles > 1,
                    required: selection.view.required,
                    disabled: selection.disabled,
                    'aria-labelledby': `${ids.label} ${ids.trigger}`,
                    'aria-describedby': describedBy(selection.view, ids),
                    'aria-invalid': selection.view.status === 'invalid' || undefined,
                    style: visuallyHidden,
                    onChange: (event: ChangeEvent<HTMLInputElement>) => {
                        selection.add(Array.from(event.currentTarget.files ?? []));
                        setPicks((n) => n + 1);
                    },
                    onBlur: () => selection.touch(),
                },
                props,
            ),
        getDropProps: (props) =>
            mergeProps(
                {
                    ...data,
                    onDragEnter: (event: DragEvent) => {
                        if (!draggingFiles(event)) return;
                        event.preventDefault();
                        depth.current += 1;
                        setDragging(true);
                        setDragReject(
                            selection.disabled ||
                                wouldReject(definition, event.dataTransfer.items, selection.entries.length),
                        );
                    },
                    onDragOver: (event: DragEvent) => {
                        if (!draggingFiles(event)) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = selection.disabled ? 'none' : 'copy';
                    },
                    onDragLeave: (event: DragEvent) => {
                        if (!draggingFiles(event)) return;
                        depth.current -= 1;
                        if (depth.current <= 0) endDrag();
                    },
                    onDrop: async (event: DragEvent) => {
                        if (!draggingFiles(event)) return;
                        event.preventDefault();
                        endDrag();
                        if (selection.disabled) return;
                        // file-selector flattens dropped folders and fills in
                        // MIME types the browser left empty.
                        const dropped = await fromEvent(event.nativeEvent);
                        selection.add(dropped.filter((f): f is FileWithPath => f instanceof File));
                        selection.touch();
                    },
                },
                props,
            ),
        getItemProps: (entry, props) =>
            mergeProps({ ...data, 'data-kind': entry.kind, 'data-file-id': entry.id }, props),
        getRemoveProps: (entry, props) =>
            mergeProps(
                {
                    ...data,
                    type: 'button',
                    'aria-label': selection.strings.remove(entry.name),
                    disabled: selection.disabled,
                    ref: focusAfterRemove.register(entry.id),
                    onClick: () => {
                        focusAfterRemove.before(entry.id);
                        selection.remove(entry.id);
                    },
                },
                props,
            ),
        getRejectionProps: (rejection, props) =>
            mergeProps({ ...data, 'data-error-code': rejection.code }, props),
        getHintProps: (props) => mergeProps({ ...data, id: ids.hint }, props),
        getMessageProps: (props) =>
            mergeProps({ ...data, id: ids.message, 'data-tone': selection.view.tone ?? undefined }, props),
        getAnnouncerProps: (props) =>
            mergeProps(
                { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', style: visuallyHidden },
                props,
            ),
    };
}

/** Object URLs for image previews, created on demand and revoked when the
 *  file leaves the selection or the field unmounts. */
function usePreviews(entries: FileEntry<File>[]) {
    const urls = useRef(new Map<string, string>());
    useEffect(() => {
        const live = new Set(entries.map((e) => e.id));
        for (const [id, url] of urls.current) {
            if (!live.has(id)) {
                URL.revokeObjectURL(url);
                urls.current.delete(id);
            }
        }
    }, [entries]);
    useEffect(() => {
        const map = urls.current;
        return () => {
            for (const url of map.values()) URL.revokeObjectURL(url);
            map.clear();
        };
    }, []);
    return (entry: FileEntry<File>) => {
        if (entry.kind !== 'image' || typeof URL.createObjectURL !== 'function') return undefined;
        let url = urls.current.get(entry.id);
        if (!url) {
            url = URL.createObjectURL(entry.handle);
            urls.current.set(entry.id, url);
        }
        return url;
    };
}

/** After a removal, focus goes to the next file's remove button, else the
 *  previous one, else back to the input, so keyboard users never land on
 *  the page body. */
function useFocusAfterRemove(entries: FileEntry<File>[], inputRef: { current: HTMLInputElement | null }) {
    const buttons = useRef(new Map<string, HTMLElement>());
    const target = useRef<string | 'input' | null>(null);

    useEffect(() => {
        if (target.current === null) return;
        const node = target.current === 'input' ? inputRef.current : buttons.current.get(target.current);
        target.current = null;
        node?.focus();
    }, [entries, inputRef]);

    return {
        register: (id: string) => (node: HTMLElement | null) => {
            if (node) buttons.current.set(id, node);
            else buttons.current.delete(id);
        },
        before(id: string) {
            const index = entries.findIndex((e) => e.id === id);
            const next = entries[index + 1] ?? entries[index - 1];
            target.current = next ? next.id : 'input';
        },
    };
}
