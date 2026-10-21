import { defineField, described, text, validated } from '../core/define';
import type { Layer } from '../core/define';
import type { FieldDefinition } from '../core/types';

// Any text under the limit is a fine answer; a check mark would add nothing.
const noValidMark: Layer<string> = (definition) => ({ ...definition, indicateValid: false });

export interface LongTextOptions {
    /** Most characters allowed. */
    maxLength: number;
}

/**
 * Free text with a character limit (notes, directions, a message). Typing
 * past the limit is allowed and reported, never cut off, so a pasted answer
 * is not silently shortened. The message counts as the user types: "120 of
 * 500 characters", then "20 characters too many". Render it multiline.
 */
export function longText({ maxLength }: LongTextOptions): FieldDefinition<string> {
    return defineField(
        text(),
        validated((raw) => {
            const over = raw.length - maxLength;
            if (over <= 0) return null;
            return { message: `${over} ${over === 1 ? 'character' : 'characters'} too many`, timing: 'immediate' };
        }),
        described((raw) => `${raw.length} of ${maxLength} characters`),
        noValidMark,
    );
}
