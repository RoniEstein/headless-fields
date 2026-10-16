import { defineField, described, hinted, labelled, masked, sized, text, validated } from '../core/define';
import type { Codec, FieldDefinition, Issue, Mask, Rule } from '../core/types';

const MONTHS = [
    '', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
];

/** MM / DD / YYYY, typed as 8 digits. Accepts autofilled ISO and US dates. */
export const monthDayYearMask: Mask = {
    accept(text) {
        const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (iso) return iso[2].padStart(2, '0') + iso[3].padStart(2, '0') + iso[1];
        const us = text.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
        if (us) return us[1].padStart(2, '0') + us[2].padStart(2, '0') + us[3];
        return text.replace(/\D/g, '').slice(0, 8);
    },
    format(raw) {
        let out = raw.slice(0, 2);
        if (raw.length > 2) out += ' / ' + raw.slice(2, 4);
        if (raw.length > 4) out += ' / ' + raw.slice(4, 8);
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
