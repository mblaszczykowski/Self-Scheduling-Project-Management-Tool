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

export interface User {
    id: number;
    email: string;
    firstname: string;
    lastname: string;
    profilePicture?: string | null;
}

export interface CurrentUser extends User {
    emailNotificationsEnabled: boolean;
    emailOnTaskAssigned: boolean;
    emailOnCommentReply: boolean;
    emailOnProjectInvitation: boolean;
}

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
    totalFloat?: number | null;
    attachments: string[];
    created?: string | null;
    updated?: string | null;
    progress: number;
    priority: TaskPriority;
}

export interface EnrichedTask extends Task {
    projectSummary?: string;
    duration: number;
    dependencies: string[];
    isDelayed: boolean;
    isUpcomingDeadline: boolean;
    isDelayedByDependency: boolean;
    assigneeName: string;
}

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

export interface ProcessedProject extends Omit<Project, 'tasks'> {
    tasks: EnrichedTask[];
    projectProgress: number;
    projectStartDate?: string | null;
    projectDueDate?: string | null;
}

export interface CommentReactionState {
    likeCount: number;
    dislikeCount: number;
    likedByCurrentUser: boolean;
    dislikedByCurrentUser: boolean;
}

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

export interface Notification {
    id: number;
    message: string;
    timestamp: string;
    isRead: boolean;
    type: NotificationType;
    link?: string | null;
}

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

export interface Paged<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
}

export type Attachment = string | File;

export interface AttachmentsState {
    existing: string[];
    new: File[];
}

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
    memberEmails?: string[];
    dependencies?: string[];
    attachments?: string[];
}

export interface ProfilePayload {
    firstname?: string;
    lastname?: string;
    email?: string;
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

export type ModalType = 'task' | 'project';
export type ModalMode = 'create' | 'edit';

export interface ModalState {
    open: boolean;
    type: ModalType | null;
    mode: ModalMode | null;
    project: Project | null;
    task: Task | null;
}

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
    memberEmails: string[];
    newUserEmail: string;
}

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
    feasible: boolean;
}

export interface OptimizationResult {
    suggestions: OptimizationSuggestion[];
    originalMetrics: OptimizationMetrics;
    optimizedMetrics: OptimizationMetrics;
    tasksShifted: number;
    chosenRule?: string | null;
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

export interface ApiFieldError {
    field: string;
    message: string;
}

export interface ApiError {
    status: number;
    error: string;
    message: string;
    code?: string | null;
    fieldErrors?: ApiFieldError[] | null;
    timestamp?: string;
}

export interface ErrorLike {
    response?: { status?: number; data?: ApiError };
    message?: string;
    code?: string;
}
