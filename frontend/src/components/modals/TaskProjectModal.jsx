import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { DataContext } from '../../context/DataContext';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { toast, Slide } from 'react-toastify';
import { FaPlus, FaTimes, FaTrashAlt, FaSave } from 'react-icons/fa';
import { getUserByEmail } from '../../util/api';
import { formatDateTime, formatDate } from '../../util/helpers';
import { useClickOutside } from '../../hooks/useClickOutside';
import TaskForm from './TaskForm';
import ProjectForm from './ProjectForm';
import ConfirmDialog from './ConfirmDialog';

const showToast = (message, type = 'error') => {
    toast[type](message, {
        position: 'top-center',
        autoClose: 2500,
        transition: Slide,
    });
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
    const [isVisible, setIsVisible] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    useEffect(() => {
        if (user) setCurrentUser(user);
    }, [user]);

    const handleCloseAttempt = useCallback(() => {
        const formDirty = formikRef.current?.dirty || isDirty;
        if (formDirty && modalMode !== 'view') {
            setCloseConfirmOpen(true);
        } else {
            setIsVisible(false);
            setTimeout(onClose, 200);
        }
    }, [onClose, isDirty, modalMode]);

    const handleForceClose = useCallback(() => {
        setCloseConfirmOpen(false);
        setIsVisible(false);
        setTimeout(onClose, 200);
    }, [onClose]);

    useClickOutside(modalRef, handleCloseAttempt);

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
                setInitialValues({
                    projectKey: project.projectKey || '',
                    summary: project.summary || '',
                    description: project.description || '',
                    members: project.members || [],
                    newUserEmail: '',
                    status: 'TODO', startDate: '', dueDate: '', assignee: '',
                    duration: 1, progress: 0, priority: 'MEDIUM', labels: '',
                    created: '', updated: '', reporter: user?.email || '',
                });
                setExistingAttachments(project.attachments || []);
            } else {
                setDependencies([]);
                setInitialValues({
                    projectKey: '', summary: '', description: '',
                    members: user ? [user] : [], newUserEmail: '',
                    status: 'TODO', startDate: '', dueDate: '', assignee: '',
                    duration: 1, progress: 0, priority: 'MEDIUM', labels: '',
                    created: '', updated: '', reporter: user?.email || '',
                });
                setExistingAttachments([]);
            }
        }
        setNewAttachments([]);
    }, [modalType, modalMode, project?.projectKey, task?.id, user?.email]);

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
                    summary: values.summary, description: values.description, status: values.status,
                    startDate: values.startDate, dueDate: values.dueDate, assignee: values.assignee,
                    labels: values.labels.trim() ? values.labels.split(/\s+/) : [],
                    dependencyKeys: dependencies.map(String), progress: values.progress,
                    priority: values.priority, attachments: existingAttachments,
                };
                const projectKey = project?.projectKey || task?.projectKey || values.projectKey;
                if (modalMode === 'create') {
                    await createTask(projectKey, taskDTO, newAttachments);
                    showToast('Task created successfully', 'success');
                } else {
                    await updateTask(projectKey, task.taskKey, taskDTO, newAttachments);
                    showToast('Task updated successfully', 'success');
                }
            } else {
                const projectDTO = {
                    projectKey: values.projectKey.toUpperCase(), summary: values.summary,
                    description: values.description, members: values.members.map(u => ({ email: u.email })),
                    dependencies, attachments: existingAttachments,
                };
                if (modalMode === 'create') {
                    await createProject(projectDTO, newAttachments);
                    showToast('Project created successfully', 'success');
                } else {
                    await updateProject(project.projectKey, projectDTO, newAttachments);
                    showToast('Project updated successfully', 'success');
                }
            }
            handleForceClose();
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Failed to save. Please try again.';
            showToast(message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteConfirm = async () => {
        setDeleteConfirmOpen(false);
        try {
            if (modalType === 'task' && modalMode === 'edit') {
                await deleteTask(project?.projectKey || task?.projectKey, task.taskKey);
                showToast('Task deleted successfully', 'success');
            } else if (modalType === 'project' && modalMode === 'edit') {
                await deleteProject(project.projectKey);
                showToast('Project deleted successfully', 'success');
            }
            handleForceClose();
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Failed to delete. Please try again.';
            showToast(message, 'error');
        }
    };

    const handleAddAttachments = (files) => {
        setNewAttachments(prev => [...prev, ...files]);
        setIsDirty(true);
    };

    const handleRemoveAttachment = (attachment) => {
        if (attachment instanceof File) {
            setNewAttachments(prev => prev.filter(f => f !== attachment));
        } else {
            setExistingAttachments(prev => prev.filter(a => a !== attachment));
        }
        setIsDirty(true);
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

    const modalTitle = modalType === 'task'
        ? (modalMode === 'create' ? 'Create Task' : 'Edit Task')
        : (modalMode === 'create' ? 'Create Project' : 'Edit Project');

    const deleteMessage = modalType === 'task'
        ? `Are you sure you want to delete "${task?.summary || 'this task'}"? This action cannot be undone.`
        : `Are you sure you want to delete "${project?.summary || 'this project'}"? All tasks in this project will also be deleted.`;

    return (
        <>
            <div className={`fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleCloseAttempt} aria-hidden="true" />

            <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title"
                className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[1400px] max-h-[90vh] bg-white shadow-2xl rounded-xl z-[70] flex flex-col transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                {/* Header */}
                <div className="flex-shrink-0 bg-white border-b border-slate-200 rounded-t-xl">
                    <div className="h-1 bg-slate-900 rounded-t-xl" />
                    <div className="px-6 py-4">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                {modalType === 'task' && modalMode === 'edit' && task && (
                                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs font-bold">{task.taskKey}</span>
                                )}
                                {modalType === 'project' && modalMode === 'edit' && project && (
                                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs font-bold">{project.projectKey}</span>
                                )}
                                <div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${modalMode === 'create' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                        {modalMode === 'create' ? 'New' : 'Edit'}
                                    </span>
                                    <h2 id="modal-title" className="text-lg font-bold text-slate-900 mt-1">{modalTitle}</h2>
                                </div>
                            </div>
                            <button onClick={handleCloseAttempt} aria-label="Close dialog" className="p-2 hover:bg-slate-100 rounded-lg transition-colors group">
                                <FaTimes className="text-slate-400 group-hover:text-slate-600" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <Formik innerRef={formikRef} enableReinitialize initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
                        {({ setFieldValue, values, handleChange }) => (
                            <Form className="flex h-full">
                                {modalType === 'task' ? (
                                    <TaskForm values={values} setFieldValue={setFieldValue} handleChange={handleChange} modalMode={modalMode}
                                        task={task} project={project} projects={projects} currentUser={currentUser}
                                        dependencies={dependencies} setDependencies={setDependencies}
                                        existingAttachments={existingAttachments} newAttachments={newAttachments}
                                        onAddAttachments={handleAddAttachments} onRemoveAttachment={handleRemoveAttachment} />
                                ) : (
                                    <ProjectForm values={values} setFieldValue={setFieldValue} modalMode={modalMode}
                                        project={project} projects={projects} currentUser={currentUser}
                                        dependencies={dependencies} setDependencies={setDependencies}
                                        existingAttachments={existingAttachments} newAttachments={newAttachments}
                                        onAddAttachments={handleAddAttachments} onRemoveAttachment={handleRemoveAttachment}
                                        onAddMember={handleAddMember} emailLoading={emailLoading} emailError={emailError} />
                                )}
                            </Form>
                        )}
                    </Formik>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 py-4 rounded-b-xl">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => formikRef.current?.submitForm()} disabled={formikRef.current?.isSubmitting}
                            className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                            {modalMode === 'create' ? <FaPlus className="text-xs" /> : <FaSave className="text-xs" />}
                            <span>{modalMode === 'create' ? 'Create' : 'Save Changes'}</span>
                        </button>
                        <button type="button" onClick={handleCloseAttempt} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium">Cancel</button>
                        {modalMode === 'edit' && (
                            <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="px-5 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-2">
                                <FaTrashAlt className="text-xs" />Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} onConfirm={handleDeleteConfirm}
                title={`Delete ${modalType === 'task' ? 'Task' : 'Project'}?`} message={deleteMessage}
                confirmText="Delete" cancelText="Cancel" variant="danger" />

            <ConfirmDialog isOpen={closeConfirmOpen} onClose={() => setCloseConfirmOpen(false)} onConfirm={handleForceClose}
                title="Unsaved Changes" message="You have unsaved changes. Are you sure you want to close without saving?"
                confirmText="Discard" cancelText="Keep Editing" variant="warning" />
        </>
    );
};

export default TaskProjectModal;
