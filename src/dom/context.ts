import { createContext, useContext } from 'react';
import type { FieldController } from '../react/useField';
import type { FieldView } from '../react/view';
import type { FieldSlot, FieldSkin } from './skin';

export interface FieldIds {
    input: string;
    label: string;
    message: string;
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
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(part: string): FieldContextValue {
    const context = useContext(FieldContext);
    if (!context) {
        throw new Error(`<${part}> must be rendered inside <FieldRoot>.`);
    }
    return context;
}
