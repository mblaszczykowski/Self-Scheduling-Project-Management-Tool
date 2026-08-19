# Architecture notes

Internal reference for anyone working in this repository.

## Project overview

FlowLink is a project and portfolio management application: projects, tasks, task dependencies, a
Gantt-style timeline, threaded comments with reactions, file attachments, real-time notifications
and global search. Its distinguishing feature is a schedule optimizer that treats a portfolio as a
resource-constrained project scheduling problem (assignees are the renewable resources, task
dependencies are precedence constraints) and proposes a conflict-free schedule.

## Tech stack

- **Backend**: Spring Boot 3.5.12, Java 21, PostgreSQL 16, Flyway, Maven.
- **Frontend**: React 18.3 in **TypeScript**, TanStack Query v5, TailwindCSS, React Router 6,
  Axios, Chart.js, Tiptap, Formik + Yup. Built with Create React App (`react-scripts` 5).
- **Auth**: JWT in HTTP-only cookies — access token 15 min, refresh token 7 days, rotated per use,
  with an absolute session cap of 30 days.

There is **no Spring Security filter chain**. The only Spring Security artifact on the classpath is
`spring-security-crypto`, used for `BCryptPasswordEncoder` (see `config/PasswordEncoderConfig`).
Authentication, CSRF and rate limiting are plain servlet filters in `filter/`.

## Commands

Java 21 is required. A newer default JDK breaks the Mockito-based tests, so select it explicitly:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)   # macOS
```

### Backend

```bash
cd backend
mvn spring-boot:run        # port 8080; JWT_SECRET must be set or startup fails
mvn test                   # unit + Testcontainers integration tests (Docker must be running)
mvn test -Dtest=AuthServiceTest
mvn clean package          # build the jar
```

`mvn test` starts a real `postgres:16-alpine` container via Testcontainers for the classes under
`src/test/java/com/backend/integration/`. Everything else is a plain unit test; nothing is
excluded from the build.

On a Colima/rootless Docker setup, `mvn test` needs `TESTCONTAINERS_RYUK_DISABLED=true` (and
usually `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`): Ryuk, the Testcontainers
resource-reaper sidecar, cannot bind-mount the docker socket there and otherwise fails the whole
run before a single test executes.

### Frontend

```bash
cd frontend
npm install
npm start                        # dev server, port 3000
npm run build
npm test -- --watchAll=false
npm run typecheck                # tsc --noEmit
npm run lint                     # eslint over src/
```

The dev server must run on port 3000 unless you also change `CORS_ORIGIN` — credentialed CORS
matches the origin exactly.

### Whole stack

```bash
cp .env.example .env   # then set JWT_SECRET and POSTGRES_PASSWORD
docker compose up --build
```

## Architecture

### Backend packages (`backend/src/main/java/com/backend/`)

- **config/** — `@ConfigurationProperties` classes (`AppProperties` for everything under `app.*`,
  `JwtProperties`, `CookieProperties`), plus `WebConfig` (CORS + argument resolvers), `AsyncConfig`,
  `SchedulingConfig`, `JwtConfig`, `PasswordEncoderConfig`, `OpenApiConfig` (hides the
  `@CurrentUserId` parameter from the generated OpenAPI docs), and `PublicEndpoints` — the
  deny-by-default authentication/CSRF policy in one place.
- **controllers/** — REST endpoints. One per resource: Auth, User, Project, Task, TaskActivity,
  Comment, Notification, Search, Optimization, File.
- **services/** — business logic. Includes `SseEmitterManager` (notification streams),
  `RateLimitService`, `EmailService`, `ScheduledMaintenance` (hourly refresh-token cleanup),
  `OptimizationService` + `OptimizationInputLoader`.
- **repositories/** — Spring Data JPA.
- **entities/** — JPA entities: `User`, `Project`, `Task`, `Comment`, `CommentReaction`,
  `Notification`, `TaskActivity`, `RefreshToken`, `StoredFile`, plus the enums.
- **dtos/** — API response shapes, including the `PagedResponse` envelope and `ApiError`.
- **requests/** — request payload records: `LoginRequest`, `UserRegistrationRequest`,
  `ProjectRequest`, `TaskRequest`, `TaskScheduleRequest`, `OptimizationRequest`,
  `ApplyOptimizationRequest`, `UpdateProfileRequest`, `EmailPreferencesRequest`.
- **mapper/** — `EntityMapper`, entity → DTO conversion.
- **security/** — `AccessGuard`, the single place that answers "may this user touch this project /
  task / comment".
- **scheduling/** — the extracted scheduling domain: `SchedulingService`, `ScheduleModel`,
  `PrecedenceGraph`, `SsgsDecoder`, `PriorityRule`, `ScheduleObjective`, `ScheduleEvaluator`,
  `CriticalPathAnalyzer`, plus the value types the decoder works in — `ScheduleTask` (a task on a
  pure integer day axis, no entities or dates), `Placement` and `Schedule` (where the decoder put
  each task), `ScheduleMetrics` (the scored result) — and `SchedulingSupport` (shared day
  arithmetic). Free of entities and non-transactional: it consumes DTOs and returns a value, so
  CPU-bound work does not hold a pooled database connection.
- **web/** — HTTP plumbing: `CookieFactory`, `@CurrentUserId` + its argument resolver,
  `PageRequests`, `RequestValidator`, `FilterResponseUtil`.
- **filter/** — servlet filters, ordered:
  1. `SecurityHeadersFilter` (`HIGHEST_PRECEDENCE`)
  2. `RateLimitFilter` (+1)
  3. `JwtAuthenticationFilter` (+2)
  4. `CsrfProtectionFilter` (+3)
- **exception/** — custom exceptions (`AuthorizationException`, `FileStorageException`,
  `ResourceNotFoundException`, `TooManyAttemptsException`, `UnauthenticatedException`,
  `ValidationException`) and `GlobalExceptionHandler`.
- **util/** — `ValidationUtil`, `AfterCommit`, `FileValidationConstants`, `GraphCycles` (shared
  cycle-detection walk, used for project/task dependency validation), `HtmlSanitizer` (jsoup-based
  sanitisation for comment bodies and rich-text task/project descriptions).

There is no `events/` package; deferred side effects (mail, file unlinking, SSE pushes) go through
`util/AfterCommit`, which registers a transaction synchronization so nothing escapes before commit.

### Frontend structure (`frontend/src/`)

Nearly every source file is `.ts`/`.tsx`. The two deliberate exceptions are `setupTests.js` (Jest
environment shims) and `react-app-env.d.ts`.

- **pages/** — route-level containers: `AuthPage`, `DashboardPage`, `ProjectsPage`. The last two are
  `React.lazy`-loaded from `App.tsx`.
- **components/** — grouped by area: `auth`, `comments`, `common` (incl. the `RichTextEditor`
  subsystem), `dashboard`, `layout`, `modals`, `projects`.
- **context/** — four providers, each with a `useX()` hook: `AuthContext` (current user + logout),
  `ProjectsContext`, `NotificationsContext`, `ThemeContext` (dark mode). All four keep the raw
  context unexported so consumers cannot bypass the hook's provider guard.
- **hooks/** — data enrichment, filtering, stats, modal/form state, timeline viewport and resize,
  `useComments`, `useScheduleOptimization`.
- **util/api.ts** — the single HTTP boundary. Typed Axios client with CSRF header injection and
  automatic refresh on 401.
- **util/** — pure helpers: dates, status/priority config, error/toast helpers, project/task
  utilities, `statsCompute`, `scheduleAnalysis`.
- **config/index.ts** — `API_BASE_URL` from `REACT_APP_API_URL` (checked against `undefined`, not
  truthiness, because the container build passes an empty string on purpose), request timeout,
  debounce delay.
- **types.ts** — the domain types every API function is declared against.

### State management

Server state is owned by **TanStack Query** (`QueryClient` created in `App.tsx`). The contexts are
thin façades over it, not hand-rolled stores:

- `ProjectsContext` runs a `useQuery` on `['projects']` and exposes project/task CRUD. Mutations
  invalidate the query rather than patching local state; `retryProjects()` forces a fetch for a
  user-initiated retry.
- `NotificationsContext` holds the notification list and unread count in local state fed by a
  Server-Sent Events stream, with exponential-backoff reconnect. Notification types that mean the
  board changed additionally invalidate the projects query (debounced).
- `AuthContext` holds the current user in `useState`; there is no server query behind it. The user
  is resolved once at startup in `App.tsx` via `checkUserAuth()`.
- `ThemeContext` holds dark mode.
- Comment API access lives in the `useComments` hook, not a context.

### Authentication flow

1. `POST /api/auth/login` sets three cookies: `accessToken` (HttpOnly, 15 min), `refreshToken`
   (HttpOnly, 7 days) and `XSRF-TOKEN` (script-readable).
2. `JwtAuthenticationFilter` validates the access token on every non-public request and puts the
   user id in a request attribute, which `@CurrentUserId` resolves into controller parameters.
3. On 401 the Axios interceptor calls `/api/auth/refresh` once, queues the concurrent failures and
   replays them. It skips the refresh for `/api/auth/login`, `/api/auth/refresh` and
   `/api/auth/logout`.
4. Refresh tokens are stored **hashed** (SHA-256 of 256 bits of `SecureRandom` output) and rotated
   on use. All tokens descended from one login share a `family_id`; presenting an already-consumed
   token is treated as replay and revokes the whole family. `app.session.absolute-max-days` caps
   the session regardless of rotation.
5. CSRF is double-submit: `CsrfProtectionFilter` requires the `XSRF-TOKEN` cookie value echoed in
   the `X-CSRF-Token` header on every unsafe method.

### Public vs protected endpoints

`config/PublicEndpoints` is the whole policy. Matching is **exact on the raw request URI**, which is
fail-closed: an encoding trick makes a path *less* likely to match an exemption, never more. The
one exception is the API docs subtree (`/swagger-ui/*`, `/v3/api-docs*`), which is a deliberate
prefix match.

Reachable without an access token:

- `POST /api/users` (registration — the path is exempt for POST only)
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `/error`
- `/actuator/health`
- `/swagger-ui/*`, `/v3/api-docs*`

Everything else requires a valid access token. Exempt from the CSRF check: `POST /api/auth/login`,
`POST /api/users`, `/error`, `/actuator/health`.

### File storage

Uploads are written to the directory named by `app.storage.upload-dir` (`UPLOAD_DIR`, default
`uploads`). Nothing serves that path over HTTP — `/uploads/...` is only the on-disk directory name,
and neither the backend nor nginx maps it. The public route is `GET /files/{name}`
(`FileController`), which requires a valid JWT *and* project access:
`stored_files` records which project each upload belongs to, and `AccessGuard` is consulted before
the bytes are streamed. Files uploaded before that table existed have no owner recorded and stay
readable to any authenticated user. Responses are always `Content-Disposition: attachment` with
`X-Content-Type-Options: nosniff`, so an uploaded document can never render in the app's origin.

Uploads use `multipart/form-data` with a JSON metadata part plus file parts.

### Notification system

`NotificationService` creates notifications asynchronously for:

- project invitations, project updates, member removal (`ProjectService`)
- task assignment, task update including date changes, task deletion (`TaskService`)
- new comment on a task, reply to a comment, reaction to a comment (`CommentService`)

There is **no mention parsing** anywhere in the codebase — comments are not scanned for `@name`.

Delivery is a Server-Sent Events stream at `GET /api/notifications/stream`, managed by
`SseEmitterManager` (capped at `app.sse.max-emitters-per-user` concurrent streams per user).
`refreshNotifications()` and `GET /api/notifications/unread-count` are the fallback.

### Schedule optimizer

`POST /api/optimization/simulate` returns proposed dates without writing anything;
`POST /api/optimization/apply` recomputes the schedule server-side and writes it, rather than
trusting dates echoed back by the browser.

`SchedulingService` builds a `ScheduleModel` from task DTOs, derives a `PrecedenceGraph`, and runs
the `SsgsDecoder` (serial schedule generation scheme) under several `PriorityRule`s, keeping the
candidate with the lowest objective value. The objective is
`Z = alpha * (WT / WT_max) + beta * (C_max / H)` — both terms normalised to `[0, 1]` so portfolios
of different sizes are comparable. `alpha`/`beta` default to `0.8`/`0.2`
(`app.optimization.default-alpha` / `-beta`).

`CriticalPathAnalyzer` computes the critical path used by the timeline view.

## Configuration

All backend settings live in `backend/src/main/resources/application.properties` under `app.*`,
`jwt.*` and `spring.*`. There is no production profile file — the committed defaults are the safe
ones (Flyway on, `ddl-auto=validate`, `app.cookie.secure=true`).

`JWT_SECRET` is the only setting with **no default**. It is bound as a validated
`@ConfigurationProperties` record with `@Size(min = 32)`, so the application fails at startup
without it.

29 environment variables are read by `application.properties`; the compose file adds
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `HTTP_PORT` and `REACT_APP_API_URL`. The full
table with defaults is in [README.md](../README.md#configuration); the annotated template is
`.env.example`. Do not duplicate that table here — verify against `application.properties`.

Two that are easy to get wrong:

- `COOKIE_SECURE` defaults to **true**. On a plain-HTTP localhost stack the browser will not send
  the auth cookies, so login appears to succeed and every following request is unauthenticated.
  Local development needs `COOKIE_SECURE=false`.
- `server.forward-headers-strategy=NATIVE` plus `server.tomcat.remoteip.internal-proxies`
  (`INTERNAL_PROXIES`) is what makes `request.getRemoteAddr()` return the real client address behind
  the reverse proxy. Widening the pattern so that arbitrary clients match defeats the rate limiter.

## Database schema

Flyway owns the schema: `backend/src/main/resources/db/migration/`, currently `V1` through `V7`.
It is enabled by default and runs on every startup — development, CI and production alike.
`spring.jpa.hibernate.ddl-auto=validate` means Hibernate only verifies that the entity model
matches; it never mutates the schema.

- Schema changes go in a **new** `V{n}__description.sql`. Never edit an applied migration — Flyway
  records a checksum per version and refuses to start when one changes.
- Never hand-write DDL against a running database, and never add DDL to a seed script.
- `baseline-on-migrate=true` with `baseline-version=1` lets Flyway adopt a database built by the
  old auto-DDL setup.

Migration highlights, useful when reading entities: V2 made `refresh_tokens.user_id` a real foreign
key; V3 gave every foreign key an explicit `ON DELETE` action, added the missing join-table primary
keys, made email identity case-insensitive, and added `projects.created/updated` (NOT NULL) and
`users.version`; V4 renamed `refresh_tokens.token` to `token_hash` and added
`family_id`/`family_started_at`/`consumed_at`; V5 added `stored_files`; V6 backfilled
`users.version` for rows that predate V3 and made the column `NOT NULL`; V7 dropped the redundant
case-sensitive unique constraint on `users.email` from V1, since V3's case-insensitive
`uk_users_email_lower` already subsumes it.

## Key entities

- **User** — owns projects, is a member of projects, is assigned tasks, receives notifications.
  Optimistically locked (`version`).
- **Project** — has an owner, members, tasks, a unique `projectKey`, `nextTaskNumber` for allocating
  task numbers, attachments, and other projects as dependencies. Optimistically locked.
- **Task** — belongs to a project, has one assignee, comments, activities, attachments, other tasks
  as dependencies, status, priority, progress, start/due dates. Identified in the API by
  `{projectKey}-{taskNumber}`. Optimistically locked.
- **Comment** — belongs to a task, has an author, an optional parent comment (threading),
  reactions and attachments. Optimistically locked.
- **Notification** — belongs to a user, carries a type and a link.
- **RefreshToken** — hash, family id, family start, consumption timestamp.
- **StoredFile** — maps an uploaded filename to the project and uploader it belongs to.

## Demo data

`backend/scripts/db/demo-seed.sql` loads a realistic portfolio for demos and manual testing; see
`backend/scripts/db/DEMO-SEED-README.md`. It is idempotent — it clears its own data first — and it
must never contain DDL, since Flyway owns the schema.
