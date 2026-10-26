# FuelFit

A full-stack fitness e-commerce portfolio project covering authentication, product discovery, persistent carts, and cash-on-delivery order processing. Built by **Sandeep More**, Computer Science and Engineering student at VIT Vellore.

Fitness e-commerce built with HTML, CSS, vanilla JavaScript, Java 21, Spring Boot 4.1.1, Maven Wrapper and MySQL Community Server.

Repository: https://github.com/Sandeep-More-1610/fuelfit-fullstack

## Engineering highlights

- **Account security:** BCrypt password hashing, cookie sessions, CSRF checks, and ADMIN-only catalog/order operations.
- **Checkout correctness:** server-calculated totals, transaction-scoped stock locking, order snapshots, and idempotency keys for safe retries.
- **Database evolution:** versioned Flyway migrations and separate disposable test databases.
- **Framework-free frontend:** HTML, CSS, and vanilla JavaScript connected to a Java Spring Boot API. The active storefront does not use React.

## Features

- Registration and BCrypt password hashing; cookie sessions, CSRF protection and role-based authorization.
- MySQL product catalog, search, category/price/stock filters, sorting and pagination.
- Guest browser cart and account-owned database carts, with safe retryable guest imports.
- Saved Indian delivery addresses, wishlists and order history.
- Server-priced checkout, cash-on-delivery orders, stock protection and duplicate-request protection.
- Customer cancellation before shipping; admin order confirmation, shipping and delivery updates.
- Admin catalog/category management, archived products, stock updates and conflict detection.
- Newsletter consent and subscription storage, plus account opt-out. Email delivery is not configured.
- Additive Flyway migrations; original 15 products retained. Existing stock is never invented or reset.

## Run on Windows

1. Read [backend/README.md](backend/README.md), select Java 21 and supply database credentials in your local PowerShell session.
2. From the backend directory, build with `.\mvnw.cmd verify` and start the `mysql` profile using the documented script.
3. From the repository root run `npm run dev` (Node.js 22+). No frontend packages are needed to serve the site.
4. Open http://127.0.0.1:8859/ and register an account.
5. Promote your own registered operator account using the offline admin script. Enter real inventory through Manage catalog before testing purchases. Seeded products start with zero stock.

The database-free `dev` profile is retained for health/security checks. Commerce requires `mysql`; it cannot operate in database-free mode. Frontend and backend must use the same hostname (`127.0.0.1` by default), even though their ports differ.

The GitHub repository has been renamed. An existing checkout can keep its current folder name. Its remote should be:

```powershell
git remote set-url origin https://github.com/Sandeep-More-1610/fuelfit-fullstack.git
```

## Documentation

- [Backend startup](backend/README.md)
- [Full-stack API and business rules](backend/FULLSTACK_GUIDE.md)
- [Authentication](backend/AUTH_GUIDE.md) and [catalog](backend/CATALOG_GUIDE.md) implementation notes
- [Historical review](REVIEW_NOTES.md), which predates the subsequent commerce implementation

## Tests

```powershell
# Backend: Java 21 selected, run from backend/
.\mvnw.cmd verify

# Frontend: run from repository root
npm ci
npm run test:browser
```

Browser tests use installed Edge on Windows. For Playwright Chromium, run `npx playwright install chromium` and set `$env:BROWSER_CHANNEL='chromium'`. The normal suites use disposable in-memory H2 or mocked APIs. Real MySQL checkout tests are opt-in and must use an isolated test database; see [backend/FULLSTACK_GUIDE.md](backend/FULLSTACK_GUIDE.md).

### Latest local verification

On 26 October 2026, Java 21/Maven Wrapper verify passed all 48 backend tests. The standard frontend/browser suite passed 39 tests; six opt-in MySQL cases were skipped. This rerun used disposable H2/mocked APIs and did not repeat the real-MySQL commerce checks recorded in FULLSTACK_GUIDE.md.

## Scope and operational limits

This implements the core cash-on-delivery shopping flow. It does not process card/UPI payments, send email, verify email addresses, recover forgotten passwords by email, integrate couriers, process refunds/returns, or supply business policies for placeholder footer links. Shipping is a fixed INR 299 below INR 6,500 and free from INR 6,500; delivery addresses currently support India only. Inventory is shared across a product's selectable options, matching the existing catalog model.

Use HTTPS, restricted database permissions, backups, mail-based account verification/recovery and abuse protection before a public commercial launch. Local test results do not guarantee bug-free or production-ready software. No paid service or payment provider is required for the implemented flow.

## Project layout

- `index.html`, `2nd.css`, `3rd.js`, `catalog.js`: storefront, account screens and admin screens.
- `backend/`: backend sources, migration SQL, tests and PowerShell scripts.
- `tests/`: browser regressions and opt-in MySQL end-to-end tests.
- `scripts/serve.cjs`: local server exposing only public storefront assets.
- `archive/`: earlier designs, retained as historical files.
- `BACKEND_PLAN.md`: original proposal with current progress notes.

Credentials, environment files, dependency folders, logs and generated build outputs are excluded from Git.

## Author

**Sandeep More** | VIT Vellore | Expected graduation August 2028

[GitHub](https://github.com/Sandeep-More-1610) | [LinkedIn](https://www.linkedin.com/in/sandeep-more-a0799232a/)
