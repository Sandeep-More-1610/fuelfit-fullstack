# FuelFit backend analysis and development roadmap

Prepared: 21 October 2026. Status: analysis and proposal only.

## 1. Scope and project inventory

The project examined is `outputs/fuelfit-frontend`, the local copy uploaded to `Sandeep-More-1610/fuelfit-frontend`. The active frontend originated in `Downloads/WEB PROJECT`. The two HTML files under `archive/` are earlier designs, not additional pages of the active application.

All seven tracked project files were included in the source review:

- `index.html`: the active document, page sections, forms, navigation, overlays, and footer.
- `2nd.css`: all active styling, layouts, animations, and responsive breakpoints.
- `3rd.js`: the active catalog, browser storage, rendering, navigation, and interaction handlers.
- `README.md`: existing project description and run instructions.
- `.gitignore`: excludes environment files, dependency folders, and OS metadata.
- `archive/FuelFit.html`: earlier standalone dark/lime storefront, with 12 hardcoded products in Supplements, Accessories, and Equipment; cart key `ff_cart`; simulated order placement.
- `archive/fuelfit_1.html`: earlier standalone Premium Performance Gear design, with inline CSS/JavaScript, 15 products, dollar prices, and cart key `fuelfit-cart`; no working checkout integration or account backend.

The Git metadata was checked for project inventory and working-tree state. No frontend source, original Downloads files, or design was changed. This document is the only new project file. No backend, database, dependency installation, or API implementation was created. Findings are based on source inspection, not a complete interactive browser test.

## 2. Technologies currently used

- HTML5 defines the content and forms.
- Plain CSS defines the design, CSS variables, Flexbox/Grid layouts, transitions, and responsive rules at 1100, 1024, 900, 640, and 400 pixels.
- Vanilla JavaScript means ordinary browser JavaScript without React, Angular, Vue, or another framework. It uses DOM manipulation, template strings, array filtering/sorting, and event handlers.
- Browser `localStorage` saves small amounts of data on that browser and website origin. An origin includes the protocol, host, and port; changing the local server port can make the saved data appear missing.
- Google Fonts supplies Bebas Neue and Barlow. Pexels supplies remotely hosted images. Inline SVG and a CSS SVG data URL supply some icons.
- Git tracks source changes. There is no `package.json`, frontend build pipeline, Java project, SQL schema, database connection, or application API client in this repository.

Opening `index.html` does not require a build. A local HTTP server is preferable for future API integration. Any preview server used outside the repository is only serving files; it is not an e-commerce backend.

## 3. Existing pages and components

There is one active HTML document, containing three page containers. Navigation hides and shows sections; it does not create distinct URLs or browser-history routes.

### Home: `homePage`

- Hero banner, calls to action, promotional statistics, and four benefit cards.
- Featured product grid: the first six products marked featured.
- Category cards for Apparel, Supplements, and Accessories.
- Newsletter form and temporary confirmation message.

### Shop and category views: `shopPage`

- All Products, Apparel, Supplements, and Accessories share this container.
- Category filter chips, category descriptions, product count, and empty-result message.
- Sorting by featured status, ascending price, descending price, and name.
- Product cards contain an image, category, name, description, price, featured badge, and View action.

### Product detail: `productPage`

- Image, category, name, description, price, and optional featured badge.
- Size and color selections, quantity control, and Add to Cart.
- First size/color selected by default; quantity cannot be reduced below one through the controls.
- Back button returns to the remembered shop category.
- Shipping, returns, security, and quality statements are static text, not evidence of corresponding implemented services.

### Shared components

- Desktop header, mobile navigation/hamburger, logo navigation, search button, login button, and cart badge.
- Search overlay: case-insensitive substring search across name, description, and category; at most five results; selecting one opens product details.
- Login/sign-up modal with name, email, password, basic validation, field errors, and tab switching. Clicking the logged-in header button logs out.
- Cart sidebar: selected options, item quantities, removal, subtotal, shipping, total, empty state, and checkout button.
- Toast messages, overlay backdrops, Escape-to-close behavior, header scroll effect, and responsive layouts.
- Footer shop buttons work through the shared navigation handler. Support, Company, legal buttons, and social links are placeholders without implemented destination pages.

### Features that do not yet exist

There is no real checkout page, delivery-address form, order creation/history/detail view, payment processing, stock tracking, admin interface, product management, password reset, email verification, saved addresses, reviews, wishlist, coupon engine, shipment tracking, or returns workflow. Marketing statistics are fixed text; there are 15 active products, despite the displayed “200+ Products” claim.

## 4. Where data lives today

### Products and categories

`3rd.js:4–26` contains `PRODUCTS` and `CAT_INFO`. There are 15 products: five apparel, five supplements, and five accessories. Each product has `id`, `name`, `category`, `featured`, `price`, `description`, `image`, `sizes`, and `colors`. IDs include `a1`, `s1`, and `ac1`.

Prices are whole Indian rupees, formatted by `inr()` at line 28. Supplement “colors” actually represent flavors, and “sizes” can mean package weight or serving count. There is no variant SKU or stock quantity. Future product variants must represent valid size/option combinations without assuming every combination is actually sold.

### Cart

`3rd.js:45–70` reads and writes `localStorage['ff-cart']`. Each item contains `{key, pid, size, color, qty}`. The key combines product ID, size, and color. Prices are looked up from `PRODUCTS`, rather than saved with cart items.

`renderCart()` at lines 78–117 calculates totals in the browser. Shipping is free when subtotal is **at least ₹6,500**; otherwise it is **₹299**. This exact boundary differs slightly from the marketing wording “over ₹6,500”. The code's calculation is the proposed starting rule, subject to confirmation later.

The cart is shared by users of the same browser/origin. It is not tied to an account, synchronized across devices, or cleared on logout. The controls enforce a minimum of one, but no stock limit or maximum quantity exists.

### Accounts and login

- `localStorage['ff-accounts']`: an array of `{name, email, pass}`. `handleSignup()` at lines 283–298 stores the password directly as readable text.
- `localStorage['ff-user']`: `{name, email}` for the apparent current user. Loaded at lines 33–34 and written during login/signup.
- `handleLogin()` at lines 268–281 compares email/password against that local array.
- `handleLogout()` at line 300 removes only `ff-user`.

These are demo accounts, not secure authentication. Browser storage can be read or edited by the visitor. There is no server session, protected account identity, or authorization. Future migration must not treat `ff-user` as proof of identity or import plaintext browser passwords as trusted accounts. Use fresh registration; decide separately whether demo account data should be removed later.

### Other state

- Current page, category, sorting, selected options, quantity, and toast timers live in JavaScript memory; most reset after refresh.
- `checkoutBtn` at lines 361–365 either opens login or displays “Redirecting to checkout...”. It does not redirect, create an order, or collect payment.
- Newsletter handler at line 373 only displays a message and resets the form. Email addresses are not saved or sent.
- Images/fonts are external URLs; promotional text and footer content are hardcoded in HTML/JavaScript.
- No `fetch`, Axios, XMLHttpRequest, IndexedDB, or application cookie-based persistence was found in the frontend source. Browsers still make normal requests to load files, fonts, and images.
- Archive storage formats and currencies differ. Do not combine their catalogs or carts with the active application automatically.

## 5. Recommended architecture

Use **one Spring Boot application connected to one MySQL database**. This is a modular monolith: one runnable backend, organized into understandable feature areas. Microservices, Redis, Kafka, and Kubernetes are unnecessary for this learning project.

Conceptual request flow:

`Existing browser UI → HTTP/JSON API → Controller → Service → Repository → MySQL`

- **API**: an agreed address the frontend calls to request or save data.
- **JSON**: the text format used to exchange product, cart, and order information.
- **Controller**: receives a request and validates its shape.
- **Service**: applies rules such as shipping costs, ownership, stock checks, and order creation.
- **Repository**: reads/writes database records using Spring Data JPA.
- **Entity**: a Java representation of a database record.
- **DTO**: an input/output object containing only fields an API should accept or reveal. It prevents accidentally returning password hashes or internal database relationships.

Recommended free/open-source stack:

- OpenJDK 21, for example Eclipse Temurin, as the Java development kit.
- A supported stable Spring Boot release compatible with Java 21, selected and pinned when implementation begins. Do not choose a milestone or snapshot. Use its dependency management rather than choosing unrelated Spring library versions.
- Spring Web MVC for REST endpoints; Spring Data JPA/Hibernate for persistence; Jakarta Bean Validation for input checks.
- Spring Security for login, session management, roles, and password encoding.
- MySQL Community Server 8.4 with InnoDB and the MySQL Connector/J driver.
- Maven and Maven Wrapper for building and running the project.
- Flyway Community's open-source core/MySQL support for versioned SQL migrations, without paid features. A migration is a saved, repeatable database change.
- JUnit, Spring Boot Test, and Spring Security Test for automated verification. Use a separate local MySQL test database initially; container-based tests can be considered later.
- curl or an open-source API client such as Bruno for manual API learning.

Use local development first; no subscription or paid hosting is required. Google Fonts/Pexels are existing external content dependencies, not proposed backend tools. Their content licenses are separate from software licenses.

### Suggested organization, to create only in a later step

Keep a separate `backend/` directory beside the existing frontend files. Inside it, group Java code under `com.fuelfit` into `catalog`, `auth`, `cart`, `order`, `newsletter`, `admin`, `config`, and `common`. Each feature owns its controllers, services, repositories, entities, and DTOs as needed. Store database migrations under `src/main/resources/db/migration`.

For a future deployment, serve UI and API under one origin, through Spring static resources or a reverse proxy. This keeps cookie authentication easier. During development, either use the same origin or explicitly allow the actual frontend origin/port with credentialed CORS. Never allow every origin with credentials. No frontend framework rewrite or CSS redesign is needed.

### Authentication choice

Start with server-side sessions and an HttpOnly session cookie rather than tokens in localStorage. Spring Security verifies passwords using a one-way password hash, such as BCrypt through its PasswordEncoder. Hashing means the database does not retain a readable password.

Keep CSRF protection enabled: obtain a CSRF token and send it with state-changing requests, including login/logout. Refresh it after authentication changes. Use SameSite cookie controls and Secure cookies over HTTPS in deployment. The session cookie is HttpOnly; the CSRF token has a separate exposure mechanism for JavaScript. Do not return password hashes or accept user IDs/roles from the browser as authority.

Use CUSTOMER and ADMIN roles. Public catalog reads require no login. Cart/account/order ownership comes from the authenticated session. Admin endpoints require ADMIN on the server, regardless of what buttons are visible.

## 6. Proposed database model

This is a design proposal, not a created schema.

- `users`: ID, name, normalized unique email, password hash, role, timestamps, and account status.
- `categories`: ID, unique slug, name, description. Start with the three active categories.
- `products`: ID, unique legacy code (`a1`, etc.), category reference, name, description, featured flag, image URL, active flag, base price, and option labels.
- `product_variants`: ID, product reference, unique SKU, size/package, color/flavor option, stock quantity, and optional price override. Enforce uniqueness of a product's option combination. Label semantics can distinguish Color from Flavor later without changing the current design now.
- `carts`: ID, unique user reference, timestamps, and version number.
- `cart_items`: ID, cart reference, variant reference, quantity; unique cart/variant pair.
- `orders`: ID, user reference, unique order number, status, payment method/status, currency, subtotal, shipping, total, delivery-address snapshot, idempotency key, and creation time.
- `order_items`: ID, order reference, optional variant reference, and purchased product name, selected options, unit price, quantity, and line-total snapshots. Snapshots preserve the receipt when the catalog changes.
- `newsletter_subscriptions`: ID, normalized unique email, subscription status, consent timestamp, and unsubscribe-token hash if email delivery is later added.

Use foreign keys for relationships, indexes on common lookups, and database constraints for uniqueness. Store money as MySQL DECIMAL with Java BigDecimal, always paired with INR; avoid floating-point arithmetic. Do not invent stock counts from the frontend, which has none. Confirm valid variants and initial inventory before accepting orders.

Guest carts can remain temporary browser data in the first version. On successful login, explicitly merge validated guest items into the user's server cart, respecting stock limits. Make retries safe, then remove only the successfully migrated guest items. Logout must not expose the previous user's server cart to another customer.

## 7. APIs required

All routes below are **proposed**, using the prefix `/api/v1`. GET reads data, POST creates or performs an action, PATCH changes selected fields, PUT replaces a resource, and DELETE removes a resource.

### Catalog: required for existing product views

- `GET /categories`: return the three category descriptions.
- `GET /products?category=apparel&search=tee&sort=price-low&page=0&size=12`: list/filter/search/sort products with a total count and pagination metadata. Query fields are optional. Allowlist sort values and cap page size.
- `GET /products?featured=true&size=6`: support the homepage grid. Featured ranking and featured-only filtering must be distinct behaviors.
- `GET /products/{id}`: return details, selectable variants, prices, image, and availability. Return 404 for missing/inactive products.
- Existing search can call the product list with `search` and `size=5`; a separate search service is unnecessary.

### Authentication: required to replace demo login

- `GET /auth/csrf`: obtain the token needed for protected writes.
- `POST /auth/register`: accept name/email/password; create CUSTOMER only, hash the password, and establish a session if matching current auto-login behavior.
- `POST /auth/login`: authenticate email/password and establish a session.
- `POST /auth/logout`: invalidate the session and expire its cookie.
- `GET /auth/me`: return current ID/name/email/role or 401 when signed out.

### Cart: required to save each user's cart

- `GET /cart`: current user's items, quantities, availability, subtotal, shipping, currency, and total.
- `POST /cart/items`: add a valid variant and quantity, combining an existing line when appropriate.
- `PATCH /cart/items/{itemId}`: set an absolute positive quantity. It is easier to retry safely than “increment by one”.
- `DELETE /cart/items/{itemId}`: remove an owned item.
- `POST /cart/merge`: merge guest items once per merge identifier after login; reject invalid options/quantities and return the canonical cart.

The backend recalculates all amounts; it does not trust browser-supplied prices, totals, user IDs, or shipping charges. Cart responses should include the pricing rule so the UI uses the same result everywhere.

### Checkout and orders: new functionality

- `POST /checkout/quote`: validate cart, delivery details, stock, and current prices; return an authoritative summary without creating an order.
- `POST /orders`: place an order from the authenticated user's cart and validated address. Require a request idempotency key so double clicks/retries cannot create duplicates.
- `GET /orders`: current user's order history, paginated.
- `GET /orders/{id}`: details for an order owned by the current user.

Create the order, capture line/address snapshots, decrement stock, and consume the checked cart in one database transaction. Use row locking or conditional stock updates so two customers cannot buy the same final unit. Protect the cart from concurrent changes during placement. Roll back all changes on failure; a quote alone does not reserve stock.

For the first end-to-end learning milestone, use cash on delivery or a clearly labeled simulated payment method. This gives a functional order flow using only open-source software. Do not describe it as real online payment processing. Real card/UPI acceptance requires an external regulated provider and potentially fees; that is outside the present free/open-source-only scope. No payment gateway integration is planned now.

### Newsletter: existing form, currently a placeholder

- `POST /newsletter/subscriptions`: validate email/consent, save it, and return a generic success response for both new and existing subscribers.
- Later, `POST /newsletter/unsubscribe` with a validated token if actual email delivery is introduced. Storing subscriptions alone does not send newsletters.

### Administration: needed later to operate the store

- `POST /admin/products`: create a product.
- `PATCH /admin/products/{id}`: update details or deactivate it; preserve order history.
- `PUT /admin/products/{id}/variants/{variantId}`: update valid options/price/stock with concurrency checks.
- `POST /admin/categories` and `PATCH /admin/categories/{id}`: maintain categories.
- `GET /admin/orders` and `PATCH /admin/orders/{id}/status`: list orders and apply permitted status transitions.

Provision the initial admin through a controlled local setup step, never through a public role field. An admin UI does not currently exist; decide its scope after core APIs work. Password reset, verification, address books, cancellations/refunds, reviews, coupons, wishlists, and tracking are later extensions rather than requirements inferred from working frontend features.

### Common API behavior

Use a consistent error response with a safe message, error code, and field errors. Suggested status codes: 200 for reads/updates, 201 for creation, 204 for successful deletion, 400 for malformed/invalid input, 401 for missing authentication, 403 for forbidden actions/CSRF failure, 404 for missing resources, and 409 for duplicate email, stock conflict, or concurrent updates. Avoid exposing another user's resource existence through ownership errors.

Validate all inputs on the server even if the browser validates them. Protect login and public write endpoints against repeated abuse. Keep database credentials in environment variables and use a dedicated application database user. Never commit secrets or log passwords/session tokens. Use textContent or safe DOM construction when future API/user data is displayed: current search at `3rd.js:319` inserts the raw query into innerHTML and should be corrected during an authorized integration step.

## 8. Development roadmap: one learning milestone at a time

### Step 1 — Prepare the tools and agree the API contract

Learn what a Java class, HTTP request, JSON response, and database table are. Check Java/Maven/MySQL availability, choose compatible stable versions, create a separate backend project, and establish local database credentials. Agree product response fields, variant IDs, INR pricing, shipping boundary, and error format.

Done when: the backend starts independently and can connect to a dedicated development database. This step starts only after the next instruction.

### Step 2 — Read-only catalog

Create versioned migrations for categories/products/variants and an explicit seed from the **active** 15-product catalog. Preserve legacy IDs for mapping; do not seed archive catalogs, old dollar prices, or guessed inventory. Build category, product-list, and product-detail endpoints.

Done when: API calls return all 15 products, correct category counts, search/sort results, six featured homepage results, and a clean 404 for an unknown product. The existing frontend can remain unchanged while these APIs are learned and checked.

### Step 3 — Real registration and login

Add users, unique normalized email, password hashing, session cookies, CSRF protection, and CUSTOMER/ADMIN permissions. Keep account DTOs separate from database entities.

Done when: registration/login/logout work, incorrect credentials fail safely, stored passwords are unreadable hashes, and a forged browser identity grants no access. Verify unauthorized requests and CSRF rejection.

### Step 4 — Database-backed cart

Add owned carts/items, variant validation, stock-aware quantity rules, safe guest-cart merge, and server-calculated INR totals.

Done when: a customer's cart survives a new browser login, two users cannot access each other's carts, duplicate merge retries do not duplicate items, and shipping is ₹299 below ₹6,500 and free at/above it. Invalid quantities/options must be rejected.

### Step 5 — Checkout and orders

Add address validation, order snapshots, stock handling, idempotency, and a single transaction for order placement. Begin with COD/simulated payment; add order history/detail APIs.

Done when: one checkout creates one durable order, retrying returns the same result, insufficient stock leaves no partial order, simultaneous last-unit purchases cannot both succeed, and customers see only their own orders.

### Step 6 — Connect the existing frontend, after authorization

Replace hardcoded/localStorage data access with small fetch-based API functions while retaining the present HTML/CSS layout. Wire catalog/search first, then authentication/cart. Add loading/error feedback within the existing components. Use server-returned totals and safe rendering. Retire the demo account storage rather than using it to authenticate.

Done when: existing browsing, filters, sorting, options, login, and cart work with MySQL-backed data and the visual design remains intact. Full checkout will require new address/order-confirmation controls because none exist today; agree how to add these in the same design before implementation.

### Step 7 — Store operations and newsletter

Add protected catalog/stock administration, order status management, and subscription persistence. Define allowed order state transitions and stock restoration rules before cancellations are enabled.

Done when: an admin can maintain the store, customer accounts cannot call admin endpoints, and newsletter submissions create at most one subscription per normalized email.

### Step 8 — Verify and prepare deployment

Run API, security, database transaction, and browser-flow checks. Document startup commands, environment variables, migrations, database backup/restore, and a repeatable local demo. Set production HTTPS/cookie settings before any real deployment. Keep test data separate from real customer data. Hosting decisions come later; open-source software does not imply every hosting service is free.

Done when: a fresh local setup can register, browse, add a valid variant, place a COD/demo order, and retrieve its history using documented steps, with no frontend design regression.

## 9. Decisions to confirm when implementation begins

- Keep INR, free shipping at subtotal ≥ ₹6,500, and ₹299 otherwise?
- Which option combinations are actually sold, and what is their initial stock?
- Use COD or explicitly simulated payment for the first complete order flow?
- How should address entry/order confirmation fit the existing design?
- What should happen to guest items during login, and to demo account data?

These are implementation decisions, not blockers for this completed analysis. No backend action should start until the user requests the next step.

## 10. Reference documentation

Local findings are supported by the source locations above. Technology guidance was checked against these primary references; exact dependency versions should be rechecked at implementation time.

- [Spring Boot system requirements](https://docs.spring.io/spring-boot/system-requirements.html): Java compatibility.
- [Spring Security password storage](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html): one-way password encoding.
- [Spring Security CSRF protection](https://docs.spring.io/spring-security/reference/7.0/servlet/exploits/csrf.html): protection for state-changing browser requests.
- [MySQL Community Edition](https://www.mysql.com/products/community/): GPL-licensed community database.
- [MySQL InnoDB introduction](https://dev.mysql.com/doc/refman/8.4/en/innodb-introduction.html): transactional storage engine.

## Completion status

Analysis and roadmap only. Existing frontend files and design are unchanged. No backend code, database, schema, or deployment was created. Wait for the user's next instruction before beginning Step 1.
