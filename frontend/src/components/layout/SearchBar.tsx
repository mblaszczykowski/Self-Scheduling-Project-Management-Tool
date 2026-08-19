import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineSearch } from 'react-icons/hi';
import { useClickOutside } from '../../hooks/useClickOutside';
import { globalSearch } from '../../util/api';
import config from '../../config';
import { SearchResults } from '../../types';
import { getErrorMessage, STATUS_CONFIG } from '../../util/helpers';

export default function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestIdRef = useRef(0);
    const navigate = useNavigate();

    useClickOutside(containerRef, useCallback(() => {
        setIsOpen(false);
        setIsFocused(false);
    }, []));

    const performSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.trim().length < 2) {
            setResults(null);
            setError(null);
            setIsOpen(false);
            return;
        }
        const requestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const data = await globalSearch(searchQuery.trim());
            if (requestId !== requestIdRef.current) return;
            setResults(data);
            setError(null);
            setIsOpen(true);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            setResults(null);
            setError(getErrorMessage(err, 'Search failed'));
            setIsOpen(true);
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => performSearch(value), config.DEBOUNCE_DELAY);
    };

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const navigateTo = (path: string) => {
        setIsOpen(false);
        setQuery('');
        setResults(null);
        setError(null);
        setIsFocused(false);
        inputRef.current?.blur();
        navigate(path);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            setIsFocused(false);
            inputRef.current?.blur();
        }
        if (e.key === 'Enter' && results) {
            e.preventDefault();
            if (results.projects.length > 0) {
                navigateTo(`/projects?projectKey=${results.projects[0].projectKey}`);
            } else if (results.tasks.length > 0) {
                navigateTo(`/projects?selectedIssue=${results.tasks[0].taskKey}`);
            } else if (results.comments.length > 0) {
                const c = results.comments[0];
                navigateTo(`/projects?selectedIssue=${c.taskKey}&commentId=${c.commentId}`);
            }
        }
    };

    const hasResults = results && (
        results.projects.length > 0 ||
        results.tasks.length > 0 ||
        results.comments.length > 0
    );
    const hasNoResults = results && !hasResults && query.trim().length >= 2;

    return (
        <div ref={containerRef} className="relative">
            <div className={`flex items-center transition-all duration-200 ${
                isFocused
                    ? 'w-72 bg-white dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600 shadow-sm'
                    : 'w-48 bg-slate-100 dark:bg-slate-800/60'
            } rounded-lg`}>
                <HiOutlineSearch className="ml-2.5 w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onFocus={() => {
                        setIsFocused(true);
                        if (results && query.trim().length >= 2) setIsOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search..."
                    className="w-full py-1.5 px-2 text-sm bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                />
                {loading && (
                    <div className="mr-2.5 flex-shrink-0">
                        <div className="w-3.5 h-3.5 border-2 border-slate-300 dark:border-slate-600 border-t-slate-500 dark:border-t-slate-400 rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {isOpen && error && (
                <div className="absolute top-full mt-1.5 w-96 right-0 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-6 text-center text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                </div>
            )}

            {isOpen && !error && (hasResults || hasNoResults) && (
                <div className={`absolute top-full mt-1.5 w-96 right-0 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden z-50 max-h-[28rem] overflow-y-auto ${loading ? 'opacity-60' : ''} transition-opacity`}>
                    {hasNoResults && (
                        <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            No results found for "{query.trim()}"
                        </div>
                    )}

                    {results.projects.length > 0 && (
                        <div>
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                Projects ({results.projects.length})
                            </div>
                            {results.projects.map((p) => (
                                <button
                                    key={p.projectKey}
                                    onClick={() => navigateTo(`/projects?projectKey=${p.projectKey}`)}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                            {p.projectKey}
                                        </span>
                                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                            {p.summary}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {results.tasks.length > 0 && (
                        <div>
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                Tasks ({results.tasks.length})
                            </div>
                            {results.tasks.map((t) => (
                                <button
                                    key={t.taskKey}
                                    onClick={() => navigateTo(`/projects?selectedIssue=${t.taskKey}`)}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                            {t.taskKey}
                                        </span>
                                        <span className="text-sm text-slate-900 dark:text-white truncate flex-1">
                                            {t.summary}
                                        </span>
                                        {t.status && (
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_CONFIG[t.status].color}`}>
                                                {STATUS_CONFIG[t.status].label}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {results.comments.length > 0 && (
                        <div>
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                Comments ({results.comments.length})
                            </div>
                            {results.comments.map((c) => (
                                <button
                                    key={c.commentId}
                                    onClick={() => navigateTo(`/projects?selectedIssue=${c.taskKey}&commentId=${c.commentId}`)}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                                >
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                            {c.authorName}
                                        </span>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                            on {c.taskKey}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                        {c.snippet}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
