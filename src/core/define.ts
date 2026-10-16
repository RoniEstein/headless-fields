import type {
    Codec,
    Emit,
    FieldDefinition,
    InputHints,
    Mask,
    Rule,
} from './types';

/**
 * Field definitions are built in layers. A base (`text`, `numeric`) sets the
 * value type; each layer adds one concern and returns a new definition:
 *
 *   const phone = defineField(
 *       text({ type: 'tel', keyboard: 'numeric', autoComplete: 'tel' }),
 *       masked(phoneMask),
 *       validated(areaCode, exchange),
 *       sized(16),
 *   );
 */
export type Layer<V> = (definition: FieldDefinition<V>) => FieldDefinition<V>;

export function defineField<V>(
    base: FieldDefinition<V>,
    ...layers: Layer<V>[]
): FieldDefinition<V> {
    return layers.reduce((definition, layer) => layer(definition), base);
}

export const identityMask: Mask = {
    accept: (text) => text,
    format: (raw) => raw,
    complete: () => true,
};

const stringCodec: Codec<string> = {
    toValue: (raw) => raw,
    fromValue: (value) => value ?? '',
    empty: '',
};

/** Base: a string field with no masking and nothing to check. */
export function text(input: InputHints = {}): FieldDefinition<string> {
    return {
        mask: identityMask,
        codec: stringCodec,
        rules: [],
        emit: 'always',
        input: { type: 'text', ...input },
        indicateValid: false,
    };
}

/**
 * Masking layer. By default the form receives the formatted display text
 * (the masked value), which is what the existing forms post. Pass a codec
 * when the form wants something else (an ISO date).
 */
export function masked(mask: Mask, codec?: Codec<string>): Layer<string> {
    return (definition) => ({
        ...definition,
        mask,
        codec: codec ?? {
            toValue: (raw) => mask.format(raw),
            fromValue: (value) => mask.accept(value ?? ''),
            empty: '',
        },
        emit: 'when-valid',
        indicateValid: true,
    });
}

/** Validation layer: appends rules, checked in order. */
export function validated<V>(...rules: Rule[]): Layer<V> {
    return (definition) => ({
        ...definition,
        rules: [...definition.rules, ...rules],
        indicateValid: true,
    });
}

/** Typing-surface layer: the expected answer is `chars` characters wide. */
export function sized<V>(chars: number): Layer<V> {
    return (definition) => ({ ...definition, surface: chars });
}

export function hinted<V>(input: InputHints): Layer<V> {
    return (definition) => ({
        ...definition,
        input: { ...definition.input, ...input },
    });
}

export function labelled<V>(label: string, placeholder?: string): Layer<V> {
    return (definition) => ({
        ...definition,
        label,
        placeholder: placeholder ?? definition.placeholder,
    });
}

export function requiredMessage<V>(message: string): Layer<V> {
    return (definition) => ({ ...definition, requiredMessage: message });
}

export function described<V>(describe: (raw: string) => string): Layer<V> {
    return (definition) => ({ ...definition, describe });
}

export function emitting<V>(emit: Emit): Layer<V> {
    return (definition) => ({ ...definition, emit });
}
