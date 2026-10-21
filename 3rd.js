'use strict';

/* ===== DATA ===== */
const PRODUCTS = []; // API-backed cache, also used by the existing local cart.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const CAT_INFO = {
  apparel:     {name:'Apparel',     desc:'Performance gear engineered to move with you'},
  supplements: {name:'Supplements', desc:'Science-backed nutrition to fuel every session'},
  accessories: {name:'Accessories', desc:'Essential training tools for every athlete'},
};

const inr = n => '₹' + n.toLocaleString('en-IN');
const $ = id => document.getElementById(id);
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ===== AUTH ===== */
let user = null;
// The server session is the only source of identity. Retire insecure demo accounts.
try { localStorage.removeItem('ff-user'); localStorage.removeItem('ff-accounts'); } catch(e) {}
const AUTH_BASE = (window.FUELFIT_API_ORIGIN || `http://${location.hostname === 'localhost' ? 'localhost' : '127.0.0.1'}:8080`) + '/api/auth';
let authPending = false;
let authVersion = 0;

async function authRequest(path, body) {
  const options = { credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store' };
  if (body !== undefined) {
    const csrfResponse = await fetch(AUTH_BASE + '/csrf', options);
    if (!csrfResponse.ok) throw new Error('Authentication is unavailable. Check that the backend uses the mysql profile.');
    const csrf = await csrfResponse.json();
    options.method = 'POST';
    options.headers = { ...options.headers, 'Content-Type': 'application/json', [csrf.headerName]: csrf.token };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(AUTH_BASE + path, options);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || 'Unable to complete this request. Please try again.');
    error.fields = data?.fields || {};
    error.status = response.status;
    throw error;
  }
  return data;
}

async function restoreSession() {
  const version = authVersion;
  let restored = null;
  try { restored = await authRequest('/me'); } catch(e) {}
  if (version === authVersion) { user = restored; updateLoginUI(); if (user && typeof syncAccountCart === 'function') await syncAccountCart(); }
}

function updateLoginUI() {
  const loggedIn = !!user;
  if ($('accountBtn')) $('accountBtn').classList.toggle('hidden', !loggedIn);
  if (typeof accountVisibility === 'function') accountVisibility();
  if ($('adminBtn')) $('adminBtn').classList.toggle('hidden', user?.role !== 'ADMIN');
  if (user?.role !== 'ADMIN' && $('adminPage')) {
    $('adminPage').classList.add('hidden');
    if (currentPage === 'admin') navigate('home');
  }
  $('loginBtn').classList.toggle('logged-in', loggedIn);
  $('loginBtnText').textContent = loggedIn ? user.name.split(' ')[0] : 'Login';
  $('mobileLoginBtn').classList.toggle('logged-in', loggedIn);
  $('mobileLoginBtnText').textContent = loggedIn ? 'Hi, ' + user.name.split(' ')[0] + ' (Logout)' : 'Login / Sign Up';
  const accountLabel = loggedIn ? 'Logout, ' + user.name : 'Login or sign up';
  ['loginBtn', 'mobileLoginBtn'].forEach(id => {
    $(id).setAttribute('aria-label', accountLabel);
    $(id).title = accountLabel;
  });
}

/* ===== CART ===== */
let cart = [];
try { const stored = JSON.parse(localStorage.getItem('ff-cart')); cart = Array.isArray(stored) ? stored.filter(i => i && typeof i.pid === 'string' && typeof i.key === 'string' && typeof i.size === 'string' && typeof i.color === 'string' && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 1000000000) : []; } catch(e) {}

function saveCart() {
  if (user && typeof syncAccountCart === 'function') { updateCartBadge(); return; }
  try { localStorage.setItem('ff-cart', JSON.stringify(cart)); }
  catch(e) { toast('Your browser could not save the cart. Keep this page open.', 'error'); }
  updateCartBadge();
}

let cartRefreshVersion = 0, cartRefreshPending = false;
let unverifiedCartProducts = new Set();
const validOption = (options, value) => options.length ? options.includes(value) : value === '';
function cartItemAvailable(item) {
  const p = PRODUCTS.find(p => p.id === item.pid);
  return !!p?.active && p.inStock
    && validOption(p.sizes, item.size)
    && validOption(p.colors, item.color)
    && cart.filter(i => i.pid === item.pid).reduce((n,i) => n + i.qty, 0) <= p.stock;
}

async function refreshCartProducts() {
  const version = ++cartRefreshVersion;
  cartRefreshPending = true;
  if ($('cartSidebar').classList.contains('open')) renderCart();
  const results = await Promise.all([...new Set(cart.map(item => item.pid))].map(async pid => {
    try { return {pid, product: await catalogRequest('/products/' + encodeURIComponent(pid))}; }
    catch(error) { return {pid, status:error.status}; }
  }));
  if (version !== cartRefreshVersion) return;
  unverifiedCartProducts = new Set();
  for (const result of results) {
    if (result.product) cacheProducts([result.product]);
    else if (result.status === 404) {
      const old = PRODUCTS.find(p => p.id === result.pid);
      if (old) { old.active = false; old.inStock = false; old.stock = 0; }
    } else unverifiedCartProducts.add(result.pid);
  }
  cartRefreshPending = false;
  if ($('cartSidebar').classList.contains('open')) renderCart();
}

function addToCart(pid, size, color, qty) {
  if (user && typeof commerceAdd === 'function') return commerceAdd(pid,size,color,qty);
  const p = PRODUCTS.find(p => p.id === pid);
  if (!p || !p.active || !p.inStock || !Number.isInteger(qty) || qty < 1 || qty > Math.min(99,p.stock) || !validOption(p.sizes,size) || !validOption(p.colors,color)) { toast('Choose an available quantity between 1 and 99', 'error'); return; }
  const key = JSON.stringify([pid, size, color]);
  // Compare the actual options so older saved cart keys continue to merge correctly.
  const existing = cart.find(i => i.pid === pid && i.size === size && i.color === color);
  if (existing && existing.qty + qty > 99) { toast('Maximum 99 per option combination', 'error'); return; }
  if (cart.filter(i => i.pid === pid).reduce((n,i) => n + i.qty, 0) + qty > p.stock) { toast('Requested quantity is unavailable', 'error'); return; }
  if (existing) existing.qty += qty;
  else cart.push({ key, pid, size, color, qty });
  saveCart();
  openCart();
  toast('✓ ' + p.name + ' added to cart', 'success');
}

function removeItem(key) { if (user && typeof commerceRemove === 'function') return commerceRemove(key); cart = cart.filter(i => i.key !== key); saveCart(); renderCart(); }

function changeQty(key, d) {
  if (user && typeof commerceQuantity === 'function') return commerceQuantity(key,d);
  const item = cart.find(i => i.key === key);
  if (item) { const p = PRODUCTS.find(p => p.id === item.pid); if (d > 0 && (!p || item.qty >= 99 || cart.filter(i => i.pid === item.pid).reduce((n,i) => n + i.qty, 0) >= p.stock)) { toast('Requested quantity is unavailable (maximum 99 per option)', 'error'); return; } item.qty = Math.min(99,Math.max(1, item.qty + d)); saveCart(); renderCart(); }
}

const cartTotal = () => cart.reduce((s, i) => { const p = PRODUCTS.find(p => p.id === i.pid); return s + (cartItemAvailable(i) ? p.price * i.qty : 0); }, 0);
const cartCount = () => cart.reduce((s, i) => s + i.qty, 0);

function updateCartBadge() {
  const n = cartCount();
  $('cartBadge').textContent = n;
  $('cartBadge').classList.toggle('visible', n > 0);
}

function renderCart() {
  const body = $('cartBody'), foot = $('cartFoot'), chip = $('cartCountChip');
  chip.textContent = cartCount();
  if (!cart.length) {
    body.innerHTML = '<div class="cart-empty"><div class="cart-empty__icon">🛒</div><p>Your cart is empty</p><p>Add some items to get started</p></div>';
    foot.style.display = 'none';
    $('checkoutBtn').disabled = true;
    return;
  }
  body.innerHTML = cart.map(item => {
    const p = PRODUCTS.find(p => p.id === item.pid);
    if (!p || !p.active) return `<div class="cart-item" data-key="${esc(item.key)}"><div class="cart-item__info"><p>Product unavailable</p><button class="rm">Remove</button></div></div>`;
    return `<div class="cart-item" data-key="${esc(item.key)}">
      <img src="${esc(p.image)}" alt="${esc(p.name)}"/>
      <div class="cart-item__info">
        <div class="cart-item__name">${esc(p.name)}</div>
        ${!cartItemAvailable(item) ? '<p class="stock-status">Selected options or requested stock unavailable</p>' : ''}
        <div class="cart-item__meta">${esc([item.size,item.color].filter(Boolean).join(' · '))}</div>
        <div class="cart-item__row">
          <div class="cart-item__qty">
            <button class="qty-d">−</button><span>${esc(item.qty)}</span><button class="qty-i">+</button>
          </div>
          <div class="cart-item__price-del">
            <span class="cart-item__price">${inr(p.price * item.qty)}</span>
            <button class="cart-item__del rm">✕</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  const verificationFailed = cart.some(item => unverifiedCartProducts.has(item.pid));
  if (cartRefreshPending || verificationFailed) {
    const notice = document.createElement('p');
    notice.className = 'stock-status';
    notice.textContent = cartRefreshPending ? 'Checking availability…' : 'Cannot verify availability. Close and reopen the cart to retry.';
    body.prepend(notice);
  }
  body.querySelectorAll('.cart-item').forEach(row => {
    const key = row.dataset.key;
    if (row.querySelector('.qty-d')) row.querySelector('.qty-d').onclick = () => changeQty(key, -1);
    if (row.querySelector('.qty-i')) row.querySelector('.qty-i').onclick = () => changeQty(key, 1);
    row.querySelector('.rm').onclick = () => removeItem(key);
  });
  $('checkoutBtn').disabled = cartRefreshPending || verificationFailed || cart.some(item => !cartItemAvailable(item));
  const sub = cartTotal(), shipping = cart.some(cartItemAvailable) && sub < 6500 ? 299 : 0;
  $('cartSubtotalVal').textContent = inr(sub);
  $('cartShippingVal').textContent = shipping === 0 ? 'FREE' : inr(shipping);
  $('cartTotal').textContent = inr(sub + shipping);
  if (user && typeof serverCart !== 'undefined' && serverCart) {
    $('cartSubtotalVal').textContent = inr(serverCart.subtotal);
    $('cartShippingVal').textContent = serverCart.shipping ? inr(serverCart.shipping) : 'FREE';
    $('cartTotal').textContent = inr(serverCart.total);
    $('checkoutBtn').disabled ||= !serverCart.available;
  }
  foot.style.display = '';
}

/* ===== ROUTING ===== */
let currentPage = 'home', activeCategory = 'all', sortBy = 'featured', prevCat = 'all';
let detailRequestVersion = 0;

function navigate(page) {
  if ($('accountPage')) $('accountPage').classList.add('hidden');
  detailRequestVersion++;
  currentPage = page;
  $('adminPage').classList.add('hidden');
  const isShop = ['shop','apparel','supplements','accessories'].includes(page);
  $('homePage').classList.toggle('hidden', page !== 'home');
  $('shopPage').classList.toggle('hidden', !isShop);
  $('productPage').classList.toggle('hidden', page !== 'product');
  if (isShop) { shopPageNumber = 0; activeCategory = page === 'shop' ? 'all' : page; prevCat = activeCategory; updateShop(); }
  document.querySelectorAll('.nav__link').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  closeMobileNav();
  window.scrollTo({top:0,behavior:'smooth'});
}

async function showProduct(pid) {
  const version = ++detailRequestVersion;
  try {
    const product = await catalogRequest('/products/' + encodeURIComponent(pid));
    if (version !== detailRequestVersion) return;
    cacheProducts([product]);
  } catch(e) { if (version === detailRequestVersion) toast(e.message, 'error'); return; }
  $('adminPage').classList.add('hidden');
  currentPage = 'product';
  ['homePage','shopPage'].forEach(id => $(id).classList.add('hidden'));
  $('productPage').classList.remove('hidden');
  renderProduct(pid);
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ===== RENDER HELPERS ===== */
function productCard(p) {
  const div = document.createElement('div');
  div.className = 'product-card';
  div.tabIndex = 0;
  div.setAttribute('aria-label', 'View ' + p.name);
  div.onkeydown = e => { if (e.target === div && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showProduct(p.id); } };
  div.innerHTML = `
    <div class="product-card__img-wrap">
      <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"/>
      ${p.featured ? '<span class="product-card__badge">Featured</span>' : ''}
    </div>
    <div class="product-card__body">
      <p class="stock-status">${p.inStock ? 'In stock' : 'Out of stock'}</p><div class="product-card__cat">${esc(p.category)}</div>
      <div class="product-card__name">${esc(p.name)}</div>
      <p class="product-card__desc">${esc(p.description)}</p>
      <div class="product-card__footer">
        <span class="product-card__price">${inr(p.price)}</span>
        <button class="btn btn--dark btn--sm">View</button>
      </div>
    </div>`;
  div.querySelector('button').onclick = e => { e.stopPropagation(); showProduct(p.id); };
  div.onclick = () => showProduct(p.id);
  return div;
}

function renderGrid(gridId, products) {
  const g = $(gridId);
  g.innerHTML = '';
  products.forEach(p => g.appendChild(productCard(p)));
}

function updateShop() {
  const isCat = activeCategory !== 'all';
  $('shopTitle').textContent = isCat ? (CAT_INFO[activeCategory]?.name || activeCategory) : 'All Products';
  $('shopSubtitle').textContent = isCat ? (CAT_INFO[activeCategory]?.desc || '') : 'Browse our complete collection of premium gear and supplements';
  document.querySelectorAll('#filterChips .chip').forEach(c => {
    const selected = c.dataset.cat === activeCategory;
    c.classList.toggle('active', selected);
    c.setAttribute('aria-pressed', String(selected));
  });
  renderShop();
}

let shopRequestVersion = 0, shopPageNumber = 0;
async function renderShop() {
  const version = ++shopRequestVersion;
  $('productCount').textContent = 'Loading products…';
  const params = new URLSearchParams({category: activeCategory === 'all' ? '' : activeCategory, sort: sortBy, page: shopPageNumber, size: 12});
  for (const [id,key] of [['catalogQuery','q'],['minPrice','minPrice'],['maxPrice','maxPrice'],['stockFilter','inStock']]) {
    if ($(id)?.value) params.set(key, $(id).value);
  }
  try {
    const data = await catalogRequest('/products?' + params);
    if (version !== shopRequestVersion) return;
    cacheProducts(data.items);
    $('emptyMsg').classList.toggle('hidden', data.items.length > 0);
    $('productCount').textContent = data.total + ' products';
    renderGrid('shopGrid', data.items);
    $('catalogPage').textContent = 'Page ' + (shopPageNumber + 1);
    $('catalogPrev').disabled = shopPageNumber === 0;
    $('catalogNext').disabled = (shopPageNumber + 1) * data.size >= data.total;
  } catch(e) {
    if (version !== shopRequestVersion) return;
    renderGrid('shopGrid', []); $('productCount').textContent = e.message;
    $('emptyMsg').classList.add('hidden');
  }
}

function renderProduct(pid) {
  const p = PRODUCTS.find(x => x.id === pid);
  if (!p) return;
  let size = p.sizes[0] || '', color = p.colors[0] || '', qty = 1;
  const mkOpts = (arr, attr) => arr.map(v =>
    `<button class="pd-option${v === (attr === 'size' ? size : color) ? ' selected' : ''}" data-${attr}="${esc(v)}">${esc(v)}</button>`
  ).join('');
  $('productDetail').innerHTML = `
    <div class="pd-image-wrap">
      <img src="${esc(p.image)}" alt="${esc(p.name)}"/>
      ${p.featured ? '<span class="pd-badge">Featured</span>' : ''}
    </div>
    <div class="pd-body">
      <div class="pd-cat">${esc(p.category)}</div>
      <h1 class="pd-name">${esc(p.name)}</h1>
      <div class="pd-price-row"><div class="pd-price">${inr(p.price)}</div></div>
      <p class="stock-status">${p.inStock ? esc(p.stock) + ' in stock' : 'Out of stock'}</p>
      <p class="pd-desc">${esc(p.description)}</p>
      ${p.sizes.length ? `<div class="pd-label">Size <span class="pd-selected-value" id="sizeVal">${esc(size)}</span></div><div class="pd-options" id="sizeOpts">${mkOpts(p.sizes,'size')}</div>` : ''}
      ${p.colors.length ? `<div class="pd-label">Color <span class="pd-selected-value" id="colorVal">${esc(color)}</span></div><div class="pd-options" id="colorOpts">${mkOpts(p.colors,'color')}</div>` : ''}
      <div class="pd-label">Quantity</div>
      <div class="qty-row">
        <div class="qty-control">
          <button class="qty-btn" id="qtyD">−</button>
          <span class="qty-num" id="qtyN">1</span>
          <button class="qty-btn" id="qtyI">+</button>
        </div>
      </div>
      <button class="btn btn--primary w-full" id="addBtn" style="padding:1.05rem;font-size:.95rem;letter-spacing:1px">🛒 Add to Cart</button>
      <button class="btn btn--dark w-full" data-wish="${esc(p.id)}">Save to wishlist</button>
      <div class="pd-perks">
        <div class="pd-perk"><span class="pd-perk__icon">✓</span>Free shipping on orders over ₹6,500</div>
        <div class="pd-perk"><span class="pd-perk__icon">✓</span>30-day hassle-free return policy</div>
        <div class="pd-perk"><span class="pd-perk__icon">✓</span>Cash on delivery — no online payment required</div>
        <div class="pd-perk"><span class="pd-perk__icon">✓</span>Third-party quality tested</div>
      </div>
    </div>`;

  const detail = $('productDetail');
  detail.querySelectorAll('[data-size]').forEach(btn => btn.onclick = () => {
    size = btn.dataset.size;
    detail.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('selected', b === btn));
    $('sizeVal').textContent = size;
  });
  detail.querySelectorAll('[data-color]').forEach(btn => btn.onclick = () => {
    color = btn.dataset.color;
    detail.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('selected', b === btn));
    $('colorVal').textContent = color;
  });
  $('addBtn').disabled = !p.inStock;
  $('addBtn').textContent = p.inStock ? '🛒 Add to Cart' : 'Out of stock';
  $('qtyD').onclick = () => { qty = Math.max(1, qty - 1); $('qtyN').textContent = qty; };
  $('qtyI').onclick = () => { qty = Math.min(99, p.stock || 1, qty + 1); $('qtyN').textContent = qty; };
  $('addBtn').onclick = async () => {
    try { cacheProducts([await catalogRequest('/products/' + encodeURIComponent(p.id))]); addToCart(p.id, size, color, qty); }
    catch(e) { toast(e.message, 'error'); }
  };
}

/* ===== OVERLAYS ===== */
let cartReturnFocus = null, searchReturnFocus = null;
function openCart() {
  if (user && typeof syncAccountCart === 'function' && !commerceBusy) syncAccountCart(false);
  if (!$('cartSidebar').classList.contains('open')) cartReturnFocus = document.activeElement;
  $('cartSidebar').inert = false;
  $('cartSidebar').setAttribute('aria-hidden', 'false');
  $('cartSidebar').classList.add('open'); $('cartBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden'; renderCart(); refreshCartProducts(); $('cartClose').focus();
}
function closeCart() {
  const wasOpen = $('cartSidebar').classList.contains('open');
  $('cartSidebar').classList.remove('open'); $('cartSidebar').inert = true;
  $('cartSidebar').setAttribute('aria-hidden', 'true');
  $('cartBackdrop').classList.remove('open'); document.body.style.overflow = '';
  if (wasOpen) cartReturnFocus?.focus();
}
function openSearch() {
  searchReturnFocus = document.activeElement;
  $('searchOverlay').inert = false; $('searchOverlay').classList.add('open');
  $('searchOverlay').setAttribute('aria-hidden', 'false');
  $('searchInput').value = ''; $('searchResults').innerHTML = ''; document.body.style.overflow = 'hidden';
  setTimeout(() => { if ($('searchOverlay').classList.contains('open')) $('searchInput').focus(); }, 50);
}
function closeSearch() {
  const wasOpen = $('searchOverlay').classList.contains('open');
  searchRequestVersion++; $('searchOverlay').classList.remove('open'); $('searchOverlay').inert = true;
  $('searchOverlay').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = ''; if (wasOpen) searchReturnFocus?.focus();
}
let accountReturnFocus = null;
function openModal(tab) {
  closeMobileNav();
  accountReturnFocus = document.activeElement;
  $('loginModal').inert = false;
  $('loginModal').setAttribute('aria-hidden', 'false');
  $('loginModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  switchTab(tab || 'login');
  $('modalClose').focus();
}
function closeModal() {
  const wasOpen = $('loginModal').classList.contains('open');
  $('loginModal').classList.remove('open');
  $('loginModal').inert = true;
  $('loginModal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  clearErrors();
  if (wasOpen) accountReturnFocus?.focus();
}
function setMobileNav(open) {
  if (!open && $('mobileNav').contains(document.activeElement)) $('hamburger').focus();
  $('hamburger').classList.toggle('open', open);
  $('hamburger').setAttribute('aria-expanded', String(open));
  $('hamburger').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  $('mobileNav').classList.toggle('open', open);
  $('mobileNav').inert = !open;
}
function closeMobileNav() { setMobileNav(false); }

function switchTab(tab) {
  const isLogin = tab === 'login';
  $('tabLogin').classList.toggle('active', isLogin);
  $('tabSignup').classList.toggle('active', !isLogin);
  $('loginFormWrap').classList.toggle('hidden', !isLogin);
  $('signupFormWrap').classList.toggle('hidden', isLogin);
  $('modalTitle').textContent = isLogin ? 'Welcome Back' : 'Create Account';
  $('modalSub').textContent = isLogin ? 'Sign in to your account to continue' : 'Join the FuelFit movement today';
  clearErrors();
}

function clearErrors() { document.querySelectorAll('.form-error').forEach(e => e.classList.remove('show')); }

function showErr(id, msg) { const el = $(id); if (msg) el.textContent = msg; el.classList.add('show'); }
function hideErr(id) { $(id).classList.remove('show'); }

function onPasswordEnter(submit) {
  return event => {
    // Returning false from a DOM onkeydown handler cancels normal typing.
    if (event.key === 'Enter') { event.preventDefault(); submit(); }
  };
}

/* ===== AUTH HANDLERS ===== */
async function handleLogin() {
  if (authPending) return;
  authVersion++;
  const email = $('loginEmail').value.trim(), pass = $('loginPassword').value;
  let ok = true;
  if (!validEmail(email)) { showErr('loginEmailErr'); ok = false; } else hideErr('loginEmailErr');
  if (!pass) { showErr('loginPassErr','Please enter your password'); ok = false; } else hideErr('loginPassErr');
  if (!ok) return;
  authPending = true;
  $('loginSubmitBtn').disabled = true;
  try {
    user = await authRequest('/login', { email, password: pass });
    updateLoginUI(); closeModal();
    if (typeof syncAccountCart === 'function') await syncAccountCart();
    toast('🎉 Welcome back, ' + user.name.split(' ')[0] + '!', 'success');
  } catch(e) { showErr('loginPassErr', e.status ? e.message : 'Cannot reach the backend. Please try again.'); }
  finally { authPending = false; $('loginSubmitBtn').disabled = false; $('loginPassword').value = ''; }
}

async function handleSignup() {
  if (authPending) return;
  authVersion++;
  const name = $('signupName').value.trim(), email = $('signupEmail').value.trim(), pass = $('signupPassword').value;
  let ok = true;
  if (!name) { showErr('signupNameErr'); ok = false; } else hideErr('signupNameErr');
  if (!validEmail(email)) { showErr('signupEmailErr','Please enter a valid email'); ok = false; } else hideErr('signupEmailErr');
  if (pass.length < 8 || new TextEncoder().encode(pass).length > 72) { showErr('signupPassErr','Use at least 8 characters and at most 72 UTF-8 bytes'); ok = false; } else hideErr('signupPassErr');
  if (!ok) return;
  authPending = true;
  $('signupSubmitBtn').disabled = true;
  try {
    await authRequest('/register', { name, email, password: pass });
    // Keep the existing automatic sign-in experience after registration.
    switchTab('login');
    $('loginEmail').value = email;
    user = await authRequest('/login', { email, password: pass });
    updateLoginUI(); closeModal();
    if (typeof syncAccountCart === 'function') await syncAccountCart();
    toast('🎉 Welcome to FuelFit, ' + name.split(' ')[0] + '!', 'success');
  } catch(e) {
    if (!$('loginFormWrap').classList.contains('hidden')) {
      showErr('loginPassErr', 'Your account may have been created. Please sign in to continue.');
    } else {
      showErr(e.status === 409 || e.fields?.email ? 'signupEmailErr' : e.fields?.name ? 'signupNameErr' : 'signupPassErr',
        e.status ? (Object.values(e.fields || {})[0] || e.message) : 'Cannot reach the backend. Please try again.');
    }
  } finally { authPending = false; $('signupSubmitBtn').disabled = false; $('signupPassword').value = ''; }
}

async function handleLogout() {
  if (authPending) return;
  authVersion++;
  authPending = true;
  try { await authRequest('/logout', {}); user = null; updateLoginUI(); toast('👋 Logged out successfully'); }
  catch(e) {
    if (e.status === 401) { user = null; updateLoginUI(); }
    else toast('Unable to sign out. Please try again.', 'error');
  } finally { authPending = false; }
}

/* ===== TOAST ===== */
let toastTimer;
function toast(msg, type) {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ===== SEARCH ===== */
let searchRequestVersion = 0;
async function handleSearch(q) {
  const version = ++searchRequestVersion, r = $('searchResults');
  r.innerHTML = '';
  if (!q.trim()) return;
  try {
    const data = await catalogRequest('/products?' + new URLSearchParams({q, size:5}));
    if (version !== searchRequestVersion) return;
    cacheProducts(data.items);
    r.innerHTML = data.items.map(p => `<button class="search-result-item" data-id="${esc(p.id)}"><img src="${esc(p.image)}" alt="${esc(p.name)}"/><span>${esc(p.name)}</span><strong>${inr(p.price)}</strong></button>`).join('');
    if (!data.items.length) r.textContent = 'No results for "' + q + '"';
    r.querySelectorAll('.search-result-item').forEach(item => item.onclick = () => {closeSearch();showProduct(item.dataset.id);});
  } catch(e) { if (version === searchRequestVersion) r.textContent = e.message; }
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  loadCatalog();
  updateCartBadge();
  updateLoginUI();

  // Navigation delegation
  restoreSession();
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-page]');
    if (t && !['SECTION','MAIN'].includes(t.tagName)) navigate(t.dataset.page);
  });

  // Header
  $('logoBtn').onclick = () => navigate('home');
  $('searchBtn').onclick = openSearch;
  $('searchClose').onclick = closeSearch;
  $('searchInput').oninput = e => handleSearch(e.target.value);
  $('cartBtn').onclick = openCart;
  $('cartClose').onclick = closeCart;
  $('cartBackdrop').onclick = closeCart;
  $('loginBtn').onclick = () => user ? handleLogout() : openModal('login');
  $('mobileLoginBtn').onclick = () => { closeMobileNav(); user ? handleLogout() : openModal('login'); };
  $('hamburger').onclick = () => setMobileNav(!$('mobileNav').classList.contains('open'));
  document.addEventListener('click', e => {
    if (!$('header').contains(e.target)) closeMobileNav();
  });
  document.addEventListener('focusin', e => {
    if (!$('header').contains(e.target)) closeMobileNav();
  });
  window.matchMedia('(max-width: 900px)').addEventListener('change', () => {
    const accountFocused = $('mobileNav').classList.contains('open') || document.activeElement === $('hamburger');
    closeMobileNav();
    if (accountFocused) $('loginBtn').focus();
  });

  // Modal
  $('modalClose').onclick = closeModal;
  $('loginModal').onclick = e => { if (e.target === $('loginModal')) closeModal(); };
  $('tabLogin').onclick = () => switchTab('login');
  $('tabSignup').onclick = () => switchTab('signup');
  $('switchToSignup').onclick = () => switchTab('signup');
  $('switchToLogin').onclick = () => switchTab('login');
  $('loginSubmitBtn').onclick = handleLogin;
  $('signupSubmitBtn').onclick = handleSignup;
  $('loginPassword').onkeydown = onPasswordEnter(handleLogin);
  $('signupPassword').onkeydown = onPasswordEnter(handleSignup);

  // Checkout
  $('checkoutBtn').onclick = () => {
    if (!user) { closeCart(); openModal('login'); toast('Please login to proceed to checkout'); }
    else if (typeof openCheckout === 'function') openCheckout();
  };

  // Shop
  $('filterChips').onclick = e => { const c = e.target.closest('.chip'); if (c) { activeCategory = prevCat = c.dataset.cat; shopPageNumber = 0; updateShop(); } };
  $('sortSelect').onchange = e => { sortBy = e.target.value; shopPageNumber = 0; renderShop(); };
  $('backBtn').onclick = () => navigate(prevCat !== 'all' ? prevCat : 'shop');

  // Newsletter
  $('newsletterForm').onsubmit = e => { e.preventDefault(); if(typeof subscribeNewsletter === 'function') subscribeNewsletter(e.target); };

  // Keyboard + scroll
  document.onkeydown = e => {
    if (e.key === 'Escape') { closeSearch(); closeCart(); closeModal(); closeMobileNav(); }
    const overlay = ['loginModal','cartSidebar','searchOverlay'].map($).find(el => el.classList.contains('open'));
    if (e.key === 'Tab' && overlay) {
      const controls = [...overlay.querySelectorAll('button,input')].filter(el => !el.disabled && el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  window.onscroll = () => { $('header').style.boxShadow = window.scrollY > 10 ? '0 2px 32px rgba(0,0,0,.7)' : 'none'; };
});
