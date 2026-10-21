# FuelFit Phase 2 catalog

Implemented in the existing HTML/CSS/vanilla JavaScript frontend and Java 21 / Spring Boot / MySQL backend. No paid services or real credentials were added.

## What changed

- `3rd.js`: replaces the 15 hardcoded products with an API-backed cache; loads details from the server; adds server search, category/price/stock filters, sorting and paging; escapes displayed strings; checks stock before adding to the existing cart; keeps existing session login, signup, logout, navigation and responsive behavior.
- `catalog.js` (new): shared catalog HTTP/CSRF helpers, API category loading, explicit loading/error/retry behavior, ADMIN management page, create/edit/archive forms, inventory updates and paging.
- `index.html`, `2nd.css`: accessible labeled catalog controls, stock indicators, pagination and responsive admin forms/cards. Uses the existing design, with no framework conversion.
- `backend/src/main/resources/db/migration/V2__create_catalog.sql`: adds `categories`, `products`, `inventory`, foreign keys, nonnegative price/stock checks and a category/active index. Product and inventory versions support atomic conflict detection.
- `V3__seed_existing_catalog.sql`: insert-only seeds for the original 3 categories and 15 products. Original IDs, names, descriptions, rupee prices, image URLs, featured flags, sizes and colors are retained. Missing inventory rows start at zero because original stock was unknown. Existing rows are never overwritten.
- `backend/src/main/java/com/fuelfit/dto/ProductInput.java`: validates product fields, HTTPS image URLs, prices, option lists and versions.
- `service/CatalogService.java`: parameterized database queries, whitelisted sorting, literal search wildcard escaping, pagination, transactional product creation and edits, archive and inventory changes.
- `controller/CatalogController.java`, `controller/AdminCatalogController.java`: public read APIs and protected admin APIs.
- `config/SecurityConfig.java`, `config/CorsConfig.java`: public catalog reads, ADMIN-only `/api/admin/**`, CSRF protection and exact-origin PUT/DELETE preflights. Existing session authentication remains in use.
- `exception/ApiExceptionHandler.java`: structured 400/404/409 catalog responses without database internals.
- `config/AdminProvisioning.java`, `application-admin-provision.properties`: explicit offline promotion of one existing account. No public admin signup, default admin or seeded passwords. This profile opens no web server.
- `application.properties`: rejects fractional values for integer fields instead of silently truncating stock quantities.
- `backend/pom.xml`: executable output is now `target/fuelfit-backend-phase2.jar`; this avoids overwriting the existing running Phase 1 JAR.
- `backend/scripts/Start-Backend.ps1`, `Provision-Admin.ps1`, `Verify-MySql.ps1`: environment-based startup, offline promotion and read-only database checks.
- `backend/src/test/java/com/fuelfit/CatalogIntegrationTests.java`: 14 new backend tests. Existing 16 backend tests remain.
- `tests/catalog-browser.test.cjs`: 6 real-MySQL browser/session/permission/error-recovery tests. `catalog-mock.cjs` and `fixtures/catalog.json` support isolated browser regressions; application code never falls back to those fixtures.
- `tests/responsive-browser.test.cjs`: existing 11 tests now intercept catalog API responses and wait for asynchronous results. Existing 7 frontend auth tests remain.
- `.gitignore`: excludes local work/verification files. Existing ignored credential files stay ignored.

The original users migration V1 and existing authentication implementation were preserved. Existing unrelated working-tree changes were retained; nothing was committed or pushed.

## API contract

Public GET endpoints:

- `/api/categories`
- `/api/products?q=&category=&minPrice=&maxPrice=&inStock=&sort=featured&page=0&size=24`
- `/api/products/{id}`

List response: `{items,total,page,size}`. Page is zero-based; size is 1–100. Sort is `featured`, `price-low`, `price-high` or `name`. `inStock` is optional `true`/`false`. Prices are INR amounts consistent with the original catalog. Public reads only return published products.

ADMIN-only endpoints:

- GET `/api/admin/products?page=0&size=24`, GET `/api/admin/products/{id}` (includes archived listings)
- POST `/api/admin/products` (creates a zero-stock product)
- PUT `/api/admin/products/{id}` (requires the last returned product `version`)
- DELETE `/api/admin/products/{id}?version=N` (archives, preserving product/inventory rows)
- PUT `/api/admin/products/{id}/inventory`, body `{quantity,version}` using `inventoryVersion` from the product response

Product write body: `{name,category,description,price,image,sizes,colors,featured,active,version}`. For creation use version 0. Every write needs the existing server session and a fresh token from GET `/api/auth/csrf`, sent in the returned header name. Login invalidates old CSRF tokens. Missing products return 404; stale versions return 409; malformed input returns 400; CUSTOMER access to admin endpoints returns 403.

## Migrations and database safety

Normal MySQL configuration still uses `ddl-auto=validate`, disables SQL init and Flyway clean, and keeps `baseline-on-migrate=false`. There are no DROP/TRUNCATE statements or account seeds in the new migrations. Normal startup applies V2/V3 only after recognizing the existing Flyway history. An unknown nonempty schema is deliberately refused; do not turn on baselining or repair checksums to bypass it. MySQL DDL is not fully transactional, so an interrupted migration requires inspection, not blind retries or deletion.

## Verified on 21 October 2026

- Java 21.0.12.1, Spring Boot 4.1.1: `mvnw.cmd verify` succeeded; executable Phase 2 JAR built.
- Backend: **30 passed** (10 auth, 6 setup/security, 14 catalog/migration/admin).
- Frontend: **7 auth tests passed**.
- Browser: **11 responsive/auth/navigation tests passed**, covering 320, 375, 390, 768, 900, 901, 1024, 1440 and landscape 844 pixels.
- Additional real-MySQL browser tests: **6 passed**, including 375px and 1440px catalog and admin forms, actual session login, CUSTOMER denial for all six admin operations, out-of-stock cart behavior, safe text rendering, and outage/retry behavior.
- **54 tests passed in total.** Browser engine: installed Microsoft Edge, headless, through Playwright.
- Disposable MySQL Community **8.0.46**, bound to loopback on port 33307: all V1/V2/V3 migrations succeeded, and a subsequent startup performed no migration. The API returned the original 15 published products and 3 categories.
- Separate disposable MySQL upgrade schema: apply V1, insert a preservation-only CUSTOMER row, then apply V2/V3. SHA-256 fingerprints of the complete existing user row before/after matched. All migrations recorded success.
- Replaying V3 in MySQL preserved an edited name and stock quantity 17, with exactly 15 catalog rows. The backend also tests idempotent seeding on H2.
- Offline admin provisioning was exercised against MySQL by the browser suite. Accounts are created as CUSTOMER, promoted by the offline profile, then logged in again as ADMIN. Real CUSTOMER sessions with valid CSRF tokens received 403 for every admin operation.
- Frontend and isolated backend health checks returned HTTP 200. The startup helper was also exercised on port 18081, and the provisioning and read-only verification helpers completed successfully. All fields of the 15 original products were compared with actual MySQL API responses and matched.

### Existing live database status

**The user's existing MySQL database was not migrated or queried for records.** Its connection password was not available to this session. Workbench configuration identified a local root connection but supplied no usable credential. The existing Phase 1 Java process and existing MySQL service were left intact. All database writes described above targeted separately initialized disposable schemas in a separate MySQL process; they did not target `fuelfit_db`.

The source is implemented and tested, but switching the user's running application to Phase 2 and verifying that specific database remains pending usable credentials. Its existing accounts/records and current migration history have not been certified by this work.

## Starting Phase 2 against the existing database when credentials are available

Use a PowerShell session with Java 21 selected, in the project backend directory. The portable JDK on this PC is `C:/Users/Sandeep More/Documents/Codex/2026-10-21/fr/work/fuelfit-setup/java21/jdk-21.0.12.1+1`. Set JAVA_HOME to that directory if needed, and add its `bin` to this session's PATH. No global setting needs to change.

1. Run `./mvnw.cmd verify` from `backend/`.
2. Set `DB_USERNAME`, `DB_PASSWORD`, and optionally `DB_HOST`, `DB_PORT`, `DB_NAME` in the process environment. Default database name remains `fuelfit_db`. No password belongs in source or command arguments. To enter a password without displaying it:

```powershell
$securePassword = Read-Host 'MySQL password' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
```

3. Stop the old backend from its existing terminal once the new connection settings are ready. Run `./scripts/Start-Backend.ps1`. This launches the new JAR on port 8080 with the mysql profile and a local Java 21 Windows socket workaround. It does not change system Java, the database configuration or any global setting. `-Port` can choose an alternate local port.
4. Run `./scripts/Verify-MySql.ps1` in the configured session to read migration history and record counts. This script only performs SELECT statements.
5. Serve the frontend on `http://127.0.0.1:8859`. Existing CORS allows that exact origin. For another origin set `FRONTEND_ORIGIN` before starting the backend. Use consistent hostnames for session cookies. Default frontend API origin is the matching loopback hostname on port 8080. If using another backend port, set `window.FUELFIT_API_ORIGIN` in a script before `3rd.js`; the browser tests inject this setting only into their isolated contexts.
6. A trusted operator should choose an existing account and run `./scripts/Provision-Admin.ps1 -Email 'the-existing-account-email'` with the same DB environment. It promotes exactly that account and fails if it does not exist. Sign out and sign in again to get the ADMIN session role. The Manage catalog button then appears. Enter real quantities through Save stock; seeded stock intentionally starts at zero.

Never put database credentials into frontend files. The application has no public role assignment endpoint.

## Running browser checks again

Set NODE_PATH to a directory containing Playwright, serve the frontend, and run:

```powershell
node --test tests/auth-frontend.test.cjs tests/responsive-browser.test.cjs
```

`tests/catalog-browser.test.cjs` intentionally skips unless `FUELFIT_E2E_API` is set. Its writes are guarded to **DB_NAME=fuelfit_phase2_test**, **DB_PORT=33307**, and **http://127.0.0.1:18080**. It requires the separately initialized disposable MySQL database, the Phase 2 backend on port 18080, JAVA_HOME and that disposable database's credentials in the process environment. Never point these tests at an existing user database. Test passwords are generated per run; no real password is embedded in tests.

## Verification environment cleanup

The separate MySQL process and the Java 21 test backends were stopped after verification. The original running Phase 1 backend and the original MySQL service were not stopped or reconfigured. Test data, logs and the Windows-encrypted test credential remain only in ignored `work/` scratch storage. No test account was provisioned in the existing user database.

## Limits

- Existing live `fuelfit_db` migration/connection/records remain unverified for lack of credentials.
- Inventory is per product, shared across sizes/colors. Variant-level warehouses, reservations, orders, checkout/payment and stock deductions are outside this phase. The existing cart and checkout placeholder remain; adding to a cart does not reserve stock.
- Images use the original external Pexels HTTPS URLs, with one image URL per product. There is no upload service or media gallery.
- Three categories are stored and read from MySQL; category editing is not an admin UI feature in this phase.
- Browser checks use Edge on this Windows PC. Physical iPhone/Safari/Android device testing remains unverified.
- Java 21 initially hit a local Windows AF_UNIX loopback error while starting Tomcat. The startup helper passes a process-only socket temp-directory setting so Java uses its built-in TCP fallback. Tests, packaging and successful MySQL-backed HTTP/browser runs all used Java 21.
- Test-only H2 warnings and Mockito dynamic-agent warnings were nonfatal. H2 evidence is reported separately from real MySQL evidence.
