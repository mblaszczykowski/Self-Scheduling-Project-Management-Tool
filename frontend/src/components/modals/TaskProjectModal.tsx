import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import * as Yup from 'yup';
import { HiOutlineTrash } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectsContext';
import TaskForm from './TaskForm';
import ProjectForm from './ProjectForm';
import ConfirmDialog, { trapFocus } from './ConfirmDialog';
import { useClickOutside } from '../../hooks/useClickOutside';
import useAttachments from '../../hooks/useAttachments';
import useModalFormInit from '../../hooks/useModalFormInit';
import { getErrorMessage } from '../../util/helpers';
import { showToast } from '../../util/toast';
import {
    Attachment, ModalFormValues, ModalMode, ModalType, Project, ProjectPayload, Task, TaskPayload,
} from '../../types';

// The one definition of "a valid email address" on the client, so a member email is held to the
// same standard as every other email field in the app (they all validate with Yup's `.email()`).
const EMAIL_SCHEMA = Yup.string().email();

interface TaskProjectModalProps {
    modalType: ModalType;
    modalMode: ModalMode;
    project?: Project | null;
    task?: Task | null;
    onClose: () => void;
}

const TaskProjectModal = ({ modalType, modalMode, project, task, onClose }: TaskProjectModalProps) => {
    const { user } = useAuth();
    const {
        projects,
        createTask,
        updateTask,
        deleteTask,
        createProject,
        updateProject,
        deleteProject,
    } = useProjects();

    const { attachments, setAttachments, handleAddAttachments, handleRemoveAttachment } = useAttachments();
    const { initialValues, validationSchema, dependencies, setDependencies } = useModalFormInit({
        modalType, modalMode, project, task, user, setAttachments,
    });

    const modalRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const formikRef = useRef<FormikProps<ModalFormValues>>(null);
    const [emailError, setEmailError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [uiState, setUiState] = useState({
        isVisible: false, deleteConfirmOpen: false,
        closeConfirmOpen: false, isDirty: false,
    });

    useEffect(() => {
        requestAnimationFrame(() => setUiState(prev => ({ ...prev, isVisible: true })));
    }, []);

    useEffect(() => {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        modalRef.current?.focus();
        return () => {
            previousFocusRef.current?.focus();
        };
    }, []);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const handleCloseAttempt = useCallback(() => {
        // `touched` is populated by onBlur, so requiring it here missed every edit made through
        // a control that never blurs in normal use (the Status/Priority <select> overlays, the
        // Progress range) — Formik's own `dirty` already tracks any value change and is enough.
        const isDirty = formikRef.current?.dirty || uiState.isDirty;
        if (isDirty) {
            setUiState(prev => ({ ...prev, closeConfirmOpen: true }));
        } else {
            setUiState(prev => ({ ...prev, isVisible: false }));
            setTimeout(onClose, 200);
        }
    }, [onClose, uiState.isDirty]);

    const handleForceClose = useCallback(() => {
        setUiState(prev => ({ ...prev, closeConfirmOpen: false, isVisible: false }));
        setTimeout(onClose, 150);
    }, [onClose]);

    useClickOutside(modalRef, handleCloseAttempt);

    // Close on Escape (parity with the react-modal based AccountModal), and keep Tab from
    // leaving the dialog into the obscured page behind it. Skipped while a ConfirmDialog is
    // open on top: that dialog traps focus within itself instead.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { handleCloseAttempt(); return; }
            if (uiState.deleteConfirmOpen || uiState.closeConfirmOpen) return;
            if (modalRef.current) trapFocus(modalRef.current, e);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [handleCloseAttempt, uiState.deleteConfirmOpen, uiState.closeConfirmOpen]);

    const handleSubmit = async (values: ModalFormValues, { setSubmitting }: FormikHelpers<ModalFormValues>) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            if (modalType === 'task') {
                const projectKey = project?.projectKey || task?.projectKey || values.projectKey;
                if (!projectKey) {
                    showToast('Please select a project', 'error');
                    setIsSaving(false);
                    setSubmitting(false);
                    return;
                }
                const payload: TaskPayload = {
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
                if (modalMode === 'create') {
                    await createTask(projectKey, payload, attachments.new);
                    showToast('Task created', 'success');
                } else {
                    if (!task) throw new Error('No task to update');
                    await updateTask(projectKey, task.taskKey, payload, attachments.new);
                    showToast('Task updated', 'success');
                }
            } else {
                const payload: ProjectPayload = {
                    // The key is immutable after creation, so an edit resubmits the existing one.
                    projectKey: (project?.projectKey ?? values.projectKey).toUpperCase(),
                    summary: values.summary,
                    description: values.description,
                    memberEmails: values.memberEmails,
                    dependencies,
                    attachments: attachments.existing,
                };
                if (modalMode === 'create') {
                    await createProject(payload, attachments.new);
                    showToast('Project created', 'success');
                } else {
                    if (!project) throw new Error('No project to update');
                    await updateProject(project.projectKey, payload, attachments.new);
                    showToast('Project updated', 'success');
                }
            }
            handleForceClose();
        } catch (err) {
            showToast(getErrorMessage(err, 'Failed to save'), 'error');
        } finally {
            setSubmitting(false);
            setIsSaving(false);
        }
    };

    const handleDeleteConfirm = async () => {
        setUiState(prev => ({ ...prev, deleteConfirmOpen: false }));
        try {
            if (modalType === 'task' && modalMode === 'edit') {
                if (!task) throw new Error('No task to delete');
                await deleteTask(project?.projectKey ?? task.projectKey, task.taskKey);
                showToast('Task deleted', 'success');
            } else if (modalType === 'project' && modalMode === 'edit') {
                if (!project) throw new Error('No project to delete');
                await deleteProject(project.projectKey);
                showToast('Project deleted', 'success');
            }
            handleForceClose();
        } catch (err) {
            showToast(getErrorMessage(err, 'Failed to delete'), 'error');
        }
    };

    const onAddAttachments = useCallback((files: File[]) => {
        handleAddAttachments(files);
        setUiState(prev => ({ ...prev, isDirty: true }));
    }, [handleAddAttachments]);

    const onRemoveAttachment = useCallback((attachment: Attachment) => {
        handleRemoveAttachment(attachment);
        setUiState(prev => ({ ...prev, isDirty: true }));
    }, [handleRemoveAttachment]);

    const handleAddMember = (
        email: string,
        values: ModalFormValues,
        setFieldValue: FormikHelpers<ModalFormValues>['setFieldValue'],
    ) => {
        if (!email) return;
        const normalizedEmail = email.toLowerCase().trim();
        if (!normalizedEmail) return;

        if (!EMAIL_SCHEMA.isValidSync(normalizedEmail)) {
            setEmailError('Invalid email format');
            return;
        }

        if (values.memberEmails.includes(normalizedEmail)) {
            setEmailError('Already added');
            return;
        }

        setEmailError('');
        setFieldValue('memberEmails', [...values.memberEmails, normalizedEmail]);
        setFieldValue('newUserEmail', '');
    };

    const entityKey = modalType === 'task'
        ? (modalMode === 'edit' && task ? task.taskKey : null)
        : (modalMode === 'edit' && project ? project.projectKey : null);

    const deleteMessage = modalType === 'task'
        ? `Are you sure you want to delete "${task?.summary || 'this task'}"? This cannot be undone.`
        : `Are you sure you want to delete "${project?.summary || 'this project'}"? All tasks will be deleted.`;

    return (
        <>
            <div
                className={
                    'fixed inset-0 z-[60] transition-opacity duration-200 '
                    + (uiState.isVisible
                        ? 'bg-black/50 opacity-100'
                        : 'bg-black/50 opacity-0')
                }
                onClick={handleCloseAttempt}
                aria-hidden="true"
            />

            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                aria-label={`${modalMode === 'create' ? 'Create' : 'Edit'} ${modalType}`}
                className={
                    'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                    + ' w-[92vw] max-w-[1200px] max-h-[88vh]'
                    + ' bg-white dark:bg-slate-800'
                    + ' border border-slate-200 dark:border-slate-700'
                    + ' rounded-xl z-[70] flex flex-col'
                    + ' shadow-2xl'
                    + ' transition-all duration-200 '
                    + (uiState.isVisible
                        ? 'scale-100 opacity-100 translate-y-[-50%]'
                        : 'scale-95 opacity-0 translate-y-[-50%]')
                }
            >
                <div className="flex-1 overflow-y-auto min-h-0">
                    <Formik
                        innerRef={formikRef}
                        enableReinitialize
                        initialValues={initialValues}
                        validationSchema={validationSchema}
                        onSubmit={handleSubmit}
                    >
                        {({ setFieldValue, values, handleChange }) => (
                            <Form className="flex flex-col md:flex-row h-full">
                                {modalType === 'task' ? (
                                    <TaskForm
                                        values={values}
                                        setFieldValue={setFieldValue}
                                        handleChange={handleChange}
                                        modalMode={modalMode}
                                        task={task}
                                        project={project}
                                        entityKey={entityKey}
                                        projects={projects}
                                        currentUser={user}
                                        dependencies={dependencies}
                                        setDependencies={setDependencies}
                                        existingAttachments={attachments.existing}
                                        newAttachments={attachments.new}
                                        onAddAttachments={onAddAttachments}
                                        onRemoveAttachment={onRemoveAttachment}
                                    />
                                ) : (
                                    <ProjectForm
                                        values={values}
                                        setFieldValue={setFieldValue}
                                        modalMode={modalMode}
                                        project={project}
                                        entityKey={entityKey}
                                        projects={projects}
                                        currentUser={user}
                                        dependencies={dependencies}
                                        setDependencies={setDependencies}
                                        existingAttachments={attachments.existing}
                                        newAttachments={attachments.new}
                                        onAddAttachments={onAddAttachments}
                                        onRemoveAttachment={onRemoveAttachment}
                                        onAddMember={handleAddMember}
                                        emailError={emailError}
                                    />
                                )}
                            </Form>
                        )}
                    </Formik>
                </div>

                <div className="flex-shrink-0 px-5 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 rounded-b-xl flex items-center gap-2">
                    {modalMode === 'edit' && (
                        <button
                            type="button"
                            onClick={() => setUiState(prev => ({
                                ...prev, deleteConfirmOpen: true,
                            }))}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        >
                            <HiOutlineTrash className="w-3.5 h-3.5" />
                            Delete
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={handleCloseAttempt}
                        className="px-3.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => formikRef.current?.submitForm()}
                        disabled={isSaving}
                        className={
                            'px-4 py-1.5 text-sm font-medium rounded-lg transition-colors'
                            + ' disabled:opacity-40 disabled:cursor-not-allowed'
                            + ' flex items-center gap-1.5'
                            + ' bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                            + ' hover:bg-slate-800 dark:hover:bg-slate-100'
                        }
                    >
                        {isSaving ? (
                            <>
                                <div className="w-3 h-3 border-[1.5px] border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span>{modalMode === 'create' ? 'Create' : 'Save'}</span>
                        )}
                    </button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={uiState.deleteConfirmOpen}
                onClose={() => setUiState(prev => ({ ...prev, deleteConfirmOpen: false }))}
                onConfirm={handleDeleteConfirm}
                title={`Delete ${modalType === 'task' ? 'task' : 'project'}?`}
                message={deleteMessage}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />

            <ConfirmDialog
                isOpen={uiState.closeConfirmOpen}
                onClose={() => setUiState(prev => ({ ...prev, closeConfirmOpen: false }))}
                onConfirm={handleForceClose}
                title="Discard unsaved changes?"
                message="Your changes haven't been saved. If you close now, all edits will be lost."
                confirmText="Discard"
                cancelText="Keep editing"
                variant="warning"
            />
        </>
    );
};

export default TaskProjectModal;
