import {
    useId,
    type ComponentPropsWithoutRef,
    type CSSProperties,
    type ReactNode,
} from 'react';
import type { FieldController } from '../react/useField';
import type { FieldView } from '../react/view';
import { FieldContext, useFieldContext, type FieldDataAttributes } from './context';
import { joinClasses, useFieldSkin, type FieldClassNames, type FieldSlot } from './skin';

/**
 * Unstyled parts. They render bare elements, wire ids and ARIA, and stamp
 * every element with the field's state as data attributes:
 *
 *   data-state="idle|valid|invalid"  data-tone="error|hint"
 *   data-focused  data-touched  data-disabled  data-required
 *   data-sized (the answer has a known width)  data-has-start  data-has-end
 *   data-reserve-indicator  data-indicator="valid|invalid"
 *
 * The root also sets --field-chars, the typing surface in characters. The
 * skin turns that into a width, adding its own chrome (padding, icons).
 */

const flag = (on: boolean | undefined) => (on ? '' : undefined);

function isController(field: FieldView): field is FieldController<unknown> {
    return 'setText' in field;
}

export interface FieldRootProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
    field: FieldView;
    disabled?: boolean;
    /** Id for the input; generated when omitted. */
    inputId?: string;
    hasStart?: boolean;
    hasEnd?: boolean;
    classNames?: FieldClassNames;
    children: ReactNode;
}

export function FieldRoot({
    field,
    disabled = false,
    inputId,
    hasStart,
    hasEnd,
    classNames,
    className,
    style,
    children,
    ...rest
}: FieldRootProps) {
    const skin = useFieldSkin();
    const generated = useId();
    const base = inputId ?? `field-${generated}`;
    const merge = skin.merge ?? joinClasses;

    const data: FieldDataAttributes = {
        'data-state': field.status,
        'data-tone': field.tone ?? undefined,
        'data-focused': flag(field.focused),
        'data-touched': flag(field.touched),
        'data-disabled': flag(disabled),
        'data-required': flag(field.required),
        'data-sized': flag(field.chars !== undefined),
        'data-has-start': flag(hasStart),
        'data-has-end': flag(hasEnd),
        'data-reserve-indicator': flag(field.reservesIndicator),
        'data-indicator': field.indicator ?? undefined,
    };

    const context = {
        view: field,
        controller: isController(field) ? field : undefined,
        ids: { input: base, label: `${base}-label`, message: `${base}-message` },
        disabled,
        data,
        skin,
        classFor: (slot: FieldSlot, own?: string) =>
            merge(skin.classNames?.[slot], classNames?.[slot], own),
    };

    const surface =
        field.chars === undefined
            ? style
            : ({ ...style, '--field-chars': field.chars } as CSSProperties);

    return (
        <FieldContext.Provider value={context}>
            <div
                {...rest}
                {...data}
                data-field=""
                style={surface}
                className={context.classFor('root', className) || undefined}
            >
                {children}
            </div>
        </FieldContext.Provider>
    );
}

export interface FieldLabelProps extends ComponentPropsWithoutRef<'label'> {
    /** Text for the required marker; defaults to an asterisk. */
    requiredMark?: ReactNode;
}

export function FieldLabel({ children, className, requiredMark = '*', ...rest }: FieldLabelProps) {
    const { view, controller, ids, data, classFor } = useFieldContext('FieldLabel');
    const text = children ?? controller?.definition.label;
    if (!text) return null;
    return (
        <label
            id={ids.label}
            htmlFor={ids.input}
            {...rest}
            {...data}
            className={classFor('label', className) || undefined}
        >
            {text}
            {view.required && (
                <span {...data} aria-hidden className={classFor('requiredMark') || undefined}>
                    {requiredMark}
                </span>
            )}
        </label>
    );
}

/** The box around the input, adornments and indicator. Sizing applies here. */
export function FieldControl({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
    const { data, classFor } = useFieldContext('FieldControl');
    return <div {...rest} {...data} className={classFor('control', className) || undefined} />;
}

export interface FieldAdornmentProps extends ComponentPropsWithoutRef<'div'> {
    side: 'start' | 'end';
}

export function FieldAdornment({ side, className, ...rest }: FieldAdornmentProps) {
    const { data, classFor } = useFieldContext('FieldAdornment');
    return (
        <div
            {...rest}
            {...data}
            data-side={side}
            className={classFor('adornment', className) || undefined}
        />
    );
}

const FALLBACK_ICONS = { valid: '✓', invalid: '✕' };

export function FieldIndicator({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
    const { view, skin, data, classFor } = useFieldContext('FieldIndicator');
    if (!view.indicator) return null;
    const icon = skin.icons?.[view.indicator] ?? FALLBACK_ICONS[view.indicator];
    return (
        <div {...rest} {...data} aria-hidden className={classFor('indicator', className) || undefined}>
            {icon}
        </div>
    );
}

export function FieldMessage({ className, ...rest }: ComponentPropsWithoutRef<'p'>) {
    const { view, ids, data, classFor } = useFieldContext('FieldMessage');
    if (!view.message) return null;
    return (
        <p
            id={ids.message}
            {...rest}
            {...data}
            className={classFor('message', className) || undefined}
        >
            {view.message}
        </p>
    );
}
