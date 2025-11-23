// src/components/TaskProjectModal.jsx

import React, {useContext, useEffect, useRef, useState} from 'react';
import {DataContext} from '../context/DataContext';
import {ErrorMessage, Field, Form, Formik} from 'formik';
import * as Yup from 'yup';
import Comments from './Comments';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {FaDownload, FaFileAlt, FaFilePdf, FaPlus, FaTimes} from 'react-icons/fa';
import {getUserByEmail} from "../util/api";

const backendBaseURL = 'http://localhost:8080';

const TaskProjectModal = ({
                              modalType,
                              modalMode,
                              project,
                              task,
                              onClose,
                          }) => {
    const {
        projects,
        createTask,
        updateTask,
        deleteTask,
        createProject,
        updateProject,
        deleteProject,
        user,
    } = useContext(DataContext);

    const [dependencies, setDependencies] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const modalRef = useRef(null);
    const [newAttachments, setNewAttachments] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    // For the lightbox preview of attachments:
    const [preview, setPreview] = useState(null); // { url, filename, type }

    useEffect(() => {
        if (user) setCurrentUser(user);
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        return d.toLocaleString();
    };

    // We'll store / display dates in "YYYY-MM-DD" format
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    };

    const [initialValues, setInitialValues] = useState({
        projectKey: '',
        summary: '',
        description: '',
        status: 'To Do',
        startDate: '',
        dueDate: '',
        assignee: '',
        duration: 1,
        progress: 0,
        priority: 'Normal',
        labels: '',
        created: new Date().toLocaleString('en-US'),
        updated: new Date().toLocaleString('en-US'),
        reporter: '',
        users: [],
        newUserEmail: '',
    });

    useEffect(() => {
        if (modalType === 'task') {
            if (modalMode === 'edit' && task) {
                // Editing an existing task
                setDependencies(task.dependencies || []);
                let precomputedDuration = 0;
                if (task.startDate && task.dueDate) {
                    const s = new Date(task.startDate);
                    const d = new Date(task.dueDate);
                    let diff = Math.floor((d - s) / (1000 * 60 * 60 * 24));
                    if (diff < 0) diff = 0;
                    precomputedDuration = diff;
                }
                setInitialValues({
                    projectKey: task.projectKey || '',
                    summary: task.summary || '',
                    description: task.description || '',
                    status: task.status || 'To Do',
                    startDate: formatDate(task.startDate),
                    dueDate: formatDate(task.dueDate),
                    assignee: task.assignee || '',
                    duration: precomputedDuration,
                    progress: task.progress || 0,
                    priority: task.priority || 'Normal',
                    labels: task.labels ? task.labels.join(' ') : '',
                    created: task.created ? formatDateTime(task.created) : '',
                    updated: task.updated ? formatDateTime(task.updated) : '',
                    // docelowo ma byc task.reporter
                    reporter: user?.email || '',
                    users: [],
                    newUserEmail: '',
                });
                setExistingAttachments(task.attachments || []);
                setNewAttachments([]);
            } else {
                // Creating a new task
                const todayStr = new Date().toISOString().split('T')[0];
                setDependencies([]);
                setInitialValues((prev) => ({
                    ...prev,
                    projectKey: project ? project.projectKey : '',
                    summary: '',
                    description: '',
                    status: 'To Do',
                    startDate: todayStr,
                    dueDate: todayStr,
                    assignee: '',
                    duration: 1,
                    progress: 0,
                    priority: 'Normal',
                    labels: '',
                    created: new Date().toLocaleString('en-US'),
                    updated: new Date().toLocaleString('en-US'),
                    reporter: user?.email || '',
                    users: [],
                    newUserEmail: '',
                }));
                setExistingAttachments([]);
                setNewAttachments([]);
            }
        } else if (modalType === 'project') {
            if (modalMode === 'edit' && project) {
                setDependencies(project.dependencies || []);
                setInitialValues((prev) => ({
                    ...prev,
                    projectKey: project.projectKey || '',
                    summary: project.summary || '',
                    description: project.description || '',
                    users: project.users || [],
                    newUserEmail: '',
                    // Reset task-related fields
                    status: 'To Do',
                    startDate: '',
                    dueDate: '',
                    duration: 1,
                    progress: 0,
                    priority: 'Normal',
                    labels: '',
                    created: new Date().toLocaleString('en-US'),
                    updated: new Date().toLocaleString('en-US'),
                    reporter: '',
                }));
                setExistingAttachments(project.attachments || []);
                setNewAttachments([]);
            } else {
                setDependencies([]);
                setInitialValues((prev) => ({
                    ...prev,
                    projectKey: '',
                    summary: '',
                    description: '',
                    users: user ? [user] : [],
                    newUserEmail: '',
                    status: 'To Do',
                    startDate: '',
                    dueDate: '',
                    duration: 0,
                    progress: 0,
                    priority: 'Normal',
                    labels: '',
                    created: new Date().toLocaleString('en-US'),
                    updated: new Date().toLocaleString('en-US'),
                    reporter: '',
                }));
                setExistingAttachments([]);
                setNewAttachments([]);
            }
        }
    }, [modalType, modalMode, project, task, user]);

    // Validation
    const taskValidationSchema = Yup.object().shape({
        projectKey: Yup.string().required('Project is required.'),
        summary: Yup.string().required('Task summary is required.'),
        startDate: Yup.date().required('Start date is required.'),
        dueDate: Yup.date()
            .required('Due date is required.')
            .min(Yup.ref('startDate'), 'Due date cannot be before start date.'),
    });

    const projectValidationSchema = Yup.object().shape(
        modalMode === 'create'
            ? {
                projectKey: Yup.string().max(4, 'Max 4 characters.').required('Project key is required.'),
                summary: Yup.string().required('Project name is required.'),
            }
            : {
                projectKey: Yup.string(),
                summary: Yup.string().required('Project name is required.'),
            }
    );

    const validationSchema = modalType === 'task' ? taskValidationSchema : projectValidationSchema;

    const handleSubmit = async (values, { setSubmitting }) => {
        if (modalType === 'task') {
            const allLabels = values.labels.trim().length ? values.labels.split(/\s+/) : [];
            const taskDTO = {
                summary: values.summary,
                description: values.description,
                status: values.status,
                startDate: values.startDate,
                dueDate: values.dueDate,
                assignee: values.assignee,
                labels: allLabels,
                dependencies,
                progress: values.progress,
                priority: values.priority,
                // IMPORTANT: include the list of attachments that the user did NOT remove.
                attachments: existingAttachments,
            };
            try {
                if (modalMode === 'create') {
                    const projectKeyToUse = project ? project.projectKey : values.projectKey;
                    await createTask(projectKeyToUse, taskDTO, newAttachments);
                } else {
                    const projectKeyToUse = project?.projectKey || task?.projectKey || values.projectKey;
                    await updateTask(projectKeyToUse, task.id, taskDTO, newAttachments);
                }
                onClose();
            } catch (error) {
                console.error(error);
            } finally {
                setSubmitting(false);
            }
        } else if (modalType === 'project') {
            const projectDTO = {
                projectKey: values.projectKey,
                summary: values.summary,
                description: values.description,
                users: values.users.map((u) => ({ email: u.email })),
                dependencies,
                attachments: existingAttachments,
            };
            try {
                if (modalMode === 'create') {
                    await createProject(projectDTO, newAttachments);
                } else {
                    await updateProject(project.projectKey, projectDTO, newAttachments);
                }
                onClose();
            } catch (error) {
                console.error(error);
            } finally {
                setSubmitting(false);
            }
        }
    };

    const handleDelete = async () => {
        if (modalType === 'task' && modalMode === 'edit') {
            try {
                const projectKeyToUse = project?.projectKey || task?.projectKey;
                await deleteTask(projectKeyToUse, task.id);
                onClose();
            } catch (err) {
                console.error(err);
            }
        } else if (modalType === 'project' && modalMode === 'edit') {
            try {
                await deleteProject(project.projectKey);
                onClose();
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleAddNewAttachments = (e) => {
        const files = Array.from(e.target.files);
        setNewAttachments((prev) => [...prev, ...files]);
    };

    const handleRemoveAttachment = (attachment) => {
        if (attachment instanceof File) {
            // For new attachments (File objects), filter by comparing objects directly.
            setNewAttachments(newAttachments.filter((file) => file !== attachment));
        } else {
            // For existing attachments (assumed to be URL strings) compare directly.
            setExistingAttachments(existingAttachments.filter((a) => a !== attachment));
        }
    };


    const getFileTypeFromPath = (path) => {
        const extension = path.split('.').pop().toLowerCase();
        const images = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        if (images.includes(extension)) return 'image';
        return 'application';
    };

    const openPreview = (attachment) => {
        const isFile = attachment instanceof File;
        const url = isFile ? URL.createObjectURL(attachment) : `${backendBaseURL}${attachment}`;
        const fileName = isFile ? attachment.name : attachment.split('/').pop();
        const fileType = isFile
            ? attachment.type.split('/')[0]
            : getFileTypeFromPath(attachment);
        setPreview({ url, fileName, fileType });
    };

    const renderAttachmentPreview = (attachment) => {
        const isFile = attachment instanceof File;
        const url = isFile ? URL.createObjectURL(attachment) : `${backendBaseURL}${attachment}`;
        const fileName = isFile ? attachment.name : attachment.split('/').pop();
        const fileType = isFile
            ? attachment.type.split('/')[0]
            : getFileTypeFromPath(attachment);

        return (
            <div key={url} className="relative">
                {fileType === 'image' ? (
                    // Clicking the image opens a preview modal
                    <img
                        src={url}
                        alt={fileName}
                        onClick={() => openPreview(attachment)}
                        className="h-20 w-auto object-cover rounded-md shadow-sm cursor-pointer"
                    />
                ) : fileType === 'application' && fileName.toLowerCase().endsWith('.pdf') ? (
                    <div
                        className="flex items-center space-x-2 p-2 bg-gray-100 rounded-md cursor-pointer"
                        onClick={() => openPreview(attachment)}
                    >
                        <FaFilePdf className="text-red-500" />
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            {fileName}
                        </a>
                    </div>
                ) : (
                    <div
                        className="flex items-center space-x-2 p-2 bg-gray-100 rounded-md cursor-pointer"
                        onClick={() => openPreview(attachment)}
                    >
                        <FaFileAlt className="text-gray-500" />
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            {fileName}
                        </a>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => handleRemoveAttachment(attachment)}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                >
                    <FaTimes size={12} />
                </button>
            </div>
        );
    };

    // A simple lightbox preview modal
    const PreviewModal = ({ preview, onClose }) => {
        if (!preview) return null;
        return (
            <div
                className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50"
                onClick={onClose}
            >
                <div className="relative bg-white p-4 rounded shadow-lg" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-semibold mb-2">{preview.fileName}</h3>
                    {preview.fileType === 'image' ? (
                        <img src={preview.url} alt={preview.fileName} className="max-h-[80vh] max-w-[90vw]" />
                    ) : (
                        <iframe
                            src={preview.url}
                            title={preview.fileName}
                            className="w-[80vw] h-[80vh]"
                        ></iframe>
                    )}
                    <div className="mt-2 flex justify-between items-center">
                        <a
                            href={preview.url}
                            download={preview.fileName}
                            className="flex items-center gap-x-1 text-blue-600 hover:underline"
                        >
                            <FaDownload /> Download
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // A little helper to format "YYYY-MM-DD"
    const toDateInputValue = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toISOString().split('T')[0];
    };

    return (
        <div
            ref={modalRef}
            className="absolute top-0 right-0 w-full lg:w-1/2 md:w-3/5 bg-white shadow-2xl p-6 border-l border-gray-300 h-screen z-50 overflow-y-auto"
        >
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-gray-800">
                    {modalType === 'task'
                        ? modalMode === 'create'
                            ? 'Create New Task'
                            : 'Edit Task'
                        : modalMode === 'create'
                            ? 'Create New Project'
                            : 'Edit Project'}
                </h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition duration-300">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <Formik
                enableReinitialize
                initialValues={initialValues}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, setFieldValue, values, handleChange }) => (
                    <Form>
                        {modalType === 'task' && (
                            <>
                                {project && modalMode === 'edit' && task && (
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                        Task Key: {task.taskKey}
                                    </h3>
                                )}
                                {/* Always render the "Select Project" dropdown */}
                                <div className="mb-4">
                                    <label htmlFor="projectKey" className="block text-sm font-medium text-gray-700">
                                        Project
                                    </label>
                                    <Field
                                        as="select"
                                        id="projectKey"
                                        name="projectKey"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        disabled={modalMode === 'edit'}
                                    >
                                        <option value="">Select Project</option>
                                        {projects.map((p) => (
                                            <option key={p.projectKey} value={p.projectKey}>
                                                {p.summary} ({p.projectKey})
                                            </option>
                                        ))}
                                    </Field>
                                    <ErrorMessage name="projectKey" component="div" className="text-red-600 text-sm"/>
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="summary" className="block text-sm font-medium text-gray-700">
                                        Task Summary
                                    </label>
                                    <Field
                                        type="text"
                                        id="summary"
                                        name="summary"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        placeholder="Enter task summary"
                                    />
                                    <ErrorMessage name="summary" component="div" className="text-red-600 text-sm"/>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                                            Status
                                        </label>
                                        <Field
                                            as="select"
                                            id="status"
                                            name="status"
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                        >
                                            <option value="To Do">To Do</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Done">Done</option>
                                        </Field>
                                    </div>
                                    <div>
                                        <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                                            Priority
                                        </label>
                                        <Field
                                            as="select"
                                            id="priority"
                                            name="priority"
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                        >
                                            <option value="Lowest">Lowest</option>
                                            <option value="Low">Low</option>
                                            <option value="Normal">Normal</option>
                                            <option value="High">High</option>
                                            <option value="Highest">Highest</option>
                                        </Field>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                                            Start Date
                                        </label>
                                        <Field
                                            type="date"
                                            id="startDate"
                                            name="startDate"
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                            onChange={(e) => {
                                                handleChange(e);
                                                const s = e.target.value;
                                                if (s && values.dueDate) {
                                                    const startDateObj = new Date(s);
                                                    const dueDateObj = new Date(values.dueDate);
                                                    let diff = Math.floor((dueDateObj - startDateObj) / 86400000) + 1;
                                                    diff = Math.max(diff, 1);
                                                    setFieldValue('duration', diff);
                                                }
                                            }}
                                        />
                                        <ErrorMessage name="startDate" component="div"
                                                      className="text-red-600 text-sm"/>
                                    </div>

                                    <div>
                                        <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">
                                            Due Date
                                        </label>
                                        <Field
                                            type="date"
                                            id="dueDate"
                                            name="dueDate"
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                            onChange={(e) => {
                                                handleChange(e);
                                                const newDueDateStr = e.target.value;
                                                if (values.startDate && newDueDateStr) {
                                                    const s = new Date(values.startDate);
                                                    const d = new Date(newDueDateStr);
                                                    let diff = Math.floor((d - s) / 86400000) + 1;
                                                    diff = Math.max(diff, 1);
                                                    setFieldValue('duration', diff);
                                                }
                                            }}
                                        />

                                        <ErrorMessage name="dueDate" component="div" className="text-red-600 text-sm"/>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                                            Duration (days)
                                        </label>
                                        <Field
                                            type="number"
                                            id="duration"
                                            name="duration"
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                            min="1"
                                            onChange={(e) => {
                                                const newDuration = Math.max(1, parseInt(e.target.value, 10) || 1);
                                                setFieldValue('duration', newDuration);
                                                if (values.startDate) {
                                                    const s = new Date(values.startDate);
                                                    // dueDate = startDate + (duration - 1) days
                                                    const newDue = new Date(s.getTime() + (newDuration - 1) * 86400000);
                                                    const newDueStr = newDue.toISOString().split('T')[0];
                                                    setFieldValue('dueDate', newDueStr);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="progress" className="block text-sm font-medium text-gray-700">
                                            Progress
                                        </label>
                                        <Field
                                            type="range"
                                            id="progress"
                                            name="progress"
                                            min="0"
                                            max="100"
                                            className="w-full"
                                        />
                                        <div className="text-sm">{values.progress}%</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
                                            Assignee
                                        </label>
                                        <Field
                                            as="select"
                                            id="assignee"
                                            name="assignee"
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                        >
                                            <option value="">Select assignee</option>
                                            {project?.users &&
                                                project.users.map((u) => (
                                                    <option key={u.id} value={u.email}>
                                                        {u.firstname} {u.lastname} ({u.email})
                                                    </option>
                                                ))}
                                        </Field>
                                    </div>
                                    <div>
                                        <label htmlFor="reporter" className="block text-sm font-medium text-gray-700">
                                            Reporter
                                        </label>
                                        <Field
                                            type="text"
                                            id="reporter"
                                            name="reporter"
                                            className="w-full p-1.5 border border-gray-300 rounded-lg bg-gray-100"
                                            disabled
                                        />
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                        Description
                                    </label>
                                    <div className="h-160 mb-4">
                                        <ReactQuill
                                            theme="snow"
                                            value={values.description || ''}
                                            onChange={(val) => setFieldValue('description', val)}
                                            placeholder="Add a description..."
                                            modules={{
                                                toolbar: [
                                                    [{header: [1, 2, 3, false]}],
                                                    ['bold', 'italic', 'underline', 'strike', 'code-block'],
                                                    [{list: 'ordered'}, {list: 'bullet'}],
                                                    ['blockquote', 'link'],
                                                    ['clean'],
                                                ],
                                            }}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label
                                            className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {existingAttachments.map((a) => renderAttachmentPreview(a))}
                                            {newAttachments.map((f) => renderAttachmentPreview(f))}
                                            <label
                                                htmlFor="attachment-upload"
                                                className="cursor-pointer flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full hover:bg-gray-300"
                                            >
                                                <FaPlus/>
                                                <input
                                                    type="file"
                                                    id="attachment-upload"
                                                    multiple
                                                    onChange={handleAddNewAttachments}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h3 className="text-lg font-semibold mb-2">Dependencies</h3>
                                    <div className="p-2 border border-gray-300 rounded-lg space-y-2">
                                        {dependencies.map((depId) => {
                                            const depTask = projects
                                                .flatMap((p) => p.tasks || [])
                                                .find((t) => t.id === depId);
                                            return (
                                                <div key={depId} className="flex justify-between items-center">
          <span className="text-blue-500">
            {depTask ? depTask.taskKey : `ID: ${depId}`}
          </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDependencies(dependencies.filter((id) => id !== depId))}
                                                        className="text-sm text-red-500"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        <select
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                            onChange={(e) => {
                                                const selectedDepId = parseInt(e.target.value, 10);
                                                if (selectedDepId && !dependencies.includes(selectedDepId)) {
                                                    setDependencies([...dependencies, selectedDepId]);
                                                }
                                            }}
                                            value=""
                                        >
                                            <option value="">Add Dependency</option>
                                            {projects.flatMap((p) => p.tasks || [])
                                                .filter((t) => t.id !== task?.id)
                                                .map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.projectKey}-{t.id} ({t.summary})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="labels" className="block text-sm font-medium text-gray-700">
                                        Labels
                                    </label>
                                    <Field
                                        type="text"
                                        id="labels"
                                        name="labels"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                        placeholder="Separate labels with space"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Created</label>
                                        <div className="pt-2 text-sm text-gray-700">{values.created || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Updated</label>
                                        <div className="pt-2 text-sm text-gray-700">{values.updated || 'N/A'}</div>
                                    </div>
                                </div>
                            </>
                        )}

                        {modalType === 'project' && (
                            <>
                                {modalMode === 'create' && (
                                    <div className="mb-4">
                                        <label htmlFor="projectKey" className="block text-sm font-medium text-gray-700">
                                            Project Key (max 4 chars)
                                        </label>
                                        <Field
                                            type="text"
                                            id="projectKey"
                                            name="projectKey"
                                            maxLength="4"
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                        />
                                        <ErrorMessage name="projectKey" component="div"
                                                      className="text-red-600 text-sm"/>
                                    </div>
                                )}

                                <div className="mb-4">
                                    <label htmlFor="summary" className="block text-sm font-medium text-gray-700">
                                        Project Name
                                    </label>
                                    <Field
                                        type="text"
                                        id="summary"
                                        name="summary"
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                    />
                                    <ErrorMessage name="summary" component="div" className="text-red-600 text-sm" />
                                </div>

                                <div className="mb-4">
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                        Description
                                    </label>
                                    <div className="h-160 mb-2">
                                        <ReactQuill
                                            theme="snow"
                                            value={values.description || ''}
                                            onChange={(val) => setFieldValue('description', val)}
                                            placeholder="Add a project description..."
                                            modules={{
                                                toolbar: [
                                                    [{ header: [1, 2, 3, false] }],
                                                    ['bold', 'italic', 'underline', 'strike', 'code-block'],
                                                    [{ list: 'ordered' }, { list: 'bullet' }],
                                                    ['blockquote', 'link'],
                                                    ['clean'],
                                                ],
                                            }}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {existingAttachments.map((a) => renderAttachmentPreview(a))}
                                            {newAttachments.map((f) => renderAttachmentPreview(f))}
                                            <label
                                                htmlFor="attachment-upload"
                                                className="cursor-pointer flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full hover:bg-gray-300"
                                            >
                                                <FaPlus />
                                                <input
                                                    type="file"
                                                    id="attachment-upload"
                                                    multiple
                                                    onChange={handleAddNewAttachments}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h3 className="text-lg font-semibold mb-2">Dependencies</h3>
                                    <div className="p-2 border border-gray-300 rounded-lg space-y-2">
                                        {dependencies.map((depKey) => {
                                            const depProject = projects.find((p) => p.projectKey === depKey);
                                            return (
                                                <div key={depKey} className="flex justify-between items-center">
                          <span className="text-blue-500">
                            {depProject ? `${depProject.projectKey} - ${depProject.summary}` : `Project: ${depKey}`}
                          </span>
                                                    <button
                                                        type="button"
                                                        className="text-sm text-red-500 hover:text-red-700"
                                                        onClick={() => setDependencies(dependencies.filter((d) => d !== depKey))}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        <select
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                            onChange={(e) => {
                                                const selectedProjectKey = e.target.value;
                                                if (selectedProjectKey && !dependencies.includes(selectedProjectKey)) {
                                                    setDependencies([...dependencies, selectedProjectKey]);
                                                }
                                            }}
                                            value=""
                                        >
                                            <option value="">Add Dependency</option>
                                            {projects
                                                .filter((p) => p.projectKey !== project?.projectKey)
                                                .map((p) => (
                                                    <option key={p.projectKey} value={p.projectKey}>
                                                        {p.projectKey} - {p.summary}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Members</label>
                                    <div className="space-y-2">
                                        {values.users &&
                                            values.users.map((m, i) => (
                                                <div key={i} className="flex items-center space-x-2">
                          <span>
                            {m.firstname ? `${m.firstname} ${m.lastname} (${m.email})` : m.email}
                          </span>
                                                    {currentUser &&
                                                        (project?.owner
                                                            ? currentUser.id === project.owner.id && m.id !== project.owner.id
                                                            : true) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = values.users.filter((_, idx) => idx !== i);
                                                                    setFieldValue('users', updated);
                                                                }}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                </div>
                                            ))}
                                        {currentUser && (
                                            <div className="flex items-center space-x-2">
                                                <Field
                                                    type="email"
                                                    name="newUserEmail"
                                                    placeholder="Add user by email"
                                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (values.newUserEmail) {
                                                            setEmailLoading(true);
                                                            setEmailError('');
                                                            try {
                                                                const found = await getUserByEmail(values.newUserEmail);
                                                                if (found) {
                                                                    if (!values.users.some((u) => u.email === found.email)) {
                                                                        setFieldValue('users', [...values.users, found]);
                                                                        setFieldValue('newUserEmail', '');
                                                                    } else {
                                                                        setEmailError('User is already added.');
                                                                    }
                                                                }
                                                            } catch (err) {
                                                                if (err.response && err.response.status === 404) {
                                                                    setEmailError('User does not exist.');
                                                                } else {
                                                                    setEmailError('Error checking user.');
                                                                }
                                                            } finally {
                                                                setEmailLoading(false);
                                                            }
                                                        }
                                                    }}
                                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                                                >
                                                    {emailLoading ? 'Loading...' : 'Add'}
                                                </button>
                                            </div>
                                        )}
                                        {emailError && <div className="text-red-600 text-sm">{emailError}</div>}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="flex gap-6">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-2/3 p-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition duration-300"
                            >
                                {isSubmitting ? 'Saving...' : 'Save'}
                            </button>
                            {modalMode === 'edit' && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="w-1/3 p-2.5 bg-red-500 text-white rounded-2xl hover:bg-red-700 transition duration-300"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </Form>
                )}
            </Formik>

            {modalType === 'task' && modalMode === 'edit' && task && currentUser && (
                <Comments taskId={task.id} currentUserId={currentUser.id} />
            )}

            {/* Preview Modal for attachments */}
            {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
        </div>
    );
};

export default TaskProjectModal;
