import React, {useContext, useState} from 'react';
import {ErrorMessage, Field, Form, Formik} from 'formik';
import * as Yup from 'yup';
import css from './RegisterForm.module.css';
import {request} from '../util/axios_helper';
import {useNavigate} from 'react-router-dom';
import {Slide, toast} from 'react-toastify';
import EyeButton from './EyeButton';
import {getUser} from "../util/api";
import {DataContext} from "../context/DataContext";

const contactSchema = Yup.object().shape({
    login: Yup.string()
        .email('Invalid email address format.')
        .required('Email is required.'),
    password: Yup.string().required('Password is required.'),
});

function displayNotification(message, type = 'error', duration = 2500, transition = Slide, position = 'top-center') {
    toast[type](message, {
        position: position,
        autoClose: duration,
        transition: transition,
    });
}

function LoginForm({ onToggleForm }) {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const dataContext = useContext(DataContext);

    const handleLogin = (obj) => {
        const { login, password } = obj;
        let email = login;
        request('POST', '/api/auth/login', { email, password })
            .then(async () => {
                const fetchedUser = await getUser();
                dataContext.setUser(fetchedUser);
                navigate('/dashboard');
            })
            .catch((error) => {
                const errorMessage =
                    error.response && error.response.data && error.response.data.message
                        ? error.response.data.message
                        : 'Login failed. Check your credentials.';
                displayNotification(errorMessage);
                console.error('Login error:', error.response || error.message);
            });
    };

    return (
        <div className={css['form-container']}>
            <Formik
                initialValues={{
                    login: '',
                    password: '',
                }}
                onSubmit={(values) => {
                    handleLogin(values);
                    //setSubmitting(false);
                }}
                validationSchema={contactSchema}
            >
                <Form className="max-w-sm mx-auto">

                    <div className="py-3 mt-12">
                        <h1 className="block text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-l from-blue-700 to-blue-500">
                            Welcome back
                        </h1>

                    </div>
                    <div className="flex items-start mb-6">
                        <label
                            htmlFor="terms"
                            className="text-sm font-medium text-gray-900"
                        >
                            Don't have an account?{' '}
                            <a
                                onClick={onToggleForm}
                                className="text-blue-600 hover:underline"
                            >
                                Sign up
                            </a>
                        </label>
                    </div>
                    <div className="mb-5">
                        <Field
                            type="text"
                            name="login"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            placeholder={`Username`}
                        ></Field>
                        <ErrorMessage
                            name="login"
                            component="span"
                            className={css.error}
                        />
                    </div>
                    <div className="mb-5">
                        <div className="relative">
                            <Field
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                placeholder={`Password`}
                            ></Field>
                            <EyeButton showPassword={showPassword} setShowPassword={setShowPassword}/>
                        </div>
                        <ErrorMessage
                            className={css.error}
                            name="password"
                            component="span"
                        />
                    </div>

                    <div className="flex justify-between items-center">
                        <button
                            type="submit"
                            className="text-white bg-blue-500 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center"
                        >
                            Submit
                        </button>
                    </div>
                </Form>
            </Formik>
        </div>
    );
}

export default LoginForm;
