# Reproducing application verification

Run these checks after changing functionality, contracts, configuration, or screenshots. The browser scenarios use the production nginx and Spring Boot images, not a mocked API.

## Code and API contract

Use Java 21, Maven, Docker and Node 24 LTS (Node 22.12+ also works).

```bash
cd backend
mvn clean test
# Only when intentionally updating the public API:
mvn test -Dtest=OpenApiContractTest -Dopenapi.write=true
cd ../frontend
npm ci
npm run generate:api-types
npm run typecheck
npm run lint
npm test -- --watchAll=false
npm run build
npm audit
cd ..
python3 scripts/verify-docs.py
```

On macOS select Java 21 with `export JAVA_HOME=$(/usr/libexec/java_home -v 21)`. For Colima, set `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`; disable Ryuk only if its socket integration requires it. Integration tests share a PostgreSQL container for the lifetime of the JVM and stop it on JVM shutdown, keeping cached Spring contexts connected to the same database.

Date and schedule regressions should also pass outside UTC:

```bash
cd frontend
TZ=Europe/Warsaw npm test -- --watchAll=false
TZ=America/Los_Angeles npm test -- --watchAll=false
```

## Browser verification

Create a separate environment file, project name and database volume for testing. Never run the demo seed against a real workspace. A minimal environment file for a local test contains fresh generated `JWT_SECRET` and `POSTGRES_PASSWORD`, `COOKIE_SECURE=false`, `HTTP_PORT=8187`, and both `CORS_ORIGIN` and `FRONTEND_BASE_URL` set to `http://localhost:8187`.

```bash
docker compose --env-file /path/to/review.env -p flowlink-review up --build --wait --wait-timeout 180
docker compose --env-file /path/to/review.env -p flowlink-review exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/scripts/db/demo-seed.sql
cd frontend
npx playwright install chromium
FLOWLINK_BASE_URL=http://localhost:8187 npm run test:e2e
```

CI uses its own environment file in `RUNNER_TEMP`, the `flowlink-ci` project and port 8088. It starts the complete stack, seeds its dedicated database, runs Chromium functional and accessibility scenarios (including keyboard focus loops), uploads browser reports and removes only that temporary stack.

## Screenshots

The capture script signs in as the documented demo account and captures actual rendered screens. It does not apply optimization or change tasks. It writes desktop screenshots at 1600×1100, light and dark dashboard variants, mobile screenshots at 390×844, and `docs/screenshots/capture.json` with browser, date, viewport and optimizer metrics.

```bash
cd frontend
FLOWLINK_BASE_URL=http://localhost:8187 npm run capture:screenshots
```

Inspect every resulting image before committing. Check the light and dark dashboards, selected-project timeline, optimizer preview, list, task dialog, profile, mobile list and mobile menu. Captions should describe the shown features rather than repeat numerical results that change with demo dates or algorithm changes.

To update a Mermaid diagram, edit its source in `docs/diagrams/src/` and regenerate the matching SVG using Mermaid CLI. Both the source and rendered image belong in the same change.

## Deployment and recovery checks

Before using an existing database with a newer build, back up both PostgreSQL and the uploads volume. `pg_dump -Fc` preserves database data; uploaded files require a separate archive. Restore to an isolated database and volume, start the application with Flyway validation, and check sign-in and a protected attachment download. A database backup without its uploads cannot restore attachments.

Empty databases receive V1 automatically. Adopting a non-empty legacy database requires a complete schema comparison and an explicit one-time `FLYWAY_BASELINE_ON_MIGRATE=true`; this setting skips V1 and does not repair missing constraints. Remove it after adoption. Use HTTPS and `COOKIE_SECURE=true` for deployed environments. Keep the single-backend topology documented in README unless shared rate limiting, event delivery and session-revocation broadcasting have been implemented.
