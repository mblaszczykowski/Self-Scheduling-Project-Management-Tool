import { useState, useEffect } from 'react';

const DEFAULT_FILTER_STATE = {
    filters: {}, searchInput: '', searchQuery: '', assignedToMe: false, openFilterDropdown: null,
};
const DEFAULT_SORT_STATE = { field: 'id', order: 'asc' };
const DEFAULT_VIEW_STATE = { mode: 'timeline', sidebarCollapsed: false, expandedProjects: {} };

function loadJson(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

export function useProjectsPageState() {
    const [filterState, setFilterState] = useState(() => {
        const saved = loadJson('flowlink_filters');
        if (saved) return { ...saved, openFilterDropdown: null, searchQuery: saved.searchInput || '' };
        return DEFAULT_FILTER_STATE;
    });

    const [sortState, setSortState] = useState(() => {
        return loadJson('flowlink_sort') || DEFAULT_SORT_STATE;
    });

    const [viewState, setViewState] = useState(() => {
        const saved = loadJson('flowlink_view');
        if (saved) return { ...saved, expandedProjects: saved.expandedProjects || {} };
        return DEFAULT_VIEW_STATE;
    });

    useEffect(() => {
        const { openFilterDropdown, searchQuery, ...toSave } = filterState;
        localStorage.setItem('flowlink_filters', JSON.stringify(toSave));
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
