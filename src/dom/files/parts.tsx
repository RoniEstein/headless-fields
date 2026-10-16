import { createContext, Fragment, isValidElement, useContext, type ReactNode } from 'react';
import type { FilesDefinition } from '../../core/files';
import { formatBytes } from '../../core/files';
import type { FileEntry } from '../../react/useFileSelection';
import { useFieldContext } from '../context';
import { FieldRoot } from '../parts';
import type { FieldClassNames } from '../skin';
import { renderPart, type ElementProps, type RenderProp } from './props';
import { useFileField, type FileField as FileFieldState, type FileFieldOptions } from './useFileField';

const FileFieldContext = createContext<FileFieldState | null>(null);
const FileEntryContext = createContext<FileEntry<File> | null>(null);

/** The file field from the nearest <FileField>, for custom parts. */
export function useFileFieldContext(part = 'useFileFieldContext'): FileFieldState {
    const field = useContext(FileFieldContext);
    if (!field) throw new Error(`<${part}> must be rendered inside <FileField>.`);
    return field;
}

function useEntry(part: string): FileEntry<File> {
    const entry = useContext(FileEntryContext);
    if (!entry) throw new Error(`<${part}> must be rendered inside <FileItem>.`);
    return entry;
}

interface PartProps<S> {
    className?: string;
    render?: RenderProp<S>;
}

export interface FileFieldProps extends FileFieldOptions {
    definition: FilesDefinition;
    classNames?: FieldClassNames;
    className?: string;
    children: ReactNode;
}

/**
 * Root of a composed file field. Runs useFileField and shares it with the
 * file parts, and renders the shared field frame so FieldLabel, FieldMessage
 * and the nearest skin work as they do for text fields.
 */
export function FileField({ definition, classNames, className, children, ...options }: FileFieldProps) {
    const field = useFileField(definition, options);
    return (
        <FileFieldContext.Provider value={field}>
            <FieldRoot
                field={field.view}
                inputId={field.ids.input}
                disabled={field.disabled}
                classNames={classNames}
                className={className}
                {...field.data}
            >
                {children}
            </FieldRoot>
        </FileFieldContext.Provider>
    );
}

/** The <label> that wraps the real file input. Style focus with
 *  :has(:focus-visible). To use your own button instead, call
 *  useFileFieldContext().open() from it (that path needs JavaScript). */
export function FileTrigger({ children, className, render }: PartProps<FileFieldState> & { children?: ReactNode }) {
    const field = useFileFieldContext('FileTrigger');
    const { classFor, skin } = useFieldContext('FileTrigger');
    const fallback = isValidElement<ElementProps>(render) ? (render.props.children as ReactNode) : undefined;
    const props = field.getTriggerProps({
        className: classFor('trigger', className) || undefined,
        children: (
            <>
                <input {...field.getInputProps()} />
                {skin.icons?.upload}
                {children ?? fallback}
            </>
        ),
    });
    return renderPart('label', props, render, field);
}

/** A region files can be dropped on. Not focusable and not a button: put a
 *  FileTrigger inside it for keyboard and screen-reader users. */
export function FileDropArea({ children, className, render }: PartProps<FileFieldState> & { children?: ReactNode }) {
    const field = useFileFieldContext('FileDropArea');
    const { classFor } = useFieldContext('FileDropArea');
    const props = field.getDropProps({ className: classFor('dropArea', className) || undefined, children });
    return renderPart('div', props, render, field);
}

/** Short instruction text inside a drop area ("or drop files here"). */
export function FileDropHint({ children, className }: { children: ReactNode; className?: string }) {
    const field = useFileFieldContext('FileDropHint');
    const { classFor } = useFieldContext('FileDropHint');
    return (
        <span {...field.data} className={classFor('dropHint', className) || undefined}>
            {children}
        </span>
    );
}

/** "No file chosen", "brief.pdf" or "3 files chosen". */
export function FileSummary({ className, render }: PartProps<FileFieldState>) {
    const field = useFileFieldContext('FileSummary');
    const { classFor } = useFieldContext('FileSummary');
    const props = { ...field.data, className: classFor('fileSummary', className) || undefined, children: field.summary };
    return renderPart('span', props, render, field);
}

/** The chosen files. Pass a function to render each row your way. Renders
 *  nothing while the selection is empty. */
export function FileList({
    children,
    className,
    render,
}: PartProps<FileFieldState> & { children?: (entry: FileEntry<File>) => ReactNode }) {
    const field = useFileFieldContext('FileList');
    const { classFor } = useFieldContext('FileList');
    if (field.entries.length === 0) return null;
    const rows = field.entries.map((entry) => (
        <Fragment key={entry.id}>{children ? children(entry) : <FileItem entry={entry} />}</Fragment>
    ));
    const props = { ...field.data, className: classFor('fileList', className) || undefined, children: rows };
    return renderPart('ul', props, render, field);
}

/** One chosen file. Default content: preview, name, size, remove button. */
export function FileItem({
    entry,
    children,
    className,
    render,
}: PartProps<FileEntry<File>> & { entry: FileEntry<File>; children?: ReactNode }) {
    const field = useFileFieldContext('FileItem');
    const { classFor } = useFieldContext('FileItem');
    const content = children ?? (
        <>
            <FilePreview />
            <FileName />
            <FileSize />
            <FileRemove />
        </>
    );
    const props = field.getItemProps(entry, {
        className: classFor('fileItem', className) || undefined,
        children: content,
    });
    return <FileEntryContext.Provider value={entry}>{renderPart('li', props, render, entry)}</FileEntryContext.Provider>;
}

/** A thumbnail for images; the skin's file icon for anything else. */
export function FilePreview({ className, render }: PartProps<FileEntry<File>>) {
    const field = useFileFieldContext('FilePreview');
    const entry = useEntry('FilePreview');
    const { classFor, skin } = useFieldContext('FilePreview');
    const url = field.previewUrl(entry);
    const shared = { ...field.getItemProps(entry), className: classFor('filePreview', className) || undefined };
    if (url) return renderPart('img', { ...shared, src: url, alt: '' }, render, entry);
    if (!skin.icons?.file && !render) return null;
    return renderPart('span', { ...shared, 'aria-hidden': true, children: skin.icons?.file }, render, entry);
}

export function FileName({ className }: { className?: string }) {
    const field = useFileFieldContext('FileName');
    const entry = useEntry('FileName');
    const { classFor } = useFieldContext('FileName');
    return (
        <span {...field.getItemProps(entry)} className={classFor('fileName', className) || undefined}>
            {entry.name}
        </span>
    );
}

export function FileSize({ className, format = formatBytes }: { className?: string; format?: (bytes: number) => string }) {
    const field = useFileFieldContext('FileSize');
    const entry = useEntry('FileSize');
    const { classFor } = useFieldContext('FileSize');
    return (
        <span {...field.getItemProps(entry)} className={classFor('fileSize', className) || undefined}>
            {format(entry.size)}
        </span>
    );
}

/** Removes its file, named for it ("Remove brief.pdf"), and moves focus to
 *  the next file or back to the input. */
export function FileRemove({ children, className, render }: PartProps<FileEntry<File>> & { children?: ReactNode }) {
    const field = useFileFieldContext('FileRemove');
    const entry = useEntry('FileRemove');
    const { classFor, skin } = useFieldContext('FileRemove');
    const fallback = isValidElement<ElementProps>(render) ? (render.props.children as ReactNode) : undefined;
    const props = field.getRemoveProps(entry, {
        className: classFor('fileRemove', className) || undefined,
        children: children ?? fallback ?? skin.icons?.remove ?? '×',
    });
    return renderPart('button', props, render, entry);
}

/** Why files weren't added, one line each, until the next change. */
export function FileRejections({ className }: { className?: string }) {
    const field = useFileFieldContext('FileRejections');
    const { classFor } = useFieldContext('FileRejections');
    if (field.rejections.length === 0) return null;
    return (
        <ul {...field.data} className={classFor('fileRejections', className) || undefined}>
            {field.rejections.map((rejection, index) => (
                <li
                    key={`${rejection.file.name}-${index}`}
                    {...field.getRejectionProps(rejection)}
                    className={classFor('fileRejection') || undefined}
                >
                    {rejection.message}
                </li>
            ))}
        </ul>
    );
}

/** Polite live region announcing additions, removals and rejections.
 *  Render it once per field; it is visually hidden. */
export function FileAnnouncer() {
    const field = useFileFieldContext('FileAnnouncer');
    return <div {...field.getAnnouncerProps()}>{field.announcement}</div>;
}
