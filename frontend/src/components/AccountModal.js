import React, { useState } from 'react';
import Modal from 'react-modal';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { updateUser } from '../util/api';
import { getImageUrl } from '../util/helpers';

Modal.setAppElement('#root');

const validationSchema = Yup.object().shape({
    firstname: Yup.string().required('First name is required'),
    lastname: Yup.string().required('Last name is required'),
    email: Yup.string().email('Invalid email').required('Email is required'),
    currentPassword: Yup.string(),
    newPassword: Yup.string().min(6, 'Password must be at least 6 characters'),
    confirmNewPassword: Yup.string().oneOf([Yup.ref('newPassword'), null], 'Passwords must match'),
});

const AccountModal = ({ user, onClose, onUpdateUser }) => {
    const [profilePreview, setProfilePreview] = useState(
        user.profilePicture ? getImageUrl(user.profilePicture) : null
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

    const handleSubmit = async (values, { setSubmitting, setErrors }) => {
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

        try {
            const updatedUser = await updateUser(formData);
            onUpdateUser?.(updatedUser);
            onClose();
        } catch (error) {
            console.error('Error updating user:', error);
            if (error.response?.data?.errors) {
                setErrors(error.response.data.errors);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleProfilePictureChange = (event, setFieldValue) => {
        const file = event.currentTarget.files[0];
        if (file) {
            setProfilePreview(URL.createObjectURL(file));
            setFieldValue('profilePicture', file);
        }
    };

    return (
        <Modal
            isOpen={true}
            onRequestClose={onClose}
            contentLabel="Account Settings"
            className="max-w-lg mx-auto mt-10 bg-white rounded-xl shadow-2xl outline-none z-50 max-h-[90vh] overflow-y-auto"
            overlayClassName="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
        >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900">Account Settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="p-6">
                <Formik
                    initialValues={initialValues}
                    validationSchema={validationSchema}
                    onSubmit={handleSubmit}
                >
                    {({ isSubmitting, setFieldValue }) => (
                        <Form className="space-y-5">
                            {/* Profile Picture */}
                            <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                {profilePreview ? (
                                    <img
                                        src={profilePreview}
                                        alt="Profile Preview"
                                        className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-lg"
                                    />
                                ) : (
                                    <div className="h-20 w-20 bg-slate-200 rounded-full flex items-center justify-center ring-4 ring-white shadow-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5S7 4.24 7 7s2.24 5 5 5zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" />
                                        </svg>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <label className="block">
                                        <span className="text-sm font-medium text-slate-700 mb-1 block">Profile Photo</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleProfilePictureChange(e, setFieldValue)}
                                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4
                                            file:rounded-lg file:border-0 file:text-sm file:font-medium
                                            file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer file:transition-all"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Name Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="firstname" className="block text-sm font-medium text-slate-700 mb-1.5">
                                        First Name
                                    </label>
                                    <Field
                                        type="text"
                                        id="firstname"
                                        name="firstname"
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
                                    />
                                    <ErrorMessage name="firstname" component="div" className="text-red-500 text-xs mt-1" />
                                </div>
                                <div>
                                    <label htmlFor="lastname" className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Last Name
                                    </label>
                                    <Field
                                        type="text"
                                        id="lastname"
                                        name="lastname"
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
                                    />
                                    <ErrorMessage name="lastname" component="div" className="text-red-500 text-xs mt-1" />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Email
                                </label>
                                <Field
                                    type="email"
                                    id="email"
                                    name="email"
                                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
                                />
                                <ErrorMessage name="email" component="div" className="text-red-500 text-xs mt-1" />
                            </div>

                            {/* Password Section */}
                            <div className="pt-4 border-t border-slate-200">
                                <h3 className="text-sm font-semibold text-slate-800 mb-4">Change Password</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Current Password
                                        </label>
                                        <Field
                                            type="password"
                                            id="currentPassword"
                                            name="currentPassword"
                                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
                                        />
                                        <ErrorMessage name="currentPassword" component="div" className="text-red-500 text-xs mt-1" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
                                                New Password
                                            </label>
                                            <Field
                                                type="password"
                                                id="newPassword"
                                                name="newPassword"
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
                                            />
                                            <ErrorMessage name="newPassword" component="div" className="text-red-500 text-xs mt-1" />
                                        </div>
                                        <div>
                                            <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
                                                Confirm Password
                                            </label>
                                            <Field
                                                type="password"
                                                id="confirmNewPassword"
                                                name="confirmNewPassword"
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-colors"
                                            />
                                            <ErrorMessage name="confirmNewPassword" component="div" className="text-red-500 text-xs mt-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </Form>
                    )}
                </Formik>
            </div>
        </Modal>
    );
};

export default AccountModal;