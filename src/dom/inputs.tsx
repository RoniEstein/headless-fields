import {
    useCallback,
    useEffect,
    useRef,
    type ComponentPropsWithRef,
    type FocusEvent,
    type Ref,
} from 'react';
import type { InputHints } from '../core/types';
import { useFieldContext, type FieldContextValue } from './context';

type TextElement = HTMLInputElement | HTMLTextAreaElement;

interface TextControlOptions<E extends TextElement> {
    ref?: Ref<E>;
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

/** Value, events, ids and ARIA shared by <FieldInput> and <FieldTextarea>. */
function useTextControl<E extends TextElement>(
    part: string,
    { ref, validateOnSubmit = false, onFocus, onBlur }: TextControlOptions<E>,
) {
    const context: FieldContextValue = useFieldContext(part);
    const { controller, view, ids, disabled, data } = context;
    if (!controller) {
        throw new Error(`<${part}> needs a field from useField, not staticField.`);
    }

    const element = useRef<E | null>(null);
    const setRef = useCallback(
        (node: E | null) => {
            element.current = node;
            assignRef(ref, node);
        },
        [ref],
    );

    const issue = controller.feedback.issue;
    useEffect(() => {
        if (!validateOnSubmit) return;
        element.current?.setCustomValidity(issue ? issue.message : '');
    }, [validateOnSubmit, issue]);

    return {
        context,
        defaults: hintAttributes(controller.definition.input),
        bound: {
            ...data,
            ref: setRef,
            id: ids.input,
            value: controller.display,
            disabled,
            required: view.required,
            placeholder: controller.definition.placeholder,
            'aria-invalid': view.status === 'invalid' || undefined,
            'aria-describedby': view.message ? ids.message : undefined,
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

export interface FieldInputProps
    extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'defaultValue' | 'onChange' | 'children'> {
    validateOnSubmit?: boolean;
}

export function FieldInput({
    ref,
    validateOnSubmit,
    onFocus,
    onBlur,
    className,
    placeholder,
    ...rest
}: FieldInputProps) {
    const { context, defaults, bound } = useTextControl<HTMLInputElement>('FieldInput', {
        ref,
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

export interface FieldTextareaProps
    extends Omit<ComponentPropsWithRef<'textarea'>, 'value' | 'defaultValue' | 'onChange' | 'children'> {
    validateOnSubmit?: boolean;
}

export function FieldTextarea({
    ref,
    validateOnSubmit,
    onFocus,
    onBlur,
    className,
    placeholder,
    ...rest
}: FieldTextareaProps) {
    const { context, defaults, bound } = useTextControl<HTMLTextAreaElement>('FieldTextarea', {
        ref,
        validateOnSubmit,
        onFocus,
        onBlur,
    });
    const { inputMode, autoComplete, autoCapitalize, maxLength, name } = defaults;
    return (
        <textarea
            {...{ inputMode, autoComplete, autoCapitalize, maxLength, name }}
            {...rest}
            {...bound}
            placeholder={placeholder ?? bound.placeholder}
            className={context.classFor('input', className) || undefined}
        />
    );
}
