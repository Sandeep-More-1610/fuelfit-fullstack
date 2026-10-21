# FuelFit

Latest project check and fixes: [REVIEW_NOTES.md](REVIEW_NOTES.md).

A fitness storefront with an HTML/CSS/vanilla JavaScript frontend and a Java 21, Spring Boot 4.1.1, MySQL backend.

## What works

- Registration, BCrypt password hashing, session login/logout, and CSRF protection.
- Database-backed product browsing, search, categories, filters, sorting, and pagination.
- ADMIN-only catalog management, archive actions, and inventory updates.
- A browser-local cart with refreshed stock/option checks. The cart does not reserve stock.
- Responsive desktop/mobile navigation and account forms.

Checkout/payment, order processing, newsletter delivery, and the footer's support/company/legal destinations are not implemented. The UI reports checkout/newsletter as unavailable rather than pretending to submit them. Do not treat this as an operational store yet.

## Run locally

1. Read [backend/README.md](backend/README.md) and [backend/CATALOG_GUIDE.md](backend/CATALOG_GUIDE.md) for Java, MySQL environment variables, migration safety, and startup commands. Start the backend using `backend/scripts/Start-Backend.ps1` after building it. No database password belongs in source.
2. Serve this folder over HTTP at `http://127.0.0.1:8859` using your local static server. Opening index.html with file:// is insufficient for cookie-based API access. The frontend needs the running backend at `http://127.0.0.1:8080`.
3. Open the frontend URL. An internet connection is needed for external Google Fonts and Pexels images.

If you use another frontend origin, set FRONTEND_ORIGIN to that exact URL before starting the backend. Do not mix localhost and 127.0.0.1 for session cookies. The dev profile deliberately has no database-backed auth/catalog; use mysql for the full app.

## Project files

- `index.html`, `2nd.css`: current UI markup and styles.
- `3rd.js`, `catalog.js`: authentication, API-backed catalog/admin UI, and local cart behavior.
- `backend/`: application source, environment-based settings, additive migrations, tests, and PowerShell helpers.
- `tests/`: frontend/browser regressions and explicitly test-only catalog fixtures.
- `archive/`: older standalone designs, not the active application.
- `BACKEND_PLAN.md`: original roadmap; later guides describe the implemented phases.

## Tests

Run `./mvnw.cmd test` from backend with Java 21 selected. Run `node --test tests/*.test.cjs` from the project folder with Playwright available on NODE_PATH and Microsoft Edge installed. Browser tests require the frontend server. Mocked browser tests do not write to the live database; the real MySQL suite refuses to run except against its explicitly guarded disposable test environment.

For authentication examples and the complete auth API contract, read [backend/AUTH_GUIDE.md](backend/AUTH_GUIDE.md). Database migrations never drop or overwrite existing account data. No code changes were committed or pushed by this review.
