import { defineField, described, hinted, labelled, masked, sized, text, validated } from '../core/define';
import type { Codec, FieldDefinition, Mask, Rule } from '../core/types';

/**
 * HH:MM on a 24-hour clock, typed as 4 digits. A first digit of 3–9 is an
 * hour on its own ("9" → "09"), as is any digit followed by a colon ("1:"
 * → "01"), and digits that cannot belong at their
 * position are dropped. A trailing a/p converts a 12-hour answer, so "930p",
 * "9 pm" and an autofilled "9:30 PM" all become 21:30.
 */
export const twentyFourHourMask: Mask = {
    accept(text) {
        const twelve = text.match(/^\s*(\d{1,2})(?::?(\d{2}))?(?::\d{2})?\s*([ap])/i);
        if (twelve) {
            const hour = parseInt(twelve[1]);
            if (hour >= 1 && hour <= 12) {
                const pm = twelve[3].toLowerCase() === 'p';
                const converted = (hour % 12) + (pm ? 12 : 0);
                return String(converted).padStart(2, '0') + (twelve[2] ?? '00');
            }
        }
        const hourOnly = text.match(/^\s*(\d)\s*[:.h]\s*$/i);
        if (hourOnly) return '0' + hourOnly[1];
        let raw = '';
        for (const digit of text.replace(/\D/g, '')) {
            if (raw.length === 0) raw = digit <= '2' ? digit : '0' + digit;
            else if (raw.length === 1) raw += raw === '2' && digit > '3' ? '' : digit;
            else if (raw.length === 2) raw += digit <= '5' ? digit : '';
            else if (raw.length === 3) raw += digit;
            if (raw.length === 4) break;
        }
        return raw;
    },
    format: (raw) => (raw.length <= 2 ? raw : `${raw.slice(0, 2)}:${raw.slice(2)}`),
    complete: (raw) => raw.length === 4,
    incomplete: () => 'Format: HH:MM',
};

/** The form receives HH:MM. A partial answer maps to its raw digits so it
 *  never compares equal to a real time or to the empty value. */
export const hourMinuteCodec: Codec<string> = {
    toValue: (raw) => (raw.length === 4 ? `${raw.slice(0, 2)}:${raw.slice(2)}` : raw),
    fromValue: (value) => twentyFourHourMask.accept(value ?? ''),
    empty: '',
};

const minutesOf = (hhmm: string) => parseInt(hhmm.slice(0, 2)) * 60 + parseInt(hhmm.slice(2, 4));

/** "9:30 a.m.", "12:00 p.m.", "12:15 a.m."; empty until hours and minutes are typed. */
export function describeTime(raw: string): string {
    if (raw.length !== 4) return '';
    const hour = parseInt(raw.slice(0, 2));
    const twelve = hour % 12 === 0 ? 12 : hour % 12;
    return `${twelve}:${raw.slice(2)} ${hour < 12 ? 'a.m.' : 'p.m.'}`;
}

export interface TimeOptions {
    /** Earliest allowed time, HH:MM. */
    minTime?: string;
    /** Latest allowed time, HH:MM. */
    maxTime?: string;
    /** Minutes must be a multiple of this (5 for five-minute steps). */
    stepMinutes?: number;
}

/** Checks a complete time against the options. Position rules already keep
 *  the hour at 00–23 and the minutes at 00–59. */
export function timeRule({ minTime, maxTime, stepMinutes }: TimeOptions): Rule {
    const min = minTime ? twentyFourHourMask.accept(minTime) : null;
    const max = maxTime ? twentyFourHourMask.accept(maxTime) : null;
    return (raw) => {
        if (raw.length !== 4) return null;
        const minutes = minutesOf(raw);
        if (min && minutes < minutesOf(min)) {
            return { message: `Must be ${describeTime(min)} or later`, timing: 'immediate' };
        }
        if (max && minutes > minutesOf(max)) {
            return { message: `Must be ${describeTime(max)} or earlier`, timing: 'immediate' };
        }
        if (stepMinutes && stepMinutes > 1 && minutes % stepMinutes !== 0) {
            return { message: `Use ${stepMinutes}-minute steps`, timing: 'immediate' };
        }
        return null;
    };
}

/** A time of day. The form receives HH:MM (24-hour); the hint reads it back
 *  on a 12-hour clock so "21:30" is confirmed as "9:30 p.m.". */
export function time(options: TimeOptions = {}): FieldDefinition<string> {
    return defineField(
        text(),
        hinted({ keyboard: 'text', autoComplete: 'off', maxLength: 8 }),
        masked(twentyFourHourMask, hourMinuteCodec),
        validated(timeRule(options)),
        described(describeTime),
        labelled('Time', 'HH:MM'),
        sized(6),
    );
}
