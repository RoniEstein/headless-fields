import type { FieldStatus } from '../core/feedback';

export type Indicator = 'valid' | 'invalid' | null;

/**
 * What a renderer needs to draw a field's frame (label, message, indicator,
 * state attributes). Text fields get it from useField; choice controls
 * (checkbox, radio, select) build it with staticField.
 */
export interface FieldView {
    status: FieldStatus;
    message: string;
    tone: 'error' | 'hint' | null;
    indicator: Indicator;
    /** The renderer keeps room for an indicator icon. */
    reservesIndicator: boolean;
    focused: boolean;
    touched: boolean;
    required: boolean;
    /** Typing surface in characters, if the answer has a known width. */
    chars?: number;
}

export interface StaticFieldOptions {
    error?: string;
    hint?: string;
    required?: boolean;
    valid?: boolean;
    invalid?: boolean;
    showValidIndicator?: boolean;
    showInvalidIndicator?: boolean;
}

/** A frame for controls whose behaviour lives elsewhere (Radix checkbox,
 *  radio group, select): the page supplies error, hint and validity. */
export function staticField(options: StaticFieldOptions = {}): FieldView {
    const invalid = options.invalid ?? !!options.error;
    const status: FieldStatus = invalid ? 'invalid' : options.valid ? 'valid' : 'idle';
    const message = options.error || options.hint || '';
    const showInvalid = options.showInvalidIndicator ?? true;
    const showValid = options.showValidIndicator ?? true;
    return {
        status,
        message,
        tone: options.error ? 'error' : message ? 'hint' : null,
        indicator:
            status === 'invalid' && showInvalid
                ? 'invalid'
                : status === 'valid' && showValid
                  ? 'valid'
                  : null,
        reservesIndicator: showInvalid || showValid,
        focused: false,
        touched: false,
        required: options.required ?? false,
    };
}
