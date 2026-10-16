import acceptsType from 'attr-accept';

/**
 * File selection without a platform. The core never touches File, the DOM or
 * React Native: it works on descriptors (name, size, type) and carries each
 * platform's own handle (a browser File, an Expo asset) untouched.
 */
export interface FileDescriptor {
    name: string;
    /** Bytes. */
    size: number;
    /** MIME type; often empty for files the platform doesn't recognise (.md). */
    type: string;
    lastModified?: number;
}

export type FileKind = 'image' | 'pdf' | 'text' | 'other';

export type FileRejectionCode =
    | 'type'
    | 'too-large'
    | 'too-small'
    | 'too-many'
    | 'duplicate'
    | (string & {});

export interface FileProblem {
    code: FileRejectionCode;
    message: string;
}

/** A custom check; return a problem to refuse the file. */
export type FileRule = (file: FileDescriptor) => FileProblem | null;

export interface FileMessages {
    type: (file: FileDescriptor) => string;
    tooLarge: (file: FileDescriptor, maxSize: number) => string;
    tooSmall: (file: FileDescriptor, minSize: number) => string;
    tooMany: (file: FileDescriptor, maxFiles: number) => string;
    duplicate: (file: FileDescriptor) => string;
}

export interface FilesDefinition {
    /** MIME types, wildcards and extensions (`image/*`, `.pdf`). Empty = any. */
    accept: readonly string[];
    maxSize?: number;
    minSize?: number;
    /** 1 = a single file that a new pick replaces. */
    maxFiles: number;
    rejectDuplicates: boolean;
    rules: readonly FileRule[];
    messages: FileMessages;
    /** Shown when a required field is still empty after the user leaves it. */
    requiredMessage: string;
}

export interface FilesOptions extends Partial<Omit<FilesDefinition, 'messages'>> {
    messages?: Partial<FileMessages>;
}

export const KB = 1024;
export const MB = 1024 * KB;

/** "2.4 MB", "830 KB", "12 bytes". */
export function formatBytes(bytes: number): string {
    if (bytes < KB) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / KB;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded} ${units[unit]}`;
}

const DEFAULT_MESSAGES: FileMessages = {
    type: (file) => `${file.name} isn't a file type we accept`,
    tooLarge: (file, max) => `${file.name} is larger than ${formatBytes(max)}`,
    tooSmall: (file, min) => `${file.name} is smaller than ${formatBytes(min)}`,
    tooMany: (file, max) =>
        max === 1
            ? `${file.name} wasn't added: choose one file`
            : `${file.name} wasn't added: up to ${max} files`,
    duplicate: (file) => `${file.name} is already added`,
};

/** Builds a file field definition. Defaults: any type, one file. */
export function files(options: FilesOptions = {}): FilesDefinition {
    return {
        accept: options.accept ?? [],
        maxSize: options.maxSize,
        minSize: options.minSize,
        maxFiles: Math.max(1, options.maxFiles ?? 1),
        rejectDuplicates: options.rejectDuplicates ?? true,
        rules: options.rules ?? [],
        messages: { ...DEFAULT_MESSAGES, ...options.messages },
        requiredMessage: options.requiredMessage ?? 'Choose a file',
    };
}

/** The value for an input's `accept` attribute, or undefined for any. */
export function acceptAttribute(definition: FilesDefinition): string | undefined {
    return definition.accept.length > 0 ? definition.accept.join(',') : undefined;
}

/** Type, size and custom checks for one file (count and duplicates need the
 *  rest of the selection: see addFiles). */
export function checkFile(definition: FilesDefinition, file: FileDescriptor): FileProblem | null {
    const { messages } = definition;
    if (definition.accept.length > 0 && !acceptsType(file, [...definition.accept])) {
        return { code: 'type', message: messages.type(file) };
    }
    if (definition.maxSize !== undefined && file.size > definition.maxSize) {
        return { code: 'too-large', message: messages.tooLarge(file, definition.maxSize) };
    }
    if (definition.minSize !== undefined && file.size < definition.minSize) {
        return { code: 'too-small', message: messages.tooSmall(file, definition.minSize) };
    }
    for (const rule of definition.rules) {
        const problem = rule(file);
        if (problem) return problem;
    }
    return null;
}

/** Image, PDF, text, or other: for icons, previews and styling. */
export function fileKind(file: FileDescriptor): FileKind {
    const type = file.type.toLowerCase();
    const extension = file.name.toLowerCase().split('.').pop() ?? '';
    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf' || extension === 'pdf') return 'pdf';
    if (type.startsWith('text/') || ['md', 'markdown', 'txt', 'csv'].includes(extension)) {
        return 'text';
    }
    return 'other';
}

function sameFile(a: FileDescriptor, b: FileDescriptor): boolean {
    return (
        a.name === b.name &&
        a.size === b.size &&
        (a.lastModified === undefined ||
            b.lastModified === undefined ||
            a.lastModified === b.lastModified)
    );
}

export interface FileRejection<H> {
    handle: H;
    file: FileDescriptor;
    code: FileRejectionCode;
    message: string;
}

export interface AddResult<H> {
    /** The full selection after adding. */
    next: H[];
    added: H[];
    rejected: FileRejection<H>[];
}

/**
 * Adds incoming files to a selection. Each file is checked on its own, then
 * against duplicates and the count limit, in the order given. With
 * maxFiles 1 the first acceptable file replaces the current one.
 */
export function addFiles<H>(
    definition: FilesDefinition,
    current: readonly H[],
    incoming: readonly H[],
    describe: (handle: H) => FileDescriptor,
): AddResult<H> {
    const single = definition.maxFiles === 1;
    const next: H[] = single ? [] : [...current];
    const added: H[] = [];
    const rejected: FileRejection<H>[] = [];
    const reject = (handle: H, file: FileDescriptor, problem: FileProblem) =>
        rejected.push({ handle, file, ...problem });

    for (const handle of incoming) {
        const file = describe(handle);
        const problem = checkFile(definition, file);
        if (problem) {
            reject(handle, file, problem);
            continue;
        }
        if (definition.rejectDuplicates && next.some((h) => sameFile(describe(h), file))) {
            reject(handle, file, {
                code: 'duplicate',
                message: definition.messages.duplicate(file),
            });
            continue;
        }
        if (next.length >= definition.maxFiles) {
            reject(handle, file, {
                code: 'too-many',
                message: definition.messages.tooMany(file, definition.maxFiles),
            });
            continue;
        }
        next.push(handle);
        added.push(handle);
    }

    // A single-file field keeps its current file when nothing new was usable.
    if (single && added.length === 0) return { next: [...current], added, rejected };
    return { next, added, rejected };
}
