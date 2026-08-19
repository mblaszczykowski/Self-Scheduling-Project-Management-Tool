import * as Yup from 'yup';

// Single source of truth for the password policy, mirroring the backend's complexity rule
// (upper, lower, digit, special, no spaces, 8-128 chars). Used by both a Yup schema and a live
// requirements checklist so they can't drift apart, and shared by every form that sets a
// password (registration, account settings).

export interface PasswordRule {
    label: string;
    message: string;
    test: (v: string) => boolean;
}

export const SPECIAL_CHAR = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export const PASSWORD_RULES: PasswordRule[] = [
    {
        label: '8+ characters',
        message: 'Password must be at least 8 characters.',
        test: (v) => (v || '').length >= 8,
    },
    {
        label: 'Uppercase letter',
        message: 'Password must contain at least one uppercase letter.',
        test: (v) => /[A-Z]/.test(v || ''),
    },
    {
        label: 'Lowercase letter',
        message: 'Password must contain at least one lowercase letter.',
        test: (v) => /[a-z]/.test(v || ''),
    },
    {
        label: 'Number',
        message: 'Password must contain at least one number.',
        test: (v) => /\d/.test(v || ''),
    },
    {
        label: 'Special character',
        message: 'Password must contain at least one special character.',
        test: (v) => SPECIAL_CHAR.test(v || ''),
    },
];

export const PASSWORD_MAX_LENGTH = 128;

/**
 * Applies PASSWORD_RULES (plus the "no spaces" rule the backend also enforces) as Yup tests, so
 * every password field validates the same complexity the checklist above shows.
 *
 * A value of `undefined` always passes, matching Yup's own built-ins (`.min`, `.matches`): a
 * password field that was left untouched (transformed from '' to undefined) means "no change",
 * not a violation.
 */
export const withPasswordComplexity = (schema: Yup.StringSchema): Yup.StringSchema =>
    PASSWORD_RULES.reduce(
        (acc, rule) => acc.test(rule.label, rule.message, (v) => v === undefined || rule.test(v)),
        schema,
    )
        .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`)
        .test(
            'no-spaces',
            'Password must not contain spaces.',
            (v) => v === undefined || !v.includes(' '),
        );
