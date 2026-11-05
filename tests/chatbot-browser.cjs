// Browser checks use a local HTTP server and fixture Firebase modules only.
// They never read or write a production Firebase project.
// Run from the checkout: node tests/chatbot-browser.cjs
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const fixtures = {
  products: {
    boot1: { name: 'Crampons Nike Phantom', description: 'Chaussures de football pour terrain sec.', category: 'foot', price: 129, stock: 5, colors: 'Noir, Rouge', sizes: '40, 41, 42', delivery: 'Livraison à confirmer avec la boutique.', images: [], active: true },
    boot2: { name: 'Crampons Adidas Copa', description: 'Chaussures de football confortables.', category: 'foot', price: 89, stock: 3, colors: 'Blanc', sizes: '41, 42', images: [], active: true },
    bootOut: { name: 'Crampons Puma Future', category: 'foot', price: 99, stock: 0, images: [], active: true },
    hidden: { name: 'Crampons secrets', category: 'foot', price: 1, stock: 20, images: [], active: false },
    running: { name: 'Chaussures running Sprint', category: 'run', price: 75, stock: 10, images: [], active: true },
    security: { name: 'Sécurité <img src=x onerror="window.__xss=true">', description: '<svg onload="window.__xss=true">Texte catalogue</svg>', category: 'test', price: 19, stock: 2, images: ['javascript:window.__xss=true'], active: true },
  },
  categories: { foot: { name: 'Football' }, run: { name: 'Running' }, test: { name: 'Sécurité' } },
  settings: {}, posts: {},
};

const appModule = 'export const initializeApp = config => ({config});';
const authModule = `
  const auth = { currentUser: null };
  export const getAuth = () => auth;
  export const onAuthStateChanged = (a, callback) => { queueMicrotask(() => callback(null)); return () => {}; };
  export const signInAnonymously = async () => { throw new Error('Fixture: auth writes are disabled'); };
  export const createUserWithEmailAndPassword = signInAnonymously;
  export const signInWithEmailAndPassword = signInAnonymously;
  export const signOut = async () => {};
  export const updateProfile = signInAnonymously;
  export const linkWithCredential = signInAnonymously;
  export const EmailAuthProvider = {credential: () => ({})};
`;
const databaseModule = `
  const listeners = new Map();
  export const getDatabase = () => ({});
  export const ref = (db, path) => ({path});
  const snapshot = path => ({val: () => window.__catalogData[path] ?? null});
  export const onValue = (ref, callback) => {
    const callbacks = listeners.get(ref.path) || [];
    callbacks.push(callback); listeners.set(ref.path, callbacks);
    queueMicrotask(() => callback(snapshot(ref.path)));
    return () => {};
  };
  window.__catalogEmit = (path, value) => {
    window.__catalogData[path] = value;
    for (const callback of listeners.get(path) || []) callback(snapshot(path));
  };
  export const push = () => ({key: 'fixture-not-submitted'});
  export const set = async () => { window.__fixtureWrites++; throw new Error('Production-like writes are forbidden in these tests'); };
  export const get = async ref => snapshot(ref.path);
  export const query = ref => ref;
  export const orderByChild = value => value;
  export const equalTo = value => value;
`;

async function makeContext(browser, baseURL, { offline = false, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 } });
  await context.addInitScript(data => {
    window.__catalogData = data;
    window.__fixtureWrites = 0;
    window.__xss = false;
  }, fixtures);
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(baseURL + '/')) return route.continue();
    if (!offline && url.startsWith('https://www.gstatic.com/firebasejs/')) {
      let body;
      if (url.endsWith('/firebase-app.js')) body = appModule;
      else if (url.endsWith('/firebase-auth.js')) body = authModule;
      else if (url.endsWith('/firebase-database.js')) body = databaseModule;
      if (body) return route.fulfill({ status: 200, contentType: 'text/javascript', body, headers: { 'access-control-allow-origin': '*' } });
    }
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL + '/index.html');
  await page.locator('#chatLauncher').waitFor();
  if (!offline) await page.waitForFunction(() => typeof window.__catalogEmit === 'function' && document.querySelector('#products').textContent.includes('Crampons Nike'));
  return { context, page, errors };
}

async function openChat(page) {
  if (!await page.locator('#chatPanel').isVisible()) await page.locator('#chatLauncher').click();
  await page.locator('#chatInput').waitFor();
}

async function ask(page, message) {
  await openChat(page);
  const previous = await page.locator('#chatMessages').innerText();
  await page.locator('#chatInput').fill(message);
  await page.locator('#chatInput').press('Enter');
  await page.waitForFunction(previous => document.querySelector('#chatMessages').innerText !== previous, previous);
  return page.locator('#chatMessages').innerText();
}

async function main() {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const body = await fs.readFile(file);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let passed = 0;
  const check = async (label, run) => { await run(); passed++; console.log(`PASS ${label}`); };
  try {
    const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, args: ['--no-sandbox'] });
    const desktop = await makeContext(browser, baseURL);
    const { page } = desktop;
    await check('catalog search uses fixture products and prices, excluding hidden items', async () => {
      const text = await ask(page, 'crapon');
      assert.match(text, /Nike Phantom/);
      assert.match(text, /129[.,]00\s*DT/);
      assert.match(text, /Adidas Copa/);
      assert.doesNotMatch(text, /Crampons secrets/);
      assert.doesNotMatch(await page.locator('.chat-message-assistant').last().locator('.chat-message-text').innerText(), /Puma Future/);
      assert.equal(await page.locator('#chatMessages [data-chat-product="running"]').count(), 0);
      const out = page.locator('#chatMessages [data-chat-card="bootOut"]');
      if (await out.count()) assert.match(await out.last().innerText(), /indisponible|rupture|épuisé/i);
    });
    await check('product recommendation opens existing variant picker and adds to cart', async () => {
      await page.locator('#chatMessages [data-chat-product="boot1"]').last().click();
      assert.equal(await page.locator('#chatPanel').isVisible(), false);
      assert.equal(await page.evaluate(() => document.querySelector('#modalBg .modal').contains(document.activeElement)), true);
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Crampons Nike Phantom');
      await page.locator('#size').selectOption('42');
      await page.locator('#color').selectOption('Rouge');
      await page.locator('#add').click();
      assert.equal(await page.locator('#cartCount').innerText(), '1');
      const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('sportifano_cart')));
      assert.deepEqual(cart, [{ id: 'boot1', qty: 1, color: 'Rouge', size: '42' }]);
    });
    await check('ordering guidance reaches cart and existing checkout without submitting', async () => {
      const text = await ask(page, 'Comment commander ?');
      assert.match(text, /panier/i);
      assert.match(text, /livraison/i);
      await page.locator('#chatMessages [data-chat-action="cart"]').last().click();
      assert.equal(await page.evaluate(() => document.querySelector('#modalBg .modal').contains(document.activeElement)), true);
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Mon panier');
      await page.locator('#checkout').click();
      assert.equal(await page.locator('#orderForm').isVisible(), true);
      assert.match(await page.locator('#orderForm').innerText(), /Paiement à la livraison/);
      assert.equal(await page.evaluate(() => window.__fixtureWrites), 0);
      await page.locator('#close').click();
    });
    await check('cheaper follow-up offers a lower-priced product from the same category', async () => {
      await ask(page, 'Nike Phantom');
      const lastReply = page.locator('.chat-message-assistant').last();
      assert.equal(await lastReply.locator('[data-chat-product="boot1"]').count(), 1);
      await lastReply.locator('[data-chat-action="cheaper"]').click();
      const cheaper = page.locator('.chat-message-assistant').last();
      assert.match(await cheaper.innerText(), /Adidas Copa/);
      assert.match(await cheaper.innerText(), /89[.,]00\s*DT/);
      assert.equal(await cheaper.locator('[data-chat-product="boot1"]').count(), 0);
      assert.equal(await cheaper.locator('[data-chat-product="running"]').count(), 0);
      assert.equal(await cheaper.locator('[data-chat-product="bootOut"]').count(), 0);
    });
    await check('catalog text is rendered safely as text', async () => {
      const text = await ask(page, 'securite');
      assert.match(text, /<img src=x onerror=/);
      assert.equal(await page.locator('#chatMessages img[src="x"]').count(), 0);
      assert.equal(await page.evaluate(() => window.__xss), false);
      assert.equal(await page.locator('#chatMessages img[src^="javascript:"]').count(), 0);
    });
    await check('live catalog refresh preserves open details and keyboard focus, updates price and removes hidden items', async () => {
      await ask(page, 'crapon');
      const lastCard = page.locator('#chatMessages [data-chat-card="boot1"]').last();
      await lastCard.locator('summary').click();
      await lastCard.locator('[data-chat-product="boot1"]').focus();
      assert.equal(await lastCard.locator('details').getAttribute('open'), '');
      await page.evaluate(() => {
        const next = { ...window.__catalogData.products, boot1: { ...window.__catalogData.products.boot1, price: 119 } };
        window.__catalogEmit('products', next);
      });
      await page.waitForFunction(() => document.querySelector('#chatMessages').textContent.includes('119.00') || document.querySelector('#chatMessages').textContent.includes('119,00'));
      assert.equal(await lastCard.locator('details').getAttribute('open'), '');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.chatProduct), 'boot1');
      await page.evaluate(() => window.__catalogEmit('products', { ...window.__catalogData.products, boot1: { ...window.__catalogData.products.boot1, active: false } }));
      assert.equal(await page.locator('#chatMessages [data-chat-product="boot1"]').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'chatInput');
      assert.deepEqual(desktop.errors, []);
    });
    await desktop.context.close();

    const mobile = await makeContext(browser, baseURL, { mobile: true });
    await check('mobile layout fits viewport and Escape restores launcher focus', async () => {
      await ask(mobile.page, 'crapon');
      const bounds = await mobile.page.locator('#chatPanel').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 391 && bounds.y + bounds.height <= 845, JSON.stringify(bounds));
      const noOverflow = await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      assert.equal(noOverflow, true);
      await mobile.page.screenshot({ path: '/tmp/sportifano-chatbot-mobile.png' });
      await mobile.page.locator('#chatInput').press('Escape');
      assert.equal(await mobile.page.locator('#chatPanel').isVisible(), false);
      assert.equal(await mobile.page.evaluate(() => document.activeElement.id), 'chatLauncher');
      assert.deepEqual(mobile.errors, []);
    });
    await mobile.context.close();

    const offline = await makeContext(browser, baseURL, { offline: true });
    await check('assistant remains useful when Firebase SDK cannot load', async () => {
      const help = await ask(offline.page, 'Comment commander ?');
      assert.match(help, /panier/i);
      await ask(offline.page, 'crapon');
      await offline.page.waitForTimeout(13000);
      const text = await ask(offline.page, 'crapon');
      assert.match(text, /consulter le catalogue|indisponible|chargement|connexion|réessay/i);
      assert.match(text, /ne peux.*confirmer|inaccessible|indisponible/i);
      assert.equal(await offline.page.locator('#chatMessages [data-chat-product]').count(), 0);
      assert.equal(await offline.page.evaluate(() => window.__fixtureWrites), 0);
    });
    await offline.context.close();
    console.log(`${passed} browser checks passed (fixture data only; production Firebase untested).`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
