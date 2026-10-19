import { useCallback, useId, useRef, useState } from 'react';
import { useChoice, type Choice, type ChoiceOptions } from '../../react/useChoice';
import type { FieldDataAttributes } from '../context';
import { mergeProps, type ElementProps } from '../files/props';

const flag = (on: boolean | undefined) => (on ? '' : undefined);

/** One option, as the getters need it. */
export interface RadioOptionRef<T extends string = string> {
    value: T;
    disabled?: boolean;
}

export interface RadioGroupOptions<T extends string> extends ChoiceOptions<T> {
    /** Base id; the group, label, message and option ids derive from it. */
    id?: string;
    /** The radios' form name; generated when omitted. */
    name?: string;
}

export interface RadioGroupIds {
    group: string;
    label: string;
    message: string;
}

export interface RadioGroup<T extends string> extends Choice<T> {
    ids: RadioGroupIds;
    name: string;
    /** State attributes for every element of the field. */
    data: FieldDataAttributes;
    /** Ids for one option's input, label and description. */
    optionIds: (value: T) => { input: string; label: string; description: string };
    /** The element with role="radiogroup", labelled by the group label. */
    getGroupProps: (props?: ElementProps) => ElementProps;
    /** The group's label (not a <label>: a group has no single control). */
    getLabelProps: (props?: ElementProps) => ElementProps;
    /** The wrapper around one option: data-checked, data-disabled. */
    getItemProps: (option: RadioOptionRef<T>, props?: ElementProps) => ElementProps;
    /** Like getItemProps, and a click anywhere on it chooses the option. */
    getCardProps: (option: RadioOptionRef<T>, props?: ElementProps) => ElementProps;
    /** The native <input type="radio">. */
    getInputProps: (option: RadioOptionRef<T>, props?: ElementProps) => ElementProps;
    /** A <label> for the option's input: its accessible name. */
    getOptionLabelProps: (option: RadioOptionRef<T>, props?: ElementProps) => ElementProps;
    /** Extra text or markup about the option, read after its name. */
    getDescriptionProps: (option: RadioOptionRef<T>, props?: ElementProps) => ElementProps;
    getMessageProps: (props?: ElementProps) => ElementProps;
}

// Clicks on these already do something; a card leaves them alone.
const INTERACTIVE = 'a, button, input, label, select, textarea, summary, [role=button], [contenteditable]';

/** Keeps an id usable in id/for attributes whatever the option value is. */
function idPart(value: string) {
    return value.replace(/[^\w-]/g, (c) => `_${c.charCodeAt(0).toString(36)}`);
}

/**
 * A single-choice field built on native radios, for any markup. The browser
 * supplies the keyboard (Tab into the group, arrows between options), form
 * submission and `required`; this adds labelling, descriptions, feedback and
 * state attributes. Use the getters on your own elements, or the parts.
 */
export function useRadioGroup<T extends string>(options: RadioGroupOptions<T>): RadioGroup<T> {
    const choice = useChoice(options);
    const generated = useId();
    const base = options.id ?? `radio-${generated}`;
    const name = options.name ?? base;
    const ids: RadioGroupIds = { group: base, label: `${base}-label`, message: `${base}-message` };
    const { view, disabled } = choice;

    // Descriptions register when they mount, so an input only points at a
    // description that exists.
    const [described, setDescribed] = useState<ReadonlySet<string>>(() => new Set());
    const registrars = useRef(new Map<string, (node: Element | null) => void>());
    const register = useCallback((id: string) => {
        let ref = registrars.current.get(id);
        if (!ref) {
            ref = (node) => {
                setDescribed((current) => {
                    if (!!node === current.has(id)) return current;
                    const next = new Set(current);
                    if (node) next.add(id);
                    else next.delete(id);
                    return next;
                });
            };
            registrars.current.set(id, ref);
        }
        return ref;
    }, []);

    const data: FieldDataAttributes = {
        'data-state': view.status,
        'data-tone': view.tone ?? undefined,
        'data-touched': flag(view.touched),
        'data-disabled': flag(disabled),
        'data-required': flag(view.required),
        'data-indicator': view.indicator ?? undefined,
    };

    const optionIds = (value: T) => {
        const input = `${base}-${idPart(value)}`;
        return { input, label: `${input}-label`, description: `${input}-description` };
    };

    const itemData = (option: RadioOptionRef<T>) => ({
        ...data,
        'data-checked': flag(choice.value === option.value),
        'data-disabled': flag(disabled || option.disabled),
    });

    return {
        ...choice,
        ids,
        name,
        data,
        optionIds,
        getGroupProps: (props) =>
            mergeProps(
                {
                    ...data,
                    id: ids.group,
                    role: 'radiogroup',
                    'aria-labelledby': ids.label,
                    'aria-describedby': view.message ? ids.message : undefined,
                    'aria-required': view.required || undefined,
                    'aria-invalid': view.status === 'invalid' || undefined,
                    'aria-disabled': disabled || undefined,
                    // Leaving the whole group (not moving between options) counts as a visit.
                    onBlur: (event: FocusEvent) => {
                        const target = event.currentTarget as Element | null;
                        const next = event.relatedTarget as Node | null;
                        if (!target || !next || !target.contains(next)) choice.touch();
                    },
                },
                props,
            ),
        getLabelProps: (props) => mergeProps({ ...data, id: ids.label }, props),
        getItemProps: (option, props) => mergeProps(itemData(option), props),
        getCardProps: (option, props) =>
            mergeProps(
                {
                    ...itemData(option),
                    onClick: (event: MouseEvent) => {
                        const target = event.target as Element | null;
                        if (option.disabled || target?.closest(INTERACTIVE)) return;
                        choice.select(option.value);
                        document.getElementById(optionIds(option.value).input)?.focus();
                    },
                },
                props,
            ),
        getInputProps: (option, props) => {
            const own = optionIds(option.value);
            return mergeProps(
                {
                    ...itemData(option),
                    id: own.input,
                    type: 'radio',
                    name,
                    value: option.value,
                    checked: choice.value === option.value,
                    disabled: disabled || option.disabled,
                    required: view.required,
                    'aria-describedby': described.has(own.description) ? own.description : undefined,
                    onChange: () => choice.select(option.value),
                },
                props,
            );
        },
        getOptionLabelProps: (option, props) => {
            const own = optionIds(option.value);
            return mergeProps({ ...itemData(option), id: own.label, htmlFor: own.input }, props);
        },
        getDescriptionProps: (option, props) => {
            const own = optionIds(option.value);
            return mergeProps({ ...itemData(option), id: own.description, ref: register(own.description) }, props);
        },
        getMessageProps: (props) => mergeProps({ ...data, id: ids.message }, props),
    };
}
