import type { FieldDefinition, Issue } from './types';

export interface Evaluation {
    /** The first problem with the current raw value, if any. */
    issue: Issue | null;
    /** The mask considers the answer fully typed. */
    complete: boolean;
}

/** Checks raw against the definition: required, then rules in order, then
 *  completeness (so a definite error outranks "keep typing"). */
export function evaluate<V>(
    definition: FieldDefinition<V>,
    raw: string,
    required: boolean,
): Evaluation {
    if (raw === '') {
        const issue: Issue | null =
            required && definition.requiredMessage
                ? {
                      message: definition.requiredMessage,
                      timing: 'blur',
                      required: true,
                  }
                : null;
        return { issue, complete: false };
    }

    for (const rule of definition.rules) {
        const issue = rule(raw);
        if (issue) return { issue, complete: definition.mask.complete(raw) };
    }

    const complete = definition.mask.complete(raw);
    if (!complete && definition.mask.incomplete) {
        return {
            issue: {
                message: definition.mask.incomplete(raw),
                timing: 'blur',
            },
            complete,
        };
    }
    return { issue: null, complete };
}

export interface FeedbackContext {
    raw: string;
    /** The user has left the field since they last focused it. */
    touched: boolean;
    required: boolean;
    /** An error from outside the field (a failed submit). Always shown. */
    serverError?: string;
    /** Show the required message before the user touches the
     *  field. Off by default: an untouched form should not look broken. */
    showRequiredHint?: boolean;
}

export type FieldStatus = 'idle' | 'valid' | 'invalid';

/** An error, or information about the answer so far ("3 of 10 digits",
 *  "January 2, 1980"). Help text that stays put is the field's hint, a
 *  separate part with its own slot. */
export type MessageTone = 'error' | 'info';

export interface Feedback {
    status: FieldStatus;
    tone: MessageTone | null;
    message: string;
    issue: Issue | null;
    complete: boolean;
}

/**
 * The one display policy every field shares:
 *   1. A server error always wins.
 *   2. An immediate issue is an error straight away; a blur issue becomes an
 *      error once the user leaves the field.
 *   3. A blur issue that is not an error yet is shown as information while
 *      the user is typing (never on an untouched, empty field unless asked).
 *   4. Otherwise the definition's description of the answer, if any.
 *   5. Valid means non-empty, complete and issue-free.
 * The static hint is not part of this: it has its own part and never gives
 * way to a message.
 */
export function resolveFeedback<V>(
    definition: FieldDefinition<V>,
    context: FeedbackContext,
): Feedback {
    const { raw, touched, required, serverError } = context;
    const { issue, complete } = evaluate(definition, raw, required);
    const base = { issue, complete };

    if (serverError) {
        return { ...base, status: 'invalid', tone: 'error', message: serverError };
    }
    if (issue && (issue.timing === 'immediate' || touched)) {
        return { ...base, status: 'invalid', tone: 'error', message: issue.message };
    }

    const status: FieldStatus =
        raw !== '' && !issue && complete ? 'valid' : 'idle';

    if (issue && (raw !== '' || (issue.required && context.showRequiredHint))) {
        return { ...base, status, tone: 'info', message: issue.message };
    }

    const message = (!issue && raw !== '' && definition.describe?.(raw)) || '';
    return { ...base, status, tone: message ? 'info' : null, message };
}
