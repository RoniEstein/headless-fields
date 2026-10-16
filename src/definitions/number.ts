import type { FieldDefinition, Mask, Rule } from '../core/types';

export interface NumberOptions {
    min?: number;
    max?: number;
    /** Integers only. */
    integer?: boolean;
    allowNegative?: boolean;
}

const UNFINISHED = new Set(['', '-', '.', '-.']);

/**
 * Filters keystrokes to digits (plus one decimal point and a leading minus
 * when allowed) instead of using <input type="number">, which changes value
 * on scroll and parses decimals by locale.
 */
function numberMask({ integer = false, allowNegative = false }: NumberOptions): Mask {
    return {
        accept(text) {
            const negative = allowNegative && text.trimStart().startsWith('-');
            let body = text.replace(/-/g, '');
            if (integer) {
                body = body.replace(/\D/g, '');
            } else {
                body = body.replace(/[^\d.]/g, '');
                const dot = body.indexOf('.');
                if (dot >= 0) {
                    body = body.slice(0, dot + 1) + body.slice(dot + 1).replace(/\./g, '');
                }
            }
            return (negative ? '-' : '') + body;
        },
        format: (raw) => raw,
        complete: (raw) => !UNFINISHED.has(raw),
    };
}

function parse(raw: string): number | null {
    if (UNFINISHED.has(raw)) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function rangeRule({ min, max }: NumberOptions): Rule {
    return (raw) => {
        const n = parse(raw);
        if (n === null) return null;
        if (min !== undefined && n < min) {
            return { message: `Must be at least ${min}`, timing: 'immediate' };
        }
        if (max !== undefined && n > max) {
            return { message: `Must be at most ${max}`, timing: 'immediate' };
        }
        return null;
    };
}

/** Characters needed for the widest allowed answer; undefined if unbounded. */
function surfaceFor({ min, max, integer = false }: NumberOptions): number | undefined {
    if (max === undefined) return undefined;
    const widest = Math.max(
        String(Math.trunc(Math.abs(max))).length,
        min === undefined ? 0 : String(Math.trunc(min)).length,
    );
    return widest + (integer ? 0 : 3);
}

/** Base: a number field. The form receives a number, or null when empty. */
export function number(options: NumberOptions = {}): FieldDefinition<number | null> {
    return {
        mask: numberMask(options),
        codec: {
            toValue: parse,
            fromValue: (value) => (value === null || value === undefined ? '' : String(value)),
            empty: null,
        },
        rules: [rangeRule(options)],
        emit: 'always',
        input: { type: 'text', keyboard: options.integer ? 'numeric' : 'decimal' },
        indicateValid: false,
        surface: surfaceFor(options),
    };
}
