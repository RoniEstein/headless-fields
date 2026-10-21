import { createContext, useContext } from 'react';
import type { FieldController } from '../react/useField';
import type { FieldView } from '../react/view';
import type { FieldSlot, FieldSkin } from './skin';

export interface FieldIds {
    input: string;
    label: string;
    hint: string;
    message: string;
}

/** The aria-describedby value for a field's control: hint first, then the
 *  message, each only while it has text. */
export function describedBy(
    view: Pick<FieldView, 'hint' | 'message'>,
    ids: { hint: string; message: string },
): string | undefined {
    const parts = [view.hint && ids.hint, view.message && ids.message].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : undefined;
}

/** The state attributes every part carries, for skins to select on. */
export type FieldDataAttributes = Record<`data-${string}`, string | undefined>;

export interface FieldContextValue {
    view: FieldView;
    /** Present for text-like fields; choice controls have no text behaviour. */
    controller?: FieldController<unknown>;
    ids: FieldIds;
    disabled: boolean;
    data: FieldDataAttributes;
    skin: FieldSkin;
    /** Skin class + per-field class + the part's own className. */
    classFor: (slot: FieldSlot, own?: string) => string;
    /** data-slot plus classFor's className, for spreading onto a part. */
    slotProps: (slot: FieldSlot, own?: string) => { 'data-slot': FieldSlot; className: string | undefined };
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(part: string): FieldContextValue {
    const context = useContext(FieldContext);
    if (!context) {
        throw new Error(`<${part}> must be rendered inside <FieldRoot>.`);
    }
    return context;
}
