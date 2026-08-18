import React from 'react';
import { ErrorMessage, Field } from 'formik';
import { authInputClass } from './formHelpers';

interface FormFieldProps {
    id: string;
    name: string;
    label: string;
    hasError: boolean;
    type?: string;
    autoComplete?: string;
    placeholder?: string;
    describedBy?: string;
    inputClassName?: string;
    rightElement?: React.ReactNode;
}

const FormField = ({
    id,
    name,
    label,
    hasError,
    type = 'text',
    autoComplete,
    placeholder,
    describedBy,
    inputClassName = '',
    rightElement,
}: FormFieldProps) => (
    <div>
        <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1.5">
            {label}
        </label>
        <div className={rightElement ? 'relative' : undefined}>
            <Field
                id={id}
                type={type}
                name={name}
                autoComplete={autoComplete}
                aria-invalid={hasError}
                aria-describedby={describedBy || undefined}
                className={`${authInputClass(hasError)}${inputClassName ? ` ${inputClassName}` : ''}`}
                placeholder={placeholder}
            />
            {rightElement}
        </div>
        <ErrorMessage name={name} component="span" id={`${id}-error`} className="text-red-500 text-xs mt-1 block" />
    </div>
);

export default FormField;
