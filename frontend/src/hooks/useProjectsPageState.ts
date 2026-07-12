import { useState, useEffect } from 'react';
import { FilterState, SortState, ViewState } from '../types';

const DEFAULT_FILTER_STATE: FilterState = {
    filters: {}, searchInput: '', searchQuery: '', assignedToMe: false, openFilterDropdown: null,
};
const DEFAULT_SORT_STATE: SortState = { field: 'id', order: 'asc' };
const DEFAULT_VIEW_STATE: ViewState = { mode: 'timeline', sidebarCollapsed: false, expandedProjects: {} };

function loadJson<T>(key: string): T | null {
    try { return JSON.parse(localStorage.getItem(key) as string) as T; } catch { return null; }
}

export function useProjectsPageState() {
    const [filterState, setFilterState] = useState<FilterState>(() => {
        const saved = loadJson<FilterState>('flowlink_filters');
        if (saved) return { ...saved, openFilterDropdown: null, searchQuery: saved.searchInput || '' };
        return DEFAULT_FILTER_STATE;
    });

    const [sortState, setSortState] = useState<SortState>(() => {
        return loadJson<SortState>('flowlink_sort') || DEFAULT_SORT_STATE;
    });

    const [viewState, setViewState] = useState<ViewState>(() => {
        const saved = loadJson<ViewState>('flowlink_view');
        if (saved) return { ...saved, expandedProjects: saved.expandedProjects || {} };
        return DEFAULT_VIEW_STATE;
    });

    useEffect(() => {
        const { openFilterDropdown, searchQuery, ...toSave } = filterState;
        // Debounced so typing in the search box doesn't write to localStorage on
        // every keystroke.
        const timer = setTimeout(() => {
            localStorage.setItem('flowlink_filters', JSON.stringify(toSave));
        }, 400);
        return () => clearTimeout(timer);
    }, [filterState]);

    useEffect(() => {
        localStorage.setItem('flowlink_sort', JSON.stringify(sortState));
    }, [sortState]);

    useEffect(() => {
        const { expandedProjects, ...toSave } = viewState;
        localStorage.setItem('flowlink_view', JSON.stringify(toSave));
    }, [viewState]);

    return { filterState, setFilterState, sortState, setSortState, viewState, setViewState };
}
