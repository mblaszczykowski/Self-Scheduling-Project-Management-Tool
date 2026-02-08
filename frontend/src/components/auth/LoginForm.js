import React, { useContext, useState, useEffect } from 'react';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { Slide, toast } from 'react-toastify';
import EyeButton from '../common/EyeButton';
import { login, getUser } from '../../util/api';
import { DataContext } from '../../context/DataContext';

const validationSchema = Yup.object().shape({
    email: Yup.string()
        .email('Invalid email address format.')
        .required('Email is required.'),
    password: Yup.string().required('Password is required.'),
});

const showNotification = (message, type = 'error') => {
    toast[type](message, {
        position: 'top-center',
        autoClose: 2500,
        transition: Slide,
    });
};

function LoginForm({ onToggleForm }) {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const { setUser } = useContext(DataContext);

    // Check for session expiry message on mount
    useEffect(() => {
        const expiredMessage = sessionStorage.getItem('session_expired');
        if (expiredMessage) {
            sessionStorage.removeItem('session_expired');
            showNotification(expiredMessage, 'info');
        }
    }, []);

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            await login(values.email, values.password);
            const fetchedUser = await getUser();
            setUser(fetchedUser);
            navigate('/dashboard');
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Login failed. Check your credentials.';
            showNotification(errorMessage);
            console.error('Login error:', error.response || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass = (hasError) => `w-full px-4 py-3 rounded-xl border ${
        hasError
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-slate-200 focus:ring-slate-900 focus:border-slate-900'
    } bg-slate-50 text-slate-900 text-sm transition-colors focus:ring-1 focus:outline-none`;

    return (
        <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
        >
            {({ errors, touched, isSubmitting }) => (
                <Form className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Email
                        </label>
                        <Field
                            type="email"
                            name="email"
                            className={inputClass(errors.email && touched.email)}
                            placeholder="Enter your email"
                        />
                        <ErrorMessage name="email" component="span" className="text-red-500 text-xs mt-1 block" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <Field
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                className={`${inputClass(errors.password && touched.password)} pr-12`}
                                placeholder="Enter your password"
                            />
                            <EyeButton showPassword={showPassword} setShowPassword={setShowPassword} />
                        </div>
                        <ErrorMessage name="password" component="span" className="text-red-500 text-xs mt-1 block" />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50"
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