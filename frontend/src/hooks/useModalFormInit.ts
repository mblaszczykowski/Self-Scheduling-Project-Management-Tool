import { useEffect, useMemo, useState } from 'react';
import * as Yup from 'yup';
import { formatDateTime, MS_PER_DAY, toDateString } from '../util/helpers';
import {
    AttachmentsState, CurrentUser, ModalFormValues, ModalMode, ModalType, Project, Task,
} from '../types';

const DEFAULT_VALUES: ModalFormValues = {
    projectKey: '', summary: '', description: '', status: 'TODO',
    startDate: '', dueDate: '', assignee: '', duration: 1, progress: 0,
    priority: 'MEDIUM', labels: '', created: '', updated: '',
    memberEmails: [], newUserEmail: '',
};

const emptyStringToNull = (value: unknown, originalValue: unknown) =>
    (originalValue === '' ? null : value);

const TASK_SCHEMA = Yup.object().shape({
    projectKey: Yup.string().required('Project is required.'),
    summary: Yup.string().required('Task summary is required.'),
    startDate: Yup.date().nullable().transform(emptyStringToNull),
    dueDate: Yup.date()
        .nullable()
        .transform(emptyStringToNull)
        .when('startDate', ([startDate], schema) =>
            (startDate ? schema.min(startDate, 'Due date cannot be before start date.') : schema)),
});

const projectSchema = (modalMode: ModalMode | null) => Yup.object().shape(
    modalMode === 'create'
        ? {
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
    project?: Project | null;
    task?: Task | null;
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
                    startDate: toDateString(task.startDate),
                    dueDate: toDateString(task.dueDate),
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
                memberEmails: user ? [user.email] : [],
            });
            setAttachments({ existing: [], new: [] });
        }
    }, [modalType, modalMode, project, task, user, setAttachments]);

    const memoizedProjectSchema = useMemo(() => projectSchema(modalMode), [modalMode]);
    const validationSchema = modalType === 'task' ? TASK_SCHEMA : memoizedProjectSchema;

    return { initialValues, validationSchema, dependencies, setDependencies };
};

export default useModalFormInit;
