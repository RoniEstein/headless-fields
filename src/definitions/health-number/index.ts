import { defineField, hinted, labelled, masked, sized, text } from '../../core/define';
import type { FieldDefinition } from '../../core/types';
import { HEALTH_CARD_FORMATS, type Province } from './provinces';

export { HEALTH_CARD_FORMATS } from './provinces';
export type { HealthCardFormat, Province } from './provinces';

const cache = new Map<Province, FieldDefinition<string>>();

/**
 * The health-number field for a province. Definitions are cached so the
 * same province always yields the same object (a stable identity lets the
 * React hook tell a province switch from a re-render).
 */
export function healthNumber(province: Province): FieldDefinition<string> {
    const cached = cache.get(province);
    if (cached) return cached;

    const card = HEALTH_CARD_FORMATS[province];
    const definition = defineField(
        text(),
        hinted({
            keyboard: card.letters ? 'text' : 'numeric',
            autoCapitalize: card.letters ? 'characters' : 'none',
            autoComplete: 'off',
        }),
        masked({
            accept: card.accept,
            format: card.format,
            complete: card.valid,
            incomplete: () => card.guidance,
        }),
        labelled(card.label, card.placeholder),
        sized(card.placeholder.length),
    );
    cache.set(province, definition);
    return definition;
}
