// Central domain types, mirroring the backend DTOs one-for-one.
//
// These are load-bearing: `util/endpoints.ts` types every response with them, so a field that
// drifts from the server becomes a compile error rather than an `undefined` at runtime.

export type TaskStatus =
    | 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_TEST' | 'TO_TEST' | 'TO_REVIEW'
    | 'READY_TO_MERGE' | 'READY_TO_DEPLOY' | 'DONE' | 'RELEASED' | 'WITHDRAWN'
    | 'GATHERING_INTEREST';

export type TaskPriority = 'LOWEST' | 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';

export type NotificationType =
    | 'PROJECT_INVITATION' | 'PROJECT_UPDATED' | 'MEMBER_REMOVED'
    | 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'TASK_DELETED' | 'TASK_COMMENT'
    | 'COMMENT_REPLY' | 'COMMENT_REACTION';

export type ActivityType =
    | 'CREATED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'ASSIGNEE_CHANGED'
    | 'PROGRESS_CHANGED' | 'DATES_CHANGED' | 'SUMMARY_CHANGED' | 'DESCRIPTION_CHANGED'
    | 'LABELS_CHANGED' | 'DEPENDENCIES_CHANGED' | 'ATTACHMENTS_CHANGED'
    | 'COMMENT_ADDED' | 'COMMENT_EDITED' | 'COMMENT_DELETED';

export type ReactionType = 'LIKE' | 'DISLIKE';

/** A person as others see them — mirrors UserDTO. Notification preferences are not here. */
export interface User {
    id: number;
    email: string;
    firstname: string;
    lastname: string;
    profilePicture?: string | null;
}

/** The signed-in user's own profile — mirrors CurrentUserDTO. */
export interface CurrentUser extends User {
    emailNotificationsEnabled: boolean;
    emailOnTaskAssigned: boolean;
    emailOnCommentReply: boolean;
    emailOnProjectInvitation: boolean;
}

/** Mirrors TaskDTO. Collections are always present (the server never sends null for them). */
export interface Task {
    id: number;
    taskNumber: number;
    taskKey: string;
    projectKey: string;
    summary: string;
    description?: string | null;
    status: TaskStatus;
    startDate?: string | null;
    dueDate?: string | null;
    assignee?: string | null;
    labels: string[];
    dependencyKeys: string[];
    isCritical?: boolean | null;
    attachments: string[];
    created?: string | null;
    updated?: string | null;
    progress: number;
    priority: TaskPriority;
}

/** A task with the display fields `useEnrichedProjects` derives. */
export interface EnrichedTask extends Task {
    projectSummary?: string;
    duration: number;
    /** Alias of `dependencyKeys`, kept because the timeline and list views read it by this name. */
    dependencies: string[];
    isDelayed: boolean;
    isUpcomingDeadline: boolean;
    isDelayedByDependency: boolean;
}

/** Mirrors ProjectDTO. */
export interface Project {
    id: number;
    projectKey: string;
    summary: string;
    description?: string | null;
    tasks: Task[];
    members: User[];
    attachments: string[];
    owner?: User | null;
    dependencies: string[];
    created?: string | null;
    updated?: string | null;
}

/** A project with the date range and progress the dashboard and timeline compute. */
export interface ProcessedProject extends Omit<Project, 'tasks'> {
    tasks: EnrichedTask[];
    projectProgress: number;
    projectStartDate?: string | null;
    projectDueDate?: string | null;
}

export interface CommentReactionState {
    likeCount: number;
    dislikeCount: number;
    likedByUsernames: string[];
    dislikedByUsernames: string[];
    likedByCurrentUser: boolean;
    dislikedByCurrentUser: boolean;
}

/** Mirrors CommentDTO. */
export interface Comment extends CommentReactionState {
    id: number;
    taskId: number;
    authorId?: number | null;
    authorName?: string | null;
    authorProfilePicture?: string | null;
    content: string;
    timestamp: string;
    editedAt?: string | null;
    attachments: string[];
    replies: Comment[];
}

/** Mirrors NotificationDTO. */
export interface Notification {
    id: number;
    message: string;
    timestamp: string;
    isRead: boolean;
    type: NotificationType;
    link?: string | null;
}

/** Mirrors TaskActivityDTO. */
export interface Activity {
    id: number;
    type: ActivityType;
    fieldName?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    authorName?: string | null;
    authorProfilePicture?: string | null;
    timestamp: string;
}

/** Mirrors PagedResponse<T>. */
export interface Paged<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
}

/** A file attachment is either an already-uploaded path (string) or a pending upload. */
export type Attachment = string | File;

export interface AttachmentsState {
    existing: string[];
    new: File[];
}

// ── Request payloads ──

export interface TaskPayload {
    summary: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    progress?: number;
    startDate?: string | null;
    dueDate?: string | null;
    assignee?: string | null;
    labels?: string[];
    dependencyKeys?: string[];
    attachments?: string[];
}

export interface ProjectPayload {
    projectKey: string;
    summary: string;
    description?: string;
    /** Emails, not user objects: the server only ever read the address. */
    memberEmails?: string[];
    dependencies?: string[];
    attachments?: string[];
}

export interface ProfilePayload {
    firstname?: string;
    lastname?: string;
    email?: string;
    /** Required by the server for an email or password change. */
    currentPassword?: string;
    newPassword?: string;
}

export interface EmailPreferencesPayload {
    emailNotificationsEnabled?: boolean;
    emailOnTaskAssigned?: boolean;
    emailOnCommentReply?: boolean;
    emailOnProjectInvitation?: boolean;
}

export interface RegistrationPayload {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
}

// ── Modal identity ──
//
// Declared once. These used to exist twice — nullable in the hook, non-nullable in the component —
// which the compiler reported as two unrelated types sharing a name, and which made the
// nullability difference real unsoundness masked only by a render-time guard.

export type ModalType = 'task' | 'project';
export type ModalMode = 'create' | 'edit' | 'view';

export interface ModalState {
    open: boolean;
    type: ModalType | null;
    mode: ModalMode | null;
    project: Project | null;
    task: Task | null;
}

// ── Formik values for the task/project modal ──

export interface ModalFormValues {
    projectKey: string;
    summary: string;
    description: string;
    status: TaskStatus;
    startDate: string;
    dueDate: string;
    assignee: string;
    duration: number;
    progress: number;
    priority: TaskPriority;
    labels: string;
    created: string;
    updated: string;
    /** Member email addresses — the only part of a member the server ever reads. */
    memberEmails: string[];
    newUserEmail: string;
}

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

// ── Schedule optimization ──

export interface OptimizationSuggestion {
    taskKey: string;
    projectKey: string;
    summary?: string;
    assignee?: string | null;
    originalStartDate?: string | null;
    originalDueDate?: string | null;
    suggestedStartDate: string;
    suggestedDueDate: string;
    priorityWeight: number;
    tardinessDays: number;
    isCritical: boolean;
    wasShifted: boolean;
}

export interface OptimizationMetrics {
    weightedTardiness: number;
    makespan: number;
    objectiveValue: number;
    totalTasks: number;
    tasksOnTime: number;
    tasksLate: number;
    resourceConflicts: number;
    /** False when the plan double-books someone, which makes its other numbers optimistic. */
    feasible: boolean;
}

export interface OptimizationResult {
    suggestions: OptimizationSuggestion[];
    originalMetrics: OptimizationMetrics;
    optimizedMetrics: OptimizationMetrics;
    tasksShifted: number;
    /** Which priority rule won, so the UI can say why this schedule was proposed. */
    chosenRule?: string | null;
    /** Tasks left out for having no dates, so the counts in the UI can be explained. */
    skippedTaskKeys: string[];
}

export interface OptimizationRequest {
    projectKeys: string[];
    alpha?: number;
    beta?: number;
    horizonStart?: string;
}

export interface ApplyOptimizationRequest extends OptimizationRequest {
    acceptedTaskKeys?: string[];
}

// ── Search ──

export interface SearchProjectResult {
    projectKey: string;
    summary: string;
    description?: string | null;
}

export interface SearchTaskResult {
    taskKey: string;
    projectKey: string;
    summary: string;
    status?: TaskStatus | null;
    priority?: TaskPriority | null;
    assignee?: string | null;
}

export interface SearchCommentResult {
    commentId: number;
    taskId: number;
    taskKey: string;
    authorName?: string | null;
    snippet?: string | null;
}

export interface SearchResults {
    projects: SearchProjectResult[];
    tasks: SearchTaskResult[];
    comments: SearchCommentResult[];
}

// ── Errors ──

/** One field-level validation failure, as sent inside ApiError. */
export interface ApiFieldError {
    field: string;
    message: string;
}

/** Mirrors ApiError — the single error shape the API emits. */
export interface ApiError {
    status: number;
    error: string;
    message: string;
    code?: string | null;
    fieldErrors?: ApiFieldError[] | null;
    timestamp?: string;
}

/** Shape of an axios-style error, for getErrorMessage. */
export interface ErrorLike {
    response?: { status?: number; data?: ApiError };
    message?: string;
    code?: string;
}
