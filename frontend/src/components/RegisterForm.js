import React, { useState } from 'react';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { Slide, toast } from 'react-toastify';
import EyeButton from './EyeButton';
import { register } from '../util/api';

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
        .min(6, 'Password must be at least 6 characters.')
        .required('Password is required.'),
});

const showNotification = (message, type = 'error') => {
    toast[type](message, {
        position: 'top-center',
        autoClose: 2500,
        transition: Slide,
    });
};

function RegisterForm({ onToggleForm }) {
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            await register(values);
            // Force full page reload to trigger auth check with new cookies
            window.location.href = '/dashboard';
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Registration failed.';
            showNotification(errorMessage);
            console.error('Register error:', error.response || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass = (hasError) => `w-full px-4 py-3 rounded-xl border ${
        hasError
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-slate-200 focus:ring-blue-500 focus:border-blue-500'
    } bg-slate-50 text-slate-900 text-sm transition-colors focus:ring-2 focus:outline-none`;

    return (
        <Formik
            initialValues={{ firstname: '', lastname: '', email: '', password: '' }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
        >
            {({ errors, touched, isSubmitting }) => (
                <Form className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                First name
                            </label>
                            <Field
                                type="text"
                                name="firstname"
                                className={inputClass(errors.firstname && touched.firstname)}
                                placeholder="First name"
                            />
                            <ErrorMessage name="firstname" component="span" className="text-red-500 text-xs mt-1 block" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Last name
                            </label>
                            <Field
                                type="text"
                                name="lastname"
                                className={inputClass(errors.lastname && touched.lastname)}
                                placeholder="Last name"
                            />
                            <ErrorMessage name="lastname" component="span" className="text-red-500 text-xs mt-1 block" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Email
                        </label>
                        <Field
                            type="text"
                            name="email"
                            className={inputClass(errors.email && touched.email)}
                            placeholder="Email"
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
                                placeholder="Password"
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
                        {isSubmitting ? 'Creating...' : 'Create'}
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