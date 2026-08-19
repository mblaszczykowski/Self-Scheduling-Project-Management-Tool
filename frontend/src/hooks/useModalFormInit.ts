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

// A date <input> yields '' when cleared. Yup's date type otherwise treats '' as an invalid date
// rather than "no date" (it fails the ISO parse and lands on its own type-error), so this coerces
// it to null before that check runs — the same "empty means absent" treatment applied to the
// optional password fields in AccountModal, just via `.transform` instead of a plain function,
// because a date's raw value has to survive to the cross-field check below.
const emptyStringToNull = (value: unknown, originalValue: unknown) =>
    (originalValue === '' ? null : value);

// TaskRequest accepts both dates as null; its only cross-field rule is due-not-before-start,
// which the backend itself treats as vacuously true when either side is missing. `dueDate`'s
// `.min` is skipped by Yup whenever the (cast) value is null, so attaching it only when a raw
// `startDate` is present is enough to mirror that exactly — a task with no dates, one date, or a
// valid range all pass; only an inverted range with both dates set is rejected.
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
                // The creator is a member of their own project from the start.
                memberEmails: user ? [user.email] : [],
            });
            setAttachments({ existing: [], new: [] });
        }
    }, [modalType, modalMode, project, task, user, setAttachments]);

    // Unlike TASK_SCHEMA (a stable module constant), projectSchema(modalMode) builds a fresh Yup
    // object every call; memoizing keeps its identity stable across renders that don't change
    // modalMode, matching what every consumer of `validationSchema` already assumes.
    const memoizedProjectSchema = useMemo(() => projectSchema(modalMode), [modalMode]);
    const validationSchema = modalType === 'task' ? TASK_SCHEMA : memoizedProjectSchema;

    return { initialValues, validationSchema, dependencies, setDependencies };
};

export default useModalFormInit;
