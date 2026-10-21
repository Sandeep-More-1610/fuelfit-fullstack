 'use strict';
const API_BASE = AUTH_BASE.replace(/\/auth$/, '');
async function catalogRequest(path, method = 'GET', body) {
  const options = {method, credentials:'include', cache:'no-store', headers:{Accept:'application/json'}};
  if (method !== 'GET') {
    const csrf = await authRequest('/csrf');
    options.headers[csrf.headerName] = csrf.token;
    if (body !== undefined) { options.headers['Content-Type']='application/json'; options.body=JSON.stringify(body); }
  }
  const response = await fetch(API_BASE + path, options);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(Object.values(data?.fields || {})[0] || data?.message || 'Service unavailable. Check the backend connection and try again.');
    error.fields = data?.fields || {};
    error.status = response.status;
    throw error;
  }
  return data;
}
function cacheProducts(items) {
  for (const p of items) {
    const index = PRODUCTS.findIndex(x => x.id === p.id);
    if (index < 0) PRODUCTS.push(p); else PRODUCTS[index] = p;
  }
}
async function loadCategories() {
  const categories = await catalogRequest('/categories');
  for (const c of categories) CAT_INFO[c.id] = {name:c.name, desc:c.description};
  const choices = [{id:'all',name:'All'}, ...categories];
  $('filterChips').innerHTML = choices.map(c => `<button class="chip${c.id === activeCategory ? ' active' : ''}" data-cat="${esc(c.id)}" aria-pressed="${c.id === activeCategory}">${esc(c.name)}</button>`).join('');
  $('adminForm').elements.category.innerHTML = categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}
async function loadCatalog() {
  try {
    await loadCategories();
    const data = await catalogRequest('/products?size=6&sort=featured');
    cacheProducts(data.items); renderGrid('featuredGrid', data.items.filter(p=>p.featured));
    // Refresh cached cart items too: a previously loaded product may now be archived.
    await refreshCartProducts();
  } catch(e) {
    $('featuredGrid').textContent = e.message;
    const retry = document.createElement('button'); retry.className='btn btn--dark';retry.textContent='Retry catalog';retry.onclick=loadCatalog;$('featuredGrid').append(retry);
  }
}
let adminPageNumber = 0, editingProduct = null, adminLoadVersion = 0;
const adminAllowed = () => user?.role === 'ADMIN';
async function loadAdmin() {
  if (!adminAllowed()) return;
  const version = ++adminLoadVersion;
  $('adminStatus').textContent='Loading…';
  try {
    const data=await catalogRequest('/admin/products?size=12&page='+adminPageNumber);
    if (!adminAllowed() || version !== adminLoadVersion) return;
    $('adminProducts').innerHTML='';
    for (const p of data.items) {
      const row=document.createElement('article');row.className='admin-product';
      row.innerHTML=`<h2>${esc(p.name)}</h2><p>${inr(p.price)} · ${esc(p.category)} · ${p.active?'Published':'Archived'}</p>
      <button class="btn btn--dark edit">Edit</button> <button class="btn btn--dark archive" ${p.active?'':'disabled'}>Archive</button>
      <form class="inventory-form"><label>Stock quantity<input aria-label="Stock for ${esc(p.name)}" type="number" min="0" max="1000000000" step="1" value="${p.stock}" required/></label><button class="btn btn--primary">Save stock</button></form>`;
      row.querySelector('.edit').onclick=()=>editProduct(p);
      row.querySelector('.archive').onclick=async()=>{
        if (!confirm('Archive '+p.name+'? It will no longer appear in the public catalog.'))return;
        await adminAction(()=>catalogRequest('/admin/products/'+p.id+'?version='+p.version,'DELETE'));
      };
      row.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const quantity=Number(row.querySelector('input').value);
        await adminAction(()=>catalogRequest('/admin/products/'+p.id+'/inventory','PUT',{quantity,version:p.inventoryVersion}));
      };
      $('adminProducts').append(row);
    }
    $('adminPageLabel').textContent='Page '+(adminPageNumber+1)+' · '+data.total+' products';
    $('adminPrev').disabled=adminPageNumber===0;$('adminNext').disabled=(adminPageNumber+1)*12>=data.total;
    $('adminStatus').textContent='';
  } catch(e){$('adminStatus').textContent=e.message;}
}
let adminPending=false;
async function adminAction(action) {
  if (!adminAllowed() || adminPending)return false;
  adminPending=true;
  const controls=[...$('adminPage').querySelectorAll('button,input,textarea,select')];
  const disabled=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);
  try {await action();await loadAdmin();await loadCatalog();if(currentPage==='shop')await renderShop();return true;}
  catch(e){$('adminStatus').textContent=e.message;return false;}
  finally{adminPending=false;controls.forEach((x,i)=>x.disabled=disabled[i]);}
}
function editProduct(p=null) {
  editingProduct=p;
  const form=$('adminForm');form.reset();form.classList.remove('hidden');
  $('adminFormTitle').textContent=p?'Edit '+p.name:'New product';
  for(const name of ['name','category','description','price','image'])form.elements[name].value=p?.[name]??'';
  for(const name of ['sizes','colors'])form.elements[name].value=(p?.[name]||[]).join('\n');
  form.elements.featured.checked=p?.featured??false;form.elements.active.checked=p?.active??true;
  form.scrollIntoView({block:'start'});form.elements.name.focus();
}
document.addEventListener('DOMContentLoaded',()=>{
  $('catalogFilters').onsubmit=e=>{e.preventDefault();shopPageNumber=0;renderShop();};
  $('catalogPrev').onclick=()=>{shopPageNumber=Math.max(0,shopPageNumber-1);renderShop();};
  $('catalogNext').onclick=()=>{shopPageNumber++;renderShop();};
  $('adminBtn').onclick=()=>{
    if(!adminAllowed())return;detailRequestVersion++;currentPage='admin';closeMobileNav();
    for(const id of ['homePage','shopPage','productPage','accountPage'])$(id)?.classList.add('hidden');
    $('adminPage').classList.remove('hidden');loadAdmin();window.scrollTo({top:0});
  };
  $('adminNew').onclick=()=>editProduct();$('adminCancel').onclick=()=>{$('adminForm').classList.add('hidden');editingProduct=null;};
  $('adminPrev').onclick=()=>{adminPageNumber=Math.max(0,adminPageNumber-1);loadAdmin();};
  $('adminNext').onclick=()=>{adminPageNumber++;loadAdmin();};
  $('adminForm').onsubmit=async e=>{
    e.preventDefault();const f=e.target, p={};
    for(const key of ['name','category','description','image'])p[key]=f.elements[key].value.trim();
    p.price=Number(f.elements.price.value);p.version=editingProduct?.version??0;
    for(const key of ['sizes','colors'])p[key]=f.elements[key].value.split('\n').map(x=>x.trim()).filter(Boolean);
    p.featured=f.elements.featured.checked;p.active=f.elements.active.checked;
    if(await adminAction(()=>catalogRequest('/admin/products'+(editingProduct?'/'+editingProduct.id:''),editingProduct?'PUT':'POST',p))) {f.classList.add('hidden');editingProduct=null;}
  };
});

/* ===== ACCOUNT CART, CHECKOUT AND ORDERS ===== */
'use strict';

let serverCart = null, commerceBusy = false, commerceEpoch = 0, commerceEmail = null;
let checkoutQuote = null, orderAttempt = null, accountPageNumber = 0, adminOrderPage = 0;
let accountViewVersion = 0, adminOrderVersion = 0, cartSyncPromise = null, cartSyncEmail = null;
function guestCart() {
  try { const rows=JSON.parse(localStorage.getItem('ff-cart')||'[]'); return Array.isArray(rows)?rows.filter(i=>i&&typeof i.pid==='string'&&typeof i.size==='string'&&typeof i.color==='string'&&Number.isInteger(i.qty)&&i.qty>0):[]; }
  catch(e) { return []; }
}
function accountVisibility() {
  if (!user) {
    accountViewVersion++;adminOrderVersion++;
    commerceEpoch++; commerceEmail=null; serverCart=null; checkoutQuote=null; orderAttempt=null;
    if ($('checkoutDialog')?.open) $('checkoutDialog').close();
    if ($('adminOrderContent')) $('adminOrderContent').replaceChildren();
    if ($('accountPage')) { $('accountPage').classList.add('hidden'); $('accountContent').replaceChildren(); }
    cart=guestCart(); updateCartBadge();
    if(currentPage==='account')navigate('home');
  }
}
function canonicalCart(data,epoch=commerceEpoch) {
  if(epoch!==commerceEpoch||!user)return;
  serverCart=data;
  cacheProducts(data.items.map(i=>i.product));
  cart=data.items.map(i=>({key:JSON.stringify([i.productId,i.size,i.color]),pid:i.productId,size:i.size,color:i.color,qty:i.quantity}));
  updateCartBadge();renderCart();
  $('cartSubtotalVal').textContent=inr(data.subtotal);$('cartShippingVal').textContent=data.shipping?inr(data.shipping):'FREE';$('cartTotal').textContent=inr(data.total);
}
function cartInput(rows=cart) {return rows.map(i=>({productId:i.pid,size:i.size,color:i.color,quantity:i.qty}));}
async function syncAccountCart(importGuest=true) {
  if (!user) return;
  if (cartSyncPromise && cartSyncEmail === user.email) return cartSyncPromise;
  cartSyncEmail=user.email;
  const pending=syncAccountCartNow(importGuest);
  cartSyncPromise=pending;
  try {return await pending;}finally{if(cartSyncPromise===pending){cartSyncPromise=null;cartSyncEmail=null;}}
}
async function syncAccountCartNow(importGuest=true) {
  if(!user)return;
  const email=user.email, epoch=++commerceEpoch;commerceEmail=email;serverCart=null;
  $('checkoutBtn').disabled=true;
  try {
    let data=await catalogRequest('/cart');
    const guest=guestCart();
    if(importGuest&&guest.length) {
      try {
        let stored;try{stored=JSON.parse(localStorage.getItem('ff-cart-import'));}catch(e){}
        const payload=JSON.stringify(cartInput(guest));
        const mergeKey=stored?.email===email&&stored?.payload===payload?stored.key:crypto.randomUUID();
        // Persist the retry key before a request: a lost response must not double-import items.
        localStorage.setItem('ff-cart-import',JSON.stringify({email,payload,key:mergeKey}));
        data=await catalogRequest('/cart/merge','POST',{mergeKey,items:cartInput(guest)});
        localStorage.removeItem('ff-cart');localStorage.removeItem('ff-cart-import');
      } catch(e) { toast('Your account cart loaded. Guest items were kept locally: '+e.message,'error'); }
    }
    if(user?.email===email)canonicalCart(data,epoch);
  } catch(e) {if(epoch===commerceEpoch){serverCart=null;cart=[];updateCartBadge();renderCart();toast(e.message,'error');}}
}
async function mutateCart(makeRows,added=false) {
  if(commerceBusy)return;
  if(!serverCart||commerceEmail!==user?.email){await syncAccountCart();if(!serverCart)return;}
  commerceBusy=true;const epoch=commerceEpoch;
  try {
    const rows=makeRows(cart.map(i=>({...i})));
    const result=await catalogRequest('/cart','PUT',{version:serverCart.version,items:cartInput(rows)});
    canonicalCart(result,epoch);if(added&&epoch===commerceEpoch)openCart();
  }catch(e){if(epoch===commerceEpoch){toast(e.message,'error');await syncAccountCart(false);}}
  finally{commerceBusy=false;}
}
function commerceAdd(pid,size,color,qty) {
  if(!Number.isInteger(qty)||qty<1||qty>99){toast('Choose between 1 and 99 items','error');return;}
  return mutateCart(rows=>{const i=rows.find(i=>i.pid===pid&&i.size===size&&i.color===color);if(i)i.qty+=qty;else rows.push({pid,size,color,qty,key:JSON.stringify([pid,size,color])});return rows;},true);
}
function commerceRemove(key) {return mutateCart(rows=>rows.filter(i=>i.key!==key));}
function commerceQuantity(key,d) {return mutateCart(rows=>{const i=rows.find(i=>i.key===key);if(i)i.qty=Math.max(1,i.qty+d);return rows;});}
function addressValue(form) {return Object.fromEntries(['name','phone','line1','line2','city','state','postalCode','country'].map(k=>[k,form.elements[k].value.trim()]));}
function resetQuote() {checkoutQuote=null;orderAttempt=null;$('quoteSummary').textContent='';$('placeOrder').disabled=true;}
async function openCheckout() {
  if(!user){closeCart();openModal('login');return;}
  if(commerceBusy){toast('Please wait for your cart update');return;}
  await syncAccountCart(false);if(!serverCart?.available)return;
  closeCart();resetQuote();$('checkoutStatus').textContent='';
  $('checkoutForm').reset();$('checkoutForm').elements.name.value=user.name;
  $('checkoutDialog').showModal();
  const epoch=commerceEpoch;
  try {
    const addresses=await catalogRequest('/addresses');
    if(epoch!==commerceEpoch)return;
    $('savedAddress').innerHTML='<option value="">Enter a new address</option>'+addresses.map((a,i)=>`<option value="${i}">${esc(a.name+' · '+a.line1)}</option>`).join('');
    $('savedAddress').onchange=()=>{const a=addresses[$('savedAddress').value];if(a)for(const [k,v] of Object.entries(a))if($('checkoutForm').elements[k])$('checkoutForm').elements[k].value=v;resetQuote();};
  }catch(e){$('checkoutStatus').textContent=e.message;}
}
async function previewOrder(event) {
  event.preventDefault();if(commerceBusy||!serverCart)return;
  const epoch=commerceEpoch;commerceBusy=true;resetQuote();$('quoteOrder').disabled=true;$('checkoutFields').disabled=true;
  try {
    const address=addressValue($('checkoutForm'));
    const result=await catalogRequest('/checkout/quote','POST',{cartVersion:serverCart.version,address});
    if(epoch!==commerceEpoch)return;
    checkoutQuote={...result,address};
    orderAttempt={cartVersion:result.version,address,quoteToken:result.quoteToken,idempotencyKey:crypto.randomUUID()};
    $('quoteSummary').textContent=`Subtotal ${inr(result.subtotal)} + shipping ${inr(result.shipping)} = ${inr(result.total)}. Pay cash on delivery.`;
    $('placeOrder').disabled=false;$('checkoutStatus').textContent='Review the amount and delivery address, then place your order.';
  }catch(e){if(epoch===commerceEpoch)$('checkoutStatus').textContent=e.message;}
  finally{commerceBusy=false;$('quoteOrder').disabled=false;$('checkoutFields').disabled=false;}
}
async function placeOrder() {
  if(commerceBusy||!orderAttempt)return;
  commerceBusy=true;$('placeOrder').disabled=true;$('quoteOrder').disabled=true;$('checkoutFields').disabled=true;
  const epoch=commerceEpoch,input=orderAttempt;
  // Keep this exact request after a network failure. Retrying uses the same idempotency key.
  try {
    const order=await catalogRequest('/orders','POST',input);
    if(epoch!==commerceEpoch)return;
    $('checkoutDialog').close();resetQuote();
    toast('Order placed: '+order.orderNumber,'success');
    await syncAccountCart(false);await loadCatalog();showAccount('orders');
  }catch(e){if(epoch===commerceEpoch){$('checkoutStatus').textContent=e.status===409?e.message+' Review a new quote.':e.message+' Retry Place order to check the same request.';if(e.status===409)resetQuote();}}
  finally{commerceBusy=false;$('quoteOrder').disabled=false;$('checkoutFields').disabled=false;$('placeOrder').disabled=!orderAttempt;}
}
async function subscribeNewsletter(form) {
  const button=form.querySelector('button');button.disabled=true;
  try {const result=await catalogRequest('/newsletter/subscriptions','POST',{email:form.querySelector('[type=email]').value.trim(),consent:form.elements.consent.checked});$('newsletterMsg').textContent=result.message;form.reset();}
  catch(e){$('newsletterMsg').textContent=e.message;}
  finally{button.disabled=false;}
}
async function showAccount(tab='orders',page=0) {
  if(!user){openModal('login');return;}
  detailRequestVersion++;currentPage='account';accountPageNumber=page;closeMobileNav();
  for(const id of ['homePage','shopPage','productPage','adminPage'])$(id).classList.add('hidden');
  $('accountPage').classList.remove('hidden');$('accountContent').textContent='Loading…';
  document.querySelectorAll('[data-account]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.account===tab)));
  const epoch=commerceEpoch,viewVersion=++accountViewVersion;
  try {
    let html='';
    if(tab==='orders') {
      const data=await catalogRequest('/orders?page='+page+'&size=6');
      html=data.items.length?data.items.map(o=>orderMarkup(o,false)).join(''):'<p>No orders yet.</p>';
      html+=`<div class="catalog-pagination"><button data-order-page="${page-1}" ${page===0?'disabled':''}>Previous</button><span>Page ${page+1}</span><button data-order-page="${page+1}" ${(page+1)*6>=data.total?'disabled':''}>Next</button></div>`;
    }else if(tab==='wishlist') {
      const items=await catalogRequest('/wishlist');cacheProducts(items);
      html=items.length?items.map(p=>`<article class="account-card"><h2>${esc(p.name)}</h2><p>${inr(p.price)} · ${p.active?'Available listing':'Archived'}</p><button data-view="${esc(p.id)}">View product</button> <button data-unwish="${esc(p.id)}">Remove</button></article>`).join(''):'<p>Your wishlist is empty. Open a product to save it.</p>';
    }else {
      const items=await catalogRequest('/addresses');
      html=items.length?items.map(a=>`<article class="account-card"><h2>${esc(a.name)}</h2><p>${esc([a.line1,a.line2,a.city,a.state,a.postalCode].filter(Boolean).join(', '))}</p><button data-delete-address="${esc(a.id)}">Delete address</button></article>`).join(''):'<p>No saved addresses. Save one from the checkout form.</p>';
    }
    if(epoch!==commerceEpoch||!user||currentPage!=='account'||viewVersion!==accountViewVersion)return;
    $('accountContent').innerHTML=html;
  }catch(e){if(epoch===commerceEpoch&&viewVersion===accountViewVersion)$('accountContent').textContent=e.message;}
}
function orderMarkup(o,admin) {
  const address=o.address;
  const options={PLACED:['CONFIRMED','CANCELLED'],CONFIRMED:['SHIPPED','CANCELLED'],SHIPPED:['DELIVERED']}[o.status]||[];
  return `<article class="account-card"><h2>${esc(o.orderNumber)}</h2><p>${esc(o.status)} · ${inr(o.total)} · ${esc(o.paymentMethod)} / ${esc(o.paymentStatus)}</p><p>${esc(new Date(o.createdAt).toLocaleString())}</p>
    <ul>${o.items.map(i=>`<li>${esc(i.name)} · ${esc([i.size,i.color].filter(Boolean).join(' / '))} × ${i.quantity} — ${inr(i.lineTotal)}</li>`).join('')}</ul>
    <p>Delivery: ${esc([address.name,address.line1,address.line2,address.city,address.state,address.postalCode,address.phone].filter(Boolean).join(', '))}</p>
    ${admin?options.map(status=>`<button data-status="${status}" data-order="${o.id}">${status==='CANCELLED'?'Cancel order':'Mark '+status.toLowerCase()}</button>`).join(' '):['PLACED','CONFIRMED'].includes(o.status)?`<button data-cancel-order="${o.id}">Cancel order</button>`:''}</article>`;
}
async function loadAdminOrders(page=0) {
  if(!adminAllowed())return;
  adminOrderPage=page;const epoch=commerceEpoch,viewVersion=++adminOrderVersion;
  $('adminOrderContent').textContent='Loading…';
  try{
    const data=await catalogRequest('/admin/orders?page='+page+'&size=6');
    if(epoch!==commerceEpoch||!adminAllowed()||viewVersion!==adminOrderVersion)return;
    $('adminOrderContent').innerHTML=(data.items.map(o=>orderMarkup(o,true)).join('')||'<p>No orders yet.</p>')+`<div class="catalog-pagination"><button data-admin-page="${page-1}" ${page===0?'disabled':''}>Previous</button><span>Page ${page+1}</span><button data-admin-page="${page+1}" ${(page+1)*6>=data.total?'disabled':''}>Next</button></div>`;
  }catch(e){if(epoch===commerceEpoch&&viewVersion===adminOrderVersion)$('adminOrderContent').textContent=e.message;}
}
async function uiAction(button,action,after) {
  button.disabled=true;
  try{await action();await after?.();}catch(e){toast(e.message,'error');}finally{button.disabled=false;}
}
document.addEventListener('DOMContentLoaded',()=>{
  $('accountBtn').onclick=()=>showAccount();
  document.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>showAccount(b.dataset.account));
  $('checkoutClose').onclick=()=>{if(!commerceBusy)$('checkoutDialog').close();};
  $('checkoutDialog').addEventListener('cancel',event=>{if(commerceBusy)event.preventDefault();});
  $('checkoutForm').onsubmit=previewOrder;
  $('checkoutForm').addEventListener('input',()=>{if(!commerceBusy)resetQuote();});
  $('placeOrder').onclick=placeOrder;
  $('saveAddress').onclick=()=>{if($('checkoutForm').reportValidity())uiAction($('saveAddress'),()=>catalogRequest('/addresses','POST',addressValue($('checkoutForm'))),()=>toast('Address saved','success'));};
  $('retryGuestCart').onclick=()=>syncAccountCart(true);
  $('unsubscribeNewsletter').onclick=e=>uiAction(e.target,()=>catalogRequest('/newsletter/subscriptions/me','DELETE'),()=>toast('Newsletter subscription stopped'));
  $('adminOrdersLoad').onclick=()=>loadAdminOrders();
  $('categoryForm').onsubmit=e=>{e.preventDefault();const form=e.target,input=Object.fromEntries(new FormData(form));const mode=input.mode;delete input.mode;uiAction(form.querySelector('button'),()=>catalogRequest('/admin/categories'+(mode==='update'?'/'+encodeURIComponent(input.id):''),mode==='update'?'PUT':'POST',input),()=>{toast('Category saved');loadCategories();});};
  document.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;const d=button.dataset;
    if(d.orderPage!==undefined)showAccount('orders',Number(d.orderPage));
    if(d.adminPage!==undefined)loadAdminOrders(Number(d.adminPage));
    if(d.view)showProduct(d.view);
    if(d.unwish)uiAction(button,()=>catalogRequest('/wishlist/'+encodeURIComponent(d.unwish),'DELETE'),()=>showAccount('wishlist'));
    if(d.wish){if(!user)openModal('login');else uiAction(button,()=>catalogRequest('/wishlist/'+encodeURIComponent(d.wish),'PUT'),()=>toast('Saved to wishlist','success'));}
    if(d.deleteAddress&&confirm('Delete this saved address?'))uiAction(button,()=>catalogRequest('/addresses/'+d.deleteAddress,'DELETE'),()=>showAccount('addresses'));
    if(d.cancelOrder&&confirm('Cancel this order?'))uiAction(button,()=>catalogRequest('/orders/'+d.cancelOrder+'/cancel','POST',{}),()=>showAccount('orders',accountPageNumber));
    if(d.status&&confirm('Change order status to '+d.status+'?'))uiAction(button,()=>catalogRequest('/admin/orders/'+d.order+'/status','PUT',{status:d.status}),()=>loadAdminOrders(adminOrderPage));
  });
});
