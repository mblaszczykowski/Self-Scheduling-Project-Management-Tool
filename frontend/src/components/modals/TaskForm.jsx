import React from 'react';
import { ErrorMessage, Field } from 'formik';
import { FaChevronDown, FaLink, FaTimes, FaCloudUploadAlt } from 'react-icons/fa';
import RichTextEditor from '../common/RichTextEditor';
import AttachmentUploader from './AttachmentUploader';
import Comments from '../comments/Comments';
import { SectionHeader, InputLabel, inputClass, inputDisabledClass, selectClass } from './formHelpers';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../util/helpers';

/**
 * Task form fields component
 */
const TaskForm = ({
    values,
    setFieldValue,
    handleChange,
    modalMode,
    task,
    project,
    projects,
    currentUser,
    dependencies,
    setDependencies,
    existingAttachments,
    newAttachments,
    onAddAttachments,
    onRemoveAttachment
}) => {
    // Get all tasks for dependency selection
    const allTasks = projects.flatMap(p => p.tasks || []);

    return (
        <>
            {/* Left Column - Main Content */}
            <div className="flex-1 px-6 py-5 border-r border-slate-200 overflow-y-auto">
                {/* Task Summary */}
                <div className="mb-6">
                    <InputLabel htmlFor="summary" required>Task Summary</InputLabel>
                    <Field type="text" id="summary" name="summary" placeholder="What needs to be done?" className={`${inputClass} text-base font-medium`} />
                    <ErrorMessage name="summary" component="div" className="text-red-500 text-xs mt-1.5 font-medium" />
                </div>

                {/* Description */}
                <div className="mb-6">
                    <InputLabel>Description</InputLabel>
                    <RichTextEditor
                        value={values.description || ''}
                        onChange={val => setFieldValue('description', val)}
                        placeholder="Add details about this task..."
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
                        inputId="attachment-upload-task"
                    />
                </div>

                {/* Comments Section */}
                {modalMode === 'edit' && task && currentUser && (
                    <div className="pt-6 border-t border-slate-200">
                        <Comments taskId={task.id} currentUserId={currentUser.id} />
                    </div>
                )}
            </div>

            {/* Right Column - Form Fields */}
            <div className="w-[400px] px-6 py-5 overflow-y-auto bg-slate-50/50">
                <div className="space-y-5">
                    {/* Project Selection */}
                    <div>
                        <InputLabel htmlFor="projectKey" required>Project</InputLabel>
                        <div className="relative">
                            <Field as="select" id="projectKey" name="projectKey" disabled={modalMode === 'edit'} className={`${selectClass} ${modalMode === 'edit' ? inputDisabledClass : ''}`}>
                                <option value="">Select project...</option>
                                {projects.map(p => <option key={p.projectKey} value={p.projectKey}>{p.summary} ({p.projectKey})</option>)}
                            </Field>
                            <FaChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                        </div>
                        <ErrorMessage name="projectKey" component="div" className="text-red-500 text-xs mt-1.5 font-medium" />
                    </div>

                    {/* Status & Priority */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <InputLabel htmlFor="status">Status</InputLabel>
                            <div className="relative">
                                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[values.status]?.dot || 'bg-slate-400'} ring-2 ring-white shadow-sm`} />
                                <Field as="select" id="status" name="status" className={`${selectClass} pl-9`}>
                                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                                </Field>
                                <FaChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <InputLabel htmlFor="priority">Priority</InputLabel>
                            <div className="relative">
                                <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold ${PRIORITY_CONFIG[values.priority]?.color?.replace('bg-', 'text-').replace('-50', '-600') || 'text-slate-400'}`}>
                                    {PRIORITY_CONFIG[values.priority]?.icon || '—'}
                                </span>
                                <Field as="select" id="priority" name="priority" className={`${selectClass} pl-9`}>
                                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                                </Field>
                                <FaChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Assignment */}
                    <div>
                        <InputLabel htmlFor="assignee">Assignee</InputLabel>
                        <div className="relative">
                            <Field as="select" id="assignee" name="assignee" className={selectClass}>
                                <option value="">Unassigned</option>
                                {project?.members?.map(u => <option key={u.id} value={u.email}>{u.firstname} {u.lastname}</option>)}
                            </Field>
                            <FaChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                        </div>
                    </div>

                    {/* Reporter */}
                    <div>
                        <InputLabel htmlFor="reporter">Reporter</InputLabel>
                        <Field type="text" id="reporter" name="reporter" disabled className={`${inputClass} ${inputDisabledClass}`} />
                    </div>

                    {/* Dates */}
                    <div className="space-y-3">
                        <div>
                            <InputLabel htmlFor="startDate" required>Start Date</InputLabel>
                            <Field type="date" id="startDate" name="startDate" className={inputClass} onChange={(e) => {
                                handleChange(e);
                                if (e.target.value && values.dueDate) {
                                    const diff = Math.floor((new Date(values.dueDate) - new Date(e.target.value)) / 86400000) + 1;
                                    setFieldValue('duration', Math.max(diff, 1));
                                }
                            }} />
                            <ErrorMessage name="startDate" component="div" className="text-red-500 text-xs mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="dueDate" required>Due Date</InputLabel>
                            <Field type="date" id="dueDate" name="dueDate" className={inputClass} onChange={(e) => {
                                handleChange(e);
                                if (values.startDate && e.target.value) {
                                    const diff = Math.floor((new Date(e.target.value) - new Date(values.startDate)) / 86400000) + 1;
                                    setFieldValue('duration', Math.max(diff, 1));
                                }
                            }} />
                            <ErrorMessage name="dueDate" component="div" className="text-red-500 text-xs mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="duration">Duration (Days)</InputLabel>
                            <Field type="number" id="duration" name="duration" min="1" className={inputClass} onChange={(e) => {
                                const dur = Math.max(1, parseInt(e.target.value, 10) || 1);
                                setFieldValue('duration', dur);
                                if (values.startDate) {
                                    const newDue = new Date(new Date(values.startDate).getTime() + (dur - 1) * 86400000);
                                    setFieldValue('dueDate', newDue.toISOString().split('T')[0]);
                                }
                            }} />
                        </div>
                    </div>

                    {/* Progress */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <InputLabel htmlFor="progress">Progress</InputLabel>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${values.progress === 100 ? 'bg-green-100 text-green-700' : values.progress > 0 ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-600'}`}>
                                {values.progress}%
                            </span>
                        </div>
                        <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${values.progress === 100 ? 'bg-green-500' : 'bg-slate-900'}`} style={{ width: `${values.progress}%` }} />
                            <Field type="range" id="progress" name="progress" min="0" max="100" className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                        </div>
                    </div>

                    {/* Labels */}
                    <div>
                        <InputLabel htmlFor="labels">Labels</InputLabel>
                        <Field type="text" id="labels" name="labels" placeholder="space-separated labels" className={inputClass} />
                    </div>

                    {/* Dependencies */}
                    <div>
                        <InputLabel>Dependencies</InputLabel>
                        {dependencies.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {dependencies.map(depId => {
                                    const depTask = allTasks.find(t => t.id === depId);
                                    return (
                                        <span key={depId} className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold">
                                            <FaLink className="text-[10px] text-slate-500" />
                                            {depTask?.taskKey || `#${depId}`}
                                            <button type="button" onClick={() => setDependencies(prev => prev.filter(id => id !== depId))} className="text-slate-400 hover:text-red-500 transition-colors">
                                                <FaTimes className="text-[10px]" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        <div className="relative">
                            <select className={selectClass} onChange={e => { const id = parseInt(e.target.value, 10); if (id && !dependencies.includes(id)) setDependencies(prev => [...prev, id]); }} value="">
                                <option value="">Add dependency...</option>
                                {allTasks.filter(t => t.id !== task?.id).map(t => <option key={t.id} value={t.id}>{t.taskKey} — {t.summary}</option>)}
                            </select>
                            <FaChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                        </div>
                    </div>

                    {modalMode === 'edit' && (
                        <div className="flex flex-col gap-1 text-xs text-slate-400 pt-4 border-t border-slate-200">
                            <span>Created: {values.created || 'N/A'}</span>
                            <span>Updated: {values.updated || 'N/A'}</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default TaskForm;
