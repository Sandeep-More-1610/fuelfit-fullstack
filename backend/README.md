# FuelFit backend — full-stack shopping

Java 21, Spring Boot 4.1.1, Spring Security, Spring Data JPA, JDBC, MySQL Connector/J, Validation and Flyway. Authentication uses the existing JPA user repository; catalog and commerce use parameterized JDBC transactions. Both use the same managed datasource. No paid dependency or service is required.

Read [FULLSTACK_GUIDE.md](FULLSTACK_GUIDE.md) for API contracts, database changes and business rules. [AUTH_GUIDE.md](AUTH_GUIDE.md) and [CATALOG_GUIDE.md](CATALOG_GUIDE.md) record earlier implementation phases.

## 1. Open the backend folder and select Java 21

Open PowerShell in this project's `backend` folder. Check:

```powershell
java -version
.\mvnw.cmd -version
```

Use a Java 21 JDK, such as free Eclipse Temurin. On the original development PC, the portable JDK is already available here; these settings affect only this PowerShell window:

```powershell
$env:JAVA_HOME = 'C:\Users\Sandeep More\Documents\Codex\2026-10-21\fr\work\fuelfit-setup\java21\jdk-21.0.12.1+1'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\mvnw.cmd -version
```

On a different PC, replace JAVA_HOME with your own JDK 21 directory. Maven Wrapper downloads the pinned Maven version; no system-wide Maven installation is needed.

## 2. Build and test

Stop your previous backend from its original terminal with Ctrl+C before packaging the same running JAR on Windows.

```powershell
.\mvnw.cmd -B -ntp verify
```

Output: `target\fuelfit-backend.jar`. Backend tests use disposable H2 databases and never your `fuelfit_db`. They cover authentication, catalog, carts, checkout, ownership, rollback, duplicate orders, order status transitions and concurrent stock claims. MySQL-specific verification is separate.

## 3. Supply your existing MySQL credentials privately

Your existing database is `fuelfit_db` on localhost:3306 and the database user is `fuelfit_user`. Do not recreate or reset them. The MySQL Windows service must be running.

```powershell
$env:DB_HOST = 'localhost'
$env:DB_PORT = '3306'
$env:DB_NAME = 'fuelfit_db'
$env:DB_USERNAME = 'fuelfit_user'
$privatePassword = Read-Host 'MySQL password for fuelfit_user' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $privatePassword).Password
$env:FRONTEND_ORIGIN = 'http://127.0.0.1:8859'
.\scripts\Start-Backend.ps1
```

The password is not printed or placed in shell command history. Environment variables remain private to this terminal and its child processes; do not save them in Git or include them in screenshots. A `.env` file is not automatically loaded.

The script runs the `mysql` profile at `127.0.0.1:8080`. To use another port, pass `-Port 8081` and configure the frontend API origin accordingly. The script includes the Java socket workaround needed on this Windows PC.

On startup, Flyway validates previously applied migrations and adds V4 once. Hibernate validates the user mapping and does not create/update/drop tables. Never enable Flyway clean, automatically baseline an unknown database, delete migration history, or edit already-applied V1–V3 SQL. Back up your real database before applying a new release. If a new table name already exists, stop and inspect that conflict rather than dropping it.

After stopping the backend:

```powershell
Remove-Item Env:DB_PASSWORD
```

## 4. Start the storefront

In another PowerShell window, open the repository root:

```powershell
npm run dev
```

Open http://127.0.0.1:8859/. Node.js 22+ is required. There is no framework or frontend build step. Serving the whole repository with a generic public file server is discouraged because it can expose backend sources and local files; the included server allows only the public storefront files.

Use `127.0.0.1` for both browser/API hosts. Cookie sessions may fail if `localhost` and `127.0.0.1` are mixed. Requests use credentials and fresh CSRF tokens. CORS allows one exact configured frontend origin, never a wildcard.

## 5. Verify health and the actual database

```powershell
$response = Invoke-WebRequest 'http://127.0.0.1:8080/api/health'
$response.StatusCode
$response.Content
.\scripts\Verify-MySql.ps1
```

Health should return HTTP 200 with `{"status":"UP","message":"FuelFit Backend Running"}`. The verification script connects to MySQL and reads version, migrations, product/stock counts and commerce table counts; health alone is not a database test. It requires the credential variables from section 3 and the installed free MySQL CLI.

`GET /` remains protected and returns 401 while signed out. The storefront is served from the frontend server, not the API root.

## 6. Set up your operator account and real stock

Register your own account in the website, then run this offline command with the same database environment variables:

```powershell
.\scripts\Provision-Admin.ps1 -Email 'your-registered-email@example.com'
```

Replace that address with your own registered account. This promotes an existing account; it does not create an account, choose a password, or expose an admin signup API. Log out and sign back in to obtain the ADMIN role in your session. Manage catalog lets you set real stock, edit products/categories and process orders. Seed data does not invent inventory or create default admin accounts.

## 7. Database-free development profile

```powershell
java -jar .\target\fuelfit-backend.jar --spring.profiles.active=dev
```

This preserves the original no-database health/security setup. It intentionally has no authentication, catalog or commerce controllers. Do not combine `dev` and `mysql` profiles.

## Verification and limits

See [FULLSTACK_GUIDE.md](FULLSTACK_GUIDE.md) for the latest actual test results and opt-in MySQL test instructions. Real-store credentials were not available in the development agent's environment, so the new commerce migration was verified on an isolated MySQL 8.0.46 instance. The existing live backend on 8080 was left running. To activate these changes on `fuelfit_db`, restart it using section 3 with your existing password; never paste that password into chat.

Cash on delivery is the only implemented payment method. Newsletter signup stores consent but sends no email. Account verification, emailed password reset, courier/refund integrations and public-launch operational hardening remain outside this release. HTTPS deployment should set `SESSION_COOKIE_SECURE=true`; local HTTP development leaves it false.
