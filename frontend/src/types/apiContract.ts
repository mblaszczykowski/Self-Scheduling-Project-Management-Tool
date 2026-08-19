import { components } from './api.generated';
import {
    Activity, Comment, CurrentUser, Notification, OptimizationMetrics, OptimizationResult,
    OptimizationSuggestion, Project, Task, TaskPriority, TaskStatus, User,
} from '../types';

type Schemas = components['schemas'];

type KeysExistOn<Names extends string, Schema> = Exclude<Names, keyof Schema> extends never
    ? true
    : ['client reads fields the server schema lacks:', Exclude<Names, keyof Schema>];

type Exactly<A, B> = [Exclude<A, B>] extends [never]
    ? ([Exclude<B, A>] extends [never] ? true : ['missing on the client:', Exclude<B, A>])
    : ['unknown to the server:', Exclude<A, B>];

export type TaskFieldsExist = KeysExistOn<keyof Task, Schemas['TaskDTO']>;
export type ProjectFieldsExist = KeysExistOn<Exclude<keyof Project, 'tasks'>, Schemas['ProjectDTO']>;
export type CommentFieldsExist = KeysExistOn<keyof Comment, Schemas['CommentDTO']>;
export type UserFieldsExist = KeysExistOn<keyof User, Schemas['UserDTO']>;
export type CurrentUserFieldsExist = KeysExistOn<keyof CurrentUser, Schemas['CurrentUserDTO']>;
export type NotificationFieldsExist = KeysExistOn<keyof Notification, Schemas['NotificationDTO']>;
export type ActivityFieldsExist = KeysExistOn<keyof Activity, Schemas['TaskActivityDTO']>;
export type OptimizationResultFieldsExist =
    KeysExistOn<keyof OptimizationResult, Schemas['OptimizationResultDTO']>;
export type OptimizationMetricsFieldsExist =
    KeysExistOn<keyof OptimizationMetrics, Schemas['OptimizationMetricsDTO']>;
export type OptimizationSuggestionFieldsExist =
    KeysExistOn<keyof OptimizationSuggestion, Schemas['TaskScheduleSuggestionDTO']>;

export type TaskStatusMatches = Exactly<TaskStatus, NonNullable<Schemas['TaskDTO']['status']>>;
export type TaskPriorityMatches = Exactly<TaskPriority, NonNullable<Schemas['TaskDTO']['priority']>>;

const assertions: [
    TaskFieldsExist, ProjectFieldsExist, CommentFieldsExist, UserFieldsExist,
    CurrentUserFieldsExist, NotificationFieldsExist, ActivityFieldsExist,
    OptimizationResultFieldsExist, OptimizationMetricsFieldsExist,
    OptimizationSuggestionFieldsExist, TaskStatusMatches, TaskPriorityMatches,
] = [true, true, true, true, true, true, true, true, true, true, true, true];

export default assertions;
