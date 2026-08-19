import React, { useEffect, useId, useState } from 'react';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import EyeButton from '../common/EyeButton';
import FormField from '../common/FormField';
import { getCurrentUser, login } from '../../util/api';
import { showToast } from '../../util/toast';
import { getErrorMessage, safeNextPath } from '../../util/helpers';
import { useAuth } from '../../context/AuthContext';

interface LoginValues {
    email: string;
    password: string;
}

const validationSchema = Yup.object().shape({
    email: Yup.string()
        .email('Invalid email address format.')
        .required('Email is required.'),
    password: Yup.string().required('Password is required.'),
});

function LoginForm({ onToggleForm }: { onToggleForm: () => void }) {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const { setUser } = useAuth();
    const uid = useId();

    const [returnTo] = useState(() => safeNextPath(window.location.search));

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('expired') === 'true') {
            showToast('Your session has expired. Please sign in again.', 'info');
            window.history.replaceState({}, '', '/login');
        }
    }, []);

    const handleSubmit = async (values: LoginValues, { setSubmitting }: FormikHelpers<LoginValues>) => {
        try {
            await login(values.email, values.password);
            const fetchedUser = await getCurrentUser();
            setUser(fetchedUser);
            navigate(returnTo, { replace: true });
        } catch (err) {
            showToast(getErrorMessage(err, 'Login failed. Check your credentials.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
        >
            {({ errors, touched, isSubmitting }) => (
                <Form className="space-y-4">
                    <FormField
                        id={`${uid}-email`}
                        name="email"
                        label="Email"
                        type="email"
                        autoComplete="email"
                        hasError={!!(errors.email && touched.email)}
                        describedBy={errors.email && touched.email ? `${uid}-email-error` : undefined}
                        placeholder="Enter your email"
                    />

                    <FormField
                        id={`${uid}-password`}
                        name="password"
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        hasError={!!(errors.password && touched.password)}
                        describedBy={errors.password && touched.password ? `${uid}-password-error` : undefined}
                        placeholder="Enter your password"
                        inputClassName="pr-12"
                        rightElement={<EyeButton showPassword={showPassword} setShowPassword={setShowPassword} />}
                    />

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm hover:shadow-md disabled:opacity-50"
                    >
                        {isSubmitting ? 'Signing in...' : 'Sign in'}
                    </button>

                    <p className="text-center text-sm text-slate-500">
                        Don't have an account?{' '}
                        <button
                            type="button"
                            onClick={onToggleForm}
                            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                            Sign up
                        </button>
                    </p>
                </Form>
            )}
        </Formik>
    );
}

export default LoginForm;
