import { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import { EnrichedTask, ProcessedProject, Project } from '../../types';
import { OptimizationState } from '../../hooks/useScheduleOptimization';

export type ResizeSide = 'left' | 'right';

/** Payload rendered by the timeline tooltip (task bars and project bars). */
export interface TimelineTooltipContent {
    type: 'task' | 'project';
    title: string;
    subtitle?: string;
    status?: string;
    isCritical?: boolean;
    dates: string;
    assignee?: string | null;
    progress?: number;
    extra?: string;
}

export interface TooltipState {
    visible: boolean;
    x: number;
    y: number;
    content: TimelineTooltipContent | null;
}

export interface FilterTooltipState {
    visible: boolean;
    x: number;
    y: number;
    text: string;
}

export type TooltipShowHandler = (e: ReactMouseEvent, content: TimelineTooltipContent) => void;
export type TooltipMoveHandler = (e: ReactMouseEvent) => void;
export type TooltipHideHandler = () => void;

export type OpenProjectModalHandler = (project: ProcessedProject) => void;
export type OpenTaskModalHandler = (project: ProcessedProject, task: EnrichedTask | null) => void;
export type ResizeMouseDownHandler = (
    e: ReactMouseEvent,
    taskKey: string,
    projectKey: string,
    side: ResizeSide,
) => void;

export type ProjectKeyMap = Map<string, ProcessedProject>;
export type TaskKeyMap = Map<string, EnrichedTask>;
export type ProjectIndexMap = Map<string, number>;
export type ExpandedProjects = Record<string, boolean>;
export type FilteredTaskIds = Set<number>;
export type FilteredProjectKeys = Set<string>;
export type DivRef = RefObject<HTMLDivElement | null>;

/** Shared props threaded through the timeline (view -> row -> bar). */
export interface TimelineViewProps {
    processedProjects: ProcessedProject[];
    allTasks: EnrichedTask[];
    filteredTasks: EnrichedTask[];
    filteredTaskIds: FilteredTaskIds;
    filteredProjectKeys: FilteredProjectKeys;
    projectRowOffsets: number[];
    expandedProjects: ExpandedProjects;
    sidebarCollapsed: boolean;
    sidebarWidth: number;
    timelineStart: Date;
    timelineEnd: Date;
    timelineWidth: number;
    projectKeyFilter: string | null;
    hasActiveFilters: boolean;
    onToggleExpand: (key: string) => void;
    onOpenProjectModal: OpenProjectModalHandler;
    onOpenTaskModal: OpenTaskModalHandler;
    onTooltipShow: TooltipShowHandler;
    onTooltipMove: TooltipMoveHandler;
    onTooltipHide: TooltipHideHandler;
    onSidebarToggle: () => void;
    onMouseDown: ResizeMouseDownHandler;
    shouldPreventClick: () => boolean;
    headerRef: DivRef;
    timelineRef: DivRef;
    syncScroll: () => void;
    optimization: OptimizationState;
    onOptimize: () => void;
    onScrollToToday: () => void;
    onAcceptOptimization: () => void;
    onRejectOptimization: () => void;
}

export interface TimelineHeaderProps {
    timelineStart: Date;
    timelineEnd: Date;
    sidebarWidth: number;
    sidebarCollapsed: boolean;
    processedProjects: ProcessedProject[];
    optimization: OptimizationState;
    onOptimize: () => void;
    onScrollToToday: () => void;
    onSidebarToggle: () => void;
    headerRef: DivRef;
    syncScroll: () => void;
}

export interface TimelineProjectRowProps {
    project: ProcessedProject;
    projectIndex: number;
    isExpanded: boolean;
    sidebarCollapsed: boolean;
    sidebarWidth: number;
    timelineStart: Date;
    timelineWidth: number;
    hasActiveFilters: boolean;
    filteredTaskIds: FilteredTaskIds;
    filteredProjectKeys: FilteredProjectKeys;
    projectRowOffsets: number[];
    taskKeyMap: TaskKeyMap;
    projectIndexMap: ProjectIndexMap;
    projectKeyToProject: ProjectKeyMap;
    expandedProjects: ExpandedProjects;
    projectKeyFilter: string | null;
    onToggleExpand: (key: string) => void;
    onOpenProjectModal: OpenProjectModalHandler;
    onOpenTaskModal: OpenTaskModalHandler;
    onTooltipShow: TooltipShowHandler;
    onTooltipMove: TooltipMoveHandler;
    onTooltipHide: TooltipHideHandler;
    onMouseDown: ResizeMouseDownHandler;
    shouldPreventClick: () => boolean;
    optimization: OptimizationState;
}

export interface TimelineTaskBarProps {
    task: EnrichedTask;
    project: ProcessedProject;
    isLastTask: boolean;
    sidebarCollapsed: boolean;
    sidebarWidth: number;
    timelineStart: Date;
    timelineWidth: number;
    onTooltipShow: TooltipShowHandler;
    onTooltipMove: TooltipMoveHandler;
    onTooltipHide: TooltipHideHandler;
    onMouseDown: ResizeMouseDownHandler;
    shouldPreventClick: () => boolean;
    onOpenTaskModal: OpenTaskModalHandler;
    optimization: OptimizationState;
}

export interface DependencyOverlayProps {
    containerRef: DivRef;
    allTasks: EnrichedTask[];
    taskKeyMap: TaskKeyMap;
    expandedProjects: ExpandedProjects;
    projectKeyToProject: ProjectKeyMap;
    filteredTaskIds: FilteredTaskIds;
    filteredProjectKeys: FilteredProjectKeys;
    hasActiveFilters: boolean;
    projectKeyFilter: string | null;
}

export interface TaskListViewProps {
    filteredTasks: EnrichedTask[];
    processedProjects: ProcessedProject[];
    taskKeyToTaskMap: TaskKeyMap;
    projectKeyToProject: ProjectKeyMap;
    sortField: string;
    sortOrder: string;
    hasActiveFilters: boolean;
    onSort: (field: string) => void;
    onTaskClick: (project: ProcessedProject | undefined, task: EnrichedTask) => void;
}

/** FilterBar receives the raw projects list plus enriched tasks for facet counts. */
export interface FilterBarProps {
    projects: Project[];
    allTasks: EnrichedTask[];
    filters: Record<string, string>;
    searchInput: string;
    assignedToMe: boolean;
    projectKeyFilter: string | null;
    openFilterDropdown: string | null;
    hasActiveFilters: boolean;
    onFilterDropdownToggle: (field: string | null) => void;
    onFilterChange: (field: string, value: string) => void;
    onProjectFilterChange: (value: string) => void;
    onSearchInputChange: (value: string) => void;
    onAssignedToMeChange: () => void;
    onClearAllFilters: () => void;
    onFilterTooltipShow: (tooltip: FilterTooltipState) => void;
    onFilterTooltipHide: () => void;
    filterRef: DivRef;
}
