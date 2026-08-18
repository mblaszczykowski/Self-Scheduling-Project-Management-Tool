import React from 'react';
import { ErrorMessage, Field, FormikHelpers } from 'formik';
import {
    HiOutlineChevronDown, HiOutlineFolder, HiOutlineX,
} from 'react-icons/hi';
import EntityMainColumn from './EntityMainColumn';
import { inputClass, selectClass } from '../common/formHelpers';
import Avatar from '../common/Avatar';
import { Project, User, ModalFormValues, Attachment } from '../../types';

type SetFieldValue = FormikHelpers<ModalFormValues>['setFieldValue'];

interface ProjectFormProps {
    values: ModalFormValues;
    setFieldValue: SetFieldValue;
    modalMode: 'create' | 'edit';
    project?: Project | null;
    projects: Project[];
    entityKey?: string | null;
    currentUser: User | null;
    dependencies: string[];
    setDependencies: React.Dispatch<React.SetStateAction<string[]>>;
    existingAttachments: string[];
    newAttachments: File[];
    onAddAttachments: (files: File[]) => void;
    onRemoveAttachment: (attachment: Attachment) => void;
    onAddMember: (email: string, values: ModalFormValues, setFieldValue: SetFieldValue) => void;
    emailError: string;
}

const ProjectForm = ({
    values,
    setFieldValue,
    modalMode,
    project,
    projects,
    entityKey,
    currentUser,
    dependencies,
    setDependencies,
    existingAttachments,
    newAttachments,
    onAddAttachments,
    onRemoveAttachment,
    onAddMember,
    emailError
}: ProjectFormProps) => {
    const isOwner = modalMode === 'create'
        || (currentUser && project?.owner?.id === currentUser.id);

    return (
        <>
            <div className="flex-1 px-6 py-5 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
                <EntityMainColumn
                    values={values}
                    setFieldValue={setFieldValue}
                    entityKey={entityKey}
                    namePlaceholder="Project name"
                    descPlaceholder="Describe the project..."
                    attachmentInputId="attachment-upload-project"
                    existingAttachments={existingAttachments}
                    newAttachments={newAttachments}
                    onAddAttachments={onAddAttachments}
                    onRemoveAttachment={onRemoveAttachment}
                />
            </div>

            <div className="w-full md:w-[400px] shrink-0 px-5 py-5 overflow-y-auto bg-slate-50/50 dark:bg-slate-800/20">
                <div className="space-y-5">
                    {modalMode === 'create' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <label htmlFor="projectKey" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                Project Key <span className="text-red-400">*</span>
                            </label>
                            <Field
                                type="text"
                                id="projectKey"
                                name="projectKey"
                                maxLength={10}
                                placeholder="e.g. PROJ"
                                className={
                                    `${inputClass} uppercase font-mono tracking-wider`
                                }
                            />
                            <p className="text-xs text-slate-400 mt-1.5">
                                Max 10 characters
                            </p>
                            <ErrorMessage
                                name="projectKey"
                                component="div"
                                className="text-red-500 text-xs mt-1.5 font-medium"
                            />
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Team Members</label>
                        {values.memberEmails.length > 0 && (
                            <ul className="space-y-2 mb-3">
                                {values.memberEmails.map((email) => {
                                    // The form carries addresses (that is all the server reads);
                                    // names come from the loaded project when it has them.
                                    const known = project?.members.find(
                                        (candidate) => candidate.email === email,
                                    );
                                    const isMemberOwner = project?.owner?.email === email;
                                    return (
                                        <li
                                            key={email}
                                            className={
                                                'flex items-center justify-between py-2 px-3'
                                                + ' bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700'
                                                + ' group hover:border-slate-300 dark:hover:border-slate-600 transition-colors'
                                            }
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Avatar user={known} size="sm" className="rounded-lg" />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                                        {known ? `${known.firstname} ${known.lastname}` : email}
                                                        {isMemberOwner && (
                                                            <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                                                                (Owner)
                                                            </span>
                                                        )}
                                                    </div>
                                                    {known && (
                                                        <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                                                            {email}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {isOwner && !isMemberOwner && (
                                                <button
                                                    type="button"
                                                    aria-label={`Remove ${known ? `${known.firstname} ${known.lastname}` : email}`}
                                                    onClick={() => setFieldValue(
                                                        'memberEmails',
                                                        values.memberEmails.filter(
                                                            (candidate) => candidate !== email,
                                                        ),
                                                    )}
                                                    className={
                                                        'text-xs text-red-500 dark:text-red-400 opacity-0'
                                                        + ' group-hover:opacity-100 focus-visible:opacity-100 font-medium'
                                                        + ' transition-opacity'
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {isOwner && (
                            <div className="flex gap-2">
                                <Field
                                    type="email"
                                    name="newUserEmail"
                                    placeholder="Email address..."
                                    className={`${inputClass} flex-1`}
                                />
                                <button
                                    type="button"
                                    onClick={() => onAddMember(
                                        values.newUserEmail, values, setFieldValue,
                                    )}
                                    className={
                                        'px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg'
                                        + ' hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors text-sm'
                                        + ' font-semibold disabled:opacity-50'
                                    }
                                >
                                    Add
                                </button>
                            </div>
                        )}
                        {emailError && (
                            <div className="text-red-500 text-xs mt-2 font-medium">
                                {emailError}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Dependencies</label>
                        {dependencies.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {dependencies.map(depKey => {
                                    const depProject = projects.find(
                                        p => p.projectKey === depKey,
                                    );
                                    return (
                                        <span
                                            key={depKey}
                                            className={
                                                'inline-flex items-center gap-2 px-2.5 py-1'
                                                + ' bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
                                                + ' text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold'
                                            }
                                        >
                                            <HiOutlineFolder className="w-3 h-3 text-slate-500" />
                                            {depProject?.projectKey || depKey}
                                            <button
                                                type="button"
                                                onClick={() => setDependencies(
                                                    prev => prev.filter(d => d !== depKey),
                                                )}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <HiOutlineX className="w-3 h-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        <div className="relative">
                            <select
                                className={selectClass}
                                onChange={e => {
                                    const key = e.target.value;
                                    if (key && !dependencies.includes(key)) {
                                        setDependencies(prev => [...prev, key]);
                                    }
                                }}
                                value=""
                            >
                                <option value="">Add dependency...</option>
                                {projects
                                    .filter(p => p.projectKey !== project?.projectKey)
                                    .map(p => (
                                        <option key={p.projectKey} value={p.projectKey}>
                                            {p.projectKey} — {p.summary}
                                        </option>
                                    ))}
                            </select>
                            <HiOutlineChevronDown
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProjectForm;
