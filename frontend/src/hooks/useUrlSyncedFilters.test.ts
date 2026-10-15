import { useState } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useUrlSyncedFilters } from './useUrlSyncedFilters';
import { FilterState, ViewState } from '../types';

const navigate = jest.fn();
const openModal = jest.fn();
const useFilters = (search: string) => {
    const [filterState, setFilterState] = useState<FilterState>({ filters: {}, searchInput: '', searchQuery: '', assignedToMe: false, openFilterDropdown: null });
    const [, setViewState] = useState<ViewState>({ mode: 'list', sidebarCollapsed: false, expandedProjects: {} });
    useUrlSyncedFilters({ filterState, setFilterState, setViewState, processedProjects: [], navigate, openModal,
        location: { pathname: '/projects', search, state: null, key: 'test', hash: '' } });
    return filterState;
};

test('removing URL filters restores the state on history navigation', async () => {
    const { result, rerender } = renderHook(({ search }) => useFilters(search), {
        initialProps: { search: '?critical=true&assignedToMe=true&delayed=true' },
    });
    await waitFor(() => expect(result.current.assignedToMe).toBe(true));
    expect(result.current.filters).toEqual({ criticality: 'Critical', delayed: 'Delayed' });
    rerender({ search: '' });
    await waitFor(() => expect(result.current.assignedToMe).toBe(false));
    expect(result.current.filters).toEqual({});
});

test('non-critical and on-time values also have a complete URL representation', async () => {
    const { result } = renderHook(() => useFilters('?critical=false&timeStatus=onTime'));
    await waitFor(() => expect(result.current.filters).toEqual({ criticality: 'Non-Critical', delayed: 'On Time' }));
});
