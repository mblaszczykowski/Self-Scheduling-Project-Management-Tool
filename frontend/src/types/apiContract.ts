import { components } from './api.generated';
import {
    Activity, Comment, CurrentUser, Notification, OptimizationMetrics, OptimizationResult,
    OptimizationSuggestion, Project, Task, TaskPriority, TaskStatus, User,
} from '../types';

/**
 * Compile-time gate between the hand-written domain types and the server's OpenAPI schema.
 *
 * `api.generated.ts` is produced from `docs/openapi.json` by `npm run generate:api-types`, and that
 * spec is itself kept current by `OpenApiContractTest` on the backend. So a field renamed, removed
 * or re-typed in a Java DTO travels: DTO → spec (test fails until regenerated) → generated types →
 * a type error here. Nothing in this file is emitted at runtime; it exists to fail `tsc`.
 *
 * Two things are checked, and one deliberately is not:
 *
 *  - **Field names.** Every property the client reads must still exist on the server schema.
 *  - **Enum members.** Checked for exact equality in both directions, because these are the values
 *    that index `Record<TaskStatus, …>` lookups — a status added server-side without a matching
 *    client entry is a runtime hole, and one removed leaves a dead branch.
 *  - **Optionality is not compared.** springdoc emits no `required` array for these records, so
 *    every generated property is optional and a strict comparison would fail on every field
 *    regardless of whether anything actually drifted.
 */

type Schemas = components['schemas'];

/** Fails when `Names` contains a key the server schema no longer has. */
type KeysExistOn<Names extends string, Schema> = Exclude<Names, keyof Schema> extends never
    ? true
    : ['client reads fields the server schema lacks:', Exclude<Names, keyof Schema>];

/** Fails unless the two unions have exactly the same members. */
type Exactly<A, B> = [Exclude<A, B>] extends [never]
    ? ([Exclude<B, A>] extends [never] ? true : ['missing on the client:', Exclude<B, A>])
    : ['unknown to the server:', Exclude<A, B>];

// Field-name drift. `Task` and `Project` are compared on their server-sent fields only; the
// derived members that `useEnrichedProjects` adds are client concepts and are excluded.
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

// Enum membership, exact in both directions.
export type TaskStatusMatches = Exactly<TaskStatus, NonNullable<Schemas['TaskDTO']['status']>>;
export type TaskPriorityMatches = Exactly<TaskPriority, NonNullable<Schemas['TaskDTO']['priority']>>;

// Each alias must resolve to `true`; anything else is a tuple naming the offending members.
const assertions: [
    TaskFieldsExist, ProjectFieldsExist, CommentFieldsExist, UserFieldsExist,
    CurrentUserFieldsExist, NotificationFieldsExist, ActivityFieldsExist,
    OptimizationResultFieldsExist, OptimizationMetricsFieldsExist,
    OptimizationSuggestionFieldsExist, TaskStatusMatches, TaskPriorityMatches,
] = [true, true, true, true, true, true, true, true, true, true, true, true];

export default assertions;
