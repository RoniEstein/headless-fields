import { createContext, useContext, type ReactNode } from 'react';
import { useFieldContext } from '../context';
import { renderPart, visuallyHidden, type ElementProps, type RenderProp } from '../files/props';
import { FieldRoot } from '../parts';
import type { FieldClassNames, FieldSlot } from '../skin';
import { useRadioGroup, type RadioGroup as RadioGroupState, type RadioGroupOptions, type RadioOptionRef } from './useRadioGroup';

type AnyRadioGroup = RadioGroupState<string>;

const RadioGroupContext = createContext<AnyRadioGroup | null>(null);

/** Plain options, cards and segments style through different slots. */
type ItemKind = 'radio' | 'card' | 'segment';

interface ItemContextValue {
    option: RadioOptionRef<string>;
    kind: ItemKind;
}

const SLOTS: Record<ItemKind, { item: FieldSlot; input: FieldSlot; label: FieldSlot; description: FieldSlot }> = {
    radio: { item: 'radio', input: 'radioInput', label: 'radioLabel', description: 'radioDescription' },
    card: { item: 'radioCard', input: 'radioCardInput', label: 'radioCardLabel', description: 'radioCardDescription' },
    segment: { item: 'segment', input: 'segmentInput', label: 'segmentLabel', description: 'radioDescription' },
};

const RadioItemContext = createContext<ItemContextValue | null>(null);

/** The radio group from the nearest <RadioGroup>, for custom parts. */
export function useRadioGroupContext(part = 'useRadioGroupContext'): AnyRadioGroup {
    const group = useContext(RadioGroupContext);
    if (!group) throw new Error(`<${part}> must be rendered inside <RadioGroup>.`);
    return group;
}

function useItem(part: string): ItemContextValue {
    const item = useContext(RadioItemContext);
    if (!item) throw new Error(`<${part}> must be rendered inside <Radio>, <RadioCard> or <RadioSegment>.`);
    return item;
}

/** State a part's render function receives. */
export interface RadioPartState {
    checked: boolean;
    disabled: boolean;
}

interface PartProps {
    className?: string;
    render?: RenderProp<RadioPartState>;
    children?: ReactNode;
}

export interface RadioGroupProps<T extends string> extends RadioGroupOptions<T> {
    classNames?: FieldClassNames;
    className?: string;
    children: ReactNode;
}

/**
 * Root of a composed radio group. Runs useRadioGroup and shares it with the
 * radio parts, inside the shared field frame, so FieldMessage, FieldIndicator
 * and the nearest skin work as they do for other fields.
 */
export function RadioGroup<T extends string>({ classNames, className, children, ...options }: RadioGroupProps<T>) {
    const group = useRadioGroup<T>(options);
    return (
        <RadioGroupContext.Provider value={group as unknown as AnyRadioGroup}>
            <FieldRoot
                field={group.view}
                inputId={group.ids.group}
                disabled={group.disabled}
                classNames={classNames}
                className={className}
            >
                {children}
            </FieldRoot>
        </RadioGroupContext.Provider>
    );
}

/** The group's label. Not a <label>: it names the group, not one input. */
export function RadioGroupLabel({ children, className, requiredMark = '*' }: { children: ReactNode; className?: string; requiredMark?: ReactNode }) {
    const group = useRadioGroupContext('RadioGroupLabel');
    const { slotProps } = useFieldContext('RadioGroupLabel');
    return (
        <span {...group.getLabelProps()} {...slotProps('label', className)}>
            {children}
            {group.view.required && (
                <span {...group.data} aria-hidden {...slotProps('requiredMark')}>
                    {requiredMark}
                </span>
            )}
        </span>
    );
}

function Options(slot: FieldSlot, part: string) {
    return function OptionsPart({ children, className, render }: PartProps) {
        const group = useRadioGroupContext(part);
        const { slotProps } = useFieldContext(part);
        const props = group.getGroupProps({ ...slotProps(slot, className), children });
        return renderPart('div', props, render, { checked: group.value !== '', disabled: group.disabled });
    };
}

/** The role="radiogroup" element around plain options. */
export const RadioOptions = Options('radioOptions', 'RadioOptions');

/** The role="radiogroup" element around cards. */
export const RadioCards = Options('radioCards', 'RadioCards');

/** The role="radiogroup" element around segments: one row of choices. */
export const RadioSegments = Options('segments', 'RadioSegments');

export interface RadioItemProps<T extends string = string> extends PartProps {
    value: T;
    disabled?: boolean;
}

function Item(kind: ItemKind) {
    const part = kind === 'card' ? 'RadioCard' : kind === 'segment' ? 'RadioSegment' : 'Radio';
    return function ItemPart({ value, disabled, children, className, render }: RadioItemProps) {
        const group = useRadioGroupContext(part);
        const { slotProps } = useFieldContext(part);
        const option = { value, disabled };
        const slots = SLOTS[kind];
        const getter = kind === 'radio' ? group.getItemProps : group.getCardProps;
        // A segment shows no radio dot: the whole segment is the control, and
        // the native radio stays focusable for the keyboard and the form.
        const inputProps = kind === 'segment' ? { ...slotProps(slots.input), style: visuallyHidden } : slotProps(slots.input);
        const props = getter(option, {
            ...slotProps(slots.item, className),
            children: (
                <>
                    <input {...group.getInputProps(option, inputProps)} />
                    {children}
                </>
            ),
        });
        const state = { checked: group.value === value, disabled: !!(group.disabled || disabled) };
        return <RadioItemContext.Provider value={{ option, kind }}>{renderPart('div', props, render, state)}</RadioItemContext.Provider>;
    };
}

/**
 * One plain option: the native radio, then your RadioLabel (and an optional
 * short RadioDescription). Only the radio and its label choose it.
 */
export const Radio = Item('radio');

/**
 * One option as a card: the native radio, a RadioLabel as its title and a
 * RadioDescription holding any markup (lists, prices, badges). A click
 * anywhere on the card chooses it; links and buttons inside keep their own.
 */
export const RadioCard = Item('card');

/**
 * One option in a segmented row: the native radio (visually hidden, still
 * focusable), then a RadioLabel holding an optional RadioIcon and the text.
 * A click anywhere on the segment chooses it.
 */
export const RadioSegment = Item('segment');

/** A decorative icon inside an option's label (aria-hidden). */
export function RadioIcon({ children, className, render }: PartProps) {
    const group = useRadioGroupContext('RadioIcon');
    const { option } = useItem('RadioIcon');
    const { slotProps } = useFieldContext('RadioIcon');
    const props: ElementProps = { ...group.data, 'aria-hidden': true, ...slotProps('segmentIcon', className), children };
    return renderPart('span', props, render, partState(group, option));
}

/** The option's accessible name: a <label> for its radio. Keep it short;
 *  put details in RadioDescription. */
export function RadioLabel({ children, className, render }: PartProps) {
    const group = useRadioGroupContext('RadioLabel');
    const { option, kind } = useItem('RadioLabel');
    const { slotProps } = useFieldContext('RadioLabel');
    const props = group.getOptionLabelProps(option, {
        ...slotProps(SLOTS[kind].label, className),
        children,
    });
    return renderPart('label', props, render, partState(group, option));
}

/** Details about the option, read after its name. A <div>, so it can hold
 *  any markup. */
export function RadioDescription({ children, className, render }: PartProps) {
    const group = useRadioGroupContext('RadioDescription');
    const { option, kind } = useItem('RadioDescription');
    const { slotProps } = useFieldContext('RadioDescription');
    const props: ElementProps = group.getDescriptionProps(option, {
        ...slotProps(SLOTS[kind].description, className),
        children,
    });
    return renderPart('div', props, render, partState(group, option));
}

function partState(group: AnyRadioGroup, option: RadioOptionRef<string>): RadioPartState {
    return { checked: group.value === option.value, disabled: !!(group.disabled || option.disabled) };
}
