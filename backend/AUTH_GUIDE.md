# Phase 1: user registration and login

## Authentication approach

The database stores a BCrypt password hash (cost 12), never the readable password. The user record has ID, name, normalized email, password hash, and role. Public registration always creates CUSTOMER; a browser cannot request ADMIN. Passwords must contain at least eight characters and no more than 72 UTF-8 bytes, BCrypt's input limit. Email uniqueness is checked in code and enforced by a database unique constraint, including concurrent signup attempts.

Login uses Spring Security's DaoAuthenticationProvider and PasswordEncoder. Unknown email and wrong password produce the same 401 message. A successful login rotates the session ID, clears the old CSRF token, and explicitly saves the authenticated security context in the server session. Responses contain only ID/name/email/role, never password/hash. There are no JWTs or authentication tokens in localStorage.

The browser receives an HttpOnly, SameSite=Lax session cookie, with a 30-minute idle timeout. Local HTTP development uses a non-Secure cookie; set `SESSION_COOKIE_SECURE=true` for HTTPS deployment. Use HTTPS for any real deployment. Session state is in this single backend process and is lost when it restarts.

CSRF protection remains enabled even for login and registration. GET a CSRF token, retain the session cookie, then send the returned token in its specified header on every POST. Get a fresh token after login/logout. Form login and HTTP Basic stay disabled. All routes other than health, CSRF retrieval, registration, and login remain protected.

## API contract

- `GET /api/health`: public; unchanged 200 response.
- `GET /api/auth/csrf`: public; returns `token` and `headerName`, and establishes the CSRF session as needed.
- `POST /api/auth/register`: public with CSRF; accepts `name`, `email`, `password`; returns 201 and a user response. Registration itself does not authenticate. Duplicate email returns 409.
- `POST /api/auth/login`: public with CSRF; accepts `email`, `password`; returns 200 and a user response, and establishes the authenticated cookie session.
- `GET /api/auth/me`: authenticated; returns 200 and the current user. Without a session, returns 401.
- `POST /api/auth/logout`: authenticated with CSRF; invalidates the session and returns 204.

Validation/malformed JSON returns 400; invalid credentials returns 401; missing/invalid CSRF returns 403. JSON errors consistently contain `code`, `message`, and `fields`. Validation fields contain messages, not submitted values. Database/internal errors return generic messages without SQL, credentials, hashes, or stack traces. CORS rejection is handled by Spring's CORS filter and may use its standard text response.

Example response: `{"id":1,"name":"Your Name","email":"you@example.com","role":"CUSTOMER"}`.

Example error: `{"code":"INVALID_CREDENTIALS","message":"Invalid email or password","fields":{}}`.

## Migration safety and profiles

`src/main/resources/db/migration/V1__create_users.sql` creates only `users`, its primary key, unique email constraint, and role check. It seeds no accounts and contains no DROP, UPDATE, DELETE, or table overwrite. It targets the installed MySQL 8.0.46 using InnoDB/utf8mb4. There are no product, cart, checkout, or admin migrations in this phase.

The Spring Boot-managed `spring-boot-starter-flyway` and `flyway-mysql` dependencies supply Flyway integration and MySQL support. Do not pin a separate incompatible Flyway version. Spring Boot stays at 4.1.1; Java stays at 21.

On `mysql` startup, Flyway applies the migration once, recording it in `flyway_schema_history`; later startups validate its checksum rather than recreating the table. Hibernate only validates mappings. Flyway clean is disabled and baseline-on-migrate is false.

**If fuelfit_db already has tables without Flyway history, or already has an incompatible users table, startup deliberately stops.** Inspect and back up the existing schema before planning a compatible migration. Do not drop tables, enable automatic baselining, or add IF NOT EXISTS to hide the mismatch. No schema adaptation was attempted against your live database in this phase because credentials were not available to the agent.

`dev` remains database-free: health/security checks run, but the auth controller/service are not loaded. Use `mysql` for real authentication. The `test` profile exists only under test resources and uses an isolated in-memory H2 database. It does not touch MySQL.

## Start locally in Windows PowerShell

Stop the old FuelFit backend terminal with Ctrl+C first, especially before building: Windows locks running JARs. Do not terminate unrelated Java processes.

```powershell
Set-Location 'C:\Users\Sandeep More\Documents\Codex\2026-10-21\fr\outputs\fuelfit-frontend\backend'
$env:JAVA_HOME = (Resolve-Path '..\..\..\work\fuelfit-setup\java21\jdk-21.0.12.1+1').Path
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\mvnw.cmd clean verify

$env:DB_HOST = 'localhost'
$env:DB_PORT = '3306'
$env:DB_NAME = 'fuelfit_db'
$env:DB_USERNAME = 'fuelfit_user'
$secret = Read-Host 'MySQL password for fuelfit_user' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
$socketTemp = (Resolve-Path '..\..\..\work').Path
try {
    java "-Djdk.net.unixdomain.tmpdir=$socketTemp" -jar .\target\fuelfit-backend.jar --spring.profiles.active=mysql
}
finally {
    Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable secret -ErrorAction SilentlyContinue
}
```

This supplies credentials only to that PowerShell process and its Java child. Do not type a password literal in a command, commit it, send it in chat, or persist it with setx. Environment files remain ignored and are not automatically loaded by Spring Boot. The database must already exist and the user needs permissions to create the new table/Flyway history as well as read/write user records.

If MySQL authentication/TLS fails, resolve the reported connection configuration locally. Do not switch off TLS or change MySQL authentication plugins as a blanket workaround. Do not combine dev and mysql profiles.

## Test the APIs from a second PowerShell window

These commands create a real new customer if the MySQL backend is running. Choose a test email you own or a dedicated local test email; repeated registration should return 409. Password input stays out of command history. Do not print the body variable or credentials.

```powershell
$base = 'http://127.0.0.1:8080/api/auth'
$email = Read-Host 'Test account email'
$name = Read-Host 'Test account name'
$accountSecret = Read-Host 'New test account password (8+ characters)' -AsSecureString
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    $csrf = Invoke-RestMethod "$base/csrf" -WebSession $session
    $headers = @{}
    $headers[$csrf.headerName] = $csrf.token
    $body = @{name=$name; email=$email; password=[System.Net.NetworkCredential]::new('', $accountSecret).Password} | ConvertTo-Json
    Invoke-RestMethod "$base/register" -Method Post -WebSession $session -Headers $headers -ContentType 'application/json' -Body $body

    $body = @{email=$email; password=[System.Net.NetworkCredential]::new('', $accountSecret).Password} | ConvertTo-Json
    Invoke-RestMethod "$base/login" -Method Post -WebSession $session -Headers $headers -ContentType 'application/json' -Body $body
    Invoke-RestMethod "$base/me" -WebSession $session

    # Login rotated the CSRF token. Fetch a fresh one before logout.
    $csrf = Invoke-RestMethod "$base/csrf" -WebSession $session
    $headers[$csrf.headerName] = $csrf.token
    Invoke-WebRequest "$base/logout" -Method Post -WebSession $session -Headers $headers
}
finally {
    Remove-Variable body,accountSecret -ErrorAction SilentlyContinue
}
Invoke-RestMethod 'http://127.0.0.1:8080/api/health'
```

## Frontend integration

Open the existing frontend HTTP server at `http://127.0.0.1:8859`. Its JavaScript sends requests to `http://127.0.0.1:8080/api/auth` with cookies (`credentials: include`) and a freshly obtained CSRF token before each POST. If you use localhost instead, use it consistently on both sides and set FRONTEND_ORIGIN to your exact frontend origin before starting the backend. Do not use file:// or mix localhost and 127.0.0.1 for cookie authentication.

The existing modal, colors, layout, and CSS are preserved. Only signup password help text changes from six to eight characters. Signup calls register then login to preserve automatic sign-in. Reload uses `/me`; logout calls the server. The old `ff-user` and plaintext `ff-accounts` browser keys are removed, not imported as real accounts. Cart storage/catalog behavior is unchanged. Failed network requests show errors rather than inventing successful login. Password inputs are cleared after a submission.

Search's no-result message now uses textContent instead of inserting the search query as HTML. This closes an existing script-injection path that could undermine cookie authentication; the appearance is unchanged.

## Files added or changed

New backend Java files under `src/main/java/com/fuelfit/`:

- `controller/AuthController.java`: register, login, CSRF, me, logout endpoints.
- `service/AuthService.java`: normalized email lookup, registration, database-backed UserDetailsService.
- `repository/UserRepository.java`: JPA queries and persistence.
- `entity/User.java`, `entity/Role.java`: user record and fixed role values.
- `dto/RegisterRequest.java`, `dto/LoginRequest.java`, `dto/UserResponse.java`, `dto/ApiError.java`: validated request and safe response shapes.
- `exception/DuplicateEmailException.java`, `exception/ApiExceptionHandler.java`: consistent error handling.

Other new files:

- `src/main/resources/db/migration/V1__create_users.sql`.
- `src/test/resources/application-test.properties`.
- `src/test/java/com/fuelfit/AuthIntegrationTests.java`.
- `AUTH_GUIDE.md` (this document).
- `../tests/auth-frontend.test.cjs`: browser-code tests using Node's built-in runner, with mocked DOM/fetch; no external packages.

Modified files:

- `pom.xml`: Boot-managed Flyway dependencies and test-only H2.
- `src/main/java/com/fuelfit/config/SecurityConfig.java`: database authentication provider, BCrypt, session persistence/rotation, CSRF, public auth routes, JSON security errors.
- `src/main/java/com/fuelfit/config/CorsConfig.java`: allow GET/POST from the exact configured frontend origin.
- `package-info.java` in entity, repository, service, and exception: updated package descriptions.
- `src/main/resources/application.properties`: cookie/session settings and unknown-input-field rejection.
- `src/main/resources/application-dev.properties`: keep Flyway disabled in database-free dev.
- `src/main/resources/application-mysql.properties`: default DB name, Flyway safety settings, Hibernate validate-only.
- `README.md`: current Phase 1 entry point and corrected profile descriptions.
- `../3rd.js`: API-based authentication and safe search output.
- `../index.html`: signup password help text only.

No CSS, archive designs, product data, cart behavior, or BACKEND_PLAN.md was changed. No real database records were deleted or overwritten.

## Verification scope

Run backend tests with `.\mvnw.cmd test`. Run frontend tests from the project root with `node --test tests/auth-frontend.test.cjs` and syntax-check with `node --check 3rd.js`.

The backend suite covers successful registration, BCrypt hashing, normalized duplicate emails, invalid registration fields, login persistence, session rotation, logout, invalid credentials, CSRF enforcement/rotation, rejected role injection, malformed JSON, the BCrypt byte limit, health, CORS, and database-free dev startup. It uses actual Spring Security/JPA against H2, not mocked auth services. Frontend tests exercise API calls, CSRF/cookie options, validation feedback, session restoration, and logout behavior with a mocked browser environment.

These tests do not run the MySQL-specific migration or a complete real-browser flow against MySQL. Real MySQL connection/migration and end-to-end browser verification remain pending local credentials. No default admin/customer account is created in MySQL by tests.

### Actual results — 21 October 2026

- Final `.\mvnw.cmd -B -ntp verify`: **BUILD SUCCESS**; **16 tests**, zero failures, zero errors, zero skipped (10 auth integration tests plus 6 setup/security tests).
- `node --test tests/auth-frontend.test.cjs`: **7 passed**, zero failures. These use a mocked DOM/fetch, not a real browser.
- `node --check 3rd.js` and `git diff --check`: passed.
- A previous packaging attempt encountered a Windows lock from a running FuelFit JAR; stopping that process resolved it. The final full verify/package run succeeded without skipping tests.
- The new packaged backend was restarted in database-free **dev** mode; the live health endpoint returned HTTP **200**, `{"status":"UP","message":"FuelFit Backend Running"}`.
- MySQL environment credentials were not available to the agent. A read-only attempt using the previously named login path returned access denied. No live migration or user registration was attempted against MySQL; no existing database data was changed.
- To use the actual frontend login, stop the dev server and start the **mysql** profile using the commands above. Successful H2 tests do not establish that your live MySQL migration has run.
- Non-fatal Mockito/Java-agent warnings appeared during tests; they did not cause failures.
