import { digitsOnly, group, positional, slots } from '../../core/masks';

/**
 * Province and territory health-card formats. Format checks only: real
 * identity verification happens elsewhere (pharmacy systems, Pharmacare).
 * Raw is canonical (no separators) and position-strict, so the display
 * format can rely on which positions hold letters and which hold digits.
 */
export type Province =
    | 'MB' | 'AB' | 'BC' | 'SK' | 'ON' | 'QC' | 'NB'
    | 'NS' | 'NL' | 'PE' | 'YT' | 'NT' | 'NU';

export interface HealthCardFormat {
    label: string;
    placeholder: string;
    /** Shown while the number is partial or does not match. */
    guidance: string;
    letters: boolean;
    accept: (text: string) => string;
    format: (raw: string) => string;
    valid: (raw: string) => boolean;
}

const DIGIT = /^\d$/;
const LETTER = /^[A-Z]$/;

function numeric(
    label: string,
    placeholder: string,
    guidance: string,
    sizes: number[],
    separator = ' ',
    valid?: RegExp,
): HealthCardFormat {
    const length = sizes.reduce((a, b) => a + b, 0);
    const pattern = valid ?? new RegExp(`^\\d{${length}}$`);
    return {
        label,
        placeholder,
        guidance,
        letters: false,
        accept: (text) => digitsOnly(text, length),
        format: (raw) => group(raw, sizes, separator),
        valid: (raw) => pattern.test(raw),
    };
}

const PHN = 'Personal Health Number';
const CARD = 'Health Card Number';

export const HEALTH_CARD_FORMATS: Record<Province, HealthCardFormat> = {
    MB: {
        ...numeric('PHIN', '000 000 000', 'PHIN must be 9 digits', [3, 3, 3]),
        valid: (raw) => /^\d{9}$/.test(raw) && raw !== '000000000',
    },
    AB: numeric(PHN, '00000-0000', 'Alberta PHN is 9 digits', [5, 4], '-'),
    BC: numeric(PHN, '9000 000 000', 'BC PHN is 10 digits, starting with 9', [4, 3, 3], ' ', /^9\d{9}$/),
    SK: numeric('Health Services Number', '000 000 000', 'HSN is 9 digits', [3, 3, 3]),
    ON: {
        label: CARD,
        placeholder: '0000-000-000-AA',
        guidance: 'Ontario card: 10 digits + 2-letter version code',
        letters: true,
        accept: (text) => positional(text, [...slots(DIGIT, 10), ...slots(LETTER, 2)]),
        format(raw) {
            const digits = raw.slice(0, 10);
            const letters = raw.slice(10);
            let out = group(digits, [4, 3, 3], '-');
            if (letters) out += (digits.length === 10 ? '-' : '') + letters;
            return out;
        },
        valid: (raw) => /^\d{10}[A-Z]{2}$/.test(raw),
    },
    QC: {
        label: 'RAMQ Number',
        placeholder: 'AAAA 0000 0000',
        guidance: 'RAMQ: 4 letters + 8 digits',
        letters: true,
        accept: (text) => positional(text, [...slots(LETTER, 4), ...slots(DIGIT, 8)]),
        format(raw) {
            const letters = raw.slice(0, 4);
            const digits = raw.slice(4);
            let out = letters;
            if (digits) out += (letters.length === 4 ? ' ' : '') + group(digits, [4, 4], ' ');
            return out;
        },
        // Birth month is encoded 01-12, or 51-62 for women; day 01-31.
        valid: (raw) =>
            /^[A-Z]{4}\d{2}(0[1-9]|1[012]|5[0-9]|6[012])(0[1-9]|[12]\d|3[01])\d{2}$/.test(raw),
    },
    NB: numeric('Medicare Number', '000 000 000', 'NB Medicare is 9 digits', [3, 3, 3]),
    NS: numeric(CARD, '0000 000 000', 'NS card is 10 digits', [4, 3, 3]),
    NL: numeric('MCP Number', '000 000 000 000', 'MCP is 12 digits', [3, 3, 3, 3]),
    PE: numeric(CARD, '00000000', 'PE card is 8 digits', [8]),
    YT: numeric(CARD, '000 000 000', 'Yukon card is 9 digits', [3, 3, 3]),
    NT: {
        label: CARD,
        placeholder: 'N0000000',
        guidance: 'NWT card: N, D, M, or T + 7 digits',
        letters: true,
        accept: (text) => positional(text, [/^[NDMT]$/, ...slots(DIGIT, 7)]),
        format: (raw) => raw,
        valid: (raw) => /^[NDMT]\d{7}$/.test(raw),
    },
    NU: numeric(CARD, '000 000 000', 'Nunavut card is 9 digits', [3, 3, 3]),
};
