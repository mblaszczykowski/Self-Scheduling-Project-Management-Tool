# FlowLink Implementation Plan

## Overview

This plan addresses findings from the Phase 1 audit, organized into 4 sprints by priority.
Each change includes rationale, affected files, and testing requirements.

---

## Sprint 1: Critical Security & Data Integrity (Days 1-3)

### 1.1 Remove Unsafe CSP Directives
**Priority:** Critical | **Effort:** Low | **Risk:** Low

**Files:**
- `backend/src/main/java/com/backend/filter/SecurityHeadersFilter.java`

**Changes:**
```java
// Before (line 40)
"script-src 'self' 'unsafe-inline' 'unsafe-eval'; "

// After
"script-src 'self'; "
```

**Rationale:** `unsafe-eval` is unnecessary for React production builds. If inline scripts are needed, implement nonce-based CSP.

**Testing:**
- Verify frontend loads correctly
- Check browser console for CSP violations
- Test all interactive features (modals, forms, timeline)

**Rollback:** Revert single line if issues arise

---

### 1.2 Remove Default JWT Secret
**Priority:** Critical | **Effort:** Low | **Risk:** Medium

**Files:**
- `backend/src/main/resources/application.properties`

**Changes:**
```properties
# Before (line 4)
jwt.secret=${JWT_SECRET:your-256-bit-secret-key-should-be-at-least-32-characters-long-for-security}

# After
jwt.secret=${JWT_SECRET}
```

**Rationale:** Application should fail fast if secret isn't configured, preventing accidental deployment with known secret.

**Testing:**
- Verify app fails to start without JWT_SECRET env var
- Verify app starts correctly with JWT_SECRET set
- Test login/logout flow

**Rollback:** Re-add default (not recommended)

**Migration Notes:**
- Ensure all deployment environments have JWT_SECRET configured
- Document in README/deployment guide

---

### 1.3 Add DDL Auto Configuration for Production Safety
**Priority:** Critical | **Effort:** Low | **Risk:** Low

**Files:**
- `backend/src/main/resources/application.properties`

**Changes:**
```properties
# Before (line 21)
spring.jpa.hibernate.ddl-auto=update

# After
spring.jpa.hibernate.ddl-auto=${DDL_AUTO:validate}
```

**Rationale:** Production should validate schema, not modify it. Developers can override locally.

**Testing:**
- Start app with existing database - should work
- Start app with schema mismatch - should fail with clear error

**Migration Notes:**
- Add `DDL_AUTO=update` to local development .env files
- Document schema change process (manual or Flyway)

---

### 1.4 Fix Rate Limiter Memory Leak + Add Cleanup
**Priority:** Critical | **Effort:** Medium | **Risk:** Low

**Files:**
- `backend/src/main/java/com/backend/filter/RateLimitFilter.java`

**Changes:**
Add scheduled cleanup method:
```java
@Scheduled(fixedRate = 60000) // Every minute
public void cleanupExpiredEntries() {
    long now = System.currentTimeMillis();
    loginAttempts.entrySet().removeIf(entry ->
        now - entry.getValue().windowStart > WINDOW_MS * 2
    );
}
```

Add `@EnableScheduling` to main application class if not present.

**Rationale:** Prevents unbounded memory growth from accumulated IP entries.

**Testing:**
- Unit test: verify entries are cleaned after expiry
- Load test: verify memory stays bounded under traffic

**Note:** For distributed deployments, Redis-backed rate limiting should be considered separately (Sprint 4).

---

## Sprint 2: High-Impact Improvements (Days 4-8)

### 2.1 Add Axios Request Timeout
**Priority:** High | **Effort:** Low | **Risk:** Low

**Files:**
- `frontend/src/util/api.js`

**Changes:**
```javascript
// Before (lines 5-8)
const api = axios.create({
    baseURL: config.API_BASE_URL,
    withCredentials: true,
});

// After
const api = axios.create({
    baseURL: config.API_BASE_URL,
    withCredentials: true,
    timeout: 30000, // 30 seconds
});
```

**Testing:**
- Test with slow network simulation
- Verify timeout error is handled gracefully

---

### 2.2 Expose Error State and Add User Feedback
**Priority:** High | **Effort:** Medium | **Risk:** Low

**Files:**
- `frontend/src/context/DataContext.js` (minor - already exposes error)
- `frontend/src/components/ErrorToast.jsx` (new)
- `frontend/src/components/Dashboard.js`
- `frontend/src/components/UnifiedView.jsx`
- `frontend/src/App.js`

**Changes:**

Create `ErrorToast.jsx`:
```jsx
import React, { useEffect, useState } from 'react';

export const ErrorToast = ({ error, onDismiss, autoDismiss = 5000 }) => {
    const [visible, setVisible] = useState(!!error);

    useEffect(() => {
        if (error) {
            setVisible(true);
            if (autoDismiss) {
                const timer = setTimeout(() => {
                    setVisible(false);
                    onDismiss?.();
                }, autoDismiss);
                return () => clearTimeout(timer);
            }
        }
    }, [error, autoDismiss, onDismiss]);

    if (!visible || !error) return null;

    const message = error.response?.data?.message || error.message || 'An error occurred';

    return (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3">
            <span>{message}</span>
            <button onClick={() => { setVisible(false); onDismiss?.(); }} className="text-white/80 hover:text-white">
                ✕
            </button>
        </div>
    );
};
```

Update `DataContext.js` to add `clearError`:
```javascript
const clearError = useCallback(() => setError(null), []);

// Add to value object:
clearError,
```

Update consuming components to show error toast.

**Testing:**
- Simulate API failures
- Verify toast appears with meaningful message
- Verify auto-dismiss works
- Verify manual dismiss works

---

### 2.3 Fix N+1 Query in Project Member Loading
**Priority:** High | **Effort:** Medium | **Risk:** Medium

**Files:**
- `backend/src/main/java/com/backend/services/ProjectService.java`
- `backend/src/main/java/com/backend/daos/UserDAO.java` (add method)
- `backend/src/main/java/com/backend/repositories/UserRepository.java` (add method)

**Changes:**

Add to `UserRepository.java`:
```java
List<User> findByEmailIn(Collection<String> emails);
```

Add to `UserDAO.java`:
```java
public Map<String, User> findByEmailsAsMap(Collection<String> emails) {
    if (emails.isEmpty()) return Map.of();
    return userRepository.findByEmailIn(emails).stream()
        .collect(Collectors.toMap(User::getEmail, u -> u));
}
```

Update `ProjectService.java` member resolution:
```java
// Before: loop with individual queries
for (var memberDTO : memberDTOs) {
    var member = userDAO.getUserByEmail(memberDTO.email())
        .orElseThrow(...);
    // ...
}

// After: batch load
Set<String> memberEmails = memberDTOs.stream()
    .map(MemberDTO::email)
    .filter(email -> !email.equals(owner.getEmail()))
    .collect(Collectors.toSet());

Map<String, User> usersByEmail = userDAO.findByEmailsAsMap(memberEmails);

for (var memberDTO : memberDTOs) {
    if (memberDTO.email().equals(owner.getEmail())) continue;
    User member = usersByEmail.get(memberDTO.email());
    if (member == null) {
        throw new ResourceNotFoundException("User not found: " + memberDTO.email());
    }
    // ...
}
```

**Testing:**
- Unit test with mock: verify single batch query executed
- Integration test: update project with 10 members, verify performance

---

### 2.4 Add Search Debouncing
**Priority:** High | **Effort:** Low | **Risk:** Low

**Files:**
- `frontend/src/components/UnifiedView.jsx`
- `frontend/package.json` (add lodash.debounce if not present)

**Changes:**
```javascript
import debounce from 'lodash.debounce';

// Replace direct state update with debounced version
const [searchInput, setSearchInput] = useState('');
const [searchQuery, setSearchQuery] = useState('');

const debouncedSetSearch = useMemo(
    () => debounce((value) => setSearchQuery(value), 300),
    []
);

useEffect(() => {
    return () => debouncedSetSearch.cancel();
}, [debouncedSetSearch]);

// In JSX:
<input
    value={searchInput}
    onChange={e => {
        setSearchInput(e.target.value);
        debouncedSetSearch(e.target.value);
    }}
/>
```

**Testing:**
- Type quickly in search - verify no lag
- Verify search results update after typing stops

---

### 2.5 Add Profile Picture Validation
**Priority:** High | **Effort:** Low | **Risk:** Low

**Files:**
- `backend/src/main/java/com/backend/controllers/UserController.java`
- `backend/src/main/java/com/backend/services/FileStorageService.java`

**Changes:**
In `UserController.java`, add validation before storing profile picture:
```java
if (profilePicture != null && !profilePicture.isEmpty()) {
    // Validate it's actually an image
    Set<String> allowedImageTypes = Set.of("image/jpeg", "image/png", "image/gif");
    String contentType = profilePicture.getContentType();
    if (contentType == null || !allowedImageTypes.contains(contentType)) {
        throw new FileStorageException("Profile picture must be JPEG, PNG, or GIF");
    }
    // Also validate magic bytes
    fileStorageService.validateImageMagicBytes(profilePicture);
    // ... proceed with upload
}
```

Add `validateImageMagicBytes` method to `FileStorageService` (extract from existing validation logic).

**Testing:**
- Try uploading PDF as profile picture - should fail
- Try uploading valid image - should succeed
- Try uploading image with wrong extension - should fail

---

### 2.6 Add Pagination to Search Endpoints
**Priority:** High | **Effort:** Medium | **Risk:** Medium

**Files:**
- `backend/src/main/java/com/backend/repositories/ProjectRepository.java`
- `backend/src/main/java/com/backend/repositories/TaskRepository.java`
- `backend/src/main/java/com/backend/controllers/ProjectController.java`
- `backend/src/main/java/com/backend/controllers/TaskController.java`
- `frontend/src/util/api.js`

**Changes:**

Update repository methods to accept `Pageable`:
```java
Page<Project> searchProjectsForUser(
    @Param("query") String query,
    @Param("userId") Integer userId,
    Pageable pageable
);
```

Update controller to accept pagination params:
```java
@GetMapping("/search")
public Page<ProjectDTO> searchProjects(
    @RequestParam String query,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
) {
    return projectService.searchProjects(query, PageRequest.of(page, size));
}
```

**Testing:**
- Search with many results - verify pagination works
- Test page navigation
- Test edge cases (empty results, last page)

---

## Sprint 3: Code Quality (Days 9-12)

### 3.1 Centralize Public Endpoint Constants
**Priority:** Medium | **Effort:** Low | **Risk:** Low

**Files:**
- `backend/src/main/java/com/backend/config/PublicEndpoints.java` (new)
- `backend/src/main/java/com/backend/filter/JwtAuthenticationFilter.java`
- `backend/src/main/java/com/backend/filter/CsrfProtectionFilter.java`
- `backend/src/main/java/com/backend/filter/RateLimitFilter.java`

**Changes:**

Create `PublicEndpoints.java`:
```java
package com.backend.config;

import java.util.Set;

public final class PublicEndpoints {
    private PublicEndpoints() {}

    public static final Set<String> AUTH_ENDPOINTS = Set.of(
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/logout"
    );

    public static final Set<String> PUBLIC_ENDPOINTS = Set.of(
        "/api/users/exists"
    );

    public static final Set<String> STATIC_PREFIXES = Set.of(
        "/uploads/",
        "/files/",
        "/static/"
    );

    public static boolean isPublic(String path) {
        if (AUTH_ENDPOINTS.contains(path) || PUBLIC_ENDPOINTS.contains(path)) {
            return true;
        }
        return STATIC_PREFIXES.stream().anyMatch(path::startsWith);
    }
}
```

Update filters to use `PublicEndpoints.isPublic(path)`.

**Testing:**
- Verify all filters behave identically after refactor
- Test public endpoints remain accessible
- Test protected endpoints still require auth

---

### 3.2 Centralize Validation Constants
**Priority:** Medium | **Effort:** Low | **Risk:** Low

**Files:**
- `backend/src/main/java/com/backend/util/ValidationConstants.java` (new or update)
- `backend/src/main/java/com/backend/services/ProjectService.java`
- `backend/src/main/java/com/backend/services/TaskService.java`
- `backend/src/main/java/com/backend/services/CommentService.java`

**Changes:**

Create/update `ValidationConstants.java`:
```java
public final class ValidationConstants {
    private ValidationConstants() {}

    public static final int MAX_SUMMARY_LENGTH = 200;
    public static final int MAX_DESCRIPTION_LENGTH = 5000;
    public static final int MAX_COMMENT_LENGTH = 10000;
    public static final int MAX_PROJECT_KEY_LENGTH = 10;
}
```

Update services to import from `ValidationConstants`.

**Testing:**
- Unit tests for validation logic
- Verify error messages reference correct limits

---

### 3.3 Improve CSRF Token Parsing
**Priority:** Medium | **Effort:** Low | **Risk:** Low

**Files:**
- `frontend/src/util/api.js`

**Changes:**
```javascript
// Before
const getCsrfToken = () => {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? match[1] : null;
};

// After
const getCsrfToken = () => {
    const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
        const [key, ...valueParts] = cookie.split('=');
        acc[key] = valueParts.join('='); // Handle values containing '='
        return acc;
    }, {});

    const token = cookies['XSRF-TOKEN'];
    return token ? decodeURIComponent(token) : null;
};
```

**Testing:**
- Verify CSRF protection still works
- Test with special characters in token (if applicable)

---

### 3.4 Add Error Boundary Component
**Priority:** Medium | **Effort:** Low | **Risk:** Low

**Files:**
- `frontend/src/components/ErrorBoundary.jsx` (new)
- `frontend/src/App.js`

**Changes:**

Create `ErrorBoundary.jsx`:
```jsx
import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
        // Could send to error reporting service
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100">
                    <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">Something went wrong</h1>
                        <p className="text-gray-600 mb-6">We're sorry, but something unexpected happened.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
```

Wrap app in `ErrorBoundary` in App.js.

**Testing:**
- Throw error in component - verify boundary catches it
- Verify reload button works

---

### 3.5 Standardize File Extensions
**Priority:** Medium | **Effort:** Low | **Risk:** Low

**Files:**
- Rename `.js` component files to `.jsx`

**Affected files:**
- `LoginForm.js` → `LoginForm.jsx`
- `RegisterForm.js` → `RegisterForm.jsx`
- `Header.js` → `Header.jsx`
- `Dashboard.js` → `Dashboard.jsx`
- `Comments.js` → `Comments.jsx`
- `AccountModal.js` → `AccountModal.jsx`

Update imports in files that reference these.

**Testing:**
- Verify app builds without errors
- Verify hot reload works

---

### 3.6 Add addUserToProject Error Handling
**Priority:** Medium | **Effort:** Low | **Risk:** Low

**Files:**
- `frontend/src/context/DataContext.js`

**Changes:**
```javascript
// Before
const addUserToProject = useCallback(async (projectKey, userEmail) => {
    const foundUser = await getUserByEmail(userEmail);
    if (!foundUser) throw new Error('User not found');
    // ... no try-catch around updateProject
    await updateProject(projectKey, updatedProject);
    return updatedProject;
}, [projects, updateProject]);

// After
const addUserToProject = useCallback(async (projectKey, userEmail) => {
    const foundUser = await getUserByEmail(userEmail);
    if (!foundUser) throw new Error('User not found');

    const projectToUpdate = projects.find(p => p.projectKey === projectKey);
    if (!projectToUpdate) throw new Error('Project not found');

    const updatedMembers = [...projectToUpdate.members, foundUser];

    try {
        const result = await updateProject(projectKey, {
            ...projectToUpdate,
            members: updatedMembers,
        });
        return result;
    } catch (error) {
        // Don't leave local state inconsistent
        throw new Error(`Failed to add user: ${error.message}`);
    }
}, [projects, updateProject]);
```

**Testing:**
- Test adding user with network failure
- Verify error message is clear

---

### 3.7 Remove Unused AWS S3 Dependency
**Priority:** Low | **Effort:** Low | **Risk:** Low

**Files:**
- `backend/pom.xml`

**Changes:**
Remove S3 SDK dependency (lines 51-54) if not planned for use.

**Testing:**
- Verify build succeeds
- Verify file uploads still work (local storage)

---

### 3.8 Fix Configuration Inconsistencies
**Priority:** Low | **Effort:** Low | **Risk:** Low

**Files:**
- `backend/src/main/resources/application.properties`

**Changes:**
```properties
# Remove unused format_sql (line 25)
# spring.jpa.properties.hibernate.format_sql=true  <- DELETE

# Add comment for connection pool sizing
# HikariCP Connection Pool
# Adjust maximum-pool-size based on expected concurrent users
# Formula: connections = (core_count * 2) + effective_spindle_count
spring.datasource.hikari.maximum-pool-size=${HIKARI_MAX_POOL:20}
```

**Testing:**
- Verify app starts correctly
- Monitor connection pool under load

---

## Sprint 4: Polish & Future Improvements (Days 13-15)

### 4.1 Add Basic Accessibility Improvements
**Priority:** Medium | **Effort:** Medium | **Risk:** Low

**Files:**
- `frontend/src/components/Header.jsx`
- `frontend/src/components/TaskProjectModal.jsx`
- `frontend/src/components/UnifiedView.jsx`

**Changes:**
Add ARIA attributes:
```jsx
// Notification dropdown
<button
    aria-expanded={isOpen}
    aria-haspopup="true"
    aria-label="Notifications"
>

// Modal
<div
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
>
    <h2 id="modal-title">...</h2>

// Timeline
<section aria-label="Project timeline">
    <table role="grid" aria-label="Task timeline">
```

**Testing:**
- Test with screen reader
- Run axe-core audit
- Verify keyboard navigation

---

### 4.2 Add Loading Skeletons
**Priority:** Low | **Effort:** Medium | **Risk:** Low

**Files:**
- `frontend/src/components/Skeleton.jsx` (new)
- `frontend/src/components/Dashboard.jsx`

**Changes:**

Create reusable skeleton component:
```jsx
export const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

export const CardSkeleton = () => (
    <div className="bg-white rounded-lg p-4 shadow">
        <Skeleton className="h-6 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
    </div>
);
```

Show skeleton while `loading` is true in Dashboard.

**Testing:**
- Verify skeleton appears during load
- Verify smooth transition to content

---

### 4.3 Component Refactoring (Dashboard)
**Priority:** High | **Effort:** High | **Risk:** Medium

This is a larger refactor - break into sub-tasks:

**Files:**
- `frontend/src/components/Dashboard.jsx`
- `frontend/src/hooks/useDashboardStats.js` (new)
- `frontend/src/components/dashboard/StatsCards.jsx` (new)
- `frontend/src/components/dashboard/TaskList.jsx` (new)
- `frontend/src/components/dashboard/CriticalPathSection.jsx` (new)

**Strategy:**
1. Extract stats calculation into custom hook
2. Extract each section into its own component
3. Add React.memo to child components
4. Test each extraction independently

**Testing:**
- Verify identical visual output
- Performance profiling before/after
- Verify no functional regressions

---

### 4.4 Add Redis Rate Limiting (Optional/Production)
**Priority:** Medium | **Effort:** High | **Risk:** Medium

**Files:**
- `backend/pom.xml` (add spring-boot-starter-data-redis)
- `backend/src/main/java/com/backend/filter/RateLimitFilter.java`
- `backend/src/main/resources/application.properties`

**Note:** Only implement if deploying multiple instances. Current in-memory solution is fine for single-instance deployment.

---

## Testing Strategy

### Unit Tests (Priority: High)
- ValidationConstants usage
- Rate limiter cleanup logic
- CSRF token parsing
- Error handling in DataContext

### Integration Tests (Priority: Medium)
- Project member batch loading
- Search pagination
- File upload validation

### E2E Tests (Priority: Medium)
- Login flow with error handling
- Project creation with members
- Task search with pagination

### Manual Testing Checklist
- [ ] App starts without JWT_SECRET → fails with clear error
- [ ] App starts with JWT_SECRET → works
- [ ] CSP violations in browser console → none
- [ ] Login rate limiting → blocks after N attempts
- [ ] API timeout → shows error toast
- [ ] Search → results paginated
- [ ] Profile picture upload → validates image type
- [ ] Component crash → error boundary catches

---

## Rollout Sequence

### Stage 1: Non-Breaking Changes (Can deploy immediately)
1. Rate limiter cleanup task
2. Axios timeout
3. Error toast component
4. CSRF parsing improvement
5. Error boundary
6. File extension rename
7. Remove unused dependency

### Stage 2: Configuration Changes (Requires env var updates)
1. Remove default JWT secret
2. DDL auto-update → validate
3. Connection pool sizing

### Stage 3: API Changes (Requires frontend coordination)
1. Search pagination
2. N+1 query fixes

### Stage 4: Security Hardening
1. CSP tightening
2. Profile picture validation
3. Magic byte validation expansion

---

## Estimated Timeline

| Sprint | Focus | Duration | Changes |
|--------|-------|----------|---------|
| 1 | Critical Security | 3 days | 4 items |
| 2 | High Impact | 5 days | 6 items |
| 3 | Code Quality | 4 days | 8 items |
| 4 | Polish | 3 days | 4 items |

**Total: ~15 working days**

---

## Next Steps

1. Review and approve this plan
2. Set up test environment for validation
3. Begin Sprint 1 implementation
4. Daily check-ins on progress

Ready to begin implementation when approved.