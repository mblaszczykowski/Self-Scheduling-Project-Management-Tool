import { useMemo, useCallback } from 'react';
import { toDateString } from '../util/helpers';

const matchesTimeStatus = (task, statusFilter) => {
    const statusMatchers = {
        'Delayed': () => task.isDelayed,
        'On Time': () => !task.isDelayed && !task.isUpcomingDeadline && !task.isDelayedByDependency,
        'Upcoming deadline': () => task.isUpcomingDeadline,
        'Delayed by dependency': () => task.isDelayedByDependency,
    };
    return statusMatchers[statusFilter]?.() ?? false;
};

const taskMatchesFilter = (task, filterField, filterValue) => {
    if (!filterValue || filterValue === 'All') return true;

    switch (filterField) {
        case 'labels':
            return task.labels?.includes(filterValue);
        case 'assignee':
            return task.assignee === filterValue;
        case 'startDate':
        case 'dueDate':
            return task[filterField] && toDateString(task[filterField]) === filterValue;
        case 'priority':
            return task.priority === filterValue;
        case 'criticality':
            return filterValue === 'Critical' ? task.isCritical : !task.isCritical;
        case 'delayed':
            return matchesTimeStatus(task, filterValue);
        default:
            return task[filterField] === filterValue;
    }
};

const PRIORITY_ORDER = {
    'LOWEST': 1,
    'LOW': 2,
    'MEDIUM': 3,
    'HIGH': 4,
    'HIGHEST': 5,
};

const getSortValue = (task, field) => {
    const value = task[field];

    if (['startDate', 'dueDate'].includes(field)) {
        return new Date(value);
    }
    if (['progress', 'duration'].includes(field)) {
        return Number(value);
    }
    if (['isCritical', 'isDelayed'].includes(field)) {
        return value ? 1 : 0;
    }
    if (field === 'priority') {
        return PRIORITY_ORDER[value] || 0;
    }
    return value;
};

const applyUrlFilters = (tasks, urlParams, userEmail) => {
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

const applyStateFilters = (tasks, filters) => {
    return tasks.filter(task =>
        Object.entries(filters).every(([field, value]) => taskMatchesFilter(task, field, value))
    );
};

const applyAssignedToMeFilter = (tasks, assignedToMe, user) => {
    if (!assignedToMe || !user?.email) return tasks;

    return tasks.filter(task =>
        task.assignee === user.email || task.assignee === `${user.firstname} ${user.lastname}`
    );
};

const applySearchFilter = (tasks, searchQuery) => {
    if (!searchQuery?.trim()) return tasks;

    const query = searchQuery.toLowerCase();
    return tasks.filter(task => task.summary.toLowerCase().includes(query));
};

const applySorting = (tasks, sortField, sortOrder) => {
    return [...tasks].sort((a, b) => {
        const valueA = getSortValue(a, sortField);
        const valueB = getSortValue(b, sortField);

        if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
};

export const useTaskFiltering = ({
    tasks,
    filters,
    searchQuery,
    assignedToMe,
    currentUser,
    sortField,
    sortOrder,
    urlParams,
}) => {
    const filteredTasks = useMemo(() => {
        let result = tasks;

        result = applyUrlFilters(result, urlParams, currentUser?.email);
        result = applyStateFilters(result, filters);
        result = applyAssignedToMeFilter(result, assignedToMe, currentUser);
        result = applySearchFilter(result, searchQuery);
        result = applySorting(result, sortField, sortOrder);

        return result;
    }, [tasks, filters, searchQuery, assignedToMe, currentUser, sortField, sortOrder, urlParams]);

    const hasActiveFilters = useCallback(() => {
        const params = new URLSearchParams(urlParams);
        const hasStateFilters = Object.values(filters).some(v => v && v !== 'All');
        const hasSearch = searchQuery?.trim();
        const hasProjectFilter = params.get('projectKey');

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
