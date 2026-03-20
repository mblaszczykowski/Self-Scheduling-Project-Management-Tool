/**
 * Flattens tasks from all projects into a single array and builds a lookup map.
 * @param {Array} projects - Array of project objects, each with a `tasks` array.
 * @returns {{ allTasks: Array, taskKeyMap: Object }}
 */
export const flattenProjectTasks = (projects) => {
    const taskKeyMap = {};
    const allTasks = [];

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
