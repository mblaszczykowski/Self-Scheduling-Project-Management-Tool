import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import EyeButton from '../common/EyeButton';
import FormField from '../common/FormField';
import { register, checkUserAuth } from '../../util/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../util/toast';
import { getErrorMessage } from '../../util/helpers';
import { PASSWORD_RULES, withPasswordComplexity } from './passwordRules';

interface RegisterValues {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
}

const validationSchema = Yup.object().shape({
    firstname: Yup.string()
        .min(2, 'First name must be at least 2 characters.')
        .max(50, 'Max length is 50.')
        .required('First name is required.'),
    lastname: Yup.string()
        .min(2, 'Last name must be at least 2 characters.')
        .max(50, 'Max length is 50.')
        .required('Last name is required.'),
    email: Yup.string()
        .email('Invalid email address format.')
        .required('Email is required.'),
    password: withPasswordComplexity(Yup.string()).required('Password is required.'),
});

const PasswordRequirements = ({ id, password }: { id: string; password: string }) => {
    const requirements = PASSWORD_RULES.map(rule => ({
        label: rule.label,
        met: rule.test(password),
    }));

    return (
        <div id={id} className="mt-2 p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Requirements</p>
            <div className="grid grid-cols-2 gap-0.5">
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

function RegisterForm({ onToggleForm }: { onToggleForm: () => void }) {
    const [showPassword, setShowPassword] = useState(false);
    const { setUser } = useAuth();
    const navigate = useNavigate();
    // Namespaced per instance so the login and register forms can coexist on one page
    // without their labels pointing at each other's inputs.
    const uid = useId();

    const handleSubmit = async (values: RegisterValues, { setSubmitting }: FormikHelpers<RegisterValues>) => {
        try {
            await register(values);
            const userData = await checkUserAuth();
            setUser(userData);
            navigate('/dashboard');
        } catch (err) {
            showToast(getErrorMessage(err, 'Registration failed.'));

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
                <Form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            id={`${uid}-firstname`}
                            name="firstname"
                            label="First name"
                            autoComplete="given-name"
                            hasError={!!(errors.firstname && touched.firstname)}
                            describedBy={errors.firstname && touched.firstname ? `${uid}-firstname-error` : undefined}
                            placeholder="First name"
                        />
                        <FormField
                            id={`${uid}-lastname`}
                            name="lastname"
                            label="Last name"
                            autoComplete="family-name"
                            hasError={!!(errors.lastname && touched.lastname)}
                            describedBy={errors.lastname && touched.lastname ? `${uid}-lastname-error` : undefined}
                            placeholder="Last name"
                        />
                    </div>

                    <FormField
                        id={`${uid}-email`}
                        name="email"
                        label="Email"
                        type="email"
                        autoComplete="email"
                        hasError={!!(errors.email && touched.email)}
                        describedBy={errors.email && touched.email ? `${uid}-email-error` : undefined}
                        placeholder="Email"
                    />

                    <div>
                        <FormField
                            id={`${uid}-password`}
                            name="password"
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            hasError={!!(errors.password && touched.password)}
                            describedBy={[
                                errors.password && touched.password ? `${uid}-password-error` : '',
                                `${uid}-password-requirements`,
                            ].filter(Boolean).join(' ')}
                            inputClassName="pr-12"
                            rightElement={<EyeButton showPassword={showPassword} setShowPassword={setShowPassword} />}
                            placeholder="Password"
                        />
                        <PasswordRequirements id={`${uid}-password-requirements`} password={values.password} />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm hover:shadow-md disabled:opacity-50"
                    >
                        {isSubmitting ? 'Creating account...' : 'Create account'}
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