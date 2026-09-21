const firebaseConfig = {
  apiKey: 'AIzaSyBOkyPe2f1tHu9OQiwHHpgfJTYM-KM7cuU',
  authDomain: 'h4sx-6712c.firebaseapp.com',
  projectId: 'h4sx-6712c',
  databaseURL: 'https://h4sx-6712c-default-rtdb.asia-southeast1.firebasedatabase.app',
  storageBucket: 'h4sx-6712c.firebasestorage.app',
  messagingSenderId: '416803081247',
  appId: '1:416803081247:web:e201174233b953e539992a'
};
const ROOT = 'store';
const GIST = {
  inventory: 'https://gist.githubusercontent.com/amirpoyo1982-a11y/5ed3872290715d7833e788c7b0014f79/raw/inventory.json',
  inventoryFallback: 'https://gist.githubusercontent.com/amirpoyo1982-a11y/9bcbef00866205608fb46fc7a0ef5235/raw/inventory.json',
  games: 'https://gist.githubusercontent.com/amirpoyo1982-a11y/92b41c9122c025c2536e68353a82ee0f/raw/games.json',
  gamesFallback: 'https://gist.githubusercontent.com/amirpoyo1982-a11y/9bcbef00866205608fb46fc7a0ef5235/raw/games.json',
  config: 'https://gist.githubusercontent.com/amirpoyo1982-a11y/5ed3872290715d7833e788c7b0014f79/raw/kedai.json'
};

firebase.initializeApp(firebaseConfig);
if (new URLSearchParams(location.search).get('embedded') === '1') document.body.classList.add('embedded-control');
const auth = firebase.auth();
const database = firebase.database();
let products = [];
let games = [];
let storeConfig = {};
let editorMode = 'product';
let editingKey = null;
let listenersStarted = false;
let toastTimer = null;

const $ = selector => document.querySelector(selector);
const byId = id => document.getElementById(id);
const asArray = value => Array.isArray(value) ? value.filter(Boolean) : (value && typeof value === 'object' ? Object.values(value).filter(Boolean) : []);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
const numberOrBlank = value => value === '' || value === null || value === undefined ? null : Number(value);

function notify(message, bad = false) {
  const el = byId('toast');
  el.textContent = message;
  el.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3300);
}

function setBusy(button, busy, label = '') {
  if (!button) return;
  if (busy) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ' + (label || 'Tunggu...');
  } else {
    button.disabled = false;
    if (button.dataset.original) button.innerHTML = button.dataset.original;
  }
}

function startListeners() {
  if (listenersStarted) return;
  listenersStarted = true;
  database.ref(ROOT + '/inventory').on('value', snapshot => {
    products = asArray(snapshot.val());
    renderProducts();
    byId('product-count').textContent = products.length;
    markSynced();
  }, realtimeError);
  database.ref(ROOT + '/games').on('value', snapshot => {
    games = asArray(snapshot.val());
    renderGames();
    byId('game-count').textContent = games.length;
    markSynced();
  }, realtimeError);
  database.ref(ROOT + '/config').on('value', snapshot => {
    storeConfig = snapshot.val() || {};
    writeConfigEditor();
    markSynced();
  }, realtimeError);
}

function stopListeners() {
  database.ref(ROOT + '/inventory').off();
  database.ref(ROOT + '/games').off();
  database.ref(ROOT + '/config').off();
  listenersStarted = false;
}

function realtimeError(error) {
  byId('sync-status').textContent = 'Sync gagal';
  notify('Firebase: ' + error.message, true);
}

function markSynced() {
  byId('sync-status').textContent = 'Live • ' + new Date().toLocaleTimeString('ms-MY', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}

auth.onAuthStateChanged(user => {
  byId('login-view').hidden = !!user;
  byId('control-view').hidden = !user;
  if (user) startListeners();
  else stopListeners();
});

byId('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  byId('login-error').textContent = '';
  setBusy(button, true, 'Log masuk...');
  try {
    await auth.signInWithEmailAndPassword(byId('login-email').value.trim(), byId('login-password').value);
  } catch (error) {
    byId('login-error').textContent = error.code === 'auth/invalid-credential' ? 'Email atau password tak betul.' : error.message;
  } finally { setBusy(button, false); }
});
byId('logout-btn').addEventListener('click', () => auth.signOut());

document.querySelectorAll('.tabs button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(item => item.classList.toggle('active', item === button));
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === button.dataset.tab));
}));

function renderProducts() {
  const q = byId('product-search').value.trim().toLowerCase();
  const filtered = products.filter(item => [item.id,item.name,item.game,item.gameGroup,item.platform,item.subcategory].join(' ').toLowerCase().includes(q));
  byId('product-list').innerHTML = filtered.length ? filtered.map(item => {
    const index = products.indexOf(item);
    const image = item.poster || item.image || item.img || item.thumbnail || '';
    const media = image && !/\.(mp4|webm|mov)(\?|#|$)/i.test(image)
      ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">'
      : '<span class="item-placeholder"><i class="fa-solid fa-box"></i></span>';
    return '<article class="item-row">' + media + '<div class="item-copy"><strong>' + escapeHtml(item.name || 'Tanpa nama') + '</strong><span>#' + escapeHtml(item.id) + ' • ' + escapeHtml(item.game || item.gameGroup || '-') + ' • <b>RM' + Number(item.price || 0).toFixed(2) + '</b> • Stok ' + escapeHtml(item.stock ?? '-') + '</span></div><div class="row-actions"><button data-action="edit-product" data-index="' + index + '" title="Edit"><i class="fa-solid fa-pen"></i></button><button data-action="duplicate-product" data-index="' + index + '" title="Duplicate"><i class="fa-solid fa-copy"></i></button><button class="danger" data-action="delete-product" data-index="' + index + '" title="Padam"><i class="fa-solid fa-trash"></i></button></div></article>';
  }).join('') : '<div class="empty">Belum ada produk.</div>';
}

function renderGames() {
  const q = byId('game-search').value.trim().toLowerCase();
  const filtered = games.filter(item => [item.name,item.platform,item.badge].join(' ').toLowerCase().includes(q));
  byId('game-list').innerHTML = filtered.length ? filtered.map(item => {
    const index = games.indexOf(item);
    const image = item.poster || item.image || item.img || '';
    const media = image && !/\.(mp4|webm|mov)(\?|#|$)/i.test(image)
      ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">'
      : '<span class="item-placeholder"><i class="fa-solid fa-gamepad"></i></span>';
    return '<article class="item-row">' + media + '<div class="item-copy"><strong>' + escapeHtml(item.name || 'Tanpa nama') + '</strong><span>' + escapeHtml(item.platform || '-') + (item.badge ? ' • ' + escapeHtml(item.badge) : '') + (item.oos ? ' • <b>Soon</b>' : '') + '</span></div><div class="row-actions"><button data-action="edit-game" data-index="' + index + '" title="Edit"><i class="fa-solid fa-pen"></i></button><button data-action="duplicate-game" data-index="' + index + '" title="Duplicate"><i class="fa-solid fa-copy"></i></button><button class="danger" data-action="delete-game" data-index="' + index + '" title="Padam"><i class="fa-solid fa-trash"></i></button></div></article>';
  }).join('') : '<div class="empty">Belum ada game.</div>';
}

byId('product-search').addEventListener('input', renderProducts);
byId('game-search').addEventListener('input', renderGames);
byId('new-product').addEventListener('click', () => openProductEditor());
byId('new-game').addEventListener('click', () => openGameEditor());

document.addEventListener('click', async event => {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const index = Number(actionButton.dataset.index);
  const action = actionButton.dataset.action;
  if (action === 'edit-product') openProductEditor(products[index], index);
  if (action === 'duplicate-product') {
    const copy = JSON.parse(JSON.stringify(products[index]));
    copy.id = nextProductId();
    copy.name = (copy.name || 'Produk') + ' Copy';
    openProductEditor(copy, null);
  }
  if (action === 'delete-product' && confirm('Padam produk "' + (products[index]?.name || '') + '"?')) {
    const next = products.filter((_, i) => i !== index);
    await saveArray('inventory', next, 'Produk dipadam.');
  }
  if (action === 'edit-game') openGameEditor(games[index], index);
  if (action === 'duplicate-game') {
    const copy = JSON.parse(JSON.stringify(games[index]));
    copy.name = (copy.name || 'Game') + ' Copy';
    openGameEditor(copy, null);
  }
  if (action === 'delete-game' && confirm('Padam game "' + (games[index]?.name || '') + '"?')) {
    const next = games.filter((_, i) => i !== index);
    await saveArray('games', next, 'Game dipadam.');
  }
});

function nextProductId() {
  const used = new Set(products.map(item => Number(item.id)).filter(Number.isFinite));
  let id = 1;
  while (used.has(id)) id++;
  return id;
}

function openProductEditor(item = {}, index = null) {
  editorMode = 'product'; editingKey = index;
  byId('editor-kicker').textContent = index === null ? 'PRODUK BARU' : 'EDIT PRODUK';
  byId('editor-title').textContent = item.name || 'Produk baru';
  byId('product-fields').hidden = false; byId('game-fields').hidden = true;
  byId('p-id').value = item.id ?? nextProductId(); byId('p-name').value = item.name || '';
  byId('p-game').value = item.game || item.gameGroup || ''; byId('p-platform').value = item.platform || '';
  byId('p-subcategory').value = item.subcategory || ''; byId('p-badge').value = item.promoLabel || item.badge || '';
  byId('p-price').value = item.price ?? ''; byId('p-original-price').value = item.originalPrice ?? '';
  byId('p-stock').value = item.stock ?? ''; byId('p-sold').value = item.sold ?? '';
  byId('p-img').value = item.img || item.image || item.video || ''; byId('p-desc').value = item.desc || item.description || '';
  const known = ['id','name','game','gameGroup','platform','subcategory','promoLabel','badge','price','originalPrice','stock','sold','img','image','video','desc','description'];
  byId('extra-json').value = JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => !known.includes(key))), null, 2);
  byId('editor-modal').hidden = false;
}

function openGameEditor(item = {}, index = null) {
  editorMode = 'game'; editingKey = index;
  byId('editor-kicker').textContent = index === null ? 'GAME BARU' : 'EDIT GAME';
  byId('editor-title').textContent = item.name || 'Game baru';
  byId('product-fields').hidden = true; byId('game-fields').hidden = false;
  byId('g-name').value = item.name || ''; byId('g-platform').value = item.platform || '';
  byId('g-badge').value = item.badge || item.badgeTitle || ''; byId('g-oos').checked = item.oos === true;
  byId('g-img').value = item.img || item.image || item.video || '';
  const known = ['name','platform','badge','badgeTitle','oos','img','image','video'];
  byId('extra-json').value = JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => !known.includes(key))), null, 2);
  byId('editor-modal').hidden = false;
}

function closeEditor() { byId('editor-modal').hidden = true; editingKey = null; }
byId('editor-close').addEventListener('click', closeEditor);
byId('editor-cancel').addEventListener('click', closeEditor);
byId('editor-modal').addEventListener('click', event => { if (event.target === byId('editor-modal')) closeEditor(); });

byId('editor-form').addEventListener('submit', async event => {
  event.preventDefault();
  let extra;
  try { extra = JSON.parse(byId('extra-json').value || '{}'); }
  catch (error) { notify('Field tambahan bukan JSON yang sah.', true); return; }
  if (!extra || Array.isArray(extra) || typeof extra !== 'object') { notify('Field tambahan mesti object JSON.', true); return; }
  const button = event.submitter;
  setBusy(button, true, 'Menyimpan...');
  try {
    if (editorMode === 'product') {
      const rawId = byId('p-id').value.trim();
      const id = /^\d+$/.test(rawId) ? Number(rawId) : rawId;
      const duplicate = products.some((item, index) => index !== editingKey && String(item.id) === String(id));
      if (duplicate) throw new Error('ID produk sudah digunakan.');
      const item = compact({ ...extra, id, name:byId('p-name').value.trim(), game:byId('p-game').value.trim(), platform:byId('p-platform').value.trim(), subcategory:byId('p-subcategory').value.trim(), price:numberOrBlank(byId('p-price').value), originalPrice:numberOrBlank(byId('p-original-price').value), stock:numberOrBlank(byId('p-stock').value), sold:numberOrBlank(byId('p-sold').value), promoLabel:byId('p-badge').value.trim(), img:byId('p-img').value.trim(), desc:byId('p-desc').value.trim(), updatedAt:new Date().toISOString() });
      const next = [...products];
      if (editingKey === null) next.push(item); else next[editingKey] = item;
      await saveArray('inventory', next, 'Produk disimpan realtime.');
    } else {
      const name = byId('g-name').value.trim();
      const duplicate = games.some((item, index) => index !== editingKey && String(item.name).toLowerCase() === name.toLowerCase());
      if (duplicate) throw new Error('Nama game sudah digunakan.');
      const item = compact({ ...extra, name, platform:byId('g-platform').value.trim(), badge:byId('g-badge').value.trim(), oos:byId('g-oos').checked, img:byId('g-img').value.trim(), updatedAt:new Date().toISOString() });
      const next = [...games];
      if (editingKey === null) next.push(item); else next[editingKey] = item;
      await saveArray('games', next, 'Game disimpan realtime.');
    }
    closeEditor();
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

async function saveArray(path, value, message) {
  await database.ref(ROOT + '/' + path).set(value);
  await database.ref(ROOT + '/meta').update({updatedAt:firebase.database.ServerValue.TIMESTAMP, updatedBy:auth.currentUser?.email || 'admin'});
  notify(message);
}

function writeConfigEditor() {
  byId('config-editor').value = JSON.stringify(storeConfig, null, 2);
  byId('quick-open').checked = storeConfig.bukakedai !== false && String(storeConfig.bukakedai).toLowerCase() !== 'false';
  byId('quick-maintenance').checked = storeConfig.maintenance === true || String(storeConfig.maintenance).toLowerCase() === 'true';
  byId('quick-review-maintenance').checked = storeConfig.review_maintenance === true || String(storeConfig.review_maintenance).toLowerCase() === 'true';
  byId('quick-banner').checked = storeConfig.promo_banner_active === true || String(storeConfig.promo_banner_active).toLowerCase() === 'true';
}

['quick-open','quick-maintenance','quick-review-maintenance','quick-banner'].forEach(id => byId(id).addEventListener('change', () => {
  try {
    const current = JSON.parse(byId('config-editor').value || '{}');
    current.bukakedai = byId('quick-open').checked;
    current.maintenance = byId('quick-maintenance').checked;
    current.review_maintenance = byId('quick-review-maintenance').checked;
    current.promo_banner_active = byId('quick-banner').checked;
    byId('config-editor').value = JSON.stringify(current, null, 2);
  } catch (error) { notify('Betulkan JSON dahulu sebelum guna quick toggle.', true); }
}));

byId('save-config').addEventListener('click', async event => {
  let value;
  try { value = JSON.parse(byId('config-editor').value || '{}'); }
  catch (error) { notify('JSON tetapan tidak sah: ' + error.message, true); return; }
  if (!value || Array.isArray(value) || typeof value !== 'object') { notify('Tetapan mesti object JSON.', true); return; }
  setBusy(event.currentTarget, true, 'Menyimpan...');
  try {
    await database.ref(ROOT + '/config').set(value);
    await database.ref(ROOT + '/meta').update({updatedAt:firebase.database.ServerValue.TIMESTAMP, updatedBy:auth.currentUser?.email || 'admin'});
    notify('Tetapan kedai disimpan realtime.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(event.currentTarget, false); }
});

async function fetchJson(url) {
  const response = await fetch(url + '?t=' + Date.now(), {cache:'no-store'});
  if (!response.ok) throw new Error('Gagal baca ' + url + ' (' + response.status + ')');
  return response.json();
}

function normalizeInventory(data) {
  if (Array.isArray(data)) return data[0]?.storeConfig ? data.slice(1) : data;
  return Array.isArray(data?.inventory) ? data.inventory : asArray(data);
}
function normalizeGames(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.games) ? data.games : (Array.isArray(data?.value) ? data.value : asArray(data));
}
function normalizeConfig(data) {
  if (Array.isArray(data)) {
    const found = data.find(item => item && typeof item === 'object' && (item.storeConfig || item.maintenance !== undefined || item.bukakedai !== undefined));
    return found?.storeConfig ? {...found.storeConfig, ...found} : (found || {});
  }
  return data?.storeConfig ? {...data.storeConfig, ...data} : (data || {});
}

function mergeConfig(base, override) {
  const output = {...(base || {}), ...(override || {})};
  ['payment','checkout','warnBox','announcement'].forEach(key => {
    if ((base && base[key]) || (override && override[key])) output[key] = {...(base?.[key] || {}), ...(override?.[key] || {})};
  });
  if (base?.payment?.duitNow || override?.payment?.duitNow) output.payment.duitNow = {...(base?.payment?.duitNow || {}), ...(override?.payment?.duitNow || {})};
  if (base?.payment?.tng || override?.payment?.tng) output.payment.tng = {...(base?.payment?.tng || {}), ...(override?.payment?.tng || {})};
  return output;
}

byId('import-gist').addEventListener('click', async event => {
  if (!confirm('Import akan menggantikan data Firebase store sekarang dengan data Gist. Teruskan?')) return;
  setBusy(event.currentTarget, true, 'Mengimport...');
  try {
    let inventoryRaw;
    try { inventoryRaw = await fetchJson(GIST.inventory); } catch (error) { inventoryRaw = await fetchJson(GIST.inventoryFallback); }
    const configRaw = await fetchJson(GIST.config);
    let gamesRaw;
    try { gamesRaw = await fetchJson(GIST.games); } catch (error) { gamesRaw = await fetchJson(GIST.gamesFallback); }
    const payload = {
      inventory: normalizeInventory(inventoryRaw),
      games: normalizeGames(gamesRaw),
      config: mergeConfig(Array.isArray(inventoryRaw) ? inventoryRaw[0]?.storeConfig : inventoryRaw?.storeConfig, normalizeConfig(configRaw)),
      meta: {migratedAt:firebase.database.ServerValue.TIMESTAMP, updatedAt:firebase.database.ServerValue.TIMESTAMP, updatedBy:auth.currentUser?.email || 'admin', source:'GitHub Gist migration'}
    };
    if (!payload.inventory.length || !payload.games.length) throw new Error('Gist inventory/game kosong; import dibatalkan.');
    await database.ref(ROOT).set(payload);
    notify('Import siap. Website sekarang baca Firebase realtime.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(event.currentTarget, false); }
});

byId('download-backup').addEventListener('click', async event => {
  setBusy(event.currentTarget, true, 'Menyiapkan...');
  try {
    const snapshot = await database.ref(ROOT).once('value');
    const blob = new Blob([JSON.stringify(snapshot.val() || {}, null, 2)], {type:'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'h4sx-firebase-backup-' + new Date().toISOString().slice(0,10) + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    notify('Backup dimuat turun.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(event.currentTarget, false); }
});

byId('restore-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file || !confirm('Restore akan menggantikan semua data store di Firebase. Teruskan?')) { event.target.value = ''; return; }
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !data.inventory || !data.games || !data.config) throw new Error('Format backup tidak lengkap.');
    await database.ref(ROOT).set(data);
    notify('Backup berjaya dipulihkan.');
  } catch (error) { notify(error.message, true); }
  event.target.value = '';
});
