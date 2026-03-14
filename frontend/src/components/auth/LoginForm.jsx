import React, { useContext, useState, useEffect } from 'react';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import EyeButton from '../common/EyeButton';
import { login, getUser } from '../../util/api';
import { showToast } from '../../util/toast';
import { DataContext } from '../../context/DataContext';
import { authInputClass } from '../common/formHelpers';

const validationSchema = Yup.object().shape({
    email: Yup.string()
        .email('Invalid email address format.')
        .required('Email is required.'),
    password: Yup.string().required('Password is required.'),
});

function LoginForm({ onToggleForm }) {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const { setUser } = useContext(DataContext);

    useEffect(() => {
        const expiredMessage = sessionStorage.getItem('session_expired');
        if (expiredMessage) {
            sessionStorage.removeItem('session_expired');
            showToast(expiredMessage, 'info');
        }
    }, []);

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            await login(values.email, values.password);
            const fetchedUser = await getUser();
            setUser(fetchedUser);
            navigate('/dashboard');
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Login failed. Check your credentials.';
            showToast(errorMessage);
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
                <Form className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Email
                        </label>
                        <Field
                            type="email"
                            name="email"
                            className={authInputClass(errors.email && touched.email)}
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
                                className={`${authInputClass(errors.password && touched.password)} pr-12`}
                                placeholder="Enter your password"
                            />
                            <EyeButton showPassword={showPassword} setShowPassword={setShowPassword} />
                        </div>
                        <ErrorMessage name="password" component="span" className="text-red-500 text-xs mt-1 block" />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={
                            'w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600'
                            + ' hover:from-blue-700 hover:to-indigo-700 text-white font-medium'
                            + ' rounded-xl transition-all duration-200 shadow-lg'
                            + ' shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50'
                        }
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