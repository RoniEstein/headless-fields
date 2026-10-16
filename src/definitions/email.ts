import {
    defineField,
    labelled,
    requiredMessage,
    text,
    validated,
} from '../core/define';
import type { Issue, Rule } from '../core/types';

const EMAIL =
    /^[a-zA-Z0-9.!#$%&'*/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const now = (message: string): Issue => ({ message, timing: 'immediate' });
const later = (message: string): Issue => ({ message, timing: 'blur' });

/**
 * Ordered so the user hears about definite mistakes (a space, two @) at once,
 * gets gentle "keep going" hints while the address is still taking shape,
 * and only then is told a finished-looking address is malformed.
 */
export const emailAddress: Rule = (raw) => {
    if (raw.includes('+')) return now('Plus aliases not allowed');
    if ((raw.match(/@/g) ?? []).length > 1) return now('Multiple @ symbols');
    if (/\s/.test(raw)) return now('No spaces allowed');

    if (!raw.includes('@')) return later('Missing @');
    const [user, domain] = raw.split('@');
    if (!user) return later('Missing username');
    if (!domain) return later('Type the domain');
    if (!domain.includes('.')) return later('Domain needs a TLD (e.g. .com)');

    const tld = domain.split('.').pop() ?? '';
    if (tld.length < 2) return now('TLD is too short');
    if (!EMAIL.test(raw)) return now('Invalid email format');
    return null;
};

export const email = defineField(
    text({ type: 'email', keyboard: 'email', autoComplete: 'email' }),
    validated(emailAddress),
    requiredMessage('Email is required'),
    labelled('Email', 'you@example.com'),
);
