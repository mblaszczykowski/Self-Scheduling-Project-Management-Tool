import { useEffect, useMemo, useRef, useState } from 'react';
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
    summary: Yup.string().trim().required('Task summary is required.').max(200, 'Max 200 characters.'),
    description: Yup.string().max(5000, 'Description is too long. Shorten the text or simplify its formatting.'),
    progress: Yup.number().integer().min(0).max(100).required(),
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
            summary: Yup.string().trim().required('Project name is required.').max(200, 'Max 200 characters.'),
            description: Yup.string().max(5000, 'Description is too long. Shorten the text or simplify its formatting.'),
        }
        : { summary: Yup.string().trim().required('Project name is required.').max(200, 'Max 200 characters.'),
            description: Yup.string().max(5000, 'Description is too long. Shorten the text or simplify its formatting.') }
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

const initialForm = ({ modalType, modalMode, project, task, user }: Options) => {
    const values = { ...DEFAULT_VALUES };
    if (modalType === 'task' && modalMode === 'edit' && task) {
        return {
            values: {
                ...values, projectKey: task.projectKey, summary: task.summary,
                description: task.description ?? '', status: task.status,
                startDate: toDateString(task.startDate), dueDate: toDateString(task.dueDate),
                assignee: task.assignee ?? '', duration: inclusiveDays(task.startDate, task.dueDate),
                progress: task.progress, priority: task.priority, labels: task.labels.join(' '),
                created: formatDateTime(task.created), updated: formatDateTime(task.updated),
            },
            dependencies: task.dependencyKeys,
            attachments: task.attachments,
        };
    }
    if (modalType === 'task') {
        const today = toDateString(new Date());
        return { values: { ...values, projectKey: project?.projectKey ?? '', startDate: today, dueDate: today }, dependencies: [], attachments: [] };
    }
    if (modalMode === 'edit' && project) {
        return {
            values: { ...values, projectKey: project.projectKey, summary: project.summary,
                description: project.description ?? '', memberEmails: project.members.map(member => member.email) },
            dependencies: project.dependencies,
            attachments: project.attachments,
        };
    }
    return { values: { ...values, memberEmails: user ? [user.email] : [] }, dependencies: [], attachments: [] };
};

const useModalFormInit = (options: Options) => {
    const { modalType, modalMode, project, task, user, setAttachments } = options;
    const initializedEntityRef = useRef<string | null>(null);
    // The first render must already contain valid defaults: an effect-driven reinitialization
    // can otherwise erase a user's selection made while the editor chunk is mounting.
    const [initialValues, setInitialValues] = useState<ModalFormValues>(() => initialForm(options).values);
    const [dependencies, setDependencies] = useState<string[]>(() => initialForm(options).dependencies);

    useEffect(() => {
        const entity = `${modalType}:${modalMode}:${modalType === 'task' ? task?.id ?? project?.id ?? '' : project?.id ?? ''}`;
        if (initializedEntityRef.current === entity) return;
        initializedEntityRef.current = entity;
        const initial = initialForm({ modalType, modalMode, project, task, user, setAttachments });
        setInitialValues(initial.values);
        setDependencies(initial.dependencies);
        setAttachments({ existing: initial.attachments, new: [] });
    }, [modalType, modalMode, project, task, user, setAttachments]);

    const memoizedProjectSchema = useMemo(() => projectSchema(modalMode), [modalMode]);
    const validationSchema = modalType === 'task' ? TASK_SCHEMA : memoizedProjectSchema;

    return { initialValues, validationSchema, dependencies, setDependencies };
};

export default useModalFormInit;
