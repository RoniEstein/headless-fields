/**
 * The vocabulary of a field, with no platform in it: no DOM, no React, no
 * styling. Everything here runs anywhere JavaScript does.
 *
 * A field holds three representations of what the user typed:
 *   display — what is in the box, e.g. "(204) 555 - 1234"
 *   raw     — the canonical characters, e.g. "2045551234"
 *   value   — what the form receives, e.g. "(204) 555 - 1234" or an ISO date
 * The mask converts display ⇄ raw; the codec converts raw ⇄ value.
 */

/** When an issue may be shown as an error.
 *  immediate — the input is already wrong (bad area code); say so now.
 *  blur      — the user may still be typing (3 of 10 digits); hint while
 *              focused, error once they leave the field. */
export type Timing = 'immediate' | 'blur';

export interface Issue {
    message: string;
    timing: Timing;
    /** Set on the issue raised for an empty required field. */
    required?: true;
}

/** A rule inspects a non-empty raw value and reports the first problem. */
export type Rule = (raw: string) => Issue | null;

/** Converts between what the user typed and the canonical raw characters. */
export interface Mask {
    /** Typed, pasted or autofilled text → raw. Drops characters that cannot
     *  belong at their position and truncates at the maximum length. */
    accept(text: string): string;
    /** Raw → the text shown in the box. */
    format(raw: string): string;
    /** True when raw holds a full answer (all digits typed). */
    complete(raw: string): boolean;
    /** Shown (as a blur-timed issue) while raw is partial. Omit for silence. */
    incomplete?: (raw: string) => string;
}

/** Converts between raw and the value handed to the form. */
export interface Codec<V> {
    toValue(raw: string): V;
    fromValue(value: V): string;
    /** The value sent when the field is cleared. */
    empty: V;
    /** Defaults to Object.is. */
    equals?: (a: V, b: V) => boolean;
}

/** always     — every keystroke reaches the form (plain text, numbers).
 *  when-valid — only complete, issue-free answers (or a clear) reach the
 *               form, so a half-typed phone number never gets saved. */
export type Emit = 'always' | 'when-valid';

/** Platform-neutral input hints. Web tokens; native adapters map them. */
export interface InputHints {
    type?: 'text' | 'email' | 'tel' | 'password' | 'url' | 'search';
    keyboard?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url';
    autoComplete?: string;
    autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
    /** Maximum length of the displayed text. */
    maxLength?: number;
    name?: string;
}

export interface FieldDefinition<V = string> {
    mask: Mask;
    codec: Codec<V>;
    rules: readonly Rule[];
    emit: Emit;
    input: InputHints;
    /** Message for an empty required field. Omit to rely on native
     *  `required` only. */
    requiredMessage?: string;
    /** Informational text derived from a partial or complete answer
     *  ("January 2, 1980"). Shown as a hint when nothing is wrong. */
    describe?: (raw: string) => string;
    /** Whether a complete, issue-free answer earns a valid indicator. Fields
     *  with nothing to check (plain text) leave this off. */
    indicateValid: boolean;
    /** Width of the expected answer in characters (the typing surface).
     *  Undefined means free text: the skin decides, usually full width. */
    surface?: number;
    label?: string;
    placeholder?: string;
}
