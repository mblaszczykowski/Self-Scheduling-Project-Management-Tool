# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowLink is a project management application with a Spring Boot backend and React frontend. It provides task tracking, project management, notifications, and collaboration features.

## Tech Stack

- **Backend**: Spring Boot 3.2.4, Java 21, PostgreSQL, Maven
- **Frontend**: React 18.3, TailwindCSS, React Router, Axios
- **Authentication**: JWT-based auth with access tokens (15 min) and refresh tokens (7 days)

## Development Commands

### Database Setup
```bash
psql -U postgres
CREATE DATABASE flowlink;
GRANT ALL PRIVILEGES ON DATABASE "flowlink" TO postgres;
```

### Backend (Spring Boot)
```bash
cd backend
mvn clean install          # Build project
mvn spring-boot:run        # Run backend (port 8080)
mvn test                   # Run tests
```

### Frontend (React)
```bash
cd frontend
npm install                # Install dependencies
npm start                  # Run dev server (port 3000)
npm run build              # Production build
npm test                   # Run tests
```

The frontend MUST run on port 3000 (default Create React App port).

## Architecture

### Backend Structure

The backend follows a layered architecture:

- **controllers/**: REST API endpoints (AuthController, ProjectController, TaskController, etc.)
- **services/**: Business logic layer
- **repositories/**: JPA data access layer
- **entities/**: JPA entity models (User, Project, Task, Comment, Notification, etc.)
- **dtos/**: Data transfer objects for API responses
- **requests/**: Request payload records for incoming API calls (LoginRequest, ProjectCreateRequest, etc.)
- **events/**: Application events + listener (async notifications/emails)
- **filter/**: Servlet filters — `SecurityHeadersFilter`, `RateLimitFilter`, `JwtAuthenticationFilter`, `CsrfProtectionFilter`
- **config/**: `@ConfigurationProperties` (AppProperties, JwtConfig, CookieProperties), `WebConfig`, `AsyncConfig`, `ScheduledTasks`, `SecurityConfig`, `PublicEndpoints`
- **exception/**: Custom exceptions + `GlobalExceptionHandler`
- **util/**: Utilities (AccessGuard, EntityMapper, CookieFactory, ScheduleOptimizer, CriticalPathMethodHelper, ValidationUtil, IpUtil)

### Frontend Structure

- **src/pages/**: Route-level containers (AuthPage, DashboardPage, ProjectsPage)
- **src/components/**: React components grouped by area (auth, comments, common, dashboard, layout, modals, projects)
- **src/context/**: Four split React contexts — `AuthContext` (user + logout), `ProjectsContext` (projects + task mutations), `NotificationsContext` (SSE stream + list), `ThemeContext` (dark mode). Each exposes a `useX()` hook.
- **src/hooks/**: Custom hooks (data enrichment, filtering, stats, modal/form state, dropdowns, etc.)
- **src/util/api.js**: Axios API client with automatic token refresh on 401 and CSRF header injection
- **src/util/**: Pure helpers (dates, status/priority config, error/toast helpers, project/task utilities)
- **src/config/**: Configuration (API_BASE_URL from REACT_APP_API_URL env var, timeline constants)

### Authentication Flow

1. User logs in via `/api/auth/login`, receives access token (15 min) and refresh token (7 day) as HTTP-only cookies
2. Access token included automatically in requests via cookies
3. `JwtAuthenticationFilter` validates tokens on protected endpoints
4. On 401, frontend axios interceptor automatically calls `/api/auth/refresh` to get new access token
5. Refresh token stored in database (`RefreshToken` entity) for revocation support

### Key Entities and Relationships

- **User**: Has many projects (as owner or member), tasks (assigned), notifications
- **Project**: Belongs to owner (User), has members (Users), tasks, projectKey (unique identifier)
- **Task**: Belongs to project, has assignees (Users), comments, attachments, status, priority
- **Comment**: Belongs to task, has author (User), can have parent comment (threading), reactions
- **Notification**: Belongs to user, links to related entities (task/project/comment)

### File Upload System

Files are stored in the `uploads/` directory. The backend serves them via `/uploads/**` and `/files/**` endpoints (public access). File uploads use multipart/form-data with JSON metadata + file attachments.

### State Management Pattern

Frontend uses split React contexts for global state:
- `ProjectsContext` fetches projects on login and exposes task/project CRUD methods. Task mutations re-fetch via `refreshProjects()`; project create/update/delete update local state optimistically.
- `NotificationsContext` opens a Server-Sent Events (SSE) stream for real-time notifications with a debounced reconnect, and exposes `refreshNotifications()` as a fallback.
- Comment API access lives in the `useComments` hook (not a context), since it doesn't touch project state.

## Configuration

### Backend Environment Variables

Set in `backend/src/main/resources/application.properties` or override with env vars:

- `JWT_SECRET`: Secret key for JWT signing (min 32 chars)
- `DATABASE_URL`: PostgreSQL connection string (default: `jdbc:postgresql://localhost:5432/flowlink`)
- `DATABASE_USER`: Database username (default: postgres)
- `DATABASE_PASSWORD`: Database password
- `CORS_ORIGIN`: Allowed frontend origin (default: http://localhost:3000)
- `COOKIE_SECURE`: Set to true in production for HTTPS-only cookies

### Frontend Environment Variables

- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:8080)

## Important Implementation Details

### CORS Configuration

Backend (`WebConfig.java`) allows credentials and exposes `Set-Cookie` header. Frontend axios client uses `withCredentials: true` for cookie-based auth.

### Token Refresh Strategy

Frontend prevents duplicate refresh requests by:
- Tracking refresh state with `isRefreshing` flag
- Queuing failed requests during refresh
- Reusing same refresh promise for concurrent 401s
- Skipping refresh for public endpoints like `/api/auth/login`

### Public vs Protected Endpoints

Public endpoints (no JWT required):
- `POST /api/users` (registration)
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/users/exists`
- `/uploads/**`, `/files/**` (static files)
- `/static/**`

All other endpoints require valid JWT access token.

### Critical Path Method

The backend includes `CriticalPathMethodHelper` service for project scheduling calculations based on task dependencies.

### Notification System

Notifications are created asynchronously for:
- Task assignments
- Comment mentions
- Project updates
- Task status changes

Frontend receives notifications in real time via an SSE stream (`NotificationsContext`), with `refreshNotifications()` as a fallback on reconnect.




