import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { DataContext } from '../context/DataContext';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import Comments from './Comments';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { FaDownload, FaFileAlt, FaFilePdf, FaPlus, FaTimes, FaLink, FaProjectDiagram, FaCloudUploadAlt, FaTrashAlt, FaSave, FaChevronDown, FaCalendarAlt, FaUser, FaTags, FaLayerGroup } from 'react-icons/fa';
import { getUserByEmail } from '../util/api';
import { getImageUrl, getFileInfo, formatDateTime, formatDate, getStatusConfig, getPriorityConfig, getAvatarColor } from '../util/helpers';

const STATUS_CONFIG = getStatusConfig();
const PRIORITY_CONFIG = getPriorityConfig();

const quillModules = {
    toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
    ],
};

// Reusable form components
const SectionHeader = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-slate-200">
        <div className="w-5 h-5 rounded-md bg-slate-900 flex items-center justify-center">
            <Icon className="text-white text-[10px]" />
        </div>
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</span>
    </div>
);

const InputLabel = ({ htmlFor, children, required }) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1.5">
        {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
);

const inputClass = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all hover:border-slate-300";
const inputDisabledClass = "bg-slate-50 text-slate-500 cursor-not-allowed hover:border-slate-200";
const selectClass = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-all cursor-pointer appearance-none hover:border-slate-300";

// Preview Modal
const PreviewModal = ({ preview, onClose }) => {
    if (!preview) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[60]" onClick={onClose}>
            <div className="relative bg-white rounded-xl shadow-2xl max-w-[90vw] max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
                    <h3 className="text-sm font-semibold text-slate-900 truncate max-w-md">{preview.fileName}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <FaTimes className="text-slate-500" />
                    </button>
                </div>
                <div className="p-5 bg-slate-50">
                    {preview.fileType === 'image' ? (
                        <img src={preview.url} alt={preview.fileName} className="max-h-[70vh] max-w-full rounded-lg shadow-lg" />
                    ) : (
                        <iframe src={preview.url} title={preview.fileName} className="w-[80vw] h-[70vh] rounded-lg border border-slate-200" />
                    )}
                </div>
                <div className="px-5 py-4 border-t border-slate-200 flex justify-end bg-white">
                    <a href={preview.url} download={preview.fileName} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold">
                        <FaDownload className="text-xs" /> Download
                    </a>
                </div>
            </div>
        </div>
    );
};

const TaskProjectModal = ({ modalType, modalMode, project, task, onClose }) => {
    const { projects, createTask, updateTask, deleteTask, createProject, updateProject, deleteProject, user } = useContext(DataContext);

    const [dependencies, setDependencies] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const modalRef = useRef(null);
    const formikRef = useRef(null);
    const [newAttachments, setNewAttachments] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [preview, setPreview] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    useEffect(() => {
        if (user) setCurrentUser(user);
    }, [user]);

    const handleClose = useCallback(() => {
        setIsVisible(false);
        setTimeout(onClose, 200);
    }, [onClose]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClose]);

    // Build initial values based on modal type and mode
    const [initialValues, setInitialValues] = useState({
        projectKey: '', summary: '', description: '', status: 'TODO',
        startDate: '', dueDate: '', assignee: '', duration: 1, progress: 0,
        priority: 'MEDIUM', labels: '', created: '', updated: '',
        reporter: '', members: [], newUserEmail: '',
    });

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];

        if (modalType === 'task') {
            if (modalMode === 'edit' && task) {
                const deps = task.dependencyKeys?.map(d => parseInt(d, 10)) || [];
                setDependencies(deps);

                let duration = 1;
                if (task.startDate && task.dueDate) {
                    const diff = Math.floor((new Date(task.dueDate) - new Date(task.startDate)) / (1000 * 60 * 60 * 24)) + 1;
                    duration = Math.max(diff, 1);
                }

                setInitialValues({
                    projectKey: task.projectKey || '',
                    summary: task.summary || '',
                    description: task.description || '',
                    status: task.status || 'TODO',
                    startDate: formatDate(task.startDate),
                    dueDate: formatDate(task.dueDate),
                    assignee: task.assignee || '',
                    duration,
                    progress: task.progress || 0,
                    priority: task.priority || 'MEDIUM',
                    labels: task.labels?.join(' ') || '',
                    created: formatDateTime(task.created),
                    updated: formatDateTime(task.updated),
                    reporter: user?.email || '',
                    members: [],
                    newUserEmail: '',
                });
                setExistingAttachments(task.attachments || []);
            } else {
                setDependencies([]);
                setInitialValues(prev => ({
                    ...prev,
                    projectKey: project?.projectKey || '',
                    summary: '', description: '', status: 'TODO',
                    startDate: today, dueDate: today, assignee: '',
                    duration: 1, progress: 0, priority: 'MEDIUM', labels: '',
                    created: new Date().toLocaleString(), updated: new Date().toLocaleString(),
                    reporter: user?.email || '',
                }));
                setExistingAttachments([]);
            }
        } else if (modalType === 'project') {
            if (modalMode === 'edit' && project) {
                setDependencies(project.dependencies || []);
                setInitialValues(prev => ({
                    ...prev,
                    projectKey: project.projectKey || '',
                    summary: project.summary || '',
                    description: project.description || '',
                    members: project.members || [],
                    newUserEmail: '',
                }));
                setExistingAttachments(project.attachments || []);
            } else {
                setDependencies([]);
                setInitialValues(prev => ({
                    ...prev,
                    projectKey: '', summary: '', description: '',
                    members: user ? [user] : [],
                    newUserEmail: '',
                }));
                setExistingAttachments([]);
            }
        }
        setNewAttachments([]);
    }, [modalType, modalMode, project, task, user]);

    const taskValidationSchema = Yup.object().shape({
        projectKey: Yup.string().required('Project is required.'),
        summary: Yup.string().required('Task summary is required.'),
        startDate: Yup.date().required('Start date is required.'),
        dueDate: Yup.date().required('Due date is required.').min(Yup.ref('startDate'), 'Due date cannot be before start date.'),
    });

    const projectValidationSchema = Yup.object().shape(
        modalMode === 'create'
            ? { projectKey: Yup.string().max(4, 'Max 4 characters.').required('Project key is required.'), summary: Yup.string().required('Project name is required.') }
            : { summary: Yup.string().required('Project name is required.') }
    );

    const validationSchema = modalType === 'task' ? taskValidationSchema : projectValidationSchema;

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            if (modalType === 'task') {
                const taskDTO = {
                    summary: values.summary,
                    description: values.description,
                    status: values.status,
                    startDate: values.startDate,
                    dueDate: values.dueDate,
                    assignee: values.assignee,
                    labels: values.labels.trim() ? values.labels.split(/\s+/) : [],
                    dependencyKeys: dependencies.map(String),
                    progress: values.progress,
                    priority: values.priority,
                    attachments: existingAttachments,
                };

                const projectKey = project?.projectKey || task?.projectKey || values.projectKey;
                if (modalMode === 'create') {
                    await createTask(projectKey, taskDTO, newAttachments);
                } else {
                    await updateTask(projectKey, task.taskKey, taskDTO, newAttachments);
                }
            } else {
                const projectDTO = {
                    projectKey: values.projectKey.toUpperCase(),
                    summary: values.summary,
                    description: values.description,
                    members: values.members.map(u => ({ email: u.email })),
                    dependencies,
                    attachments: existingAttachments,
                };

                if (modalMode === 'create') {
                    await createProject(projectDTO, newAttachments);
                } else {
                    await updateProject(project.projectKey, projectDTO, newAttachments);
                }
            }
            handleClose();
        } catch (error) {
            console.error('Error saving:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        try {
            if (modalType === 'task' && modalMode === 'edit') {
                await deleteTask(project?.projectKey || task?.projectKey, task.taskKey);
            } else if (modalType === 'project' && modalMode === 'edit') {
                await deleteProject(project.projectKey);
            }
            handleClose();
        } catch (err) {
            console.error('Error deleting:', err);
        }
    };

    const handleAddNewAttachments = (e) => {
        setNewAttachments(prev => [...prev, ...Array.from(e.target.files)]);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        setNewAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    };

    const handleRemoveAttachment = (attachment) => {
        if (attachment instanceof File) {
            setNewAttachments(prev => prev.filter(f => f !== attachment));
        } else {
            setExistingAttachments(prev => prev.filter(a => a !== attachment));
        }
    };

    const openPreview = (attachment) => {
        const { url, fileName, fileType } = getFileInfo(attachment);
        setPreview({ url, fileName, fileType });
    };

    const renderAttachmentPreview = (attachment) => {
        const { url, fileName, fileType } = getFileInfo(attachment);

        return (
            <div key={url} className="relative group">
                {fileType === 'image' ? (
                    <div className="relative overflow-hidden rounded-lg border border-slate-200 hover:border-slate-400 transition-all hover:shadow-md cursor-pointer" onClick={() => openPreview(attachment)}>
                        <img src={url} alt={fileName} className="h-16 w-16 object-cover" />
                    </div>
                ) : fileName.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:shadow-md hover:border-red-300 transition-all" onClick={() => openPreview(attachment)}>
                        <FaFilePdf className="text-red-500" />
                        <span className="text-xs text-slate-700 truncate max-w-[90px] font-medium">{fileName}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:shadow-md hover:border-slate-300 transition-all" onClick={() => openPreview(attachment)}>
                        <FaFileAlt className="text-slate-500" />
                        <span className="text-xs text-slate-700 truncate max-w-[90px] font-medium">{fileName}</span>
                    </div>
                )}
                <button type="button" onClick={() => handleRemoveAttachment(attachment)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-sm">
                    <FaTimes size={8} />
                </button>
            </div>
        );
    };

    const handleAddMember = async (email, values, setFieldValue) => {
        if (!email) return;
        setEmailLoading(true);
        setEmailError('');

        try {
            const found = await getUserByEmail(email);
            if (found && !values.members.some(u => u.email === found.email)) {
                setFieldValue('members', [...values.members, found]);
                setFieldValue('newUserEmail', '');
            } else if (found) {
                setEmailError('Already a member');
            }
        } catch (err) {
            setEmailError(err.response?.status === 404 ? 'User not found' : 'Error adding user');
        } finally {
            setEmailLoading(false);
        }
    };

    // Get all tasks for dependency selection
    const allTasks = projects.flatMap(p => p.tasks || []);

    return (
        <>
            <div className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />

            <div ref={modalRef} className={`fixed top-0 right-0 w-full md:w-1/2 bg-white shadow-2xl h-screen z-50 flex flex-col transition-transform duration-300 ease-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex-shrink-0 bg-white border-b border-slate-200">
                    <div className="h-1 bg-slate-900" />
                    <div className="px-6 py-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    {modalType === 'task' && modalMode === 'edit' && task && (
                                        <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs font-bold">{task.taskKey}</span>
                                    )}
                                    {modalType === 'project' && modalMode === 'edit' && project && (
                                        <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs font-bold">{project.projectKey}</span>
                                    )}
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${modalMode === 'create' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                        {modalMode === 'create' ? 'New' : 'Edit'}
                                    </span>
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    {modalType === 'task' ? (modalMode === 'create' ? 'Create Task' : 'Edit Task') : (modalMode === 'create' ? 'Create Project' : 'Edit Project')}
                                </h2>
                            </div>
                            <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors group">
                                <FaTimes className="text-slate-400 group-hover:text-slate-600" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5">
                        <Formik innerRef={formikRef} enableReinitialize initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
                            {({ setFieldValue, values, handleChange, isSubmitting, submitForm }) => (
                                <Form className="space-y-6">
                                    {modalType === 'task' ? (
                                        <>
                                            {/* Task Form Fields */}
                                            <div className="space-y-4">
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

                                                <div>
                                                    <InputLabel htmlFor="summary" required>Summary</InputLabel>
                                                    <Field type="text" id="summary" name="summary" placeholder="Enter task summary..." className={inputClass} />
                                                    <ErrorMessage name="summary" component="div" className="text-red-500 text-xs mt-1.5 font-medium" />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
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
                                            </div>

                                            {/* Schedule Section */}
                                            <div>
                                                <SectionHeader icon={FaCalendarAlt} title="Schedule" />
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <InputLabel htmlFor="startDate" required>Start</InputLabel>
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
                                                        <InputLabel htmlFor="dueDate" required>Due</InputLabel>
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
                                                        <InputLabel htmlFor="duration">Days</InputLabel>
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
                                                <div className="mt-4">
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
                                            </div>

                                            {/* Assignment */}
                                            <div>
                                                <SectionHeader icon={FaUser} title="Assignment" />
                                                <div className="grid grid-cols-2 gap-4">
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
                                                    <div>
                                                        <InputLabel htmlFor="reporter">Reporter</InputLabel>
                                                        <Field type="text" id="reporter" name="reporter" disabled className={`${inputClass} ${inputDisabledClass}`} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <InputLabel>Description</InputLabel>
                                                <div className="rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900 transition-all hover:border-slate-300">
                                                    <ReactQuill theme="snow" value={values.description || ''} onChange={val => setFieldValue('description', val)} placeholder="Add a detailed description..." modules={quillModules} className="[&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-slate-100 [&_.ql-toolbar]:bg-slate-50/50 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[120px] [&_.ql-editor]:text-sm" />
                                                </div>
                                            </div>

                                            {/* Labels */}
                                            <div>
                                                <SectionHeader icon={FaTags} title="Labels" />
                                                <Field type="text" id="labels" name="labels" placeholder="Enter labels separated by spaces" className={inputClass} />
                                            </div>

                                            {/* Attachments */}
                                            <div>
                                                <SectionHeader icon={FaCloudUploadAlt} title="Attachments" />
                                                <div className={`border-2 border-dashed rounded-xl p-4 transition-all ${isDragging ? 'border-slate-400 bg-slate-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'}`} onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}>
                                                    {(existingAttachments.length > 0 || newAttachments.length > 0) && (
                                                        <div className="flex flex-wrap gap-3 mb-4">
                                                            {existingAttachments.map(a => renderAttachmentPreview(a))}
                                                            {newAttachments.map(f => renderAttachmentPreview(f))}
                                                        </div>
                                                    )}
                                                    <label htmlFor="attachment-upload" className="cursor-pointer flex flex-col items-center justify-center py-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center mb-2">
                                                            <FaCloudUploadAlt className="text-white" />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-600">Drop files or click to upload</span>
                                                        <span className="text-xs text-slate-400 mt-0.5">Images, PDFs, documents</span>
                                                        <input type="file" id="attachment-upload" multiple onChange={handleAddNewAttachments} className="hidden" />
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Dependencies */}
                                            <div>
                                                <SectionHeader icon={FaLink} title="Dependencies" />
                                                {dependencies.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {dependencies.map(depId => {
                                                            const depTask = allTasks.find(t => t.id === depId);
                                                            return (
                                                                <span key={depId} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
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
                                                <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-100">
                                                    <span>Created: {values.created || 'N/A'}</span>
                                                    <span>Updated: {values.updated || 'N/A'}</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {/* Project Form Fields */}
                                            <div className="space-y-4">
                                                {modalMode === 'create' && (
                                                    <div>
                                                        <InputLabel htmlFor="projectKey" required>Project Key</InputLabel>
                                                        <Field type="text" id="projectKey" name="projectKey" maxLength="4" placeholder="e.g. PROJ" className={`${inputClass} uppercase font-mono tracking-wider`} />
                                                        <p className="text-xs text-slate-400 mt-1.5">Max 4 characters, cannot be changed later</p>
                                                        <ErrorMessage name="projectKey" component="div" className="text-red-500 text-xs mt-1.5 font-medium" />
                                                    </div>
                                                )}
                                                <div>
                                                    <InputLabel htmlFor="summary" required>Project Name</InputLabel>
                                                    <Field type="text" id="summary" name="summary" placeholder="Enter project name..." className={inputClass} />
                                                    <ErrorMessage name="summary" component="div" className="text-red-500 text-xs mt-1.5 font-medium" />
                                                </div>
                                                <div>
                                                    <InputLabel>Description</InputLabel>
                                                    <div className="rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900 transition-all hover:border-slate-300">
                                                        <ReactQuill theme="snow" value={values.description || ''} onChange={val => setFieldValue('description', val)} placeholder="Describe the project..." modules={quillModules} className="[&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-slate-100 [&_.ql-toolbar]:bg-slate-50/50 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[120px] [&_.ql-editor]:text-sm" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Attachments */}
                                            <div>
                                                <SectionHeader icon={FaCloudUploadAlt} title="Attachments" />
                                                <div className={`border-2 border-dashed rounded-xl p-4 transition-all ${isDragging ? 'border-slate-400 bg-slate-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'}`} onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}>
                                                    {(existingAttachments.length > 0 || newAttachments.length > 0) && (
                                                        <div className="flex flex-wrap gap-3 mb-4">
                                                            {existingAttachments.map(a => renderAttachmentPreview(a))}
                                                            {newAttachments.map(f => renderAttachmentPreview(f))}
                                                        </div>
                                                    )}
                                                    <label htmlFor="attachment-upload-project" className="cursor-pointer flex flex-col items-center justify-center py-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center mb-2">
                                                            <FaCloudUploadAlt className="text-white" />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-600">Drop files or click to upload</span>
                                                        <input type="file" id="attachment-upload-project" multiple onChange={handleAddNewAttachments} className="hidden" />
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Project Dependencies */}
                                            <div>
                                                <SectionHeader icon={FaLayerGroup} title="Project Dependencies" />
                                                {dependencies.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {dependencies.map(depKey => {
                                                            const depProject = projects.find(p => p.projectKey === depKey);
                                                            return (
                                                                <span key={depKey} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
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

                                            {/* Team Members */}
                                            <div>
                                                <SectionHeader icon={FaUser} title="Team Members" />
                                                {values.members?.length > 0 && (
                                                    <div className="space-y-2 mb-4">
                                                        {values.members.map((m, i) => (
                                                            <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg border border-slate-100 group hover:border-slate-200 transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarColor(m.firstname || m.email)} flex items-center justify-center text-xs font-bold text-white`}>
                                                                        {m.firstname ? `${m.firstname[0]}${m.lastname?.[0] || ''}` : m.email[0].toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-medium text-slate-800">{m.firstname ? `${m.firstname} ${m.lastname}` : m.email}</div>
                                                                        {m.firstname && <div className="text-[11px] text-slate-400">{m.email}</div>}
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
                                                        <Field type="email" name="newUserEmail" placeholder="Enter email address..." className={`${inputClass} flex-1`} />
                                                        <button type="button" onClick={() => handleAddMember(values.newUserEmail, values, setFieldValue)} disabled={emailLoading} className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-sm font-semibold disabled:opacity-50">
                                                            {emailLoading ? '...' : 'Add'}
                                                        </button>
                                                    </div>
                                                )}
                                                {emailError && <div className="text-red-500 text-xs mt-2 font-medium">{emailError}</div>}
                                            </div>
                                        </>
                                    )}
                                    <div className="h-20" />
                                </Form>
                            )}
                        </Formik>

                        {modalType === 'task' && modalMode === 'edit' && task && currentUser && (
                            <div className="mt-6 pt-5 border-t border-slate-100">
                                <Comments taskId={task.id} currentUserId={currentUser.id} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => formikRef.current?.submitForm()} disabled={formikRef.current?.isSubmitting} className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                            {modalMode === 'create' ? <FaPlus className="text-xs" /> : <FaSave className="text-xs" />}
                            <span>{modalMode === 'create' ? 'Create' : 'Save Changes'}</span>
                        </button>
                        <button type="button" onClick={handleClose} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium">Cancel</button>
                        {modalMode === 'edit' && (
                            <button type="button" onClick={handleDelete} className="px-5 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-2">
                                <FaTrashAlt className="text-xs" />Delete
                            </button>
                        )}
                    </div>
                </div>

                {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
            </div>
        </>
    );
};

export default TaskProjectModal;