# FuelFit project review and fixes

Review date: 21 October 2026. Scope: active frontend, Java backend, configuration, migration scripts, tests, PowerShell helpers, documentation, and archived-design inventory. Existing unrelated working-tree edits were retained. No commit or push was made.

## Confirmed issues fixed

1. **Cached cart products stayed available after archival.** Catalog reload now refreshes every cart product, including cached IDs. A server 404 invalidates the cached product. Archived entries remain removable, block checkout, and do not contribute prices or a phantom shipping charge.
2. **Removed sizes/colors remained accepted in a persisted cart.** Cart availability now checks current options as well as total per-product quantity and stock. Distinct options containing hyphens no longer collide in cart keys, and legacy saved keys still merge by their actual options.
3. **Failed availability checks silently trusted stale data.** Opening the cart refreshes availability, disables progression while checking, and shows a retry instruction when verification fails. A failed request is distinguished from a genuine 404. Later retry recovers normally. Removing an unverifiable item also unblocks the remaining verified items.
4. **Slow product requests could undo later navigation.** A request sequence guard prevents a late product response from replacing Home or a newer product/admin navigation.
5. **Closed overlays were still keyboard-focusable.** Search/cart/account overlays now expose accurate inert/aria-hidden state. Cart/search trap focus while open and restore the trigger on close. Layout, CSS, colors, and branding were preserved.
6. **Checkout/newsletter reported actions that did not happen.** Their messages now explicitly say these features are not available yet. No new order, payment, or newsletter service was invented.
7. **Storage failures could interrupt the cart flow.** Cart state still works in memory when localStorage is unavailable, with a warning that it could not be saved.
8. **Refreshing categories reset the selected chip.** Category rendering preserves the active category and accessible pressed state.
9. **Catalog search omitted category text.** Search now matches category IDs in addition to name/description, retaining parameterized SQL and literal wildcard escaping.
10. **An HTTPS-looking string could be saved as an invalid image URL.** Product validation now requires an actual HTTPS host, a valid port, and no embedded credentials. Validation failures return 400 without inserting a product.
11. **Catalog input errors mentioned password length.** The generic 400 message now refers to invalid request bodies/parameters.
12. **Startup documentation was inconsistent with the current project.** The root README now describes the full-stack app, HTTP frontend requirement, implemented features, and remaining placeholders. Older auth/setup commands now use the actual Phase 2 JAR name.

The nine new browser regressions are in `tests/review-browser.test.cjs`. Five initial cases reproduced the original bugs before their fixes. Additional cases cover keyboard behavior, cart key collisions, and removing unverifiable items.

## Verification performed in this review

- **32 backend tests passed**, zero failures/errors/skips, with Java 21.0.12.1 and Spring Boot 4.1.1. This includes 10 auth, 16 catalog/migration/admin, and 6 setup/security tests.
- The full Maven **verify/package build succeeded**. It ran in an isolated workspace copy so the running application's JAR was not overwritten. SHA-256 comparisons confirmed every backend source/test/resource file in that build matches the project.
- **37 frontend/browser tests passed**, zero failures/skips: 7 authentication JavaScript tests, 11 responsive/auth/navigation checks, 10 catalog-toolbar checks, and 9 new regressions. Browser checks use installed Edge through Playwright; these use intercepted API fixtures and do not write to a database.
- **6 real-MySQL browser tests passed**: end-to-end catalog/admin/session/permission/error-recovery cases against the explicitly guarded disposable database on port 33307 and test API on port 18080. The final combined Node run reported **43 passed, zero failures, zero skipped**.
- Across the final backend and Node runs, **75 tests passed**. Earlier baseline runs and intermediate retries are not counted again in this total.
- JavaScript syntax checks and `git diff --check` passed. All three PowerShell helpers parsed successfully.
- Existing running endpoints on port 8080 returned HTTP 200 for `/api/health`, `/api/products`, `/api/categories`, and `/api/auth/csrf`. Public catalog returned **15 published products and 3 categories**. Unauthenticated `/` still returns **401 by design**.
- A real `SELECT 1` succeeded against the separate MySQL Community **8.0.46** test database. All V1/V2/V3 Flyway history entries reported success.
- Restarted the isolated MySQL-profile backend. It returned health HTTP 200; Flyway reported no migrations necessary. Product-row count, published count, inventory-row count, and total stock matched before/after restart. Archived test products remain in the disposable schema by design; only the original 15 products are published.

## Data safety and deployment status

The existing frontend server on port 8859, backend on port 8080, and MySQL service on port 3306 were not stopped or reconfigured. Read-only HTTP probes were made against the existing app. All database writes and test accounts in this review used the guarded disposable MySQL test schema on **33307**, never the existing `fuelfit_db` service on 3306. No existing database/table was dropped, and no migration file was edited.

Frontend fixes take effect after refreshing the page. **The running backend on 8080 still uses its earlier JAR.** The reviewed backend fixes (category search, image validation, and generic error wording) have been built and tested in isolation but are not automatically deployed into that process. Database credentials are not available in this agent's process, so replacing/restarting the existing server would risk losing its working connection configuration.

To activate the reviewed backend, use the same credential-configured PowerShell session as your normal backend, stop the old backend with Ctrl+C, then from `backend/` run:

```powershell
.\mvnw.cmd verify
.\scripts\Start-Backend.ps1
```

Java 21 must be selected, and DB_USERNAME/DB_PASSWORD must already be supplied as process environment variables. See AUTH_GUIDE.md for hidden password entry; do not send credentials in chat or commit them. Only restart your own FuelFit process. No global Java, Windows service, firewall, or database account change is required.

## Files changed by this review

- `3rd.js`: cart freshness/option checks, navigation race guard, honest placeholder messages, storage error handling, overlay accessibility.
- `catalog.js`: preserve selected category, retain HTTP error status, refresh cached cart data, invalidate pending detail navigation when entering admin.
- `index.html`: overlay accessibility attributes only; no visual redesign.
- `README.md`: current full-stack startup and feature status.
- `backend/README.md`, `backend/AUTH_GUIDE.md`: correct current JAR command names.
- `backend/src/main/java/com/fuelfit/dto/ProductInput.java`: semantic HTTPS image validation.
- `backend/src/main/java/com/fuelfit/service/CatalogService.java`: category matching in search.
- `backend/src/main/java/com/fuelfit/exception/ApiExceptionHandler.java`: correct generic input-error wording.
- `backend/src/test/java/com/fuelfit/CatalogIntegrationTests.java`: two additional backend regressions.
- `tests/catalog-mock.cjs`: match category-search behavior in browser fixtures.
- `tests/review-browser.test.cjs`: new browser regressions.
- `REVIEW_NOTES.md`: this record.

Pre-existing CSS, migration scripts, auth security rules, password handling, and unrelated changes were preserved.

## Remaining boundaries

- This remains a development store: checkout/payment/orders, newsletter persistence/delivery, and footer support/company/legal pages are not implemented. Cart contents are local to the browser and do not reserve inventory.
- Live database credentials, complete live-table contents, and live account login were not inspected. Real login and admin behavior were checked in isolated automated tests instead.
- Browser tests use Edge on Windows. They do not certify every physical device/browser or third-party image/font uptime.
- Existing marketing statistics and policy statements are static content, not verified operational claims.

Temporary review backends and the isolated MySQL process were stopped after testing. The normal frontend/backend/MySQL service remain running.

## Subsequent password-field fix

The actual in-app browser exposed a typing bug that fill-based browser tests had missed: both password DOM `onkeydown` callbacks returned false on ordinary keys, cancelling text entry. The shared `onPasswordEnter` helper now intercepts only Enter and leaves typing, deletion, navigation, and Tab keys alone. All eight focused authentication tests passed after this change. Asset version query strings ensure the browser loads the corrected JavaScript and current styles rather than cached earlier files. The browser form was reopened for the user; no password was read, set, or submitted by the agent.
> Full-stack update: see `backend/FULLSTACK_GUIDE.md` for the subsequent commerce implementation and latest verification. Review findings below describe the earlier catalog/authentication release.
