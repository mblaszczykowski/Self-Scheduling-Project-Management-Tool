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
    labels?: string[];
    dependencyKeys?: string[];
    dependencies?: string[];
    isCritical?: boolean;
    updated?: string;
    // Derived by useEnrichedProjects:
    isDelayed?: boolean;
    isUpcomingDeadline?: boolean;
    isDelayedByDependency?: boolean;
}

export interface Project {
    id?: number;
    projectKey: string;
    summary?: string;
    description?: string;
    owner?: User;
    members?: User[];
    tasks?: Task[];
    dependencies?: Array<{ projectKey?: string } | string>;
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
