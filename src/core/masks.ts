/** Small building blocks for writing masks. */

/** Keeps digits only, up to `max`. */
export function digitsOnly(text: string, max: number): string {
    return text.replace(/\D/g, '').slice(0, max);
}

/**
 * Groups raw characters into chunks joined by a separator, stopping at the
 * first partial chunk: group('204555', [3, 3, 4], ' ') → '204 555'.
 */
export function group(raw: string, sizes: readonly number[], separator: string): string {
    const out: string[] = [];
    let index = 0;
    for (const size of sizes) {
        const slice = raw.slice(index, index + size);
        if (slice.length === 0) break;
        out.push(slice);
        index += size;
        if (slice.length < size) break;
    }
    return out.join(separator);
}

/**
 * Accepts characters by position: `slots[i]` tests the character allowed at
 * raw position i. Characters that do not fit the next slot are skipped, so
 * raw stays aligned with the display format.
 */
export function positional(text: string, slots: readonly RegExp[], upper = true): string {
    const source = upper ? text.toUpperCase() : text;
    let out = '';
    for (const char of source) {
        if (out.length >= slots.length) break;
        if (slots[out.length].test(char)) out += char;
    }
    return out;
}

/** `count` copies of one slot pattern, for use with `positional`. */
export function slots(pattern: RegExp, count: number): RegExp[] {
    return Array.from({ length: count }, () => pattern);
}
