
// --- REVIEW SYSTEM NOTICE POPUP ---
const REVIEW_SYSTEM_POPUP_KEY = 'h4sx_review_system_notice_hidden_until';
const REVIEW_SYSTEM_HIDE_MS = 90 * 60 * 1000;

function shouldShowReviewSystemPopup() {
  try {
    const hiddenUntil = Number(localStorage.getItem(REVIEW_SYSTEM_POPUP_KEY) || 0);
    return !hiddenUntil || Date.now() >= hiddenUntil;
  } catch (e) {
    return true;
  }
}

function openReviewSystemPopup() {
  const popup = document.getElementById('review-system-popup');
  if (!popup || !shouldShowReviewSystemPopup()) return;
  popup.classList.add('show');
  popup.setAttribute('aria-hidden', 'false');
}

function closeReviewSystemPopup(fromButton) {
  const popup = document.getElementById('review-system-popup');
  const hideCheck = document.getElementById('reviewSystemHideCheck');
  if (hideCheck?.checked) {
    try {
      localStorage.setItem(REVIEW_SYSTEM_POPUP_KEY, String(Date.now() + REVIEW_SYSTEM_HIDE_MS));
    } catch (e) {}
  }
  if (popup) {
    popup.classList.remove('show');
    popup.setAttribute('aria-hidden', 'true');
  }
  if (fromButton && typeof toast === 'function') {
    toast(hideCheck?.checked ? 'Notis disembunyikan selama 1 jam 30 minit.' : 'Notis ditutup.');
  }
}

function initReviewSystemPopup() {
  setTimeout(openReviewSystemPopup, 650);
}

﻿// --- ANTI-INSPECT / ANTI-COPY ---
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'F12') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.key === 'u') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.key === 'U') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.key === 'S') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'I') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'i') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'J') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'j') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'C') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'c') {
    e.preventDefault();
  }
});
// --- END ANTI-INSPECT ---

// --- DATE & TIME DISPLAY ---
function updateDateTime() {
  const now = new Date();
  const options = { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Kuala_Lumpur'
  };
  const dtEl = document.getElementById('datetime-display');
  if (dtEl) {
    dtEl.textContent = now.toLocaleString('ms-MY', options);
  }
  const closureDtEl = document.getElementById('closure-datetime');
  if (closureDtEl) {
    closureDtEl.textContent = now.toLocaleString('ms-MY', options);
  }
}
updateDateTime();
setInterval(updateDateTime, 1000);

// --- RECEIPT FUNCTIONS ---
let currentReceiptText = '';
let html2CanvasPromise = null;

function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (html2CanvasPromise) return html2CanvasPromise;
  html2CanvasPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    script.async = true;
    script.onload = () => resolve(window.html2canvas);
    script.onerror = () => reject(new Error('Gagal load html2canvas'));
    document.head.appendChild(script);
  });
  return html2CanvasPromise;
}

function generateReceiptCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'h4sx-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code.toUpperCase();
}

function formatReceiptDateTime() {
  const now = new Date();
  const options = { 
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'Asia/Kuala_Lumpur'
  };
  return now.toLocaleString('ms-MY', options);
}

function openReceipt() {
  const username = document.getElementById('roblox-username').value || '-';
  const receiptCode = generateReceiptCode();
  const receiptDatetime = formatReceiptDateTime();
  
  // Set receipt fields
  document.getElementById('receipt-code').textContent = receiptCode;
  document.getElementById('receipt-datetime').textContent = receiptDatetime;
  document.getElementById('receipt-username').textContent = username;
  
  // Build receipt items
  const receiptItemsEl = document.getElementById('receipt-items');
  receiptItemsEl.innerHTML = '';
  let total = 0;
  
  cartItems.forEach(ci => {
    const item = inventory.find(i => i.id === ci.id);
    if (!item) return;
    const itemTotal = item.price * ci.qty;
    total += itemTotal;
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);';
    div.innerHTML = `
      <div>
        <div style="font-size: 13px; font-weight: 700; color: var(--ink);">${item.name}</div>
        <div style="font-size: 11px; color: var(--muted);">x${ci.qty}</div>
      </div>
      <div style="font-size: 13px; font-weight: 800; color: var(--primary);">RM${itemTotal.toFixed(2)}</div>
    `;
    receiptItemsEl.appendChild(div);
  });
  
  document.getElementById('receipt-total').textContent = `RM${total.toFixed(2)}`;
  
  // Build receipt text for copy/WA
  currentReceiptText = `
H4SX STORE - RESIT PEMBELIAN
============================
No. Resit: ${receiptCode}
Tarikh & Masa: ${receiptDatetime}
Negara: Malaysia
Username Roblox: ${username}

Item Dibeli:
`;
  cartItems.forEach(ci => {
    const item = inventory.find(i => i.id === ci.id);
    if (!item) return;
    currentReceiptText += `- ${item.name} x${ci.qty} = RM${(item.price * ci.qty).toFixed(2)}\n`;
  });
  currentReceiptText += `
============================
Jumlah: RM${total.toFixed(2)}
============================
Terima kasih kerana membeli di H4SX STORE!
`;
  
  // Update WA link
  const waLink = document.getElementById('receipt-wa-link');
  waLink.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(currentReceiptText)}`;
  
  // Show modal
  const modal = document.getElementById('receipt-modal');
  modal.classList.add('show');
}

function closeReceipt() {
  const modal = document.getElementById('receipt-modal');
  modal.classList.remove('show');
}

function copyReceipt() {
  navigator.clipboard.writeText(currentReceiptText).then(() => {
    toast('Resit disalin ke papan keratan!', false);
  }).catch(err => {
    console.error('Copy failed:', err);
    toast('Gagal menyalin resit', true);
  });
}

async function getReceiptCanvas() {
  await ensureHtml2Canvas();
  const receiptContent = document.getElementById('receipt-content');
  return await html2canvas(receiptContent, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });
}

async function downloadReceiptImage() {
  try {
    toast('Sila tunggu, sedang memuat turun resit...', false);
    const canvas = await getReceiptCanvas();
    const link = document.createElement('a');
    link.download = `resit-h4sx-${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Resit berjaya dimuat turun!', false);
  } catch (error) {
    console.error('Download failed:', error);
    toast('Gagal memuat turun resit', true);
  }
}

async function copyReceiptImage() {
  try {
    toast('Sila tunggu, sedang menyalin gambar resit...', false);
    const canvas = await getReceiptCanvas();
    canvas.toBlob(async (blob) => {
      if (blob) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        toast('Gambar resit disalin ke papan keratan!', false);
      }
    });
  } catch (error) {
    console.error('Copy image failed:', error);
    toast('Gagal menyalin gambar resit', true);
  }
}

// --- CONFIGURATION ---
const BACKGROUND_3D_URL = 'https://sketchfab.com/3d-models/free-downloadable-pixel-earth-low-poly-139cb0a9b41a4e088dd42ca4871a3125'; 
// Tukar link kat atas ni je kalau nak tukar model background.
const GIST_ID = '5ed3872290715d7833e788c7b0014f79';
const WA_NUMBER = '60193263016';
const GAMES_GIST_URLS = [
  'https://gist.githubusercontent.com/amirpoyo1982-a11y/92b41c9122c025c2536e68353a82ee0f/raw/games.json',
  'https://gist.githubusercontent.com/amirpoyo1982-a11y/9bcbef00866205608fb46fc7a0ef5235/raw/games.json'
];
const INVENTORY_GIST_URLS = [
  'https://gist.githubusercontent.com/amirpoyo1982-a11y/' + GIST_ID + '/raw/inventory.json',
  'https://gist.githubusercontent.com/amirpoyo1982-a11y/9bcbef00866205608fb46fc7a0ef5235/raw/inventory.json'
];
const KEDAI_GIST_URL = 'https://gist.githubusercontent.com/amirpoyo1982-a11y/5ed3872290715d7833e788c7b0014f79/raw/kedai.json';

// === STORE CONFIG (Payment & Checkout Settings) ===
// Edit setting kat bawah ni untuk enable/disable QR dan username
let storeConfig = {
  payment: {
    duitNow: {
      enabled: true,
      qrUrl: 'https://i.ibb.co/bRyG06zY/image.png',
      accountName: 'Nurwazni'
    },
    tng: {
      enabled: true,
      qrUrl: 'https://i.ibb.co/bRyG06zY/image.png',
      accountName: 'Nurwazni'
    }
  },
  checkout: {
    requireRobloxUsername: true
  },
  warnBox: {
    showName: true,
    accountName: 'Nurwazni'
  },
  promote: {
    enabled: true
  }
};

let activePayMethod = 'duitnow';
let spamCounts = {};
let toastTimeouts = {};
const PAY_QR = {
  duitnow: { url:'https://i.ibb.co/bRyG06zY/image.png', name:'Nurwazni', sub:'DuitNow QR', wa:'DuitNow QR' },
  tng:     { url:'https://i.ibb.co/bRyG06zY/image.png', name:'Nurwazni', sub:"Touch 'n Go eWallet", wa:'TNG eWallet' }
};
let inventory = [], cartItems = [], currentGame = '', modalItemId = null;
let checkoutReq = { requireLogin:false, requirePassword:false, backupCodeCount:0 };
let kedaiConfigLoaded = false;
async function fetchKedaiJson() {
  const url = KEDAI_GIST_URL;
  try { 
    console.log('Fetching kedai.json from:', url);
    const r = await fetch(url + '?cb=' + Date.now(), { cache:'no-store' }); 
    console.log('Response status:', r.status);
    if (r.ok) {
      const text = await r.text();
      console.log('Response text:', text);
      const data = JSON.parse(text);
      console.log('Parsed data:', data);
      return data;
    }
  } catch(e) {
    console.error("Gist fetch error:", e);
  }
  return null;
}
function normalizeKedaiConfig(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    const cfgItem = data.find(item => item && typeof item === 'object' && (item.storeConfig || item.review_maintenance !== undefined || item.maintenance !== undefined));
    if (!cfgItem) return null;
    return cfgItem.storeConfig ? { ...cfgItem.storeConfig } : { ...cfgItem };
  }
  if (data.storeConfig && typeof data.storeConfig === 'object') {
    return { ...data.storeConfig, ...data };
  }
  return data;
}
function flagOn(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'on';
}
function flagOff(value) {
  return value === false || String(value).toLowerCase() === 'false' || String(value).toLowerCase() === 'close' || String(value).toLowerCase() === 'off';
}
function isPreviewBypass() {
  const params = new URLSearchParams(window.location.search);
  return params.get('preview') === '1' || params.get('preview') === 'true';
}
let promoBannerIndex = 0;
let promoBannerSlides = [];
let promoBannerTimer = null;
let promoBannerIntervalDelay = 5500;
let promoDragState = null;
function getPromoBannerSlides(config = currentStoreConfig) {
  const active = flagOn(config.promo_banner_active)
    || flagOn(config.promoBannerActive)
    || flagOn(config.banner_promo_active);
  if (!active) return [];

  let slides = config.promo_banners
    || config.promoBanners
    || config.promo_banner_slides
    || config.promoBannerSlides
    || [];

  if (!Array.isArray(slides) && slides && typeof slides === 'object') slides = [slides];
  if (!slides.length && (config.promo_banner_image || config.promo_banner_img || config.promoBannerImage)) {
    slides = [{
      img: config.promo_banner_image || config.promo_banner_img || config.promoBannerImage,
      mobileImg: config.promo_banner_mobile_image || config.promoBannerMobileImage || '',
      title: config.promo_banner_title || '',
      subtitle: config.promo_banner_subtitle || '',
      buttonText: config.promo_banner_button_text || '',
      link: config.promo_banner_link || ''
    }];
  }

  return slides
    .map((slide, index) => {
      if (!slide || typeof slide !== 'object') return null;
      const img = slide.img || slide.image || slide.imageUrl || slide.url || slide.desktopImg || '';
      if (!img) return null;
      return {
        id: slide.id || `promo-${index}`,
        img,
        mobileImg: slide.mobileImg || slide.mobileImage || slide.mobile_image || '',
        title: slide.title || '',
        subtitle: slide.subtitle || slide.desc || slide.description || '',
        buttonText: slide.buttonText || slide.button_text || slide.cta || '',
        link: slide.link || slide.href || slide.urlLink || '',
        alt: slide.alt || slide.title || 'Promosi H4SX STORE',
        position: slide.position || slide.objectPosition || 'center',
        fit: slide.fit || slide.objectFit || 'cover'
      };
    })
    .filter(Boolean);
}
function stopPromoBannerTimer() {
  if (promoBannerTimer) clearInterval(promoBannerTimer);
  promoBannerTimer = null;
}
function startPromoBannerTimer(delay = promoBannerIntervalDelay) {
  stopPromoBannerTimer();
  if (promoBannerSlides.length > 1) {
    promoBannerTimer = setInterval(() => showPromoBannerSlide(promoBannerIndex + 1), delay);
  }
}
function showPromoBannerSlide(index) {
  const root = document.getElementById('promo-hero');
  const track = document.getElementById('promo-hero-track');
  const dots = document.getElementById('promo-hero-dots');
  if (!root || !track || !promoBannerSlides.length) return;
  promoBannerIndex = (index + promoBannerSlides.length) % promoBannerSlides.length;
  track.style.transform = `translate3d(${-promoBannerIndex * 100}%,0,0)`;
  dots?.querySelectorAll('button').forEach((dot, i) => dot.classList.toggle('active', i === promoBannerIndex));
}
function initPromoBannerDrag() {
  const root = document.getElementById('promo-hero');
  const track = document.getElementById('promo-hero-track');
  if (!root || !track || root.dataset.dragReady === '1') return;
  root.dataset.dragReady = '1';

  function pointX(event) {
    return event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? event.clientX ?? 0;
  }
  function dragStart(event) {
    if (promoBannerSlides.length <= 1) return;
    promoDragState = {
      startX: pointX(event),
      currentX: pointX(event),
      width: root.getBoundingClientRect().width || 1,
      moved: false
    };
    stopPromoBannerTimer();
    root.classList.add('is-dragging');
    track.style.transition = 'none';
  }
  function dragMove(event) {
    if (!promoDragState) return;
    promoDragState.currentX = pointX(event);
    const delta = promoDragState.currentX - promoDragState.startX;
    if (Math.abs(delta) > 6) promoDragState.moved = true;
    const percent = (-promoBannerIndex * 100) + ((delta / promoDragState.width) * 100);
    track.style.transform = `translate3d(${percent}%,0,0)`;
    if (promoDragState.moved && event.cancelable) event.preventDefault();
  }
  function dragEnd() {
    if (!promoDragState) return;
    const delta = promoDragState.currentX - promoDragState.startX;
    const threshold = Math.max(45, promoDragState.width * 0.12);
    track.style.transition = '';
    root.classList.remove('is-dragging');
    if (Math.abs(delta) > threshold) {
      showPromoBannerSlide(promoBannerIndex + (delta < 0 ? 1 : -1));
    } else {
      showPromoBannerSlide(promoBannerIndex);
    }
    promoDragState = null;
    startPromoBannerTimer();
  }
  function blockClickAfterDrag(event) {
    if (promoDragState?.moved) event.preventDefault();
  }

  root.addEventListener('mousedown', dragStart);
  window.addEventListener('mousemove', dragMove);
  window.addEventListener('mouseup', dragEnd);
  root.addEventListener('mouseleave', dragEnd);
  root.addEventListener('touchstart', dragStart, { passive: true });
  root.addEventListener('touchmove', dragMove, { passive: false });
  root.addEventListener('touchend', dragEnd);
  root.addEventListener('touchcancel', dragEnd);
  root.addEventListener('click', blockClickAfterDrag, true);
  root.addEventListener('mouseenter', stopPromoBannerTimer);
  root.addEventListener('mouseleave', () => {
    if (!promoDragState) startPromoBannerTimer();
  });
}
function renderPromoBanner(config = currentStoreConfig) {
  const root = document.getElementById('promo-hero');
  const track = document.getElementById('promo-hero-track');
  const dots = document.getElementById('promo-hero-dots');
  const prev = document.getElementById('promo-hero-prev');
  const next = document.getElementById('promo-hero-next');
  if (!root || !track || !dots) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => renderPromoBanner(config), { once: true });
    } else {
      setTimeout(() => renderPromoBanner(config), 250);
    }
    return;
  }

  stopPromoBannerTimer();
  promoBannerSlides = getPromoBannerSlides(config);
  promoBannerIndex = 0;

  if (!promoBannerSlides.length) {
    root.classList.add('is-hidden');
    track.innerHTML = '';
    dots.innerHTML = '';
    return;
  }

  root.classList.remove('is-hidden');
  track.innerHTML = promoBannerSlides.map(slide => {
    const mobileSource = slide.mobileImg
      ? '<source media="(max-width: 640px)" srcset="' + escapeHtml(slide.mobileImg) + '">'
      : '';
    const copy = (slide.title || slide.subtitle || slide.buttonText)
      ? '<div class="promo-hero-copy">'
        + (slide.title ? '<strong>' + escapeHtml(slide.title) + '</strong>' : '')
        + (slide.subtitle ? '<span>' + escapeHtml(slide.subtitle) + '</span>' : '')
        + (slide.buttonText ? '<em>' + escapeHtml(slide.buttonText) + '</em>' : '')
        + '</div>'
      : '';
    const inner = '<picture>' + mobileSource
      + '<img src="' + escapeHtml(slide.img) + '" alt="' + escapeHtml(slide.alt) + '" style="object-position:' + escapeHtml(slide.position) + ';object-fit:' + escapeHtml(slide.fit) + '">'
      + '</picture>' + copy;
    return slide.link
      ? '<a class="promo-hero-slide" href="' + escapeHtml(slide.link) + '" target="_blank" rel="noopener">' + inner + '</a>'
      : '<div class="promo-hero-slide">' + inner + '</div>';
  }).join('');
  dots.innerHTML = promoBannerSlides.map((slide, i) =>
    '<button type="button" aria-label="Promosi ' + (i + 1) + '" data-promo-dot="' + i + '"></button>'
  ).join('');

  const multiple = promoBannerSlides.length > 1;
  prev.style.display = multiple ? '' : 'none';
  next.style.display = multiple ? '' : 'none';
  dots.style.display = multiple ? '' : 'none';
  dots.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => showPromoBannerSlide(Number(btn.dataset.promoDot || 0)));
  });
  prev.onclick = () => showPromoBannerSlide(promoBannerIndex - 1);
  next.onclick = () => showPromoBannerSlide(promoBannerIndex + 1);

  showPromoBannerSlide(0);
  if (multiple) {
    promoBannerIntervalDelay = Math.max(2500, Number(config.promo_banner_interval || config.promoBannerInterval || 5500));
    startPromoBannerTimer();
  }
  initPromoBannerDrag();
}
const CHANGELOG_VERSION = 'v1.4';
const CHANGELOG_STORAGE_KEY = 'h4sx_changelog_' + CHANGELOG_VERSION + '_dismissed';
function getChangelogReleaseDate() { return new Date(); }
function openChangelog(manual) {
  const modal = document.getElementById('changelog-modal');
  if (!modal) return;
  const dateEl = document.getElementById('changelog-date-text');
  const timeEl = document.getElementById('changelog-time-text');
  if (dateEl) {
    dateEl.textContent = getChangelogReleaseDate().toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (timeEl) {
    timeEl.textContent = getChangelogReleaseDate().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
  }
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeChangelog() {
  const modal = document.getElementById('changelog-modal');
  if (!modal) return;
  modal.classList.remove('show');
  if (!document.getElementById('cart-overlay')?.classList.contains('show') &&
      !document.getElementById('search-overlay')?.classList.contains('show') &&
      !document.getElementById('product-modal')?.classList.contains('show')) {
    document.body.style.overflow = '';
  }
}
function dismissChangelog() {
  try { localStorage.setItem(CHANGELOG_STORAGE_KEY, '1'); } catch (e) {}
  closeChangelog();
}
function changelogBackdrop(e) {
  if (e.target === document.getElementById('changelog-modal')) dismissChangelog();
}
function initChangelog() {
  try {
    if (!localStorage.getItem(CHANGELOG_STORAGE_KEY)) {
      setTimeout(() => openChangelog(false), 1000);
    }
  } catch (e) {
    setTimeout(() => openChangelog(false), 1000);
  }
}
function toggleMenu() {
  const m = document.getElementById('mob-menu');
  const h = document.querySelector('.nav-ham');
  if (!m) return;
  const open = !m.classList.contains('show');
  m.classList.toggle('show', open);
  h?.classList.toggle('is-open', open);
}
const VIEWS = ['home-view','product-view','checkout-view'];
function showView(id) {
  VIEWS.forEach(v => {
    const el = document.getElementById(v);
    if (v === id) { el.classList.remove('hidden','view-enter'); void el.offsetWidth; el.classList.add('view-enter'); el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  });
  window.scrollTo({ top:0, behavior:'smooth' });
}
function showHome() {
  currentGame = '';
  updateGameUrl('');
  showView('home-view');
}
function gameSlug(name) {
  return String(name || '').trim().toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
function updateGameUrl(name) {
  try {
    const url = new URL(window.location.href);
    if (name) {
      url.searchParams.set('game', gameSlug(name));
      url.searchParams.set('part', normalizeKey(activePlatform));
    } else {
      url.searchParams.delete('game');
      url.searchParams.delete('part');
    }
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch(e) {}
}
function getGameFromUrl() {
  try {
    const url = new URL(window.location.href);
    const part = (url.searchParams.get('part') || '').trim();
    if (part) activePlatform = /free-fire|ff/i.test(part) ? 'Free Fire' : 'Roblox';
    return (url.searchParams.get('game') || '').trim();
  } catch(e) {
    return '';
  }
}
function findGameByRoute(value) {
  const target = String(value || '').trim().toLowerCase();
  if (!target) return '';
  return (catalogGames(true).find(g =>
    String(g.name || '').toLowerCase() === target ||
    gameSlug(g.name) === target
  )?.name) || '';
}
function openGameFromUrl() {
  const route = getGameFromUrl();
  if (!route) return false;
  const name = findGameByRoute(route);
  if (!name) return false;
  openGame(name, { fromUrl: true });
  return true;
}
function currentGameLink() {
  const url = new URL(window.location.href);
  url.searchParams.set('game', gameSlug(currentGame));
  url.searchParams.set('part', normalizeKey(activePlatform));
  return url.toString();
}
async function copyCurrentGameLink() {
  if (!currentGame) { toast('Pilih kategori dulu', true); return; }
  const link = currentGameLink();
  try {
    await navigator.clipboard.writeText(link);
    toast('Link kategori disalin!');
  } catch(e) {
    window.prompt('Copy link kategori:', link);
  }
}
function getStickyOffset() {
  return 16;
}
function smoothScrollWithHeader(el) {
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - getStickyOffset();
  window.scrollTo({ top: Math.max(0, y), behavior:'smooth' });
}
function goSection(id) {
  if (!document.getElementById('home-view').classList.contains('hidden')) { smoothScrollWithHeader(document.getElementById(id)); }
  else { showHome(); setTimeout(() => smoothScrollWithHeader(document.getElementById(id)), 500); }
}
function backCO() { currentGame ? showView('product-view') : showHome(); }
// --- BUSINESS HOURS & STORE STATUS ---
let currentStoreConfig = {
  bukakedai: true,
  maintenance: false,
  review_maintenance: false,
  review_maintenance_message: 'Feature ulasan sedang diproses dan dikemas semula. Kemungkinan besar sistem ulasan akan berfungsi kembali dalam sekitar 2 hari lagi.',
  promo_banner_active: false,
  promo_banner_interval: 5500,
  promo_banners: [],
  buka_jam: "09:00", // 9 AM
  tutup_jam: "23:00", // 11 PM
  tutup_hari: ["Jumaat"], // Days to close (e.g., ["Jumaat", "Ahad"])
  business_hours_text: "Isnin - Khamis: 9AM - 11PM | Jumaat: Tutup",
  // Announcement settings
  announcement_active: false,
  announcement_id: "v1", // Change this ID every time you want a new popup
  announcement_title: "KEMASKINI BARU!",
  announcement_subtitle: "Barang baru ditambah!",
  announcement_message: "Kami telah menambah item-item baru! Sila semak katalog kami.",
  announcement_button_text: "Saya faham"
};

// Announcement lama dimatikan. Field announcement_* dalam kedai.json tidak lagi membuka popup.
function checkAndShowAnnouncement() {
  return;
}
function closeAnnDetails() {
  return;
}
function isTimeWithinRange(currentTime, startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const currentTotal = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;
  
  // LOGIK BARU: SOKONG KEDAI LAJAK TENGAH MALAM
  if (startTotal < endTotal) {
    // Kes Biasa: Contoh 09:00 pagi hingga 23:00 malam (Hari yang sama)
    return currentTotal >= startTotal && currentTotal < endTotal;
  } else {
    // Kes Lintas Tengah Malam: Contoh 09:00 pagi hingga 03:00 pagi (Lajak ke esok hari)
    return currentTotal >= startTotal || currentTotal < endTotal;
  }
}

function getDayNameInMalay(date) {
  const days = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  return days[date.getDay()];
}

function shouldStoreCloseAutomatically(config) {
  const now = new Date();
  const klTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
  
  console.log('Checking store status...');
  console.log('Current KL Time:', klTime.toString());
  console.log('Config:', JSON.stringify(config, null, 2));
  
  // Check if today is a closed day
  const todayName = getDayNameInMalay(klTime);
  console.log('Today (MY):', todayName);
  
  if (config.tutup_hari && config.tutup_hari.includes(todayName)) {
    console.log('Store closed: Hari Tutup');
    return { closed: true, reason: "Hari Tutup" };
  }
  
  // Check time range
  if (config.buka_jam && config.tutup_jam) {
    console.log('Checking time range:', config.buka_jam, '-', config.tutup_jam);
    if (!isTimeWithinRange(klTime, config.buka_jam, config.tutup_jam)) {
      console.log('Store closed: Luar Waktu Operasi');
      return { closed: true, reason: "Luar Waktu Operasi" };
    }
  }
  
  console.log('Store is OPEN!');
  return { closed: false, reason: "" };
}

function updateBusinessHoursDisplay(config, isOpen) {
  const hoursTextEl = document.getElementById('business-hours-text');
  const statusTextEl = document.getElementById('bh-status-text');
  const statusDotEl = document.querySelector('.bh-dot');
  const statusEl = document.getElementById('bh-status');
  
  if (hoursTextEl && config.business_hours_text) {
    hoursTextEl.textContent = config.business_hours_text;
  }
  
  if (statusTextEl && statusDotEl && statusEl) {
    if (isOpen) {
      statusTextEl.textContent = "BUKA";
      statusDotEl.classList.remove('closed');
      statusDotEl.classList.add('open');
    } else {
      statusTextEl.textContent = "TUTUP";
      statusDotEl.classList.remove('open');
      statusDotEl.classList.add('closed');
    }
  }
}

async function checkStore() {
  console.log('Running checkStore...');
  const overlay = document.getElementById('closure-overlay');
  const closureIconEl = document.getElementById('closure-icon');

  const d = await fetchKedaiJson();
  
  if (!d) {
    console.log('No data received from gist! Using default config.');
  } else {
    console.log('Data from gist:', d);
    const normalizedConfig = normalizeKedaiConfig(d);
    // Update current config with gist data
    if (normalizedConfig) currentStoreConfig = { ...currentStoreConfig, ...normalizedConfig };
    renderPromoBanner(currentStoreConfig);
    refreshReviewMaintenanceUi();
  }
  kedaiConfigLoaded = true;
  renderPromoBanner(currentStoreConfig);

  if (isPreviewBypass()) {
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    updateBusinessHoursDisplay(currentStoreConfig, true);
    checkAndShowAnnouncement();
    return;
  }
  
  if (!overlay) {
    console.log('Closure overlay not found!');
    // Still check announcements even if no overlay
    checkAndShowAnnouncement();
    return;
  }
  
  let shouldClose = false;
  let closureType = 'closed'; // 'closed' or 'maintenance'
  let title, status, message;
  
  // First check manual overrides
  if (flagOn(currentStoreConfig.maintenance)) {
    shouldClose = true;
    closureType = 'maintenance';
    title = currentStoreConfig.tajuk_maintenance || 'SISTEM UPDATE';
    status = currentStoreConfig.sub_maintenance || 'REHAT JAP';
    message = currentStoreConfig.mesej_maintenance || 'Tengah restock barang baru mat!';
  } else if (flagOff(currentStoreConfig.bukakedai)) {
    shouldClose = true;
    closureType = 'closed';
    title = currentStoreConfig.tajuk_tutup || 'KEDAI TUTUP';
    status = currentStoreConfig.sub_tutup || 'TIADA OPERASI';
    message = currentStoreConfig.mesej_tutup || 'Kedai kami sedang ditutup buat sementara waktu.<br>Sila datang semula pada waktu yang ditetapkan.';
  } else {
    // Check automatic business hours
    const autoCheck = shouldStoreCloseAutomatically(currentStoreConfig);
    if (autoCheck.closed) {
      shouldClose = true;
      closureType = 'hours';
      title = 'Di Luar Waktu Operasi';
      status = 'WAKTU OPERASI';
      message = currentStoreConfig.mesej_tutup || 'Kami sedang tutup buat masa ini. Sila kembali semasa waktu operasi kami.';
    }
  }
  
  if (shouldClose) {
    console.log(`Showing ${closureType} popup`);
    showClosure(title, status, message, closureType);
    updateBusinessHoursDisplay(currentStoreConfig, false);
  } else {
    console.log('Store is open, hiding overlay');
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    updateBusinessHoursDisplay(currentStoreConfig, true);
    // Check and show announcement after ensuring store is open
    checkAndShowAnnouncement();
  }
}

function showClosure(title, status, message, type = 'closed') {
  const overlay = document.getElementById('closure-overlay');
  const titleEl = document.getElementById('closure-title');
  const statusEl = document.getElementById('closure-status-text');
  const messageEl = document.getElementById('closure-message');
  const closureIconEl = document.getElementById('closure-icon');
  const statusDotEl = document.querySelector('.closure-status .status-dot');
  const statusWrapEl = document.querySelector('.closure-status');
  const hoursPillEl = document.getElementById('closure-hours-pill');
  const hoursTextEl = document.getElementById('closure-hours-text');
  if (overlay) overlay.setAttribute('data-closure-type', type);
  
  // Update icon based on type
  if (closureIconEl) {
    if (type === 'maintenance') {
      closureIconEl.innerHTML = '<i class="fas fa-tools"></i>';
    } else if (type === 'hours') {
      closureIconEl.innerHTML = '<i class="fa-solid fa-clock"></i>';
    } else {
      closureIconEl.innerHTML = '<i class="fas fa-lock"></i>';
    }
  }
  
  // Update status styling based on type
  if (statusWrapEl && statusDotEl) {
    if (type === 'maintenance') {
      statusWrapEl.style.background = '#fff7ed';
      statusWrapEl.style.borderColor = '#fed7aa';
      statusWrapEl.style.color = '#c2410c';
      statusDotEl.style.background = '#f97316';
    } else if (type === 'hours') {
      statusWrapEl.style.background = 'rgba(14,165,233,.12)';
      statusWrapEl.style.borderColor = 'rgba(14,165,233,.28)';
      statusWrapEl.style.color = '#075985';
      statusDotEl.style.background = '#0ea5e9';
    } else {
      statusWrapEl.style.background = '#fff1f2';
      statusWrapEl.style.borderColor = '#fecdd3';
      statusWrapEl.style.color = '#be123c';
      statusDotEl.style.background = '#ef4444';
    }
  }
  
  if (titleEl) titleEl.textContent = title;
  if (statusEl) statusEl.textContent = status;
  if (messageEl) messageEl.innerHTML = message;
  if (hoursPillEl && hoursTextEl) {
    const hoursText = currentStoreConfig.business_hours_text || 'Isnin - Ahad: 9AM - 12AM';
    hoursTextEl.textContent = hoursText.replace(/\s*\|\s*$/, '');
    hoursPillEl.style.display = 'inline-flex';
  }
  
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
// SECURITY: Block Inspect Element & Right Click
(() => {
  // Block Right Click
  document.addEventListener('contextmenu', e => e.preventDefault());
  // Block Text Selection
  document.addEventListener('selectstart', e => e.preventDefault());
  // Block Image Dragging
  document.addEventListener('dragstart', e => e.preventDefault());
  // Block Keyboard Shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
  document.addEventListener('keydown', e => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
      (e.ctrlKey && e.key === 'U') ||
      (e.ctrlKey && e.key === 'S') ||
      (e.ctrlKey && e.key === 'P')
    ) {
      e.preventDefault();
      return false;
    }
  });
  // Detect DevTools opening (simple check)
  let devtoolsOpen = false;
  const threshold = 160;
  setInterval(() => {
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    if (widthDiff || heightDiff) {
      if (!devtoolsOpen) {
        console.log('%cSTOP!', 'color:red; font-size:40px; font-weight:bold; -webkit-text-stroke:1px black;');
        console.log('%cThis area is for developers only.', 'font-size:20px;');
        devtoolsOpen = true;
      }
    } else {
      devtoolsOpen = false;
    }
  }, 1000);
})();
checkStore(); setInterval(checkStore, 60000);
const DEFAULT_GAMES = [
  { name:'Blox Fruits',           img:'https://i.ibb.co/PzPfy9mw/image-2026-03-20-030340981.png', oos:false, badge:'hot' },
  { name:'Brookhaven',            img:'https://i.ibb.co/0RXVgfmt/image.png',                        oos:false, badge:'new' },
  { name:'fish it',               img:'https://i.ibb.co/WdjTTjM/image-2026-04-15-185552140.png',   oos:false, badge:'new' },
  { name:'Robux Via Log in',      img:'https://i.imgur.com/A9W8r4g.png',                            oos:false, badge:'sale' },
  { name:'Open sea for Brainrot', img:'https://i.ibb.co/HfCwXrVH/image-2026-04-15-185815278.png',  oos:false, badge:'hot' },
  { name:'be a lucky block',      img:'https://i.imgur.com/jsSQ5Zd.png',                            oos:false, badge:'ready' },
  { name:'Sailor piece',          img:'https://i.imgur.com/W2LgeV2.png',                            oos:false, badge:'ready' },
];
let gamesList = [...DEFAULT_GAMES];
let activePlatform = 'Roblox';
function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function inferPlatform(value = {}, fallbackName = '') {
  const raw = typeof value === 'object' ? (value.platform || value.part || value.jenis || value.categoryType || '') : '';
  if (raw) return /free\s*fire|ff/i.test(raw) ? 'Free Fire' : 'Roblox';
  const name = String((typeof value === 'object' ? (value.game || value.name) : value) || fallbackName || '');
  return /free\s*fire|\bff\b/i.test(name) ? 'Free Fire' : 'Roblox';
}
function gameGroupName(value = {}) {
  const custom = value.gameGroup || value.group || value.categoryGroup || value.parentGame;
  if (custom) return String(custom).trim();
  const name = String(value.game || value.name || value || '').trim();
  if (/blox\s*fruit/i.test(name)) return 'Blox Fruits';
  if (/free\s*fire|\bff\b/i.test(name)) return 'Free Fire';
  return name;
}
function productSubcategory(item = {}) {
  const custom = item.subcategory || item.subCategory || item.list || item.typeList || item.section;
  if (custom) return String(custom).trim();
  const name = String(item.game || item.name || '').toLowerCase();
  if (/blox\s*fruit/.test(name) && /(buah|fruit)/.test(name)) return 'Buah/Fruit';
  if (/blox\s*fruit/.test(name)) return 'Akun/Joki';
  if (/free\s*fire|ff/.test(name)) return item.ffType || item.type || 'Akun/Item';
  return item.type || item.category || 'Lain-lain';
}
function catalogGames(showAllPlatforms = false) {
  const map = new Map();
  const addGame = (entry, sourceItem = null) => {
    const name = gameGroupName(entry);
    if (!name) return;
    const key = normalizeKey(name);
    const platform = inferPlatform(entry, name);
    const existing = map.get(key) || {
      ...entry,
      name,
      platform,
      img: entry.img || entry.image || entry.poster || productPosterUrl(sourceItem || entry) || 'https://i.imgur.com/A9W8r4g.png',
      badge: entry.badge || entry.badgeTitle || entry.badgeText || entry.label || null,
      count: 0
    };
    existing.count += sourceItem ? 1 : 0;
    if (!existing.img && sourceItem) existing.img = productPosterUrl(sourceItem);
    if (!existing.badge && entry.badge) existing.badge = entry.badge;
    existing.platform = existing.platform || platform;
    map.set(key, existing);
  };
  gamesList.forEach(g => addGame(g));
  inventory.forEach(item => addGame({ name: gameGroupName(item), platform: inferPlatform(item), img: productPosterUrl(item), badge: item.gameBadge || item.badge }, item));
  return [...map.values()].filter(g => showAllPlatforms || g.platform === activePlatform || (!activePlatform && g.platform));
}
function renderPlatformFilters() {
  const bar = document.getElementById('platform-filter-bar');
  if (!bar) return;
  const allGames = catalogGames(true);
  const platforms = [...new Set(allGames.map(g => g.platform).filter(Boolean))];
  if (!platforms.length) {
    bar.innerHTML = '';
    return;
  }
  if (!platforms.includes(activePlatform)) activePlatform = platforms[0];
  const counts = {};
  const covers = {};
  allGames.forEach(g => {
    if (!platforms.includes(g.platform)) return;
    counts[g.platform] = (counts[g.platform] || 0) + (g.count || 0);
    if (!covers[g.platform]) covers[g.platform] = productPosterUrl(g) || g.img || g.image || '';
  });
  const labels = {
    Roblox: { title: 'Roblox', sub: 'Game, item, akun', icon: 'fa-cube' },
    'Free Fire': { title: 'Free Fire', sub: 'Item dan akun FF sahaja', icon: 'fa-crosshairs' }
  };
  bar.innerHTML = platforms.map(p =>
    '<button class="platform-chip platform-card' + (activePlatform === p ? ' active' : '') + '" onclick="setPlatform(\'' + p.replace(/'/g,"\\'") + '\')">' +
      '<span class="platform-card-bg" style="background-image:url(\'' + escapeCssUrl(covers[p] || getProductScreenshotFallback()) + '\')"></span>' +
      '<span class="platform-card-icon"><i class="fa-solid ' + ((labels[p] && labels[p].icon) || 'fa-gamepad') + '"></i></span>' +
      '<span class="platform-card-copy"><strong>' + escapeHtml((labels[p] && labels[p].title) || p) + '</strong><small>' + escapeHtml((labels[p] && labels[p].sub) || 'Pilihan tersedia') + '</small></span>' +
      '<b>' + (counts[p] || 0) + '</b>' +
    '</button>'
  ).join('');
}
function setPlatform(platform) {
  const allowed = [...new Set(catalogGames(true).map(g => g.platform).filter(Boolean))];
  activePlatform = allowed.includes(platform) ? platform : (allowed[0] || platform || 'Roblox');
  renderGames();
}
async function loadGames() {
  try {
    const cachedGames = JSON.parse(localStorage.getItem('h4sx_games_cache') || '[]');
    if (Array.isArray(cachedGames) && cachedGames.length) {
      gamesList = cachedGames;
      renderGames();
    }
  } catch(e) {}
  for (const url of GAMES_GIST_URLS) {
    try {
      const r = await fetch(url + '?t=' + Date.now(), { cache:'no-store' }); if (!r.ok) continue;
      const data = await r.json();
      if (Array.isArray(data) && data.length) {
        gamesList = data.filter(g => g && typeof g.name === 'string' && g.name.trim()).map(g => {
          const customBadge = g.badgeTitle || g.badgeText || g.titleBadge || g.label || g.badge || null;
          const game = { ...g, name:g.name.trim(), img:g.img||g.image||g.poster||'https://i.imgur.com/A9W8r4g.png', oos:g.oos===true||String(g.oos).toLowerCase()==='true', badge:customBadge };
          ['img', 'video', 'videoUrl', 'mediaUrl', 'image', 'poster', 'posterImg', 'thumbnail', 'thumb'].forEach(key => {
            if (game[key]) game[key] = cleanUrl(game[key]);
          });
          return game;
        });
        try { localStorage.setItem('h4sx_games_cache', JSON.stringify(gamesList)); } catch(e) {}
        return;
      }
    } catch(e) {}
  }
}
// Function to clean URL by removing backticks and whitespace
function cleanUrl(url) {
  if (!url) return url;
  return String(url).replace(/[`\s]/g, '');
}
function normalizeImgurUrl(url, forceVideo = false) {
  const clean = cleanUrl(url || '');
  if (!clean) return clean;
  if (/\.gifv(\?|#|$)/i.test(clean)) return clean.replace(/\.gifv(\?|#|$)/i, '.mp4$1');
  const directMatch = clean.match(/^https?:\/\/i\.imgur\.com\/([a-z0-9]+)(?:\.[a-z0-9]+)?([?#].*)?$/i);
  if (directMatch && forceVideo && !/\.(mp4|webm|mov)(\?|#|$)/i.test(clean)) {
    return `https://i.imgur.com/${directMatch[1]}.mp4${directMatch[2] || ''}`;
  }
  const pageMatch = clean.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-z0-9]+)([?#].*)?$/i);
  if (pageMatch) {
    return `https://i.imgur.com/${pageMatch[1]}${forceVideo ? '.mp4' : '.jpg'}${pageMatch[2] || ''}`;
  }
  return clean;
}
function isVideoMediaUrl(url, item = {}) {
  const type = String(item.mediaType || item.mediatype || item.media || item.type || '').toLowerCase();
  if (type.includes('video')) return true;
  return /\.(mp4|webm|mov|m4v|gifv)(\?|#|$)/i.test(cleanUrl(url || ''));
}
function productMediaUrl(item = {}) {
  const raw = item.video || item.videoUrl || item.mediaUrl || item.img || item.image || '';
  return normalizeImgurUrl(raw, isVideoMediaUrl(raw, item));
}
function productPosterUrl(item = {}) {
  const poster = item.poster || item.posterImg || item.thumbnail || item.thumb;
  if (poster) return normalizeImgurUrl(poster, false);
  const raw = item.img || item.image || item.mediaUrl || '';
  if (isVideoMediaUrl(raw, item)) {
    const clean = cleanUrl(raw || '');
    const imgur = clean.match(/^https?:\/\/i\.imgur\.com\/([a-z0-9]+)(?:\.[a-z0-9]+)?([?#].*)?$/i)
      || clean.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-z0-9]+)([?#].*)?$/i);
    if (imgur) return `https://i.imgur.com/${imgur[1]}.jpg`;
    return 'https://i.imgur.com/cLPulXQ.png';
  }
  return normalizeImgurUrl(raw, false);
}
function renderMediaHTML(item = {}, context = 'card') {
  const src = productMediaUrl(item);
  const name = escapeForHtml(item.name || item.game || 'Media produk');
  if (!src) return '<div class="media-empty"><i class="fa-solid fa-image"></i></div>';
  const safeSrc = escapeForHtml(src);
  const poster = productPosterUrl(item);
  const posterAttr = poster ? ' poster="' + escapeForHtml(poster) + '"' : '';
  const video = isVideoMediaUrl(src, item);
  if (video) {
    if (context !== 'modal') {
      const posterSrc = escapeForHtml(poster || getProductScreenshotFallback());
      return '<img class="product-media product-media-img product-media-video-poster" src="' + posterSrc + '" alt="' + name + '" draggable="false" loading="lazy" onerror="this.onerror=null;this.src=\'' + escapeForHtml(getProductScreenshotFallback()) + '\'"><span class="media-type-pill"><i class="fa-solid fa-play"></i> Video</span>';
    }
    const controls = context === 'modal' ? ' controls' : '';
    const eagerAttrs = context === 'modal'
      ? ' autoplay loop muted playsinline preload="metadata"'
      : ' muted playsinline preload="none" onmouseenter="this.play().catch(function(){})" onmouseleave="this.pause()"';
    const fallback = escapeForHtml(productPosterUrl(item) || getProductScreenshotFallback());
    return '<video class="product-media product-media-video" src="' + safeSrc + '"' + posterAttr + eagerAttrs + controls + ' draggable="false" onerror="this.outerHTML=\'<img class=&quot;product-media product-media-img&quot; src=&quot;' + fallback + '&quot; alt=&quot;' + name + '&quot; draggable=&quot;false&quot;>\'"></video><span class="media-type-pill"><i class="fa-solid fa-play"></i> Video</span>';
  }
  return '<img class="product-media product-media-img" src="' + safeSrc + '" alt="' + name + '" draggable="false" loading="lazy" onerror="this.onerror=null;this.src=\'' + escapeForHtml(getProductScreenshotFallback()) + '\'">';
}

function syncInventoryGames() {
  if (!Array.isArray(inventory) || !inventory.length) return;
  const seen = new Set(gamesList.map(g => String(g.name || '').toLowerCase()));
  inventory.forEach(item => {
    const name = String(item.game || '').trim();
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    gamesList.push({
      name,
      img: productPosterUrl(item),
      poster: productPosterUrl(item),
      video: isVideoMediaUrl(productMediaUrl(item), item) ? productMediaUrl(item) : '',
      mediaType: isVideoMediaUrl(productMediaUrl(item), item) ? 'video' : 'image',
      oos: false,
      badge: 'new'
    });
  });
}

async function loadInv() {
  try {
    const cachedInventory = JSON.parse(localStorage.getItem('h4sx_inventory_cache') || '[]');
    if (Array.isArray(cachedInventory) && cachedInventory.length) {
      inventory = cachedInventory;
      syncInventoryGames();
      renderGames();
    }
  } catch(e) {}
  for (const url of INVENTORY_GIST_URLS) {
    try {
      const r = await fetch(url + '?t=' + Date.now(), { cache:'no-store' });
      if (!r.ok) continue;
      const data = await r.json();
      if (data) {
        let tempConfig = null;
        let tempInventory = [];
        
        // Handle different data structures
        if (data.storeConfig) {
          tempConfig = data.storeConfig;
        }
        
        if (Array.isArray(data)) {
          if (data.length > 0 && data[0].storeConfig) {
            tempConfig = data[0].storeConfig;
            tempInventory = data.slice(1);
          } else {
            tempInventory = data;
          }
        } else if (Array.isArray(data.inventory)) {
          tempInventory = data.inventory;
        }
        
        // Apply and clean config
        if (tempConfig) {
          storeConfig = { ...storeConfig, ...tempConfig };
          if (storeConfig.payment?.duitNow) {
            PAY_QR.duitnow.url = cleanUrl(storeConfig.payment.duitNow.qrUrl) || PAY_QR.duitnow.url;
            PAY_QR.duitnow.name = storeConfig.payment.duitNow.accountName || PAY_QR.duitnow.name;
          }
          if (storeConfig.payment?.tng) {
            PAY_QR.tng.url = cleanUrl(storeConfig.payment.tng.qrUrl) || PAY_QR.tng.url;
            PAY_QR.tng.name = storeConfig.payment.tng.accountName || PAY_QR.tng.name;
          }
          updatePaymentUI();
          updateWarnBoxUI();
        }
        
        // Clean inventory items
        inventory = tempInventory.map(item => {
          const cleanedItem = { ...item };
          // Clean image URL
          if (cleanedItem.img) {
            cleanedItem.img = cleanUrl(cleanedItem.img);
          }
          ['video', 'videoUrl', 'mediaUrl', 'image', 'poster', 'posterImg', 'thumbnail', 'thumb'].forEach(key => {
            if (cleanedItem[key]) cleanedItem[key] = cleanUrl(cleanedItem[key]);
          });
          // Fix promoterPhone to be string with leading zero
          if (cleanedItem.promoterPhone) {
            cleanedItem.promoterPhone = String(cleanedItem.promoterPhone);
            // Ensure starts with 0 if it's a Malaysian number
            if (!cleanedItem.promoterPhone.startsWith('0') && cleanedItem.promoterPhone.length === 9) {
              cleanedItem.promoterPhone = '0' + cleanedItem.promoterPhone;
            }
          }
          return cleanedItem;
        }).filter(item => item && item.id); // Only keep items with valid ID
        
        if (inventory && inventory.length) { 
          const invHash = JSON.stringify(inventory).length + '-' + inventory.length;
          localStorage.setItem('h4sx_inv_hash', invHash);
          try { localStorage.setItem('h4sx_inventory_cache', JSON.stringify(inventory)); } catch(e) {}
          syncInventoryGames();
          renderGames();
          openGameFromUrl();
          break; 
        }
      }
    } catch(e) {
      console.error('Load inventory error:', e);
    }
  }
  if (!inventory.length) {
    inventory = [{"id":4,"game":"Blox Fruits","name":"ANGEL,GHOUL,CYBORG,RABBIT,HUMAN,SHARK","originalPrice":80,"price":27,"promoLabel":"PROMOSI","desc":"SEMUA RACE V4 FULL GEAR ? PILIH SATU. STATUS POLOSAN.","img":"https://i.ibb.co/BKThLPwy/image.png","sold":86,"stock":10},{"id":14,"game":"Blox Fruits","name":"Level Max Gh & Cdk. Skull Guitar","price":14,"promoLabel":"almost out of stock","desc":"GODHUMAN+CURSED DUAL KATANA+SOUL GUITAR [Level MAX]","img":"https://i.ibb.co/PzPfy9mw/image-2026-03-20-030340981.png","sold":200,"stock":3},{"id":23,"game":"Blox Fruits","name":"200 LEVEL SEA 2-3","originalPrice":5,"price":2,"promoLabel":"BARU","desc":"200 LEVEL SEA 2-3","img":"https://i.ibb.co/PzPfy9mw/image-2026-03-20-030340981.png","sold":5,"stock":20},{"id":24,"game":"Blox Fruits","name":"200 LEVEL SEA 1","originalPrice":3,"price":1.5,"promoLabel":"BARU","desc":"UNTUK SEA 1","img":"https://i.ibb.co/PzPfy9mw/image-2026-03-20-030340981.png","sold":10,"stock":20},{"id":5,"game":"Brookhaven","name":"VIP GAMEPASS","originalPrice":31,"price":26,"promoLabel":"HOT","desc":"VIP GAMEPASS","img":"https://i.ibb.co/tpHXYPbc/image.png","sold":45,"stock":50},{"id":6,"game":"Brookhaven","name":"Vehicle Customization","price":16,"desc":"Vehicle Customization","img":"https://i.ibb.co/bR5fdPVr/image.png","sold":89,"stock":50},{"id":7,"game":"Brookhaven","name":"Premium Gamepass","originalPrice":13,"price":8,"promoLabel":"MOST POPULAR","desc":"Premium Gamepass","img":"https://i.ibb.co/BK50Nf0x/image.png","sold":201,"stock":50},{"id":8,"game":"Brookhaven","name":"Speed Vehicle Unlocked","price":8,"desc":"Speed Vehicle Unlocked","img":"https://i.ibb.co/JwK8kH35/image.png","sold":156,"stock":50},{"id":9,"game":"Brookhaven","name":"Vehicle Pack","originalPrice":30,"price":24,"promoLabel":"PROMOSI","desc":"Vehicle Pack","img":"https://i.ibb.co/xKX5X0fZ/image.png","sold":34,"stock":15},{"id":10,"game":"Brookhaven","name":"Estate Unlocked","originalPrice":30,"price":24,"promoLabel":"PROMOSI","desc":"Estate Unlocked","img":"https://i.ibb.co/277MSz0R/image.png","sold":41,"stock":15},{"id":11,"game":"Brookhaven","name":"Music Unlocked","price":8,"desc":"Music Unlocked","img":"https://i.ibb.co/v4YBMzrp/image.png","sold":203,"stock":50},{"id":13,"game":"fish it","name":"Ghostfin Rod & singularity bait","price":4,"desc":"Starter account fishit","img":"https://i.ibb.co/vnvpkvh/image.png","sold":135,"stock":30},{"id":22,"game":"fish it","name":"Bunny Staff / Easter Parasol","originalPrice":25,"price":23,"promoLabel":"BARU","desc":"Skin Rod fish it","img":"https://i.imgur.com/LAfMl0V.png","sold":69,"stock":5},{"id":26,"game":"fish it","name":"Golden Clockwork","originalPrice":25,"price":23,"promoLabel":"BARU","desc":"Skin Rod fish it","img":"https://i.imgur.com/q5bKsnv.png","sold":20,"stock":8},{"id":27,"game":"fish it","name":"Limited Skin Rod","originalPrice":24,"price":13,"promoLabel":"BARU","desc":"VIA TRADE ? PILIH SALAH SATU SKIN","img":"https://i.imgur.com/feaPapV.png","sold":23,"stock":4},{"id":28,"game":"fish it","name":"Secret Tumbal","originalPrice":3,"price":0.40,"promoLabel":"BARU","desc":"Random Secret Tumbal","img":"https://i.imgur.com/oKRszAz.png","sold":192,"stock":100},{"id":17,"game":"Robux Via Log in","name":"80 ROBUX","price":4,"promoLabel":"BARU","desc":"via log in","img":"https://i.imgur.com/A9W8r4g.png","sold":20,"stock":99},{"id":18,"game":"Robux Via Log in","name":"400 ROBUX","price":18,"promoLabel":"BARU","desc":"via log in","img":"https://i.imgur.com/A9W8r4g.png","sold":39,"stock":99},{"id":19,"game":"Robux Via Log in","name":"800 ROBUX","price":33,"promoLabel":"BARU","desc":"via log in","img":"https://i.imgur.com/A9W8r4g.png","sold":19,"stock":99},{"id":20,"game":"Robux Via Log in","name":"1000 ROBUX","price":36,"promoLabel":"BARU","desc":"via log in","img":"https://i.imgur.com/A9W8r4g.png","sold":24,"stock":99},{"id":21,"game":"Robux Via Log in","name":"450 ROBUX + PREMIUM","price":18,"promoLabel":"BARU","desc":"via log in","img":"https://i.imgur.com/A9W8r4g.png","sold":35,"stock":99},{"id":29,"game":"Robux Via Log in","name":"160 ROBUX","price":7.5,"promoLabel":"BARU","desc":"via log in","img":"https://i.imgur.com/A9W8r4g.png","sold":33,"stock":99},{"id":25,"game":"Open sea for Brainrot","name":"100B/S MONEY","originalPrice":5,"price":2,"promoLabel":"BARU","desc":"OPEN SEA FOR BRAINROT BELUM MAX / REBIRT 6","img":"https://i.ibb.co/0R8CzmrK/image.png","sold":20,"stock":50}];
  }
  syncInventoryGames();
  renderGames();
  openGameFromUrl();
}

// Update payment UI based on config
function updatePaymentUI() {
  const duitNowQR = document.querySelector('#panel-duitnow .qr-frame img');
  const tngQR = document.querySelector('#panel-tng .qr-frame img');
  const duitNowName = document.querySelector('#panel-duitnow .qr-name');
  const tngName = document.querySelector('#panel-tng .qr-name');
  
  if (duitNowQR) duitNowQR.src = PAY_QR.duitnow.url;
  if (tngQR) tngQR.src = PAY_QR.tng.url;
  if (duitNowName) duitNowName.textContent = PAY_QR.duitnow.name;
  if (tngName) tngName.textContent = PAY_QR.tng.name;
  
  const qrModalImg = document.getElementById('qr-modal-img');
  const qrModalName = document.getElementById('qr-modal-name');
  if (qrModalImg) qrModalImg.src = PAY_QR.duitnow.url;
  if (qrModalName) qrModalName.textContent = PAY_QR.duitnow.name;
  
  const duitNowBtn = document.getElementById('pay-btn-duitnow');
  const tngBtn = document.getElementById('pay-btn-tng');
  const duitNowPanel = document.getElementById('panel-duitnow');
  const tngPanel = document.getElementById('panel-tng');
  
  if (duitNowBtn) duitNowBtn.style.display = storeConfig.payment.duitNow.enabled ? '' : 'none';
  if (tngBtn) tngBtn.style.display = storeConfig.payment.tng.enabled ? '' : 'none';
  if (duitNowPanel) duitNowPanel.style.display = storeConfig.payment.duitNow.enabled ? '' : 'none';
  if (tngPanel) tngPanel.style.display = storeConfig.payment.tng.enabled ? '' : 'none';
  
  if (!storeConfig.payment.duitNow.enabled && !storeConfig.payment.tng.enabled) {
    // Both disabled
  } else if (!storeConfig.payment.duitNow.enabled && activePayMethod === 'duitnow') {
    activePayMethod = 'tng';
    selectPay('tng');
  } else if (!storeConfig.payment.tng.enabled && activePayMethod === 'tng') {
    activePayMethod = 'duitnow';
    selectPay('duitnow');
  }
}

// Update warn box UI
function updateWarnBoxUI() {
  const warnBox = document.querySelector('.warn-box');
  if (!warnBox) return;
  
  const warnBoxName = document.getElementById('warn-box-name');
  if (storeConfig.warnBox.showName && storeConfig.warnBox.accountName && warnBoxName) {
    warnBoxName.textContent = '"' + storeConfig.warnBox.accountName + '"';
  }
}

function getDailySeed() { const d = new Date(); return Number('' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0')); }
function seededRand(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return function() { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
function shuffleBySeed(arr, seed) { const out = [...arr]; const rnd = seededRand(seed); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOkyPe2f1tHu9OQiwHHpgfJTYM-KM7cuU",
  authDomain: "h4sx-6712c.firebaseapp.com",
  projectId: "h4sx-6712c",
  storageBucket: "h4sx-6712c.firebasestorage.app",
  messagingSenderId: "416803081247",
  appId: "1:416803081247:web:e201174233b953e539992a",
  measurementId: "G-J9QWB39V87"
};

// Inisialisasi Firebase (jika config ada)
let db = null;
if (firebaseConfig.apiKey) {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase initialized successfully!");
  } catch (e) {
    console.error("Firebase init error:", e);
  }
}

function fixMojibakeText(value) {
  let text = String(value ?? '');
  if (!text) return '';
  if (/[ÃÂâð]/.test(text)) {
    try {
      const bytes = Uint8Array.from([...text].map(ch => ch.charCodeAt(0) & 255));
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const oldBad = (text.match(/[ÃÂâð�]/g) || []).length;
      const newBad = (decoded.match(/[ÃÂâð�]/g) || []).length;
      if (decoded && newBad < oldBad) text = decoded;
    } catch(e) {}
  }
  return text
    .replace(/â€”/g, '-')
    .replace(/â€“/g, '-')
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€¦/g, '...')
    .replace(/Â /g, ' ')
    .replace(/Â/g, '')
    .replace(/ï¿½/g, '');
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = fixMojibakeText(str);
  return d.innerHTML;
}
function clampRating(value) {
  const n = parseInt(value, 10);
  return Math.min(5, Math.max(1, Number.isFinite(n) ? n : 5));
}
function warnaHexSah(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
}
function badgeStyle(data = {}) {
  const c1 = warnaHexSah(data.badgeColor, '#2fa8e0');
  const c2 = warnaHexSah(data.badgeColor2, '#7c3aed');
  const text = warnaHexSah(data.badgeTextColor, '#ffffff');
  const glow = warnaHexSah(data.badgeGlowColor, c1);
  const gradient = data.badgeGradient !== false;
  const bg = gradient ? `linear-gradient(120deg, ${c1}, ${c2}, ${c1})` : c1;
  return `background:${bg}; color:${text}; --badge-glow:${glow}; box-shadow:0 4px 16px -8px ${glow}, inset 0 1px 0 rgba(255,255,255,.26); border:none;`;
}
function toReviewTime(value) {
  if (!value) return 'Baru sahaja';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Baru sahaja';
  return date.toLocaleString('ms-MY', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true });
}
let unsubscribeReviews = null;
let latestReviewStatsData = [];
function isReviewMaintenanceActive(config = currentStoreConfig) {
  return flagOn(config.review_maintenance)
    || flagOn(config.maintenance_review)
    || flagOn(config.ulasan_maintenance)
    || flagOn(config.reviews_maintenance);
}
function showReviewMaintenanceNotice() {
  const grid = document.getElementById('testi-grid');
  if (!grid) return;
  const message = currentStoreConfig.review_maintenance_message
    || currentStoreConfig.review_maintenance_msg
    || 'Feature ulasan sedang diproses dan dikemas semula. Kemungkinan besar sistem ulasan akan berfungsi kembali dalam sekitar 2 hari lagi.';
  grid.innerHTML = '<div class="testi-loading review-maintenance-box"><i class="fa-solid fa-screwdriver-wrench" style="margin-right:8px"></i>' + escapeHtml(message) + '</div>';
}
function updateMainReviewStats(list = []) {
  const avgEl = document.getElementById('mainReviewAverage');
  const countEl = document.getElementById('mainReviewCount');
  const starsEl = document.getElementById('mainReviewStars');
  if (!avgEl || !countEl || !starsEl) return;

  const ratings = list
    .map(item => Number.parseInt(item.bintang ?? item.rating, 10))
    .filter(value => Number.isFinite(value) && value >= 1 && value <= 5);
  const count = ratings.length;
  const avg = count ? ratings.reduce((sum, value) => sum + value, 0) / count : 0;
  const roundedStars = Math.round(avg);

  avgEl.textContent = count ? avg.toFixed(1) : '—';
  countEl.textContent = String(count);
  starsEl.innerHTML = Array(5).fill(0).map((_, i) =>
    '<i class="fa-solid fa-star" style="color:' + (i < roundedStars ? '#fbbf24' : 'rgba(148,163,184,.42)') + '"></i>'
  ).join('');
}
function refreshReviewMaintenanceUi() {
  if (isReviewMaintenanceActive()) {
    showReviewMaintenanceNotice();
    return;
  }
  const grid = document.getElementById('testi-grid');
  if (grid?.querySelector('.review-maintenance-box') && latestReviewStatsData.length) {
    renderReviews(latestReviewStatsData);
  } else if (grid?.querySelector('.review-maintenance-box') && !unsubscribeReviews) {
    loadReviews();
  }
}
async function loadReviews() {
  const grid = document.getElementById('testi-grid');
  if (!grid) return;
  if (!kedaiConfigLoaded) {
    grid.innerHTML = '<div class="testi-loading"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>Checking review status...</div>';
    await checkStore();
  }
  if (!db) {
    updateMainReviewStats([]);
    grid.innerHTML = '<div class="testi-loading">Ulasan belum tersedia.</div>';
    return;
  }
  if (unsubscribeReviews) unsubscribeReviews();
  
  try {
    unsubscribeReviews = db.collection('ratings')
      .orderBy('diciptaPada', 'desc')
      .onSnapshot(snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        latestReviewStatsData = data;
        updateMainReviewStats(data);
        if (isReviewMaintenanceActive()) {
          showReviewMaintenanceNotice();
          return;
        }
        renderReviews(data);
        setTimeout(initScrollReveal, 100);
      }, error => {
        console.error("Firebase review listener error:", error);
        updateMainReviewStats([]);
        grid.innerHTML = '<div class="testi-loading">Ulasan belum dapat dimuat.</div>';
      });
  } catch(e) {
    console.error("Firebase review setup error:", e);
    updateMainReviewStats([]);
    grid.innerHTML = '<div class="testi-loading">Ulasan belum dapat dimuat.</div>';
  }
}
function renderReviews(list) {
  const grid = document.getElementById('testi-grid'); if (!grid) return;
  updateMainReviewStats(list);
  grid.innerHTML = '';
  return;
  if (isReviewMaintenanceActive()) {
    showReviewMaintenanceNotice();
    return;
  }
  if (!list.length) {
    grid.innerHTML = '<div class="testi-loading">Belum ada ulasan terbaru.</div>';
    return;
  }
  grid.innerHTML = list.map((item,i) => {
    const rating = clampRating(item.bintang ?? item.rating);
    const stars = Array(5).fill(0).map((_,si) => '<i class="fa-solid fa-star" style="color:' + (si<rating?'var(--sky)':'var(--border2)') + '"></i>').join('');
    const name = item.nama || item.name || 'Pelanggan';
    const text = item.ulasan || item.komen || item.comment || item.feedback || '';
    const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?';
    const avatar = item.profileImg
      ? '<img src="' + escapeHtml(item.profileImg) + '" alt="">'
      : escapeHtml(item.emojiProfil || initials);
    const avatarStyle = item.warnaProfil ? ' style="background:' + escapeHtml(item.warnaProfil) + '"' : '';
    const isAdmin = name.toLowerCase().includes('h4sx');
    const roleText = item.role || item.badgeText;
    const role = roleText
      ? '<span class="testi-role' + (item.badgeAnimated === false ? '' : ' is-animated') + '" style="' + badgeStyle(item) + '">' + escapeHtml(roleText) + '</span>'
      : (isAdmin ? '<span class="testi-role is-animated" style="' + badgeStyle({ badgeColor:'#2fa8e0', badgeColor2:'#0f2a45', badgeTextColor:'#ffffff', badgeGlowColor:'#2fa8e0', badgeGradient:true }) + '">ADMIN RASMI</span>' : '<span class="testi-verified"><i class="fa-solid fa-circle-check"></i> Verified</span>');
    const feedbackBtn = item.feedbackImg ? '<button class="testi-feedback-btn" type="button" data-review-index="' + i + '">See image</button>' : '';
    return '<div class="testi-card reveal ' + (['','reveal-delay-1','reveal-delay-2'][i%3]) + '"><div class="testi-stars">' + stars + '</div><div class="testi-text">"' + escapeHtml(text) + '"</div>' + feedbackBtn + '<div class="testi-bottom"><div class="testi-avatar"' + avatarStyle + '>' + avatar + '</div><div><div class="testi-name">' + escapeHtml(name) + '</div><div class="testi-game">' + toReviewTime(item.diciptaPada || item.timestamp || item.date) + '</div></div>' + role + '</div></div>';
  }).join('');
  grid.querySelectorAll('.testi-feedback-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = list[Number(btn.dataset.reviewIndex)];
      openTestimonialImage(item?.feedbackImg);
    });
  });
}
function openTestimonialImage(src) {
  if (!src) return;
  let modal = document.getElementById('testimonial-image-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'testimonial-image-modal';
    modal.className = 'testimonial-image-modal';
    modal.innerHTML = '<div class="testimonial-image-box"><div class="testimonial-image-head"><span>Gambar Feedback</span><button type="button" class="testimonial-image-close">×</button></div><img class="testimonial-image-img" alt="Gambar feedback"></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.classList.contains('testimonial-image-close')) {
        modal.classList.remove('show');
        modal.querySelector('img').src = '';
      }
    });
  }
  modal.querySelector('img').src = src;
  modal.classList.add('show');
}
async function startCountdown() {
  const strip = document.getElementById('cd-strip'), labelEl = document.getElementById('cd-label'), subEl = document.getElementById('cd-sub');
  let aktif = true, label = 'Flash Sale Aktif', sub = 'Tawaran terhad ? habis bila habis!', durationMs = 8 * 3600000;
  const d = await fetchKedaiJson();
  if (d && d.flash_sale) { const fs = d.flash_sale; if (fs.aktif === false) aktif = false; if (fs.label) label = fs.label; if (fs.sub) sub = fs.sub; if (typeof fs.duration_hours === 'number') { if (fs.duration_hours <= 0) aktif = false; else durationMs = fs.duration_hours * 3600000; } }
  if (!aktif) { if (strip) strip.style.display = 'none'; return; }
  if (labelEl) labelEl.textContent = label; if (subEl) subEl.textContent = sub;
  const KEY = 'h4sx-cd-' + label.replace(/\s+/g,'_');
  let target = parseInt(sessionStorage.getItem(KEY) || '0');
  if (!target || target <= Date.now()) { target = Date.now() + durationMs; sessionStorage.setItem(KEY, String(target)); }
  function tick() {
    const diff = Math.max(0, target - Date.now());
    const hEl = document.getElementById('cd-h'), mEl = document.getElementById('cd-m'), sEl = document.getElementById('cd-s');
    if (hEl) hEl.textContent = String(Math.floor(diff/3600000)).padStart(2,'0');
    if (mEl) mEl.textContent = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    if (sEl) sEl.textContent = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    if (diff > 0) setTimeout(tick, 1000);
    else { if (strip) strip.style.opacity='0.5'; if (labelEl) labelEl.textContent='? Sale Tamat'; if (subEl) subEl.textContent='Nantikan sale akan datang!'; }
  }
  tick();
}
function runWhenIdle(fn, timeout = 1800) {
  if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout });
  else setTimeout(fn, Math.min(timeout, 1000));
}

function bootStoreApp() {
  loadGames().then(renderGames);
  loadInv();
  startCountdown();
  initScrollReveal();
  runWhenIdle(loadReviews, 1200);
  runWhenIdle(animateCounters, 1600);
  runWhenIdle(initChangelog, 2200);
  // Initialize payment UI with config
  setTimeout(updatePaymentUI, 500);
  setTimeout(updateWarnBoxUI, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootStoreApp, { once: true });
} else {
  bootStoreApp();
}
function stockState(item) {
  const s = Number(item.stock);
  if (item.stock == null || !Number.isFinite(s)) return { type:'unknown', label:'Ready' };
  if (s <= 0) return { type:'out', label:'Out of Stock' };
  if (s === 1) return { type:'last', label:'Last Unit' };
  if (s <= 3) return { type:'critical', label:'Tinggal ' + s };
  if (s <= 5) return { type:'low', label:'Limited ' + s };
  return { type:'ready', label:'Ready Stock' };
}
function getStockBadge(item) {
  const state = stockState(item);
  if (state.type === 'unknown') return '';
  return '<span class="stock-badge ' + state.type + '">' + escapeHtml(state.label) + '</span>';
}
function getUpdatedText(item) {
  const raw = item.updatedAt || item.lastUpdated || item.updateDate || item.updated || item.dikemaskini;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 28);
  return d.toLocaleDateString('ms-MY', { day:'numeric', month:'short' });
}
function productMiniStatusHTML(item) {
  const chips = [];
  const state = stockState(item);
  if (state.type !== 'unknown') chips.push('<span class="pstatus-chip ' + state.type + '"><i class="fa-solid fa-box"></i>' + escapeHtml(state.label) + '</span>');
  if (item.promoLabel || (item.originalPrice && item.originalPrice > item.price)) chips.push('<span class="pstatus-chip promo"><i class="fa-solid fa-tag"></i>Promo</span>');
  if (isVideoMediaUrl(productMediaUrl(item), item)) chips.push('<span class="pstatus-chip video"><i class="fa-solid fa-play"></i>Video</span>');
  const updated = getUpdatedText(item);
  if (updated || item.recentlyUpdated) chips.push('<span class="pstatus-chip updated"><i class="fa-solid fa-clock-rotate-left"></i>' + escapeHtml(updated || 'Updated') + '</span>');
  return chips.length ? '<div class="pstatus-row">' + chips.slice(0, 3).join('') + '</div>' : '';
}
function isOutOfStock(item) { 
  if (item.stock == null) return false;
  const cartItem = cartItems.find(ci => ci.id === item.id);
  const currentQty = cartItem ? cartItem.qty : 0;
  return currentQty >= item.stock; 
}
function getCartQtyForItem(id) {
  const ci = cartItems.find(c => c.id === id);
  return ci ? ci.qty : 0;
}
function buildAddBtnHTML(item, oos) {
  if (oos) return '<button class="padd" disabled><i class="fa-solid fa-ban"></i><span class="padd-txt">Habis</span></button>';
  const qty = getCartQtyForItem(item.id);
  const inCart = qty > 0 ? ' in-cart' : '';
  const qtyBadge = qty > 0 ? '<span class="padd-qty">' + qty + '</span>' : '';
  return '<button class="padd' + inCart + '" onclick="event.stopPropagation();event.preventDefault();addCart(' + item.id + ', this)"><i class="fa-solid fa-cart-plus"></i><span class="padd-txt">Cart</span>' + qtyBadge + '</button>';
}
function buildQuickBarHTML(item, oos) {
  if (oos) return '';
  return '<div class="pquick" onclick="event.stopPropagation()"><button class="pquick-btn cart" onclick="event.stopPropagation();addCart(' + item.id + ', this)"><i class="fa-solid fa-cart-plus"></i> Add Cart</button><button class="pquick-btn buy" onclick="event.stopPropagation();buyNowItem(' + item.id + ')"><i class="fa-solid fa-bolt"></i> Buy Now</button></div>';
}
let currentProductItems = [];
let currentProductBanner = '';
let currentProductFilter = 'all';
const PRODUCT_FILTERS = [
  { id:'all', label:'Semua', icon:'fa-border-all', test:() => true },
  { id:'stock', label:'Stok Ada', icon:'fa-box', test:item => !isOutOfStock(item) },
  { id:'promo', label:'Promo', icon:'fa-tags', test:item => !!item.promoLabel || (item.originalPrice && item.originalPrice > item.price) },
  { id:'popular', label:'Popular', icon:'fa-fire', test:item => Number(item.sold || 0) >= 5 },
  { id:'cheap', label:'Murah', icon:'fa-coins', test:item => Number(item.price || 0) <= 5 },
  { id:'video', label:'Video', icon:'fa-play', test:item => isVideoMediaUrl(productMediaUrl(item), item) }
];
function renderProductSkeleton(count = 6) {
  return Array.from({ length: count }).map(() => (
    '<div class="pc product-skeleton">' +
      '<div class="pimg"></div>' +
      '<div class="pbody"><span></span><span></span><span></span><div class="skeleton-row"><span></span><span></span></div></div>' +
    '</div>'
  )).join('');
}
function productCardHTML(item) {
  const oos = isOutOfStock(item);
  const promo = item.promoLabel ? '<div class="ptag">' + escapeHtml(item.promoLabel) + '</div>' : '';
  let promotedByHTML = '';
  if (storeConfig.promote.enabled && item.promotedBy) {
    promotedByHTML = '<div class="product-promoted"><i class="fa-solid fa-star"></i>Promoted by ' + escapeHtml(item.promotedBy) + '</div>';
  }
  let itemQRHTML = '';
  const isPromotedItem = storeConfig.promote.enabled && item.promotedBy && item.promoterPhone;
  if (isPromotedItem) {
    itemQRHTML = '<div class="product-promoter-box"><small>Hubungi Promoter</small><a href="https://wa.me/' + escapeHtml(item.promoterPhone) + '" target="_blank"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a></div>';
  } else if (item.qrDuitNow || item.qrTng) {
    itemQRHTML = '<div class="product-qr-mini">';
    if (item.qrDuitNow && storeConfig.payment.duitNow.enabled) {
      itemQRHTML += '<div><small>DuitNow</small><img src="' + escapeHtml(item.qrDuitNow) + '" alt="DuitNow QR"></div>';
    }
    if (item.qrTng && storeConfig.payment.tng.enabled) {
      itemQRHTML += '<div><small>TNG eWallet</small><img src="' + escapeHtml(item.qrTng) + '" alt="TNG QR"></div>';
    }
    itemQRHTML += '</div>';
  }
  const pHTML = (item.originalPrice && item.originalPrice > item.price)
    ? '<span class="pprice">RM' + Number(item.price).toFixed(2) + '</span><span class="pprice-old">RM' + escapeHtml(item.originalPrice) + '</span>'
    : '<span class="pprice">RM' + Number(item.price).toFixed(2) + '</span>';
  const cartQty = getCartQtyForItem(item.id);
  const cartHint = cartQty > 0 ? '<span class="pcart-hint show"><i class="fa-solid fa-check-circle"></i> ' + cartQty + ' in cart</span>' : '<span class="pcart-hint" data-item-id="' + item.id + '"><i class="fa-solid fa-check-circle"></i> in cart</span>';
  const addBtn = buildAddBtnHTML(item, oos);
  const buyBtn = oos ? '<button class="pbuy" disabled>BUY NOW</button>' : '<button class="pbuy" onclick="event.stopPropagation();event.preventDefault();buyNowItem(' + item.id + ')">BUY NOW</button>';
  const quickBar = buildQuickBarHTML(item, oos);
  return '<div class="pc reveal" style="' + (oos?'opacity:0.65':'') + '" id="product-' + item.id + '">' + promo + '<div class="pimg" role="button" tabindex="0" data-product-id="' + item.id + '" onclick="openProductImage(' + item.id + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openProductImage(' + item.id + ')}">' + renderMediaHTML(item, 'card') + getStockBadge(item) + quickBar + '</div><div class="pbody">' + promotedByHTML + productMiniStatusHTML(item) + '<div class="pname">' + escapeHtml(item.name) + '</div><div class="psold"><i class="fa-solid fa-chart-simple"></i> ' + Number(item.sold || 0) + ' sold</div><p class="pdesc">' + escapeHtml(item.desc || '') + '</p><div class="pfoot"><div class="pfoot-top"><div style="display:flex;align-items:baseline;gap:4px;min-width:0">' + pHTML + '</div>' + cartHint + '</div><div class="pactions">' + buyBtn + addBtn + '</div></div>' + itemQRHTML + '</div></div>';
}
function productFilterCount(filter) {
  return currentProductItems.filter(filter.test).length;
}
function orderedProductSubcategories(items = currentProductItems) {
  const subcats = [...new Set(items.map(productSubcategory).filter(Boolean))];
  return subcats.sort((a, b) => {
    const score = s => /akun|joki/i.test(s) ? 0 : (/buah|fruit/i.test(s) ? 1 : 2);
    return score(a) - score(b) || a.localeCompare(b);
  });
}
function activeProductFilters() {
  const base = [...PRODUCT_FILTERS];
  const subcats = orderedProductSubcategories();
  if (subcats.length > 1) {
    const subFilters = subcats.map(sub => ({
        id: 'sub:' + normalizeKey(sub),
        label: sub,
        icon: /buah|fruit/i.test(sub) ? 'fa-apple-whole' : 'fa-list',
        test: item => productSubcategory(item) === sub
    }));
    return [base[0], ...subFilters, ...base.slice(1)];
  }
  return base;
}
function renderProductFilters() {
  const bar = document.getElementById('product-filter-bar');
  if (!bar) return;
  const filters = activeProductFilters()
    .map(f => ({ ...f, count: productFilterCount(f) }))
    .filter(f => f.id === 'all' || f.count > 0);
  bar.innerHTML = filters.map(f =>
    '<button class="product-filter-chip' + (currentProductFilter === f.id ? ' active' : '') + '" onclick="setProductFilter(\'' + f.id + '\')"><i class="fa-solid ' + f.icon + '"></i><span>' + f.label + '</span><b>' + f.count + '</b></button>'
  ).join('');
}
function setProductFilter(filter) {
  currentProductFilter = filter || 'all';
  renderProductGrid();
}
function renderProductSubsection(label, items) {
  const icon = /buah|fruit/i.test(label) ? 'fa-apple-whole' : (/akun|joki/i.test(label) ? 'fa-user-gear' : 'fa-boxes-stacked');
  return '<section class="product-subsection reveal">' +
    '<div class="product-subhead"><div><i class="fa-solid ' + icon + '"></i><span>' + escapeHtml(label) + '</span></div><b>' + items.length + ' item</b></div>' +
    '<div class="product-subgrid">' + items.map(productCardHTML).join('') + '</div>' +
  '</section>';
}
function renderProductGrid() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  const filters = activeProductFilters();
  const active = filters.find(f => f.id === currentProductFilter) || filters[0];
  const items = currentProductItems.filter(active.test);
  document.getElementById('pv-count').textContent = items.length + ' item tersedia' + (currentProductFilter !== 'all' ? ' - ' + active.label : '');
  renderProductFilters();
  if (!items.length) {
    grid.innerHTML = currentProductBanner + '<p class="product-empty">Tiada item untuk filter ini.</p>';
    return;
  }
  const subcats = orderedProductSubcategories(items);
  if (currentProductFilter === 'all' && subcats.length > 1) {
    grid.innerHTML = currentProductBanner + subcats.map(sub => {
      const groupItems = items.filter(item => productSubcategory(item) === sub);
      return renderProductSubsection(sub, groupItems);
    }).join('');
  } else {
    grid.innerHTML = currentProductBanner + items.map(productCardHTML).join('');
  }
  setTimeout(initScrollReveal, 100);
}
function flyToCart(originEl) {
  if (!originEl) return;
  const cartBtn = document.querySelector('.cart-btn') || document.querySelector('.bn-cart');
  if (!cartBtn) return;
  const from = originEl.getBoundingClientRect();
  const to = cartBtn.getBoundingClientRect();
  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  dot.style.left = (from.left + from.width / 2 - 9) + 'px';
  dot.style.top = (from.top + from.height / 2 - 9) + 'px';
  dot.style.setProperty('--fly-x', (to.left - from.left) + 'px');
  dot.style.setProperty('--fly-y', (to.top - from.top) + 'px');
  document.body.appendChild(dot);
  cartBtn.style.transform = 'scale(1.12)';
  setTimeout(() => { cartBtn.style.transform = ''; }, 300);
  dot.addEventListener('animationend', () => dot.remove());
}
function updateModalCartBtn(item) {
  const btn = document.getElementById('product-modal-cart-btn');
  if (!btn || !item) return;
  const oos = isOutOfStock(item);
  const qty = getCartQtyForItem(item.id);
  btn.disabled = oos;
  btn.classList.toggle('in-cart', qty > 0);
  btn.innerHTML = oos
    ? '<i class="fa-solid fa-ban"></i> Habis Stok'
    : '<i class="fa-solid fa-cart-plus"></i> Add to Cart' + (qty > 0 ? '<span class="pm-qty">' + qty + '</span>' : '');
}
function getGameBadgeMeta(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const key = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom';
  return { text, key };
}
function renderGames() {
  renderPlatformFilters();
  const visibleGames = catalogGames();
  document.getElementById('game-grid').innerHTML = visibleGames.map(g => {
    const badgeMeta = getGameBadgeMeta(g.badge || g.badgeTitle || g.badgeText || g.titleBadge || g.label);
    const badge = badgeMeta ? '<div class="gc-badge ' + badgeMeta.key + '">' + escapeHtml(badgeMeta.text) + '</div>' : '';
    if (g.oos) return '<div class="gc oos reveal"><div class="gc-icon-wrap">' + badge + renderMediaHTML(g, 'game') + '<div class="oos-pill">Soon</div></div><div class="gc-name">' + g.name.toUpperCase() + '</div></div>';
    return '<div class="gc reveal" onclick="openGame(\'' + g.name.replace(/'/g,"\\'") + '\')"><div class="gc-icon-wrap">' + badge + renderMediaHTML(g, 'game') + '</div><div class="gc-name">' + g.name.toUpperCase() + '</div></div>';
  }).join('');
  initScrollReveal();
}
function openGame(name, options = {}) {
  currentGame = name;
  if (!options.fromUrl) updateGameUrl(name);
  // Highlight active game
  document.querySelectorAll('.gc').forEach(el => el.classList.remove('active'));
  let items = inventory.filter(i => gameGroupName(i) === name);
  // Sort items: in-stock first, out-of-stock last
  items.sort((a, b) => isOutOfStock(a) - isOutOfStock(b));
  document.getElementById('pv-title').textContent = name;
  document.getElementById('pv-count').textContent = items.length + ' item tersedia';
  const grid = document.getElementById('inventory-grid');
  if (grid) grid.innerHTML = renderProductSkeleton(6);
  let banner = '';
  if (name === 'Robux Via Log in') {
    banner = '<div style="grid-column:1/-1;background:rgba(245,158,11,0.06);border:1px solid var(--border2);border-radius:var(--radius);padding:16px 20px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;"><i class="fa-solid fa-circle-info" style="color:var(--sky);font-size:16px;flex-shrink:0;margin-top:2px"></i><div><div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--sky);margin-bottom:6px"><i class="fa-solid fa-circle-info"></i> Cara Top Up Via Log In</div><div style="font-size:13px;color:var(--ink);line-height:1.9;font-weight:300"><i class="fa-brands fa-whatsapp"></i> <strong>Hubungi Admin</strong> via WhatsApp dan hantar username & password Roblox.<br><i class="fa-solid fa-clock"></i> Proses antara <strong>1-25 minit</strong>.<br><i class="fa-solid fa-shield-halved"></i> Akaun dipulangkan segera selepas top up selesai.<br><i class="fa-solid fa-lock"></i> Pastikan tiada <strong>2FA</strong> aktif.</div><a href="https://wa.me/' + WA_NUMBER + '" target="_blank" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:8px 14px;background:var(--sky);color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;"><i class="fa-brands fa-whatsapp"></i> DM Admin</a></div></div>';
  } else if (name === 'Brookhaven') {
    banner = '<div style="grid-column:1/-1;background:var(--red-bg);border:1px solid var(--red-bdr);border-radius:var(--radius);padding:16px 20px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--red);font-size:16px;flex-shrink:0;margin-top:2px"></i><div><div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--red);margin-bottom:6px"><i class="fa-solid fa-triangle-exclamation"></i> Penting Sebelum Beli!</div><div style="font-size:13px;color:var(--ink);line-height:1.9;font-weight:300"><i class="fa-solid fa-ticket"></i> Gamepass hanya boleh dibeli <strong>1x sahaja</strong>.<br><i class="fa-solid fa-user-check"></i> Semak username Roblox dengan teliti.<br><i class="fa-solid fa-circle-exclamation"></i> H4SX tidak bertanggungjawab atas kesilapan username.</div></div></div>';
  }
  currentProductItems = items;
  currentProductBanner = banner;
  currentProductFilter = 'all';
  renderProductFilters();
  showView('product-view');
  setTimeout(renderProductGrid, 90);
}
function openSearch() { document.getElementById('search-overlay').classList.add('show'); document.body.style.overflow='hidden'; setTimeout(()=>document.getElementById('search-input').focus(),100); }
function closeSearch() { document.getElementById('search-overlay').classList.remove('show'); document.body.style.overflow=''; document.getElementById('search-input').value=''; document.getElementById('search-results').innerHTML=''; }
function quickSearch(text) {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.value = text;
  doSearch(text);
  input.focus();
}
function searchTextForItem(item) {
  return [
    item.name, item.game, gameGroupName(item), item.desc, item.promoLabel,
    item.platform, item.subcategory, item.gameGroup, item.category,
    item.badge, item.badgeTitle, Number(item.price || 0).toFixed(2)
  ].filter(Boolean).join(' ').toLowerCase();
}
function parseSearchIntent(q) {
  const text = q.toLowerCase().trim();
  const maxMatch = text.match(/(?:bawah|under|<=|max)\s*(?:rm)?\s*(\d+(?:\.\d+)?)/i) || text.match(/rm\s*(\d+(?:\.\d+)?)\s*(?:bawah|under)/i);
  return {
    text,
    wantsStock: /\b(stok|stock|ready|ada|available)\b/.test(text),
    wantsPromo: /\b(promo|sale|discount|offer)\b/.test(text),
    wantsCheap: /\b(murah|cheap|budget)\b/.test(text),
    wantsVideo: /\b(video|vid)\b/.test(text),
    maxPrice: maxMatch ? Number(maxMatch[1]) : null
  };
}
function doSearch(q) {
  const res = document.getElementById('search-results');
  if (!q.trim()) { res.innerHTML=''; return; }
  const intent = parseSearchIntent(q);
  const plainTerms = intent.text
    .replace(/\b(stok|stock|ready|ada|available|promo|sale|discount|offer|murah|cheap|budget|video|vid|bawah|under|max|rm)\b/g, ' ')
    .replace(/[<=>]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !/^\d+(\.\d+)?$/.test(t));
  let hits = inventory.filter(item => {
    const hay = searchTextForItem(item);
    const textMatch = !plainTerms.length || plainTerms.every(t => hay.includes(t));
    if (!textMatch) return false;
    if (intent.wantsStock && isOutOfStock(item)) return false;
    if (intent.wantsPromo && !(item.promoLabel || (item.originalPrice && item.originalPrice > item.price))) return false;
    if (intent.wantsCheap && Number(item.price || 0) > 5) return false;
    if (intent.wantsVideo && !isVideoMediaUrl(productMediaUrl(item), item)) return false;
    if (intent.maxPrice != null && Number(item.price || 0) > intent.maxPrice) return false;
    return true;
  });
  hits.sort((a, b) => {
    const stockDiff = isOutOfStock(a) - isOutOfStock(b);
    if (stockDiff) return stockDiff;
    return Number(b.sold || 0) - Number(a.sold || 0);
  });
  if (!hits.length) { res.innerHTML='<p class="sr-empty">Tiada produk untuk "' + escapeHtml(q) + '". Cuba cari nama game, "stok ada", "promo", "murah", atau "under rm10".</p>'; return; }
  res.innerHTML = '<div class="search-summary"><b>' + hits.length + '</b> result untuk "' + escapeHtml(q) + '"</div>' + hits.slice(0,8).map(item => {
    const pHTML = (item.originalPrice && item.originalPrice > item.price) ? '<span class="pprice" style="font-size:15px">RM' + Number(item.price).toFixed(2) + '</span><span class="pprice-old" style="font-size:10px">RM' + item.originalPrice + '</span>' : '<span class="pprice" style="font-size:15px">RM' + Number(item.price).toFixed(2) + '</span>';
    const oos = isOutOfStock(item);
    const buyBtn = oos ? '<button class="pbuy" disabled style="height:26px;font-size:9px">BUY</button>' : '<button class="pbuy" style="height:26px;font-size:9px" onclick="event.stopPropagation();closeSearch();buyNowItem(' + item.id + ')">BUY</button>';
    return '<div class="pc search-card" onclick="closeSearch();openGame(\'' + gameGroupName(item).replace(/'/g,"\\'") + '\')"><div class="pimg" style="height:110px" role="button" tabindex="0" data-product-id="' + item.id + '" onclick="event.stopPropagation();openProductImage(' + item.id + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();event.stopPropagation();openProductImage(' + item.id + ')}">' + renderMediaHTML(item, 'search') + getStockBadge(item) + '</div><div class="pbody" style="padding:10px">' + productMiniStatusHTML(item) + '<div class="pname" style="font-size:13px">' + escapeHtml(item.name) + '</div><div class="psold" style="font-size:10px;margin-bottom:6px">' + escapeHtml(gameGroupName(item)) + '</div><div style="display:flex;align-items:center;justify-content:space-between;gap:6px"><div>' + pHTML + '</div>' + buyBtn + '</div></div></div>';
  }).join('');
}
function openJsonHelper() {
  const modal = document.getElementById('json-helper-modal');
  if (!modal) return;
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('jh-name')?.focus(), 80);
}
function closeJsonHelper() {
  const modal = document.getElementById('json-helper-modal');
  if (!modal) return;
  modal.classList.remove('show');
  document.body.style.overflow = '';
}
function jhValue(id) {
  return (document.getElementById(id)?.value || '').trim();
}
function fillJsonHelperExample() {
  const values = {
    'jh-name': 'Tiger Fruit',
    'jh-game': 'Blox Fruit Buah/Fruit',
    'jh-sub': 'Buah/Fruit',
    'jh-platform': 'Roblox',
    'jh-price': '7',
    'jh-stock': '3',
    'jh-sold': '0',
    'jh-badge': 'New',
    'jh-img': 'https://i.imgur.com/QJefiGX.png',
    'jh-desc': 'Via trade. Ready stock.'
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  generateProductJson();
}
function generateProductJson() {
  const price = Number(jhValue('jh-price'));
  const stock = Number(jhValue('jh-stock'));
  const sold = Number(jhValue('jh-sold'));
  const obj = {
    name: jhValue('jh-name') || 'Nama Produk',
    game: jhValue('jh-game') || 'Nama Game',
    platform: jhValue('jh-platform') || 'Roblox',
    subcategory: jhValue('jh-sub') || undefined,
    img: jhValue('jh-img') || 'https://i.imgur.com/xxxx.png',
    price: Number.isFinite(price) ? price : 0,
    stock: Number.isFinite(stock) ? stock : 0,
    sold: Number.isFinite(sold) ? sold : 0,
    badge: jhValue('jh-badge') || undefined,
    desc: jhValue('jh-desc') || '',
    updatedAt: new Date().toISOString().slice(0, 10)
  };
  Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
  const out = document.getElementById('jh-output');
  if (out) out.value = JSON.stringify(obj, null, 2);
}
async function copyJsonHelperOutput() {
  const out = document.getElementById('jh-output');
  if (!out) return;
  if (!out.value.trim()) generateProductJson();
  try {
    await navigator.clipboard.writeText(out.value);
    toast('JSON produk sudah copy', false);
  } catch (err) {
    out.select();
    document.execCommand('copy');
    toast('JSON produk sudah copy', false);
  }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeSearch(); closeQR(); closeProductImage();
    closeJsonHelper();
    if (document.getElementById('changelog-modal')?.classList.contains('show')) dismissChangelog();
  }
});
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }); }, { threshold:0.1 });
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
}
function animateCounters() {
  document.querySelectorAll('[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target), prefix = el.dataset.prefix||'', suffix = el.dataset.suffix||'';
    let cur = 0, step = Math.ceil(target/60);
    const t = setInterval(() => { cur = Math.min(cur+step,target); el.textContent = prefix+cur+suffix; if(cur>=target) clearInterval(t); }, 25);
  });
}
function getCartCount() { return cartItems.reduce((s,ci)=>s+ci.qty,0); }
function getMaxPurchase(item) { 
  if (!item) return null; 
  if (Number.isFinite(item.maxPurchase) && item.maxPurchase > 0) return Math.floor(item.maxPurchase); 
  if (Number.isFinite(item.stock) && item.stock > 0) return item.stock;
  if (item.game === 'Brookhaven') return 1; 
  return null; 
}
function boolFromItem(item, keys) {
  for (const k of keys) {
    if (item[k] === true) return true;
    if (typeof item[k] === 'string' && item[k].toLowerCase() === 'true') return true;
  }
  return false;
}
function numberFromItem(item, keys) {
  for (const k of keys) {
    const v = Number(item[k]);
    if (Number.isFinite(v) && v >= 0) return Math.floor(v);
  }
  return null;
}
function getCheckoutRequirement(item) {
  if (!item) return { requireLogin:false, requirePassword:false, backupCodeCount:0 };
  const isRobux = item.game === 'Robux Via Log in';
  const requireLogin = boolFromItem(item, ['requireLogin', 'requiresLogin', 'needLogin', 'needCredentials']) || isRobux;
  const requirePassword = boolFromItem(item, ['requirePassword', 'requiresPassword', 'needPassword']) || isRobux;
  const backupFromNumber = numberFromItem(item, ['backupCodeCount', 'backupCodesCount', 'backup_count']);
  const requireBackup = boolFromItem(item, ['requireBackupCodes', 'needBackupCodes', 'requiresBackupCodes']) || isRobux;
  const backupCodeCount = backupFromNumber != null ? backupFromNumber : (requireBackup ? 2 : 0);
  return { requireLogin, requirePassword, backupCodeCount: Math.max(0, Math.min(2, backupCodeCount)) };
}
function resolveCheckoutRequirements() {
  return cartItems.reduce((acc, ci) => {
    const item = inventory.find(i => i.id === ci.id);
    const r = getCheckoutRequirement(item);
    return {
      requireLogin: acc.requireLogin || r.requireLogin,
      requirePassword: acc.requirePassword || r.requirePassword,
      backupCodeCount: Math.max(acc.backupCodeCount, r.backupCodeCount)
    };
  }, { requireLogin:false, requirePassword:false, backupCodeCount:0 });
}
function updateCredentialFields() {
  const block = document.getElementById('account-cred-block');
  const userLabel = document.getElementById('login-user-label');
  const passLabel = document.getElementById('login-pass-label');
  const back1 = document.getElementById('backup-wrap-1');
  const back2 = document.getElementById('backup-wrap-2');
  if (!block || !userLabel || !passLabel || !back1 || !back2) return;
  const showBlock = checkoutReq.requireLogin || checkoutReq.requirePassword || checkoutReq.backupCodeCount > 0;
  block.classList.toggle('hidden', !showBlock);
  userLabel.style.display = checkoutReq.requireLogin ? 'block' : 'none';
  document.getElementById('login-username').style.display = checkoutReq.requireLogin ? 'block' : 'none';
  passLabel.style.display = checkoutReq.requirePassword ? 'block' : 'none';
  document.getElementById('login-password').style.display = checkoutReq.requirePassword ? 'block' : 'none';
  back1.classList.toggle('hidden', checkoutReq.backupCodeCount < 1);
  back2.classList.toggle('hidden', checkoutReq.backupCodeCount < 2);
}
async function takeScreenshot() {
  try {
    const ssBtn = document.getElementById('pv-ss-btn');
    if (ssBtn) { ssBtn.disabled = true; ssBtn.style.opacity = '0.55'; }
    
    toast('Screenshot produk sedang dibuat...', false);

    const items = inventory
      .filter(i => gameGroupName(i) === currentGame)
      .sort((a, b) => isOutOfStock(a) - isOutOfStock(b));
    if (!items.length) {
      toast('Tiada produk untuk screenshot', true);
      return;
    }

    const board = document.createElement('div');
    board.className = 'product-ss-board';
    const maxCols = items.length <= 5 ? items.length : 5;
    const ssCols = Math.max(1, maxCols);
    const ssCardWidth = items.length <= 2 ? 270 : 230;
    const ssGap = 10;
    const ssPadding = 48;
    const ssGridWidth = (ssCols * ssCardWidth) + ((ssCols - 1) * ssGap);
    const ssBoardWidth = Math.max(560, Math.min(1280, ssGridWidth + ssPadding));
    board.style.setProperty('--ss-cols', String(ssCols));
    board.style.setProperty('--ss-card-width', `${ssCardWidth}px`);
    board.style.setProperty('--ss-board-width', `${ssBoardWidth}px`);
    board.innerHTML = `
      <div class="product-ss-head">
        <img src="https://i.imgur.com/cLPulXQ.png" alt="H4SX">
        <div>
          <div class="product-ss-brand">H4SX STORE</div>
          <div class="product-ss-title">${escapeForHtml(currentGame || 'Produk')}</div>
        </div>
        <div class="product-ss-count">${items.length} item</div>
      </div>
      <div class="product-ss-grid">
        ${items.map(item => {
          const oos = isOutOfStock(item);
          const price = Number(item.price || 0).toFixed(2);
          const oldPrice = item.originalPrice && item.originalPrice > item.price
            ? `<span class="product-ss-old">RM${escapeForHtml(item.originalPrice)}</span>`
            : '';
          return `
            <div class="product-ss-card${oos ? ' is-oos' : ''}">
              <div class="product-ss-img">
                <img src="${escapeForHtml(productPosterUrl(item) || getProductScreenshotFallback())}" alt="${escapeForHtml(item.name || '')}" crossorigin="anonymous" onerror="this.onerror=null;this.src='${escapeForHtml(getProductScreenshotFallback())}'">
                ${oos ? '<span class="product-ss-stock out">Habis</span>' : getStockLabelForScreenshot(item)}
              </div>
              <div class="product-ss-body">
                <div class="product-ss-name">${escapeForHtml(item.name || 'Item')}</div>
                <div class="product-ss-meta">${escapeForHtml(String(item.sold || 0))} sold</div>
                <div class="product-ss-price"><span>RM${price}</span>${oldPrice}</div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div class="product-ss-foot">h4sx-store.vercel.app</div>`;
    document.body.appendChild(board);
    await waitForBoardImages(board);
    await ensureHtml2Canvas();

    const canvas = await html2canvas(board, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false
    });
    board.remove();
    
    // Convert canvas to blob and copy to clipboard
    canvas.toBlob(async (blob) => {
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          toast('Screenshot produk disalin ke clipboard!', false);
        } else {
          // Fallback: download if clipboard not supported
          const link = document.createElement('a');
          link.download = `h4sx-${(currentGame || 'produk').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Date.now()}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          toast('Clipboard tidak disokong, muat turun screenshot...', false);
        }
      } catch (clipErr) {
        console.error('Clipboard error:', clipErr);
        // Fallback: download
        const link = document.createElement('a');
        link.download = `h4sx-${(currentGame || 'produk').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast('Clipboard tidak disokong, muat turun screenshot...', false);
      }
    });
    
  } catch (err) {
    toast('Gagal mengambil screenshot', true);
    console.error(err);
  } finally {
    const ssBtn = document.getElementById('pv-ss-btn');
    if (ssBtn) { ssBtn.disabled = false; ssBtn.style.opacity = '1'; }
  }
}
function escapeForHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function escapeCssUrl(value) {
  return escapeForHtml(String(value ?? '').replace(/['"\\\n\r]/g, ''));
}
function getStockLabelForScreenshot(item) {
  const stock = Number(item.stock);
  if (Number.isFinite(stock) && stock > 0 && stock <= 3) {
    return '<span class="product-ss-stock low">Stok ' + stock + '</span>';
  }
  return '<span class="product-ss-stock ok">Ready</span>';
}
function getProductScreenshotFallback() {
  const game = catalogGames(true).find(g => g.name === currentGame);
  return cleanUrl(game?.img || 'https://i.imgur.com/cLPulXQ.png');
}
function waitForBoardImages(root) {
  const imgs = [...root.querySelectorAll('img')];
  if (!imgs.length) return Promise.resolve();
  return Promise.race([
    Promise.all(imgs.map(img => new Promise(resolve => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      img.addEventListener('load', resolve, { once:true });
      img.addEventListener('error', () => setTimeout(resolve, 350), { once:true });
    }))),
    new Promise(resolve => setTimeout(resolve, 5000))
  ]);
}
function updateAddButtons() {
  document.querySelectorAll('.pc').forEach(card => {
    const imgEl = card.querySelector('[data-product-id]');
    if (!imgEl) return;
    const itemId = parseInt(imgEl.getAttribute('data-product-id'));
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    const oos = isOutOfStock(item);
    const qty = getCartQtyForItem(itemId);
    const addBtn = card.querySelector('.padd');
    const buyBtn = card.querySelector('.pbuy');
    const cartHint = card.querySelector('.pcart-hint');

    if (addBtn) {
      addBtn.disabled = oos;
      addBtn.classList.toggle('in-cart', qty > 0 && !oos);
      if (oos) {
        addBtn.innerHTML = '<i class="fa-solid fa-ban"></i><span class="padd-txt">Habis</span>';
      } else {
        addBtn.innerHTML = '<i class="fa-solid fa-cart-plus"></i><span class="padd-txt">Cart</span>' + (qty > 0 ? '<span class="padd-qty">' + qty + '</span>' : '');
      }
    }
    if (buyBtn) buyBtn.disabled = oos;
    if (cartHint) {
      cartHint.classList.toggle('show', qty > 0);
      if (qty > 0) cartHint.innerHTML = '<i class="fa-solid fa-check-circle"></i> ' + qty + ' in cart';
    }
    card.style.opacity = oos ? '0.65' : '1';
  });

  document.querySelectorAll('#search-results .pc').forEach(card => {
    const imgEl = card.querySelector('[data-product-id]');
    if (!imgEl) return;
    const itemId = parseInt(imgEl.getAttribute('data-product-id'));
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    const buyBtn = card.querySelector('.pbuy');
    if (buyBtn) buyBtn.disabled = isOutOfStock(item);
  });

  if (modalItemId) {
    const modalItem = inventory.find(i => i.id === modalItemId);
    if (modalItem) updateModalCartBtn(modalItem);
  }
}
function addCart(input, originEl) {
  let item, name;
  if (typeof input === 'number') {
    item = inventory.find(i=>i.id===input);
    if (!item) return;
    name = item.name;
  } else {
    // For PS servers
    name = input;
    item = { id: name, name: name, price: 0, game: 'PS' }; 
  }
  if (typeof input === 'number' && isOutOfStock(item)) { toast('Barang habis stok!',true); return; }
  if (getCartCount()>=20) { toast('Cart penuh (max 20)',true); return; }
  
  const ex = cartItems.find(ci=>ci.id === (typeof input === 'number' ? input : name));
  const max = (typeof input === 'number') ? getMaxPurchase(item) : 1;
  
  if (max && ex && ex.qty >= max) { 
    toast('Limit pembelian item ini: ' + max + 'x', true); 
    return; 
  }
  if (ex) ex.qty++; 
  else cartItems.push({id: (typeof input === 'number' ? input : name), qty:1});
  
  updateBadge();
  updateAddButtons();
  if (originEl) flyToCart(originEl);
  
  // Spam counter logic
  if (!spamCounts[name]) spamCounts[name] = 0;
  spamCounts[name]++;
  if (spamCounts[name] > 20) spamCounts[name] = 20;
  
  toast('Added to cart ?', false, name, spamCounts[name]);
  clearTimeout(toastTimeouts[name]);
  toastTimeouts[name] = setTimeout(() => { spamCounts[name] = 0; }, 3000);
}
function changeQty(id, delta) {
  const ci = cartItems.find(c=>c.id===id); if (!ci) return;
  const item = inventory.find(i=>i.id===id); const max = getMaxPurchase(item);
  if (delta > 0 && max && ci.qty >= max) { toast('Limit: ' + max + 'x', true); return; }
  ci.qty += delta; if (ci.qty<=0) cartItems = cartItems.filter(c=>c.id!==id);
  updateBadge(); 
  renderCart();
  updateAddButtons();
}
function removeItem(id) { 
  cartItems = cartItems.filter(c=>c.id!==id); 
  updateBadge(); 
  renderCart();
  updateAddButtons();
}
function clearCart() { 
  if (!cartItems.length) return; 
  cartItems=[]; 
  updateBadge(); 
  renderCart(); 
  updateAddButtons();
  toast('Cart cleared');
}
function updateBadge() {
  const count = getCartCount();
  const b = document.getElementById('cart-badge'), p = document.getElementById('cart-pill'), bnb = document.getElementById('bn-badge');
  if (b) { b.textContent=count; b.style.display=count?'flex':'none'; }
  if (p) p.textContent=count;
  if (bnb) { bnb.textContent=count; bnb.style.display=count?'flex':'none'; }
}
function toggleCart() { document.getElementById('cart-overlay').classList.toggle('show'); renderCart(); }
function ocClose(e) { if (e.target===document.getElementById('cart-overlay')) toggleCart(); }
function renderCart() {
  const body = document.getElementById('cart-body');
  if (!cartItems.length) { body.innerHTML = '<div class="cart-empty"><i class="fa-solid fa-bag-shopping" style="font-size:28px;color:var(--border2);margin-bottom:10px;display:block"></i>Cart kosong</div>'; document.getElementById('cart-total').textContent = 'RM0'; return; }
  let tot = 0;
  body.innerHTML = cartItems.map(ci => {
    const item = inventory.find(i=>i.id===ci.id); if (!item) return '';
    const line = (item.price*ci.qty).toFixed(2); tot += item.price*ci.qty;
    const max = getMaxPurchase(item); const limited = max && ci.qty >= max;
    const plusBtn = limited ? '<button class="cr-qty-btn" disabled style="opacity:.4;cursor:not-allowed">+</button>' : '<button class="cr-qty-btn" onclick="changeQty(' + ci.id + ',1)">+</button>';
    return '<div class="cart-row"><img class="cr-img" src="' + productPosterUrl(item) + '" alt="' + item.name + '" onerror="this.style.display=\'none\'"><div class="cr-i"><div class="cr-n">' + item.name + '</div><div class="cr-p">RM' + Number(item.price).toFixed(2) + ' ? ' + ci.qty + ' = <strong style="color:var(--sky)">RM' + line + '</strong></div></div><div class="cr-qty"><button class="cr-qty-btn" onclick="changeQty(' + ci.id + ',-1)">?</button><span class="cr-qty-num">' + ci.qty + '</span>' + plusBtn + '</div><button class="cr-del" onclick="removeItem(' + ci.id + ')"><i class="fa-solid fa-trash-can"></i></button></div>';
  }).join('');
  document.getElementById('cart-total').textContent = 'RM' + tot.toFixed(2);
}
function goCO(focusPayment) {
  if (!cartItems.length) { toast('Cart is empty',true); return; }
  document.getElementById('cart-overlay').classList.remove('show');
  let tot = 0;
  
  // Check if this is a promoted item
  const firstItem = inventory.find(i=>i.id===cartItems[0].id);
  const isPromotedItem = firstItem && firstItem.promotedBy && firstItem.promoterPhone;
  document.getElementById('co-items').innerHTML = cartItems.map(ci => {
    const item = inventory.find(i=>i.id===ci.id); if (!item) return '';
    const line = item.price*ci.qty; tot += line;
    return '<div class="order-row"><span class="or-name">' + item.name + (ci.qty>1?' ×'+ci.qty:'') + '</span><span class="or-price">RM' + line.toFixed(2) + '</span></div>';
  }).join('');
  document.getElementById('co-total').textContent = 'RM' + tot.toFixed(2);
  
  // Show/hide Roblox username field based on config and if it's promoted item
  const usernameBlock = document.getElementById('roblox-username')?.closest('.co-block');
  const usernameRequired = !isPromotedItem && (storeConfig.checkout && storeConfig.checkout.requireRobloxUsername !== false);
  if (usernameBlock) {
    usernameBlock.style.display = usernameRequired ? '' : 'none';
  }
  
  // Show/hide payment methods (QR) based on if it's promoted item
  const paymentSection = document.querySelector('.pay-methods');
  const qrModalBtn = document.getElementById('qr-modal-img');
  if (paymentSection) {
    paymentSection.style.display = isPromotedItem ? 'none' : '';
  }
  // Hide QR panels in checkout for promoted items
  const qrPanels = document.querySelectorAll('[id^="panel-"]');
  qrPanels.forEach(p => p.style.display = isPromotedItem ? 'none' : '');
  
  checkoutReq = resolveCheckoutRequirements();
  updateCredentialFields();
  showView('checkout-view');
  
  // For promoted items, hide send button and show contact promoter button
  const sendBtn = document.getElementById('send-btn');
  let promoterBtn = document.getElementById('promoter-contact-btn');
  if (isPromotedItem) {
    if (sendBtn) sendBtn.style.display = 'none';
    if (!promoterBtn) {
      promoterBtn = document.createElement('button');
      promoterBtn.id = 'promoter-contact-btn';
      promoterBtn.style.cssText = 'width:100%;padding:12px;background:#25D366;color:#fff;border:none;border-radius:var(--radius);font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;';
      sendBtn.parentNode.appendChild(promoterBtn);
    }
    promoterBtn.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Hubungi ' + firstItem.promotedBy;
    promoterBtn.onclick = () => {
      const message = encodeURIComponent('Hi! Saya ingin membeli ' + firstItem.name + ' (RM' + Number(firstItem.price).toFixed(2) + ')');
      window.open('https://wa.me/' + firstItem.promoterPhone + '?text=' + message, '_blank');
    };
  } else {
    if (sendBtn) sendBtn.style.display = '';
    if (promoterBtn) promoterBtn.remove();
  }
  
  valCO();
  if (focusPayment && !isPromotedItem) {
    setTimeout(() => {
      const paySection = document.querySelector('.pay-methods');
      if (paySection) {
        smoothScrollWithHeader(paySection);
      }
    }, 280);
  }
}
function valCO() {
  const u = document.getElementById('roblox-username').value.trim(); const b = document.getElementById('send-btn');
  const loginUser = document.getElementById('login-username')?.value.trim() || '';
  const loginPass = document.getElementById('login-password')?.value.trim() || '';
  const backup1 = document.getElementById('backup-code-1')?.value.trim() || '';
  const backup2 = document.getElementById('backup-code-2')?.value.trim() || '';
  
  // Check if this is a promoted item
  let isPromotedItem = false;
  if (cartItems.length > 0) {
    const firstItem = inventory.find(i=>i.id===cartItems[0].id);
    isPromotedItem = firstItem && firstItem.promotedBy && firstItem.promoterPhone;
  }
  
  let tot = 0; cartItems.forEach(ci => { const it = inventory.find(i=>i.id===ci.id); if (it) tot += it.price*ci.qty; });
  // Check if username is required based on config and if it's promoted item
  const usernameRequired = !isPromotedItem && (storeConfig.checkout && storeConfig.checkout.requireRobloxUsername !== false);
  const usernameOk = !usernameRequired || u.length >= 3;
  const loginOk = !checkoutReq.requireLogin || loginUser.length >= 3;
  const passOk = !checkoutReq.requirePassword || loginPass.length >= 3;
  const backup1Ok = checkoutReq.backupCodeCount < 1 || backup1.length >= 3;
  const backup2Ok = checkoutReq.backupCodeCount < 2 || backup2.length >= 3;
  if (usernameOk && loginOk && passOk && backup1Ok && backup2Ok) {
    b.classList.remove('dis'); b.innerHTML = 'Generate Receipt &nbsp;<i class="fa-solid fa-arrow-right"></i>';
    b.onclick = openReceipt;
    b.href = 'javascript:void(0)';
  } else {
    b.classList.add('dis');
    if (!usernameOk) b.innerHTML = 'Enter username first';
    else if (!loginOk) b.innerHTML = 'Isi login username';
    else if (!passOk) b.innerHTML = 'Isi login password';
    else if (!backup1Ok) b.innerHTML = 'Isi backup code 1';
    else if (!backup2Ok) b.innerHTML = 'Isi backup code 2';
    else b.innerHTML = 'Lengkapkan maklumat';
    b.href = 'javascript:void(0)';
    b.onclick = null;
  }
}
function selectPay(method) {
  activePayMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('pay-btn-'+method); if (btn) btn.classList.add('active');
  document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-'+method); if (panel) panel.classList.add('active');
  valCO();
}
function openQR(method) {
  const m = method || activePayMethod, data = PAY_QR[m]; if (!data) return;
  const img = document.getElementById('qr-modal-img'), name = document.getElementById('qr-modal-name'), sub = document.getElementById('qr-modal-sub');
  if (img) img.src = data.url; if (name) name.textContent = data.name; if (sub) sub.textContent = data.sub;
  
  // Update QR modal subtitle based on payment method
  if (sub) {
    if (m === 'tng') {
      sub.textContent = "Touch 'n Go eWallet";
    } else {
      sub.textContent = 'DuitNow QR';
    }
  }
  
  document.getElementById('qr-modal')?.classList.add('show');
}
function closeQR() { document.getElementById('qr-modal')?.classList.remove('show'); }
function openProductImage(id) {
  const item = inventory.find(i => String(i.id) === String(id));
  if (!item) return;
  modalItemId = item.id;
  const mediaWrap = document.getElementById('product-modal-media');
  if (mediaWrap) mediaWrap.innerHTML = renderMediaHTML(item, 'modal');
  const gameEl = document.getElementById('product-modal-game');
  const nameEl = document.getElementById('product-modal-name');
  const metaEl = document.getElementById('product-modal-meta');
  const priceEl = document.getElementById('product-modal-price');
  const oldPriceEl = document.getElementById('product-modal-price-old');
  const descEl = document.getElementById('product-modal-desc');
  const summaryEl = document.getElementById('product-modal-summary');
  if (gameEl) gameEl.textContent = item.game || '';
  if (nameEl) nameEl.textContent = item.name || 'Item';
  if (priceEl) priceEl.textContent = 'RM' + Number(item.price || 0).toFixed(2);
  if (oldPriceEl) oldPriceEl.textContent = (item.originalPrice && item.originalPrice > item.price) ? 'RM' + item.originalPrice : '';
  if (descEl) descEl.textContent = item.desc || 'Tiada description.';
  if (summaryEl) {
    const saving = item.originalPrice && item.originalPrice > item.price ? Math.max(0, Number(item.originalPrice) - Number(item.price || 0)) : 0;
    const stockText = isOutOfStock(item) ? 'Habis stok' : (item.stock != null ? item.stock + ' stok' : 'Tersedia');
    summaryEl.innerHTML =
      '<div><span>Kategori</span><strong>' + escapeHtml(item.game || '-') + '</strong></div>' +
      '<div><span>Status</span><strong>' + escapeHtml(stockText) + '</strong></div>' +
      '<div><span>Jimat</span><strong>' + (saving ? 'RM' + saving.toFixed(2) : 'Harga Net') + '</strong></div>';
  }
  if (metaEl) {
    const oos = isOutOfStock(item);
    const chips = [
      '<span class="pm-chip hot"><i class="fa-solid fa-fire"></i>' + (item.sold || 0) + ' sold</span>'
    ];
    if (item.promoLabel) chips.push('<span class="pm-chip hot"><i class="fa-solid fa-tag"></i>' + item.promoLabel + '</span>');
    if (oos) chips.push('<span class="pm-chip out"><i class="fa-solid fa-box-open"></i>Habis Stok</span>');
    else if (item.stock != null) chips.push('<span class="pm-chip stock"><i class="fa-solid fa-box"></i>' + item.stock + ' stok</span>');
    else chips.push('<span class="pm-chip stock"><i class="fa-solid fa-circle-check"></i>Tersedia</span>');
    metaEl.innerHTML = chips.join('');
  }
  updateModalCartBtn(item);
  const modal = document.getElementById('product-modal');
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}
function closeProductImage() {
  document.getElementById('product-modal')?.classList.remove('show');
  const mediaWrap = document.getElementById('product-modal-media');
  if (mediaWrap) mediaWrap.innerHTML = '';
  modalItemId = null;
  if (!document.getElementById('cart-overlay')?.classList.contains('show') && !document.getElementById('search-overlay')?.classList.contains('show')) {
    document.body.style.overflow = '';
  }
}
function modalAddToCart() {
  if (!modalItemId) return;
  const btn = document.getElementById('product-modal-cart-btn');
  addCart(modalItemId, btn);
}
function modalBuyNow() {
  if (!modalItemId) return;
  const item = inventory.find(i => i.id === modalItemId);
  if (!item || isOutOfStock(item)) { toast('Barang habis stok!', true); return; }
  cartItems = [{ id: modalItemId, qty: 1 }];
  updateBadge();
  closeProductImage();
  goCO(true);
}
function buyNowItem(id) {
  const item = inventory.find(i => i.id === id);
  if (!item || isOutOfStock(item)) { toast('Barang habis stok!', true); return; }
  
  // If it's a promoted item, go directly to promoter's WhatsApp
  if (item.promotedBy && item.promoterPhone) {
    const message = encodeURIComponent('Hi! Saya ingin membeli ' + item.name + ' (RM' + Number(item.price).toFixed(2) + ')');
    window.open('https://wa.me/' + item.promoterPhone + '?text=' + message, '_blank');
    return;
  }
  
  cartItems = [{ id, qty: 1 }];
  updateBadge();
  goCO(true);
}
function toast(msg, err, name, count) {
  const c = document.getElementById('toasts'); if (!c) return;
  
  // Refresh toast for same item
  if (name) {
    const existing = document.querySelectorAll('.toast');
    existing.forEach(t => { if (t.dataset.item === name) t.remove(); });
  }
  const t = document.createElement('div'); 
  t.className = 'toast' + (err?' err':'');
  if (name) t.dataset.item = name;
  let content = '<i class="fa-solid ' + (err?'fa-circle-exclamation':'fa-check') + ' t-ic"></i>' + (name ? '<strong>' + name + '</strong> ' : '') + msg;
  if (count && count > 1) content += '<span class="toast-count">' + count + 'x</span>';
  
  t.innerHTML = content;
  c.appendChild(t);
  
  setTimeout(() => { 
    t.style.animation = 'tout 0.3s ease forwards';
    setTimeout(()=>t.remove(),300); 
  }, 2500);
}
// Initialize 3D Background from Config
(() => {
  const container = document.getElementById('earth-3d-container');
  if (!container) return;
  // Convert Sketchfab link to Embed link
  let modelId = '';
  if (BACKGROUND_3D_URL.includes('/3d-models/')) {
    modelId = BACKGROUND_3D_URL.split('-').pop();
  } else if (BACKGROUND_3D_URL.includes('/models/')) {
    modelId = BACKGROUND_3D_URL.split('/').filter(p => p).pop();
  }
  if (modelId) {
    const embedUrl = `https://sketchfab.com/models/${modelId}/embed?autostart=1&preload=1&transparent=1&ui_hint=0&scrollwheel=0&double_click=0&camera=0`;
    container.innerHTML = `<iframe src="${embedUrl}" allow="autoplay; fullscreen; vr" style="width:100%; height:100%; border:none;"></iframe>`;
  }
})();
// Mouse parallax for 3D background
(() => {
  const bg = document.getElementById('earth-bg');
  if (!bg) return;
  const canUseParallax = window.matchMedia('(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches;
  if (!canUseParallax) return;
  
  let tx = 0, ty = 0, cx = 0, cy = 0, rafId = 0;
  const intensity = 40; 
  window.addEventListener('mousemove', e => {
    tx = (e.clientX / window.innerWidth - 0.5) * intensity;
    ty = (e.clientY / window.innerHeight - 0.5) * intensity;
    if (!rafId) rafId = requestAnimationFrame(tick);
  }, { passive: true });
  function tick() {
    rafId = 0;
    if (document.hidden) return;
    const iframe = bg.querySelector('iframe');
    if (!iframe) return;
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    iframe.style.transform = `scale(1.12) translate(${cx}px, ${cy}px)`;
    if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) {
      rafId = requestAnimationFrame(tick);
    }
  }
})();
// Music Player Control
(() => {
  const audio = document.getElementById('bgMusic');
  const btn = document.getElementById('musicBtn');
  let isPlaying = false;

  function updateButton() {
    if (isPlaying) {
      btn.classList.remove('paused');
      btn.classList.add('playing');
      btn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      btn.classList.remove('playing');
      btn.classList.add('paused');
      btn.innerHTML = '<i class="fas fa-music"></i>';
    }
  }

  btn.addEventListener('click', async () => {
    try {
      if (isPlaying) {
        audio.pause();
        isPlaying = false;
      } else {
        await audio.play();
        isPlaying = true;
      }
      updateButton();
    } catch (e) {
      console.log('Music play error:', e);
    }
  });

  // Initialize button state
  updateButton();
})();
initChangelog();
initReviewSystemPopup();
