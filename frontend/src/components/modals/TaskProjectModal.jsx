import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi';
import { DataContext } from '../../context/DataContext';
import TaskForm from './TaskForm';
import ProjectForm from './ProjectForm';
import ConfirmDialog from './ConfirmDialog';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatDateTime, formatDate, MS_PER_DAY, toDateString } from '../../util/helpers';
import { showToast } from '../../util/toast';

const TaskProjectModal = ({ modalType, modalMode, project, task, onClose }) => {
    const {
        projects,
        createTask,
        updateTask,
        deleteTask,
        createProject,
        updateProject,
        deleteProject,
        user
    } = useContext(DataContext);

    const [dependencies, setDependencies] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const modalRef = useRef(null);
    const formikRef = useRef(null);
    const [attachments, setAttachments] = useState({ existing: [], new: [] });
    const [emailState, setEmailState] = useState({ loading: false, error: '' });
    const [uiState, setUiState] = useState({
        isVisible: false, deleteConfirmOpen: false,
        closeConfirmOpen: false, isDirty: false,
    });

    useEffect(() => {
        requestAnimationFrame(() => setUiState(prev => ({ ...prev, isVisible: true })));
    }, []);

    useEffect(() => {
        if (user) setCurrentUser(user);
    }, [user]);

    const handleCloseAttempt = useCallback(() => {
        const formDirty = formikRef.current?.dirty || uiState.isDirty;
        if (formDirty && modalMode !== 'view') {
            setUiState(prev => ({ ...prev, closeConfirmOpen: true }));
        } else {
            setUiState(prev => ({ ...prev, isVisible: false }));
            setTimeout(onClose, 200);
        }
    }, [onClose, uiState.isDirty, modalMode]);

    const handleForceClose = useCallback(() => {
        setUiState(prev => ({ ...prev, closeConfirmOpen: false, isVisible: false }));
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
        const today = toDateString(new Date());

        if (modalType === 'task') {
            if (modalMode === 'edit' && task) {
                const deps = task.dependencyKeys || [];
                setDependencies(deps);

                let duration = 1;
                if (task.startDate && task.dueDate) {
                    const startMs = new Date(task.startDate);
                    const dueMs = new Date(task.dueDate);
                    const diff = Math.floor((dueMs - startMs) / MS_PER_DAY) + 1;
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
                setAttachments({ existing: task.attachments || [], new: [] });
            } else {
                setDependencies([]);
                setInitialValues(prev => ({
                    ...prev,
                    projectKey: project?.projectKey || '',
                    summary: '', description: '', status: 'TODO',
                    startDate: today, dueDate: today, assignee: '',
                    duration: 1, progress: 0, priority: 'MEDIUM', labels: '',
                    created: new Date().toLocaleString(),
                    updated: new Date().toLocaleString(),
                    reporter: user?.email || '',
                }));
                setAttachments({ existing: [], new: [] });
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
                setAttachments({ existing: project.attachments || [], new: [] });
            } else {
                setDependencies([]);
                setInitialValues({
                    projectKey: '', summary: '', description: '',
                    members: user ? [user] : [], newUserEmail: '',
                    status: 'TODO', startDate: '', dueDate: '', assignee: '',
                    duration: 1, progress: 0, priority: 'MEDIUM', labels: '',
                    created: '', updated: '', reporter: user?.email || '',
                });
                setAttachments({ existing: [], new: [] });
            }
        }
    }, [modalType, modalMode, project, task, user]);

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
                summary: Yup.string().required('Project name is required.')
            }
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
                    attachments: attachments.existing,
                };
                const projectKey = project?.projectKey || task?.projectKey || values.projectKey;
                if (modalMode === 'create') {
                    await createTask(projectKey, taskDTO, attachments.new);
                    showToast('Task created successfully', 'success');
                } else {
                    await updateTask(projectKey, task.taskKey, taskDTO, attachments.new);
                    showToast('Task updated successfully', 'success');
                }
            } else {
                const projectDTO = {
                    projectKey: values.projectKey.toUpperCase(),
                    summary: values.summary,
                    description: values.description,
                    members: values.members.map(u => ({ email: u.email })),
                    dependencies,
                    attachments: attachments.existing,
                };
                if (modalMode === 'create') {
                    await createProject(projectDTO, attachments.new);
                    showToast('Project created successfully', 'success');
                } else {
                    await updateProject(project.projectKey, projectDTO, attachments.new);
                    showToast('Project updated successfully', 'success');
                }
            }
            handleForceClose();
        } catch (err) {
            const message = err.response?.data?.message
                || err.message || 'Failed to save. Please try again.';
            showToast(message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteConfirm = async () => {
        setUiState(prev => ({ ...prev, deleteConfirmOpen: false }));
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
            const message = err.response?.data?.message
                || err.message || 'Failed to delete. Please try again.';
            showToast(message, 'error');
        }
    };

    const handleAddAttachments = (files) => {
        setAttachments(prev => ({ ...prev, new: [...prev.new, ...files] }));
        setUiState(prev => ({ ...prev, isDirty: true }));
    };

    const handleRemoveAttachment = (attachment) => {
        if (attachment instanceof File) {
            setAttachments(prev => ({ ...prev, new: prev.new.filter(f => f !== attachment) }));
        } else {
            setAttachments(prev => ({
                ...prev, existing: prev.existing.filter(a => a !== attachment),
            }));
        }
        setUiState(prev => ({ ...prev, isDirty: true }));
    };

    const handleAddMember = (email, values, setFieldValue) => {
        if (!email) return;
        const normalizedEmail = email.toLowerCase().trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setEmailState(prev => ({ ...prev, error: 'Invalid email format' }));
            return;
        }

        if (values.members.some(u => u.email === normalizedEmail)) {
            setEmailState(prev => ({ ...prev, error: 'Already added' }));
            return;
        }

        setEmailState(prev => ({ ...prev, error: '' }));
        setFieldValue('members', [...values.members, { email: normalizedEmail }]);
        setFieldValue('newUserEmail', '');
    };

    const modalTitle = modalType === 'task'
        ? (modalMode === 'create' ? 'Create Task' : 'Edit Task')
        : (modalMode === 'create' ? 'Create Project' : 'Edit Project');

    const deleteMessage = modalType === 'task'
        ? `Are you sure you want to delete "${task?.summary || 'this task'}"? This cannot be undone.`
        : `Are you sure you want to delete "${project?.summary || 'this project'}"? All tasks will be deleted.`;

    const overlayClasses =
        'fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 '
        + (uiState.isVisible ? 'opacity-100' : 'opacity-0');

    const modalClasses =
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[1400px]'
        + ' max-h-[90vh] bg-white shadow-2xl rounded-xl z-[70] flex flex-col'
        + ' transition-all duration-300 '
        + (uiState.isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0');

    const badgeClasses =
        'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide '
        + (modalMode === 'create' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700');

    const submitButtonClasses =
        'flex-1 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800'
        + ' transition-all font-semibold text-sm disabled:opacity-50'
        + ' flex items-center justify-center gap-2';

    return (
        <>
            <div
                className={overlayClasses}
                onClick={handleCloseAttempt}
                aria-hidden="true"
            />

            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                className={modalClasses}
            >
                <div className="flex-shrink-0 bg-white border-b border-slate-200 rounded-t-xl">
                    <div className="h-1 bg-slate-900 rounded-t-xl" />
                    <div className="px-6 py-4">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                {modalType === 'task' && modalMode === 'edit' && task && (
                                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs font-bold">
                                        {task.taskKey}
                                    </span>
                                )}
                                {modalType === 'project' && modalMode === 'edit' && project && (
                                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-xs font-bold">
                                        {project.projectKey}
                                    </span>
                                )}
                                <div>
                                    <span className={badgeClasses}>
                                        {modalMode === 'create' ? 'New' : 'Edit'}
                                    </span>
                                    <h2 id="modal-title" className="text-lg font-bold text-slate-900 mt-1">
                                        {modalTitle}
                                    </h2>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseAttempt}
                                aria-label="Close dialog"
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors group"
                            >
                                <HiOutlineX className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <Formik
                        innerRef={formikRef}
                        enableReinitialize
                        initialValues={initialValues}
                        validationSchema={validationSchema}
                        onSubmit={handleSubmit}
                    >
                        {({ setFieldValue, values, handleChange }) => (
                            <Form className="flex h-full">
                                {modalType === 'task' ? (
                                    <TaskForm
                                        values={values}
                                        setFieldValue={setFieldValue}
                                        handleChange={handleChange}
                                        modalMode={modalMode}
                                        task={task}
                                        project={project}
                                        projects={projects}
                                        currentUser={currentUser}
                                        dependencies={dependencies}
                                        setDependencies={setDependencies}
                                        existingAttachments={attachments.existing}
                                        newAttachments={attachments.new}
                                        onAddAttachments={handleAddAttachments}
                                        onRemoveAttachment={handleRemoveAttachment}
                                    />
                                ) : (
                                    <ProjectForm
                                        values={values}
                                        setFieldValue={setFieldValue}
                                        modalMode={modalMode}
                                        project={project}
                                        projects={projects}
                                        currentUser={currentUser}
                                        dependencies={dependencies}
                                        setDependencies={setDependencies}
                                        existingAttachments={attachments.existing}
                                        newAttachments={attachments.new}
                                        onAddAttachments={handleAddAttachments}
                                        onRemoveAttachment={handleRemoveAttachment}
                                        onAddMember={handleAddMember}
                                        emailLoading={emailState.loading}
                                        emailError={emailState.error}
                                    />
                                )}
                            </Form>
                        )}
                    </Formik>
                </div>

                <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 py-4 rounded-b-xl">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => formikRef.current?.submitForm()}
                            disabled={formikRef.current?.isSubmitting}
                            className={submitButtonClasses}
                        >
                            {modalMode === 'create' ? (
                                <HiOutlinePlus className="w-4 h-4" />
                            ) : (
                                <HiOutlineCheck className="w-4 h-4" />
                            )}
                            <span>{modalMode === 'create' ? 'Create' : 'Save Changes'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleCloseAttempt}
                            className={
                                'px-4 py-2.5 text-slate-600 hover:bg-slate-100'
                                + ' rounded-lg transition-colors text-sm font-medium'
                            }
                        >
                            Cancel
                        </button>
                        {modalMode === 'edit' && (
                            <button
                                type="button"
                                onClick={() => setUiState(prev => ({
                                    ...prev, deleteConfirmOpen: true,
                                }))}
                                className={
                                    'px-4 py-2.5 text-red-600 hover:bg-red-50'
                                    + ' rounded-lg transition-colors text-sm font-medium'
                                    + ' flex items-center gap-2'
                                }
                            >
                                <HiOutlineTrash className="w-4 h-4" />Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={uiState.deleteConfirmOpen}
                onClose={() => setUiState(prev => ({ ...prev, deleteConfirmOpen: false }))}
                onConfirm={handleDeleteConfirm}
                title={`Delete ${modalType === 'task' ? 'Task' : 'Project'}?`}
                message={deleteMessage}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />

            <ConfirmDialog
                isOpen={uiState.closeConfirmOpen}
                onClose={() => setUiState(prev => ({ ...prev, closeConfirmOpen: false }))}
                onConfirm={handleForceClose}
                title="Unsaved Changes"
                message="You have unsaved changes. Are you sure you want to close without saving?"
                confirmText="Discard"
                cancelText="Keep Editing"
                variant="warning"
            />
        </>
    );
};

export default TaskProjectModal;
