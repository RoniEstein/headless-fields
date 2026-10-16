import { describe, expect, test } from 'bun:test';
import { evaluate, resolveFeedback, type FieldDefinition } from '../src/core';
import { birthdate, date, email, healthNumber, number, phone, postalCode } from '../src/definitions';

const issue = <V>(definition: FieldDefinition<V>, raw: string) => evaluate(definition, raw, false).issue?.message ?? null;
const accept = <V>(definition: FieldDefinition<V>, text: string) => definition.mask.accept(text);
const display = <V>(definition: FieldDefinition<V>, text: string) => definition.mask.format(accept(definition, text));

describe('phone', () => {
    test('formats as typed and drops a leading country code', () => {
        expect(display(phone, '2045')).toBe('(204) 5');
        expect(display(phone, '+1 204 555 1234')).toBe('(204) 555 - 1234');
    });
    test('checks area code and exchange', () => {
        expect(issue(phone, '104')).toBe('Area code must start with 2–9');
        expect(issue(phone, '2041')).toBe('Exchange must start with 2–9');
    });
    test('has a 16 character surface', () => expect(phone.surface).toBe(16));
});

describe('postal code', () => {
    test('accepts letters and digits by position only', () => {
        expect(display(postalCode, 'r2c0a1')).toBe('R2C 0A1');
        expect(accept(postalCode, 'D2C')).toBe('C');
        expect(accept(postalCode, 'R2W')).toBe('R2W');
    });
    test('partial is a blur issue', () => {
        expect(evaluate(postalCode, 'R2C', false).issue).toEqual({ message: 'Format: A1A 1A1', timing: 'blur' });
    });
});

describe('email', () => {
    test('definite mistakes are immediate, shape problems wait', () => {
        expect(evaluate(email, 'a b', false).issue?.timing).toBe('immediate');
        expect(evaluate(email, 'ab', false).issue).toEqual({ message: 'Missing @', timing: 'blur' });
        expect(issue(email, 'a@b.c')).toBe('TLD is too short');
        expect(issue(email, 'a@example.com')).toBeNull();
    });
});

describe('number', () => {
    const percent = number({ min: 1, max: 99, integer: true });
    test('filters to digits and sizes to the widest answer', () => {
        expect(accept(percent, '4a2.5')).toBe('425');
        expect(percent.surface).toBe(2);
    });
    test('range errors are immediate', () => {
        expect(issue(percent, '100')).toBe('Must be at most 99');
        expect(issue(percent, '0')).toBe('Must be at least 1');
    });
    test('decimals and negatives', () => {
        const signed = number({ allowNegative: true });
        expect(accept(signed, '-1.2.3')).toBe('-1.23');
        expect(signed.codec.toValue('-')).toBeNull();
        expect(signed.surface).toBeUndefined();
    });
});

describe('dates', () => {
    const thisYear = new Date().getFullYear();
    test('formats, accepts autofilled ISO and emits ISO', () => {
        expect(display(birthdate, '01021980')).toBe('01 / 02 / 1980');
        expect(accept(birthdate, '1980-01-02')).toBe('01021980');
        expect(birthdate.codec.toValue('01021980')).toBe('1980-01-02');
    });
    test('describes the date as it is typed', () => {
        const result = resolveFeedback(birthdate, { raw: '0102', touched: false, required: false });
        expect(result).toMatchObject({ tone: 'hint', message: 'January 2' });
    });
    test('catches impossible parts early', () => {
        expect(issue(birthdate, '13')).toBe('Invalid month');
        expect(issue(birthdate, '0230')).toBe('Invalid day');
        expect(issue(birthdate, `0101${thisYear + 1}`)).toBe('Future date');
        expect(issue(birthdate, '010121')).toBe('Future date');
        expect(issue(birthdate, '010118')).toBe('Invalid year');
    });
    test('a birthday later this year is still in the future', () => {
        const later = new Date();
        later.setDate(later.getDate() + 2);
        if (later.getFullYear() !== thisYear) return;
        const mm = String(later.getMonth() + 1).padStart(2, '0');
        const dd = String(later.getDate()).padStart(2, '0');
        expect(issue(birthdate, `${mm}${dd}${thisYear}`)).toBe('Future date');
    });
    test('a general date names its real bounds', () => {
        const bounded = date({ minDate: '2026-01-01', maxDate: '2026-12-31' });
        expect(issue(bounded, '12312025')).toBe('Year must be 2026 or later');
        expect(issue(date(), `0101${thisYear + 1}`)).toBe(`Year must be ${thisYear} or earlier`);
    });
});

describe('health numbers', () => {
    test('formats per province', () => {
        expect(display(healthNumber('MB'), '123456789')).toBe('123 456 789');
        expect(display(healthNumber('AB'), '123456789')).toBe('12345-6789');
        expect(display(healthNumber('ON'), '1234567890ab')).toBe('1234-567-890-AB');
        expect(display(healthNumber('QC'), 'abcd12345678')).toBe('ABCD 1234 5678');
        expect(accept(healthNumber('NT'), 'x n1234567')).toBe('N1234567');
    });
    test('sizes to the province placeholder and guides until valid', () => {
        expect(healthNumber('NL').surface).toBe(15);
        expect(issue(healthNumber('MB'), '000000000')).toBe('PHIN must be 9 digits');
        expect(issue(healthNumber('MB'), '123456789')).toBeNull();
    });
    test('the same province gives the same definition', () => {
        expect(healthNumber('BC')).toBe(healthNumber('BC'));
    });
});
