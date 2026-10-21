// Browser fixtures only: no requests can mutate the live database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
let browser;
before(async () => { browser = await chromium.launch(require('./browser-options.cjs')); });
after(async () => { await browser?.close(); });
async function open(width) {
  const context = await browser.newContext({viewport:{width,height:1000}});
  await context.route('**/api/**', route => route.fulfill({status:401,json:{message:'Unauthorized'}}));
  await require('./catalog-mock.cjs')(context);
  const page = await context.newPage();
  await page.goto(process.env.FUELFIT_URL || 'http://127.0.0.1:8859/');
  await page.locator('#featuredGrid .product-card').first().waitFor();
  await page.evaluate(() => navigate('shop'));
  await page.waitForFunction(() => document.querySelector('#productCount').textContent === '15 products');
  return {page,context};
}
for (const width of [320,375,390,600,601,768,1000,1024,1440]) {
  test(`catalog controls fit, align and have keyboard focus at ${width}px`, async () => {
    const {page,context} = await open(width);
    try {
      const result = await page.locator('.shop-filters').evaluate(toolbar => {
        const nodes = [...toolbar.querySelectorAll('input,select,button')];
        const boxes = nodes.map(el => ({id:el.id || el.textContent,rect:el.getBoundingClientRect().toJSON()}));
        const parent = toolbar.getBoundingClientRect();
        return {
          fits:boxes.every(({rect:r}) => r.width > 0 && r.x >= parent.x && r.right <= parent.right && r.height >= 44),
          overlap:boxes.some((a,i) => boxes.slice(i+1).some(b => {
            const x=a.rect,y=b.rect;
            return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
          })),
          overflow:document.documentElement.scrollWidth > innerWidth,
          heights:[...toolbar.querySelectorAll('.catalog-controls input,.catalog-controls select,.catalog-controls button')].map(el=>el.getBoundingClientRect().height),
          grid:getComputedStyle(toolbar.querySelector('.catalog-controls')).display
        };
      });
      assert.equal(result.grid,'grid');
      assert.equal(result.fits,true);assert.equal(result.overlap,false);assert.equal(result.overflow,false);
      assert.deepEqual(result.heights,[44,44,44,44,44]);
      await page.getByLabel('Sort by',{exact:true}).focus();
      await page.keyboard.press('Shift+Tab');
      const focus = await page.evaluate(() => ({visible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle}));
      assert.equal(focus.visible,true);assert.equal(focus.outline,'solid');
      await page.locator('#filterChips').getByRole('button',{name:'Supplements',exact:true}).click();
      assert.equal(await page.locator('#filterChips').getByRole('button',{name:'Supplements',exact:true}).getAttribute('aria-pressed'),'true');
      await page.waitForFunction(() => document.querySelector('#productCount').textContent === '5 products');
    } finally { await context.close(); }
  });
}
test('search Enter, prices, availability, sort, pagination and retry keep working',async()=>{
  const {page,context}=await open(768);
  try {
    await page.locator('#catalogNext').click();
    await page.waitForFunction(()=>document.querySelector('#catalogPage').textContent==='Page 2');
    await page.locator('#catalogQuery').fill('protein');await page.locator('#catalogQuery').press('Enter');
    await page.waitForFunction(()=>document.querySelector('#productCount').textContent==='3 products');
    assert.equal(await page.locator('#catalogPage').textContent(),'Page 1');
    await page.locator('#catalogQuery').fill('');
    await page.locator('#minPrice').fill('1000');await page.locator('#maxPrice').fill('3000');
    const response=page.waitForResponse(r=>r.url().includes('/api/products?')&&r.url().includes('minPrice=1000'));
    await page.locator('#applyFilters').click();await response;
    await page.waitForFunction(()=>document.querySelector('#productCount').textContent!=='Loading products…');
    const data=await (await response).json();
    assert.ok(data.items.every(p=>p.price>=1000&&p.price<=3000));
    assert.ok(await page.locator('#shopGrid .product-card').count()>0);
    await page.locator('#minPrice').fill('');await page.locator('#maxPrice').fill('');
    await page.locator('#stockFilter').selectOption('false');await page.locator('#applyFilters').click();
    await page.waitForFunction(()=>document.querySelector('#productCount').textContent==='0 products');
    assert.equal(await page.locator('#emptyMsg').isVisible(),true);
    await page.locator('#stockFilter').selectOption('');
    const sorted=page.waitForResponse(r=>r.url().includes('sort=price-low'));
    await page.getByLabel('Sort by',{exact:true}).selectOption('price-low');
    const items=(await (await sorted).json()).items;
    assert.deepEqual(items.map(p=>p.price),items.map(p=>p.price).sort((a,b)=>a-b));
    await page.route('**/api/products?**',route=>route.fulfill({status:503,json:{message:'Catalog unavailable'}}));
    await page.locator('#applyFilters').click();
    await page.waitForFunction(()=>document.querySelector('#productCount').textContent==='Catalog unavailable');
    await page.unroute('**/api/products?**');await page.locator('#applyFilters').click();
    await page.waitForFunction(()=>document.querySelector('#productCount').textContent==='15 products');
  } finally {await context.close();}
});
