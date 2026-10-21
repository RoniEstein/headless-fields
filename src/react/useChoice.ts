import { useState } from 'react';
import type { FieldView } from './view';

export interface ChoiceOptions<T extends string> {
    /** The chosen value; '' while nothing is chosen. */
    value: T | '';
    onChange: (next: T) => void;
    required?: boolean;
    disabled?: boolean;
    /** An error from outside the field (a failed submit). Always shown. */
    serverError?: string;
    /** Help that stays visible while the user chooses. Errors show in the
     *  message and never replace it. */
    hint?: string;
    /** Shown once a required field is left without a choice. */
    requiredMessage?: string;
    /** Show the valid indicator once something is chosen. Default false. */
    showValidIndicator?: boolean;
}

export interface Choice<T extends string> {
    value: T | '';
    /** Frame state for labels and messages (FieldRoot, FieldMessage). */
    view: FieldView;
    disabled: boolean;
    select: (next: T) => void;
    /** The user has left the field; a required field may now complain. */
    touch: () => void;
}

/**
 * The behaviour of a single-choice field (a radio group, a segmented
 * control, a list of cards) for any React renderer: the choice, and the
 * feedback policy shared with the other fields. The required message waits
 * until the user leaves the field without choosing; a server error always
 * shows.
 */
export function useChoice<T extends string>(options: ChoiceOptions<T>): Choice<T> {
    const { value, onChange, required = false, disabled = false } = options;
    const [touched, setTouched] = useState(false);

    const missing = required && touched && value === '';
    const requiredMessage = options.requiredMessage ?? 'Choose an option';
    const message = options.serverError || (missing ? requiredMessage : '');
    const invalid = !!options.serverError || missing;
    const status = invalid ? 'invalid' : value !== '' ? 'valid' : 'idle';
    const showValid = options.showValidIndicator ?? false;

    return {
        value,
        view: {
            status,
            hint: options.hint ?? '',
            message,
            tone: message ? 'error' : null,
            indicator: status === 'invalid' ? 'invalid' : status === 'valid' && showValid ? 'valid' : null,
            reservesIndicator: false,
            focused: false,
            touched,
            required,
        },
        disabled,
        select: (next) => {
            if (disabled) return;
            setTouched(true);
            if (next !== value) onChange(next);
        },
        touch: () => setTouched(true),
    };
}
