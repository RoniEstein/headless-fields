import { useEffect, useState } from 'react';
import { resolveFeedback, type Feedback, type FieldStatus } from '../core/feedback';
import {
    initialFieldState,
    rawForValue,
    reduceField,
    valueToEmit,
    type FieldEvent,
    type FieldState,
} from '../core/state';
import type { FieldDefinition } from '../core/types';
import type { FieldView, Indicator } from './view';

/** A field's help text, fixed or computed from the text typed so far. */
export type Hint = string | ((raw: string) => string);

export interface FieldOptions<V> {
    value: V;
    onChange: (value: V) => void;
    required?: boolean;
    /** An error from outside the field (a failed submit). Always shown. */
    serverError?: string;
    /** Help that stays visible while the user answers ("For example,
     *  Training room"). A function receives the text typed so far, for help
     *  that follows the answer ("120 of 500 characters"). Errors never
     *  replace it; they show in the message. */
    hint?: Hint;
    /** Show the required message before the user has touched the field. */
    showRequiredHint?: boolean;
    /** Force the valid state, for checks that live in the page. */
    valid?: boolean;
    /** Force (true) or suppress (false) the invalid state. */
    invalid?: boolean;
    showValidIndicator?: boolean;
    showInvalidIndicator?: boolean;
    /** Override the definition's typing surface, in characters. */
    chars?: number;
    onFocus?: () => void;
    onBlur?: () => void;
}

export interface FieldController<V> extends FieldView {
    definition: FieldDefinition<V>;
    /** The text to show in the box. */
    display: string;
    raw: string;
    feedback: Feedback;
    /** The user typed, pasted or autofilled `text`. */
    setText: (text: string) => void;
    focus: () => void;
    blur: () => void;
}

/**
 * The base behaviour of every text-like field, for any React renderer (DOM
 * or React Native). Speaks strings, not events: renderers translate their
 * own events into setText / focus / blur.
 */
export function useField<V>(
    definition: FieldDefinition<V>,
    options: FieldOptions<V>,
): FieldController<V> {
    const { value, onChange, required = false } = options;
    const [state, setState] = useState<FieldState>(() =>
        initialFieldState(definition, value),
    );
    const [seen, setSeen] = useState({ value, definition });

    // Follow changes made outside the field (form reset, prefill, a new
    // province) during render, so the box never shows a stale frame.
    let current = state;
    if (seen.definition !== definition || !Object.is(seen.value, value)) {
        const raw =
            seen.definition !== definition
                ? initialFieldState(definition, value).raw
                : rawForValue(definition, state.raw, value);
        setSeen({ value, definition });
        if (raw !== state.raw) {
            current = { ...state, raw };
            setState(current);
        }
    }

    // Normalise what the form holds when the field mounts or its definition
    // changes: an unformatted prefill comes back formatted.
    useEffect(() => {
        const next = valueToEmit(definition, current.raw, value);
        if (next !== undefined) onChange(next);
        // Only on mount and definition change; keystrokes emit in setText.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [definition]);

    function dispatch(event: FieldEvent): FieldState {
        const next = reduceField(definition, current, event);
        setState(next);
        return next;
    }

    const feedback = resolveFeedback(definition, {
        raw: current.raw,
        touched: current.touched,
        required,
        serverError: options.serverError,
        showRequiredHint: options.showRequiredHint,
    });

    const status = statusWithOverrides(feedback.status, options);
    const indicator = indicatorFor(status, definition, options);

    return {
        definition,
        display: definition.mask.format(current.raw),
        raw: current.raw,
        feedback,
        status,
        hint: typeof options.hint === 'function' ? options.hint(current.raw) : (options.hint ?? ''),
        message: feedback.message,
        tone: feedback.tone,
        indicator,
        reservesIndicator:
            (options.showInvalidIndicator ?? true) ||
            (options.showValidIndicator ?? true),
        focused: current.focused,
        touched: current.touched,
        required,
        chars: options.chars ?? definition.surface,
        setText(text) {
            const next = dispatch({ type: 'input', text });
            const out = valueToEmit(definition, next.raw, value);
            if (out !== undefined) onChange(out);
        },
        focus() {
            dispatch({ type: 'focus' });
            options.onFocus?.();
        },
        blur() {
            dispatch({ type: 'blur' });
            options.onBlur?.();
        },
    };
}

function statusWithOverrides<V>(status: FieldStatus, options: FieldOptions<V>): FieldStatus {
    if (options.invalid === true) return 'invalid';
    if (options.invalid === false && status === 'invalid') return 'idle';
    if (options.valid === true && status !== 'invalid') return 'valid';
    return status;
}

function indicatorFor<V>(
    status: FieldStatus,
    definition: FieldDefinition<V>,
    options: FieldOptions<V>,
): Indicator {
    if (status === 'invalid') {
        return (options.showInvalidIndicator ?? true) ? 'invalid' : null;
    }
    if (status === 'valid' && (definition.indicateValid || options.valid === true)) {
        return (options.showValidIndicator ?? true) ? 'valid' : null;
    }
    return null;
}
