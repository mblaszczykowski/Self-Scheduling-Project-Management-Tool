import { Task } from '../types';

// Task dates are ISO date-only strings (YYYY-MM-DD), which sort lexicographically.
// Comparing the strings directly avoids parsing into Date (and the timezone
// round-trip / NaN-on-bad-input crash that Math.min(...new Date()) caused).
export const computeProjectDateRange = (tasks?: Task[]) => {
    const valid = (tasks || []).filter(t => t.startDate && t.dueDate);
    if (!valid.length) return { projectStartDate: null, projectDueDate: null };
    let projectStartDate = valid[0].startDate as string;
    let projectDueDate = valid[0].dueDate as string;
    for (const t of valid) {
        if ((t.startDate as string) < projectStartDate) projectStartDate = t.startDate as string;
        if ((t.dueDate as string) > projectDueDate) projectDueDate = t.dueDate as string;
    }
    return { projectStartDate, projectDueDate };
};

export const computeProjectProgress = (tasks?: Task[]): number => {
    if (!tasks?.length) return 0;
    const totalProgress = tasks.reduce((acc, t) => acc + (t.progress ?? 0), 0);
    return Math.round(totalProgress / tasks.length);
};
