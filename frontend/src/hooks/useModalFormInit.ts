import { useEffect, useState } from 'react';
import * as Yup from 'yup';
import { formatDate, formatDateTime, MS_PER_DAY, toDateString } from '../util/helpers';
import {
    AttachmentsState, CurrentUser, ModalFormValues, ModalMode, ModalType, Project, Task,
} from '../types';

const DEFAULT_VALUES: ModalFormValues = {
    projectKey: '', summary: '', description: '', status: 'TODO',
    startDate: '', dueDate: '', assignee: '', duration: 1, progress: 0,
    priority: 'MEDIUM', labels: '', created: '', updated: '',
    memberEmails: [], newUserEmail: '',
};

const TASK_SCHEMA = Yup.object().shape({
    projectKey: Yup.string().required('Project is required.'),
    summary: Yup.string().required('Task summary is required.'),
    startDate: Yup.date().required('Start date is required.'),
    dueDate: Yup.date()
        .required('Due date is required.')
        .min(Yup.ref('startDate'), 'Due date cannot be before start date.'),
});

const projectSchema = (modalMode: ModalMode | null) => Yup.object().shape(
    modalMode === 'create'
        ? {
            // Mirrors the server's own rule, so the form rejects what the API would reject.
            projectKey: Yup.string()
                .max(10, 'Max 10 characters.')
                .matches(/^[A-Z][A-Z0-9]*$/, 'Uppercase letters and digits, starting with a letter.')
                .required('Project key is required.'),
            summary: Yup.string().required('Project name is required.'),
        }
        : { summary: Yup.string().required('Project name is required.') }
);

interface Options {
    modalType: ModalType;
    modalMode: ModalMode;
    project: Project | null;
    task: Task | null;
    user: CurrentUser | null;
    setAttachments: (attachments: AttachmentsState) => void;
}

const inclusiveDays = (startDate?: string | null, dueDate?: string | null): number => {
    if (!startDate || !dueDate) return 1;
    const start = new Date(startDate).getTime();
    const due = new Date(dueDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(due)) return 1;
    return Math.max(1, Math.floor((due - start) / MS_PER_DAY) + 1);
};

/** Builds the form's initial values, its validation schema, and the dependency list. */
const useModalFormInit = ({ modalType, modalMode, project, task, user, setAttachments }: Options) => {
    const [dependencies, setDependencies] = useState<string[]>([]);
    const [initialValues, setInitialValues] = useState<ModalFormValues>(DEFAULT_VALUES);

    useEffect(() => {
        const today = toDateString(new Date());

        if (modalType === 'task') {
            if (modalMode !== 'create' && task) {
                setDependencies(task.dependencyKeys);
                setInitialValues({
                    ...DEFAULT_VALUES,
                    projectKey: task.projectKey,
                    summary: task.summary,
                    description: task.description ?? '',
                    status: task.status,
                    startDate: formatDate(task.startDate),
                    dueDate: formatDate(task.dueDate),
                    assignee: task.assignee ?? '',
                    duration: inclusiveDays(task.startDate, task.dueDate),
                    progress: task.progress,
                    priority: task.priority,
                    labels: task.labels.join(' '),
                    created: formatDateTime(task.created),
                    updated: formatDateTime(task.updated),
                });
                setAttachments({ existing: task.attachments, new: [] });
            } else {
                setDependencies([]);
                setInitialValues({
                    ...DEFAULT_VALUES,
                    projectKey: project?.projectKey ?? '',
                    startDate: today,
                    dueDate: today,
                });
                setAttachments({ existing: [], new: [] });
            }
            return;
        }

        if (modalMode !== 'create' && project) {
            setDependencies(project.dependencies);
            setInitialValues({
                ...DEFAULT_VALUES,
                projectKey: project.projectKey,
                summary: project.summary,
                description: project.description ?? '',
                memberEmails: project.members.map((member) => member.email),
            });
            setAttachments({ existing: project.attachments, new: [] });
        } else {
            setDependencies([]);
            setInitialValues({
                ...DEFAULT_VALUES,
                // The creator is a member of their own project from the start.
                memberEmails: user ? [user.email] : [],
            });
            setAttachments({ existing: [], new: [] });
        }
    }, [modalType, modalMode, project, task, user, setAttachments]);

    const validationSchema = modalType === 'task' ? TASK_SCHEMA : projectSchema(modalMode);

    return { initialValues, validationSchema, dependencies, setDependencies };
};

export default useModalFormInit;
