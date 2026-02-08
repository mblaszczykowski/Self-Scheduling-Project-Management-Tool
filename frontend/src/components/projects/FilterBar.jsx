import React from 'react';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../util/helpers';

const FilterBar = ({
    projects,
    allTasks,
    filters,
    searchInput,
    assignedToMe,
    projectKeyFilter,
    openFilterDropdown,
    hasActiveFilters,
    onFilterDropdownToggle,
    onFilterChange,
    onProjectFilterChange,
    onSearchInputChange,
    onAssignedToMeChange,
    onClearAllFilters,
    onFilterTooltipShow,
    onFilterTooltipHide,
    filterRef,
}) => {
    const handleButtonMouseEnter = (e, text) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onFilterTooltipShow({ visible: true, x: rect.left + rect.width / 2, y: rect.top, text });
    };

    const dynamicFilters = [
        { field: 'status', label: 'Status', icon: <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, options: Object.keys(STATUS_CONFIG).map(k => ({ value: k, label: STATUS_CONFIG[k].label })) },
        { field: 'assignee', label: 'Assignee', icon: <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>, options: [...new Set(allTasks.map(t => t.assignee || 'Unassigned'))].map(v => ({ value: v, label: v })) },
        { field: 'labels', label: 'Labels', icon: <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>, options: [...new Set(allTasks.flatMap(t => t.labels))].filter(Boolean).map(v => ({ value: v, label: v })) },
        { field: 'priority', label: 'Priority', icon: <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>, options: Object.keys(PRIORITY_CONFIG).map(k => ({ value: k, label: PRIORITY_CONFIG[k].label })) },
        { field: 'criticality', label: 'Criticality', icon: <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>, options: [{ value: 'Critical', label: 'Critical' }, { value: 'Non-Critical', label: 'Non-Critical' }] },
        { field: 'delayed', label: 'Time Status', icon: <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, options: [{ value: 'Delayed', label: 'Delayed' }, { value: 'Delayed by dependency', label: 'Delayed by dependency' }, { value: 'On Time', label: 'On Time' }, { value: 'Upcoming deadline', label: 'Upcoming deadline' }] },
    ];

    const dateFilters = [
        { field: 'startDate', label: 'Start Date', icon: <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
        { field: 'dueDate', label: 'Due Date', icon: <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /><circle cx="12" cy="15" r="1.5" fill="currentColor" /></svg> },
    ];

    return (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 px-3 py-2" ref={filterRef}>
            <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-2">Filters</span>

                {/* Project filter */}
                <div className="relative">
                    <button
                        onClick={() => onFilterDropdownToggle('project')}
                        onMouseEnter={(e) => handleButtonMouseEnter(e, 'Project')}
                        onMouseLeave={onFilterTooltipHide}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors ${projectKeyFilter ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                    >
                        <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        {projectKeyFilter && <span className="text-xs font-medium text-slate-700">{projects.find(p => p.projectKey === projectKeyFilter)?.summary || projectKeyFilter}</span>}
                    </button>
                    {openFilterDropdown === 'project' && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[180px] max-h-64 overflow-y-auto">
                            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                                <span className="text-xs font-semibold text-slate-600">Project</span>
                            </div>
                            <div className="py-1">
                                <button onClick={() => { onProjectFilterChange('All'); onFilterDropdownToggle(null); }} className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${!projectKeyFilter ? 'bg-slate-100 font-medium' : ''}`}>All Projects</button>
                                {projects.map(p => (
                                    <button key={p.projectKey} onClick={() => { onProjectFilterChange(p.projectKey); onFilterDropdownToggle(null); }} className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${projectKeyFilter === p.projectKey ? 'bg-slate-100 font-medium' : ''}`}>{p.summary}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Dynamic filters */}
                {dynamicFilters.map(({ field, label, icon, options }) => (
                    <div key={field} className="relative">
                        <button
                            onClick={() => onFilterDropdownToggle(field)}
                            onMouseEnter={(e) => handleButtonMouseEnter(e, label)}
                            onMouseLeave={onFilterTooltipHide}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors ${filters[field] && filters[field] !== 'All' ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                        >
                            {icon}
                            {filters[field] && filters[field] !== 'All' && (
                                <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                                    {options.find(o => o.value === filters[field])?.label || filters[field]}
                                </span>
                            )}
                        </button>
                        {openFilterDropdown === field && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[150px] max-h-64 overflow-y-auto">
                                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                                    <span className="text-xs font-semibold text-slate-600">{label}</span>
                                </div>
                                <div className="py-1">
                                    <button onClick={() => { onFilterChange(field, 'All'); onFilterDropdownToggle(null); }} className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${!filters[field] || filters[field] === 'All' ? 'bg-slate-100 font-medium' : ''}`}>All</button>
                                    {options.map(opt => (
                                        <button key={opt.value} onClick={() => { onFilterChange(field, opt.value); onFilterDropdownToggle(null); }} className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${filters[field] === opt.value ? 'bg-slate-100 font-medium' : ''}`}>{opt.label}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Date filters */}
                {dateFilters.map(({ field, label, icon }) => (
                    <div key={field} className="relative">
                        <button
                            onClick={() => onFilterDropdownToggle(field)}
                            onMouseEnter={(e) => handleButtonMouseEnter(e, label)}
                            onMouseLeave={onFilterTooltipHide}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors ${filters[field] ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                        >
                            {icon}
                            {filters[field] && <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{filters[field]}</span>}
                        </button>
                        {openFilterDropdown === field && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2">
                                <div className="px-1 pb-2 mb-2 border-b border-slate-100">
                                    <span className="text-xs font-semibold text-slate-600">{label}</span>
                                </div>
                                <input
                                    type="date"
                                    value={filters[field] || ''}
                                    onChange={e => { onFilterChange(field, e.target.value); if (e.target.value) onFilterDropdownToggle(null); }}
                                    className="px-2 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    autoFocus
                                />
                                {filters[field] && (
                                    <button onClick={() => { onFilterChange(field, ''); onFilterDropdownToggle(null); }} className="mt-1.5 w-full px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded">Clear</button>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                <div className="w-px h-6 bg-slate-200 mx-1" />

                {/* Search */}
                <div className="relative">
                    <button
                        onClick={() => onFilterDropdownToggle('search')}
                        onMouseEnter={(e) => handleButtonMouseEnter(e, 'Search')}
                        onMouseLeave={onFilterTooltipHide}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors ${searchInput ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                    >
                        <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        {searchInput && <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{searchInput}</span>}
                    </button>
                    {openFilterDropdown === 'search' && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2">
                            <div className="px-1 pb-2 mb-2 border-b border-slate-100">
                                <span className="text-xs font-semibold text-slate-600">Search</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={searchInput}
                                onChange={e => onSearchInputChange(e.target.value)}
                                className="px-2 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 w-40"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* Assigned to me */}
                <button
                    onClick={onAssignedToMeChange}
                    onMouseEnter={(e) => handleButtonMouseEnter(e, 'My Tasks')}
                    onMouseLeave={onFilterTooltipHide}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors ${assignedToMe ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                    <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {assignedToMe && <span className="text-xs font-medium text-slate-700 whitespace-nowrap">Me</span>}
                </button>

                {/* Clear all */}
                {hasActiveFilters && (
                    <button
                        onClick={onClearAllFilters}
                        onMouseEnter={(e) => handleButtonMouseEnter(e, 'Clear all filters')}
                        onMouseLeave={onFilterTooltipHide}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default FilterBar;
