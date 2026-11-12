import type { ReactNode } from 'react';
import { FieldHint, FieldMessage } from '../parts';
import {
    Radio,
    RadioCard,
    RadioCards,
    RadioDescription,
    RadioGroup,
    RadioGroupLabel,
    RadioIcon,
    RadioLabel,
    RadioOptions,
    RadioSegment,
    RadioSegments,
    type RadioGroupProps,
} from './parts';

/**
 * Starter compositions for the two kinds of radio group. They use only the
 * public parts and carry no styling: the nearest skin's slots style them.
 *
 * RadioGroupField is for plain answers (Yes / No, M / F / X): a radio and a
 * short label each. RadioCardsField is for options that carry detail (plans
 * with feature lists, delivery methods with terms): each option is a card
 * with a title and any markup beneath it.
 */
export interface RadioChoice<T extends string = string> {
    value: T;
    /** The option's name. Short; it is what a screen reader announces. */
    label: ReactNode;
    /** Detail under the label. Plain fields: a short hint. Cards: any markup. */
    description?: ReactNode;
    disabled?: boolean;
}

export interface RadioTemplateProps<T extends string> extends Omit<RadioGroupProps<T>, 'children'> {
    label?: ReactNode;
    options: readonly RadioChoice<T>[];
    /** Extra content at the end of the field. */
    children?: ReactNode;
}

/** Plain options: a radio and a label each, no box around them. */
export function RadioGroupField<T extends string>({ label, options, children, ...group }: RadioTemplateProps<T>) {
    return (
        <RadioGroup<T> {...group}>
            {label && <RadioGroupLabel>{label}</RadioGroupLabel>}
            <FieldHint />
            <RadioOptions>
                {options.map((option) => (
                    <Radio key={option.value} value={option.value} disabled={option.disabled}>
                        <RadioLabel>{option.label}</RadioLabel>
                        {option.description && <RadioDescription>{option.description}</RadioDescription>}
                    </Radio>
                ))}
            </RadioOptions>
            <FieldMessage />
            {children}
        </RadioGroup>
    );
}

export interface RadioCardsFieldProps<T extends string> extends RadioTemplateProps<T> {
    /** Render each card's content your way (below the radio). Use
     *  RadioLabel for its name and RadioDescription for the rest. */
    renderOption?: (option: RadioChoice<T>, state: { checked: boolean }) => ReactNode;
}

/** Options with detail: each one a card with a title and rich content. */
export function RadioCardsField<T extends string>({ label, options, renderOption, children, ...group }: RadioCardsFieldProps<T>) {
    return (
        <RadioGroup<T> {...group}>
            {label && <RadioGroupLabel>{label}</RadioGroupLabel>}
            <FieldHint />
            <RadioCards>
                {options.map((option) => (
                    <RadioCard key={option.value} value={option.value} disabled={option.disabled}>
                        {renderOption ? (
                            renderOption(option, { checked: group.value === option.value })
                        ) : (
                            <>
                                <RadioLabel>{option.label}</RadioLabel>
                                {option.description && <RadioDescription>{option.description}</RadioDescription>}
                            </>
                        )}
                    </RadioCard>
                ))}
            </RadioCards>
            <FieldMessage />
            {children}
        </RadioGroup>
    );
}

export interface SegmentedOption<T extends string = string> extends Omit<RadioChoice<T>, 'description'> {
    /** Shown before the label, hidden from screen readers (the label names
     *  the option). Any node: an SVG component, an <img>, an emoji. */
    icon?: ReactNode;
}

export interface SegmentedChoiceProps<T extends string> extends Omit<RadioTemplateProps<T>, 'options'> {
    options: readonly SegmentedOption<T>[];
}

/**
 * A few short, mutually exclusive answers shown as one row of segments
 * (status, view mode, a type picker). The same radio group as
 * RadioGroupField: native radios, arrow keys, labelling, the field frame and
 * messages. Only the layout and the slots differ, so a skin decides the row
 * (wrap it, make it a grid on phones). For more than about five options or
 * long labels, use RadioGroupField.
 */
export function SegmentedChoice<T extends string>({ label, options, children, ...group }: SegmentedChoiceProps<T>) {
    return (
        <RadioGroup<T> {...group}>
            {label && <RadioGroupLabel>{label}</RadioGroupLabel>}
            <FieldHint />
            <RadioSegments>
                {options.map((option) => (
                    <RadioSegment key={option.value} value={option.value} disabled={option.disabled}>
                        <RadioLabel>
                            {option.icon && <RadioIcon>{option.icon}</RadioIcon>}
                            {option.label}
                        </RadioLabel>
                    </RadioSegment>
                ))}
            </RadioSegments>
            <FieldMessage />
            {children}
        </RadioGroup>
    );
}
