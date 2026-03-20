import React from 'react';
import { ErrorMessage, Field } from 'formik';
import {
    HiOutlineChevronDown, HiOutlineFolder,
    HiOutlineX, HiOutlineCloudUpload,
} from 'react-icons/hi';
import RichTextEditor from '../common/RichTextEditor';
import AttachmentUploader from './AttachmentUploader';
import {
    SectionHeader, InputLabel, inputClass, selectClass,
} from '../common/formHelpers';
import Avatar from '../common/Avatar';

const ProjectForm = ({
    values,
    setFieldValue,
    modalMode,
    project,
    projects,
    currentUser,
    dependencies,
    setDependencies,
    existingAttachments,
    newAttachments,
    onAddAttachments,
    onRemoveAttachment,
    onAddMember,
    emailLoading,
    emailError
}) => {
    const isOwner = modalMode === 'create'
        || (currentUser && project?.owner?.id === currentUser.id);

    return (
        <>
            <div className="flex-1 px-6 py-5 border-r border-slate-200 overflow-y-auto">
                <div className="mb-6">
                    <InputLabel htmlFor="summary" required>
                        Project Name
                    </InputLabel>
                    <Field
                        type="text"
                        id="summary"
                        name="summary"
                        maxLength={200}
                        placeholder="Enter project name..."
                        className={`${inputClass} text-base font-medium`}
                    />
                    <div className="flex justify-between mt-1.5">
                        <ErrorMessage
                            name="summary"
                            component="div"
                            className="text-red-500 text-xs font-medium"
                        />
                        <span className={`text-xs ${values.summary?.length > 180 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {values.summary?.length || 0}/200
                        </span>
                    </div>
                </div>

                <div className="mb-6">
                    <InputLabel>Description</InputLabel>
                    <RichTextEditor
                        value={values.description || ''}
                        onChange={val => setFieldValue('description', val)}
                        placeholder="Describe the project..."
                        minHeight="200px"
                    />
                </div>

                <div className="mb-6">
                    <SectionHeader icon={HiOutlineCloudUpload} title="Attachments" />
                    <AttachmentUploader
                        existingAttachments={existingAttachments}
                        newAttachments={newAttachments}
                        onAddAttachments={onAddAttachments}
                        onRemoveAttachment={onRemoveAttachment}
                        inputId="attachment-upload-project"
                    />
                </div>
            </div>

            <div className="w-full md:w-[400px] shrink-0 px-6 py-5 overflow-y-auto bg-slate-50/50">
                <div className="space-y-5">
                    {modalMode === 'create' && (
                        <div>
                            <InputLabel htmlFor="projectKey" required>
                                Project Key
                            </InputLabel>
                            <Field
                                type="text"
                                id="projectKey"
                                name="projectKey"
                                maxLength="4"
                                placeholder="e.g. PROJ"
                                className={
                                    `${inputClass} uppercase font-mono tracking-wider`
                                }
                            />
                            <p className="text-xs text-slate-400 mt-1.5">
                                Max 4 characters
                            </p>
                            <ErrorMessage
                                name="projectKey"
                                component="div"
                                className="text-red-500 text-xs mt-1.5 font-medium"
                            />
                        </div>
                    )}

                    <div>
                        <InputLabel>Team Members</InputLabel>
                        {values.members?.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {values.members.map((m, i) => {
                                    const isMemberOwner =
                                        project?.owner?.id === m.id;
                                    return (
                                        <div
                                            key={m.id || m.email || i}
                                            className={
                                                'flex items-center justify-between py-2 px-3'
                                                + ' bg-white rounded-lg border border-slate-200'
                                                + ' group hover:border-slate-300 transition-colors'
                                            }
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Avatar user={m} size="sm" className="rounded-lg" />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-slate-800 truncate">
                                                        {m.firstname
                                                            ? `${m.firstname} ${m.lastname}`
                                                            : m.email}
                                                        {isMemberOwner && (
                                                            <span className="ml-1.5 text-[10px] text-slate-400">
                                                                (Owner)
                                                            </span>
                                                        )}
                                                    </div>
                                                    {m.firstname && (
                                                        <div className="text-[10px] text-slate-400 truncate">
                                                            {m.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {isOwner && !isMemberOwner && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFieldValue(
                                                        'members',
                                                        values.members.filter(
                                                            (_, idx) => idx !== i
                                                        ),
                                                    )}
                                                    className={
                                                        'text-xs text-red-500 opacity-0'
                                                        + ' group-hover:opacity-100 font-medium'
                                                        + ' transition-opacity'
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
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
                                    disabled={emailLoading}
                                    className={
                                        'px-4 py-2.5 bg-slate-900 text-white rounded-lg'
                                        + ' hover:bg-slate-800 transition-all text-sm'
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

                    <div>
                        <InputLabel>Project Dependencies</InputLabel>
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
                                                + ' bg-white border border-slate-200'
                                                + ' text-slate-700 rounded-lg text-xs font-semibold'
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
