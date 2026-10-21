# FuelFit commerce release

The existing design and catalog/authentication APIs are retained. The repository is now `Sandeep-More-1610/fuelfit-fullstack`. Start with README.md for Windows setup.

## What was added

- `CommerceController.java`: authenticated account/cart/checkout/order APIs and ADMIN-only order/category APIs; consent-based public newsletter signup.
- `CommerceInput.java`: validated input DTOs. Clients cannot submit an account ID, role, price, order total, payment status or arbitrary order state.
- `CommerceService.java`: account ownership, parameterized SQL, transaction boundaries, stock locking, snapshots and safe retries.
- `V4__commerce.sql`: additive carts, cart_items, cart_merges, addresses, wishlist_items, orders, order_items and newsletter_subscribers tables, with foreign keys, uniqueness constraints and lookup indexes.
- `CommerceIntegrationTests.java`: integration and concurrent checkout regression coverage.
- `catalog.js`, `3rd.js`, `index.html`, `2nd.css`: account carts, checkout dialog, saved addresses, wishlists, customer order history, cancellation, admin order processing, category forms and newsletter consent. Existing visual styling is reused.
- `package.json`, lockfile, local storefront server and test runners: repeatable frontend serving and browser tests using free Node.js/Playwright.
- `tests/commerce-e2e.test.cjs`: opt-in tests against disposable MySQL and the real browser UI.

Security, error handling, Maven output name, startup/verification scripts, README files and the roadmap status were updated. The executable is `target/fuelfit-backend.jar`. V1–V3 are unchanged; passwords, database credentials and build files are not committed.

## API contract

Every write uses a fresh token from `GET /api/auth/csrf` in the returned `headerName`, plus the session cookie. This includes public registration/login/newsletter requests. All routes below except newsletter require login. `/api/admin/**` requires ADMIN. Existing `/api/health`, `/api/products`, `/api/products/{id}`, `/api/categories` and auth routes are preserved.

- `GET /api/cart`: current account's authoritative items, product details, availability, version, INR subtotal/shipping/total.
- `PUT /api/cart`: replace with `{version, items:[{productId,size,color,quantity}]}`. Quantities are integers 1–99, at most 50 distinct option combinations. A stale version returns 409. An empty list clears the cart. This absolute replacement supports add/update/remove without unreliable increment retries. Existing unavailable lines may be reduced/removed to repair the cart; they still block checkout.
- `POST /api/cart/merge`: `{mergeKey,items}` imports guest items, once per UUID for that account. Invalid imports roll back completely and keep the local guest cart for repair. The browser retains the retry key until success, so a lost response cannot double-import.
- `GET /api/addresses`, `POST /api/addresses`, `PUT /api/addresses/{id}`, `DELETE /api/addresses/{id}`: owned saved addresses; at most 20 per account. Address shape: `{name,phone,line1,line2,city,state,postalCode,country}`; optional line2 is an empty string, country is `IN`, PIN code is six digits beginning 1–9.
- `GET /api/wishlist`, `PUT /api/wishlist/{productId}`, `DELETE /api/wishlist/{productId}`: account-owned wishlist; repeated PUT/DELETE are safe. Maximum 200 products per account. The UI can view/remove saved products and add them from product details.
- `POST /api/checkout/quote`: `{cartVersion,address}`. Returns server-checked prices, shipping, availability and `quoteToken`. A quote does not reserve inventory.
- `POST /api/orders`: `{cartVersion,address,quoteToken,idempotencyKey}`. Returns HTTP 201 and the order. Reuse the exact same request/key on a network retry; a different body with that key returns 409. The frontend retains the request in memory on failure until the user changes/reviews checkout. Cash on delivery is the only payment method.
- `GET /api/orders?page=0&size=12`, `GET /api/orders/{id}`: owned history/details. List size 1–50. Another account's order returns 404.
- `POST /api/orders/{id}/cancel`: cancels PLACED/CONFIRMED orders and returns stock exactly once. Repeating cancellation is safe; shipped/delivered orders cannot be cancelled.
- `GET /api/admin/orders`, `GET /api/admin/orders/{id}`, `PUT /api/admin/orders/{id}/status` with `{status}`: permitted progression is PLACED → CONFIRMED → SHIPPED → DELIVERED. PLACED/CONFIRMED can instead become CANCELLED. Delivered COD orders are marked COLLECTED. Invalid transitions return 409; no arbitrary status editing or payment gateway is implied.
- `POST /api/admin/categories`, `PUT /api/admin/categories/{id}`: `{id,name,description}`. IDs are lowercase letters, digits and hyphens, at most 40 characters. Existing categories cannot be deleted; this preserves product references. New categories appear in shop filter chips and admin product forms.
- `POST /api/newsletter/subscriptions`: public but CSRF-protected `{email,consent:true}`. Stores normalized email/consent and gives the same success response for existing/new subscribers. No email is sent.
- `DELETE /api/newsletter/subscriptions/me`: authenticated account opts its own email out. No public email-only unsubscribe endpoint lets strangers opt other people out. A mail-token unsubscribe flow should accompany future actual email delivery.

Errors use `{code,message,fields}` with 400 for invalid input, 401 for signed-out access, 403 for role/CSRF rejection, 404 for missing/unowned data, 409 for conflicts and 503 for database unavailability. No submitted password, SQL, hash or internal exception is returned.

## Money, stock and concurrency

Prices use DECIMAL/BigDecimal in INR. Shipping is INR 299 when a nonempty cart subtotal is below INR 6,500 and free at or above INR 6,500. Totals are calculated on the server; the browser's amounts are display values only. No taxes, coupon rules, PIN serviceability or carrier quotations were invented.

The existing inventory table tracks stock per product, shared by size/color choices. There is no claim of separate SKU inventory for every combination. Selected options must still exist in the catalog. Seeded stock remains zero until an operator enters actual counts.

Cart/order writes lock the account row. Checkout locks product/inventory rows in a stable product order within one READ_COMMITTED transaction, checks stock, records receipt/address/price snapshots, decrements stock conditionally and clears the checked cart. Any failure rolls the whole transaction back. Two buyers cannot purchase the same final unit. Unique account/idempotency keys prevent repeated orders. Cancellation returns stock once. These locking reads follow the [MySQL transaction locking documentation](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html).

Prices/address changes require a new quote. Order history uses stored snapshots even when current product details or saved addresses change. Orders are retained when products are archived.

## Safe PowerShell API example

In a separate PowerShell window, after the backend starts:

```powershell
$api = 'http://127.0.0.1:8080/api'
Invoke-RestMethod "$api/health"

# Fetches a public token and cookie without creating an account or order.
$csrf = Invoke-RestMethod "$api/auth/csrf" -SessionVariable fuelSession

# Sign in privately; do not put a real password directly in the command text.
$email = Read-Host 'Your registered email'
$privatePassword = Read-Host 'Your account password' -AsSecureString
$login = @{email=$email; password=[System.Net.NetworkCredential]::new('', $privatePassword).Password}
$headers = @{}
$headers[$csrf.headerName] = $csrf.token
Invoke-RestMethod "$api/auth/login" -Method Post -WebSession $fuelSession -Headers $headers -ContentType application/json -Body ($login | ConvertTo-Json)
$login.password = $null

# Reads only your cart and orders. Does not purchase anything.
Invoke-RestMethod "$api/cart" -WebSession $fuelSession
Invoke-RestMethod "$api/orders" -WebSession $fuelSession
```

Obtain a new CSRF token after login before any write. Browser checkout is the simplest way to test quote confirmation and an intentional COD order.

## Verification performed on 21 October 2026

- Java 21/Maven Wrapper `verify`: 48 backend tests, zero failures/errors/skips, executable JAR packaged successfully. Includes the final unavailable-cart repair regression.
- Standard frontend/browser suite: 39 passed; 6 older opt-in catalog/MySQL tests were deliberately skipped because their separate legacy test database was not configured. Those six are not reported as passed.
- New real MySQL/browser suite: 6 passed, zero failures/skips, against the final packaged backend on port 18083. Covered persistent account carts, authoritative totals, idempotent placement/cancellation, account ownership, role protection, newsletter/address/wishlist operations, actual typed registration, saved address, COD purchase, order persistence across page reload, logout privacy, concurrent buyers, admin order controls, category writes and individual archived-cart-line removal.
- Isolated MySQL Community Server 8.0.46 on 127.0.0.1:33317, schema `fuelfit_commerce_test`; real health returned HTTP 200 and the expected JSON. All four Flyway migrations succeeded and the original 15 products remained present.
- A fresh non-web application launch from the final packaged JAR connected to the same isolated database, validated all four migrations and reported no migration necessary; data persisted. H2 results alone are not used as proof of MySQL compatibility.

Both the final backend repair and the latest frontend were included in the final end-to-end run. No test accessed, reset or seeded the real store's database.

The existing live backend on port 8080 was left running. The new code is activated on `fuelfit_db` only when you restart with your existing database credentials using README.md. The development agent does not have that password and has not tried to recover it from another process.

## Repeating the isolated MySQL checks

Use a separate disposable MySQL instance/data directory, not the service/data directory containing `fuelfit_db`. The free `mysqld.exe` included with MySQL Community Server can initialize an empty workspace directory using `--no-defaults --initialize-insecure --datadir=<new directory>` and run on loopback port 33317. Refuse to initialize a directory that already exists; choose an unused port and never reuse the real MySQL data directory. Set a randomly generated password immediately, create only the test database/user and grant that user access only to that database. Test data and credentials belong outside Git.

Create `fuelfit_commerce_test` on that isolated instance. Start the backend with DB_HOST=127.0.0.1, DB_PORT=33317, DB_NAME=fuelfit_commerce_test and its test credentials, using `Start-Backend.ps1 -Port 18081`. Keep FRONTEND_ORIGIN=http://127.0.0.1:8859 and serve the repository frontend. Let Flyway create the tables.

Register `commerce-admin@example.test` with the synthetic test-only password `SyntheticTestOnly!492`, then promote only this test account with `Provision-Admin.ps1` against the isolated database. No production default admin is created. The test script creates its other synthetic accounts through registration. With Node dependencies installed, run from the repository root:

```powershell
$env:FUELFIT_TEST_DISPOSABLE = 'yes'
$env:FUELFIT_TEST_API = 'http://127.0.0.1:18081/api'
$env:FUELFIT_TEST_ADMIN_EMAIL = 'commerce-admin@example.test'
$env:DB_NAME = 'fuelfit_commerce_test'
$env:DB_PORT = '33317'
npm run test:commerce
```

These tests intentionally create orders and alter inventory in that disposable schema. They refuse to run without the explicit opt-in, test database/port and loopback API settings. Port 18083 is also accepted for testing a fresh build while another test copy uses 18081. Never point them at the real store. Stop your own temporary test application/MySQL processes from their original terminals after testing. Real-store credentials are not needed for these checks.

## Remaining commercial-launch work

This release is a working local COD store, not a payment service or a promise of bug-free software. Production operations still need HTTPS, backups/restore exercises, access/abuse limits, email verification and password recovery, mail delivery/unsubscribe tokens, actual fulfillment/refund policies and a reviewed deployment. Remote image/font availability depends on the existing external sources. Footer company/support/legal links remain placeholders. Real card/UPI collection and courier integration require separate provider/business decisions and are not falsely presented as implemented.
