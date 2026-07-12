// Central domain types shared across the app. These mirror the backend DTOs;
// fields marked optional may be absent depending on the endpoint/DTO variant.

export type TaskStatus =
    | 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_TEST' | 'TO_TEST' | 'TO_REVIEW'
    | 'READY_TO_MERGE' | 'READY_TO_DEPLOY' | 'DONE' | 'RELEASED' | 'WITHDRAWN'
    | 'GATHERING_INTEREST';

export type TaskPriority = 'LOWEST' | 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';

export interface User {
    id?: number;
    email?: string;
    firstname?: string;
    lastname?: string;
    profilePicture?: string | null;
    emailNotificationsEnabled?: boolean;
    emailOnTaskAssigned?: boolean;
    emailOnCommentReply?: boolean;
    emailOnProjectInvitation?: boolean;
}

export interface Task {
    id?: number;
    taskKey: string;
    projectKey?: string;
    summary?: string;
    description?: string;
    status?: TaskStatus | string;
    priority?: TaskPriority | string;
    progress?: number;
    startDate?: string;
    dueDate?: string;
    assignee?: string | null;
    // Raw reporter object from the API; useEnrichedProjects flattens it to an email string.
    reporter?: User | string | null;
    labels?: string[];
    dependencyKeys?: string[];
    dependencies?: string[];
    attachments?: string[];
    isCritical?: boolean;
    created?: string;
    updated?: string;
    // Derived by useEnrichedProjects:
    isDelayed?: boolean;
    isUpcomingDeadline?: boolean;
    isDelayedByDependency?: boolean;
}

// A task enriched by useEnrichedProjects with derived display fields.
// `reporter` is flattened to the reporter's email (or 'N/A') for display.
export interface EnrichedTask extends Task {
    reporter: string;
    projectSummary?: string;
    duration: number | string;
    dependencies: string[];
    isDelayed: boolean;
    isUpcomingDeadline: boolean;
    isDelayedByDependency: boolean;
}

export interface ProcessedProject extends Project {
    tasks: EnrichedTask[];
    projectProgress: number;
}

export interface Project {
    id?: number;
    projectKey: string;
    summary?: string;
    description?: string;
    owner?: User;
    members?: User[];
    tasks?: Task[];
    dependencies?: ProjectDependency[];
    attachments?: string[];
    projectStartDate?: string | null;
    projectDueDate?: string | null;
    progress?: number;
}

export interface CommentReactionState {
    likeCount?: number;
    dislikeCount?: number;
    likedByCurrentUser?: boolean;
    dislikedByCurrentUser?: boolean;
}

export interface Comment extends CommentReactionState {
    id: number;
    content: string;
    authorId?: number;
    authorName?: string;
    authorProfilePicture?: string | null;
    timestamp?: string;
    editedAt?: string | null;
    attachments?: string[];
    replies?: Comment[];
    parentCommentId?: number | null;
}

export interface Notification {
    id: number;
    message: string;
    isRead: boolean;
    type?: string;
    link?: string;
    timestamp?: string;
    [key: string]: unknown;
}

export interface Activity {
    id: number;
    type: string;
    fieldName?: string;
    oldValue?: string | null;
    newValue?: string | null;
    authorName?: string;
    authorProfilePicture?: string | null;
    timestamp?: string;
}

// A file attachment is either an already-uploaded path (string) or a pending upload.
export type Attachment = string | File;

// Attachment state managed by useAttachments / the modal forms.
export interface AttachmentsState {
    existing: string[];
    new: File[];
}

// Formik values shared by the task and project modal forms.
export interface ModalFormValues {
    projectKey: string;
    summary: string;
    description: string;
    status: string;
    startDate: string;
    dueDate: string;
    assignee: string;
    duration: number;
    progress: number;
    priority: string;
    labels: string;
    created: string;
    updated: string;
    reporter: string;
    members: User[];
    newUserEmail: string;
}

// Payloads sent to the API for mutations (built from the modal forms).
export interface TaskDTO {
    summary: string;
    description?: string;
    status?: string;
    startDate?: string;
    dueDate?: string;
    assignee?: string | null;
    labels?: string[];
    dependencyKeys?: string[];
    priority?: string;
    progress?: number;
}

export interface ProjectDTO {
    projectKey?: string;
    summary: string;
    description?: string;
    members?: User[];
}

// A project dependency edge is either an id/key string or an object carrying one.
export type ProjectDependency = string | { projectKey?: string; id?: number };

// ── ProjectsPage UI state ──
export interface FilterState {
    filters: Record<string, string>;
    searchInput: string;
    searchQuery: string;
    assignedToMe: boolean;
    openFilterDropdown: string | null;
}

export interface SortState {
    field: string;
    order: 'asc' | 'desc';
}

export interface ViewState {
    mode: 'timeline' | 'list';
    sidebarCollapsed: boolean;
    expandedProjects: Record<string, boolean>;
}

// ── Schedule optimization (RCPSP simulate/apply) ──
export interface OptimizationSuggestion {
    taskKey: string;
    summary?: string;
    assignee?: string | null;
    wasShifted: boolean;
    originalStartDate?: string;
    originalDueDate?: string;
    suggestedStartDate?: string;
    suggestedDueDate?: string;
    tardinessDays?: number;
    isCritical?: boolean;
    priorityWeight?: number;
}

export interface OptimizationMetrics {
    resourceConflicts: number;
    tasksOnTime: number;
    tasksLate: number;
    totalTasks: number;
    weightedTardiness: number;
    makespan: number;
}

export interface OptimizationResult {
    suggestions: OptimizationSuggestion[];
    originalMetrics?: OptimizationMetrics;
    optimizedMetrics?: OptimizationMetrics;
}

// Shape of an axios-style error, for getErrorMessage.
export interface ErrorLike {
    response?: { data?: { message?: string; error?: string; errors?: Record<string, string> } };
    message?: string;
    code?: string;
}
