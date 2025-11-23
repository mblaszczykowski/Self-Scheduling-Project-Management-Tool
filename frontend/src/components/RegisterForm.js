import React, {useState} from 'react';
import {ErrorMessage, Field, Form, Formik} from 'formik';
import * as Yup from 'yup';
import css from './RegisterForm.module.css';
import {useNavigate} from 'react-router-dom';
import {request} from '../util/axios_helper';
import {Slide, toast} from 'react-toastify';
import EyeButton from './EyeButton';

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
    // password: Yup.string()
    //     .min(8, 'Password must be at least 8 characters.')
    //     .max(20, 'Max length is 20.')
    //     .required('Password is required.'),
});

function displayNotification(message, type = 'error', duration = 2500, transition = Slide, position = 'top-center') {
    toast[type](message, {
        position: position,
        autoClose: duration,
        transition: transition,
    });
}

function RegisterForm({ onToggleForm }) {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);

    const handleRegister = (obj) => {
        const { firstname, lastname, email, password } = obj;
        request('POST', 'api/users', { firstname, lastname, email, password })
            .then(() => {
                navigate('/dashboard');
            })
            .catch((error) => {
                const errorMessage =
                    error.response && error.response.data && error.response.data.message
                        ? error.response.data.message
                        : 'Registration failed.';
                displayNotification(errorMessage);
                console.error('Register error:', error.response || error.message);
            });
    };

    return (
        <div className={css['form-container']}>
            <Formik
                initialValues={{
                    firstname: '',
                    lastname: '',
                    email: '',
                    password: ''
                }}
                validationSchema={validationSchema}
                validateOnChange={false}
                validateOnBlur={false}
                onSubmit={(values, {setSubmitting}) => {
                    handleRegister(values);
                    setSubmitting(false);
                }}
            >
                {({errors}) => (
                    <Form className="max-w-sm mx-auto">
                        <div className={css['form-step']}>

                            <div>
                                <div className="py-3">
                                    <h1 className="block text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-l from-blue-700 to-blue-500">
                                        Get started
                                    </h1>
                                </div>
                                <div className="flex items-start mb-6">
                                    <label
                                        htmlFor="terms"
                                        className=" text-sm font-medium text-gray-900"
                                    >
                                        Already have an account?{' '}
                                        <a
                                            onClick={onToggleForm}
                                            className="text-blue-600 hover:underline"
                                        >
                                            Log in
                                        </a>
                                    </label>
                                </div>
                                <div className="mb-3">
                                    <h1 className="block text-md mt-1 font-bold text-gray-600">Create an account</h1>
                                </div>
                                <div className={`mb-3 ${errors.firstname ? "mb-1" : "mb-5"}`}>
                                    <Field
                                        type="text"
                                        name="firstname"
                                        className="shadow-sm bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        placeholder={`First name`}
                                    ></Field>
                                    <ErrorMessage
                                        name="firstname"
                                        component="span"
                                        className={css.error}
                                    />
                                </div>
                                <div className={`mb-3 ${errors.lastname ? "mb-1" : "mb-5"}`}>
                                    <Field
                                        type="text"
                                        name="lastname"
                                        className="shadow-sm bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        placeholder={`Last name`}
                                    ></Field>
                                    <ErrorMessage
                                        name="lastname"
                                        component="span"
                                        className={css.error}
                                    />
                                </div>
                                <div className={`mb-3 ${errors.email ? "mb-1" : "mb-5"}`}>
                                    <Field
                                        type="text"
                                        name="email"
                                        className="shadow-sm bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        placeholder={`Email`}
                                    ></Field>
                                    <ErrorMessage
                                        name="email"
                                        component="span"
                                        className={css.error}
                                    />
                                </div>
                                <div className={`mb-3 ${errors.password ? "mb-1" : "mb-5"}`}>

                                    <div className="relative">
                                        <Field
                                            className="shadow-sm bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            placeholder={`Password`}
                                        ></Field>
                                        <EyeButton showPassword={showPassword}
                                                   setShowPassword={setShowPassword}/>
                                    </div>
                                    <ErrorMessage
                                        className={css.error}
                                        name="password"
                                        component="span"
                                    />

                                </div>

                                <div className="relative w-full h-16">
                                    <button
                                        type="submit"
                                        className="absolute top-0 right-0 text-white bg-blue-500 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5"
                                    >
                                        Create
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
}

export default RegisterForm;
