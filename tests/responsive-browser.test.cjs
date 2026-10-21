// Run against the local frontend with Playwright available on NODE_PATH.
// All auth requests are intercepted; these tests never write to MySQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
let browser;
const base = process.env.FUELFIT_URL || 'http://127.0.0.1:8859/';
before(async () => { browser = await chromium.launch(require('./browser-options.cjs')); });
after(async () => { await browser?.close(); });

async function openPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  await require('./catalog-mock.cjs')(context);
  let signedIn = false;
  const calls = [];
  const account = { id: 999, name: 'Responsive Athlete', role: 'CUSTOMER' };
  await context.route('**/api/auth/**', route => {
    const action = new URL(route.request().url()).pathname.split('/').pop();
    calls.push(action);
    if (action === 'csrf') return route.fulfill({ json: { token: 'test-only', headerName: 'X-CSRF-TOKEN' } });
    if (action === 'login') signedIn = true;
    if (action === 'logout') { signedIn = false; return route.fulfill({ status: 204 }); }
    return route.fulfill({ status: action === 'me' && !signedIn ? 401 : action === 'register' ? 201 : 200,
      json: action === 'me' && !signedIn ? { message: 'Unauthorized' } : account });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#featuredGrid').children.length > 0);
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors, calls };
}

async function fits(page, selector) {
  await page.waitForFunction(selector => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return box.width > 0 && box.x >= -1 && box.right <= innerWidth + 1;
  }, selector, { timeout: 3000 });
  const box = await page.locator(selector).boundingBox();
  assert.ok(box && box.x >= -1 && box.x + box.width <= page.viewportSize().width + 1, selector + ' fits viewport');
}
async function noOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'page has no horizontal overflow');
}

for (const [width, height] of [[320,568],[375,812],[390,844],[768,1024],[900,700],[901,700],[1024,768],[1440,900],[844,390]]) {
  test(`navigation, account dialog and commerce layout at ${width}x${height}`, async () => {
    const { page, context, errors } = await openPage(width, height);
    try {
      await noOverflow(page);
      await fits(page, '#loginBtn');
      if (width <= 900) {
        await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
        assert.equal(await page.locator('#hamburger').getAttribute('aria-expanded'), 'true');
        await fits(page, '#mobileLoginBtn');
        assert.ok(await page.locator('#mobileLoginBtn').isVisible());
        await page.locator('#mobileLoginBtn').click();
      } else {
        assert.equal(await page.locator('#hamburger').isVisible(), false);
        await fits(page, '#mainNav');
        await page.locator('#loginBtn').click();
      }
      assert.ok(await page.getByRole('dialog').isVisible());
      await fits(page, '.modal');
      assert.equal(await page.locator('#modalClose').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('#switchToSignup').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#modalClose').evaluate(el => el === document.activeElement), true);
      await page.locator('#tabSignup').click();
      await page.locator('#signupSubmitBtn').scrollIntoViewIfNeeded();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#loginModal').evaluate(el => el.inert), true);
      assert.equal(await page.evaluate(() => ['hamburger','loginBtn'].includes(document.activeElement.id)), true);
      await page.evaluate(() => navigate('shop'));
      await noOverflow(page);
      await page.locator('#shopGrid .product-card').first().waitFor();
      await fits(page, '#shopGrid');
      await page.locator('#shopGrid .product-card button').first().click();
      await noOverflow(page);
      await fits(page, '#productDetail');
      await page.locator('#addBtn').click();
      await fits(page, '#cartSidebar');
      await page.locator('#cartClose').click();
      await page.locator('#searchBtn').click();
      await page.locator('#searchInput').fill('protein');
      await page.locator('.search-result-item').first().waitFor();
      assert.ok(await page.locator('.search-result-item').count() > 0);
      await fits(page, '#searchInput');
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test('mobile signup, reload session and logout controls use existing auth handlers (mock API)', async () => {
  const { page, context, calls, errors } = await openPage(375, 812);
  try {
    await page.locator('#hamburger').click();
    await page.locator('#mobileLoginBtn').click();
    await page.locator('#tabSignup').click();
    await page.getByLabel('Full Name', { exact: true }).fill('Responsive Athlete');
    await page.locator('#signupEmail').fill('responsive@example.test');
    await page.locator('#signupPassword').fill('BrowserTestOnly!234');
    await page.locator('#signupSubmitBtn').click();
    await page.waitForFunction(() => document.querySelector('#loginBtn').classList.contains('logged-in'));
    assert.ok(calls.includes('register') && calls.includes('login'));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#loginBtn').classList.contains('logged-in'));
    assert.equal(await page.locator('#loginBtn').getAttribute('aria-label'), 'Logout, Responsive Athlete');
    await page.locator('#hamburger').click();
    assert.match(await page.locator('#mobileLoginBtn').innerText(), /Logout/i);
    await page.locator('#mobileLoginBtn').click();
    await page.waitForFunction(() => !document.querySelector('#loginBtn').classList.contains('logged-in'));
    assert.ok(calls.includes('logout'));
    await page.locator('#loginBtn').click();
    await page.locator('#loginEmail').fill('responsive@example.test');
    await page.locator('#loginPassword').fill('BrowserTestOnly!234');
    await page.locator('#loginSubmitBtn').click();
    await page.waitForFunction(() => document.querySelector('#loginBtn').classList.contains('logged-in'));
    await page.locator('#loginBtn').click();
    await page.waitForFunction(() => !document.querySelector('#loginBtn').classList.contains('logged-in'));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('menu keyboard, outside click and breakpoint transitions reset state', async () => {
  const { page, context } = await openPage(768, 600);
  try {
    await page.locator('#hamburger').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.page), 'home');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#hamburger').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#hamburger').evaluate(el => el === document.activeElement), true);
    await page.locator('#hamburger').click();
    await page.locator('#mobileNav [data-page="shop"]').click();
    assert.equal(await page.locator('#mobileNav').evaluate(el => el.inert), true);
    await page.locator('#hamburger').click();
    await page.mouse.click(750, 580);
    assert.equal(await page.locator('#hamburger').getAttribute('aria-expanded'), 'false');
    await page.locator('#hamburger').click();
    await page.locator('#mobileLoginBtn').focus();
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForFunction(() => document.querySelector('#hamburger').getAttribute('aria-expanded') === 'false');
    assert.equal(await page.locator('#loginBtn').evaluate(el => el === document.activeElement), true);
    await page.setViewportSize({ width: 320, height: 568 });
    assert.equal(await page.locator('#mobileNav').isVisible(), false);
  } finally { await context.close(); }
});
