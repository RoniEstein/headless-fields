import type { ReactNode, Ref } from 'react';
import type { FieldDefinition } from '../core/types';
import { useField, type FieldOptions } from '../react/useField';
import { FieldInput, FieldTextarea, type FieldInputProps, type FieldTextareaProps } from './inputs';
import {
    FieldAdornment,
    FieldControl,
    FieldIndicator,
    FieldLabel,
    FieldMessage,
    FieldRoot,
} from './parts';
import type { FieldClassNames } from './skin';

export interface FieldProps<V> extends FieldOptions<V> {
    definition: FieldDefinition<V>;
    /** Defaults to the definition's label. Pass `false` for none. */
    label?: ReactNode | false;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    name?: string;
    /** Content inside the box before the input (an icon, a "$"). */
    start?: ReactNode;
    /** Content inside the box after the input and indicator. */
    end?: ReactNode;
    /** Per-field classes, merged after the skin's. */
    classNames?: FieldClassNames;
    validateOnSubmit?: boolean;
    /** Render a <textarea>. */
    multiline?: boolean;
    rows?: number;
    /** Anything else for the native element (autoFocus, data-*, aria-*). */
    inputProps?: Omit<FieldInputProps, 'ref'> | Omit<FieldTextareaProps, 'ref'>;
    inputRef?: Ref<HTMLInputElement>;
    textareaRef?: Ref<HTMLTextAreaElement>;
}

/**
 * The standard field layout: label, then the control box holding adornments,
 * the input and the indicator, then the message. Compose the parts directly
 * for anything else.
 */
export function Field<V>({
    definition,
    label,
    placeholder,
    disabled,
    id,
    name,
    start,
    end,
    classNames,
    validateOnSubmit,
    multiline = false,
    rows,
    inputProps,
    inputRef,
    textareaRef,
    ...options
}: FieldProps<V>) {
    const field = useField(definition, options);
    // Only set what was given, so the definition's defaults (name="tel")
    // survive an omitted prop.
    const shared = {
        ...(name !== undefined && { name }),
        ...(placeholder !== undefined && { placeholder }),
        validateOnSubmit,
    };

    return (
        <FieldRoot
            field={field}
            disabled={disabled}
            inputId={id}
            hasStart={start !== undefined}
            hasEnd={end !== undefined}
            classNames={classNames}
        >
            {label !== false && <FieldLabel>{label}</FieldLabel>}
            <FieldControl>
                {start !== undefined && <FieldAdornment side="start">{start}</FieldAdornment>}
                {multiline ? (
                    <FieldTextarea
                        {...(inputProps as Omit<FieldTextareaProps, 'ref'>)}
                        {...shared}
                        ref={textareaRef}
                        rows={rows}
                    />
                ) : (
                    <FieldInput
                        {...(inputProps as Omit<FieldInputProps, 'ref'>)}
                        {...shared}
                        ref={inputRef}
                    />
                )}
                <FieldIndicator />
                {end !== undefined && <FieldAdornment side="end">{end}</FieldAdornment>}
            </FieldControl>
            <FieldMessage />
        </FieldRoot>
    );
}
