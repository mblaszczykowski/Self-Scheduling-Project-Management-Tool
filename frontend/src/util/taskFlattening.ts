import { Project, Task } from '../types';

/**
 * Flattens tasks from all projects into a single array and builds a lookup map.
 */
export const flattenProjectTasks = (projects: Project[]) => {
    const taskKeyMap: Record<string, Task> = {};
    const allTasks: Task[] = [];

    projects.forEach(project => {
        project.tasks?.forEach(task => {
            const progress = task.progress ?? 0;
            const dependencies = task.dependencyKeys || [];

            const taskData = {
                ...task,
                projectKey: project.projectKey,
                progress,
                dependencies,
            };

            allTasks.push(taskData);
            taskKeyMap[task.taskKey] = taskData;
        });
    });

    return { allTasks, taskKeyMap };
};
