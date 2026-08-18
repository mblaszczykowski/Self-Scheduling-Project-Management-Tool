import { useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { NavigateFunction, Location } from 'react-router-dom';
import {
    EnrichedTask, FilterState, ModalMode, ModalType, ProcessedProject, SortState, ViewState,
} from '../types';

interface UseUrlSyncedFiltersOptions {
    filterState: FilterState;
    setFilterState: Dispatch<SetStateAction<FilterState>>;
    setViewState: Dispatch<SetStateAction<ViewState>>;
    processedProjects: ProcessedProject[];
    navigate: NavigateFunction;
    location: Location;
    openModal: (type: ModalType, mode: ModalMode, project: ProcessedProject, task: EnrichedTask) => void;
    setSortState: Dispatch<SetStateAction<SortState>>;
}

export function useUrlSyncedFilters({
    filterState, setFilterState, setViewState,
    processedProjects, navigate, location, openModal, setSortState,
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
            // Returning a fresh object unconditionally re-rendered — and re-persisted to
            // localStorage — on every projects refetch, since processedProjects gets a new identity
            // each time.
            return changed ? { ...prev, expandedProjects: updated } : prev;
        });
    }, [processedProjects, location.search, setViewState]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('critical') === 'true') {
            setFilterState(prev => ({
                ...prev, filters: { ...prev.filters, criticality: 'Critical' },
            }));
        }
        if (params.get('delayed') === 'true') {
            setFilterState(prev => ({
                ...prev, filters: { ...prev.filters, delayed: 'Delayed' },
            }));
        }
        if (params.get('upcomingDeadline') === 'true') {
            setFilterState(prev => ({
                ...prev, filters: { ...prev.filters, delayed: 'Upcoming deadline' },
            }));
        }
        if (params.get('delayedByDependency') === 'true') {
            setFilterState(prev => ({
                ...prev, filters: { ...prev.filters, delayed: 'Delayed by dependency' },
            }));
        }
        if (params.get('assignedToMe') === 'true') {
            setFilterState(prev => ({ ...prev, assignedToMe: true }));
        }

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
            300,
        );
        return () => clearTimeout(timer);
    }, [filterState.searchInput, setFilterState]);

    const closeFilterDropdown = useCallback(
        () => setFilterState(prev => ({ ...prev, openFilterDropdown: null })),
        [setFilterState],
    );

    const clearAllFilters = useCallback(() => {
        setFilterState({
            filters: {}, searchInput: '', searchQuery: '',
            assignedToMe: false, openFilterDropdown: null,
        });
        navigate('/projects');
    }, [setFilterState, navigate]);

    const handleFilterChange = useCallback((field: string, value: string) => {
        setFilterState(prev => ({
            ...prev, filters: { ...prev.filters, [field]: value },
        }));
        const params = new URLSearchParams(location.search);
        if (field === 'criticality') {
            value === 'Critical' ? params.set('critical', 'true') : params.delete('critical');
        }
        if (field === 'delayed') {
            ['delayed', 'upcomingDeadline', 'delayedByDependency'].forEach(k => params.delete(k));
            if (value === 'Delayed') params.set('delayed', 'true');
            else if (value === 'Upcoming deadline') params.set('upcomingDeadline', 'true');
            else if (value === 'Delayed by dependency') params.set('delayedByDependency', 'true');
        }
        // replace, not push: otherwise every filter tweak becomes a separate Back step.
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

    const handleSort = useCallback((field: string) => {
        setSortState(prev => ({
            field,
            order: (prev.field === field && prev.order === 'asc' ? 'desc' : 'asc') as SortState['order'],
        }));
    }, [setSortState]);

    const projectKeyFilter = new URLSearchParams(location.search).get('projectKey');

    return {
        handleFilterChange, handleProjectFilterChange, handleAssignedToMeChange,
        handleSort, clearAllFilters, projectKeyFilter, closeFilterDropdown,
    };
}
