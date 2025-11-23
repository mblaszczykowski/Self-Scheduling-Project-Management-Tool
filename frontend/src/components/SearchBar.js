// File: src/components/SearchBar.js

import React, {useEffect, useRef, useState} from 'react';
import {FaSearch, FaTimes} from 'react-icons/fa'; // Importing icons
import {search} from '../util/api'; // Existing search API function
import {useNavigate} from 'react-router-dom';

const SearchBar = () => {
    const [query, setQuery] = useState(''); // Search input state
    const [results, setResults] = useState([]); // Search results state
    const [dropdownOpen, setDropdownOpen] = useState(false); // Dropdown visibility state
    const navigate = useNavigate();
    const dropdownRef = useRef(null); // Reference to the dropdown element
    const inputRef = useRef(null); // Reference to the input field

    // Handle clicks outside the dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target) &&
                inputRef.current &&
                !inputRef.current.contains(event.target)
            ) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Handle input changes for live search
    const handleChange = async (e) => {
        const value = e.target.value;
        setQuery(value);

        if (value.trim() === '') {
            setResults([]);
            setDropdownOpen(false);
            return;
        }

        try {
            const data = await search(value); // Existing search API function
            // Filter results to include only tasks
            const taskResults = data.filter(result => result.type === 'task');
            setResults(taskResults);
            setDropdownOpen(taskResults.length > 0);

            console.log(results)
        } catch (error) {
            console.error('Error searching:', error);
            setResults([]);
            setDropdownOpen(false);
        }
    };

    // Handle result selection
    const handleResultClick = (result) => {
        setDropdownOpen(false);
        setQuery('');
        if (result.type === 'task') {
            navigate(`/timeline?selectedIssue=${result.projectKey}-${result.id}`);
        }
    };

    // Clear search input and results
    const handleClear = () => {
        setQuery('');
        setResults([]);
        setDropdownOpen(false);
        inputRef.current.focus();
    };

    return (
        <div className="relative w-full max-w-2xl mx-auto">
            <div className="flex items-center">
                {/* Search Icon */}
                <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />

                {/* Input Field */}
                <input
                    type="text"
                    ref={inputRef}
                    className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                    placeholder="Search for tasks..."
                    value={query}
                    onChange={handleChange}
                />

                {/* Clear (X) Button */}
                {query && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        aria-label="Clear search"
                    >
                        <FaTimes />
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {dropdownOpen && results.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto"
                >
                    {/* Dropdown Header with Close Button */}
                    <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
                        <span className="font-semibold text-gray-700">Search Results</span>
                        <button
                            onClick={() => setDropdownOpen(false)}
                            className="text-gray-500 hover:text-gray-700 focus:outline-none"
                            aria-label="Close dropdown"
                        >
                            <FaTimes />
                        </button>
                    </div>

                    {/* Search Results List */}
                    <ul className="py-1">
                        {results.map((result) => (
                            <li key={`${result.type}-${result.id}`} className="px-4 py-2 hover:bg-gray-100">
                                <button
                                    className="w-full text-left text-gray-700 hover:text-blue-600 flex flex-col"
                                    onClick={() => handleResultClick(result)}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-semibold">Task:</span>
                                        <span>{`${result.projectKey}-${result.id}: ${result.summary}`}</span>
                                        <span className="text-sm text-gray-500">
                                            Due: {new Date(result.dueDate).toLocaleDateString()} | Assignee: {result.assignee?.email || 'Unassigned'}
                                        </span>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* No Results Feedback */}
            {dropdownOpen && results.length === 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-4">
                    <p className="text-gray-700">No tasks found.</p>
                </div>
            )}
        </div>
    );

};

export default SearchBar;
