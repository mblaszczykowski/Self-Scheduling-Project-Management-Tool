# Demo data

`demo-seed.sql` fills an empty FlowLink database with a realistic portfolio: four accounts, three
projects, 45 tasks with dependencies, threaded comments, reactions and notifications. It exists so
a fresh install has something to show — for a product demo, a screenshot, or manual testing of a
change against data that looks like a real plan rather than three rows.

The tasks are deliberately over-committed: the same three people are assigned across all three
projects, and their assignments overlap in time. Those overlaps are the resource conflicts the
schedule optimizer resolves, so **Optimize Schedule** has something meaningful to do immediately
after seeding.

## Accounts

Every account uses the password `Demo1234!`.

| Email | Role in the data |
|---|---|
| `demo@flowlink.dev` | Portfolio manager (Emma Clarke). **Sign in as this one** — she owns all three projects and receives the notifications. |
| `daniel.brooks@flowlink.dev` | Contributor (Daniel Brooks) |
| `priya.sharma@flowlink.dev` | Contributor (Priya Sharma) |
| `marcus.webb@flowlink.dev` | Contributor (Marcus Webb) |

`Demo1234!` satisfies the registration policy enforced by `ValidationUtil`: at least 8 characters,
an upper-case letter, a lower-case letter, a digit, a special character, and no spaces. The stored
BCrypt hash (cost 10, `$2b$` prefix) is accepted by `BCryptPasswordEncoder`.

These are demonstration credentials in a committed file. Do not load this data into any deployment
that is reachable from the internet.

## What it contains

| | Count |
|---|---|
| Accounts | 4 |
| Projects (`ECOM`, `MAPP`, `B2B`) | 3 |
| Tasks (15 per project) | 45 |
| Task dependencies | 15 |
| Comments (including one reply) | 5 |
| Reactions | 5 |
| Notifications for the manager | 6 |

Priority mix across the 45 tasks: 5 HIGHEST, 9 HIGH, 18 MEDIUM, 9 LOW, 4 LOWEST. Eight statuses are
represented — `BACKLOG` (34, the bulk of the planned work), plus one each of
`GATHERING_INTEREST`, `TODO`, `TO_REVIEW`, `TO_TEST`, `IN_TEST` and `READY_TO_MERGE`, and 5 `DONE`
— so the list and board views show more than a single column.

The projects:

1. **ECOM** — e-commerce platform redesign, 15 tasks from a UX audit through to a 2.0 release.
2. **MAPP** — iOS/Android companion app, 15 tasks from stack research through to store submission.
3. **B2B** — partner wholesale API, 15 tasks from requirements through to a public API v1.0.

## Prerequisites

The database must already have the schema. Flyway creates it on the first backend start, so run the
application once (or `docker compose up`) before seeding.

The script contains **no DDL**. Flyway owns the schema; a seed script that alters tables or
constraints silently undoes a migration.

## Running it

### psql

```bash
psql -U postgres -d flowlink -f backend/scripts/db/demo-seed.sql
```

Run it from the repository root — the path above is relative to it. If the backend runs under
Docker Compose, the database port is not published, so either publish it for one session:

```bash
docker compose run --rm --publish 5432:5432 db
psql -h localhost -U postgres -d flowlink -f backend/scripts/db/demo-seed.sql
```

or pipe the file straight into the running container:

```bash
docker compose exec -T db psql -U postgres -d flowlink < backend/scripts/db/demo-seed.sql
```

### A GUI client

Open `demo-seed.sql` in DataGrip, DBeaver or pgAdmin and execute it as a script against the
`flowlink` database.

## Re-running and resetting

The script is idempotent. Section 0 deletes everything it owns — the `@flowlink.dev` accounts and
the `ECOM` / `MAPP` / `B2B` projects with all their tasks, dependencies, comments, reactions,
notifications, attachments and activity history — before re-inserting it. The whole thing runs in
one transaction, so a failure leaves the database untouched.

That makes the demo repeatable:

1. Run the script. You get the baseline: 45 tasks with overlapping assignments.
2. Sign in as `demo@flowlink.dev` and use **Optimize Schedule**. Proposed dates appear as ghost bars
   with a metrics panel.
3. Apply the suggestions. The schedule in the database changes.
4. Run the script again to return to step 1.

It only touches its own rows. Other accounts and projects in the same database are left alone.

## Changing the password

Generate a new BCrypt hash and replace all four occurrences of the existing one in
`demo-seed.sql`:

```bash
# Python
python3 -c 'import bcrypt; print(bcrypt.hashpw(b"NewPassword1!", bcrypt.gensalt(10)).decode())'

# or htpasswd, from apache2-utils
htpasswd -bnBC 10 "" "NewPassword1!" | tr -d ':\n'
```

Any of the `$2a$`, `$2b$` or `$2y$` prefixes is accepted. The new password must satisfy the
policy above or the accounts will exist but be unable to sign in through a normal registration
path.

## What to look at in the app

Signed in as `demo@flowlink.dev`:

- **Dashboard** — project and task counts, upcoming deadlines, and analytics charts. Completed
  tasks are backdated so the completion trend spans several weeks instead of one bar.
- **Projects** — the Gantt timeline with 45 bars across three project rows. Overlapping bars on the
  same assignee are the resource conflicts; dependencies are drawn as arrows.
- **Optimize Schedule** in the timeline header — runs the optimizer and shows proposed dates
  alongside the current ones, with before/after metrics.
- **Notifications** — six entries for the manager, three unread.
- **Task detail** — open `ECOM-3` for a comment thread with a reply and reactions.

## Maintenance

If you change an entity or add a migration, re-check this script. Two things it has to keep in
step with the schema:

- Columns that became `NOT NULL` (for example `projects.created` / `projects.updated` in `V3`) must
  be supplied by the INSERT — a plain INSERT does not run the entity's `@PrePersist`.
- `@Version` columns must not be left NULL. Section 11 sets them to `0`, which is what Hibernate
  writes for a newly persisted entity; a NULL version makes the application fail the first time it
  updates that row.

To verify a change, apply the migrations to an empty database and run the script twice — the second
run must succeed and leave the same row counts. The commented-out summary query at the end of the
file prints them.
