import { createContext, useContext, useMemo, type ReactNode } from 'react';

/** Every element a field renders. Each carries the field's data-* state. */
export type FieldSlot =
    | 'root'
    | 'label'
    | 'requiredMark'
    | 'control'
    | 'input'
    | 'adornment'
    | 'indicator'
    | 'message'
    // File fields
    | 'trigger'
    | 'dropArea'
    | 'dropHint'
    | 'fileSummary'
    | 'fileList'
    | 'fileItem'
    | 'filePreview'
    | 'fileName'
    | 'fileSize'
    | 'fileRemove'
    | 'fileRejections'
    | 'fileRejection';

/** Icons a skin can supply. Text fields use valid/invalid; file fields use
 *  upload (in triggers), remove (in remove buttons) and file (rows without
 *  an image preview). A part's own children always win. */
export type FieldIcon = 'valid' | 'invalid' | 'upload' | 'remove' | 'file';

export type FieldClassNames = Partial<Record<FieldSlot, string>>;

export type ClassValue = string | false | null | undefined;
export type MergeClasses = (...classes: ClassValue[]) => string;

/**
 * Everything visual about a field. A skin is plain data: class strings per
 * slot plus the indicator icons. State styling uses the data attributes the
 * parts carry (data-state="invalid", data-focused, data-sized, ...), so a
 * skin never needs logic.
 */
export interface FieldSkin {
    classNames?: FieldClassNames;
    icons?: Partial<Record<FieldIcon, ReactNode>>;
    /** Combines skin and per-field classes. Pass tailwind-merge (or the
     *  project's cn) so later classes override conflicting earlier ones. */
    merge?: MergeClasses;
}

export const joinClasses: MergeClasses = (...classes) =>
    classes.filter(Boolean).join(' ');

const SkinContext = createContext<FieldSkin>({});

/** Merges `over` onto `base`, slot by slot. */
export function extendSkin(base: FieldSkin, over: FieldSkin): FieldSkin {
    const merge = over.merge ?? base.merge ?? joinClasses;
    const classNames: FieldClassNames = { ...base.classNames };
    for (const [slot, value] of Object.entries(over.classNames ?? {})) {
        const key = slot as FieldSlot;
        classNames[key] = merge(base.classNames?.[key], value);
    }
    return {
        merge,
        classNames,
        icons: { ...base.icons, ...over.icons },
    };
}

/**
 * Provides the skin for every field below it. The nearest provider wins, so
 * a page, a section or a state (a dark hero, a compact table) can use its own
 * look. `extend` layers this skin over the inherited one instead of
 * replacing it.
 */
export function FieldSkinProvider({
    skin,
    extend = false,
    children,
}: {
    skin: FieldSkin;
    extend?: boolean;
    children: ReactNode;
}) {
    const parent = useContext(SkinContext);
    const value = useMemo(
        () => (extend ? extendSkin(parent, skin) : skin),
        [extend, parent, skin],
    );
    return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useFieldSkin(): FieldSkin {
    return useContext(SkinContext);
}
