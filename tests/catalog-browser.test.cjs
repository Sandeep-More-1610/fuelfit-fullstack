const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const api = process.env.FUELFIT_E2E_API;
const base = process.env.FUELFIT_URL || 'http://127.0.0.1:8859/';
let browser, admin, customer;
const suffix = randomUUID();
const password = randomBytes(24).toString('base64');
const operatorEmail = `operator-${suffix}@example.test`;
const customerEmail = `customer-${suffix}@example.test`;
async function mutate(client, method, endpoint, data) {
 const csrf = await (await client.get(api+'/api/auth/csrf')).json();
 return client.fetch(api+endpoint, {method,data,headers:{[csrf.headerName]:csrf.token}});
}
before(async()=>{
 if(!api)return;
 assert.equal(process.env.DB_NAME,'fuelfit_phase2_test','E2E writes must use the disposable database');
 assert.equal(process.env.DB_PORT,'33307');
 assert.equal(new URL(api).hostname,'127.0.0.1');
 assert.equal(new URL(api).port,'18080');
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 admin=await request.newContext();customer=await request.newContext();
 for(const [client,email] of [[admin,operatorEmail],[customer,customerEmail]]){
  const response=await mutate(client,'POST','/api/auth/register',{name:'Phase Two Tester',email,password});
  assert.equal(response.status(),201,await response.text());
 }
 const jar=path.resolve(__dirname,'../backend/target/fuelfit-backend-phase2.jar');
 const provision=spawnSync(path.join(process.env.JAVA_HOME,'bin','java.exe'),['-jar',jar,'--spring.profiles.active=mysql,admin-provision'],{
  env:{...process.env,ADMIN_EMAIL:operatorEmail},encoding:'utf8',timeout:60000
 });
 assert.equal(provision.status,0,'Offline provisioning must exit successfully: '+provision.stderr+' '+provision.stdout);
 for(const [client,email,role] of [[admin,operatorEmail,'ADMIN'],[customer,customerEmail,'CUSTOMER']]){
  const response=await mutate(client,'POST','/api/auth/login',{email,password});
  assert.equal(response.status(),200,await response.text());assert.equal((await response.json()).role,role);
 }
 for(const id of ['a1','s1']){
  const p=await (await admin.get(api+'/api/admin/products/'+id)).json();
  const response=await mutate(admin,'PUT','/api/admin/products/'+id+'/inventory',{quantity:20,version:p.inventoryVersion});
  assert.equal(response.status(),200,await response.text());
 }
});
after(async()=>{await browser?.close();await admin?.dispose();await customer?.dispose();});
async function pageFor(width,email) {
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.addInitScript(origin=>{window.FUELFIT_API_ORIGIN=origin;},api);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#featuredGrid .product-card').first().waitFor();
 if(email){
  await page.locator('#loginBtn').click();await page.locator('#loginEmail').fill(email);await page.locator('#loginPassword').fill(password);await page.locator('#loginSubmitBtn').click();
  await page.waitForFunction(()=>document.querySelector('#loginBtn').classList.contains('logged-in'));
 }
 return {page,context,errors};
}
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
for(const width of [375,1440]) {
 test(`real MySQL catalog, search, filters, stock and cart at ${width}px`,{skip:!api},async()=>{
  const {page,context,errors}=await pageFor(width);
  try{
   await page.evaluate(()=>navigate('shop'));await page.locator('#shopGrid .product-card').first().waitFor();
   await page.waitForFunction(()=>document.querySelector('#productCount').textContent==='15 products');
   assert.equal(await page.locator('#shopGrid .product-card').count(),12);await page.locator('#catalogNext').click();
   await page.waitForFunction(()=>document.querySelector('#catalogPage').textContent==='Page 2');assert.equal(await page.locator('#shopGrid .product-card').count(),3);
   await page.locator('#catalogQuery').fill('protein');await page.locator('#applyFilters').click();
   await page.waitForFunction(()=>document.querySelector('#productCount').textContent==='3 products');
   await page.locator('#catalogQuery').fill('');await page.locator('#stockFilter').selectOption('true');await page.locator('#applyFilters').click();
   await page.waitForFunction(()=>document.querySelector('#productCount').textContent==='2 products');
   await noOverflow(page);
   if(process.env.FUELFIT_SCREENSHOT_DIR){fs.mkdirSync(process.env.FUELFIT_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.FUELFIT_SCREENSHOT_DIR,`catalog-${width}.png`),fullPage:true});}
   await page.evaluate(()=>showProduct('a1'));await page.locator('#addBtn').waitFor();assert.equal(await page.locator('#addBtn').isEnabled(),true);
   await page.locator('#addBtn').click();await page.locator('#cartSidebar.open').waitFor();await page.locator('#cartClose').click();
   await page.evaluate(()=>showProduct('a2'));await page.waitForFunction(()=>document.querySelector('.pd-name')?.textContent==='Flex Training Shorts');
   assert.equal(await page.locator('#addBtn').isDisabled(),true);
   await noOverflow(page);assert.deepEqual(errors,[]);
  } finally {await context.close();}
 });
 test(`real ADMIN product CRUD and inventory form at ${width}px`,{skip:!api},async()=>{
  const {page,context,errors}=await pageFor(width,operatorEmail);
  try{
   await page.locator('#adminBtn').click();await page.locator('.admin-product').first().waitFor();await noOverflow(page);
   await page.locator('#adminNew').click();const form=page.locator('#adminForm');
   const name=`<img src=x onerror=alert(1)> Test ${width} ${suffix.slice(0,8)}`;
   await form.locator('[name=name]').fill(name);await form.locator('[name=category]').selectOption('apparel');
   await form.locator('[name=description]').fill('Description from the real admin form.');await form.locator('[name=price]').fill('456.78');
   await form.locator('[name=image]').fill('https://images.pexels.com/photos/3764011/pexels-photo-3764011.jpeg');
   await form.locator('[name=sizes]').fill('M\nL');await form.locator('[name=colors]').fill('Black\nWhite');
   await noOverflow(page);await form.getByRole('button',{name:'Save product',exact:true}).click();
   await form.waitFor({state:'hidden'});let row=page.locator('.admin-product').filter({has:page.getByRole('heading',{name,exact:true})});await row.waitFor();
   assert.equal(await row.locator('h2 img').count(),0,'Product names are plain text');
   await row.locator('input').fill('8');await row.getByRole('button',{name:'Save stock',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#adminStatus').textContent==='');
   await row.getByRole('button',{name:'Edit',exact:true}).click();await form.locator('[name=price]').fill('500');
   await form.getByRole('button',{name:'Save product',exact:true}).click();await form.waitFor({state:'hidden'});
   const listed=await (await admin.get(api+'/api/admin/products?size=100')).json();const created=listed.items.find(p=>p.name===name);
   assert.equal(created.price,500);assert.equal(created.stock,8);assert.deepEqual(created.sizes,['M','L']);
   page.once('dialog',dialog=>dialog.accept());await row.getByRole('button',{name:'Archive',exact:true}).click();
   await page.waitForFunction(name=>[...document.querySelectorAll('.admin-product')].some(x=>x.querySelector('h2').textContent===name&&x.textContent.includes('Archived')),name);
   assert.equal((await admin.get(api+'/api/products/'+created.id)).status(),404);
   assert.equal((await (await admin.get(api+'/api/admin/products/'+created.id)).json()).stock,8);
   await noOverflow(page);assert.deepEqual(errors,[]);
   if(process.env.FUELFIT_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FUELFIT_SCREENSHOT_DIR,`admin-${width}.png`),fullPage:true});
  } finally {await context.close();}
 });
}
test('real CUSTOMER session is denied all admin operations, including valid CSRF',{skip:!api},async()=>{
 const product={name:'Forbidden',category:'apparel',description:'Forbidden',price:1,image:'https://example.test/x.png',sizes:[],colors:[],featured:false,active:true,version:0};
 for(const [method,url,data] of [['GET','/api/admin/products'],['GET','/api/admin/products/a1'],['POST','/api/admin/products',product],['PUT','/api/admin/products/a1',product],['PUT','/api/admin/products/a1/inventory',{quantity:99,version:0}],['DELETE','/api/admin/products/a1?version=0']]) {
  const response=method==='GET'?await customer.get(api+url):await mutate(customer,method,url,data);
  assert.equal(response.status(),403,method+' '+url);
 }
 const {page,context}=await pageFor(375,customerEmail);
 try{assert.equal(await page.locator('#adminBtn').isVisible(),false);await page.reload();await page.waitForFunction(()=>document.querySelector('#loginBtn').classList.contains('logged-in'));assert.equal(await page.locator('#adminBtn').isVisible(),false);}
 finally{await context.close();}
});
test('catalog outage and retry do not display a hardcoded fallback',{skip:!api},async()=>{
 const context=await browser.newContext({viewport:{width:320,height:568}});
 await context.addInitScript(origin=>{window.FUELFIT_API_ORIGIN=origin;},api);
 await context.route('**/api/products**',route=>route.fulfill({status:503,json:{message:'Catalog unavailable'}}));
 const page=await context.newPage();
 try{
  await page.goto(base);await page.getByRole('button',{name:'Retry catalog',exact:true}).waitFor();assert.equal(await page.locator('#featuredGrid .product-card').count(),0);
  await context.unroute('**/api/products**');await page.getByRole('button',{name:'Retry catalog',exact:true}).click();await page.locator('#featuredGrid .product-card').first().waitFor();await noOverflow(page);
 }finally{await context.close();}
});
