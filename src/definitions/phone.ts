import {
    defineField,
    hinted,
    labelled,
    masked,
    sized,
    text,
    validated,
} from '../core/define';
import type { Mask, Rule } from '../core/types';

const LENGTH = 10;

/** North American numbers: (204) 555 - 1234. A leading country code 1 is
 *  dropped so autofilled +1 numbers fit. */
export const nanpMask: Mask = {
    accept(text) {
        let digits = text.replace(/\D/g, '');
        if (digits.length === LENGTH + 1 && digits.startsWith('1')) {
            digits = digits.slice(1);
        }
        return digits.slice(0, LENGTH);
    },
    format(raw) {
        if (raw.length === 0) return '';
        if (raw.length <= 3) return `(${raw}`;
        if (raw.length <= 6) return `(${raw.slice(0, 3)}) ${raw.slice(3)}`;
        return `(${raw.slice(0, 3)}) ${raw.slice(3, 6)} - ${raw.slice(6)}`;
    },
    complete: (raw) => raw.length === LENGTH,
    incomplete: (raw) => `${raw.length} of ${LENGTH} digits`,
};

/** NANP: area code and exchange cannot start with 0 or 1. */
export const nanpAreaCode: Rule = (raw) =>
    /^[01]/.test(raw)
        ? { message: 'Area code must start with 2–9', timing: 'immediate' }
        : null;

export const nanpExchange: Rule = (raw) =>
    raw.length >= 4 && /[01]/.test(raw.charAt(3))
        ? { message: 'Exchange must start with 2–9', timing: 'immediate' }
        : null;

export const phone = defineField(
    text(),
    hinted({ type: 'tel', keyboard: 'numeric', autoComplete: 'tel', name: 'tel', maxLength: 16 }),
    masked(nanpMask),
    validated(nanpAreaCode, nanpExchange),
    labelled('Phone Number', '(555) 123 - 4567'),
    sized(16),
);
