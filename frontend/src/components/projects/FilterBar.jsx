import React, { useMemo } from 'react';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../util/helpers';
import {
    CheckCircleIcon, UserIcon, TagIcon, FlagIcon, AlertTriangleIcon,
    ClockIcon, CalendarIcon, CalendarDotIcon, FolderIcon, SearchIcon,
    UserCircleIcon, CloseIcon,
} from '../common/Icons';

const iconClass = "w-4 h-4 text-slate-500 shrink-0";

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
        onFilterTooltipShow({
            visible: true,
            x: rect.left + rect.width / 2,
            y: rect.top,
            text,
        });
    };

    const assigneeOptions = useMemo(() =>
        [...new Set(allTasks.map(t => t.assignee || 'Unassigned'))]
            .map(v => ({ value: v, label: v })),
    [allTasks]);

    const labelOptions = useMemo(() =>
        [...new Set(allTasks.flatMap(t => t.labels))]
            .filter(Boolean)
            .map(v => ({ value: v, label: v })),
    [allTasks]);

    const statusOptions = Object.keys(STATUS_CONFIG)
        .map(k => ({ value: k, label: STATUS_CONFIG[k].label }));

    const priorityOptions = Object.keys(PRIORITY_CONFIG)
        .map(k => ({ value: k, label: PRIORITY_CONFIG[k].label }));

    const dynamicFilters = [
        {
            field: 'status', label: 'Status',
            icon: <CheckCircleIcon className={iconClass} />,
            options: statusOptions,
        },
        {
            field: 'assignee', label: 'Assignee',
            icon: <UserIcon className={iconClass} />,
            options: assigneeOptions,
        },
        {
            field: 'labels', label: 'Labels',
            icon: <TagIcon className={iconClass} />,
            options: labelOptions,
        },
        {
            field: 'priority', label: 'Priority',
            icon: <FlagIcon className={iconClass} />,
            options: priorityOptions,
        },
        {
            field: 'criticality', label: 'Criticality',
            icon: <AlertTriangleIcon className={iconClass} />,
            options: [
                { value: 'Critical', label: 'Critical' },
                { value: 'Non-Critical', label: 'Non-Critical' },
            ],
        },
        {
            field: 'delayed', label: 'Time Status',
            icon: <ClockIcon className={iconClass} />,
            options: [
                { value: 'Delayed', label: 'Delayed' },
                { value: 'Delayed by dependency', label: 'Delayed by dependency' },
                { value: 'On Time', label: 'On Time' },
                { value: 'Upcoming deadline', label: 'Upcoming deadline' },
            ],
        },
    ];

    const dateFilters = [
        {
            field: 'startDate', label: 'Start Date',
            icon: <CalendarIcon className={iconClass} />,
        },
        {
            field: 'dueDate', label: 'Due Date',
            icon: <CalendarDotIcon className={iconClass} />,
        },
    ];

    const filterButtonClass = (isActive) =>
        'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors '
        + (isActive
            ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700');

    const dropdownOptionClass = (isActive) =>
        'w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors '
        + (isActive ? 'bg-slate-100 dark:bg-slate-700 font-medium' : '');

    const dropdownClass =
        'absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
        + ' rounded-xl shadow-lg z-50';

    return (
        <div
            className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2"
            ref={filterRef}
        >
            <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mr-2">
                    Filters
                </span>

                <div className="relative">
                    <button
                        onClick={() => onFilterDropdownToggle('project')}
                        onMouseEnter={(e) => handleButtonMouseEnter(e, 'Project')}
                        onMouseLeave={onFilterTooltipHide}
                        className={filterButtonClass(!!projectKeyFilter)}
                    >
                        <FolderIcon className={iconClass} />
                        {projectKeyFilter && (
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                {projects.find(p => p.projectKey === projectKeyFilter)?.summary
                                    || projectKeyFilter}
                            </span>
                        )}
                    </button>
                    {openFilterDropdown === 'project' && (
                        <div className={`${dropdownClass} min-w-[180px] max-h-64 overflow-y-auto`}>
                            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 rounded-t-xl">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Project</span>
                            </div>
                            <div className="py-1">
                                <button
                                    onClick={() => {
                                        onProjectFilterChange('All');
                                        onFilterDropdownToggle(null);
                                    }}
                                    className={dropdownOptionClass(!projectKeyFilter)}
                                >
                                    All Projects
                                </button>
                                {projects.map(p => (
                                    <button
                                        key={p.projectKey}
                                        onClick={() => {
                                            onProjectFilterChange(p.projectKey);
                                            onFilterDropdownToggle(null);
                                        }}
                                        className={dropdownOptionClass(
                                            projectKeyFilter === p.projectKey
                                        )}
                                    >
                                        {p.summary}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {dynamicFilters.map(({ field, label, icon, options }) => (
                    <div key={field} className="relative">
                        <button
                            onClick={() => onFilterDropdownToggle(field)}
                            onMouseEnter={(e) => handleButtonMouseEnter(e, label)}
                            onMouseLeave={onFilterTooltipHide}
                            className={filterButtonClass(
                                filters[field] && filters[field] !== 'All'
                            )}
                        >
                            {icon}
                            {filters[field] && filters[field] !== 'All' && (
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                    {options.find(o => o.value === filters[field])?.label
                                        || filters[field]}
                                </span>
                            )}
                        </button>
                        {openFilterDropdown === field && (
                            <div className={
                                `${dropdownClass} min-w-[150px] max-h-64 overflow-y-auto`
                            }>
                                <div className={
                                    'px-3 py-2 border-b border-slate-100 dark:border-slate-700'
                                    + ' bg-slate-50 dark:bg-slate-800/80 rounded-t-xl'
                                }>
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        {label}
                                    </span>
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            onFilterChange(field, 'All');
                                            onFilterDropdownToggle(null);
                                        }}
                                        className={dropdownOptionClass(
                                            !filters[field] || filters[field] === 'All'
                                        )}
                                    >
                                        All
                                    </button>
                                    {options.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                onFilterChange(field, opt.value);
                                                onFilterDropdownToggle(null);
                                            }}
                                            className={dropdownOptionClass(
                                                filters[field] === opt.value
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {dateFilters.map(({ field, label, icon }) => (
                    <div key={field} className="relative">
                        <button
                            onClick={() => onFilterDropdownToggle(field)}
                            onMouseEnter={(e) => handleButtonMouseEnter(e, label)}
                            onMouseLeave={onFilterTooltipHide}
                            className={filterButtonClass(!!filters[field])}
                        >
                            {icon}
                            {filters[field] && (
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                    {filters[field]}
                                </span>
                            )}
                        </button>
                        {openFilterDropdown === field && (
                            <div className={`${dropdownClass} p-2`}>
                                <div className="px-1 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        {label}
                                    </span>
                                </div>
                                <input
                                    type="date"
                                    value={filters[field] || ''}
                                    onChange={e => {
                                        onFilterChange(field, e.target.value);
                                        if (e.target.value) onFilterDropdownToggle(null);
                                    }}
                                    className={
                                        'px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                                        + ' rounded-lg text-sm text-slate-700 dark:text-slate-200'
                                        + ' focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500'
                                    }
                                    autoFocus
                                />
                                {filters[field] && (
                                    <button
                                        onClick={() => {
                                            onFilterChange(field, '');
                                            onFilterDropdownToggle(null);
                                        }}
                                        className={
                                            'mt-1.5 w-full px-2 py-1 text-xs'
                                            + ' text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                                        }
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

                <div className="relative">
                    <button
                        onClick={() => onFilterDropdownToggle('search')}
                        onMouseEnter={(e) => handleButtonMouseEnter(e, 'Search')}
                        onMouseLeave={onFilterTooltipHide}
                        className={filterButtonClass(!!searchInput)}
                    >
                        <SearchIcon className={iconClass} />
                        {searchInput && (
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                {searchInput}
                            </span>
                        )}
                    </button>
                    {openFilterDropdown === 'search' && (
                        <div className={`${dropdownClass} p-2`}>
                            <div className="px-1 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    Search
                                </span>
                            </div>
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                data-search-input
                                value={searchInput}
                                onChange={e => onSearchInputChange(e.target.value)}
                                className={
                                    'px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                                    + ' rounded-lg text-sm text-slate-700 dark:text-slate-200'
                                    + ' placeholder-slate-400 dark:placeholder-slate-500'
                                    + ' focus:outline-none focus:ring-1'
                                    + ' focus:ring-slate-400 dark:focus:ring-slate-500 w-40'
                                }
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                <button
                    onClick={onAssignedToMeChange}
                    onMouseEnter={(e) => handleButtonMouseEnter(e, 'My Tasks')}
                    onMouseLeave={onFilterTooltipHide}
                    className={filterButtonClass(assignedToMe)}
                >
                    <UserCircleIcon className={iconClass} />
                    {assignedToMe && (
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            Me
                        </span>
                    )}
                </button>

                {hasActiveFilters && (
                    <button
                        onClick={onClearAllFilters}
                        onMouseEnter={(e) => handleButtonMouseEnter(e, 'Clear all filters')}
                        onMouseLeave={onFilterTooltipHide}
                        className={
                            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium'
                            + ' text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
                            + ' hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors'
                        }
                    >
                        <CloseIcon />
                        <span className="hidden sm:inline">Clear filters</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default React.memo(FilterBar);
