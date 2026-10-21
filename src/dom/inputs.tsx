import {
    useCallback,
    useEffect,
    useRef,
    type ComponentPropsWithRef,
    type FocusEvent,
    type Ref,
} from 'react';
import type { InputHints } from '../core/types';
import { describedBy, useFieldContext, type FieldContextValue } from './context';

type TextElement = HTMLInputElement | HTMLTextAreaElement;

interface TextControlOptions<E extends TextElement> {
    ref?: Ref<E>;
    /** Explicit values win over the field's. */
    required?: boolean;
    disabled?: boolean;
    /** Block native form submission while the field has an issue, with the
     *  issue as the browser's message. */
    validateOnSubmit?: boolean;
    onFocus?: (event: FocusEvent<E>) => void;
    onBlur?: (event: FocusEvent<E>) => void;
}

function assignRef<E>(ref: Ref<E> | undefined, element: E | null) {
    if (typeof ref === 'function') ref(element);
    else if (ref) ref.current = element;
}

function hintAttributes(input: InputHints) {
    return {
        inputMode: input.keyboard,
        autoComplete: input.autoComplete,
        autoCapitalize: input.autoCapitalize,
        maxLength: input.maxLength,
        name: input.name,
    };
}

/**
 * Ids, ARIA and state attributes shared by <FieldInput> and <FieldTextarea>.
 * With a field from useField the control is driven by it (value, events,
 * input hints). Inside a frame-only field (staticField) it is a plain native
 * control: value, defaultValue and onChange pass straight through.
 */
function useTextControl<E extends TextElement>(
    part: string,
    { ref, required, disabled, validateOnSubmit = false, onFocus, onBlur }: TextControlOptions<E>,
) {
    const context: FieldContextValue = useFieldContext(part);
    const { controller, view, ids, data } = context;

    const element = useRef<E | null>(null);
    const setRef = useCallback(
        (node: E | null) => {
            element.current = node;
            assignRef(ref, node);
        },
        [ref],
    );

    const issue = controller?.feedback.issue ?? null;
    useEffect(() => {
        if (!validateOnSubmit) return;
        element.current?.setCustomValidity(issue ? issue.message : '');
    }, [validateOnSubmit, issue]);

    const common = {
        ...data,
        ref: setRef,
        id: ids.input,
        disabled: disabled ?? context.disabled,
        required: required ?? view.required,
        'aria-invalid': view.status === 'invalid' || undefined,
        'aria-describedby': describedBy(view, ids),
    };

    if (!controller) {
        return { context, defaults: {}, bound: { ...common, onFocus, onBlur, placeholder: undefined } };
    }

    return {
        context,
        defaults: hintAttributes(controller.definition.input),
        bound: {
            ...common,
            value: controller.display,
            placeholder: controller.definition.placeholder,
            onChange: (event: { target: { value: string } }) =>
                controller.setText(event.target.value),
            onFocus: (event: FocusEvent<E>) => {
                controller.focus();
                onFocus?.(event);
            },
            onBlur: (event: FocusEvent<E>) => {
                controller.blur();
                onBlur?.(event);
            },
        },
    };
}

/** With a useField field, value/defaultValue/onChange are ignored: the field
 *  drives the input. With staticField they work as on a native input. */
export interface FieldInputProps extends Omit<ComponentPropsWithRef<'input'>, 'children'> {
    validateOnSubmit?: boolean;
}

export function FieldInput({
    ref,
    required,
    disabled,
    validateOnSubmit,
    onFocus,
    onBlur,
    className,
    placeholder,
    ...rest
}: FieldInputProps) {
    const { context, defaults, bound } = useTextControl<HTMLInputElement>('FieldInput', {
        ref,
        required,
        disabled,
        validateOnSubmit,
        onFocus,
        onBlur,
    });
    return (
        <input
            type={context.controller?.definition.input.type ?? 'text'}
            {...defaults}
            {...rest}
            {...bound}
            placeholder={placeholder ?? bound.placeholder}
            className={context.classFor('input', className) || undefined}
        />
    );
}

export interface FieldTextareaProps extends Omit<ComponentPropsWithRef<'textarea'>, 'children'> {
    validateOnSubmit?: boolean;
}

export function FieldTextarea({
    ref,
    required,
    disabled,
    validateOnSubmit,
    onFocus,
    onBlur,
    className,
    placeholder,
    ...rest
}: FieldTextareaProps) {
    const { context, defaults, bound } = useTextControl<HTMLTextAreaElement>('FieldTextarea', {
        ref,
        required,
        disabled,
        validateOnSubmit,
        onFocus,
        onBlur,
    });
    return (
        <textarea
            {...defaults}
            {...rest}
            {...bound}
            placeholder={placeholder ?? bound.placeholder}
            className={context.classFor('input', className) || undefined}
        />
    );
}
