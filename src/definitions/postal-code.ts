import { defineField, hinted, labelled, masked, sized, text } from '../core/define';
import { positional } from '../core/masks';
import type { Mask } from '../core/types';

// Canada Post: the first letter excludes D F I O Q U W Z; the other letters
// exclude D F I O Q U.
const FIRST_LETTER = /^[ABCEGHJKLMNPRSTVXY]$/;
const LETTER = /^[ABCEGHJKLMNPRSTVWXYZ]$/;
const DIGIT = /^\d$/;

export const canadianPostalMask: Mask = {
    accept: (text) =>
        positional(text, [FIRST_LETTER, DIGIT, LETTER, DIGIT, LETTER, DIGIT]),
    format: (raw) => (raw.length <= 3 ? raw : `${raw.slice(0, 3)} ${raw.slice(3)}`),
    complete: (raw) => raw.length === 6,
    incomplete: () => 'Format: A1A 1A1',
};

export const postalCode = defineField(
    text(),
    hinted({
        keyboard: 'text',
        autoCapitalize: 'characters',
        autoComplete: 'postal-code',
        maxLength: 7,
    }),
    masked(canadianPostalMask),
    labelled('Postal Code', 'A1A 1A1'),
    sized(7),
);
