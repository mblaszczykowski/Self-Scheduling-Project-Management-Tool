import React, {useState} from 'react';
import Modal from 'react-modal';
import {ErrorMessage, Field, Form, Formik} from 'formik';
import * as Yup from 'yup';
import {updateUser} from '../util/api';

Modal.setAppElement('#root');

const AccountModal = ({ user, onClose, onUpdateUser }) => {
    const [profilePreview, setProfilePreview] = useState(
        user.profilePicture ? `http://localhost:8080${user.profilePicture}` : null
    );

    const initialValues = {
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
        profilePicture: null,
    };

    const validationSchema = Yup.object().shape({
        firstname: Yup.string().required('First name is required'),
        lastname: Yup.string().required('Last name is required'),
        email: Yup.string().email('Invalid email').required('Email is required'),
        currentPassword: Yup.string(),
        newPassword: Yup.string().min(6, 'Password must be at least 6 characters'),
        confirmNewPassword: Yup.string().oneOf([Yup.ref('newPassword'), null], 'Passwords must match'),
    });

    const handleSubmit = (values, { setSubmitting, setErrors }) => {
        const formData = new FormData();
        formData.append('firstname', values.firstname);
        formData.append('lastname', values.lastname);
        formData.append('email', values.email);

        if (values.currentPassword && values.newPassword) {
            formData.append('currentPassword', values.currentPassword);
            formData.append('newPassword', values.newPassword);
        }

        if (values.profilePicture) {
            formData.append('profilePicture', values.profilePicture);
        }

        updateUser(formData)
            .then((updatedUser) => {
                onUpdateUser(updatedUser);
                onClose();
            })
            .catch((error) => {
                console.error('Error updating user:', error);
                if (error.response && error.response.data && error.response.data.errors) {
                    setErrors(error.response.data.errors);
                }
            })
            .finally(() => {
                setSubmitting(false);
            });
    };

    const handleProfilePictureChange = (event) => {
        const file = event.currentTarget.files[0];
        if (file) {
            setProfilePreview(URL.createObjectURL(file));
        }
    };

    return (
        <Modal
            isOpen={true}
            onRequestClose={onClose}
            contentLabel="Account Settings"
            className="max-w-lg mx-auto mt-20 bg-white p-6 rounded-lg shadow-lg outline-none z-50"
            overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-cente z-50"
        >
            <h2 className="text-2xl font-bold mb-4">Account Settings</h2>
            <Formik
                initialValues={initialValues}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, setFieldValue, values }) => (
                    <Form className="space-y-4">
                        <div className="flex items-center space-x-4">
                            {profilePreview ? (
                                <img
                                    src={profilePreview}
                                    alt="Profile Preview"
                                    className="h-20 w-20 rounded-full object-cover"
                                />
                            ) : (
                                <div className="h-20 w-20 bg-gray-200 rounded-full flex items-center justify-center">
                                    {/* Default avatar icon */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5S7 4.24 7 7s2.24 5 5 5zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" />
                                    </svg>
                                </div>
                            )}
                            <label className="block">
                                <span className="sr-only">Choose profile photo</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => {
                                        handleProfilePictureChange(event);
                                        setFieldValue('profilePicture', event.currentTarget.files[0]);
                                    }}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0 file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </label>
                        </div>
                        <div>
                            <label htmlFor="firstname" className="block text-sm font-medium text-gray-700">
                                First Name
                            </label>
                            <Field
                                type="text"
                                id="firstname"
                                name="firstname"
                                className="w-full p-2 border border-gray-300 rounded-lg"
                            />
                            <ErrorMessage name="firstname" component="div" className="text-red-600 text-sm" />
                        </div>
                        <div>
                            <label htmlFor="lastname" className="block text-sm font-medium text-gray-700">
                                Last Name
                            </label>
                            <Field
                                type="text"
                                id="lastname"
                                name="lastname"
                                className="w-full p-2 border border-gray-300 rounded-lg"
                            />
                            <ErrorMessage name="lastname" component="div" className="text-red-600 text-sm" />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <Field
                                type="email"
                                id="email"
                                name="email"
                                className="w-full p-2 border border-gray-300 rounded-lg"
                            />
                            <ErrorMessage name="email" component="div" className="text-red-600 text-sm" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Change Password</h3>
                            <div>
                                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                                    Current Password
                                </label>
                                <Field
                                    type="password"
                                    id="currentPassword"
                                    name="currentPassword"
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                />
                                <ErrorMessage name="currentPassword" component="div" className="text-red-600 text-sm" />
                            </div>
                            <div>
                                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                                    New Password
                                </label>
                                <Field
                                    type="password"
                                    id="newPassword"
                                    name="newPassword"
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                />
                                <ErrorMessage name="newPassword" component="div" className="text-red-600 text-sm" />
                            </div>
                            <div>
                                <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700">
                                    Confirm New Password
                                </label>
                                <Field
                                    type="password"
                                    id="confirmNewPassword"
                                    name="confirmNewPassword"
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                />
                                <ErrorMessage name="confirmNewPassword" component="div" className="text-red-600 text-sm" />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </Form>
                )}
            </Formik>
        </Modal>
    );
};

export default AccountModal;
