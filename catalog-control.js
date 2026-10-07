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
const IMGBB_KEY_STORAGE = 'h4sx_imgbb_api_key';
const DRAFT_STORAGE_KEY = 'h4sx_catalog_drafts_v1';
const UNDO_STORAGE_KEY = 'h4sx_catalog_undo_v1';
const UNDO_LIMIT = 8;
const OPERATION_TIMEOUT_MS = 20000;
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
const requestedCatalogTab = new URLSearchParams(location.search).get('tab') || 'products';
let products = [];
let games = [];
let storeConfig = {};
let customerOrders = [];
let customerOrderClaims = {};
let customerOrderPrivate = {};
let customerOrderDeliveryCache = {};
let leaderboardConfig = { active:false, title:'Top Pelanggan H4SX', subtitle:'Terima kasih kepada pelanggan yang terus menyokong H4SX STORE.', defaultPeriod:'daily' };
let leaderboardEntries = [];
let leaderboardAdminPeriod = 'daily';
let knownCustomerOrderIds = new Set();
let customerOrdersReady = false;
let orderQrFile = null;
let editorMode = 'product';
let editingKey = null;
let listenersStarted = false;
let toastTimer = null;
let productImageFile = null;
let gameImageFile = null;
let editingPromoCode = '';
let activeDraftId = '';
let undoInProgress = false;

const $ = selector => document.querySelector(selector);
const byId = id => document.getElementById(id);
const asArray = value => Array.isArray(value) ? value.filter(Boolean) : (value && typeof value === 'object' ? Object.values(value).filter(Boolean) : []);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
const numberOrBlank = value => value === '' || value === null || value === undefined ? null : Number(value);
const deepClone = value => value === undefined ? null : JSON.parse(JSON.stringify(value));

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
    if (button.dataset.busy !== 'true') button.dataset.original = button.innerHTML;
    button.dataset.busy = 'true';
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ' + (label || 'Tunggu...');
  } else {
    button.disabled = false;
    if (button.dataset.original) button.innerHTML = button.dataset.original;
    delete button.dataset.busy;
    button.removeAttribute('aria-busy');
  }
}

function withTimeout(operation, label = 'Operasi', timeout = OPERATION_TIMEOUT_MS) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' mengambil masa terlalu lama. Semak internet dan cuba semula.')), timeout);
  });
  return Promise.race([Promise.resolve(operation), timeoutPromise]).finally(() => clearTimeout(timer));
}

async function fetchWithTimeout(url, options = {}, timeout = OPERATION_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {...options, signal:controller.signal});
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Sambungan mengambil masa terlalu lama. Semak internet dan cuba semula.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function storeMetaUpdates() {
  return {
    'meta/updatedAt': firebase.database.ServerValue.TIMESTAMP,
    'meta/updatedBy': auth.currentUser?.email || 'admin'
  };
}

function readStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) { return []; }
}

function writeStoredList(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (key === UNDO_STORAGE_KEY && value.length > 2) localStorage.setItem(key, JSON.stringify(value.slice(-2)));
    else throw error;
  }
}

function updateUndoButton() {
  const button = byId('undo-last');
  if (!button) return;
  const history = readStoredList(UNDO_STORAGE_KEY);
  const latest = history.at(-1);
  button.disabled = !latest || undoInProgress;
  button.title = latest ? 'Batalkan: ' + latest.label : 'Tiada perubahan untuk dibatalkan';
  const label = button.querySelector('span');
  if (label) label.textContent = latest ? 'Undo: ' + latest.label : 'Undo';
}

function rememberUndo(path, before, label) {
  const history = readStoredList(UNDO_STORAGE_KEY);
  history.push({ id:Date.now() + '-' + Math.random().toString(36).slice(2, 7), path, before:deepClone(before), label, createdAt:new Date().toISOString() });
  try { writeStoredList(UNDO_STORAGE_KEY, history.slice(-UNDO_LIMIT)); }
  catch (error) { console.warn('Undo history tidak dapat disimpan pada browser.', error); }
  updateUndoButton();
}

async function undoLastChange() {
  const history = readStoredList(UNDO_STORAGE_KEY);
  const entry = history.at(-1);
  if (!entry || undoInProgress) return notify('Tiada perubahan untuk Undo.', true);
  if (!confirm('Batalkan perubahan terakhir: "' + entry.label + '"?')) return;
  const button = byId('undo-last');
  undoInProgress = true;
  setBusy(button, true, 'Undo...');
  try {
    if (entry.path === '') {
      await withTimeout(database.ref(ROOT).set(entry.before || {}), 'Undo Firebase', 35000);
    } else {
      const updates = {...storeMetaUpdates(), [entry.path]:entry.before};
      await withTimeout(database.ref(ROOT).update(updates), 'Undo Firebase');
    }
    history.pop();
    writeStoredList(UNDO_STORAGE_KEY, history);
    notify('Undo siap: ' + entry.label);
  } catch (error) { notify(error.message, true); }
  finally {
    undoInProgress = false;
    setBusy(button, false);
    updateUndoButton();
  }
}

async function saveStorePath(path, value, message, undoLabel = message || ('Ubah ' + path)) {
  if (!auth.currentUser) throw new Error('Sesi admin sudah tamat. Log masuk semula.');
  const before = (await withTimeout(database.ref(ROOT + '/' + path).once('value'), 'Sediakan Undo')).val();
  const updates = {...storeMetaUpdates(), [path]:value};
  await withTimeout(database.ref(ROOT).update(updates), 'Simpan Firebase');
  rememberUndo(path, before, undoLabel.replace(/[.!]+$/, ''));
  if (message) notify(message);
}

async function replaceStoreRoot(value, label, message) {
  if (!auth.currentUser) throw new Error('Sesi admin sudah tamat. Log masuk semula.');
  const before = (await withTimeout(database.ref(ROOT).once('value'), 'Sediakan Undo')).val() || {};
  await withTimeout(database.ref(ROOT).set(value), label, 35000);
  rememberUndo('', before, label);
  if (message) notify(message);
}

function startListeners() {
  if (listenersStarted) return;
  listenersStarted = true;
  database.ref(ROOT + '/inventory').on('value', snapshot => {
    products = asArray(snapshot.val());
    renderProducts();
    renderPromos();
    byId('product-count').textContent = products.length;
    markSynced();
  }, realtimeError);
  database.ref(ROOT + '/games').on('value', snapshot => {
    games = asArray(snapshot.val());
    renderGames();
    refreshClassificationOptions();
    byId('game-count').textContent = games.length;
    markSynced();
  }, realtimeError);
  database.ref(ROOT + '/config').on('value', snapshot => {
    storeConfig = snapshot.val() || {};
    writeConfigEditor();
    markSynced();
  }, realtimeError);
  database.ref(ROOT + '/config/customerLeaderboard').on('value', snapshot => {
    const value = snapshot.val() || {};
    leaderboardConfig = { ...leaderboardConfig, ...(value.config || {}) };
    leaderboardEntries = Object.entries(value.entries || {}).map(([id, entry]) => ({ id, ...(entry || {}) }));
    renderLeaderboardAdmin();
    markSynced();
  }, realtimeError);
  database.ref(ROOT + '/customer_orders').on('value', snapshot => {
    const value = snapshot.val() || {};
    const nextOrders = Object.entries(value).map(([key, order]) => ({...(order || {}), id:order?.id || key}));
    const nextIds = new Set(nextOrders.map(order => String(order.id)));
    const newOrders = customerOrdersReady ? nextOrders.filter(order => !knownCustomerOrderIds.has(String(order.id))) : [];
    customerOrders = nextOrders;
    knownCustomerOrderIds = nextIds;
    if (!customerOrdersReady) customerOrdersReady = true;
    renderCustomerOrders();
    markSynced();
    if (newOrders.length) announceNewCustomerOrders(newOrders);
  }, realtimeError);
  database.ref(ROOT + '/customer_payment_claims').on('value', snapshot => {
    customerOrderClaims = snapshot.val() || {};
    renderCustomerOrders();
  }, realtimeError);
  database.ref('customer_order_private').on('value', snapshot => {
    customerOrderPrivate = snapshot.val() || {};
    renderCustomerOrders();
  }, realtimeError);
}

function stopListeners() {
  database.ref(ROOT + '/inventory').off();
  database.ref(ROOT + '/games').off();
  database.ref(ROOT + '/config').off();
  database.ref(ROOT + '/config/customerLeaderboard').off();
  database.ref(ROOT + '/customer_orders').off();
  database.ref(ROOT + '/customer_payment_claims').off();
  database.ref('customer_order_private').off();
  listenersStarted = false;
  customerOrdersReady = false;
  knownCustomerOrderIds = new Set();
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
  if (user) {
    startListeners();
    renderDrafts();
    updateUndoButton();
    requestAnimationFrame(() => activateCatalogTab(requestedCatalogTab));
  }
  else stopListeners();
});

byId('undo-last').addEventListener('click', undoLastChange);

byId('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  byId('login-error').textContent = '';
  setBusy(button, true, 'Log masuk...');
  try {
    await withTimeout(auth.signInWithEmailAndPassword(byId('login-email').value.trim(), byId('login-password').value), 'Log masuk Firebase');
  } catch (error) {
    byId('login-error').textContent = error.code === 'auth/invalid-credential' ? 'Email atau password tak betul.' : error.message;
  } finally { setBusy(button, false); }
});
byId('logout-btn').addEventListener('click', () => auth.signOut());

try { byId('imgbb-api-key').value = localStorage.getItem(IMGBB_KEY_STORAGE) || ''; } catch (error) {}
byId('save-imgbb-key').addEventListener('click', () => {
  const key = byId('imgbb-api-key').value.trim();
  if (!key) return notify('Masukkan API key ImgBB dahulu.', true);
  try { localStorage.setItem(IMGBB_KEY_STORAGE, key); }
  catch (error) { return notify('Browser gagal menyimpan API key.', true); }
  notify('API key ImgBB disimpan dalam browser ini.');
});
byId('toggle-imgbb-key').addEventListener('click', event => {
  const input = byId('imgbb-api-key');
  input.type = input.type === 'password' ? 'text' : 'password';
  event.currentTarget.querySelector('i').className = input.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
});

function setImagePreview(kind, file = null, url = '') {
  const preview = byId(kind === 'product' ? 'p-image-preview' : 'g-image-preview');
  if (!preview) return;
  if (file) {
    const objectUrl = URL.createObjectURL(file);
    preview.innerHTML = '<img src="' + objectUrl + '" alt="Preview upload">';
    preview.querySelector('img').addEventListener('load', () => URL.revokeObjectURL(objectUrl), {once:true});
    return;
  }
  if (url) {
    preview.innerHTML = '<img src="' + escapeHtml(url) + '" alt="Preview gambar">';
    return;
  }
  preview.innerHTML = '<i class="fa-solid fa-image"></i><span>' + (kind === 'product' ? 'Pilih gambar produk' : 'Pilih cover game') + '</span>';
}

function selectUploadFile(kind, file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return notify('Sila pilih fail gambar.', true);
  if (file.size > 32 * 1024 * 1024) return notify('Gambar melebihi had 32MB ImgBB.', true);
  if (kind === 'product') productImageFile = file; else gameImageFile = file;
  setImagePreview(kind, file);
  byId(kind === 'product' ? 'p-upload-status' : 'g-upload-status').textContent = file.name + ' • ' + (file.size / 1024 / 1024).toFixed(2) + 'MB';
}

byId('p-image-preview').addEventListener('click', () => byId('p-image-file').click());
byId('g-image-preview').addEventListener('click', () => byId('g-image-file').click());
byId('p-image-file').addEventListener('change', event => selectUploadFile('product', event.target.files?.[0]));
byId('g-image-file').addEventListener('change', event => selectUploadFile('game', event.target.files?.[0]));
byId('p-img').addEventListener('change', event => setImagePreview('product', null, event.target.value.trim()));
byId('g-img').addEventListener('change', event => setImagePreview('game', null, event.target.value.trim()));
byId('p-upload-imgbb').addEventListener('click', event => uploadImgBB('product', event.currentTarget));
byId('g-upload-imgbb').addEventListener('click', event => uploadImgBB('game', event.currentTarget));

function clearEditorImage(kind) {
  const isProduct = kind === 'product';
  if (isProduct) productImageFile = null; else gameImageFile = null;
  byId(isProduct ? 'p-image-file' : 'g-image-file').value = '';
  byId(isProduct ? 'p-img' : 'g-img').value = '';
  byId(isProduct ? 'p-upload-status' : 'g-upload-status').textContent = 'Gambar dibuang daripada borang. Tekan Simpan untuk sahkan.';
  setImagePreview(kind);
  notify('Gambar dibuang daripada borang.');
}

byId('p-remove-image').addEventListener('click', () => clearEditorImage('product'));
byId('g-remove-image').addEventListener('click', () => clearEditorImage('game'));

document.querySelectorAll('.image-upload-box').forEach(box => {
  const kind = box.dataset.uploadFor;
  const input = byId(kind === 'product' ? 'p-image-file' : 'g-image-file');
  box.addEventListener('click', event => {
    if (event.target.closest('button') || event.target.closest('.image-upload-preview')) return;
    input.click();
  });
  ['dragenter', 'dragover'].forEach(type => box.addEventListener(type, event => {
    event.preventDefault();
    box.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach(type => box.addEventListener(type, event => {
    event.preventDefault();
    box.classList.remove('dragging');
  }));
  box.addEventListener('drop', event => selectUploadFile(kind, event.dataTransfer?.files?.[0]));
});

document.addEventListener('paste', event => {
  if (byId('editor-modal').hidden) return;
  const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith('image/'));
  if (!imageItem) return;
  const file = imageItem.getAsFile();
  if (!file) return;
  event.preventDefault();
  selectUploadFile(editorMode, file);
  notify('Gambar daripada clipboard diterima. Tekan Upload ImgBB untuk jadikan link.');
});

function readConsultation(item = {}) {
  const source = item.consultation ?? item.konsultasi ?? item.consult;
  const enabled = source === true || String(source).toLowerCase() === 'true' || (source && typeof source === 'object' && !Array.isArray(source));
  const raw = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  return {
    enabled,
    whatsapp: raw.whatsapp || item.whatsapp || item.phone || '',
    buttonText: raw.buttonText || raw.button_text || item.consultationButton || '',
    message: raw.message || raw.text || item.consultationMessage || ''
  };
}

function syncProductConsultation() {
  const enabled = byId('p-consultation').checked;
  byId('p-consultation-fields').hidden = !enabled;
  byId('p-price-field').hidden = enabled;
  byId('p-original-price-field').hidden = enabled;
  byId('p-price').required = !enabled;
  if (enabled) {
    byId('p-price').value = '';
    byId('p-original-price').value = '';
    if (!byId('p-badge').value.trim()) byId('p-badge').value = 'Konsultasi';
  }
}

function syncGameConsultation() {
  const enabled = byId('g-consultation').checked;
  byId('g-consultation-fields').hidden = !enabled;
  if (enabled) {
    if (!byId('g-name').value.trim()) byId('g-name').value = 'Konsultasi WhatsApp';
    if (!byId('g-badge').value.trim()) byId('g-badge').value = 'Konsultasi';
  }
}

function syncGamePurchaseNotice() {
  byId('g-purchase-notice-fields').hidden = !byId('g-purchase-notice').checked;
}

byId('p-consultation').addEventListener('change', syncProductConsultation);
byId('g-consultation').addEventListener('change', syncGameConsultation);
byId('g-purchase-notice').addEventListener('change', syncGamePurchaseNotice);

async function uploadImgBB(kind, button) {
  const file = kind === 'product' ? productImageFile : gameImageFile;
  let savedKey = '';
  try { savedKey = localStorage.getItem(IMGBB_KEY_STORAGE) || ''; } catch (error) {}
  const key = byId('imgbb-api-key').value.trim() || savedKey;
  const status = byId(kind === 'product' ? 'p-upload-status' : 'g-upload-status');
  if (!key) return notify('Simpan API key ImgBB di bahagian Tetapan dahulu.', true);
  if (!file) return notify('Pilih gambar dahulu.', true);
  setBusy(button, true, 'Uploading...');
  status.textContent = 'Menghantar gambar ke ImgBB...';
  try {
    const form = new FormData();
    form.append('image', file, file.name);
    form.append('name', file.name.replace(/\.[^.]+$/, '').slice(0, 100));
    const response = await fetchWithTimeout('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key), {method:'POST', body:form}, 45000);
    const result = await response.json();
    if (!response.ok || !result.success || !result.data?.url) throw new Error(result?.error?.message || 'ImgBB upload gagal.');
    const imageUrl = result.data.display_url || result.data.url;
    byId(kind === 'product' ? 'p-img' : 'g-img').value = imageUrl;
    setImagePreview(kind, null, imageUrl);
    status.textContent = 'Siap • ' + imageUrl;
    notify('Gambar berjaya diupload dan URL sudah dimasukkan.');
  } catch (error) {
    status.textContent = 'Upload gagal. Cuba semula.';
    notify(error.message, true);
  } finally { setBusy(button, false); }
}

document.querySelectorAll('.tabs button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(item => item.classList.toggle('active', item === button));
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === button.dataset.tab));
}));

function activateCatalogTab(tabName) {
  const allowed = new Set(['products','games','promos','orders','leaderboard','settings','drafts','health','migration']);
  const name = allowed.has(tabName) ? tabName : 'products';
  document.querySelector('.tabs button[data-tab="' + name + '"]')?.click();
}

function leaderboardPeriodLabel(period) {
  return ({ daily:'Harian', weekly:'Mingguan', monthly:'Bulanan' })[period] || period;
}
function leaderboardAdminMoney(value) {
  return new Intl.NumberFormat('ms-MY', { style:'currency', currency:'MYR', minimumFractionDigits:2 }).format(Math.max(0, Number(value || 0)));
}
function syncLeaderboardAdminSettings() {
  byId('leaderboard-enabled').checked = leaderboardConfig.active === true || String(leaderboardConfig.active).toLowerCase() === 'true';
  byId('leaderboard-admin-title').value = leaderboardConfig.title || 'Top Pelanggan H4SX';
  byId('leaderboard-admin-subtitle').value = leaderboardConfig.subtitle || 'Terima kasih kepada pelanggan yang terus menyokong H4SX STORE.';
  byId('leaderboard-default-period').value = ['daily','weekly','monthly'].includes(leaderboardConfig.defaultPeriod) ? leaderboardConfig.defaultPeriod : 'daily';
}
function renderLeaderboardAdmin() {
  syncLeaderboardAdminSettings();
  document.querySelectorAll('[data-admin-leaderboard-period]').forEach(button => button.classList.toggle('active', button.dataset.adminLeaderboardPeriod === leaderboardAdminPeriod));
  const rows = leaderboardEntries
    .filter(entry => String(entry.period) === leaderboardAdminPeriod)
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0) || String(a.name || '').localeCompare(String(b.name || '')));
  byId('leaderboard-admin-list').innerHTML = rows.length ? rows.map((entry, index) =>
    '<article class="leaderboard-admin-row' + (entry.active === false ? ' is-hidden' : '') + '"><div class="leaderboard-admin-rank">#' + (index + 1) + '</div><div class="leaderboard-admin-copy"><strong>' + escapeHtml(entry.name || 'Tanpa nama') + '</strong><span>' + leaderboardPeriodLabel(entry.period) + (entry.active === false ? ' • Disorok daripada pelanggan' : ' • Dipaparkan') + '</span></div><div class="leaderboard-admin-amount">' + leaderboardAdminMoney(entry.amount) + '</div><div class="leaderboard-admin-actions"><button type="button" class="visibility' + (entry.active === false ? ' is-hidden' : '') + '" data-leaderboard-action="visibility" data-id="' + escapeHtml(entry.id) + '" title="' + (entry.active === false ? 'Unhide pelanggan' : 'Hide pelanggan') + '" aria-label="' + (entry.active === false ? 'Unhide ' : 'Hide ') + escapeHtml(entry.name || 'pelanggan') + '"><i class="fa-solid ' + (entry.active === false ? 'fa-eye' : 'fa-eye-slash') + '"></i></button><button type="button" data-leaderboard-action="edit" data-id="' + escapeHtml(entry.id) + '" title="Edit"><i class="fa-solid fa-pen"></i></button><button type="button" class="danger" data-leaderboard-action="delete" data-id="' + escapeHtml(entry.id) + '" title="Padam"><i class="fa-solid fa-trash"></i></button></div></article>'
  ).join('') : '<div class="empty">Belum ada ranking ' + leaderboardPeriodLabel(leaderboardAdminPeriod).toLowerCase() + '.</div>';
}
function resetLeaderboardEntryForm() {
  byId('leaderboard-entry-form').reset();
  byId('leaderboard-entry-id').value = '';
  byId('leaderboard-entry-period').value = leaderboardAdminPeriod;
  byId('cancel-leaderboard-edit').hidden = true;
  byId('save-leaderboard-entry').innerHTML = '<i class="fa-solid fa-plus"></i> Tambah ranking';
}
function editLeaderboardEntry(id) {
  const entry = leaderboardEntries.find(item => item.id === id);
  if (!entry) return notify('Rekod leaderboard tidak dijumpai.', true);
  byId('leaderboard-entry-id').value = entry.id;
  byId('leaderboard-entry-name').value = entry.name || '';
  byId('leaderboard-entry-amount').value = Number(entry.amount || 0);
  byId('leaderboard-entry-period').value = entry.period || 'daily';
  byId('cancel-leaderboard-edit').hidden = false;
  byId('save-leaderboard-entry').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan perubahan';
  byId('leaderboard-entry-name').focus();
}

byId('save-leaderboard-settings').addEventListener('click', async event => {
  const button = event.currentTarget;
  const value = {
    active: byId('leaderboard-enabled').checked,
    title: byId('leaderboard-admin-title').value.trim() || 'Top Pelanggan H4SX',
    subtitle: byId('leaderboard-admin-subtitle').value.trim() || 'Terima kasih kepada pelanggan yang terus menyokong H4SX STORE.',
    defaultPeriod: byId('leaderboard-default-period').value,
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  };
  setBusy(button, true, 'Menyimpan...');
  try { await saveStorePath('config/customerLeaderboard/config', value, 'Tetapan leaderboard disimpan.', 'Ubah tetapan leaderboard'); }
  catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

byId('leaderboard-entry-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  const id = byId('leaderboard-entry-id').value.trim() || database.ref(ROOT + '/config/customerLeaderboard/entries').push().key;
  const name = byId('leaderboard-entry-name').value.trim();
  const amount = Number(byId('leaderboard-entry-amount').value);
  const period = byId('leaderboard-entry-period').value;
  if (!name) return notify('Masukkan nama pelanggan.', true);
  if (!Number.isFinite(amount) || amount < 0) return notify('Jumlah spend tidak sah.', true);
  if (!['daily','weekly','monthly'].includes(period)) return notify('Tempoh leaderboard tidak sah.', true);
  const previous = leaderboardEntries.find(entry => entry.id === id);
  const value = { name:name.slice(0,60), amount:Math.round(amount * 100) / 100, period, active:previous ? previous.active !== false : true, createdAt:previous?.createdAt || firebase.database.ServerValue.TIMESTAMP, updatedAt:firebase.database.ServerValue.TIMESTAMP };
  let saved = false;
  setBusy(button, true, previous ? 'Menyimpan...' : 'Menambah...');
  try {
    await saveStorePath('config/customerLeaderboard/entries/' + id, value, previous ? 'Ranking dikemas kini.' : 'Pelanggan ditambah ke leaderboard.', previous ? 'Edit ranking ' + name : 'Tambah ranking ' + name);
    leaderboardAdminPeriod = period;
    saved = true;
  } catch (error) { notify(error.message, true); }
  finally {
    setBusy(button, false);
    if (saved) resetLeaderboardEntryForm();
  }
});

byId('cancel-leaderboard-edit').addEventListener('click', resetLeaderboardEntryForm);
document.querySelectorAll('[data-admin-leaderboard-period]').forEach(button => button.addEventListener('click', () => {
  leaderboardAdminPeriod = button.dataset.adminLeaderboardPeriod;
  resetLeaderboardEntryForm();
  renderLeaderboardAdmin();
}));
byId('leaderboard-admin-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-leaderboard-action]');
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.leaderboardAction === 'edit') return editLeaderboardEntry(id);
  const entry = leaderboardEntries.find(item => item.id === id);
  if (button.dataset.leaderboardAction === 'visibility' && entry) {
    const nextActive = entry.active === false;
    setBusy(button, true, '');
    try {
      await saveStorePath('config/customerLeaderboard/entries/' + id + '/active', nextActive, nextActive ? 'Pelanggan dipaparkan semula.' : 'Pelanggan disorok daripada leaderboard.', (nextActive ? 'Unhide ' : 'Hide ') + entry.name);
    } catch (error) { notify(error.message, true); }
    finally { setBusy(button, false); }
    return;
  }
  if (button.dataset.leaderboardAction !== 'delete' || !entry || !confirm('Padam ' + entry.name + ' daripada leaderboard?')) return;
  setBusy(button, true, '');
  try {
    await saveStorePath('config/customerLeaderboard/entries/' + id, null, 'Rekod leaderboard dipadam.', 'Padam ranking ' + entry.name);
    if (byId('leaderboard-entry-id').value === id) resetLeaderboardEntryForm();
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

function isAdminCatalogItemVisible(item = {}) {
  return item.active !== false && String(item.active).toLowerCase() !== 'false' && item.hidden !== true && String(item.hidden).toLowerCase() !== 'true';
}

function renderProducts() {
  const q = byId('product-search').value.trim().toLowerCase();
  const filtered = products.filter(item => [item.id,item.name,item.game,item.gameGroup,item.platform,item.subcategory].join(' ').toLowerCase().includes(q));
  byId('product-list').innerHTML = filtered.length ? filtered.map(item => {
    const index = products.indexOf(item);
    const image = item.poster || item.image || item.img || item.thumbnail || '';
    const media = image && !/\.(mp4|webm|mov)(\?|#|$)/i.test(image)
      ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">'
      : '<span class="item-placeholder"><i class="fa-solid fa-box"></i></span>';
    const position = {top:'Atas', middle:'Tengah', bottom:'Bawah'}[item.displayPosition] || 'Tengah';
    const pin = item.pinned === true || String(item.pinned).toLowerCase() === 'true' ? ' • <b><i class="fa-solid fa-thumbtack"></i> Pin</b>' : '';
    const visible = isAdminCatalogItemVisible(item);
    return '<article class="item-row' + (visible ? '' : ' is-hidden-item') + '">' + media + '<div class="item-copy"><strong>' + escapeHtml(item.name || 'Tanpa nama') + '</strong><span>#' + escapeHtml(item.id) + ' • ' + escapeHtml(item.game || item.gameGroup || '-') + ' • <b>RM' + Number(item.price || 0).toFixed(2) + '</b> • Stok ' + escapeHtml(item.stock ?? '-') + ' • Posisi ' + position + pin + '</span><span class="visibility-state' + (visible ? '' : ' off') + '">' + (visible ? 'DIPAPARKAN' : 'DISEMBUNYIKAN') + '</span></div><div class="row-actions"><button class="visibility-action" data-action="toggle-product-visibility" data-index="' + index + '" title="' + (visible ? 'Sembunyikan produk' : 'Paparkan produk') + '"><i class="fa-solid ' + (visible ? 'fa-eye-slash' : 'fa-eye') + '"></i></button><button data-action="edit-product" data-index="' + index + '" title="Edit"><i class="fa-solid fa-pen"></i></button><button data-action="duplicate-product" data-index="' + index + '" title="Duplicate"><i class="fa-solid fa-copy"></i></button><button class="danger" data-action="delete-product" data-index="' + index + '" title="Padam"><i class="fa-solid fa-trash"></i></button></div></article>';
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
    const visible = isAdminCatalogItemVisible(item);
    return '<article class="item-row' + (visible ? '' : ' is-hidden-item') + '">' + media + '<div class="item-copy"><strong>' + escapeHtml(item.name || 'Tanpa nama') + '</strong><span>' + escapeHtml(item.platform || '-') + (item.badge ? ' • ' + escapeHtml(item.badge) : '') + (item.oos ? ' • <b>Soon</b>' : '') + '</span><span class="visibility-state' + (visible ? '' : ' off') + '">' + (visible ? 'DIPAPARKAN' : 'DISEMBUNYIKAN') + '</span></div><div class="row-actions"><button class="visibility-action" data-action="toggle-game-visibility" data-index="' + index + '" title="' + (visible ? 'Sembunyikan game' : 'Paparkan game') + '"><i class="fa-solid ' + (visible ? 'fa-eye-slash' : 'fa-eye') + '"></i></button><button data-action="edit-game" data-index="' + index + '" title="Edit"><i class="fa-solid fa-pen"></i></button><button data-action="duplicate-game" data-index="' + index + '" title="Duplicate"><i class="fa-solid fa-copy"></i></button><button class="danger" data-action="delete-game" data-index="' + index + '" title="Padam"><i class="fa-solid fa-trash"></i></button></div></article>';
  }).join('') : '<div class="empty">Belum ada game.</div>';
}

function promoSources(item) {
  if (Array.isArray(item?.promoCodes) && item.promoCodes.length) return item.promoCodes;
  const code = item?.promoCode || item?.discountCode || item?.code;
  if (!code) return [];
  return [{
    code,
    discount: item.promoDiscount ?? item.discount,
    type: item.promoType ?? item.type,
    usageLimit: item.promoUsageLimit ?? item.promoLimit ?? item.usageLimit,
    promoStartsAt: item.promoStartsAt ?? item.promoStartAt,
    promoExpiresAt: item.promoExpiresAt,
    promoDurationMinutes: item.promoDurationMinutes,
    promoRequirePhone: item.promoRequirePhone,
    active: item.promoActive
  }];
}

function promoGroups() {
  const map = new Map();
  products.forEach((product, productIndex) => promoSources(product).forEach(source => {
    const code = String(source?.code || source?.promoCode || '').trim().toUpperCase();
    if (!code) return;
    const merged = { ...product, ...source, code };
    if (!map.has(code)) map.set(code, { code, config: merged, targetIndices: [], targets: [] });
    const group = map.get(code);
    group.targetIndices.push(productIndex);
    group.targets.push({
      productIndex,
      variantIds: Array.isArray(source?.variantIds) ? source.variantIds.map(value => String(value)).filter(Boolean) : []
    });
  }));
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function promoProductVariants(product) {
  const source = Array.isArray(product?.variants) ? product.variants : (Array.isArray(product?.types) ? product.types : []);
  return source.filter(Boolean).map((variant, index) => ({
    id: String(variant.id ?? variant.value ?? variant.name ?? index),
    name: String(variant.name ?? variant.label ?? ('Pilihan ' + (index + 1)))
  }));
}

function promoTargetKey(productIndex, variantId = '') {
  return String(productIndex) + '::' + String(variantId || '');
}

function promoTargetValue(productIndex, variantId = '') {
  return JSON.stringify({ productIndex, variantId: String(variantId || '') });
}

function parsePromoTarget(value) {
  try {
    const parsed = JSON.parse(value);
    const productIndex = Number(parsed.productIndex);
    if (!Number.isInteger(productIndex) || !products[productIndex]) return null;
    return { productIndex, variantId: String(parsed.variantId || '') };
  } catch (error) {
    return null;
  }
}

function promoDateValue(value) {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
}

function promoRedeemLink(code) {
  const url = new URL('index.htm', location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('promo', String(code || '').trim().toUpperCase());
  url.searchParams.set('redeem', '1');
  return url.toString();
}

async function copyTextValue(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {}
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Browser tidak membenarkan copy automatik.');
}

function renderPromos() {
  const list = byId('promo-list');
  if (!list) return;
  const groups = promoGroups();
  list.innerHTML = groups.length ? groups.map(group => {
    const config = group.config;
    const amount = Number(config.discount ?? config.promoDiscount ?? 0);
    const type = String(config.type ?? config.promoType ?? 'percent').toLowerCase() === 'fixed' ? 'fixed' : 'percent';
    const limit = Math.max(1, Number(config.usageLimit ?? config.promoUsageLimit ?? config.promoLimit ?? 1));
    const starts = Date.parse(String(config.promoStartsAt ?? config.promoStartAt ?? ''));
    const expires = Date.parse(String(config.promoExpiresAt || ''));
    const active = !(config.active === false || config.promoActive === false || String(config.active).toLowerCase() === 'false');
    const now = Date.now();
    const status = !active ? 'Tidak aktif' : (Number.isFinite(starts) && now < starts ? 'Belum mula' : (Number.isFinite(expires) && now >= expires ? 'Tamat' : 'Aktif'));
    const targetNames = group.targets.map(target => {
      const product = products[target.productIndex];
      const productName = product?.name || ('#' + product?.id);
      if (!target.variantIds.length) return productName + ' (semua variant)';
      const variants = promoProductVariants(product);
      const names = target.variantIds.map(id => variants.find(variant => variant.id === id)?.name || id);
      return productName + ' (' + names.join(', ') + ')';
    }).join(', ');
    const encoded = encodeURIComponent(group.code);
    return '<article class="item-row promo-row"><span class="item-placeholder"><i class="fa-solid fa-ticket"></i></span><div class="item-copy"><strong>' + escapeHtml(group.code) + '<em class="promo-status' + (status === 'Aktif' ? '' : ' off') + '">' + status + '</em></strong><span>' + (type === 'fixed' ? 'RM' + amount.toFixed(2) : amount + '%') + ' • Had ' + limit + ' orang • ' + group.targets.length + ' sasaran</span><span>' + escapeHtml(targetNames) + '</span></div><div class="row-actions"><button class="publish" data-action="copy-promo-link" data-code="' + encoded + '" title="Copy link auto redeem"><i class="fa-solid fa-link"></i></button><button data-action="edit-promo" data-code="' + encoded + '" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="danger" data-action="delete-promo" data-code="' + encoded + '" title="Padam"><i class="fa-solid fa-trash"></i></button></div></article>';
  }).join('') : '<div class="empty">Belum ada promo code. Tekan “Promo baru” untuk buat satu.</div>';
}

function openPromoEditor(code = '') {
  const group = code ? promoGroups().find(item => item.code === code) : null;
  const config = group?.config || {};
  editingPromoCode = group?.code || '';
  byId('promo-title').textContent = group ? 'Edit ' + group.code : 'Promo baru';
  byId('promo-code').value = group?.code || '';
  byId('promo-type').value = String(config.type ?? config.promoType ?? 'percent').toLowerCase() === 'fixed' ? 'fixed' : 'percent';
  byId('promo-discount').value = config.discount ?? config.promoDiscount ?? '';
  byId('promo-limit').value = config.usageLimit ?? config.promoUsageLimit ?? config.promoLimit ?? 1;
  byId('promo-starts').value = promoDateValue(config.promoStartsAt ?? config.promoStartAt);
  byId('promo-expires').value = promoDateValue(config.promoExpiresAt);
  byId('promo-duration').value = config.promoDurationMinutes ?? config.durationMinutes ?? '';
  byId('promo-active').checked = !(config.active === false || config.promoActive === false || String(config.active).toLowerCase() === 'false');
  byId('promo-phone').checked = config.promoRequirePhone === true || String(config.promoRequirePhone).toLowerCase() === 'true';
  const selected = new Set();
  (group?.targets || []).forEach(target => {
    if (target.variantIds.length) target.variantIds.forEach(variantId => selected.add(promoTargetKey(target.productIndex, variantId)));
    else selected.add(promoTargetKey(target.productIndex));
  });
  byId('promo-products').innerHTML = products.map((product, index) => {
    const variants = promoProductVariants(product);
    const allKey = promoTargetKey(index);
    const allOption = '<option value="' + escapeHtml(promoTargetValue(index)) + '"' + (selected.has(allKey) ? ' selected' : '') + '>#' + escapeHtml(product.id) + ' — ' + escapeHtml(product.name || 'Tanpa nama') + (variants.length ? ' — SEMUA VARIANT' : '') + '</option>';
    const variantOptions = variants.map(variant => {
      const key = promoTargetKey(index, variant.id);
      return '<option value="' + escapeHtml(promoTargetValue(index, variant.id)) + '"' + (selected.has(key) ? ' selected' : '') + '>　↳ ' + escapeHtml(variant.name) + ' sahaja</option>';
    }).join('');
    return allOption + variantOptions;
  }).join('');
  byId('promo-modal').hidden = false;
}

function closePromoEditor() {
  byId('promo-modal').hidden = true;
  editingPromoCode = '';
}

function clearLegacyPromo(item, code) {
  const directCode = String(item.promoCode || item.discountCode || item.code || '').trim().toUpperCase();
  if (directCode !== code) return;
  ['promoCode','discountCode','promoDiscount','discount','promoUsageLimit','promoLimit','usageLimit','promoExpiresAt','promoStartsAt','promoStartAt','promoDurationMinutes','promoRequirePhone','promoActive'].forEach(key => delete item[key]);
}

async function removePromo(code) {
  const next = JSON.parse(JSON.stringify(products));
  next.forEach(item => {
    if (Array.isArray(item.promoCodes)) {
      item.promoCodes = item.promoCodes.filter(entry => String(entry?.code || entry?.promoCode || '').trim().toUpperCase() !== code);
      if (!item.promoCodes.length) delete item.promoCodes;
    }
    clearLegacyPromo(item, code);
  });
  await saveArray('inventory', next, 'Promo ' + code + ' dipadam.');
}

async function runButtonOperation(button, label, operation) {
  setBusy(button, true, label);
  try {
    await operation();
  } catch (error) {
    notify(error?.message || 'Operasi gagal. Cuba semula.', true);
  } finally {
    setBusy(button, false);
  }
}

byId('product-search').addEventListener('input', renderProducts);
byId('game-search').addEventListener('input', renderGames);
byId('new-product').addEventListener('click', () => openProductEditor());
byId('new-game').addEventListener('click', () => openGameEditor());
byId('new-promo').addEventListener('click', () => openPromoEditor());
byId('promo-close').addEventListener('click', closePromoEditor);
byId('promo-cancel').addEventListener('click', closePromoEditor);
byId('promo-modal').addEventListener('click', event => { if (event.target === byId('promo-modal')) closePromoEditor(); });
byId('promo-select-all').addEventListener('click', () => Array.from(byId('promo-products').options).forEach(option => { option.selected = true; }));
byId('promo-clear-all').addEventListener('click', () => Array.from(byId('promo-products').options).forEach(option => { option.selected = false; }));

byId('promo-form').addEventListener('submit', async event => {
  event.preventDefault();
  const code = byId('promo-code').value.trim().toUpperCase().replace(/\s+/g, '');
  const discount = Number(byId('promo-discount').value);
  const type = byId('promo-type').value;
  const selectedTargets = Array.from(byId('promo-products').selectedOptions).map(option => parsePromoTarget(option.value)).filter(Boolean);
  if (!code) return notify('Masukkan kod promo.', true);
  if (!selectedTargets.length) return notify('Pilih sekurang-kurangnya satu produk atau variant.', true);
  if (!Number.isFinite(discount) || discount <= 0 || (type === 'percent' && discount > 100)) return notify('Nilai diskaun tidak sah.', true);
  const startsValue = byId('promo-starts').value;
  const expiresValue = byId('promo-expires').value;
  const startsAt = startsValue ? new Date(startsValue).toISOString() : '';
  const expiresAt = expiresValue ? new Date(expiresValue).toISOString() : '';
  if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) return notify('Waktu tamat mesti selepas waktu mula.', true);
  if (!editingPromoCode && promoGroups().some(group => group.code === code)) return notify('Kod promo ini sudah ada. Tekan ikon pensel untuk edit.', true);
  const promo = compact({ code, type, discount, usageLimit:Math.max(1, Math.floor(Number(byId('promo-limit').value) || 1)), active:byId('promo-active').checked, promoStartsAt:startsAt, promoExpiresAt:expiresAt, promoDurationMinutes:numberOrBlank(byId('promo-duration').value), promoRequirePhone:byId('promo-phone').checked });
  const next = JSON.parse(JSON.stringify(products));
  const oldCode = editingPromoCode || code;
  next.forEach(item => {
    if (Array.isArray(item.promoCodes)) item.promoCodes = item.promoCodes.filter(entry => String(entry?.code || entry?.promoCode || '').trim().toUpperCase() !== oldCode && String(entry?.code || entry?.promoCode || '').trim().toUpperCase() !== code);
    clearLegacyPromo(item, oldCode);
  });
  const targetScopes = new Map();
  selectedTargets.forEach(target => {
    if (!targetScopes.has(target.productIndex)) targetScopes.set(target.productIndex, new Set());
    const scope = targetScopes.get(target.productIndex);
    if (!target.variantId) { scope.clear(); scope.add(''); }
    else if (!scope.has('')) scope.add(target.variantId);
  });
  targetScopes.forEach((variantSet, index) => {
    const item = next[index];
    if (!item) return;
    item.promoCodes = Array.isArray(item.promoCodes) ? item.promoCodes : [];
    const variantIds = Array.from(variantSet).filter(Boolean);
    item.promoCodes.push(compact({ ...promo, variantIds: variantIds.length ? variantIds : null }));
    item.promoActive = true;
  });
  const button = event.submitter;
  setBusy(button, true, 'Menyimpan...');
  try {
    await saveArray('inventory', next, 'Promo ' + code + ' disimpan realtime.');
    closePromoEditor();
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

document.addEventListener('click', async event => {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const index = Number(actionButton.dataset.index);
  const action = actionButton.dataset.action;
  if (action.endsWith('-draft')) {
    const draft = readDrafts().find(item => item.id === actionButton.dataset.draftId);
    if (!draft) return notify('Draft tidak dijumpai.', true);
    if (action === 'preview-draft') return showItemPreview(draft.mode, draft.item);
    if (action === 'edit-draft') {
      const targetIndex = draftTargetIndex(draft);
      return draft.mode === 'game'
        ? openGameEditor(draft.item, targetIndex >= 0 ? targetIndex : null, draft.id)
        : openProductEditor(draft.item, targetIndex >= 0 ? targetIndex : null, draft.id);
    }
    if (action === 'publish-draft') return publishDraft(draft, actionButton);
    if (action === 'delete-draft' && confirm('Buang draft "' + (draft.item?.name || '') + '"?')) {
      writeDrafts(readDrafts().filter(item => item.id !== draft.id));
      notify('Draft dibuang.');
    }
    return;
  }
  if (action === 'copy-promo-link') {
    const code = decodeURIComponent(actionButton.dataset.code || '');
    try {
      await copyTextValue(promoRedeemLink(code));
      notify('Link auto redeem ' + code + ' sudah dicopy.');
    } catch (error) { notify(error.message, true); }
    return;
  }
  if (action === 'edit-promo') return openPromoEditor(decodeURIComponent(actionButton.dataset.code || ''));
  if (action === 'delete-promo') {
    const code = decodeURIComponent(actionButton.dataset.code || '');
    if (confirm('Padam promo "' + code + '" daripada semua produk?')) {
      await runButtonOperation(actionButton, 'Memadam...', () => removePromo(code));
    }
    return;
  }
  if (action === 'edit-product') return openProductEditor(products[index], index);
  if (action === 'toggle-product-visibility') {
    if (!products[index]) return notify('Produk tidak dijumpai.', true);
    const next = JSON.parse(JSON.stringify(products));
    next[index].active = !isAdminCatalogItemVisible(products[index]);
    if (next[index].active) delete next[index].hidden;
    await runButtonOperation(actionButton, '...', () => saveArray('inventory', next, next[index].active ? 'Produk dipaparkan semula.' : 'Produk disembunyikan daripada pelanggan.'));
    return;
  }
  if (action === 'duplicate-product') {
    if (!products[index]) return notify('Produk tidak dijumpai. Tunggu sync selesai dan cuba semula.', true);
    const copy = JSON.parse(JSON.stringify(products[index]));
    copy.id = nextProductId();
    copy.name = (copy.name || 'Produk') + ' Copy';
    return openProductEditor(copy, null);
  }
  if (action === 'delete-product' && confirm('Padam produk "' + (products[index]?.name || '') + '"?')) {
    const next = products.filter((_, i) => i !== index);
    await runButtonOperation(actionButton, 'Memadam...', () => saveArray('inventory', next, 'Produk dipadam.'));
    return;
  }
  if (action === 'edit-game') return openGameEditor(games[index], index);
  if (action === 'toggle-game-visibility') {
    if (!games[index]) return notify('Game tidak dijumpai.', true);
    const next = JSON.parse(JSON.stringify(games));
    next[index].active = !isAdminCatalogItemVisible(games[index]);
    if (next[index].active) delete next[index].hidden;
    await runButtonOperation(actionButton, '...', () => saveArray('games', next, next[index].active ? 'Game dipaparkan semula.' : 'Game dan produknya disembunyikan daripada pelanggan.'));
    return;
  }
  if (action === 'duplicate-game') {
    if (!games[index]) return notify('Game tidak dijumpai. Tunggu sync selesai dan cuba semula.', true);
    const copy = JSON.parse(JSON.stringify(games[index]));
    copy.name = (copy.name || 'Game') + ' Copy';
    return openGameEditor(copy, null);
  }
  if (action === 'delete-game' && confirm('Padam game "' + (games[index]?.name || '') + '"?')) {
    const next = games.filter((_, i) => i !== index);
    await runButtonOperation(actionButton, 'Memadam...', () => saveArray('games', next, 'Game dipadam.'));
  }
});

function nextProductId() {
  const used = new Set(products.map(item => Number(item.id)).filter(Number.isFinite));
  let id = 1;
  while (used.has(id)) id++;
  return id;
}

function readDrafts() { return readStoredList(DRAFT_STORAGE_KEY); }

function writeDrafts(drafts) {
  writeStoredList(DRAFT_STORAGE_KEY, drafts.slice(-30));
  renderDrafts();
}

function draftTargetIndex(draft) {
  if (draft.mode === 'product') {
    return products.findIndex(item => String(item.id) === String(draft.targetKey));
  }
  return games.findIndex(item => String(item.name || '').toLowerCase() === String(draft.targetKey || '').toLowerCase());
}

function renderDrafts() {
  const drafts = readDrafts().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const list = byId('draft-list');
  if (byId('draft-count')) byId('draft-count').textContent = drafts.length;
  if (!list) return;
  list.innerHTML = drafts.length ? drafts.map(draft => {
    const item = draft.item || {};
    const image = item.img || item.image || item.poster || '';
    const media = image && !/\.(mp4|webm|mov)(\?|#|$)/i.test(image)
      ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy">'
      : '<span class="item-placeholder"><i class="fa-solid ' + (draft.mode === 'game' ? 'fa-gamepad' : 'fa-box') + '"></i></span>';
    const date = new Date(draft.savedAt).toLocaleString('ms-MY', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    return '<article class="item-row draft-row">' + media + '<div class="item-copy"><strong>' + escapeHtml(item.name || 'Draft tanpa nama') + '</strong><span>' + (draft.mode === 'game' ? 'Game' : 'Produk') + ' • Disimpan ' + escapeHtml(date) + '</span></div><div class="row-actions"><button data-action="preview-draft" data-draft-id="' + escapeHtml(draft.id) + '" title="Preview"><i class="fa-solid fa-eye"></i></button><button data-action="edit-draft" data-draft-id="' + escapeHtml(draft.id) + '" title="Edit"><i class="fa-solid fa-pen"></i></button><button class="publish" data-action="publish-draft" data-draft-id="' + escapeHtml(draft.id) + '" title="Publish"><i class="fa-solid fa-cloud-arrow-up"></i></button><button class="danger" data-action="delete-draft" data-draft-id="' + escapeHtml(draft.id) + '" title="Buang"><i class="fa-solid fa-trash"></i></button></div></article>';
  }).join('') : '<div class="empty">Belum ada draft. Buka editor produk atau game, kemudian tekan “Simpan Draft”.</div>';
}

function collectEditorPayload() {
  let extra;
  try { extra = JSON.parse(byId('extra-json').value || '{}'); }
  catch (error) { throw new Error('Field tambahan bukan JSON yang sah.'); }
  if (!extra || Array.isArray(extra) || typeof extra !== 'object') throw new Error('Field tambahan mesti object JSON.');
  if (editorMode === 'product') {
    const rawId = byId('p-id').value.trim();
    const id = /^\d+$/.test(rawId) ? Number(rawId) : rawId;
    if (id === '') throw new Error('ID produk diperlukan.');
    const duplicate = products.some((item, index) => index !== editingKey && String(item.id) === String(id));
    if (duplicate) throw new Error('ID produk sudah digunakan.');
    const isConsultation = byId('p-consultation').checked;
    const item = compact({ ...extra, id, name:byId('p-name').value.trim(), game:byId('p-game').value.trim(), platform:byId('p-platform').value.trim(), subcategory:byId('p-subcategory').value.trim(), price:isConsultation ? null : numberOrBlank(byId('p-price').value), originalPrice:isConsultation ? null : numberOrBlank(byId('p-original-price').value), stock:numberOrBlank(byId('p-stock').value), sold:numberOrBlank(byId('p-sold').value), promoLabel:byId('p-badge').value.trim(), img:byId('p-img').value.trim(), desc:byId('p-desc').value.trim(), active:byId('p-active').checked, pinned:byId('p-pinned').checked, displayPosition:byId('p-display-position').value, robloxUsernameLookup:byId('p-roblox-lookup').checked, consultation:isConsultation, whatsapp:isConsultation ? byId('p-whatsapp').value.trim() : null, consultationButton:isConsultation ? byId('p-consultation-button').value.trim() : null, consultationMessage:isConsultation ? byId('p-consultation-message').value.trim() : null, updatedAt:new Date().toISOString() });
    if (!item.name || !item.game) throw new Error('Nama produk dan game diperlukan.');
    if (!isConsultation && (!Number.isFinite(item.price) || item.price < 0)) throw new Error('Harga produk tidak sah.');
    return { mode:'product', item, index:editingKey, targetKey:editingKey === null ? '' : String(products[editingKey]?.id ?? '') };
  }
  const name = byId('g-name').value.trim();
  if (!name) throw new Error('Nama game diperlukan.');
  const duplicate = games.some((item, index) => index !== editingKey && String(item.name).toLowerCase() === name.toLowerCase());
  if (duplicate) throw new Error('Nama game sudah digunakan.');
  const isConsultation = byId('g-consultation').checked;
  const purchaseNoticeEnabled = byId('g-purchase-notice').checked;
  const purchaseNoticeTitle = byId('g-purchase-notice-title').value.trim();
  const purchaseNoticeBody = byId('g-purchase-notice-body').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n');
  if (purchaseNoticeEnabled && !purchaseNoticeBody) throw new Error('Isi sekurang-kurangnya satu baris untuk notis pembelian.');
  const item = compact({ ...extra, name, platform:byId('g-platform').value.trim(), badge:byId('g-badge').value.trim(), oos:byId('g-oos').checked, active:byId('g-active').checked, img:byId('g-img').value.trim(), purchaseNoticeEnabled, purchaseNoticeTitle:purchaseNoticeEnabled ? (purchaseNoticeTitle || 'Semak sebelum membuat pesanan') : null, purchaseNoticeBody:purchaseNoticeEnabled ? purchaseNoticeBody : null, consultation:isConsultation, whatsapp:isConsultation ? byId('g-whatsapp').value.trim() : null, consultationButton:isConsultation ? byId('g-consultation-button').value.trim() : null, consultationMessage:isConsultation ? byId('g-consultation-message').value.trim() : null, updatedAt:new Date().toISOString() });
  return { mode:'game', item, index:editingKey, targetKey:editingKey === null ? '' : String(games[editingKey]?.name ?? '') };
}

function uniqueTextOptions(values) {
  const seen = new Set();
  return values.map(value => String(value || '').trim()).filter(value => {
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fillChoicePicker(id, values, placeholder) {
  const picker = byId(id);
  if (!picker) return;
  picker.innerHTML = '<option value="">' + escapeHtml(placeholder) + '</option>' + uniqueTextOptions(values).map(value => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>').join('');
}

function selectPickerValue(id, value) {
  const picker = byId(id);
  if (!picker) return;
  const wanted = String(value || '').trim().toLocaleLowerCase();
  const option = Array.from(picker.options).find(item => item.value.trim().toLocaleLowerCase() === wanted);
  picker.value = option?.value || '';
}

function selectedProductGame() {
  const selected = byId('p-game').value.trim().toLocaleLowerCase();
  return games.find(game => String(game.name || '').trim().toLocaleLowerCase() === selected) || null;
}

function refreshClassificationOptions() {
  const gameNames = games.map(game => game.name);
  const platforms = games.map(game => game.platform);
  fillChoicePicker('p-game-picker', gameNames, 'Pilih game...');
  fillChoicePicker('g-name-picker', gameNames, 'Pilih game...');
  fillChoicePicker('p-platform-picker', platforms, 'Pilih platform...');
  fillChoicePicker('g-platform-picker', platforms, 'Pilih platform...');
  syncClassificationPickers();
}

function syncClassificationPickers() {
  selectPickerValue('p-game-picker', byId('p-game').value);
  selectPickerValue('p-platform-picker', byId('p-platform').value);
  selectPickerValue('g-name-picker', byId('g-name').value);
  selectPickerValue('g-platform-picker', byId('g-platform').value);
}

function syncPlatformFromProductGame() {
  const selectedGame = selectedProductGame();
  const detectedPlatform = String(selectedGame?.platform || '').trim();
  if (detectedPlatform) {
    byId('p-platform').value = detectedPlatform;
    selectPickerValue('p-platform-picker', detectedPlatform);
  }
}

byId('p-game').addEventListener('input', () => {
  selectPickerValue('p-game-picker', byId('p-game').value);
  syncPlatformFromProductGame();
});
byId('p-platform').addEventListener('input', () => selectPickerValue('p-platform-picker', byId('p-platform').value));
byId('g-name').addEventListener('input', () => selectPickerValue('g-name-picker', byId('g-name').value));
byId('g-platform').addEventListener('input', () => selectPickerValue('g-platform-picker', byId('g-platform').value));
byId('p-game-picker').addEventListener('change', event => {
  if (!event.currentTarget.value) return;
  byId('p-game').value = event.currentTarget.value;
  syncPlatformFromProductGame();
});
byId('p-platform-picker').addEventListener('change', event => {
  if (event.currentTarget.value) byId('p-platform').value = event.currentTarget.value;
});
byId('g-name-picker').addEventListener('change', event => {
  if (event.currentTarget.value) byId('g-name').value = event.currentTarget.value;
});
byId('g-platform-picker').addEventListener('change', event => {
  if (event.currentTarget.value) byId('g-platform').value = event.currentTarget.value;
});

function setEditorMode(mode) {
  const productActive = mode === 'product';
  const productFields = byId('product-fields');
  const gameFields = byId('game-fields');
  productFields.hidden = !productActive;
  gameFields.hidden = productActive;
  productFields.querySelectorAll('input,select,textarea,button').forEach(control => { control.disabled = !productActive; });
  gameFields.querySelectorAll('input,select,textarea,button').forEach(control => { control.disabled = productActive; });
}

function showItemPreview(mode, item) {
  const image = item.img || item.image || item.poster || '';
  const isVideo = /\.(mp4|webm|mov)(\?|#|$)/i.test(image);
  const media = image ? (isVideo ? '<video src="' + escapeHtml(image) + '" controls muted></video>' : '<img src="' + escapeHtml(image) + '" alt="">') : '<div class="preview-empty"><i class="fa-solid fa-image"></i><span>Tiada gambar</span></div>';
  byId('preview-title').textContent = item.name || (mode === 'game' ? 'Preview game' : 'Preview produk');
  byId('preview-content').innerHTML = '<article class="draft-preview">' + media + '<div><span class="preview-type">' + (mode === 'game' ? 'GAME' : 'PRODUK') + '</span><h3>' + escapeHtml(item.name || 'Tanpa nama') + '</h3>' + (mode === 'product' ? '<strong>RM' + Number(item.price || 0).toFixed(2) + '</strong><small>Stok: ' + escapeHtml(item.stock ?? '-') + ' • ' + escapeHtml(item.game || '-') + '</small>' : '<small>' + escapeHtml(item.platform || '-') + (item.oos ? ' • Soon' : '') + '</small>') + '<p>' + escapeHtml(item.desc || item.description || 'Tiada penerangan.') + '</p></div></article><details class="preview-json"><summary>Lihat data JSON</summary><pre>' + escapeHtml(JSON.stringify(item, null, 2)) + '</pre></details>';
  byId('preview-modal').hidden = false;
}

function saveCurrentDraft() {
  try {
    const payload = collectEditorPayload();
    const drafts = readDrafts();
    const existing = activeDraftId ? drafts.find(draft => draft.id === activeDraftId) : null;
    const record = { id:existing?.id || (Date.now() + '-' + Math.random().toString(36).slice(2, 8)), mode:payload.mode, targetKey:existing?.targetKey || payload.targetKey, item:payload.item, savedAt:new Date().toISOString() };
    const next = existing ? drafts.map(draft => draft.id === record.id ? record : draft) : [...drafts, record];
    activeDraftId = record.id;
    writeDrafts(next);
    notify('Draft disimpan. Website belum berubah.');
  } catch (error) { notify(error.message, true); }
}

function productPricePoints(item = {}) {
  const points = [];
  const base = Number(item.price);
  if (Number.isFinite(base) && base >= 0) points.push({ key:'base', name:'', price:base });
  const source = Array.isArray(item.variants) ? item.variants : (Array.isArray(item.types) ? item.types : []);
  source.forEach((variant, index) => {
    const price = Number(variant?.price);
    if (!Number.isFinite(price) || price < 0) return;
    const id = String(variant?.id ?? variant?.name ?? index).trim().toLowerCase();
    points.push({ key:'variant:' + id, name:String(variant?.name || variant?.label || ('Variant ' + (index + 1))), price });
  });
  return points;
}

function detectProductPriceDrop(previous, next) {
  if (!previous || !next) return null;
  const before = new Map(productPricePoints(previous).map(point => [point.key, point]));
  return productPricePoints(next).map(point => {
    const old = before.get(point.key);
    return old && old.price - point.price >= 0.01 ? { oldPrice:old.price, newPrice:point.price, variantName:point.name, saving:old.price - point.price } : null;
  }).filter(Boolean).sort((a, b) => b.saving - a.saving)[0] || null;
}

async function publishPriceDropAlert(item, drop) {
  if (!drop || !auth.currentUser) return;
  await withTimeout(database.ref(ROOT + '/config/priceDropAlert').set({
    active:true,
    productId:String(item.id),
    productName:String(item.name || 'Produk H4SX'),
    variantName:String(drop.variantName || ''),
    oldPrice:Math.round(drop.oldPrice * 100) / 100,
    newPrice:Math.round(drop.newPrice * 100) / 100,
    updatedAt:firebase.database.ServerValue.TIMESTAMP,
    expiresAt:Date.now() + (3 * 24 * 60 * 60 * 1000),
    updatedBy:auth.currentUser.email || 'admin'
  }), 'Simpan Price Drop Alert');
}

async function publishPayload(payload, message) {
  if (payload.mode === 'product') {
    const next = [...products];
    const previous = payload.index === null || payload.index < 0 ? null : products[payload.index];
    const drop = detectProductPriceDrop(previous, payload.item);
    if (drop && !productPricePoints(payload.item).some(point => point.key !== 'base') && !(Number(payload.item.originalPrice) > drop.newPrice)) payload.item.originalPrice = drop.oldPrice;
    if (payload.index === null || payload.index < 0) next.push(payload.item); else next[payload.index] = payload.item;
    await saveArray('inventory', next, message || 'Produk dipublish ke website.');
    if (drop) {
      try {
        await publishPriceDropAlert(payload.item, drop);
        notify('Harga turun dikesan — Price Drop Alert dipaparkan selama 3 hari.');
      } catch (error) { notify('Produk disimpan, tetapi Price Drop Alert gagal: ' + error.message, true); }
    }
  } else {
    const next = [...games];
    if (payload.index === null || payload.index < 0) next.push(payload.item); else next[payload.index] = payload.item;
    await saveArray('games', next, message || 'Game dipublish ke website.');
  }
}

async function publishDraft(draft, button) {
  const index = draftTargetIndex(draft);
  if (index < 0 && draft.targetKey) {
    if (!confirm('Item asal draft ini tidak dijumpai. Publish sebagai item baru?')) return;
  }
  const payload = { mode:draft.mode, item:draft.item, index:index >= 0 ? index : null };
  if (draft.mode === 'product' && payload.index === null && products.some(item => String(item.id) === String(draft.item.id))) return notify('ID produk draft sudah digunakan.', true);
  if (draft.mode === 'game' && payload.index === null && games.some(item => String(item.name).toLowerCase() === String(draft.item.name).toLowerCase())) return notify('Nama game draft sudah digunakan.', true);
  await runButtonOperation(button, 'Publish...', async () => {
    await publishPayload(payload, (draft.mode === 'game' ? 'Game' : 'Produk') + ' draft dipublish ke website.');
    writeDrafts(readDrafts().filter(item => item.id !== draft.id));
  });
}

byId('p-next-id').addEventListener('click', () => {
  const id = nextProductId();
  byId('p-id').value = id;
  notify('ID kosong #' + id + ' sudah dipilih.');
});

function openProductEditor(item = {}, index = null, draftId = '') {
  editorMode = 'product'; editingKey = index;
  activeDraftId = draftId;
  byId('editor-kicker').textContent = index === null ? 'PRODUK BARU' : 'EDIT PRODUK';
  byId('editor-title').textContent = item.name || 'Produk baru';
  setEditorMode('product');
  refreshClassificationOptions();
  byId('p-id').value = item.id ?? nextProductId(); byId('p-name').value = item.name || '';
  byId('p-game').value = item.game || item.gameGroup || '';
  byId('p-platform').value = item.platform || '';
  if (!byId('p-platform').value) syncPlatformFromProductGame();
  syncClassificationPickers();
  byId('p-subcategory').value = item.subcategory || ''; byId('p-badge').value = item.promoLabel || item.badge || '';
  byId('p-display-position').value = ['top','middle','bottom'].includes(item.displayPosition) ? item.displayPosition : 'middle';
  byId('p-pinned').checked = item.pinned === true || String(item.pinned).toLowerCase() === 'true';
  byId('p-active').checked = isAdminCatalogItemVisible(item);
  byId('p-price').value = item.price ?? ''; byId('p-original-price').value = item.originalPrice ?? '';
  byId('p-stock').value = item.stock ?? ''; byId('p-sold').value = item.sold ?? '';
  byId('p-roblox-lookup').checked = item.robloxUsernameLookup === true || String(item.robloxUsernameLookup).toLowerCase() === 'true';
  byId('p-img').value = item.img || item.image || item.video || ''; byId('p-desc').value = item.desc || item.description || '';
  const consultation = readConsultation(item);
  byId('p-consultation').checked = consultation.enabled;
  byId('p-whatsapp').value = consultation.whatsapp;
  byId('p-consultation-button').value = consultation.buttonText;
  byId('p-consultation-message').value = consultation.message;
  syncProductConsultation();
  productImageFile = null;
  byId('p-image-file').value = '';
  setImagePreview('product', null, byId('p-img').value);
  byId('p-upload-status').textContent = 'PNG, JPG, WEBP atau GIF.';
  const known = ['id','name','game','gameGroup','platform','subcategory','promoLabel','badge','price','originalPrice','stock','sold','img','image','video','desc','description','active','hidden','consultation','konsultasi','consult','whatsapp','phone','consultationButton','consultationMessage','robloxUsernameLookup','pinned','displayPosition'];
  byId('extra-json').value = JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => !known.includes(key))), null, 2);
  byId('editor-modal').hidden = false;
}

function openGameEditor(item = {}, index = null, draftId = '') {
  editorMode = 'game'; editingKey = index;
  activeDraftId = draftId;
  byId('editor-kicker').textContent = index === null ? 'GAME BARU' : 'EDIT GAME';
  byId('editor-title').textContent = item.name || 'Game baru';
  setEditorMode('game');
  refreshClassificationOptions();
  byId('g-name').value = item.name || ''; byId('g-platform').value = item.platform || '';
  syncClassificationPickers();
  byId('g-badge').value = item.badge || item.badgeTitle || ''; byId('g-oos').checked = item.oos === true;
  byId('g-active').checked = isAdminCatalogItemVisible(item);
  byId('g-img').value = item.img || item.image || item.video || '';
  const hasPurchaseNoticeSetting = Object.prototype.hasOwnProperty.call(item, 'purchaseNoticeEnabled');
  const useBrookhavenDefault = !hasPurchaseNoticeSetting && String(item.name || '').trim().toLowerCase() === 'brookhaven';
  byId('g-purchase-notice').checked = useBrookhavenDefault || item.purchaseNoticeEnabled === true || String(item.purchaseNoticeEnabled).toLowerCase() === 'true';
  byId('g-purchase-notice-title').value = item.purchaseNoticeTitle || (useBrookhavenDefault ? 'Semak sebelum membuat pesanan' : '');
  byId('g-purchase-notice-body').value = item.purchaseNoticeBody || (useBrookhavenDefault ? 'Setiap gamepass hanya boleh dimiliki sekali bagi satu akaun Roblox.\nSemak username dan profil penerima sebelum meneruskan pesanan.\nGamepass yang telah dihantar ke akaun pilihan tidak boleh dipindahkan atau dibayar balik.' : '');
  syncGamePurchaseNotice();
  const consultation = readConsultation(item);
  byId('g-consultation').checked = consultation.enabled;
  byId('g-whatsapp').value = consultation.whatsapp;
  byId('g-consultation-button').value = consultation.buttonText;
  byId('g-consultation-message').value = consultation.message;
  syncGameConsultation();
  gameImageFile = null;
  byId('g-image-file').value = '';
  setImagePreview('game', null, byId('g-img').value);
  byId('g-upload-status').textContent = 'PNG, JPG, WEBP atau GIF.';
  const known = ['name','platform','badge','badgeTitle','oos','active','hidden','img','image','video','purchaseNoticeEnabled','purchaseNoticeTitle','purchaseNoticeBody','consultation','konsultasi','consult','whatsapp','phone','consultationButton','consultationMessage'];
  byId('extra-json').value = JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => !known.includes(key))), null, 2);
  byId('editor-modal').hidden = false;
}

function closeEditor() { byId('editor-modal').hidden = true; editingKey = null; activeDraftId = ''; }
byId('editor-close').addEventListener('click', closeEditor);
byId('editor-cancel').addEventListener('click', closeEditor);
byId('editor-modal').addEventListener('click', event => { if (event.target === byId('editor-modal')) closeEditor(); });

byId('editor-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, 'Publish...');
  try {
    const payload = collectEditorPayload();
    await publishPayload(payload);
    if (activeDraftId) writeDrafts(readDrafts().filter(draft => draft.id !== activeDraftId));
    closeEditor();
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

byId('editor-save-draft').addEventListener('click', saveCurrentDraft);
byId('editor-preview').addEventListener('click', () => {
  try {
    const payload = collectEditorPayload();
    showItemPreview(payload.mode, payload.item);
  } catch (error) { notify(error.message, true); }
});
byId('preview-close').addEventListener('click', () => { byId('preview-modal').hidden = true; });
byId('preview-ok').addEventListener('click', () => { byId('preview-modal').hidden = true; });
byId('preview-modal').addEventListener('click', event => { if (event.target === byId('preview-modal')) byId('preview-modal').hidden = true; });

byId('clear-drafts').addEventListener('click', () => {
  if (!readDrafts().length) return notify('Tiada draft untuk dibuang.', true);
  if (!confirm('Buang semua draft pada browser ini?')) return;
  writeDrafts([]);
  notify('Semua draft dibuang.');
});

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

function normalizeAdminWhatsAppLink(value) {
  const raw = String(value || '').trim();
  const linkMatch = raw.match(/https?:\/\/(?:www\.)?wa\.me\/([a-z0-9._-]+)/i);
  if (linkMatch) return 'https://wa.me/' + linkMatch[1];
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '60' + digits.slice(1);
  if (/^\d{8,15}$/.test(digits)) return 'https://wa.me/' + digits;
  const target = raw.replace(/^@/, '');
  return /^[a-z0-9._-]{3,64}$/i.test(target) ? 'https://wa.me/' + target : '';
}

async function saveArray(path, value, message) {
  await saveStorePath(path, value, message);
}

function writeConfigEditor() {
  byId('config-editor').value = JSON.stringify(storeConfig, null, 2);
  byId('main-whatsapp-number').value = storeConfig.whatsapp_link || storeConfig.whatsappLink || storeConfig.whatsapp_number || storeConfig.whatsappNumber || storeConfig.contact?.whatsapp || storeConfig.support?.whatsapp || '';
  byId('quick-open').checked = storeConfig.bukakedai !== false && String(storeConfig.bukakedai).toLowerCase() !== 'false';
  byId('quick-maintenance').checked = storeConfig.maintenance === true || String(storeConfig.maintenance).toLowerCase() === 'true';
  byId('quick-review-maintenance').checked = storeConfig.review_maintenance === true || String(storeConfig.review_maintenance).toLowerCase() === 'true';
  byId('quick-reviews-area').checked = storeConfig.reviews_section_visible !== false && String(storeConfig.reviews_section_visible).toLowerCase() !== 'false';
  byId('quick-banner').checked = storeConfig.promo_banner_active === true || String(storeConfig.promo_banner_active).toLowerCase() === 'true';
  byId('quick-spotlight').checked = storeConfig.product_spotlight_enabled !== false && String(storeConfig.product_spotlight_enabled).toLowerCase() !== 'false';
  const orderFlow = storeConfig.order_flow || storeConfig.orderFlow || {};
  byId('order-flow-enabled').checked = orderFlow.enabled === true || String(orderFlow.enabled).toLowerCase() === 'true';
  byId('order-flow-recipient').value = orderFlow.recipient || orderFlow.accountName || '';
  byId('order-flow-instructions').value = orderFlow.instructions || '';
  byId('order-flow-qr-url').value = orderFlow.qrImage || orderFlow.qr_image || orderFlow.qrUrl || '';
  setOrderQrPreview(byId('order-flow-qr-url').value);
}

['quick-open','quick-maintenance','quick-review-maintenance','quick-reviews-area','quick-banner','quick-spotlight'].forEach(id => byId(id).addEventListener('change', () => {
  try {
    const current = JSON.parse(byId('config-editor').value || '{}');
    current.bukakedai = byId('quick-open').checked;
    current.maintenance = byId('quick-maintenance').checked;
    current.review_maintenance = byId('quick-review-maintenance').checked;
    current.reviews_section_visible = byId('quick-reviews-area').checked;
    current.promo_banner_active = byId('quick-banner').checked;
    current.product_spotlight_enabled = byId('quick-spotlight').checked;
    byId('config-editor').value = JSON.stringify(current, null, 2);
  } catch (error) { notify('Betulkan JSON dahulu sebelum guna quick toggle.', true); }
}));

byId('save-main-whatsapp').addEventListener('click', async event => {
  const button = event.currentTarget;
  const link = normalizeAdminWhatsAppLink(byId('main-whatsapp-number').value);
  if (!link) { notify('Masukkan nombor atau link WhatsApp yang sah.', true); return; }
  byId('main-whatsapp-number').value = link;
  setBusy(button, true, 'Menyimpan...');
  try {
    await saveStorePath('config/whatsapp_link', link, 'Link WhatsApp seluruh website sudah ditukar.');
    const current = JSON.parse(byId('config-editor').value || '{}');
    current.whatsapp_link = link;
    byId('config-editor').value = JSON.stringify(current, null, 2);
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

byId('save-config').addEventListener('click', async event => {
  const button = event.currentTarget;
  let value;
  try { value = JSON.parse(byId('config-editor').value || '{}'); }
  catch (error) { notify('JSON tetapan tidak sah: ' + error.message, true); return; }
  if (!value || Array.isArray(value) || typeof value !== 'object') { notify('Tetapan mesti object JSON.', true); return; }
  setBusy(button, true, 'Menyimpan...');
  try {
    await saveStorePath('config', value, 'Tetapan kedai disimpan realtime.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

function setOrderQrPreview(url = '', file = null) {
  const preview = byId('order-flow-qr-preview');
  if (!preview) return;
  if (file) {
    const objectUrl = URL.createObjectURL(file);
    preview.innerHTML = '<img src="' + objectUrl + '" alt="Preview QR pembayaran">';
    preview.querySelector('img').addEventListener('load', () => URL.revokeObjectURL(objectUrl), {once:true});
  } else if (url) {
    preview.innerHTML = '<img src="' + escapeHtml(url) + '" alt="QR pembayaran">';
  } else {
    preview.innerHTML = '<i class="fa-solid fa-qrcode"></i><span>Preview QR</span>';
  }
}

byId('order-flow-pick-qr').addEventListener('click', () => byId('order-flow-qr-file').click());
byId('order-flow-qr-file').addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return notify('Pilih fail gambar QR yang sah.', true);
  if (file.size > 32 * 1024 * 1024) return notify('Gambar QR melebihi had 32MB.', true);
  orderQrFile = file;
  setOrderQrPreview('', file);
});
byId('order-flow-qr-url').addEventListener('change', event => setOrderQrPreview(event.target.value.trim()));

byId('order-flow-upload-qr').addEventListener('click', async event => {
  const button = event.currentTarget;
  let savedKey = '';
  try { savedKey = localStorage.getItem(IMGBB_KEY_STORAGE) || ''; } catch (error) {}
  const key = byId('imgbb-api-key').value.trim() || savedKey;
  if (!key) return notify('Simpan API key ImgBB di bahagian Tetapan dahulu.', true);
  if (!orderQrFile) return notify('Pilih gambar QR dahulu.', true);
  setBusy(button, true, 'Uploading...');
  try {
    const form = new FormData();
    form.append('image', orderQrFile, orderQrFile.name);
    form.append('name', 'h4sx-payment-qr');
    const response = await fetchWithTimeout('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key), {method:'POST', body:form}, 45000);
    const result = await response.json();
    if (!response.ok || !result.success || !result.data?.url) throw new Error(result?.error?.message || 'Upload QR gagal.');
    const imageUrl = result.data.display_url || result.data.url;
    byId('order-flow-qr-url').value = imageUrl;
    setOrderQrPreview(imageUrl);
    notify('QR berjaya diupload. Tekan Simpan Tetapan Order.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

byId('save-order-flow').addEventListener('click', async event => {
  const button = event.currentTarget;
  const value = {
    enabled: byId('order-flow-enabled').checked,
    recipient: byId('order-flow-recipient').value.trim(),
    instructions: byId('order-flow-instructions').value.trim(),
    qrImage: byId('order-flow-qr-url').value.trim()
  };
  if (value.enabled && !value.qrImage) return notify('Masukkan atau upload gambar QR sebelum aktifkan feature.', true);
  if (value.qrImage && !validMediaUrl(value.qrImage)) return notify('URL gambar QR tidak sah.', true);
  setBusy(button, true, 'Menyimpan...');
  try {
    await saveStorePath('config/order_flow', value, value.enabled ? 'Pesanan pelanggan sudah diaktifkan.' : 'Pesanan pelanggan sudah ditutup.');
    const current = JSON.parse(byId('config-editor').value || '{}');
    current.order_flow = value;
    byId('config-editor').value = JSON.stringify(current, null, 2);
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

const CUSTOMER_ORDER_STATUS_LIST = ['Menunggu Pembayaran','Menunggu Pengesahan','Sudah Dibayar','Sedang Diproses','Completed','Dibatalkan'];
const CUSTOMER_ORDER_SOUND_KEY = 'h4sx_customer_order_sound_enabled';

function customerOrderSoundEnabled() {
  try { return localStorage.getItem(CUSTOMER_ORDER_SOUND_KEY) !== 'false'; }
  catch (error) { return true; }
}

function syncCustomerOrderSoundButton() {
  const button = byId('customer-order-sound-toggle');
  if (!button) return;
  const enabled = customerOrderSoundEnabled();
  button.classList.toggle('is-off', !enabled);
  button.querySelector('i').className = enabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  button.querySelector('span').textContent = enabled ? 'Bunyi ON' : 'Bunyi OFF';
}

function speakNewCustomerOrder(count = 1, force = false) {
  if (!force && !customerOrderSoundEnabled()) return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    if (force) notify('Browser ini tidak menyokong suara notification.', true);
    return;
  }
  const text = count > 1 ? count + ' order baru masuk' : 'Order baru masuk';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ms-MY';
  utterance.rate = 0.92;
  utterance.pitch = 1.05;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(item => /^ms[-_]/i.test(item.lang))
    || voices.find(item => /^id[-_]/i.test(item.lang))
    || voices.find(item => /^en[-_]/i.test(item.lang));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function announceNewCustomerOrders(orders) {
  const count = orders.length;
  speakNewCustomerOrder(count);
  notify(count > 1 ? count + ' order baru masuk!' : 'Order baru masuk: ' + orders[0].id);
}

function effectiveAdminOrderStatus(order) {
  return order.status === 'Menunggu Pembayaran' && customerOrderClaims[order.id] ? 'Menunggu Pengesahan' : order.status;
}

function formatAdminOrderDate(value) {
  const date = new Date(Number(value || 0));
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('ms-MY', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function generateDeliveryAccessToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function deliveryBytesFromHex(value) {
  const hex = String(value || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error('Kod akses serahan tidak sah.');
  return new Uint8Array(hex.match(/.{2}/g).map(pair => parseInt(pair, 16)));
}

function deliveryBytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function deliveryBytesFromBase64(value) {
  return Uint8Array.from(atob(String(value || '')), char => char.charCodeAt(0));
}

async function encryptOrderDelivery(data, token) {
  const key = await crypto.subtle.importKey('raw', deliveryBytesFromHex(token), {name:'AES-GCM'}, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, new TextEncoder().encode(JSON.stringify(data)));
  return {v:1, iv:deliveryBytesToBase64(iv), data:deliveryBytesToBase64(new Uint8Array(encrypted))};
}

async function decryptOrderDelivery(cipher, token) {
  const key = await crypto.subtle.importKey('raw', deliveryBytesFromHex(token), {name:'AES-GCM'}, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:deliveryBytesFromBase64(cipher.iv)}, key, deliveryBytesFromBase64(cipher.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

function renderCustomerOrders() {
  const list = byId('customer-orders-list');
  if (!list) return;
  const query = byId('customer-order-search')?.value.trim().toLowerCase() || '';
  const filter = byId('customer-order-filter')?.value || '';
  const sorted = [...customerOrders].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const filtered = sorted.filter(order => {
    const privateData = customerOrderPrivate[order.id] || {};
    const status = effectiveAdminOrderStatus(order);
    const haystack = [order.id, status, order.phoneMasked, privateData.phone, privateData.customerName, ...(Array.isArray(order.items) ? order.items.map(item => item.name) : Object.values(order.items || {}).map(item => item.name))].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (!filter || status === filter);
  });
  const pendingCount = customerOrders.filter(order => effectiveAdminOrderStatus(order) === 'Menunggu Pengesahan').length;
  const badge = byId('pending-order-count');
  if (badge) { badge.textContent = pendingCount; badge.hidden = !pendingCount; }
  list.innerHTML = filtered.length ? filtered.map(order => {
    const privateData = customerOrderPrivate[order.id] || {};
    const items = Array.isArray(order.items) ? order.items : Object.values(order.items || {});
    const status = effectiveAdminOrderStatus(order);
    const delivery = customerOrderDeliveryCache[order.id] || {};
    const statusOptions = CUSTOMER_ORDER_STATUS_LIST.map(value => '<option value="' + value + '"' + (value === status ? ' selected' : '') + '>' + value + '</option>').join('');
    return '<article class="customer-order-row status-' + escapeHtml(status.toLowerCase().replace(/\s+/g, '-')) + '">' +
      '<div class="customer-order-row-head"><div><span>' + escapeHtml(status) + '</span><strong>' + escapeHtml(order.id) + '</strong><small>' + formatAdminOrderDate(order.createdAt) + '</small></div><b>RM' + Number(order.total || 0).toFixed(2) + '</b></div>' +
      '<div class="customer-order-row-info"><div><small>PELANGGAN</small><strong>' + escapeHtml(privateData.customerName || 'Data private belum dimuat') + '</strong><span>' + escapeHtml(privateData.phone || order.phoneMasked || '-') + '</span></div><div><small>ITEM</small><strong>' + escapeHtml(items.map(item => item.name + ' ×' + Number(item.qty || 1)).join(', ') || '-') + '</strong><span>' + escapeHtml(privateData.username ? 'Username: ' + privateData.username : '') + '</span></div></div>' +
      (privateData.note ? '<div class="customer-order-note"><i class="fa-regular fa-note-sticky"></i><span><b>Nota pelanggan</b>' + escapeHtml(privateData.note) + '</span></div>' : '') +
      '<div class="customer-order-admin-note"><label><span><i class="fa-solid fa-user-shield"></i> NOTA ADMIN UNTUK PELANGGAN</span><textarea data-order-admin-note="' + escapeHtml(order.id) + '" maxlength="400" rows="2" placeholder="Contoh: Bayaran dah disahkan. Sila chat admin untuk proses pesanan.">' + escapeHtml(order.adminNote || '') + '</textarea></label><button class="ghost" data-action="save-customer-order-note" data-id="' + escapeHtml(order.id) + '"><i class="fa-solid fa-note-sticky"></i> Simpan nota</button></div>' +
      '<div class="customer-order-delivery-editor"><div class="customer-order-delivery-editor-head"><div><span>SERAHAN SELAMAT</span><strong>Akaun, email atau license</strong></div><button class="ghost" data-action="copy-delivery-access" data-id="' + escapeHtml(order.id) + '"><i class="fa-solid fa-key"></i> Copy Kod Akses</button></div><div class="customer-order-delivery-fields">' +
      '<label>Nama / Username<input data-delivery-field="username" value="' + escapeHtml(delivery.username || '') + '" placeholder="Username akaun"></label>' +
      '<label>Password Akaun<input data-delivery-field="password" value="' + escapeHtml(delivery.password || '') + '" placeholder="Password akaun"></label>' +
      '<label>Email<input data-delivery-field="email" value="' + escapeHtml(delivery.email || '') + '" placeholder="Email jika perlu"></label>' +
      '<label>Password Email<input data-delivery-field="emailPassword" value="' + escapeHtml(delivery.emailPassword || '') + '" placeholder="Password email jika perlu"></label>' +
      '<label class="wide">License / Kod Pengaktifan<input data-delivery-field="licenseKey" value="' + escapeHtml(delivery.licenseKey || '') + '" placeholder="License key atau kod aktivasi aplikasi"></label></div><button class="primary" data-action="save-customer-delivery" data-id="' + escapeHtml(order.id) + '"><i class="fa-solid fa-shield-halved"></i> Simpan Maklumat Serahan</button></div>' +
      '<div class="customer-order-row-actions"><select data-order-status="' + escapeHtml(order.id) + '">' + statusOptions + '</select><button class="primary" data-action="save-customer-order" data-id="' + escapeHtml(order.id) + '"><i class="fa-solid fa-floppy-disk"></i> Simpan status</button>' +
      (status === 'Menunggu Pengesahan' ? '<button class="confirm-payment" data-action="confirm-customer-payment" data-id="' + escapeHtml(order.id) + '"><i class="fa-solid fa-check-double"></i> Confirm Bayaran</button>' : '') +
      '<button class="delete-customer-order" data-action="delete-customer-order" data-id="' + escapeHtml(order.id) + '"><i class="fa-solid fa-trash"></i> Delete</button></div></article>';
  }).join('') : '<div class="empty">Tiada pesanan sepadan.</div>';
  hydrateCustomerOrderDeliveries(filtered);
}

async function hydrateCustomerOrderDeliveries(orders) {
  for (const order of orders) {
    if (!order.deliveryCipher || customerOrderDeliveryCache[order.id]) continue;
    const token = customerOrderPrivate[order.id]?.deliveryToken;
    if (!token) continue;
    try {
      customerOrderDeliveryCache[order.id] = await decryptOrderDelivery(order.deliveryCipher, token);
      const row = document.querySelector('[data-order-admin-note="' + CSS.escape(order.id) + '"]')?.closest('.customer-order-row');
      Object.entries(customerOrderDeliveryCache[order.id]).forEach(([key, value]) => {
        const input = row?.querySelector('[data-delivery-field="' + CSS.escape(key) + '"]');
        if (input && !input.value) input.value = value;
      });
    } catch (error) {}
  }
}

async function updateCustomerOrderStatus(orderId, status, button) {
  const order = customerOrders.find(item => item.id === orderId);
  if (!order) return notify('Order tidak dijumpai.', true);
  setBusy(button, true, 'Menyimpan...');
  try {
    const updates = {
      [ROOT + '/customer_orders/' + orderId + '/status']: status,
      [ROOT + '/customer_orders/' + orderId + '/updatedAt']: firebase.database.ServerValue.TIMESTAMP
    };
    if (status === 'Sudah Dibayar') updates[ROOT + '/customer_orders/' + orderId + '/paidAt'] = firebase.database.ServerValue.TIMESTAMP;
    if (status === 'Completed') updates[ROOT + '/customer_orders/' + orderId + '/completedAt'] = firebase.database.ServerValue.TIMESTAMP;
    if (status !== 'Menunggu Pengesahan') updates[ROOT + '/customer_payment_claims/' + orderId] = null;
    await withTimeout(database.ref().update(updates), 'Kemaskini status order');
    notify('Status ' + orderId + ' ditukar kepada ' + status + '.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
}

async function updateCustomerOrderAdminNote(orderId, button) {
  const order = customerOrders.find(item => item.id === orderId);
  if (!order) return notify('Order tidak dijumpai.', true);
  const input = document.querySelector('[data-order-admin-note="' + CSS.escape(orderId) + '"]');
  const note = String(input?.value || '').trim().slice(0, 400);
  setBusy(button, true, 'Menyimpan...');
  try {
    await withTimeout(database.ref().update({
      [ROOT + '/customer_orders/' + orderId + '/adminNote']: note || null,
      [ROOT + '/customer_orders/' + orderId + '/adminNoteUpdatedAt']: note ? firebase.database.ServerValue.TIMESTAMP : null,
      [ROOT + '/customer_orders/' + orderId + '/updatedAt']: firebase.database.ServerValue.TIMESTAMP
    }), 'Simpan nota admin');
    notify(note ? 'Nota admin disimpan dan terus dipaparkan kepada pelanggan.' : 'Nota admin dibuang.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
}

async function ensureCustomerDeliveryToken(orderId) {
  let token = String(customerOrderPrivate[orderId]?.deliveryToken || '').trim();
  if (/^[a-f0-9]{64}$/i.test(token)) return token;
  token = generateDeliveryAccessToken();
  await withTimeout(database.ref('customer_order_private/' + orderId + '/deliveryToken').set(token), 'Jana kod akses serahan');
  customerOrderPrivate[orderId] = {...(customerOrderPrivate[orderId] || {}), deliveryToken:token};
  return token;
}

async function saveCustomerOrderDelivery(orderId, button) {
  const row = button.closest('.customer-order-row');
  const delivery = {};
  row?.querySelectorAll('[data-delivery-field]').forEach(input => {
    const value = String(input.value || '').trim();
    if (value) delivery[input.dataset.deliveryField] = value.slice(0, 500);
  });
  setBusy(button, true, 'Encrypt & simpan...');
  try {
    const updates = {[ROOT + '/customer_orders/' + orderId + '/updatedAt']:firebase.database.ServerValue.TIMESTAMP};
    if (Object.keys(delivery).length) {
      const token = await ensureCustomerDeliveryToken(orderId);
      updates[ROOT + '/customer_orders/' + orderId + '/deliveryCipher'] = await encryptOrderDelivery(delivery, token);
      updates[ROOT + '/customer_orders/' + orderId + '/deliveryUpdatedAt'] = firebase.database.ServerValue.TIMESTAMP;
      customerOrderDeliveryCache[orderId] = delivery;
    } else {
      updates[ROOT + '/customer_orders/' + orderId + '/deliveryCipher'] = null;
      updates[ROOT + '/customer_orders/' + orderId + '/deliveryUpdatedAt'] = null;
      delete customerOrderDeliveryCache[orderId];
    }
    await withTimeout(database.ref().update(updates), 'Simpan maklumat serahan');
    notify(Object.keys(delivery).length ? 'Maklumat serahan dienkripsi dan disimpan.' : 'Maklumat serahan dibuang.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
}

async function copyCustomerDeliveryAccess(orderId, button) {
  setBusy(button, true, 'Menjana...');
  try {
    const token = await ensureCustomerDeliveryToken(orderId);
    await copyTextValue(token);
    notify('Kod Akses Serahan disalin. Hantar hanya kepada pelanggan order ini.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
}

async function deleteCustomerOrder(orderId, button) {
  const order = customerOrders.find(item => item.id === orderId);
  if (!order) return notify('Order tidak dijumpai.', true);
  if (!confirm('Delete pesanan ' + orderId + '?\n\nData order, maklumat pelanggan dan tuntutan bayaran akan dibuang. Tindakan ini tidak boleh dibuat asal.')) return;
  setBusy(button, true, 'Deleting...');
  try {
    await withTimeout(database.ref().update({
      [ROOT + '/customer_orders/' + orderId]: null,
      [ROOT + '/customer_payment_claims/' + orderId]: null,
      ['customer_order_private/' + orderId]: null
    }), 'Delete pesanan');
    notify('Pesanan ' + orderId + ' sudah dipadam.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
}

byId('refresh-customer-orders').addEventListener('click', renderCustomerOrders);
byId('customer-order-sound-toggle').addEventListener('click', () => {
  const enabled = !customerOrderSoundEnabled();
  try { localStorage.setItem(CUSTOMER_ORDER_SOUND_KEY, String(enabled)); } catch (error) {}
  syncCustomerOrderSoundButton();
  notify(enabled ? 'Bunyi order baru diaktifkan.' : 'Bunyi order baru dimatikan.');
  if (enabled) speakNewCustomerOrder(1, true);
});
byId('customer-order-sound-test').addEventListener('click', () => {
  speakNewCustomerOrder(1, true);
  notify('Test suara: Order baru masuk.');
});
byId('customer-order-search').addEventListener('input', renderCustomerOrders);
byId('customer-order-filter').addEventListener('change', renderCustomerOrders);
byId('customer-orders-list').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const orderId = button.dataset.id;
  if (button.dataset.action === 'delete-customer-order') return deleteCustomerOrder(orderId, button);
  if (button.dataset.action === 'confirm-customer-payment') return updateCustomerOrderStatus(orderId, 'Sudah Dibayar', button);
  if (button.dataset.action === 'save-customer-order-note') return updateCustomerOrderAdminNote(orderId, button);
  if (button.dataset.action === 'save-customer-delivery') return saveCustomerOrderDelivery(orderId, button);
  if (button.dataset.action === 'copy-delivery-access') return copyCustomerDeliveryAccess(orderId, button);
  if (button.dataset.action === 'save-customer-order') {
    const status = document.querySelector('[data-order-status="' + CSS.escape(orderId) + '"]')?.value;
    if (status) updateCustomerOrderStatus(orderId, status, button);
  }
});

syncCustomerOrderSoundButton();

function validMediaUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(String(value), location.href);
    return ['http:', 'https:', 'data:'].includes(url.protocol);
  } catch (error) { return false; }
}

function runHealthChecks() {
  const issues = [];
  const add = (severity, title, detail, action = '') => issues.push({severity, title, detail, action});
  const productIds = new Map();
  const gameNames = games.map(item => String(item.name || '').trim().toLowerCase()).filter(Boolean);

  products.forEach((item, index) => {
    const id = String(item.id ?? '').trim();
    if (!id) add('error', 'Produk tiada ID', item.name || 'Produk pada kedudukan ' + (index + 1), 'health-edit-product:' + index);
    else {
      if (productIds.has(id)) add('error', 'ID produk berganda #' + id, (products[productIds.get(id)]?.name || 'Produk') + ' dan ' + (item.name || 'Produk'), 'health-edit-product:' + index);
      else productIds.set(id, index);
    }
    if (!String(item.name || '').trim()) add('error', 'Nama produk kosong', 'Produk #' + (id || index + 1), 'health-edit-product:' + index);
    const consultation = item.consultation === true || item.konsultasi === true || item.consult === true;
    const price = Number(item.price);
    if (!consultation && (!Number.isFinite(price) || price < 0)) add('error', 'Harga produk tidak sah', (item.name || '#' + id) + ' mempunyai harga ' + String(item.price ?? 'kosong'), 'health-edit-product:' + index);
    if (item.stock !== undefined && (!Number.isFinite(Number(item.stock)) || Number(item.stock) < 0)) add('error', 'Stok produk tidak sah', item.name || '#' + id, 'health-edit-product:' + index);
    const image = item.img || item.image || item.poster || item.video;
    if (!image) add('warning', 'Produk tiada gambar', item.name || '#' + id, 'health-edit-product:' + index);
    else if (!validMediaUrl(image)) add('error', 'Link gambar produk rosak', item.name || '#' + id, 'health-edit-product:' + index);
    const group = String(item.game || item.gameGroup || '').trim().toLowerCase();
    if (!group) add('warning', 'Produk tiada kategori game', item.name || '#' + id, 'health-edit-product:' + index);
    else if (gameNames.length && !gameNames.some(name => name === group || name.includes(group) || group.includes(name))) add('warning', 'Kategori produk tidak sepadan', (item.name || '#' + id) + ' menggunakan "' + (item.game || item.gameGroup) + '"', 'health-edit-product:' + index);
    promoSources(item).forEach(promo => {
      const code = String(promo?.code || promo?.promoCode || '').trim();
      const discount = Number(promo?.discount ?? promo?.promoDiscount);
      const type = String(promo?.type ?? promo?.promoType ?? 'percent').toLowerCase();
      if (!code) add('error', 'Promo tanpa kod', item.name || '#' + id, 'health-edit-product:' + index);
      if (!Number.isFinite(discount) || discount <= 0 || (type === 'percent' && discount > 100)) add('error', 'Nilai promo tidak sah', (code || 'Promo') + ' pada ' + (item.name || '#' + id), 'health-edit-product:' + index);
      const starts = Date.parse(String(promo?.promoStartsAt || promo?.promoStartAt || ''));
      const expires = Date.parse(String(promo?.promoExpiresAt || ''));
      if (Number.isFinite(starts) && Number.isFinite(expires) && expires <= starts) add('error', 'Masa promo terbalik', (code || 'Promo') + ' tamat sebelum waktu mula', 'health-edit-product:' + index);
    });
  });

  const seenGames = new Map();
  games.forEach((item, index) => {
    const name = String(item.name || '').trim();
    const key = name.toLowerCase();
    if (!name) add('error', 'Nama game kosong', 'Game pada kedudukan ' + (index + 1), 'health-edit-game:' + index);
    else if (seenGames.has(key)) add('error', 'Nama game berganda', name, 'health-edit-game:' + index);
    else seenGames.set(key, index);
    const image = item.img || item.image || item.poster || item.video;
    if (!image) add('warning', 'Game tiada cover', name || 'Game ' + (index + 1), 'health-edit-game:' + index);
    else if (!validMediaUrl(image)) add('error', 'Link cover game rosak', name || 'Game ' + (index + 1), 'health-edit-game:' + index);
  });

  const whatsapp = storeConfig.whatsapp_link || storeConfig.whatsappLink || storeConfig.whatsapp_number || storeConfig.whatsappNumber || storeConfig.contact?.whatsapp || storeConfig.support?.whatsapp;
  if (!whatsapp) add('warning', 'WhatsApp utama belum ditetapkan', 'Pelanggan mungkin tidak dapat membuka support.', 'health-open-settings');
  else if (!normalizeAdminWhatsAppLink(whatsapp)) add('error', 'WhatsApp utama tidak sah', String(whatsapp), 'health-open-settings');
  if (!products.length) add('error', 'Inventory kosong', 'Tiada produk dijumpai dalam Firebase.');
  if (!games.length) add('error', 'Senarai game kosong', 'Tiada game dijumpai dalam Firebase.');

  renderHealthResults(issues);
  return issues;
}

function renderHealthResults(issues) {
  const errors = issues.filter(item => item.severity === 'error').length;
  const warnings = issues.filter(item => item.severity === 'warning').length;
  const summary = byId('health-summary');
  summary.className = 'health-summary ' + (errors ? 'has-errors' : warnings ? 'has-warnings' : 'is-healthy');
  summary.innerHTML = '<div><strong>' + errors + '</strong><span>Error</span></div><div><strong>' + warnings + '</strong><span>Amaran</span></div><div><strong>' + products.length + '</strong><span>Produk disemak</span></div><div><strong>' + games.length + '</strong><span>Game disemak</span></div>';
  const list = byId('health-results');
  list.innerHTML = issues.length ? issues.map(issue => {
    const action = issue.action ? '<button class="ghost" data-health-action="' + escapeHtml(issue.action) + '"><i class="fa-solid fa-arrow-right"></i> Buka</button>' : '';
    return '<article class="health-issue ' + issue.severity + '"><i class="fa-solid ' + (issue.severity === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation') + '"></i><div><strong>' + escapeHtml(issue.title) + '</strong><span>' + escapeHtml(issue.detail) + '</span></div>' + action + '</article>';
  }).join('') : '<div class="health-clean"><i class="fa-solid fa-circle-check"></i><strong>Semua nampak sihat</strong><span>Tiada masalah data utama dikesan.</span></div>';
}

byId('run-health-check').addEventListener('click', async event => {
  const button = event.currentTarget;
  setBusy(button, true, 'Scan...');
  try {
    await new Promise(resolve => window.setTimeout(resolve, 120));
    const issues = runHealthChecks();
    notify(issues.length ? 'Scan selesai. ' + issues.length + ' perkara dijumpai.' : 'Scan selesai. Semua sihat.');
  } catch (error) {
    console.error('Health scan failed:', error);
    notify(error?.message || 'Scan gagal. Cuba semula.', true);
  } finally {
    setBusy(button, false);
  }
});

document.addEventListener('click', event => {
  const button = event.target.closest('[data-health-action]');
  if (!button) return;
  const [action, rawIndex] = button.dataset.healthAction.split(':');
  const index = Number(rawIndex);
  if (action === 'health-edit-product' && products[index]) return openProductEditor(products[index], index);
  if (action === 'health-edit-game' && games[index]) return openGameEditor(games[index], index);
  if (action === 'health-open-settings') document.querySelector('[data-tab="settings"]')?.click();
});

async function fetchJson(url) {
  const response = await fetchWithTimeout(url + '?t=' + Date.now(), {cache:'no-store'}, 25000);
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
  const button = event.currentTarget;
  setBusy(button, true, 'Mengimport...');
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
    await replaceStoreRoot(payload, 'Import semua Gist', 'Import siap. Website sekarang baca Firebase realtime.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

byId('download-backup').addEventListener('click', async event => {
  const button = event.currentTarget;
  setBusy(button, true, 'Menyiapkan...');
  try {
    const snapshot = await withTimeout(database.ref(ROOT).once('value'), 'Muat turun backup');
    const blob = new Blob([JSON.stringify(snapshot.val() || {}, null, 2)], {type:'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'h4sx-firebase-backup-' + new Date().toISOString().slice(0,10) + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    notify('Backup dimuat turun.');
  } catch (error) { notify(error.message, true); }
  finally { setBusy(button, false); }
});

byId('restore-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file || !confirm('Restore akan menggantikan semua data store di Firebase. Teruskan?')) { event.target.value = ''; return; }
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !data.inventory || !data.games || !data.config) throw new Error('Format backup tidak lengkap.');
    await replaceStoreRoot(data, 'Pulihkan backup Firebase', 'Backup berjaya dipulihkan.');
  } catch (error) { notify(error.message, true); }
  event.target.value = '';
});
