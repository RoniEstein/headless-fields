import { evaluate } from './feedback';
import type { FieldDefinition } from './types';

/**
 * Field interaction state as a pure reducer, so any framework can hold it:
 * React's useReducer, a Vue ref, a Svelte store or a plain variable.
 */
export interface FieldState {
    raw: string;
    /** Left the field since last focusing it. Refocusing clears it so blur
     *  issues go back to being hints while the user edits. */
    touched: boolean;
    focused: boolean;
}

export type FieldEvent =
    | { type: 'input'; text: string }
    | { type: 'focus' }
    | { type: 'blur' }
    | { type: 'reset'; raw: string };

export function initialFieldState<V>(
    definition: FieldDefinition<V>,
    value: V,
): FieldState {
    return {
        raw: definition.mask.accept(definition.codec.fromValue(value)),
        touched: false,
        focused: false,
    };
}

export function reduceField<V>(
    definition: FieldDefinition<V>,
    state: FieldState,
    event: FieldEvent,
): FieldState {
    switch (event.type) {
        case 'input':
            return { ...state, raw: definition.mask.accept(event.text) };
        case 'focus':
            return { ...state, focused: true, touched: false };
        case 'blur':
            return { ...state, focused: false, touched: true };
        case 'reset':
            return { ...state, raw: event.raw };
    }
}

function same<V>(definition: FieldDefinition<V>, a: V, b: V): boolean {
    return (definition.codec.equals ?? Object.is)(a, b);
}

/**
 * The value to send to the form after raw changed, or `undefined` to send
 * nothing. Never re-sends the value the form already holds.
 */
export function valueToEmit<V>(
    definition: FieldDefinition<V>,
    raw: string,
    current: V,
): V | undefined {
    let next: V | undefined;
    if (definition.emit === 'always') {
        next = definition.codec.toValue(raw);
    } else if (raw === '') {
        next = definition.codec.empty;
    } else {
        const { issue, complete } = evaluate(definition, raw, false);
        next = complete && !issue ? definition.codec.toValue(raw) : undefined;
    }
    return next === undefined || same(definition, next, current)
        ? undefined
        : next;
}

/**
 * Raw to show after the form changed the value from outside (a reset, a
 * prefill). Keeps the user's raw when it already means that value, so "1."
 * is not rewritten to "1" while they type a decimal.
 */
export function rawForValue<V>(
    definition: FieldDefinition<V>,
    raw: string,
    value: V,
): string {
    if (same(definition, definition.codec.toValue(raw), value)) return raw;
    return definition.mask.accept(definition.codec.fromValue(value));
}
