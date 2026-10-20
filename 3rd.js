'use strict';

/* ===== DATA ===== */
const PRODUCTS = [
  {id:'a1',name:'Pro Performance Tee',category:'apparel',featured:true,price:2999,description:'Moisture-wicking, four-way stretch fabric keeps you dry and comfortable through the toughest workouts. Anti-odor technology built in.',image:'https://images.pexels.com/photos/3764011/pexels-photo-3764011.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['XS','S','M','L','XL','XXL'],colors:['Black','White','Gray','Orange']},
  {id:'a2',name:'Flex Training Shorts',category:'apparel',featured:true,price:3799,description:'Ultra-light 4-inch inseam shorts with hidden zip pocket and built-in liner. Perfect for HIIT, running, and cross-training.',image:'https://images.pexels.com/photos/1321943/pexels-photo-1321943.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['S','M','L','XL','XXL'],colors:['Black','Navy','Gray']},
  {id:'a3',name:'Compression Leggings',category:'apparel',featured:false,price:5299,description:'High-waist compression leggings with sculpting panels and moisture management. 7/8 length for versatile styling.',image:'https://images.pexels.com/photos/2827400/pexels-photo-2827400.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['XS','S','M','L','XL'],colors:['Black','Charcoal','Midnight Blue']},
  {id:'a4',name:'Heavyweight Hoodie',category:'apparel',featured:false,price:6499,description:'Premium 400gsm French terry cotton hoodie. Pre-washed for a soft, broken-in feel. Kangaroo pocket and adjustable drawcord.',image:'https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['S','M','L','XL','XXL'],colors:['Black','Cream','Forest Green']},
  {id:'a5',name:'Sports Bra Pro',category:'apparel',featured:true,price:3499,description:'Medium-impact support bra with moisture-wicking fabric and removable pads. Racerback design for full range of motion.',image:'https://images.pexels.com/photos/3768916/pexels-photo-3768916.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['XS','S','M','L','XL'],colors:['Black','Coral','Teal']},
  {id:'s1',name:'Whey Protein Isolate',category:'supplements',featured:true,price:4499,description:'Ultra-pure 90% protein isolate. 25g protein per scoop, less than 1g carbs and fat. Cold-processed to preserve bioactive peptides.',image:'https://images.pexels.com/photos/3850838/pexels-photo-3850838.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['1kg','2.5kg','5kg'],colors:['Chocolate','Vanilla','Strawberry','Unflavored']},
  {id:'s2',name:'Pre-Workout Ignite',category:'supplements',featured:true,price:3299,description:'Explosive energy and focus. 300mg caffeine, 6g citrulline, 3.2g beta-alanine. Third-party tested. 30 full servings.',image:'https://images.pexels.com/photos/4164766/pexels-photo-4164766.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['30 Servings','60 Servings'],colors:['Blue Razz','Watermelon','Mango Peach']},
  {id:'s3',name:'Creatine Monohydrate',category:'supplements',featured:false,price:1999,description:'Pharmaceutical-grade micronized creatine monohydrate. 5g per scoop. Unflavored — mixes instantly into any liquid. 60 servings.',image:'https://images.pexels.com/photos/3076516/pexels-photo-3076516.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['300g','500g','1kg'],colors:['Unflavored']},
  {id:'s4',name:'BCAA Recovery Blend',category:'supplements',featured:false,price:2699,description:'2:1:1 ratio BCAA with electrolytes and coconut water powder. Reduces muscle soreness and speeds recovery. 40 servings.',image:'https://images.pexels.com/photos/3766208/pexels-photo-3766208.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['40 Servings'],colors:['Tropical Punch','Lemon Lime','Grape']},
  {id:'s5',name:'Mass Gainer Pro',category:'supplements',featured:true,price:5499,description:'1250 calories, 50g protein, 252g carbs per serving. Complex carb blend from oats and sweet potato. Ideal for hard gainers.',image:'https://images.pexels.com/photos/4397839/pexels-photo-4397839.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['2.5kg','5kg'],colors:['Chocolate Peanut Butter','Vanilla Ice Cream']},
  {id:'ac1',name:'Neoprene Weightlifting Belt',category:'accessories',featured:true,price:3999,description:'Professional-grade 4" neoprene belt with velcro fastening. Provides lumbar support for heavy compound lifts.',image:'https://images.pexels.com/photos/4164512/pexels-photo-4164512.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['S/M','L/XL','XXL'],colors:['Black','Red']},
  {id:'ac2',name:'Shaker Bottle Pro',category:'accessories',featured:false,price:1299,description:'800ml BPA-free Tritan shaker with stainless steel BlenderBall wire whisk. Leak-proof lid, stackable base for protein storage.',image:'https://images.pexels.com/photos/6551133/pexels-photo-6551133.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['800ml'],colors:['Black','White','Orange','Gray']},
  {id:'ac3',name:'Resistance Band Set',category:'accessories',featured:false,price:2299,description:'Set of 5 natural latex resistance bands (5–25kg). Includes mesh carry bag, door anchor, handles, and ankle straps.',image:'https://images.pexels.com/photos/4162438/pexels-photo-4162438.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['Set of 5'],colors:['Multi-Color']},
  {id:'ac4',name:'Lifting Straps Pro',category:'accessories',featured:false,price:1699,description:'Heavy-duty cotton lifting straps with neoprene wrist padding. Maximum grip for deadlifts, rows, and lat pulldowns.',image:'https://images.pexels.com/photos/4162487/pexels-photo-4162487.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['One Size'],colors:['Black','Gray']},
  {id:'ac5',name:'Foam Roller Elite',category:'accessories',featured:true,price:2999,description:'High-density EVA foam roller with 3D grid surface for deep tissue massage and myofascial release. 45cm length.',image:'https://images.pexels.com/photos/4162455/pexels-photo-4162455.jpeg?auto=compress&cs=tinysrgb&w=600',sizes:['45cm','90cm'],colors:['Black','Blue','Orange']},
];

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
try { user = JSON.parse(localStorage.getItem('ff-user')); } catch(e) {}

function updateLoginUI() {
  const loggedIn = !!user;
  $('loginBtn').classList.toggle('logged-in', loggedIn);
  $('loginBtnText').textContent = loggedIn ? user.name.split(' ')[0] : 'Login';
  $('mobileLoginBtn').classList.toggle('logged-in', loggedIn);
  $('mobileLoginBtnText').textContent = loggedIn ? 'Hi, ' + user.name.split(' ')[0] + ' (Logout)' : 'Login / Sign Up';
}

/* ===== CART ===== */
let cart = [];
try { cart = JSON.parse(localStorage.getItem('ff-cart')) || []; } catch(e) {}

function saveCart() { localStorage.setItem('ff-cart', JSON.stringify(cart)); updateCartBadge(); }

function addToCart(pid, size, color, qty) {
  const p = PRODUCTS.find(p => p.id === pid);
  if (!p) return;
  const key = pid + '-' + size + '-' + color;
  const existing = cart.find(i => i.key === key);
  if (existing) existing.qty += qty;
  else cart.push({ key, pid, size, color, qty });
  saveCart();
  openCart();
  toast('✓ ' + p.name + ' added to cart', 'success');
}

function removeItem(key) { cart = cart.filter(i => i.key !== key); saveCart(); renderCart(); }

function changeQty(key, d) {
  const item = cart.find(i => i.key === key);
  if (item) { item.qty = Math.max(1, item.qty + d); saveCart(); renderCart(); }
}

const cartTotal = () => cart.reduce((s, i) => { const p = PRODUCTS.find(p => p.id === i.pid); return s + (p ? p.price * i.qty : 0); }, 0);
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
    return;
  }
  body.innerHTML = cart.map(item => {
    const p = PRODUCTS.find(p => p.id === item.pid);
    if (!p) return '';
    return `<div class="cart-item" data-key="${item.key}">
      <img src="${p.image}" alt="${p.name}"/>
      <div class="cart-item__info">
        <div class="cart-item__name">${p.name}</div>
        <div class="cart-item__meta">${[item.size,item.color].filter(Boolean).join(' · ')}</div>
        <div class="cart-item__row">
          <div class="cart-item__qty">
            <button class="qty-d">−</button><span>${item.qty}</span><button class="qty-i">+</button>
          </div>
          <div class="cart-item__price-del">
            <span class="cart-item__price">${inr(p.price * item.qty)}</span>
            <button class="cart-item__del rm">✕</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  body.querySelectorAll('.cart-item').forEach(row => {
    const key = row.dataset.key;
    row.querySelector('.qty-d').onclick = () => changeQty(key, -1);
    row.querySelector('.qty-i').onclick = () => changeQty(key, 1);
    row.querySelector('.rm').onclick = () => removeItem(key);
  });
  const sub = cartTotal(), free = sub >= 6500, shipping = free ? 0 : 299;
  $('cartSubtotalVal').textContent = inr(sub);
  $('cartShippingVal').textContent = free ? 'FREE' : inr(shipping);
  $('cartTotal').textContent = inr(sub + shipping);
  foot.style.display = '';
}

/* ===== ROUTING ===== */
let currentPage = 'home', activeCategory = 'all', sortBy = 'featured', prevCat = 'all';

function navigate(page) {
  currentPage = page;
  const isShop = ['shop','apparel','supplements','accessories'].includes(page);
  $('homePage').classList.toggle('hidden', page !== 'home');
  $('shopPage').classList.toggle('hidden', !isShop);
  $('productPage').classList.toggle('hidden', page !== 'product');
  if (isShop) { activeCategory = page === 'shop' ? 'all' : page; prevCat = activeCategory; updateShop(); }
  document.querySelectorAll('.nav__link').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  closeMobileNav();
  window.scrollTo({top:0,behavior:'smooth'});
}

function showProduct(pid) {
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
  div.innerHTML = `
    <div class="product-card__img-wrap">
      <img src="${p.image}" alt="${p.name}" loading="lazy"/>
      ${p.featured ? '<span class="product-card__badge">Featured</span>' : ''}
    </div>
    <div class="product-card__body">
      <div class="product-card__cat">${p.category}</div>
      <div class="product-card__name">${p.name}</div>
      <p class="product-card__desc">${p.description}</p>
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
  $('shopTitle').textContent = isCat ? CAT_INFO[activeCategory].name : 'All Products';
  $('shopSubtitle').textContent = isCat ? CAT_INFO[activeCategory].desc : 'Browse our complete collection of premium gear and supplements';
  document.querySelectorAll('#filterChips .chip').forEach(c => c.classList.toggle('active', c.dataset.cat === activeCategory));
  renderShop();
}

function renderShop() {
  let items = activeCategory === 'all' ? PRODUCTS.slice() : PRODUCTS.filter(p => p.category === activeCategory);
  if (sortBy === 'price-low') items.sort((a,b) => a.price - b.price);
  else if (sortBy === 'price-high') items.sort((a,b) => b.price - a.price);
  else if (sortBy === 'name') items.sort((a,b) => a.name.localeCompare(b.name));
  else items.sort((a,b) => b.featured - a.featured);
  $('emptyMsg').classList.toggle('hidden', items.length > 0);
  $('productCount').textContent = items.length + ' product' + (items.length !== 1 ? 's' : '');
  renderGrid('shopGrid', items);
}

function renderProduct(pid) {
  const p = PRODUCTS.find(x => x.id === pid);
  if (!p) return;
  let size = p.sizes[0] || '', color = p.colors[0] || '', qty = 1;
  const mkOpts = (arr, attr) => arr.map(v =>
    `<button class="pd-option${v === (attr === 'size' ? size : color) ? ' selected' : ''}" data-${attr}="${v}">${v}</button>`
  ).join('');
  $('productDetail').innerHTML = `
    <div class="pd-image-wrap">
      <img src="${p.image}" alt="${p.name}"/>
      ${p.featured ? '<span class="pd-badge">Featured</span>' : ''}
    </div>
    <div class="pd-body">
      <div class="pd-cat">${p.category}</div>
      <h1 class="pd-name">${p.name}</h1>
      <div class="pd-price-row"><div class="pd-price">${inr(p.price)}</div></div>
      <p class="pd-desc">${p.description}</p>
      ${p.sizes.length ? `<div class="pd-label">Size <span class="pd-selected-value" id="sizeVal">${size}</span></div><div class="pd-options" id="sizeOpts">${mkOpts(p.sizes,'size')}</div>` : ''}
      ${p.colors.length ? `<div class="pd-label">Color <span class="pd-selected-value" id="colorVal">${color}</span></div><div class="pd-options" id="colorOpts">${mkOpts(p.colors,'color')}</div>` : ''}
      <div class="pd-label">Quantity</div>
      <div class="qty-row">
        <div class="qty-control">
          <button class="qty-btn" id="qtyD">−</button>
          <span class="qty-num" id="qtyN">1</span>
          <button class="qty-btn" id="qtyI">+</button>
        </div>
      </div>
      <button class="btn btn--primary w-full" id="addBtn" style="padding:1.05rem;font-size:.95rem;letter-spacing:1px">🛒 Add to Cart</button>
      <div class="pd-perks">
        <div class="pd-perk"><span class="pd-perk__icon">✓</span>Free shipping on orders over ₹6,500</div>
        <div class="pd-perk"><span class="pd-perk__icon">✓</span>30-day hassle-free return policy</div>
        <div class="pd-perk"><span class="pd-perk__icon">✓</span>Secure checkout — 256-bit SSL encrypted</div>
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
  $('qtyD').onclick = () => { qty = Math.max(1, qty - 1); $('qtyN').textContent = qty; };
  $('qtyI').onclick = () => { qty++; $('qtyN').textContent = qty; };
  $('addBtn').onclick = () => addToCart(p.id, size, color, qty);
}

/* ===== OVERLAYS ===== */
function openCart() { $('cartSidebar').classList.add('open'); $('cartBackdrop').classList.add('open'); document.body.style.overflow = 'hidden'; renderCart(); }
function closeCart() { $('cartSidebar').classList.remove('open'); $('cartBackdrop').classList.remove('open'); document.body.style.overflow = ''; }
function openSearch() { $('searchOverlay').classList.add('open'); $('searchInput').value = ''; $('searchResults').innerHTML = ''; document.body.style.overflow = 'hidden'; setTimeout(() => $('searchInput').focus(), 50); }
function closeSearch() { $('searchOverlay').classList.remove('open'); document.body.style.overflow = ''; }
function openModal(tab) { $('loginModal').classList.add('open'); document.body.style.overflow = 'hidden'; switchTab(tab || 'login'); }
function closeModal() { $('loginModal').classList.remove('open'); document.body.style.overflow = ''; clearErrors(); }
function closeMobileNav() { $('hamburger').classList.remove('open'); $('mobileNav').classList.remove('open'); }

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

/* ===== AUTH HANDLERS ===== */
function handleLogin() {
  const email = $('loginEmail').value.trim(), pass = $('loginPassword').value;
  let ok = true;
  if (!validEmail(email)) { showErr('loginEmailErr'); ok = false; } else hideErr('loginEmailErr');
  if (pass.length < 6) { showErr('loginPassErr','Password must be at least 6 characters'); ok = false; } else hideErr('loginPassErr');
  if (!ok) return;
  const accounts = JSON.parse(localStorage.getItem('ff-accounts') || '[]');
  const found = accounts.find(a => a.email === email && a.pass === pass);
  if (!found) { showErr('loginPassErr','Invalid email or password'); return; }
  user = {name: found.name, email: found.email};
  localStorage.setItem('ff-user', JSON.stringify(user));
  updateLoginUI(); closeModal();
  toast('🎉 Welcome back, ' + user.name.split(' ')[0] + '!', 'success');
}

function handleSignup() {
  const name = $('signupName').value.trim(), email = $('signupEmail').value.trim(), pass = $('signupPassword').value;
  let ok = true;
  if (!name) { showErr('signupNameErr'); ok = false; } else hideErr('signupNameErr');
  if (!validEmail(email)) { showErr('signupEmailErr','Please enter a valid email'); ok = false; } else hideErr('signupEmailErr');
  if (pass.length < 6) { showErr('signupPassErr'); ok = false; } else hideErr('signupPassErr');
  if (!ok) return;
  const accounts = JSON.parse(localStorage.getItem('ff-accounts') || '[]');
  if (accounts.find(a => a.email === email)) { showErr('signupEmailErr','An account with this email already exists'); return; }
  accounts.push({name, email, pass});
  localStorage.setItem('ff-accounts', JSON.stringify(accounts));
  user = {name, email};
  localStorage.setItem('ff-user', JSON.stringify(user));
  updateLoginUI(); closeModal();
  toast('🎉 Welcome to FuelFit, ' + name.split(' ')[0] + '!', 'success');
}

function handleLogout() { user = null; localStorage.removeItem('ff-user'); updateLoginUI(); toast('👋 Logged out successfully'); }

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
function handleSearch(q) {
  const r = $('searchResults');
  if (!q.trim()) { r.innerHTML = ''; return; }
  const matches = PRODUCTS.filter(p => [p.name, p.description, p.category].some(s => s.toLowerCase().includes(q.toLowerCase()))).slice(0, 5);
  r.innerHTML = matches.length
    ? matches.map(p => `<div class="search-result-item" data-id="${p.id}"><img src="${p.image}" alt="${p.name}"/><span>${p.name}</span><strong>${inr(p.price)}</strong></div>`).join('')
    : `<p style="color:rgba(255,255,255,.35);text-align:center;padding:1.5rem;font-size:.9rem">No results for "${q}"</p>`;
  r.querySelectorAll('.search-result-item').forEach(item => {
    item.onclick = () => { closeSearch(); showProduct(item.dataset.id); };
  });
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  renderGrid('featuredGrid', PRODUCTS.filter(p => p.featured).slice(0, 6));
  updateCartBadge();
  updateLoginUI();

  // Navigation delegation
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
  $('hamburger').onclick = () => { $('hamburger').classList.toggle('open'); $('mobileNav').classList.toggle('open'); };

  // Modal
  $('modalClose').onclick = closeModal;
  $('loginModal').onclick = e => { if (e.target === $('loginModal')) closeModal(); };
  $('tabLogin').onclick = () => switchTab('login');
  $('tabSignup').onclick = () => switchTab('signup');
  $('switchToSignup').onclick = () => switchTab('signup');
  $('switchToLogin').onclick = () => switchTab('login');
  $('loginSubmitBtn').onclick = handleLogin;
  $('signupSubmitBtn').onclick = handleSignup;
  $('loginPassword').onkeydown = e => e.key === 'Enter' && handleLogin();
  $('signupPassword').onkeydown = e => e.key === 'Enter' && handleSignup();

  // Checkout
  $('checkoutBtn').onclick = () => {
    if (!user) { closeCart(); openModal('login'); toast('Please login to proceed to checkout'); }
    else toast('🛍️ Redirecting to checkout...', 'success');
  };

  // Shop
  $('filterChips').onclick = e => { const c = e.target.closest('.chip'); if (c) { activeCategory = prevCat = c.dataset.cat; updateShop(); } };
  $('sortSelect').onchange = e => { sortBy = e.target.value; renderShop(); };
  $('backBtn').onclick = () => navigate(prevCat !== 'all' ? prevCat : 'shop');

  // Newsletter
  $('newsletterForm').onsubmit = e => { e.preventDefault(); $('newsletterMsg').textContent = '🎉 You\'re in! Welcome to the FuelFit movement.'; e.target.reset(); setTimeout(() => $('newsletterMsg').textContent = '', 4500); };

  // Keyboard + scroll
  document.onkeydown = e => { if (e.key === 'Escape') { closeSearch(); closeCart(); closeModal(); } };
  window.onscroll = () => { $('header').style.boxShadow = window.scrollY > 10 ? '0 2px 32px rgba(0,0,0,.7)' : 'none'; };
});