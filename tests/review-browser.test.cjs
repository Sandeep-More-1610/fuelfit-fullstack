// Regression checks against mocked APIs; never writes to an existing database.
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
let browser;
before(async () => { browser = await chromium.launch({channel:'msedge', headless:true}); });
after(async () => { await browser?.close(); });
async function open() {
  const context = await browser.newContext();
  await context.route('**/api/auth/**', route => route.fulfill({status:401,json:{message:'Unauthorized'}}));
  const products = await require('./catalog-mock.cjs')(context);
  const page = await context.newPage();
  await page.goto(process.env.FUELFIT_URL || 'http://127.0.0.1:8859/');
  await page.locator('#featuredGrid .product-card').first().waitFor();
  return {context,page,products};
}
test('catalog refresh invalidates archived cart products already in the cache', async () => {
  const {context,page,products} = await open();
  try {
    await page.evaluate(() => addToCart('a1','M','Black',1));
    products.find(p=>p.id==='a1').active = false;
    await page.evaluate(async () => { await loadCatalog(); renderCart(); });
    assert.match(await page.locator('#cartBody').textContent(), /Product unavailable/);
    assert.equal(await page.locator('#checkoutBtn').isDisabled(), true);
    assert.equal(await page.locator('#cartTotal').textContent(), '₹0');
  } finally { await context.close(); }
});
test('late product detail response cannot override later navigation', async () => {
  const {context,page,products} = await open();
  let release, requested;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { requested = resolve; });
  try {
    await context.route('**/api/products/a1', async route => {
      requested(); await gate; await route.fulfill({json:products.find(p=>p.id==='a1')});
    });
    await page.evaluate(() => { window.pendingDetail = showProduct('a1'); });
    await started;
    await page.evaluate(() => navigate('home'));
    release(); await page.evaluate(() => window.pendingDetail);
    assert.equal(await page.locator('#homePage').isVisible(), true);
    assert.equal(await page.locator('#productPage').isVisible(), false);
  } finally { release(); await context.close(); }
});
test('removed size options make a persisted cart item unavailable', async () => {
  const {context,page,products} = await open();
  try {
    await page.evaluate(() => addToCart('a1','M','Black',1));
    products.find(p=>p.id==='a1').sizes = ['XL'];
    await page.evaluate(async () => { await loadCatalog(); renderCart(); });
    assert.equal(await page.locator('#checkoutBtn').isDisabled(), true);
    assert.match(await page.locator('#cartBody').textContent(), /unavailable/i);
    products.find(p=>p.id==='a1').sizes = [];
    await page.evaluate(async () => { await loadCatalog(); renderCart(); });
    assert.equal(await page.locator('#checkoutBtn').isDisabled(), true);
  } finally { await context.close(); }
});
test('cart refresh failure is visible and retry recovers', async () => {
  const {context,page} = await open();
  try {
    await page.evaluate(() => addToCart('a1','M','Black',1));
    await context.route('**/api/products/a1', route => route.fulfill({status:503,json:{message:'Service unavailable'}}));
    await page.evaluate(async () => { await refreshCartProducts(); renderCart(); });
    assert.match(await page.locator('#cartBody').textContent(), /verify availability/i);
    assert.equal(await page.locator('#checkoutBtn').isDisabled(), true);
    await context.unroute('**/api/products/a1');
    await page.evaluate(async () => { await refreshCartProducts(); renderCart(); });
    assert.doesNotMatch(await page.locator('#cartBody').textContent(), /verify availability/i);
    assert.equal(await page.locator('#checkoutBtn').isDisabled(), false);
  } finally { await context.close(); }
});
test('checkout and newsletter do not claim unimplemented server actions', async () => {
  const {context,page} = await open();
  try {
    await page.evaluate(() => { user={name:'Test Athlete',role:'CUSTOMER'}; addToCart('a1','M','Black',1); });
    await page.waitForFunction(() => !document.querySelector('#checkoutBtn').disabled);
    await page.locator('#checkoutBtn').click();
    assert.match(await page.locator('#toast').textContent(), /not available yet/i);
    await page.locator('#cartClose').click();
    await page.locator('#newsletterForm input').fill('test@example.test');
    await page.locator('#newsletterForm button').click();
    assert.match(await page.locator('#newsletterMsg').textContent(), /not available yet/i);
  } finally { await context.close(); }
});
test('closed overlays are not keyboard-focusable and search restores focus', async () => {
  const {context,page} = await open();
  try {
    assert.equal(await page.locator('#searchOverlay').evaluate(el=>el.inert), true);
    assert.equal(await page.locator('#cartSidebar').evaluate(el=>el.inert), true);
    await page.locator('#searchBtn').click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('#searchInput'));
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#searchClose').evaluate(el=>el===document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#searchBtn').evaluate(el=>el===document.activeElement), true);
    assert.equal(await page.locator('#searchOverlay').evaluate(el=>el.inert), true);
  } finally { await context.close(); }
});
test('cart dialog traps keyboard focus and restores its trigger', async () => {
  const {context,page} = await open();
  try {
    await page.locator('#cartBtn').click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('#cartClose'));
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#cartClose').evaluate(el=>el===document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#cartBtn').evaluate(el=>el===document.activeElement), true);
    assert.equal(await page.locator('#cartSidebar').evaluate(el=>el.inert), true);
  } finally { await context.close(); }
});
test('removing an unverifiable product unblocks remaining verified cart items', async () => {
  const {context,page} = await open();
  try {
    await page.evaluate(async () => {
      await showProduct('s1');
      addToCart('a1','M','Black',1); addToCart('s1','1kg','Chocolate',1);
      await refreshCartProducts();
    });
    await context.route('**/api/products/a1', route => route.fulfill({status:503,json:{message:'Unavailable'}}));
    await page.evaluate(async () => {
      await refreshCartProducts(); removeItem(cart.find(item=>item.pid==='a1').key);
    });
    assert.equal(await page.locator('#checkoutBtn').isDisabled(), false);
    assert.doesNotMatch(await page.locator('#cartBody').textContent(), /verify availability/i);
  } finally { await context.close(); }
});
test('hyphens in distinct size/color combinations do not merge cart lines', async () => {
  const {context,page,products} = await open();
  try {
    Object.assign(products.find(p=>p.id==='a1'), {sizes:['A-B','A'], colors:['C','B-C']});
    const items = await page.evaluate(async () => {
      await loadCatalog();
      addToCart('a1','A-B','C',1); addToCart('a1','A','B-C',1);
      return cart.map(({size,color,qty})=>({size,color,qty}));
    });
    assert.deepEqual(items,[{size:'A-B',color:'C',qty:1},{size:'A',color:'B-C',qty:1}]);
  } finally { await context.close(); }
});
