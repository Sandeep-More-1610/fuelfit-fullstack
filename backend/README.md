> Phase 2 catalog and admin features are implemented. See [CATALOG_GUIDE.md](CATALOG_GUIDE.md) for current APIs, migration status, startup, admin provisioning and verification. The current executable is `target/fuelfit-backend-phase2.jar`. The Phase 1 notes below remain as historical setup context.

# FuelFit backend — Phase 1 authentication

This is a Java 21 / Spring Boot 4.1.1 Maven application. Spring Boot 4.1.1 is a stable release compatible with Java 21. It includes Spring Web MVC, Spring Data JPA, Spring Security, Validation, and MySQL Connector/J. Dependencies are managed by Spring Boot in `pom.xml`.

Registration and login are now implemented with BCrypt and server sessions. See [AUTH_GUIDE.md](AUTH_GUIDE.md) for the migration, API contract, PowerShell examples, file inventory, and verification limits. The frontend's existing modal now uses these APIs; its design is preserved. Product/cart/checkout APIs remain unimplemented.

## 1. Software found on this PC

- The system default Java was Temurin **25.0.3**, not Java 21.
- Java 21 was not found in the inspected Java installation folders. A portable Temurin **21.0.12.1+1** JDK was downloaded from Adoptium, its SHA-256 checksum verified, and extracted into the workspace's `work/fuelfit-setup/java21/` folder. No installer, system PATH, registry, or global JAVA_HOME change was made.
- Maven **3.9.6** exists at `C:\Users\Sandeep More\maven\apache-maven-3.9.6`, but `mvn` was not on PATH.
- This project includes **Maven Wrapper**, pinned to Maven **3.10.0**. You can run `mvnw.cmd` without installing Maven globally. Its first run requires internet access to download Maven and dependencies into your user cache.

The ZIP and portable JDK are workspace scratch tools, outside this Git repository. They will not be uploaded with the source.

## 2. Open PowerShell and select Java 21

```powershell
Set-Location 'C:\Users\Sandeep More\Documents\Codex\2026-10-21\fr\outputs\fuelfit-frontend\backend'

# This path is relative to the backend directory on this PC.
$env:JAVA_HOME = (Resolve-Path '..\..\..\work\fuelfit-setup\java21\jdk-21.0.12.1+1').Path
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

java -version
.\mvnw.cmd -version
```

Both commands should report Java 21. These environment changes apply only to the current PowerShell window. `JAVA_HOME` points to the JDK folder, not its `bin` folder.

If the portable JDK is moved or missing, download a **Windows x64 JDK 21 ZIP** from [Eclipse Temurin](https://adoptium.net/temurin/releases/?version=21), extract it to a folder you choose, and set JAVA_HOME to that extracted JDK folder. A global installation is optional, not necessary. If you prefer an installer, Windows Package Manager can install it with `winget install --id EclipseAdoptium.Temurin.21.JDK -e`; that changes your installed software and has not been run for this project.

You do not need to install Maven again. As an alternative to the wrapper, run the existing Maven with its full path after selecting Java 21:

```powershell
& 'C:\Users\Sandeep More\maven\apache-maven-3.9.6\bin\mvn.cmd' -version
```

## 3. Compile and test

Run from the backend directory with Java 21 selected:

```powershell
.\mvnw.cmd clean verify
```

This compiles Java, runs the tests, and creates the executable JAR in `target/`. Stop a running copy of this JAR before packaging it on Windows. Six setup tests use the database-free `dev` profile; ten authentication tests use an isolated H2 database under the `test` profile. Neither test suite connects to or clears your MySQL database. H2 tests do not certify MySQL migration compatibility.

## 4. Start without MySQL

```powershell
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=dev'
```

Wait for the `Started FuelFitBackendApplication` message. The server listens only on the PC's loopback address, port **8080**. Leave this terminal open. Press **Ctrl+C** in that terminal to stop it.

Alternatively, after building:

```powershell
java -jar .\target\fuelfit-backend-phase2.jar --spring.profiles.active=dev
```

`0.0.1-SNAPSHOT` describes the version of our work-in-progress application; Spring Boot itself is pinned to stable **4.1.1**.

### Tested Windows startup workaround on this PC

The first live launch inside the desktop command runner failed with `Unable to establish loopback connection`, caused by `UnixDomainSockets.connect0: Invalid argument`. Changing the selector provider alone did not resolve it. Setting Java's temporary Unix-domain socket directory to the existing workspace `work/` folder resolved it; the application then started successfully on port 8080.

If you encounter the same error, this is the **verified working launch command** from the backend directory, after selecting Java 21 in section 2:

```powershell
$socketTemp = (Resolve-Path '..\..\..\work').Path
java "-Djdk.net.unixdomain.tmpdir=$socketTemp" -jar .\target\fuelfit-backend-phase2.jar --spring.profiles.active=dev
```

This changes only that Java process's temporary socket location. It does not change Windows networking, firewall rules, or system environment settings. The general Maven command may work directly in a normal PowerShell terminal; the JAR command above was used for live verification here. If a backend is already running, stop it before launching another copy on the same port.

## 5. Test from a second PowerShell window

```powershell
$response = Invoke-WebRequest -Uri 'http://localhost:8080/api/health'
$response.StatusCode
$response.Content
```

Expected result:

```text
200
{"status":"UP","message":"FuelFit Backend Running"}
```

This endpoint confirms that the web application is running. It does **not** check MySQL availability in the dev profile.

Requests to protected paths, for example `/api/private` and `/api/auth/me`, return **401 Unauthorized** when not logged in. In the MySQL profile, registration/login POSTs and GET `/api/auth/csrf` are public; POSTs still require a valid CSRF token. Authentication controllers are disabled in database-free `dev`. No demo users/passwords are created.

## 6. Frontend origin and CORS

CORS is the browser's rule for allowing a web page to read responses from a different server. The default allowed origin is exactly:

```text
http://127.0.0.1:8859
```

This is the frontend local server URL established earlier in this project. GET and POST requests are allowed; valid browser preflight requests are processed by Spring's CORS support. No unrestricted wildcard is used. An origin includes the scheme, host, and port; `localhost` and `127.0.0.1` count as different origins. Use `127.0.0.1` consistently for the default frontend/backend URLs so session cookies are same-site.

If your frontend server uses a different local URL, stop the backend, set the exact origin in the same PowerShell window, and restart:

```powershell
$env:FRONTEND_ORIGIN = 'http://localhost:5500'
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=dev'
```

Use the URL actually shown by your frontend server, with no path or trailing slash. Wildcards are rejected. Opening an HTML file directly with `file://` is not this allowed HTTP origin; use a local frontend HTTP server for later integration.

Test the default origin without changing the frontend:

```powershell
$response = Invoke-WebRequest -Uri 'http://localhost:8080/api/health' -Headers @{ Origin = 'http://127.0.0.1:8859' }
$response.Headers['Access-Control-Allow-Origin']
```

Expected: `http://127.0.0.1:8859`. An unlisted origin receives 403 and no allow-origin header. CORS does not replace authentication; command-line programs do not enforce browser CORS rules.

## 7. Profiles: dev now, mysql later

A profile is a named set of application settings.

- `application.properties`: shared application name, loopback address, port 8080, exact CORS origin, and safeguards against automatic SQL/schema execution.
- `application-dev.properties`: disables datasource, Hibernate, and JPA repository auto-configuration. No connection to MySQL is attempted. `dev` is the default when no profile is explicitly selected.
- `application-mysql.properties`: enables MySQL persistence and Flyway user-table migration. Do not combine `dev` and `mysql`: the dev exclusions would disable persistence. Read the migration safety notes in AUTH_GUIDE.md before first startup.

The future MySQL profile expects:

- `DB_HOST`: defaults to `localhost`.
- `DB_PORT`: defaults to `3306`.
- `DB_NAME`: defaults to the existing `fuelfit_db` database.
- `DB_USERNAME`: required database user.
- `DB_PASSWORD`: required password, with no hardcoded fallback.

For a later step only, once a database exists and connection setup is authorized:

```powershell
$env:DB_HOST = 'localhost'
$env:DB_PORT = '3306'
$env:DB_NAME = Read-Host 'Existing database name'
$env:DB_USERNAME = Read-Host 'Database username'
# Read without putting the password in your command history.
$securePassword = Read-Host 'Database password' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=mysql'
# After stopping the process:
Remove-Item Env:DB_PASSWORD
```

The MySQL profile needs a running database and valid credentials. Hibernate uses `ddl-auto=validate`, never create/update/drop. Flyway alone applies `V1__create_users.sql` once and tracks its checksum. There is no database auto-creation or seed account. A `.env` file is **not automatically loaded** by Spring Boot; use environment variables in the process launching the server. See AUTH_GUIDE.md for the verified socket-directory startup setting and safe handling of an existing nonempty schema.

## 8. Initial setup file inventory and purpose

The list below records the initial setup. Phase 1 additions and modifications are listed separately in AUTH_GUIDE.md.

```text
backend/
  .gitattributes                  Wrapper line-ending rules from Spring Initializr
  .gitignore                      Ignores secrets, .env files, IDE files, logs, target/
  HELP.md                         Generated Spring Initializr reference links (Git-ignored)
  README.md                       These PowerShell instructions
  pom.xml                         Java 21, stable Spring Boot, dependencies, build plugin
  mvnw                            Maven Wrapper for Unix-like shells
  mvnw.cmd                        Maven Wrapper for Windows
  .mvn/wrapper/maven-wrapper.properties   Maven download/version settings
  src/main/java/com/fuelfit/
    FuelFitBackendApplication.java Main application entry point
    controller/HealthController.java       GET /api/health
    dto/HealthResponse.java                JSON response fields
    config/CorsConfig.java                 One exact allowed frontend origin
    config/SecurityConfig.java             Public health; all other paths protected
    service/package-info.java              Reserved business-logic package
    repository/package-info.java           Reserved database-access package
    entity/package-info.java               Reserved database-mapping package
    exception/package-info.java            Reserved error-handling package
  src/main/resources/
    application.properties
    application-dev.properties
    application-mysql.properties
  src/test/java/com/fuelfit/
    FuelFitBackendApplicationTests.java    Six setup/security tests
```

`package-info.java` preserves the package layout. Phase 1 adds a real auth service, user entity, and user repository. The health endpoint itself still reads no database.

Build output, compiled classes, the executable JAR, and test reports are generated under `target/` and ignored by Git. Spring Initializr also creates empty `static/` and `templates/` resource directories; no frontend was copied there. Maven/Java download caches are tool files, not application source.

## 9. Troubleshooting

- **Wrong Java version / invalid target release 21:** repeat section 2 in the terminal that launches Maven, then check `.\mvnw.cmd -version`.
- **mvn not recognized:** use `.\mvnw.cmd`; no global PATH change is necessary.
- **First build cannot download dependencies:** check your internet/proxy configuration and rerun `.\mvnw.cmd clean verify`. Do not disable TLS verification.
- **Port 8080 already in use:** inspect `Get-NetTCPConnection -LocalPort 8080 -State Listen`. Stop your own earlier backend terminal with Ctrl+C; do not terminate an unknown process.
- **Missing DB variables or connection refused:** ensure the active profile is `dev` for this step. MySQL is intentionally unnecessary here.
- **CORS 403:** match the frontend URL exactly using FRONTEND_ORIGIN, then restart. Do not replace the allowlist with `*`.

Official references: [Spring Initializr](https://start.spring.io/), [Spring Boot system requirements](https://docs.spring.io/spring-boot/system-requirements.html), [Eclipse Temurin downloads](https://adoptium.net/temurin/releases/?version=21), and [Maven Wrapper](https://maven.apache.org/wrapper/).

## 10. Historical initial-setup verification on 21 October 2026

- Maven Wrapper: Maven 3.10.0 running with Temurin Java 21.0.12.1.
- `.\mvnw.cmd -B -ntp clean verify`: **BUILD SUCCESS**; six tests, zero failures, zero errors, zero skipped.
- Packaged JAR started using the socket-directory workaround above; startup log confirmed default profile `dev`, Java 21, and Tomcat on port 8080.
- `GET http://localhost:8080/api/health`: **200**, actual body `{"status":"UP","message":"FuelFit Backend Running"}`.
- `GET /api/private`: **401**.
- Health request with `Origin: http://127.0.0.1:8859`: **200**, matching `Access-Control-Allow-Origin` header.
- OPTIONS preflight for that origin and GET: **200**.
- Health request with `Origin: http://localhost:9999`: **403**, no allow-origin header.
- The dev-profile test confirmed no DataSource bean exists. No MySQL connection, database, or tables were required or created.
- Git ignore checks confirmed generated build output, environment files, secret configuration, and logs are ignored.
- The test runner printed non-fatal Mockito/Java agent warnings. The six tests still passed; these were test-tool warnings, not application startup errors.

For current Phase 1 results and startup instructions, use AUTH_GUIDE.md. Products, cart, checkout, and admin APIs are outside this phase.
