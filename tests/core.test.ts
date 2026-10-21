import { describe, expect, test } from 'bun:test';
import {
    defineField,
    initialFieldState,
    masked,
    rawForValue,
    reduceField,
    resolveFeedback,
    text,
    valueToEmit,
    type FeedbackContext,
    type FieldDefinition,
} from '../src/core';
import { email, phone, postalCode } from '../src/definitions';

function feedback<V>(definition: FieldDefinition<V>, context: Partial<FeedbackContext> & { raw: string }) {
    return resolveFeedback(definition, { touched: false, required: false, ...context });
}

describe('feedback policy', () => {
    test('an immediate issue is an error while typing', () => {
        const result = feedback(phone, { raw: '1' });
        expect(result).toMatchObject({ status: 'invalid', tone: 'error', message: 'Area code must start with 2–9' });
    });

    test('a blur issue is information while typing and an error after blur', () => {
        expect(feedback(phone, { raw: '204' })).toMatchObject({ status: 'idle', tone: 'info', message: '3 of 10 digits' });
        expect(feedback(phone, { raw: '204', touched: true })).toMatchObject({ status: 'invalid', tone: 'error' });
    });

    test('a server error wins over everything', () => {
        expect(feedback(phone, { raw: '2045551234', serverError: 'Taken' })).toMatchObject({
            status: 'invalid',
            message: 'Taken',
        });
    });

    test('a complete answer with no issue is valid', () => {
        expect(feedback(phone, { raw: '2045551234' })).toMatchObject({ status: 'valid', tone: null, message: '' });
    });

    test('the required message waits for blur unless asked for', () => {
        expect(feedback(email, { raw: '', required: true })).toMatchObject({ tone: null });
        expect(feedback(email, { raw: '', required: true, showRequiredHint: true })).toMatchObject({
            tone: 'info',
            message: 'Email is required',
        });
        expect(feedback(email, { raw: '', required: true, touched: true })).toMatchObject({
            tone: 'error',
            message: 'Email is required',
        });
    });

    test('a field without a required message stays quiet when empty', () => {
        expect(feedback(phone, { raw: '', required: true, touched: true })).toMatchObject({ status: 'idle', tone: null });
    });
});

describe('state', () => {
    test('input runs through the mask; focus clears touched', () => {
        let state = initialFieldState(phone, '');
        state = reduceField(phone, state, { type: 'input', text: '(204) 5x5' });
        expect(state.raw).toBe('20455');
        state = reduceField(phone, state, { type: 'blur' });
        expect(state.touched).toBe(true);
        state = reduceField(phone, state, { type: 'focus' });
        expect(state).toMatchObject({ touched: false, focused: true });
    });

    test('when-valid fields emit complete answers and clears only', () => {
        expect(valueToEmit(phone, '20455', '')).toBeUndefined();
        expect(valueToEmit(phone, '2045551234', '')).toBe('(204) 555 - 1234');
        expect(valueToEmit(phone, '', '(204) 555 - 1234')).toBe('');
        expect(valueToEmit(phone, '2045551234', '(204) 555 - 1234')).toBeUndefined();
    });

    test('always fields emit every change', () => {
        expect(valueToEmit(email, 'a', '')).toBe('a');
    });

    test('an outside reset replaces a partial answer', () => {
        expect(rawForValue(phone, '20455', '')).toBe('');
        expect(rawForValue(postalCode, 'R2C', 'R3T 2N2')).toBe('R3T2N2');
    });

    test('a definition composes from layers', () => {
        const upper = defineField(
            text(),
            masked({ accept: (t) => t.toUpperCase(), format: (r) => r, complete: (r) => r.length === 2 }),
        );
        expect(upper.emit).toBe('when-valid');
        expect(valueToEmit(upper, 'MB', '')).toBe('MB');
        expect(valueToEmit(upper, 'M', '')).toBeUndefined();
    });
});
