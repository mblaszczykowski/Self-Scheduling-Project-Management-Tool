import React, { useContext, useState, useEffect } from 'react';
import { ErrorMessage, Field, Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import EyeButton from '../common/EyeButton';
import { login, getUser } from '../../util/api';
import { showToast } from '../../util/toast';
import { getErrorMessage } from '../../util/helpers';
import { AuthContext } from '../../context/AuthContext';
import { authInputClass } from '../common/formHelpers';

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
    const { setUser } = useContext(AuthContext);

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
            const fetchedUser = await getUser();
            setUser(fetchedUser);
            navigate('/dashboard');
        } catch (err) {
            showToast(getErrorMessage(err, 'Login failed. Check your credentials.'));
            console.error('Login error:', err.response || err.message);
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
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Email
                        </label>
                        <Field
                            type="email"
                            name="email"
                            autoComplete="email"
                            className={authInputClass(!!(errors.email && touched.email))}
                            placeholder="Enter your email"
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
                                autoComplete="current-password"
                                className={`${authInputClass(!!(errors.password && touched.password))} pr-12`}
                                placeholder="Enter your password"
                            />
                            <EyeButton showPassword={showPassword} setShowPassword={setShowPassword} />
                        </div>
                        <ErrorMessage name="password" component="span" className="text-red-500 text-xs mt-1 block" />
                    </div>

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