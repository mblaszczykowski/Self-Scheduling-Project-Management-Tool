import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorMessage, Field, Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import EyeButton from '../common/EyeButton';
import { register, checkUserAuth } from '../../util/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../util/toast';
import { getErrorMessage } from '../../util/helpers';
import { authInputClass } from '../common/formHelpers';

interface RegisterValues {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
}

interface PasswordRule {
    label: string;
    test: (v: string) => boolean;
}

// Single source of truth for the password policy — used by both the Yup schema
// and the live requirements checklist so they can't drift apart.
const SPECIAL_CHAR = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
const PASSWORD_RULES: PasswordRule[] = [
    { label: '8+ characters', test: (v) => (v || '').length >= 8 },
    { label: 'Uppercase letter', test: (v) => /[A-Z]/.test(v || '') },
    { label: 'Lowercase letter', test: (v) => /[a-z]/.test(v || '') },
    { label: 'Number', test: (v) => /\d/.test(v || '') },
    { label: 'Special character', test: (v) => SPECIAL_CHAR.test(v || '') },
];

const validationSchema = Yup.object().shape({
    firstname: Yup.string()
        .min(2, 'First name must be at least 2 characters.')
        .max(20, 'Max length is 20.')
        .required('First name is required.'),
    lastname: Yup.string()
        .min(2, 'Last name must be at least 2 characters.')
        .max(20, 'Max length is 20.')
        .required('Last name is required.'),
    email: Yup.string()
        .email('Invalid email address format.')
        .required('Email is required.'),
    password: Yup.string()
        .min(8, 'Password must be at least 8 characters.')
        .max(128, 'Password must not exceed 128 characters.')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter.')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter.')
        .matches(/\d/, 'Password must contain at least one number.')
        .matches(SPECIAL_CHAR, 'Password must contain at least one special character.')
        .test('no-spaces', 'Password must not contain spaces.', value => !value?.includes(' '))
        .required('Password is required.'),
});

const PasswordRequirements = ({ password }: { password: string }) => {
    const requirements = PASSWORD_RULES.map(rule => ({
        label: rule.label,
        met: rule.test(password),
    }));

    return (
        <div className="mt-2 p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Requirements</p>
            <div className="grid grid-cols-2 gap-0.5">
                {requirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <span className={`text-xs ${req.met ? 'text-green-600' : 'text-slate-400'}`}>
                            {req.met ? '✓' : '○'}
                        </span>
                        <span className={`text-xs ${req.met ? 'text-green-600' : 'text-slate-500'}`}>
                            {req.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

function RegisterForm({ onToggleForm }: { onToggleForm: () => void }) {
    const [showPassword, setShowPassword] = useState(false);
    const { setUser } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (values: RegisterValues, { setSubmitting }: FormikHelpers<RegisterValues>) => {
        try {
            await register(values);
            const userData = await checkUserAuth();
            setUser(userData);
            navigate('/dashboard');
        } catch (err) {
            showToast(getErrorMessage(err, 'Registration failed.'));

        } finally {
            setSubmitting(false);
        }
    };


    return (
        <Formik
            initialValues={{ firstname: '', lastname: '', email: '', password: '' }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
        >
            {({ errors, touched, isSubmitting, values }) => (
                <Form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                First name
                            </label>
                            <Field
                                type="text"
                                name="firstname"
                                autoComplete="given-name"
                                className={authInputClass(!!(errors.firstname && touched.firstname))}
                                placeholder="First name"
                            />
                            <ErrorMessage name="firstname" component="span" className="text-red-500 text-xs mt-1 block" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                Last name
                            </label>
                            <Field
                                type="text"
                                name="lastname"
                                autoComplete="family-name"
                                className={authInputClass(!!(errors.lastname && touched.lastname))}
                                placeholder="Last name"
                            />
                            <ErrorMessage name="lastname" component="span" className="text-red-500 text-xs mt-1 block" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Email
                        </label>
                        <Field
                            type="email"
                            name="email"
                            autoComplete="email"
                            className={authInputClass(!!(errors.email && touched.email))}
                            placeholder="Email"
                        />
                        <ErrorMessage name="email" component="span" className="text-red-500 text-xs mt-1 block" />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Password
                        </label>
                        <div className="relative">
                            <Field
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                autoComplete="new-password"
                                className={`${authInputClass(!!(errors.password && touched.password))} pr-12`}
                                placeholder="Password"
                            />
                            <EyeButton showPassword={showPassword} setShowPassword={setShowPassword} />
                        </div>
                        <ErrorMessage name="password" component="span" className="text-red-500 text-xs mt-1 block" />
                        <PasswordRequirements password={values.password} />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm hover:shadow-md disabled:opacity-50"
                    >
                        {isSubmitting ? 'Creating account...' : 'Create account'}
                    </button>

                    <p className="text-center text-sm text-slate-500">
                        Already have an account?{' '}
                        <button
                            type="button"
                            onClick={onToggleForm}
                            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                            Log in
                        </button>
                    </p>
                </Form>
            )}
        </Formik>
    );
}

export default RegisterForm;