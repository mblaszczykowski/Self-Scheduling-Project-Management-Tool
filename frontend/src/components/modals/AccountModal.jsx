import React, { useState } from 'react';
import { useAnimateIn } from '../../hooks/useAnimateIn';
import Modal from 'react-modal';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { updateUser } from '../../util/api';
import { getImageUrl } from '../../util/helpers';
import Avatar from '../common/Avatar';
import { CloseIcon } from '../common/Icons';
import { inputClass } from '../common/formHelpers';

const validationSchema = Yup.object().shape({
    firstname: Yup.string().required('First name is required'),
    lastname: Yup.string().required('Last name is required'),
    email: Yup.string().email('Invalid email').required('Email is required'),
    currentPassword: Yup.string(),
    newPassword: Yup.string().min(8, 'Password must be at least 8 characters'),
    confirmNewPassword: Yup.string().oneOf([Yup.ref('newPassword'), null], 'Passwords must match'),
});

const AccountModal = ({ user, onClose, onUpdateUser }) => {
    const [profilePreview, setProfilePreview] = useState(
        user.profilePicture ? getImageUrl(user.profilePicture) : null
    );
    const [isVisible, setIsVisible] = useAnimateIn();

    const handleClose = React.useCallback(() => {
        setIsVisible(false);
        setTimeout(onClose, 200);
    }, [onClose, setIsVisible]);

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
            handleClose();
        } catch (err) {
            console.error('Error updating user:', err);
            if (err.response?.data?.errors) {
                setErrors(err.response.data.errors);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleProfilePictureChange = (event, setFieldValue) => {
        const file = event.currentTarget.files[0];
        if (file) {
            if (profilePreview && profilePreview.startsWith('blob:')) {
                URL.revokeObjectURL(profilePreview);
            }
            setProfilePreview(URL.createObjectURL(file));
            setFieldValue('profilePicture', file);
        }
    };

    const profilePreviewRef = React.useRef(profilePreview);
    profilePreviewRef.current = profilePreview;

    React.useEffect(() => {
        return () => {
            if (profilePreviewRef.current && profilePreviewRef.current.startsWith('blob:')) {
                URL.revokeObjectURL(profilePreviewRef.current);
            }
        };
    }, []);

    return (
        <Modal
            isOpen={true}
            onRequestClose={handleClose}
            contentLabel="Account Settings"
            className={
                'max-w-lg mx-auto mt-10 bg-white rounded-xl shadow-2xl outline-none'
                + ' z-[70] max-h-[90vh] overflow-y-auto transition-all duration-300 '
                + (isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0')
            }
            overlayClassName={
                'fixed inset-0 bg-black/50 flex items-center justify-center'
                + ' z-[60] transition-opacity duration-300 '
                + (isVisible ? 'opacity-100' : 'opacity-0')
            }
        >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-900">Account Settings</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Close"
                    >
                        <CloseIcon className="h-5 w-5 text-slate-500" />
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
                            <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <Avatar
                                    user={user}
                                    profilePicture={profilePreview}
                                    size="lg"
                                    className="ring-4 ring-white shadow-lg"
                                />
                                <div className="flex-1">
                                    <label className="block">
                                        <span
                                            className="text-xs font-medium text-slate-700 mb-1 block"
                                        >
                                            Profile Photo
                                        </span>
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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="firstname" className="block text-xs font-medium text-slate-700 mb-1.5">
                                        First Name
                                    </label>
                                    <Field
                                        type="text"
                                        id="firstname"
                                        name="firstname"
                                        className={inputClass}
                                    />
                                    <ErrorMessage name="firstname" component="div" className="text-red-500 text-xs mt-1" />
                                </div>
                                <div>
                                    <label htmlFor="lastname" className="block text-xs font-medium text-slate-700 mb-1.5">
                                        Last Name
                                    </label>
                                    <Field
                                        type="text"
                                        id="lastname"
                                        name="lastname"
                                        className={inputClass}
                                    />
                                    <ErrorMessage name="lastname" component="div" className="text-red-500 text-xs mt-1" />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
                                    Email
                                </label>
                                <Field
                                    type="email"
                                    id="email"
                                    name="email"
                                    className={inputClass}
                                />
                                <ErrorMessage name="email" component="div" className="text-red-500 text-xs mt-1" />
                            </div>

                            <div className="pt-4 border-t border-slate-200">
                                <h3 className="text-sm font-semibold text-slate-900 mb-4">Change Password</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="currentPassword" className="block text-xs font-medium text-slate-700 mb-1.5">
                                            Current Password
                                        </label>
                                        <Field
                                            type="password"
                                            id="currentPassword"
                                            name="currentPassword"
                                            className={inputClass}
                                        />
                                        <ErrorMessage name="currentPassword" component="div" className="text-red-500 text-xs mt-1" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="newPassword" className="block text-xs font-medium text-slate-700 mb-1.5">
                                                New Password
                                            </label>
                                            <Field
                                                type="password"
                                                id="newPassword"
                                                name="newPassword"
                                                className={inputClass}
                                            />
                                            <ErrorMessage name="newPassword" component="div" className="text-red-500 text-xs mt-1" />
                                        </div>
                                        <div>
                                            <label htmlFor="confirmNewPassword" className="block text-xs font-medium text-slate-700 mb-1.5">
                                                Confirm Password
                                            </label>
                                            <Field
                                                type="password"
                                                id="confirmNewPassword"
                                                name="confirmNewPassword"
                                                className={inputClass}
                                            />
                                            <ErrorMessage name="confirmNewPassword" component="div" className="text-red-500 text-xs mt-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-sm font-medium disabled:opacity-50"
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