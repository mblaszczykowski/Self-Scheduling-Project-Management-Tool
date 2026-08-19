import { RefObject, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { EnrichedTask, ProcessedProject, Project } from '../../types';
import { OptimizationState } from '../../hooks/useScheduleOptimization';

export type ResizeSide = 'left' | 'right';

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
export type ResizePointerDownHandler = (
    e: ReactPointerEvent,
    taskKey: string,
    projectKey: string,
    side: ResizeSide,
) => void;

export type ProjectKeyMap = Map<string, ProcessedProject>;
export type TaskKeyMap = Map<string, EnrichedTask>;
export type ExpandedProjects = Record<string, boolean>;
export type FilteredTaskIds = Set<number>;
export type FilteredProjectKeys = Set<string>;
export type DivRef = RefObject<HTMLDivElement>;

export interface TimelineViewProps {
    processedProjects: ProcessedProject[];
    allTasks: EnrichedTask[];
    draggingTaskKey: string | null;
    taskKeyMap: TaskKeyMap;
    projectKeyToProject: ProjectKeyMap;
    filteredTaskIds: FilteredTaskIds;
    filteredProjectKeys: FilteredProjectKeys;
    expandedProjects: ExpandedProjects;
    sidebarCollapsed: boolean;
    sidebarWidth: number;
    timelineStart: Date;
    timelineEnd: Date;
    timelineWidth: number;
    hasActiveFilters: boolean;
    onToggleExpand: (key: string) => void;
    onOpenProjectModal: OpenProjectModalHandler;
    onOpenTaskModal: OpenTaskModalHandler;
    onTooltipShow: TooltipShowHandler;
    onTooltipMove: TooltipMoveHandler;
    onTooltipHide: TooltipHideHandler;
    onSidebarToggle: () => void;
    onPointerDown: ResizePointerDownHandler;
    shouldPreventClick: () => boolean;
    headerRef: DivRef;
    timelineRef: DivRef;
    syncScroll: () => void;
    optimization: OptimizationState;
    onOptimize: () => void;
    onScrollToToday: () => void;
}

export interface TimelineHeaderProps {
    timelineStart: Date;
    timelineEnd: Date;
    timelineWidth: number;
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
    isExpanded: boolean;
    sidebarCollapsed: boolean;
    sidebarWidth: number;
    timelineStart: Date;
    timelineWidth: number;
    hasActiveFilters: boolean;
    filteredTaskIds: FilteredTaskIds;
    onToggleExpand: (key: string) => void;
    onOpenProjectModal: OpenProjectModalHandler;
    onOpenTaskModal: OpenTaskModalHandler;
    onTooltipShow: TooltipShowHandler;
    onTooltipMove: TooltipMoveHandler;
    onTooltipHide: TooltipHideHandler;
    onPointerDown: ResizePointerDownHandler;
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
    onPointerDown: ResizePointerDownHandler;
    shouldPreventClick: () => boolean;
    onOpenTaskModal: OpenTaskModalHandler;
    optimization: OptimizationState;
}

export interface DependencyOverlayProps {
    containerRef: DivRef;
    allTasks: EnrichedTask[];
    draggingTaskKey: string | null;
    taskKeyMap: TaskKeyMap;
    expandedProjects: ExpandedProjects;
    projectKeyToProject: ProjectKeyMap;
    filteredTaskIds: FilteredTaskIds;
    filteredProjectKeys: FilteredProjectKeys;
    hasActiveFilters: boolean;
    sidebarWidth: number;
    sidebarCollapsed: boolean;
}

export interface TaskListViewProps {
    filteredTasks: EnrichedTask[];
    taskKeyToTaskMap: TaskKeyMap;
    projectKeyToProject: ProjectKeyMap;
    sortField: string;
    sortOrder: 'asc' | 'desc';
    hasActiveFilters: boolean;
    onSort: (field: string) => void;
    onTaskClick: (project: ProcessedProject | undefined, task: EnrichedTask) => void;
}

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
