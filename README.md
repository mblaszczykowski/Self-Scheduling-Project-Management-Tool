## How to run?

#### Backend
##### Create a database
```
psql -U postgres
CREATE DATABASE flowlink;
GRANT ALL PRIVILEGES ON DATABASE "flowlink" TO postgres;
```

#### Web
```
cd frontend
npm install
npm start
```
Make sure frontend runs on default port 3000.

---

## Running Tests

### Backend Tests (Java/JUnit)

```bash
cd backend

# Run all unit tests
mvn test

# Run specific test class
mvn test -Dtest=TokenServiceTest
mvn test -Dtest=AuthServiceTest
mvn test -Dtest=JwtAuthenticationFilterTest
mvn test -Dtest=CsrfProtectionFilterTest
mvn test -Dtest=ValidationUtilTest

# Run multiple test classes
mvn test -Dtest="TokenServiceTest,AuthServiceTest,ValidationUtilTest"

# Run with verbose output
mvn test -Dtest=TokenServiceTest -DtrimStackTrace=false

# Run integration tests (requires test database)
# First, remove @Disabled annotation from AuthIntegrationTest.java
mvn test -Dtest=AuthIntegrationTest -Dspring.profiles.active=test
```

### Frontend Tests (Jest)

```bash
cd frontend

# Run all tests
npm test

# Run tests without watch mode (CI mode)
npm test -- --watchAll=false

# Run with coverage report
npm test -- --coverage --watchAll=false

# Run specific test file
npm test -- api.test.js
npm test -- DataContext.test.js

# Run with verbose output
npm test -- --verbose --watchAll=false
```

### Test Coverage

**Backend tests cover:**
- `TokenServiceTest` - JWT token generation, validation, expiration, cookie handling
- `AuthServiceTest` - Login, logout, token refresh, timing attack resistance
- `JwtAuthenticationFilterTest` - Public/protected endpoints, authentication flow
- `CsrfProtectionFilterTest` - CSRF token validation, double-submit cookie pattern
- `ValidationUtilTest` - Email, password, name validation, security edge cases

**Frontend tests cover:**
- `api.test.js` - CSRF handling, 401 refresh logic, request queuing, redirects
- `DataContext.test.js` - State management, notification polling, CRUD operations
