# FlowLink

FlowLink is a project and portfolio management application. It tracks projects, tasks and task
dependencies, renders them on a Gantt-style timeline, and adds threaded comments with reactions,
file attachments, real-time notifications and global search.

Its distinguishing feature is a **schedule optimizer**. Projects in a portfolio usually share the
same people, so plans drawn independently collide. The optimizer treats the portfolio as a
resource-constrained project scheduling problem — assignees are the renewable resources, task
dependencies are precedence constraints — and searches for a schedule that minimises a weighted
combination of priority-weighted tardiness and makespan. It runs as a simulation first, so the
proposed dates can be reviewed before anything is written.

- **Backend**: Spring Boot 3.5, Java 21, PostgreSQL 16, Flyway, Maven.
- **Frontend**: React 18 in TypeScript, TanStack Query, TailwindCSS, Chart.js, Tiptap.
- **Auth**: JWT in HTTP-only cookies, rotating refresh tokens, double-submit CSRF.

---

## Quick start with Docker

This is the supported path. It builds both images, starts PostgreSQL, applies the database
migrations and publishes the site through nginx.

```bash
cp .env.example .env
```

Then edit `.env` and set the two variables that have no default:

```bash
# Signing key for JWT access tokens. Minimum 32 characters.
openssl rand -base64 48    # -> JWT_SECRET

# Password for the PostgreSQL role.
openssl rand -base64 24    # -> POSTGRES_PASSWORD
```

`JWT_SECRET` is **mandatory**. The backend binds it as a validated configuration property and
refuses to start without a value of at least 32 characters — there is no fallback default, by
design. `docker compose up` fails with a named error if either variable is missing.

For a plain-HTTP localhost stack, also set `COOKIE_SECURE=false` in `.env`. Auth cookies are marked
`Secure` by default, and a browser will not send a `Secure` cookie over `http://`, so logging in
appears to succeed and every subsequent request is unauthenticated.

```bash
docker compose up --build
```

The site is then on <http://localhost> (change the published port with `HTTP_PORT`). nginx serves
the built SPA and reverse-proxies `/api/` and `/files/` to the backend, so the browser only ever
talks to one origin.

The database port is deliberately not published. To attach `psql` or a GUI client for one session:

```bash
docker compose run --rm --publish 5432:5432 db
```

Useful operations:

```bash
docker compose logs -f backend      # follow backend logs
docker compose down                 # stop, keep the pgdata and uploads volumes
docker compose down -v              # stop and delete all data
```

---

## Local development

Two processes, plus a PostgreSQL you provide.

### Prerequisites

- **JDK 21.** The build targets Java 21, and the test suite does not run on a newer JDK: Mockito's
  bytecode instrumentation fails on JVMs it has no support for, and a machine whose default `java`
  is 24/25/26 will see the mock-based tests error out before asserting anything. Select 21
  explicitly rather than changing the machine default:

  ```bash
  # macOS
  export JAVA_HOME=$(/usr/libexec/java_home -v 21)

  # Linux with update-alternatives / SDKMAN
  export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk    # or: sdk use java 21.0.5-tem
  ```

  Verify with `mvn -version`, which prints the JDK Maven actually runs on.
- **Node 20 or newer.**
- **Docker** running, if you want to run the backend integration tests (see below).
- **PostgreSQL 16** for the backend to talk to, unless you point `DATABASE_URL` at the compose
  database.

### Database

```bash
psql -U postgres -c 'CREATE DATABASE flowlink;'
```

Nothing further: Flyway creates every table on the first backend start. Do not hand-build the
schema — see [Database schema](#database-schema).

### Backend

```bash
cd backend
export JAVA_HOME=$(/usr/libexec/java_home -v 21)

export JWT_SECRET="$(openssl rand -base64 48)"   # mandatory
export DATABASE_PASSWORD=postgres                # if your local role needs one
export COOKIE_SECURE=false                       # required for http://localhost

mvn spring-boot:run
```

It listens on port 8080. Health check: <http://localhost:8080/actuator/health> (the only actuator
endpoint exposed).

### Frontend

```bash
cd frontend
npm install
npm start
```

It listens on port 3000 and calls `http://localhost:8080` by default (`REACT_APP_API_URL`). The
backend's default `CORS_ORIGIN` is `http://localhost:3000`, so the two agree out of the box. If you
run the dev server on another port, set `CORS_ORIGIN` to match exactly — scheme, host and port. A
credentialed CORS preflight does not accept wildcards, so a mismatch blocks every API call.

---

## Tests

### Backend

```bash
cd backend
export JAVA_HOME=$(/usr/libexec/java_home -v 21)

mvn test                                  # everything except the `experiment` tag
mvn test -Dtest=AuthServiceTest           # one class
mvn test -Dtest='*ServiceTest'            # a pattern
mvn test -Dtest=SchemaIntegrationTest -DfailIfNoSpecifiedTests=false
```

**Docker must be running.** The classes under `src/test/java/com/backend/integration/` extend
`PostgresIntegrationTest`, which starts a real `postgres:16-alpine` container through
Testcontainers. They exist because the schema depends on `timestamptz` handling, enum check
constraints and `ON DELETE` semantics that an in-memory database in PostgreSQL compatibility mode
does not enforce. One container is started per build and shared across the classes.

If your Docker is a drop-in replacement (Colima, Podman, Rancher Desktop), Testcontainers may need
help finding the socket, and its resource-reaper sidecar may not start at all:

```bash
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
export TESTCONTAINERS_RYUK_DISABLED=true
```

Surefire is configured with `<excludedGroups>experiment</excludedGroups>`. The tag is reserved for
scheduling benchmark harnesses, which print report tables rather than asserting, so they must not
gate a build. Lift the exclusion to run them:

```bash
mvn test -Dgroups=experiment -DexcludedGroups=
```

No test carries the tag at the moment, so that command currently selects nothing.

### Frontend

```bash
cd frontend
npm test -- --watchAll=false             # CI mode, no watcher
npm test                                 # interactive watch mode
npm test -- --coverage --watchAll=false  # with coverage
npm run typecheck                        # tsc --noEmit, no test runner involved
npm run lint                             # eslint over src/
```

The test files live next to the code they cover, as `*.test.ts` under `src/util/`.

---

## Configuration

Every backend setting lives in `backend/src/main/resources/application.properties` and reads an
environment variable where it is meant to be overridden. There is no production profile file; the
defaults committed there are already the safe ones.

`.env.example` is the annotated template. Copy it to `.env`, which is gitignored and must never be
committed.

### Required

| Variable | Notes |
|---|---|
| `JWT_SECRET` | Signing key for JWT access tokens. Minimum 32 characters, validated at startup. No default — the application will not start without it. Generate one per environment and never reuse it. |
| `POSTGRES_PASSWORD` | Read by `docker-compose.yml` only. Sets the database role's password and is passed to the backend as `DATABASE_PASSWORD`. |

### Database

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/flowlink` | Compose derives this from `POSTGRES_DB`. |
| `DATABASE_USER` | `postgres` | |
| `DATABASE_PASSWORD` | *(empty)* | |
| `HIKARI_MIN_IDLE` | `5` | Connection pool floor. |
| `HIKARI_MAX_POOL` | `20` | Connection pool ceiling. |

### HTTP, origins and cookies

| Variable | Default | Notes |
|---|---|---|
| `CORS_ORIGIN` | `http://localhost:3000` | Origin the browser loads the app from. Must match exactly; credentialed CORS rejects wildcards. |
| `FRONTEND_BASE_URL` | `http://localhost:3000` | Base URL used to build links inside outbound email. |
| `COOKIE_SECURE` | `true` | Auth cookies are `Secure` by default. Set `false` only for a plain-HTTP localhost stack. |
| `COOKIE_SAME_SITE` | `Lax` | `Lax`, `Strict` or `None`. `None` requires `COOKIE_SECURE=true`. |
| `SESSION_MAX_DAYS` | `30` | Absolute lifetime of a login, enforced regardless of refresh-token rotation. |
| `INTERNAL_PROXIES` | RFC1918 ranges + loopback | Regex of reverse proxies whose `X-Forwarded-*` headers are trusted. See below. |

`server.forward-headers-strategy=NATIVE` plus `server.tomcat.remoteip.internal-proxies` is how the
real client address reaches the rate limiter: Tomcat's RemoteIp valve rewrites `getRemoteAddr()`
from `X-Forwarded-For`, but only when the immediate peer matches the internal-proxies pattern.
Widen `INTERNAL_PROXIES` only if your load balancer sits on a public address, and never to a
pattern that matches arbitrary clients — a client able to spoof its own address defeats the rate
limiter entirely.

### Storage and uploads

| Variable | Default | Notes |
|---|---|---|
| `UPLOAD_DIR` | `uploads` | Filesystem directory for attachments and profile pictures. In compose this is a named volume mounted at `/app/uploads`. |

Uploaded files are **not** static assets. They are served by the backend at `/files/{name}`, which
requires a valid JWT *and* access to the project the file belongs to.

### Rate limiting

Per client address per window, except login, which is additionally scoped per account.

| Variable | Default |
|---|---|
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) |
| `RATE_LIMIT_LOGIN` | `5` |
| `RATE_LIMIT_REGISTER` | `3` |
| `RATE_LIMIT_WRITE` | `300` |
| `RATE_LIMIT_OPTIMIZE` | `30` |
| `RATE_LIMIT_SEARCH` | `120` |
| `RATE_LIMIT_INVITATION` | `50` |

### Schedule optimizer

| Variable | Default | Notes |
|---|---|---|
| `OPT_ALPHA` | `0.8` | Weight of the normalised priority-weighted tardiness term. |
| `OPT_BETA` | `0.2` | Weight of the normalised makespan term. |

### Outbound mail (optional, off by default)

With mail disabled, project invitations still arrive as in-app notifications.

| Variable | Default |
|---|---|
| `APP_MAIL_ENABLED` | `false` |
| `MAIL_FROM` | `noreply@example.com` |
| `MAIL_HOST` | `smtp-relay.brevo.com` |
| `MAIL_PORT` | `587` |
| `MAIL_USERNAME` | *(empty)* |
| `MAIL_PASSWORD` | *(empty)* |

### Compose and frontend build

| Variable | Default | Notes |
|---|---|---|
| `POSTGRES_DB` | `flowlink` | Compose only. |
| `POSTGRES_USER` | `postgres` | Compose only. |
| `HTTP_PORT` | `80` | Host port the site is published on. |
| `REACT_APP_API_URL` | `http://localhost:8080` | Baked into the bundle at build time. The compose build passes an **empty string** on purpose, so the app issues same-origin relative requests that nginx proxies. An absolute URL here hard-codes a hostname into the JavaScript and bypasses the proxy. |

---

## Database schema

Flyway owns the schema. The migrations are in
`backend/src/main/resources/db/migration/` (`V1` … `V5`) and run automatically on startup, in
development, in CI and in production alike.

Hibernate is set to `spring.jpa.hibernate.ddl-auto=validate`: it verifies that the entity model
matches the migrated schema and never mutates it. A drifted entity fails the application at
startup instead of silently altering a production table.

Consequences worth knowing:

- **Never hand-edit the schema.** Add a new `V{n}__description.sql` file instead.
- **Never edit an applied migration.** Flyway records a checksum per version and refuses to start
  if one changes.
- `spring.flyway.baseline-on-migrate=true` with `baseline-version=1` lets Flyway adopt a database
  that predates it (one built by the old auto-DDL) by treating its state as `V1`.

## Demo data

`backend/scripts/db/demo-seed.sql` loads a realistic portfolio — four accounts, three projects,
45 tasks with dependencies and deliberate resource conflicts — for demos and manual testing. See
`backend/scripts/db/DEMO-SEED-README.md`.

## Repository layout

```
backend/
  src/main/java/com/backend/
    config/         @ConfigurationProperties, CORS, async and scheduling setup
    controllers/    REST endpoints
    dtos/           API response shapes
    entities/       JPA entities
    exception/      custom exceptions + GlobalExceptionHandler
    filter/         servlet filters: security headers, rate limit, JWT, CSRF
    mapper/         entity -> DTO conversion
    repositories/   Spring Data JPA
    requests/       request payload records
    scheduling/     the schedule optimizer (SSGS decoder, objective, critical path)
    security/       access guards
    services/       business logic
    util/           validation and small helpers
    web/            cookies, paging, argument resolvers
  src/main/resources/db/migration/   Flyway migrations
  scripts/db/                        demo seed data
frontend/
  src/components/   React components by area
  src/context/      AuthContext, ProjectsContext, NotificationsContext, ThemeContext
  src/hooks/        custom hooks
  src/pages/        route-level containers
  src/util/api.ts   the single HTTP boundary
docker-compose.yml
```

## License

MIT. See [LICENSE](LICENSE).
