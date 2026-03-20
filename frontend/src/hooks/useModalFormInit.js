import { useEffect, useState } from 'react';
import * as Yup from 'yup';
import { formatDateTime, formatDate, MS_PER_DAY, toDateString } from '../util/helpers';

const defaultValues = {
    projectKey: '', summary: '', description: '', status: 'TODO',
    startDate: '', dueDate: '', assignee: '', duration: 1, progress: 0,
    priority: 'MEDIUM', labels: '', created: '', updated: '',
    reporter: '', members: [], newUserEmail: '',
};

const taskValidationSchema = Yup.object().shape({
    projectKey: Yup.string().required('Project is required.'),
    summary: Yup.string().required('Task summary is required.'),
    startDate: Yup.date().required('Start date is required.'),
    dueDate: Yup.date()
        .required('Due date is required.')
        .min(Yup.ref('startDate'), 'Due date cannot be before start date.'),
});

const buildProjectValidationSchema = (modalMode) =>
    Yup.object().shape(
        modalMode === 'create'
            ? {
                projectKey: Yup.string().max(4, 'Max 4 characters.').required('Project key is required.'),
                summary: Yup.string().required('Project name is required.')
            }
            : { summary: Yup.string().required('Project name is required.') }
    );

/**
 * Builds initialValues, validationSchema, and dependencies state
 * based on modalType / modalMode / project / task.
 *
 * @param {{ modalType, modalMode, project, task, user, setAttachments }} opts
 * @returns {{ initialValues, validationSchema, dependencies, setDependencies }}
 */
const useModalFormInit = ({ modalType, modalMode, project, task, user, setAttachments }) => {
    const [dependencies, setDependencies] = useState([]);
    const [initialValues, setInitialValues] = useState(defaultValues);

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
    }, [modalType, modalMode, project, task, user, setAttachments]);

    const validationSchema = modalType === 'task'
        ? taskValidationSchema
        : buildProjectValidationSchema(modalMode);

    return { initialValues, validationSchema, dependencies, setDependencies };
};

export default useModalFormInit;
