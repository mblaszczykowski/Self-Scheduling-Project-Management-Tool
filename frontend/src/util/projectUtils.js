import { toDateString } from './helpers';

export const computeProjectDateRange = (tasks) => {
    if (!tasks?.length) return { projectStartDate: null, projectDueDate: null };
    const startDates = tasks.map(t => new Date(t.startDate));
    const dueDates = tasks.map(t => new Date(t.dueDate));
    return {
        projectStartDate: toDateString(Math.min(...startDates)),
        projectDueDate: toDateString(Math.max(...dueDates)),
    };
};

export const computeProjectProgress = (tasks) => {
    if (!tasks?.length) return 0;
    const totalProgress = tasks.reduce((acc, t) => acc + (t.progress ?? 0), 0);
    return Math.round(totalProgress / tasks.length);
};
