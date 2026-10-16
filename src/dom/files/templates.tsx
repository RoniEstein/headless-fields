import type { ReactNode } from 'react';
import type { FileEntry } from '../../react/useFileSelection';
import { FieldControl, FieldLabel, FieldMessage } from '../parts';
import {
    FileAnnouncer,
    FileDropArea,
    FileDropHint,
    FileField,
    FileList,
    FileRejections,
    FileSummary,
    FileTrigger,
    type FileFieldProps,
} from './parts';

/**
 * Starter compositions for the two common patterns. They use only the public
 * parts, so anything here can be rebuilt (or copied and changed) with the
 * same parts or with useFileField directly. They carry no styling: the
 * nearest skin's slots style them.
 */
export interface FileTemplateProps extends Omit<FileFieldProps, 'children'> {
    label: ReactNode;
    /** Trigger text; defaults to "Choose file" or "Choose files". */
    triggerLabel?: ReactNode;
    /** Render each chosen file your way (defaults to preview, name, size, remove). */
    renderItem?: (entry: FileEntry<File>) => ReactNode;
    /** Extra content at the end of the field. */
    children?: ReactNode;
}

function triggerText(props: FileTemplateProps) {
    return props.triggerLabel ?? (props.definition.maxFiles > 1 ? 'Choose files' : 'Choose file');
}

/** Click to select: a trigger with a summary beside it, then the file list. */
export function FilePickerField(props: FileTemplateProps) {
    const { label, triggerLabel: _t, renderItem, children, ...field } = props;
    return (
        <FileField {...field}>
            <FieldLabel>{label}</FieldLabel>
            <FieldControl>
                <FileTrigger>{triggerText(props)}</FileTrigger>
                <FileSummary />
            </FieldControl>
            <FileList>{renderItem}</FileList>
            <FileRejections />
            <FieldMessage />
            <FileAnnouncer />
            {children}
        </FileField>
    );
}

export interface FileDropFieldProps extends FileTemplateProps {
    /** Text beside the trigger; defaults to "or drop files here". */
    dropHint?: ReactNode;
}

/** A drop area holding the trigger and a hint, then the file list. */
export function FileDropField(props: FileDropFieldProps) {
    const { label, triggerLabel: _t, dropHint, renderItem, children, ...field } = props;
    const hint = dropHint ?? (props.definition.maxFiles > 1 ? 'or drop files here' : 'or drop a file here');
    return (
        <FileField {...field}>
            <FieldLabel>{label}</FieldLabel>
            <FileDropArea>
                <FileTrigger>{triggerText(props)}</FileTrigger>
                <FileDropHint>{hint}</FileDropHint>
            </FileDropArea>
            <FileList>{renderItem}</FileList>
            <FileRejections />
            <FieldMessage />
            <FileAnnouncer />
            {children}
        </FileField>
    );
}
