import { useMemo } from 'react';
import { flattenProjectTasks } from '../util/taskFlattening';

export const computeBlockedTasks = (allTasks, taskKeyMap) => {
    const blockedTasks = allTasks.filter(task => {
        if (!task.dependencies?.length) return false;
        if (task.progress === 100) return false;

        return task.dependencies.some(depKey => {
            const dep = taskKeyMap[depKey];
            return dep && dep.progress < 100;
        });
    });

    const blockedCriticalTasks = blockedTasks.filter(t => t.isCritical);

    return { blockedTasks, blockedCriticalTasks };
};

export const computeCrossProjectDependencies = (projects) => {
    return projects
        .filter(p => p.dependencies && p.dependencies.length > 0)
        .map(project => ({
            projectKey: project.projectKey,
            summary: project.summary,
            dependsOn: project.dependencies?.map(dep => ({
                key: dep.projectKey || dep,
                summary: projects.find(pr => pr.projectKey === dep.projectKey || pr.id === dep)?.summary,
            })) || [],
            dependencyCount: project.dependencies.length,
        }));
};

export const computeProjectCompletion = (projects) => {
    return projects.map(project => {
        const totalTasks = project.tasks?.length || 0;
        const totalProgress = project.tasks?.reduce((sum, t) => sum + (t.progress || 0), 0) || 0;

        return {
            projectKey: project.projectKey,
            summary: project.summary,
            completionPercentage: totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0,
        };
    });
};

/**
 * Hook that computes blocked task stats, cross-project dependencies, and project completion.
 * @param {Array} projects
 * @returns {Object} blockedTasks, blockedCriticalTasks, crossProjectDeps, projectCompletion
 */
export const useBlockedTaskStats = (projects) => {
    return useMemo(() => {
        const { allTasks, taskKeyMap } = flattenProjectTasks(projects);
        const { blockedTasks, blockedCriticalTasks } = computeBlockedTasks(allTasks, taskKeyMap);
        const crossProjectDeps = computeCrossProjectDependencies(projects);
        const projectCompletion = computeProjectCompletion(projects);

        return {
            blockedTasks,
            blockedCriticalTasks,
            crossProjectDeps,
            projectCompletion,
        };
    }, [projects]);
};
