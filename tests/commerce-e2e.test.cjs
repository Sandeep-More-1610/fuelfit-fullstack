// Opt-in: writes ONLY to a disposable test database behind the explicitly supplied test API.
// Never point this at the store's real database. Setup instructions: backend/FULLSTACK_GUIDE.md.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,request}=require('playwright');
const api=process.env.FUELFIT_TEST_API;
const enabled=process.env.FUELFIT_TEST_DISPOSABLE==='yes'&&!!api;
let browser,admin,customer,other;
const password='SyntheticTestOnly!492';
const address={name:'Test Athlete',phone:'9876543210',line1:'1 Test Road',line2:'',city:'Pune',state:'Maharashtra',postalCode:'411001',country:'IN'};
async function call(client,path,method='GET',data){
  const headers={};
  if(method!=='GET'){const r=await client.get(api+'/auth/csrf');assert.equal(r.status(),200);const token=await r.json();headers[token.headerName]=token.token;}
  const response=await client.fetch(api+path,{method,data,headers});
  return {status:response.status(),body:response.status()===204?null:await response.json()};
}
async function account(role){const client=await request.newContext();const email=`${role}-${crypto.randomUUID()}@example.test`;
  assert.equal((await call(client,'/auth/register','POST',{name:'Test Athlete',email,password})).status,201);
  assert.equal((await call(client,'/auth/login','POST',{email,password})).status,200);return {client,email};}
async function setStock(productId,quantity){const {body:p}=await call(admin.client,'/admin/products/'+productId);assert.equal((await call(admin.client,'/admin/products/'+productId+'/inventory','PUT',{quantity,version:p.inventoryVersion})).status,200);}
before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.DB_NAME,'fuelfit_commerce_test','Refuse writes without the disposable database name');
  assert.equal(process.env.DB_PORT,'33317','Refuse writes without the isolated MySQL port');
  assert.equal(new URL(api).hostname,'127.0.0.1');
  assert.ok(['18081','18083'].includes(new URL(api).port),'Use only the dedicated verification API ports');
  browser=await chromium.launch(require('./browser-options.cjs'));
  admin={client:await request.newContext(),email:process.env.FUELFIT_TEST_ADMIN_EMAIL};
  assert.ok(admin.email,'Set FUELFIT_TEST_ADMIN_EMAIL for an account promoted in the disposable database');
  assert.equal((await call(admin.client,'/auth/login','POST',{email:admin.email,password})).status,200);
  customer=await account('customer');other=await account('other');
  await setStock('a1',10);
});
after(async()=>{await browser?.close();await admin?.client.dispose();await customer?.client.dispose();await other?.client.dispose();});
test('real MySQL APIs persist carts, quote, place once, enforce ownership and cancel once',{skip:!enabled},async()=>{
  const c=customer.client;let {body:cart}=await call(c,'/cart');
  assert.equal((await call(c,'/cart','PUT',{version:cart.version,items:[{productId:'a1',size:'M',color:'Black',quantity:2}]})).status,200);
  cart=(await call(c,'/cart')).body;
  const {body:quote,status}=await call(c,'/checkout/quote','POST',{cartVersion:cart.version,address});assert.equal(status,200);
  const input={cartVersion:cart.version,address,quoteToken:quote.quoteToken,idempotencyKey:crypto.randomUUID()};
  const placed=await call(c,'/orders','POST',input);assert.equal(placed.status,201);assert.equal(placed.body.total,6297);
  assert.equal((await call(c,'/orders','POST',input)).body.id,placed.body.id);
  assert.equal((await call(other.client,'/orders/'+placed.body.id)).status,404);
  assert.equal((await call(c,'/admin/orders')).status,403);
  const id=placed.body.id;
  assert.equal((await call(c,'/orders/'+id+'/cancel','POST',{})).status,200);
  assert.equal((await call(c,'/orders/'+id+'/cancel','POST',{})).status,200);
  assert.equal((await call(admin.client,'/admin/products/a1')).body.stock,10);
  assert.equal((await call(c,'/cart')).body.items.length,0);
});
test('real MySQL saved addresses, wishlist, newsletter and HTTP validation',{skip:!enabled},async()=>{
  const c=customer.client;
  const saved=await call(c,'/addresses','POST',address);assert.equal(saved.status,201);
  assert.equal((await call(other.client,'/addresses/'+saved.body.id,'DELETE')).status,404);
  assert.equal((await call(c,'/wishlist/a1','PUT')).status,204);
  assert.equal((await call(c,'/wishlist/a1','PUT')).status,204);
  assert.equal((await call(c,'/wishlist')).body.length,1);
  assert.equal((await call(c,'/newsletter/subscriptions','POST',{email:customer.email,consent:true})).status,200);
  assert.equal((await call(c,'/newsletter/subscriptions','POST',{email:customer.email,consent:true})).status,200);
  assert.equal((await call(c,'/addresses','POST',{...address,postalCode:'000000'})).status,400);
  assert.equal((await call(c,'/health')).status,200);
});
test('browser registration, typing, account cart, address, COD checkout and logout privacy',{skip:!enabled},async()=>{
  await setStock('a1',10);
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(origin=>{window.FUELFIT_API_ORIGIN=origin;},api.replace(/\/api$/,''));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(process.env.FUELFIT_URL||'http://127.0.0.1:8859/');
    await page.evaluate(()=>showProduct('a1'));await page.locator('#addBtn').waitFor();
    await page.locator('#addBtn').click();await page.locator('#cartClose').click();
    await page.evaluate(()=>openModal('signup'));
    const email=`browser-${crypto.randomUUID()}@example.test`;
    await page.locator('#signupName').fill('Test Athlete');await page.locator('#signupEmail').fill(email);
    await page.locator('#signupPassword').pressSequentially(password);assert.equal(await page.locator('#signupPassword').inputValue(),password);
    await page.locator('#signupSubmitBtn').click();await page.waitForFunction(()=>!!user&&!!serverCart);
    await page.locator('#cartBtn').click();await page.locator('#checkoutBtn').click();
    await page.locator('#checkoutDialog').waitFor({state:'visible'});
    for(const [k,v] of Object.entries(address))if(k!=='country')await page.locator(`#checkoutForm [name=${k}]`).fill(v);
    await page.locator('#saveAddress').click();await page.waitForFunction(()=>document.getElementById('toast').textContent==='Address saved');
    await page.locator('#quoteOrder').click();await page.locator('#placeOrder').waitFor();await page.waitForFunction(()=>!document.getElementById('placeOrder').disabled);
    assert.match(await page.locator('#quoteSummary').textContent(),/cash on delivery/);
    await page.locator('#placeOrder').click();await page.locator('#accountContent .account-card').first().waitFor();
    assert.match(await page.locator('#accountContent').textContent(),/PLACED/);
    await page.reload();await page.waitForFunction(()=>!!user&&!!serverCart);await page.locator('#accountBtn').click();
    await page.locator('#accountContent .account-card').first().waitFor();
    await page.evaluate(()=>handleLogout());await page.waitForFunction(()=>!user);
    assert.equal(await page.locator('#accountPage').isVisible(),false);
    assert.equal(await page.locator('#accountContent').textContent(),'');assert.equal(await page.evaluate(()=>cart.length),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});
test('real MySQL simultaneous buyers cannot oversell',{skip:!enabled},async()=>{
  await setStock('a1',1);
  const a=await account('race-a'),b=await account('race-b');
  try{
    const input=[];
    for(const x of [a,b]){const cart=(await call(x.client,'/cart')).body;
      const updated=await call(x.client,'/cart','PUT',{version:cart.version,items:[{productId:'a1',size:'M',color:'Black',quantity:1}]});assert.equal(updated.status,200);
      const q=(await call(x.client,'/checkout/quote','POST',{cartVersion:updated.body.version,address})).body;
      input.push({cartVersion:q.version,address,quoteToken:q.quoteToken,idempotencyKey:crypto.randomUUID()});}
    const results=await Promise.all([call(a.client,'/orders','POST',input[0]),call(b.client,'/orders','POST',input[1])]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    assert.equal((await call(admin.client,'/admin/products/a1')).body.stock,0);
  }finally{await a.client.dispose();await b.client.dispose();}
});
test('admin browser manages order transitions and category writes',{skip:!enabled},async()=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(origin=>{window.FUELFIT_API_ORIGIN=origin;},api.replace(/\/api$/,''));
  const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());
  try{
    await page.goto(process.env.FUELFIT_URL||'http://127.0.0.1:8859/');
    await page.locator('#loginBtn').click();await page.locator('#loginEmail').fill(admin.email);await page.locator('#loginPassword').fill(password);await page.locator('#loginSubmitBtn').click();
    await page.locator('#adminBtn').waitFor({state:'visible'});await page.locator('#adminBtn').click();
    await page.locator('#adminOrdersLoad').click();
    const confirm=page.locator('#adminOrderContent [data-status=CONFIRMED]').first();await confirm.waitFor();await confirm.click();
    await page.locator('#adminOrderContent [data-status=SHIPPED]').first().waitFor();
    const id='test-'+crypto.randomUUID().slice(0,12);
    await page.locator('#categoryForm [name=id]').fill(id);await page.locator('#categoryForm [name=name]').fill('Test category');await page.locator('#categoryForm [name=description]').fill('Disposable category');
    await page.locator('#categoryForm button').click();await page.waitForFunction(()=>document.getElementById('toast').textContent==='Category saved');
    assert.ok((await call(admin.client,'/categories')).body.some(c=>c.id===id));
  }finally{await context.close();}
});
test('real MySQL cart can remove archived lines individually',{skip:!enabled},async()=>{
  await setStock('a1',10);const customer=await account('stale-cart');
  async function publish(active){const p=(await call(admin.client,'/admin/products/a1')).body;
    const body=Object.fromEntries(['name','category','description','price','image','sizes','colors','featured','version'].map(k=>[k,p[k]]));body.active=active;
    assert.equal((await call(admin.client,'/admin/products/a1','PUT',body)).status,200);}
  try{
    const cart=(await call(customer.client,'/cart')).body;
    const lines=['M','L'].map(size=>({productId:'a1',size,color:'Black',quantity:1}));
    const saved=await call(customer.client,'/cart','PUT',{version:cart.version,items:lines});assert.equal(saved.status,200);
    await publish(false);
    const repaired=await call(customer.client,'/cart','PUT',{version:saved.body.version,items:[lines[1]]});
    assert.equal(repaired.status,200);assert.equal(repaired.body.available,false);
    assert.equal((await call(customer.client,'/cart','PUT',{version:repaired.body.version,items:lines})).status,409);
    assert.equal((await call(customer.client,'/cart','PUT',{version:repaired.body.version,items:[]})).status,200);
  }finally{await publish(true);await customer.client.dispose();}
});
