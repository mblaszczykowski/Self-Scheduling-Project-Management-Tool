import { useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { NavigateFunction, Location } from 'react-router-dom';
import config from '../config';
import {
    EnrichedTask, FilterState, ModalMode, ModalType, ProcessedProject, ViewState,
} from '../types';

interface UseUrlSyncedFiltersOptions {
    filterState: FilterState;
    setFilterState: Dispatch<SetStateAction<FilterState>>;
    setViewState: Dispatch<SetStateAction<ViewState>>;
    processedProjects: ProcessedProject[];
    navigate: NavigateFunction;
    location: Location;
    openModal: (type: ModalType, mode: ModalMode, project: ProcessedProject, task: EnrichedTask) => void;
}

export function useUrlSyncedFilters({
    filterState, setFilterState, setViewState,
    processedProjects, navigate, location, openModal,
}: UseUrlSyncedFiltersOptions) {
    const handledIssueRef = useRef<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const projectKeyFilter = params.get('projectKey');

        setViewState(prev => {
            const updated = { ...prev.expandedProjects };
            let changed = false;
            processedProjects.forEach(p => {
                if (!(p.projectKey in updated)) {
                    updated[p.projectKey] = projectKeyFilter
                        ? p.projectKey === projectKeyFilter : true;
                    changed = true;
                }
            });
            return changed ? { ...prev, expandedProjects: updated } : prev;
        });
    }, [processedProjects, location.search, setViewState]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setFilterState(prev => {
            const filters = { ...prev.filters };
            if (params.get('critical') === 'true') filters.criticality = 'Critical';
            else if (params.get('critical') === 'false') filters.criticality = 'Non-Critical';
            else delete filters.criticality;
            if (params.get('delayedByDependency') === 'true') filters.delayed = 'Delayed by dependency';
            else if (params.get('upcomingDeadline') === 'true') filters.delayed = 'Upcoming deadline';
            else if (params.get('delayed') === 'true') filters.delayed = 'Delayed';
            else if (params.get('timeStatus') === 'onTime') filters.delayed = 'On Time';
            else delete filters.delayed;
            const assignedToMe = params.get('assignedToMe') === 'true';
            if (JSON.stringify(filters) === JSON.stringify(prev.filters) && assignedToMe === prev.assignedToMe) return prev;
            return { ...prev, filters, assignedToMe };
        });

        const selectedIssue = params.get('selectedIssue');
        if (!selectedIssue) {
            handledIssueRef.current = null;
            return;
        }
        if (selectedIssue === handledIssueRef.current) return;
        if (processedProjects.length > 0) {
            for (const project of processedProjects) {
                const task = project.tasks.find(t => t.taskKey === selectedIssue);
                if (task) {
                    openModal('task', 'edit', project, task);
                    handledIssueRef.current = selectedIssue;
                    break;
                }
            }
        }
    }, [location.search, processedProjects, openModal, setFilterState]);

    useEffect(() => {
        const timer = setTimeout(
            () => setFilterState(prev => ({ ...prev, searchQuery: prev.searchInput })),
            config.DEBOUNCE_DELAY,
        );
        return () => clearTimeout(timer);
    }, [filterState.searchInput, setFilterState]);

    const clearAllFilters = useCallback(() => {
        setFilterState({
            filters: {}, searchInput: '', searchQuery: '',
            assignedToMe: false, openFilterDropdown: null,
        });
        navigate('/projects', { replace: true });
    }, [setFilterState, navigate]);

    const handleFilterChange = useCallback((field: string, value: string) => {
        setFilterState(prev => ({
            ...prev, filters: { ...prev.filters, [field]: value },
        }));
        const params = new URLSearchParams(location.search);
        if (field === 'criticality') {
            if (value === 'Critical') params.set('critical', 'true');
            else if (value === 'Non-Critical') params.set('critical', 'false');
            else params.delete('critical');
        }
        if (field === 'delayed') {
            ['delayed', 'upcomingDeadline', 'delayedByDependency', 'timeStatus'].forEach(k => params.delete(k));
            if (value === 'On Time') params.set('timeStatus', 'onTime');
            else if (value === 'Delayed') params.set('delayed', 'true');
            else if (value === 'Upcoming deadline') params.set('upcomingDeadline', 'true');
            else if (value === 'Delayed by dependency') params.set('delayedByDependency', 'true');
        }
        navigate({ search: params.toString() }, { replace: true });
    }, [setFilterState, navigate, location.search]);

    const handleProjectFilterChange = useCallback((value: string) => {
        const params = new URLSearchParams(location.search);
        value === 'All' ? params.delete('projectKey') : params.set('projectKey', value);
        navigate({ search: params.toString() }, { replace: true });
    }, [navigate, location.search]);

    const handleAssignedToMeChange = useCallback(() => {
        const newValue = !filterState.assignedToMe;
        setFilterState(prev => ({ ...prev, assignedToMe: newValue }));
        const params = new URLSearchParams(location.search);
        newValue ? params.set('assignedToMe', 'true') : params.delete('assignedToMe');
        navigate({ search: params.toString() }, { replace: true });
    }, [filterState.assignedToMe, setFilterState, navigate, location.search]);

    const projectKeyFilter = new URLSearchParams(location.search).get('projectKey');

    return {
        handleFilterChange, handleProjectFilterChange, handleAssignedToMeChange,
        clearAllFilters, projectKeyFilter,
    };
}
