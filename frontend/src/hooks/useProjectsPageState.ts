import { useState, useEffect } from 'react';
import { FilterState, SortState, ViewState } from '../types';

const DEFAULT_FILTER_STATE: FilterState = {
    filters: {}, searchInput: '', searchQuery: '', assignedToMe: false, openFilterDropdown: null,
};
const DEFAULT_SORT_STATE: SortState = { field: 'id', order: 'asc' };
const DEFAULT_VIEW_STATE: ViewState = { mode: 'timeline', sidebarCollapsed: false, expandedProjects: {} };

const STORAGE_VERSION = 'v2';

function loadJson<T>(key: string, isValid: (value: unknown) => boolean): T | null {
    try {
        const raw = localStorage.getItem(`${key}_${STORAGE_VERSION}`);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isValid(parsed) ? (parsed as T) : null;
    } catch {
        return null;
    }
}

function save(key: string, value: unknown): void {
    try {
        localStorage.setItem(`${key}_${STORAGE_VERSION}`, JSON.stringify(value));
    } catch {
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFilterState = (value: unknown): boolean =>
    isRecord(value) && isRecord(value.filters) && typeof value.searchInput === 'string';

const isSortState = (value: unknown): boolean =>
    isRecord(value) && typeof value.field === 'string'
    && (value.order === 'asc' || value.order === 'desc');

const isViewState = (value: unknown): boolean =>
    isRecord(value) && (value.mode === 'timeline' || value.mode === 'list')
    && typeof value.sidebarCollapsed === 'boolean';

export function useProjectsPageState() {
    const [filterState, setFilterState] = useState<FilterState>(() => {
        const saved = loadJson<FilterState>('flowlink_filters', isFilterState);
        if (saved) return { ...saved, openFilterDropdown: null, searchQuery: saved.searchInput };
        return DEFAULT_FILTER_STATE;
    });

    const [sortState, setSortState] = useState<SortState>(() => {
        return loadJson<SortState>('flowlink_sort', isSortState) ?? DEFAULT_SORT_STATE;
    });

    const [viewState, setViewState] = useState<ViewState>(() => {
        const saved = loadJson<ViewState>('flowlink_view', isViewState);
        if (saved) return { ...saved, expandedProjects: saved.expandedProjects ?? {} };
        return DEFAULT_VIEW_STATE;
    });

    useEffect(() => {
        const { openFilterDropdown, searchQuery, ...toSave } = filterState;
        const timer = setTimeout(() => {
            save('flowlink_filters', toSave);
        }, 400);
        return () => clearTimeout(timer);
    }, [filterState]);

    useEffect(() => {
        save('flowlink_sort', sortState);
    }, [sortState]);

    useEffect(() => {
        const { expandedProjects, ...toSave } = viewState;
        save('flowlink_view', toSave);
    }, [viewState]);

    return { filterState, setFilterState, sortState, setSortState, viewState, setViewState };
}
