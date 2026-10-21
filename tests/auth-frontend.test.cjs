const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(responses) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set(id === 'signupFormWrap' ? ['hidden'] : []);
      elements.set(id, { value: '', textContent: '', disabled: false, className: '', style: {},
        setAttribute(name, value) { this[name] = value; },
        classList: { add: x => classes.add(x), remove: x => classes.delete(x),
          contains: x => classes.has(x), toggle: (x, on) => on ? classes.add(x) : classes.delete(x) } });
    }
    return elements.get(id);
  }
  const calls = [];
  const removed = [];
  const context = vm.createContext({
    location: { hostname: '127.0.0.1' }, TextEncoder,
    localStorage: { getItem: () => null, removeItem: key => removed.push(key),
      setItem: () => { throw new Error('Authentication must not write browser storage'); } },
    document: { getElementById: element, querySelectorAll: () => [], addEventListener: () => {}, body: { style: {} } },
    window: {}, setTimeout: () => 1, clearTimeout: () => {},
    fetch: async (url, options) => {
      calls.push({ url, ...JSON.parse(JSON.stringify(options)) });
      if (url.endsWith('/csrf')) return { ok: true, status: 200,
        json: async () => ({ token: 'test-csrf-token', headerName: 'X-CSRF-TOKEN' }) };
      const response = responses.shift();
      assert.ok(response, 'Unexpected API request');
      return { ok: response.status < 400, status: response.status, json: async () => response.body };
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '3rd.js'), 'utf8'), context);
  element('loginEmail').value = element('signupEmail').value = 'athlete@example.test';
  element('signupName').value = 'Test Athlete';
  element('loginPassword').value = element('signupPassword').value = 'TestOnly!234';
  return { context, element, calls, removed, user: () => vm.runInContext('user', context) };
}
const account = { id: 1, name: 'Test Athlete', email: 'athlete@example.test', role: 'CUSTOMER' };

test('password key handler allows typing/editing and intercepts only Enter', () => {
  const app = setup([]);
  let submissions = 0;
  const handler = app.context.onPasswordEnter(() => submissions++);
  for (const key of ['a', 'Z', '1', '!', 'Backspace', 'Delete', 'ArrowLeft', 'Tab']) {
    let prevented = false;
    const result = handler({ key, preventDefault() { prevented = true; } });
    assert.notEqual(result, false, 'Normal keyboard input must not be cancelled');
    assert.equal(prevented, false);
  }
  assert.equal(submissions, 0);
  let prevented = false;
  handler({ key:'Enter', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(submissions, 1);
});

test('login sends CSRF and cookies, restores identity, and clears password', async () => {
  const app = setup([{ status: 200, body: account }]);
  await app.context.handleLogin();
  assert.equal(app.user().email, account.email);
  assert.equal(app.calls[1].url, 'http://127.0.0.1:8080/api/auth/login');
  assert.equal(app.calls[1].credentials, 'include');
  assert.equal(app.calls[1].headers['X-CSRF-TOKEN'], 'test-csrf-token');
  assert.equal(app.element('loginPassword').value, '');
  assert.equal(app.element('loginSubmitBtn').disabled, false);
  assert.equal(app.element('loginBtn')['aria-label'], 'Logout, Test Athlete');
  assert.equal(app.element('mobileLoginBtn')['aria-label'], 'Logout, Test Athlete');
  assert.deepEqual(app.removed, ['ff-user', 'ff-accounts']);
});
test('signup creates account then signs in with a newly fetched CSRF token', async () => {
  const app = setup([{ status: 201, body: account }, { status: 200, body: account }]);
  app.context.switchTab('signup');
  await app.context.handleSignup();
  assert.deepEqual(app.calls.map(c => c.url.split('/').pop()), ['csrf', 'register', 'csrf', 'login']);
  assert.equal(app.user().id, 1);
  assert.equal(app.element('signupPassword').value, '');
});
test('invalid login shows server error and does not invent a local identity', async () => {
  const app = setup([{ status: 401, body: { message: 'Invalid email or password', fields: {} } }]);
  await app.context.handleLogin();
  assert.equal(app.user(), null);
  assert.equal(app.element('loginPassErr').textContent, 'Invalid email or password');
  assert.equal(app.element('loginPassword').value, '');
});
test('duplicate signup stays in signup and shows email error', async () => {
  const app = setup([{ status: 409, body: { message: 'An account with this email already exists', fields: {} } }]);
  app.context.switchTab('signup');
  await app.context.handleSignup();
  assert.equal(app.user(), null);
  assert.match(app.element('signupEmailErr').textContent, /already exists/);
  assert.equal(app.element('loginFormWrap').classList.contains('hidden'), true);
});
test('reload restores identity through the server instead of browser storage', async () => {
  const app = setup([{ status: 200, body: account }]);
  await app.context.restoreSession();
  assert.equal(app.calls[0].url.endsWith('/me'), true);
  assert.equal(app.user().id, 1);
});
test('logout clears UI identity only after the server confirms logout', async () => {
  const app = setup([{ status: 200, body: account }, { status: 204 }]);
  await app.context.restoreSession();
  await app.context.handleLogout();
  assert.equal(app.user(), null);
  assert.equal(app.calls.at(-1).url.endsWith('/logout'), true);
  assert.equal(app.element('loginBtn')['aria-label'], 'Login or sign up');
  assert.equal(app.element('mobileLoginBtn')['aria-label'], 'Login or sign up');
});
test('failed logout keeps identity and shows an error rather than claiming success', async () => {
  const app = setup([{ status: 200, body: account }, { status: 503, body: { message: 'Unavailable' } }]);
  await app.context.restoreSession();
  await app.context.handleLogout();
  assert.equal(app.user().id, 1);
  assert.match(app.element('toast').textContent, /Unable to sign out/);
});
