import { defineField, described, hinted, labelled, masked, sized, text, validated } from '../core/define';
import type { Codec, FieldDefinition, Issue, Mask, Rule } from '../core/types';

const MONTHS = [
    '', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
];

const SEPARATOR_REMNANTS = [' /', '  ', '/ '];

const pad2 = (part: string) => part.padStart(2, '0');

/** "jan", "January", "Sept." → 1-12, or 0 when it isn't a month name. */
function monthNumber(name: string): number {
    const key = name.toLowerCase().replace(/\.$/, '').slice(0, 3);
    return MONTHS.findIndex((month) => month.toLowerCase().startsWith(key) && key.length === 3);
}

/**
 * A whole date arriving at once, from autofill or paste, in any common shape:
 * 1980-01-02, 1980/1/2, 19800102, 1/2/1980, 1-2-1980, 1.2.1980, January 2,
 * 1980, Jan 2 1980 or 2 January 1980. Numbers without a name are read in
 * this field's month-day-year order unless the year comes first.
 */
function wholeDate(text: string): string | null {
    const yearFirst = text.match(/^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})$/);
    if (yearFirst) return pad2(yearFirst[2]) + pad2(yearFirst[3]) + yearFirst[1];
    const yearLast = text.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})$/);
    if (yearLast) return pad2(yearLast[1]) + pad2(yearLast[2]) + yearLast[3];
    // Eight bare digits can only be year-first when they can't be a month first.
    const packed = text.match(/^((?:19|20)\d{2})(\d{2})(\d{2})$/);
    if (packed && parseInt(text.slice(0, 2)) > 12) return packed[2] + packed[3] + packed[1];
    const nameFirst = text.match(/^([a-z]{3,}\.?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
    if (nameFirst && monthNumber(nameFirst[1]) > 0) {
        return pad2(String(monthNumber(nameFirst[1]))) + pad2(nameFirst[2]) + nameFirst[3];
    }
    const dayFirst = text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,}\.?),?\s+(\d{4})$/i);
    if (dayFirst && monthNumber(dayFirst[2]) > 0) {
        return pad2(String(monthNumber(dayFirst[2]))) + pad2(dayFirst[1]) + dayFirst[3];
    }
    return null;
}

/** Day digit at the start of the day: 4-9 (or 3 in February) can only be 0X. */
function startDay(digit: string, month: string): string {
    return digit > '3' || (digit === '3' && month === '02') ? '0' + digit : digit;
}

/**
 * Pads a month or day the moment its first digit can mean only one thing:
 * 2-9 is 0X for a month, 1 then 3-9 is January and the 3-9 starts the day,
 * 4-9 is 0X for a day. 00 is not a month or a day, so the second 0 is refused.
 */
function finishParts(digits: string): string {
    let out = '';
    for (const digit of digits) {
        if (out.length === 0) out = digit > '1' ? '0' + digit : digit;
        else if (out.length === 1) {
            if (out === '1' && digit > '2') out = '01' + startDay(digit, '01');
            else if (!(out === '0' && digit === '0')) out += digit;
        } else if (out.length === 2) out += startDay(digit, out);
        else if (out.length === 3) {
            if (!(out[2] === '0' && digit === '0')) out += digit;
        } else out += digit;
    }
    return out;
}

/**
 * MM / DD / YYYY, typed as 8 digits. Accepts a whole autofilled or pasted date
 * in any common shape (see wholeDate). A
 * separator typed after a single month or day digit finishes that part, so
 * "4/" is April and the next digit starts the day. A first digit that can only
 * start one month or day finishes it on its own: "3" is 03 and "05 / 7" is
 * 05 / 07. A finished month or day shows its separator, so the cursor waits in
 * the next part; backspace over that separator removes the digit before it.
 */
export const monthDayYearMask: Mask = {
    accept(text) {
        const whole = wholeDate(text.trim());
        if (whole) return whole;
        // Only a separator just typed at the end pads; editing earlier in the
        // box never reshuffles parts already entered.
        const ended = text.match(/^(.*?)(\d)\s*[/.-]\s*$/);
        if (ended) {
            const before = ended[1].replace(/\D/g, '');
            if ((before.length === 0 || before.length === 2) && ended[2] !== '0') {
                return before + '0' + ended[2];
            }
        }
        const digits = text.replace(/\D/g, '').slice(0, 8);
        // " / " shown after a finished part, with one character deleted: the
        // user backspaced over the separator, so take the digit before it too.
        const trailing = text.slice(text.search(/\D*$/));
        if ((digits.length === 2 || digits.length === 4) && SEPARATOR_REMNANTS.includes(trailing)) {
            return digits.slice(0, -1);
        }
        // Phones have no "/" key, so month and day finish themselves while they
        // are being typed. A full or nearly full date is left alone, so editing
        // inside it never reshuffles parts already entered.
        return digits.length <= 4 ? finishParts(digits) : digits;
    },
    format(raw) {
        let out = raw.slice(0, 2);
        if (raw.length >= 2) out += ' / ' + raw.slice(2, 4);
        if (raw.length >= 4) out += ' / ' + raw.slice(4, 8);
        return out;
    },
    complete: (raw) => raw.length === 8,
};

/** The form receives YYYY-MM-DD. A partial answer maps to its raw digits so
 *  it never compares equal to a real date or to the empty value. */
export const isoDateCodec: Codec<string> = {
    toValue: (raw) =>
        raw.length === 8 ? `${raw.slice(4, 8)}-${raw.slice(0, 2)}-${raw.slice(2, 4)}` : raw,
    fromValue: (value) => monthDayYearMask.accept(value ?? ''),
    empty: '',
};

function daysInMonth(month: number, year: number | null): number {
    if (month === 2) {
        if (!year) return 29;
        const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        return leap ? 29 : 28;
    }
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

interface Parts {
    month: number;
    day: number;
    yearText: string;
    year: number | null;
}

function parts(raw: string): Parts {
    const yearText = raw.slice(4);
    return {
        month: parseInt(raw.slice(0, 2)) || 0,
        day: parseInt(raw.slice(2, 4)) || 0,
        yearText,
        year: yearText.length === 4 ? parseInt(yearText) : null,
    };
}

/** "January 2, 1980", built from however much has been typed. */
export function describeDate(raw: string): string {
    const { month, day, year } = parts(raw);
    let out = MONTHS[month] || '';
    if (day > 0 && raw.length >= 4) out += ' ' + day;
    if (year !== null) out += ', ' + year;
    return out;
}

export interface DateBounds {
    /** Earliest allowed date; defaults to 1900-01-01. */
    min?: () => Date;
    /** Latest allowed date; defaults to today. */
    max?: () => Date;
    messages: {
        yearTooLate: (maxYear: number) => string;
        yearTooEarly: (minYear: number) => string;
        /** Checked on a complete date; omit to check the year only. */
        beforeMin?: (min: Date) => string;
        afterMax?: (max: Date) => string;
    };
}

const now = (message: string): Issue => ({ message, timing: 'immediate' });

/**
 * Checks month, day and year as they are typed. A year prefix that can only
 * complete out of range ("21" → 21xx) is flagged before the year is done.
 */
export function dateRule(bounds: DateBounds): Rule {
    return (raw) => {
        const min = bounds.min?.() ?? new Date(1900, 0, 1);
        const max = bounds.max?.() ?? new Date();
        const minYear = min.getFullYear();
        const maxYear = max.getFullYear();
        const { month, day, yearText, year } = parts(raw);

        if (raw.length >= 2 && (month < 1 || month > 12)) return now('Invalid month');
        if (raw.length >= 4 && day > daysInMonth(month, year)) return now('Invalid day');
        if (year !== null && year > maxYear) return now(bounds.messages.yearTooLate(maxYear));
        if (year !== null && year < minYear) return now(bounds.messages.yearTooEarly(minYear));
        if (yearText.length > 0 && year === null) {
            if (parseInt(yearText.padEnd(4, '0')) > maxYear) {
                return now(bounds.messages.yearTooLate(maxYear));
            }
            if (parseInt(yearText.padEnd(4, '9')) < minYear) {
                return now(bounds.messages.yearTooEarly(minYear));
            }
        }
        if (year !== null && raw.length === 8) {
            const candidate = new Date(year, month - 1, day);
            if (bounds.messages.beforeMin && candidate < min) {
                return now(bounds.messages.beforeMin(min));
            }
            if (bounds.messages.afterMax && candidate > max) {
                return now(bounds.messages.afterMax(max));
            }
        }
        return null;
    };
}

function parseIso(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface DateOptions {
    /** ISO YYYY-MM-DD; defaults to 1900-01-01. */
    minDate?: string;
    /** ISO YYYY-MM-DD; defaults to today. */
    maxDate?: string;
}

/** A general date. The form receives YYYY-MM-DD. */
export function date({ minDate, maxDate }: DateOptions = {}): FieldDefinition<string> {
    return defineField(
        text(),
        hinted({ keyboard: 'numeric', autoComplete: 'off', maxLength: 14 }),
        masked(monthDayYearMask, isoDateCodec),
        validated(
            dateRule({
                min: minDate ? () => parseIso(minDate) : undefined,
                max: maxDate ? () => parseIso(maxDate) : undefined,
                messages: {
                    yearTooLate: (y) => `Year must be ${y} or earlier`,
                    yearTooEarly: (y) => `Year must be ${y} or later`,
                    beforeMin: (min) => `Date must be on or after ${toIso(min)}`,
                    afterMax: (max) => `Date must be on or before ${toIso(max)}`,
                },
            }),
        ),
        described(describeDate),
        labelled('Date', 'MM / DD / YYYY'),
        sized(14),
    );
}

const MAX_AGE_YEARS = 120;

/** A date of birth: not in the future, at most 120 years ago. */
export const birthdate = defineField(
    text(),
    hinted({ keyboard: 'numeric', autoComplete: 'bday', name: 'bday', maxLength: 14 }),
    masked(monthDayYearMask, isoDateCodec),
    validated(
        dateRule({
            min: () => new Date(new Date().getFullYear() - MAX_AGE_YEARS, 0, 1),
            messages: {
                yearTooLate: () => 'Future date',
                yearTooEarly: () => 'Invalid year',
                afterMax: () => 'Future date',
            },
        }),
    ),
    described(describeDate),
    labelled('Date of Birth', 'MM / DD / YYYY'),
    sized(14),
);
