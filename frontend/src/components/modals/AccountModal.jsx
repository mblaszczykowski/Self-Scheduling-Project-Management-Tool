import React, { useState } from 'react';
import { useAnimateIn } from '../../hooks/useAnimateIn';
import Modal from 'react-modal';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { updateUser, updateEmailPreferences } from '../../util/api';
import { getImageUrl, getErrorMessage } from '../../util/helpers';
import { showToast } from '../../util/toast';
import Avatar from '../common/Avatar';
import { CloseIcon } from '../common/Icons';
import { inputClass } from '../common/formHelpers';

// Empty password fields must be treated as "no change", not as an 8-char
// violation (Yup's .min runs on '' too). Transform '' -> undefined so a user
// editing only their name/email/avatar can still submit.
const emptyToUndefined = (value) => (value === '' ? undefined : value);

const validationSchema = Yup.object().shape({
    firstname: Yup.string().required('First name is required'),
    lastname: Yup.string().required('Last name is required'),
    email: Yup.string().email('Invalid email').required('Email is required'),
    newPassword: Yup.string()
        .transform(emptyToUndefined)
        .min(8, 'Password must be at least 8 characters'),
    currentPassword: Yup.string()
        .transform(emptyToUndefined)
        .when('newPassword', {
            is: (v) => !!v,
            then: (schema) => schema.required('Enter your current password to set a new one'),
        }),
    confirmNewPassword: Yup.string()
        .transform(emptyToUndefined)
        .oneOf([Yup.ref('newPassword'), undefined], 'Passwords must match'),
});

const EmailToggle = ({ label, description, checked, onChange, disabled }) => (
    <label className={`flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
        <div className="flex-1 mr-3">
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
            {description && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>}
        </div>
        <div className="relative inline-flex items-center">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 dark:bg-slate-600 peer-checked:bg-slate-900 dark:peer-checked:bg-white rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white dark:after:bg-slate-900 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </div>
    </label>
);

const AccountModal = ({ user, onClose, onUpdateUser }) => {
    const [profilePreview, setProfilePreview] = useState(
        user.profilePicture ? getImageUrl(user.profilePicture) : null
    );
    const [isVisible, setIsVisible] = useAnimateIn();
    const [emailPrefs, setEmailPrefs] = useState({
        emailNotificationsEnabled: user.emailNotificationsEnabled ?? true,
        emailOnTaskAssigned: user.emailOnTaskAssigned ?? true,
        emailOnCommentReply: user.emailOnCommentReply ?? true,
        emailOnProjectInvitation: user.emailOnProjectInvitation ?? true,
    });
    const [emailPrefsSaving, setEmailPrefsSaving] = useState(false);

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
            showToast('Account updated', 'success');
            handleClose();
        } catch (err) {
            console.error('Error updating user:', err);
            if (err.response?.data?.errors) {
                setErrors(err.response.data.errors);
            } else {
                showToast(getErrorMessage(err, 'Failed to update account'), 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleEmailPrefToggle = async (key) => {
        const updated = { ...emailPrefs, [key]: !emailPrefs[key] };
        setEmailPrefs(updated);
        setEmailPrefsSaving(true);
        try {
            const updatedUser = await updateEmailPreferences(updated);
            onUpdateUser?.(updatedUser);
        } catch (err) {
            setEmailPrefs(emailPrefs);
            console.error('Error updating email preferences:', err);
        } finally {
            setEmailPrefsSaving(false);
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
                'max-w-lg mx-auto mt-10 bg-white dark:bg-slate-900 rounded-xl shadow-2xl outline-none'
                + ' z-[70] max-h-[90vh] overflow-y-auto transition-all duration-300 '
                + (isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0')
            }
            overlayClassName={
                'fixed inset-0 bg-black/50 flex items-center justify-center'
                + ' z-[60] transition-opacity duration-300 '
                + (isVisible ? 'opacity-100' : 'opacity-0')
            }
        >
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 rounded-t-xl">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Account Settings</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Close"
                    >
                        <CloseIcon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
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
                            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                                <Avatar
                                    user={user}
                                    profilePicture={profilePreview}
                                    size="lg"
                                    className="ring-4 ring-white dark:ring-slate-800 shadow-lg"
                                />
                                <div className="flex-1">
                                    <label className="block">
                                        <span
                                            className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block"
                                        >
                                            Profile Photo
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleProfilePictureChange(e, setFieldValue)}
                                            className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4
                                            file:rounded-lg file:border-0 file:text-sm file:font-medium
                                            file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer file:transition-all"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="firstname" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
                                    <label htmlFor="lastname" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
                                <label htmlFor="email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Change Password</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="currentPassword" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
                                            <label htmlFor="newPassword" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
                                            <label htmlFor="confirmNewPassword" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Email Notifications</h3>
                                <div className="space-y-3">
                                    <EmailToggle
                                        label="Email notifications enabled"
                                        description="Master toggle for all email notifications"
                                        checked={emailPrefs.emailNotificationsEnabled}
                                        onChange={() => handleEmailPrefToggle('emailNotificationsEnabled')}
                                        disabled={emailPrefsSaving}
                                    />
                                    <EmailToggle
                                        label="Task assignments & updates"
                                        description="Get notified when you are assigned to or a task changes"
                                        checked={emailPrefs.emailOnTaskAssigned}
                                        onChange={() => handleEmailPrefToggle('emailOnTaskAssigned')}
                                        disabled={emailPrefsSaving || !emailPrefs.emailNotificationsEnabled}
                                    />
                                    <EmailToggle
                                        label="Comment replies & reactions"
                                        description="Get notified about replies and reactions to your comments"
                                        checked={emailPrefs.emailOnCommentReply}
                                        onChange={() => handleEmailPrefToggle('emailOnCommentReply')}
                                        disabled={emailPrefsSaving || !emailPrefs.emailNotificationsEnabled}
                                    />
                                    <EmailToggle
                                        label="Project invitations & updates"
                                        description="Get notified about project invitations and changes"
                                        checked={emailPrefs.emailOnProjectInvitation}
                                        onChange={() => handleEmailPrefToggle('emailOnProjectInvitation')}
                                        disabled={emailPrefsSaving || !emailPrefs.emailNotificationsEnabled}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
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