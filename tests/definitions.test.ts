import { describe, expect, test } from 'bun:test';
import { evaluate, resolveFeedback, type FieldDefinition } from '../src/core';
import { birthdate, date, email, healthNumber, longText, number, phone, postalCode, time } from '../src/definitions';

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
    test('a separator after one month or day digit finishes that part', () => {
        expect(accept(birthdate, '4/')).toBe('04');
        expect(accept(birthdate, '04 / 4/')).toBe('0404');
        expect(accept(birthdate, '04 / 4-')).toBe('0404');
        expect(accept(birthdate, '4/4/1992')).toBe('04041992');
        expect(accept(birthdate, '0/')).toBe('0');
        expect(accept(birthdate, '12 / 1')).toBe('121');
        expect(accept(birthdate, '04 / 04 / 1/')).toBe('04041');
    });

    test('a month or day that can only mean one thing finishes itself (phones have no / key)', () => {
        expect(accept(birthdate, '3')).toBe('03');
        expect(display(birthdate, '03')).toBe('03 / ');
        expect(accept(birthdate, '1')).toBe('1');
        expect(accept(birthdate, '12')).toBe('12');
        expect(accept(birthdate, '13')).toBe('013');
        expect(accept(birthdate, '17')).toBe('0107');
        expect(accept(birthdate, '00')).toBe('0');
        expect(accept(birthdate, '04 / 7')).toBe('0407');
        expect(display(birthdate, '0407')).toBe('04 / 07 / ');
        expect(accept(birthdate, '04 / 3')).toBe('043');
        expect(accept(birthdate, '02 / 3')).toBe('0203');
        expect(accept(birthdate, '04 / 00')).toBe('040');
        expect(accept(birthdate, '04 / 04 / 1')).toBe('04041');
    });
    test('backspace over a shown separator removes the digit before it', () => {
        expect(accept(birthdate, '03 /')).toBe('0');
        expect(accept(birthdate, '04 / 07 /')).toBe('040');
        expect(accept(birthdate, '03 / ')).toBe('03');
    });
    test('editing inside a long date never reshuffles it', () => {
        expect(accept(birthdate, '04 / 01 / 992')).toBe('0401992');
    });

    test('describes the date as it is typed', () => {
        const result = resolveFeedback(birthdate, { raw: '0102', touched: false, required: false });
        expect(result).toMatchObject({ tone: 'info', message: 'January 2' });
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

describe('time', () => {
    const t = time();
    test('formats 24-hour digits and pads a lone hour', () => {
        expect(display(t, '0930')).toBe('09:30');
        expect(accept(t, '9')).toBe('09');
        expect(accept(t, '930')).toBe('0930');
        expect(accept(t, '1:')).toBe('01');
        expect(accept(t, '1.')).toBe('01');
        expect(t.codec.toValue('2130')).toBe('21:30');
        expect(t.codec.fromValue('09:30:00')).toBe('0930');
    });
    test('drops digits that cannot belong at their position', () => {
        expect(accept(t, '24')).toBe('2');
        expect(accept(t, '1260')).toBe('120');
    });
    test('converts 12-hour answers with a or p', () => {
        expect(accept(t, '930p')).toBe('2130');
        expect(accept(t, '9 pm')).toBe('2100');
        expect(accept(t, '09:30p')).toBe('2130');
        expect(accept(t, '12a')).toBe('0000');
        expect(accept(t, '12:30:00 PM')).toBe('1230');
    });
    test('reads the answer back on a 12-hour clock', () => {
        const result = resolveFeedback(t, { raw: '2130', touched: false, required: false });
        expect(result.message).toBe('9:30 p.m.');
        expect(resolveFeedback(t, { raw: '0005', touched: false, required: false }).message).toBe('12:05 a.m.');
    });
    test('a partial time waits for blur', () => {
        expect(evaluate(t, '09', false).issue).toEqual({ message: 'Format: HH:MM', timing: 'blur' });
    });
    test('checks bounds and steps', () => {
        const bounded = time({ minTime: '07:00', maxTime: '21:00', stepMinutes: 5 });
        expect(issue(bounded, '0630')).toBe('Must be 7:00 a.m. or later');
        expect(issue(bounded, '2130')).toBe('Must be 9:00 p.m. or earlier');
        expect(issue(bounded, '0907')).toBe('Use 5-minute steps');
        expect(issue(bounded, '0910')).toBeNull();
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

describe('long text', () => {
    const notes = longText({ maxLength: 10 });
    const feedback = (raw: string) => resolveFeedback(notes, { raw, touched: false, required: false });
    test('counts characters as the user types', () => {
        expect(feedback('hello')).toMatchObject({ tone: 'info', message: '5 of 10 characters' });
        expect(feedback('')).toMatchObject({ tone: null, message: '' });
    });
    test('earns no valid mark: any text under the limit is fine', () => {
        expect(notes.indicateValid).toBe(false);
    });
    test('keeps text past the limit and says how far over it is', () => {
        expect(accept(notes, 'hello world!')).toBe('hello world!');
        expect(feedback('hello world')).toMatchObject({ status: 'invalid', tone: 'error', message: '1 character too many' });
        expect(issue(notes, 'hello world!')).toBe('2 characters too many');
    });
});
