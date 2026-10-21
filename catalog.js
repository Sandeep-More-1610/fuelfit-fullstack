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
    const error = new Error(data?.message || 'Catalog unavailable. Check the backend connection and try again.');
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
    for(const id of ['homePage','shopPage','productPage'])$(id).classList.add('hidden');
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
