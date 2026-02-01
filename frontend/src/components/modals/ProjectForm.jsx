import React from 'react';
import { ErrorMessage, Field } from 'formik';
import { FaChevronDown, FaProjectDiagram, FaTimes, FaCloudUploadAlt } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import AttachmentUploader from './AttachmentUploader';
import { SectionHeader, InputLabel, inputClass, selectClass } from './formHelpers';
import { getAvatarColor, getAvatarInitials } from '../../util/helpers';

/**
 * Project form fields component
 */
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
    return (
        <>
            {/* Left Column - Main Content */}
            <div className="flex-1 px-6 py-5 border-r border-slate-200 overflow-y-auto">
                {/* Project Name */}
                <div className="mb-6">
                    <InputLabel htmlFor="summary" required>Project Name</InputLabel>
                    <Field type="text" id="summary" name="summary" placeholder="Enter project name..." className={`${inputClass} text-base font-medium`} />
                    <ErrorMessage name="summary" component="div" className="text-red-500 text-xs mt-1.5 font-medium" />
                </div>

                {/* Description */}
                <div className="mb-6">
                    <InputLabel>Description</InputLabel>
                    <RichTextEditor
                        value={values.description || ''}
                        onChange={val => setFieldValue('description', val)}
                        placeholder="Describe the project..."
                        minHeight="200px"
                    />
                </div>

                {/* Attachments */}
                <div className="mb-6">
                    <SectionHeader icon={FaCloudUploadAlt} title="Attachments" />
                    <AttachmentUploader
                        existingAttachments={existingAttachments}
                        newAttachments={newAttachments}
                        onAddAttachments={onAddAttachments}
                        onRemoveAttachment={onRemoveAttachment}
                        inputId="attachment-upload-project"
                    />
                </div>
            </div>

            {/* Right Column - Form Fields */}
            <div className="w-[400px] px-6 py-5 overflow-y-auto bg-slate-50/50">
                <div className="space-y-5">
                    {/* Project Key */}
                    {modalMode === 'create' && (
                        <div>
                            <InputLabel htmlFor="projectKey" required>Project Key</InputLabel>
                            <Field type="text" id="projectKey" name="projectKey" maxLength="4" placeholder="e.g. PROJ" className={`${inputClass} uppercase font-mono tracking-wider`} />
                            <p className="text-xs text-slate-400 mt-1.5">Max 4 characters</p>
                            <ErrorMessage name="projectKey" component="div" className="text-red-500 text-xs mt-1.5 font-medium" />
                        </div>
                    )}

                    {/* Team Members */}
                    <div>
                        <InputLabel>Team Members</InputLabel>
                        {values.members?.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {values.members.map((m, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-slate-200 group hover:border-slate-300 transition-colors">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarColor(m)} flex items-center justify-center text-[10px] font-bold text-white`}>
                                                {getAvatarInitials(m)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-slate-800 truncate">{m.firstname ? `${m.firstname} ${m.lastname}` : m.email}</div>
                                                {m.firstname && <div className="text-[10px] text-slate-400 truncate">{m.email}</div>}
                                            </div>
                                        </div>
                                        {currentUser && (project?.owner ? currentUser.id === project.owner.id && m.id !== project.owner.id : true) && (
                                            <button type="button" onClick={() => setFieldValue('members', values.members.filter((_, idx) => idx !== i))} className="text-xs text-red-500 opacity-0 group-hover:opacity-100 font-medium transition-opacity">
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {currentUser && (
                            <div className="flex gap-2">
                                <Field type="email" name="newUserEmail" placeholder="Email address..." className={`${inputClass} flex-1`} />
                                <button type="button" onClick={() => onAddMember(values.newUserEmail, values, setFieldValue)} disabled={emailLoading} className="px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-sm font-semibold disabled:opacity-50">
                                    {emailLoading ? '...' : 'Add'}
                                </button>
                            </div>
                        )}
                        {emailError && <div className="text-red-500 text-xs mt-2 font-medium">{emailError}</div>}
                    </div>

                    {/* Project Dependencies */}
                    <div>
                        <InputLabel>Project Dependencies</InputLabel>
                        {dependencies.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {dependencies.map(depKey => {
                                    const depProject = projects.find(p => p.projectKey === depKey);
                                    return (
                                        <span key={depKey} className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold">
                                            <FaProjectDiagram className="text-[10px] text-slate-500" />
                                            {depProject?.projectKey || depKey}
                                            <button type="button" onClick={() => setDependencies(prev => prev.filter(d => d !== depKey))} className="text-slate-400 hover:text-red-500 transition-colors">
                                                <FaTimes className="text-[10px]" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        <div className="relative">
                            <select className={selectClass} onChange={e => { const key = e.target.value; if (key && !dependencies.includes(key)) setDependencies(prev => [...prev, key]); }} value="">
                                <option value="">Add dependency...</option>
                                {projects.filter(p => p.projectKey !== project?.projectKey).map(p => <option key={p.projectKey} value={p.projectKey}>{p.projectKey} — {p.summary}</option>)}
                            </select>
                            <FaChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProjectForm;
