import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import EyeButton from '../common/EyeButton';
import { register, checkUserAuth } from '../../util/api';
import { DataContext } from '../../context/DataContext';
import { showToast } from '../../util/toast';
import { authInputClass } from '../common/formHelpers';

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
        .matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'Password must contain at least one special character.')
        .test('no-spaces', 'Password must not contain spaces.', value => !value?.includes(' '))
        .required('Password is required.'),
});

const PasswordRequirements = ({ password }) => {
    const requirements = [
        { label: '8+ characters', met: password?.length >= 8 },
        { label: 'Uppercase letter', met: /[A-Z]/.test(password || '') },
        { label: 'Lowercase letter', met: /[a-z]/.test(password || '') },
        { label: 'Number', met: /\d/.test(password || '') },
        { label: 'Special character', met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password || '') },
    ];

    return (
        <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-medium text-slate-600 mb-2">Password requirements:</p>
            <div className="grid grid-cols-2 gap-1">
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

function RegisterForm({ onToggleForm }) {
    const [showPassword, setShowPassword] = useState(false);
    const { setUser } = useContext(DataContext);
    const navigate = useNavigate();

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            await register(values);
            const userData = await checkUserAuth();
            setUser(userData);
            navigate('/dashboard');
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Registration failed.';
            showToast(errorMessage);
            console.error('Register error:', err.response || err.message);
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
                <Form className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                First name
                            </label>
                            <Field
                                type="text"
                                name="firstname"
                                className={authInputClass(errors.firstname && touched.firstname)}
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
                                className={authInputClass(errors.lastname && touched.lastname)}
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
                            type="email"
                            name="email"
                            className={authInputClass(errors.email && touched.email)}
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
                                className={`${authInputClass(errors.password && touched.password)} pr-12`}
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
                        className={
                            'w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600'
                            + ' hover:from-blue-700 hover:to-indigo-700 text-white font-medium'
                            + ' rounded-xl transition-all duration-200 shadow-lg'
                            + ' shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50'
                        }
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