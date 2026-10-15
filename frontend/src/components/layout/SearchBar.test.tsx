import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchBar from './SearchBar';
import { globalSearch } from '../../util/api';
import { SearchResults } from '../../types';

jest.mock('../../util/api', () => ({ globalSearch: jest.fn() }));
const search = jest.mocked(globalSearch);
const results: SearchResults = { projects: [{ projectKey: 'WEB', summary: 'Old result' }], tasks: [], comments: [] };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const startSearch = () => {
    render(<MemoryRouter><SearchBar /></MemoryRouter>);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'old' } });
    act(() => { jest.advanceTimersByTime(300); });
    return input;
};

test('clearing input invalidates the already running search before debounce', async () => {
    let resolve: (value: SearchResults) => void = () => {};
    search.mockReturnValue(new Promise(done => { resolve = done; }));
    const input = startSearch();
    fireEvent.change(input, { target: { value: '' } });
    await act(async () => { resolve(results); });
    expect(screen.queryByText('Old result')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-expanded');
});

test('Escape prevents a pending response from reopening the search', async () => {
    let resolve: (value: SearchResults) => void = () => {};
    search.mockReturnValue(new Promise(done => { resolve = done; }));
    const input = startSearch();
    fireEvent.keyDown(input, { key: 'Escape' });
    await act(async () => { resolve(results); });
    expect(screen.queryByText('Old result')).not.toBeInTheDocument();
});

test('a response for the previous phrase cannot replace the latest results', async () => {
    let resolveOld: (value: SearchResults) => void = () => {};
    search.mockReturnValueOnce(new Promise(done => { resolveOld = done; }));
    search.mockResolvedValueOnce({ ...results, projects: [{ projectKey: 'NEW', summary: 'Latest result' }] });
    const input = startSearch();
    fireEvent.change(input, { target: { value: 'latest' } });
    await act(async () => { jest.advanceTimersByTime(300); });
    await act(async () => { resolveOld(results); });
    expect(screen.getByText('Latest result')).toBeInTheDocument();
    expect(screen.queryByText('Old result')).not.toBeInTheDocument();
});
