import { useMemo, useCallback } from 'react';
import { toDateString } from '../util/helpers';
import { EnrichedTask, User } from '../types';

const matchesTimeStatus = (task: EnrichedTask, statusFilter: string): boolean => {
    const statusMatchers: Record<string, () => boolean> = {
        'Delayed': () => task.isDelayed,
        'On Time': () => !task.isDelayed && !task.isUpcomingDeadline && !task.isDelayedByDependency,
        'Upcoming deadline': () => task.isUpcomingDeadline,
        'Delayed by dependency': () => task.isDelayedByDependency,
    };
    return statusMatchers[statusFilter]?.() ?? false;
};

const taskMatchesFilter = (task: EnrichedTask, filterField: string, filterValue: string): boolean => {
    if (!filterValue || filterValue === 'All') return true;

    switch (filterField) {
        case 'labels':
            return !!task.labels?.includes(filterValue);
        case 'assignee':
            // FilterBar surfaces unassigned tasks under the 'Unassigned' option,
            // but the raw value is null/'' — match it explicitly.
            return filterValue === 'Unassigned' ? !task.assignee : task.assignee === filterValue;
        case 'startDate':
        case 'dueDate': {
            const value = task[filterField];
            return !!value && toDateString(value) === filterValue;
        }
        case 'priority':
            return task.priority === filterValue;
        case 'criticality':
            return filterValue === 'Critical' ? !!task.isCritical : !task.isCritical;
        case 'delayed':
            return matchesTimeStatus(task, filterValue);
        default:
            return task[filterField as keyof EnrichedTask] === filterValue;
    }
};

const PRIORITY_ORDER: Record<string, number> = {
    'LOWEST': 1,
    'LOW': 2,
    'MEDIUM': 3,
    'HIGH': 4,
    'HIGHEST': 5,
};

const getSortValue = (task: EnrichedTask, field: string): string | number | Date => {
    const value = task[field as keyof EnrichedTask];

    if (field === 'startDate' || field === 'dueDate') {
        return new Date(value as string);
    }
    if (field === 'progress' || field === 'duration') {
        return Number(value);
    }
    if (field === 'isCritical' || field === 'isDelayed') {
        return value ? 1 : 0;
    }
    if (field === 'priority') {
        return PRIORITY_ORDER[value as string] || 0;
    }
    return (value as string | number | Date) ?? '';
};

const applyUrlFilters = (tasks: EnrichedTask[], urlParams: string): EnrichedTask[] => {
    const params = new URLSearchParams(urlParams);
    let filtered = [...tasks];

    const projectKey = params.get('projectKey');
    if (projectKey) {
        filtered = filtered.filter(t => t.projectKey === projectKey);
    }

    if (params.get('critical') === 'true') {
        filtered = filtered.filter(t => t.isCritical);
    }

    if (params.get('upcomingDeadline') === 'true') {
        filtered = filtered.filter(t => t.isUpcomingDeadline);
    } else if (params.get('delayedByDependency') === 'true') {
        filtered = filtered.filter(t => t.isDelayedByDependency);
    } else if (params.get('delayed') === 'true') {
        filtered = filtered.filter(t => t.isDelayed);
    }

    return filtered;
};

const applyStateFilters = (tasks: EnrichedTask[], filters: Record<string, string>): EnrichedTask[] => {
    return tasks.filter(task =>
        Object.entries(filters).every(([field, value]) => taskMatchesFilter(task, field, value))
    );
};

const applyAssignedToMeFilter = (tasks: EnrichedTask[], assignedToMe: boolean, user: User | null): EnrichedTask[] => {
    if (!assignedToMe || !user?.email) return tasks;

    return tasks.filter(task =>
        task.assignee === user.email || task.assignee === `${user.firstname} ${user.lastname}`
    );
};

const applySearchFilter = (tasks: EnrichedTask[], searchQuery: string): EnrichedTask[] => {
    if (!searchQuery?.trim()) return tasks;

    const query = searchQuery.toLowerCase();
    return tasks.filter(task => (task.summary || '').toLowerCase().includes(query));
};

const applySorting = (tasks: EnrichedTask[], sortField: string, sortOrder: string): EnrichedTask[] => {
    return [...tasks].sort((a, b) => {
        const valueA = getSortValue(a, sortField);
        const valueB = getSortValue(b, sortField);

        if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
};

interface UseTaskFilteringOptions {
    tasks: EnrichedTask[];
    filters: Record<string, string>;
    searchQuery: string;
    assignedToMe: boolean;
    currentUser: User | null;
    sortField: string;
    sortOrder: string;
    urlParams: string;
}

export const useTaskFiltering = ({
    tasks,
    filters,
    searchQuery,
    assignedToMe,
    currentUser,
    sortField,
    sortOrder,
    urlParams,
}: UseTaskFilteringOptions) => {
    const filteredTasks = useMemo(() => {
        let result = tasks;

        result = applyUrlFilters(result, urlParams);
        result = applyStateFilters(result, filters);
        result = applyAssignedToMeFilter(result, assignedToMe, currentUser);
        result = applySearchFilter(result, searchQuery);
        result = applySorting(result, sortField, sortOrder);

        return result;
    }, [tasks, filters, searchQuery, assignedToMe, currentUser, sortField, sortOrder, urlParams]);

    const hasActiveFilters = useCallback((): boolean => {
        const params = new URLSearchParams(urlParams);
        const hasStateFilters = Object.values(filters).some(v => v && v !== 'All');
        const hasSearch = !!searchQuery?.trim();
        const hasProjectFilter = !!params.get('projectKey');

        return hasStateFilters || hasSearch || assignedToMe || hasProjectFilter;
    }, [filters, searchQuery, assignedToMe, urlParams]);

    const filteredTaskIds = useMemo(() => new Set(filteredTasks.map(t => t.id)), [filteredTasks]);
    const filteredProjectKeys = useMemo(() => new Set(filteredTasks.map(t => t.projectKey)), [filteredTasks]);

    return {
        filteredTasks,
        filteredTaskIds,
        filteredProjectKeys,
        hasActiveFilters,
    };
};

export default useTaskFiltering;
