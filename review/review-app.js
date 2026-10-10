import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
  import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
  } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
  import {
    getFirestore, collection, addDoc, onSnapshot,
    query, where, orderBy, serverTimestamp,
    doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, deleteField, Timestamp
  } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
  import {
    getDatabase, ref as realtimeRef, onValue
  } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

  // ── Firebase ──────────────────────────────────────────────────
  const app = initializeApp({
    apiKey:"AIzaSyBOkyPe2f1tHu9OQiwHHpgfJTYM-KM7cuU",
    authDomain:"h4sx-6712c.firebaseapp.com",
    projectId:"h4sx-6712c",
    storageBucket:"h4sx-6712c.firebasestorage.app",
    messagingSenderId:"416803081247",
    appId:"1:416803081247:web:e201174233b953e539992a",
    measurementId:"G-J9QWB39V87"
  });
  const db = getFirestore(app);
  const realtimeDb = getDatabase(app, "https://h4sx-6712c-default-rtdb.asia-southeast1.firebasedatabase.app");
  const auth = getAuth(app);
  const TURNSTILE_SITE_KEY = '0x4AAAAAAECCSulruVRqWTEI';
  let reviewTurnstileWidgetId = null;
  let reviewTurnstileResolver = null;
  let reviewTurnstileRejecter = null;
  let reviewTurnstileTimeout = null;
  let reportTurnstileWidgetId = null;
  let reportTurnstileResolver = null;
  let reportTurnstileRejecter = null;
  let reportTurnstileTimeout = null;

  function resetReviewTurnstile() {
    if (reviewTurnstileTimeout) { clearTimeout(reviewTurnstileTimeout); reviewTurnstileTimeout = null; }
    reviewTurnstileResolver = null;
    reviewTurnstileRejecter = null;
    if (reviewTurnstileWidgetId !== null && window.turnstile?.reset) {
      try { window.turnstile.reset(reviewTurnstileWidgetId); } catch (_) {}
    }
  }
  function ensureReviewTurnstile() {
    let container = document.getElementById('review-turnstile');
    if (!container) {
      const submitButton = document.getElementById('butangHantar');
      if (!submitButton) throw new Error('turnstile-container-missing');
      container = document.createElement('div');
      container.id = 'review-turnstile';
      container.className = 'review-turnstile';
      container.setAttribute('aria-hidden', 'true');
      const note = document.createElement('small');
      note.className = 'review-turnstile-note';
      note.innerHTML = 'Dilindungi oleh Cloudflare Turnstile. <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Privasi</a>';
      submitButton.before(container);
      submitButton.before(note);
    }
    if (!window.turnstile) throw new Error('turnstile-not-ready');
    if (reviewTurnstileWidgetId !== null) return reviewTurnstileWidgetId;
    reviewTurnstileWidgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      size: 'invisible',
      execution: 'execute',
      action: 'review_submit',
      callback(token) {
        if (reviewTurnstileTimeout) clearTimeout(reviewTurnstileTimeout);
        reviewTurnstileTimeout = null;
        const resolve = reviewTurnstileResolver;
        reviewTurnstileResolver = null;
        reviewTurnstileRejecter = null;
        resolve?.(token);
      },
      'expired-callback'() { reviewTurnstileRejecter?.(new Error('turnstile-expired')); },
      'error-callback'() { reviewTurnstileRejecter?.(new Error('turnstile-error')); }
    });
    return reviewTurnstileWidgetId;
  }
  async function verifyReviewTurnstile() {
    const widgetId = ensureReviewTurnstile();
    resetReviewTurnstile();
    const token = await new Promise((resolve, reject) => {
      reviewTurnstileResolver = resolve;
      reviewTurnstileRejecter = reject;
      reviewTurnstileTimeout = setTimeout(() => reject(new Error('turnstile-timeout')), 18000);
      try { window.turnstile.execute(widgetId); }
      catch (_) { reject(new Error('turnstile-execute')); }
    });
    try {
      const response = await fetch('/api/review-verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'review_submit' })
      });
      if (!response.ok) throw new Error('turnstile-rejected');
    } finally {
      resetReviewTurnstile();
    }
  }

  function resetReportTurnstile() {
    if (reportTurnstileTimeout) { clearTimeout(reportTurnstileTimeout); reportTurnstileTimeout = null; }
    reportTurnstileResolver = null;
    reportTurnstileRejecter = null;
    if (reportTurnstileWidgetId !== null && window.turnstile?.reset) {
      try { window.turnstile.reset(reportTurnstileWidgetId); } catch (_) {}
    }
  }
  function ensureReportTurnstile() {
    let container = document.getElementById('report-turnstile');
    if (!container) {
      container = document.createElement('div');
      container.id = 'report-turnstile';
      container.setAttribute('aria-hidden', 'true');
      container.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
      document.body.appendChild(container);
    }
    if (!window.turnstile) throw new Error('report-turnstile-not-ready');
    if (reportTurnstileWidgetId !== null) return reportTurnstileWidgetId;
    reportTurnstileWidgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      size: 'invisible',
      execution: 'execute',
      action: 'report_review',
      callback(token) {
        if (reportTurnstileTimeout) clearTimeout(reportTurnstileTimeout);
        reportTurnstileTimeout = null;
        const resolve = reportTurnstileResolver;
        reportTurnstileResolver = null;
        reportTurnstileRejecter = null;
        resolve?.(token);
      },
      'expired-callback'() { reportTurnstileRejecter?.(new Error('report-turnstile-expired')); },
      'error-callback'() { reportTurnstileRejecter?.(new Error('report-turnstile-error')); }
    });
    return reportTurnstileWidgetId;
  }
  async function verifyReportTurnstile(reviewId) {
    const widgetId = ensureReportTurnstile();
    resetReportTurnstile();
    try {
      const token = await new Promise((resolve, reject) => {
        reportTurnstileResolver = resolve;
        reportTurnstileRejecter = reject;
        reportTurnstileTimeout = setTimeout(() => reject(new Error('report-turnstile-timeout')), 18000);
        try { window.turnstile.execute(widgetId); }
        catch (_) { reject(new Error('report-turnstile-execute')); }
      });
      const response = await fetch('/api/review-verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'report_review', reviewId })
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 429) {
        const error = new Error('report-rate-limit');
        error.retryAfter = Number(result.retryAfter || response.headers.get('Retry-After') || 0);
        throw error;
      }
      if (!response.ok) throw new Error('report-turnstile-rejected');
    } finally {
      resetReportTurnstile();
    }
  }

  // -- Light Dark mode ---------------------------------
  const btnThemeToggle = document.getElementById("btnThemeToggle");
  function setThemeMode(mode) {
    const safeMode = mode === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", safeMode);
    try { localStorage.setItem("h4sxTheme", safeMode); } catch(e) {}
    if (btnThemeToggle) btnThemeToggle.textContent = safeMode === "dark" ? "Dark" : "Light";
  }
  setThemeMode(document.documentElement.getAttribute("data-theme") || "light");
  btnThemeToggle?.addEventListener("click", () => {
    setThemeMode(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  // -- Hard refresh --------------------------------------
  const btnHardRefreshReview = document.getElementById("btnHardRefreshReview");
  function cleanHardRefreshParam() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("refresh")) return;
    url.searchParams.delete("refresh");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
  async function hardRefreshReviewSite() {
    if (btnHardRefreshReview?.classList.contains("is-refreshing")) return;
    btnHardRefreshReview?.classList.add("is-refreshing");
    if (btnHardRefreshReview) btnHardRefreshReview.querySelector(".hard-refresh-text").textContent = "Refreshing";
    try {
      const keysToClear = [
        "h4sx_review_notice_hidden_until",
        "h4sxReviewCache",
        "h4sx_review_cache",
        "h4sx_reviews_cache"
      ];
      keysToClear.forEach(key => {
        try { localStorage.removeItem(key); } catch(e) {}
        try { sessionStorage.removeItem(key); } catch(e) {}
      });
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map(async name => {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          await Promise.all(requests.filter(request => new URL(request.url).pathname.startsWith('/review')).map(request => cache.delete(request)));
        }));
      }
      // The shared store service worker stays registered.
    } catch (e) {
      console.log("Hard refresh review gagal clear cache sepenuhnya", e);
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.set("refresh", Date.now().toString());
      window.location.replace(url.toString());
    }
  }
  cleanHardRefreshParam();
  btnHardRefreshReview?.addEventListener("click", hardRefreshReviewSite);
  window.hardRefreshReviewSite = hardRefreshReviewSite;
  // Detect new Vercel HTML while this tab is open. Never interrupt an in-progress review.
  const reviewUpdateNotice = document.getElementById('reviewUpdateNotice');
  const reviewUpdateTime = document.getElementById('reviewUpdateTime');
  const reviewUpdateNow = document.getElementById('reviewUpdateNow');
  const reviewUpdateDismiss = document.getElementById('reviewUpdateDismiss');
  async function loadReviewPublishedAt() {
    const stamp = document.getElementById('reviewPublishStamp');
    const time = document.getElementById('reviewPublishTime');
    if (!stamp || !time || location.protocol === 'file:') return;
    try {
      const response = await fetch('/review/index.htm', { method:'HEAD', cache:'no-store' });
      if (!response.ok) return;
      const published = new Date(response.headers.get('Last-Modified') || '');
      if (Number.isNaN(published.getTime()) || published.getTime() > Date.now() + 300000) return;
      time.dateTime = published.toISOString();
      time.textContent = new Intl.DateTimeFormat('ms-MY', {
        day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit',
        timeZone:'Asia/Kuala_Lumpur'
      }).format(published);
      stamp.hidden = false;
    } catch (error) {
      console.debug('Tarikh publish review tidak dapat disemak.', error);
    }
  }
  loadReviewPublishedAt();
  const loadedReviewModified = Date.parse(document.lastModified) || 0;
  const loadedReviewAsset = document.querySelector('script[src*="review-app.js"]')?.getAttribute('src')?.match(/[?&]v=([^&#]+)/)?.[1] || '';
  let latestReviewUpdateKey = '';
  let reviewUpdateChecking = false;
  let reviewUpdateCheckedAt = 0;
  async function checkReviewVersion() {
    if (document.visibilityState === 'hidden' || reviewUpdateChecking || !reviewUpdateNotice.hidden) return;
    if (Date.now() - reviewUpdateCheckedAt < 15000) return;
    reviewUpdateChecking = true;
    reviewUpdateCheckedAt = Date.now();
    try {
      const response = await fetch(window.location.pathname + '?review_version_probe=' + Date.now(), { cache:'no-store' });
      if (!response.ok) return;
      const latestHtml = await response.text();
      const latestAsset = latestHtml.match(/review-app\.js\?v=([^"'\s<]+)/i)?.[1] || '';
      const latestModified = Date.parse(response.headers.get('last-modified') || '') || 0;
      const newAsset = latestAsset && loadedReviewAsset && latestAsset !== loadedReviewAsset;
      const newerHtml = latestModified && loadedReviewModified && latestModified > loadedReviewModified + 1000;
      if (!newAsset && !newerHtml) return;
      latestReviewUpdateKey = latestAsset + ':' + latestModified;
      try { if (sessionStorage.getItem('h4sx_review_update_dismissed') === latestReviewUpdateKey) return; } catch (_) {}
      reviewUpdateTime.textContent = latestModified
        ? 'Diterbitkan ' + new Intl.DateTimeFormat('ms-MY', { dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Kuala_Lumpur' }).format(latestModified)
        : 'Muat semula untuk lihat perubahan terkini.';
      reviewUpdateNotice.hidden = false;
    } catch (error) {
      console.debug('Semakan versi review akan dicuba semula.', error);
    } finally {
      reviewUpdateChecking = false;
    }
  }
  reviewUpdateNow?.addEventListener('click', hardRefreshReviewSite);
  reviewUpdateDismiss?.addEventListener('click', () => {
    reviewUpdateNotice.hidden = true;
    try { sessionStorage.setItem('h4sx_review_update_dismissed', latestReviewUpdateKey); } catch (_) {}
  });
  setTimeout(checkReviewVersion, 2500);
  setInterval(checkReviewVersion, 120000);
  window.addEventListener('focus', checkReviewVersion);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkReviewVersion();
  });


  // ── Butang scroll terus ke bahagian ulasan ──────────────────────

  // -- Review notice popup ---------------------------------
  // Popup ini tidak ikut Gist maintenance. Kalau overlay Gist aktif, popup tidak dibuka.
  const REVIEW_NOTICE_HIDE_KEY = "h4sx_review_notice_hidden_until";
  const REVIEW_NOTICE_HIDE_MS = 90 * 60 * 1000;
  let reviewNoticeTried = false;
  const reviewNoticePopup = document.getElementById("reviewNoticePopup");
  const reviewNoticeHideCheck = document.getElementById("reviewNoticeHideCheck");
  function reviewNoticeHidden() {
    try { return Date.now() < Number(localStorage.getItem(REVIEW_NOTICE_HIDE_KEY) || 0); }
    catch(e) { return false; }
  }
  function maintenanceOverlayActive() {
    return document.getElementById("shopClosedOverlay")?.classList.contains("active");
  }
  function openReviewNoticePopup() {
    return;
    if (reviewNoticeTried || !reviewNoticePopup || reviewNoticeHidden() || maintenanceOverlayActive()) return;
    reviewNoticeTried = true;
    reviewNoticePopup.classList.add("show");
    reviewNoticePopup.setAttribute("aria-hidden", "false");
  }
  function closeReviewNoticePopup(showMessage = false) {
    if (reviewNoticeHideCheck?.checked) {
      try { localStorage.setItem(REVIEW_NOTICE_HIDE_KEY, String(Date.now() + REVIEW_NOTICE_HIDE_MS)); } catch(e) {}
    }
    reviewNoticePopup?.classList.remove("show");
    reviewNoticePopup?.setAttribute("aria-hidden", "true");
    if (showMessage && reviewNoticeHideCheck?.checked) showToast("Notis disembunyikan selama 1 jam 30 minit.", "success");
  }
  document.getElementById("btnOkReviewNotice")?.addEventListener("click", () => closeReviewNoticePopup(true));
  document.getElementById("btnCloseReviewNotice")?.addEventListener("click", () => closeReviewNoticePopup(false));

  const mainReviewCard = document.querySelector(".main-card");
  const mobileReviewTabs = document.querySelectorAll("[data-mobile-review-tab]");
  const isMobileReviewLayout = () => window.matchMedia("(max-width: 859px)").matches;
  function setMobileReviewTab(tab = "form", shouldScroll = false) {
    const safeTab = tab === "reviews" ? "reviews" : "form";
    mainReviewCard?.setAttribute("data-mobile-tab", safeTab);
    mobileReviewTabs.forEach(btn => {
      const active = btn.dataset.mobileReviewTab === safeTab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (shouldScroll && isMobileReviewLayout()) {
      const target = document.querySelector(".mobile-review-tabs") || mainReviewCard;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  setMobileReviewTab("form");
  mobileReviewTabs.forEach(btn => {
    btn.addEventListener("click", () => setMobileReviewTab(btn.dataset.mobileReviewTab, true));
  });

  document.getElementById('btnScrollUlasan')?.addEventListener('click', () => {
    if (isMobileReviewLayout()) {
      setMobileReviewTab("reviews", true);
      return;
    }
    const sasaran = document.querySelector('.reviews-col-title') || document.getElementById('kotakPaparan');
    sasaran?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Admin gate ────────────────────────────────────────────────
  const ADMIN_UIDS = ["LWRN6IDv4OV1PZd7Vldgp6F9pdH3"];
  const H4SX_LOGO_URL = "https://i.imgur.com/cLPulXQ.png";
  function isOfficialAdminReview(data = {}) {
    const name = String(data.nama || "").trim();
    const legacyOfficialName = /^h4sx(?:$|[\s_-])/i.test(name);
    return ADMIN_UIDS.includes(String(data.adminAuthorUid || ""))
      && (data.adminIdentityConfirmed === true || legacyOfficialName);
  }
  let currentUser = null;
  let latestCodeSnapshot = null;
  let usedReviewCodeIds = new Set();
  let reviewCodeCleanupRunning = false;
  const adminOk = () => !!(currentUser && ADMIN_UIDS.includes(currentUser.uid));
  function mintaAdmin() {
    if (adminOk()) return true;
    bukaAdminLogin();
    return false;
  }
  
  function updateAdminUi() {
    const loggedIn = adminOk();
    document.documentElement.dataset.adminAuth = loggedIn ? 'true' : 'false';
    if (!loggedIn) document.getElementById('adminOfficialReview').checked = false;
    setTimeout(updatePreview, 0);
    if (btnLogoutAdmin) btnLogoutAdmin.style.display = loggedIn ? 'flex' : 'none';
    const adminMenuText = btnOpenAdminConfig?.querySelector('.admin-menu-text');
    if (adminMenuText) adminMenuText.textContent = loggedIn ? 'Admin' : 'Login Admin';
    document.querySelectorAll('[data-admin-ctrl-row]').forEach(row => {
      row.style.removeProperty('display');
    });
  }
  function bukaAdminLogin() {
    adminLoginOverlayBg.classList.add('show');
    adminLoginModal.classList.add('show');
    setTimeout(() => adminLoginEmail.focus(), 50);
  }
  function tutupAdminLogin() {
    adminLoginOverlayBg.classList.remove('show');
    adminLoginModal.classList.remove('show');
    adminLoginPassword.value = '';
  }
  async function logoutAdmin() {
    await window.H4SXAdminSessions?.endCurrentSession();
    await signOut(auth);
    showToast("Berjaya log keluar dari mod Admin.", "success");
  }
  window.logoutAdmin = logoutAdmin;
  document.getElementById('btnReviewAdminSessions').addEventListener('click', () => window.H4SXAdminSessions.open());

  // ── Shop Closed Status (Firebase, Gist fallback) ─────────────────────────────────
  const KEDAI_GIST_URL = 'https://gist.githubusercontent.com/amirpoyo1982-a11y/5ed3872290715d7833e788c7b0014f79/raw/kedai.json';
  function flagOn(value) {
    return value === true || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "on";
  }
  function flagOff(value) {
    return value === false || String(value).toLowerCase() === "false" || String(value).toLowerCase() === "close" || String(value).toLowerCase() === "off";
  }
  function isPreviewBypass() {
    const params = new URLSearchParams(window.location.search);
    return flagOn(params.get("preview")) || params.get("preview") === "1";
  }

  // Use the same Malaysian clock and overnight-day rules as H4SX Store.
  function parseReviewBusinessTime(value) {
    const match = String(value ?? "").trim().toLowerCase()
      .match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm|pagi|petang|malam)?$/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3];
    if (minute > 59 || hour > (period ? 12 : 23) || (period && hour === 0)) return null;
    if (period === "am" || period === "pagi") hour %= 12;
    if (period === "pm" || period === "petang" || period === "malam") hour = (hour % 12) + 12;
    return hour * 60 + minute;
  }

  function malaysiaReviewBusinessClock(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kuala_Lumpur", weekday: "long",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(now);
    const part = type => parts.find(item => item.type === type)?.value;
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return {
      minuteOfDay: Number(part("hour")) * 60 + Number(part("minute")),
      dayIndex: weekdays.indexOf(part("weekday"))
    };
  }

  function reviewAutomaticClosure(config, now = new Date()) {
    const clock = malaysiaReviewBusinessClock(now);
    const start = parseReviewBusinessTime(config?.buka_jam);
    const end = parseReviewBusinessTime(config?.tutup_jam);
    if ((config?.buka_jam || config?.tutup_jam) && (start === null || end === null)) {
      console.warn("Format waktu operasi tidak sah:", config.buka_jam, config.tutup_jam);
    }
    const fromYesterday = start !== null && end !== null && start > end && clock.minuteOfDay < end;
    const scheduleDay = (clock.dayIndex + (fromYesterday ? 6 : 0)) % 7;
    const malayDays = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
    if (Array.isArray(config?.tutup_hari) &&
        config.tutup_hari.some(day => String(day).toLowerCase() === malayDays[scheduleDay].toLowerCase())) {
      return { closed: true, reason: "Hari Tutup" };
    }
    if (start !== null && end !== null &&
        start !== end &&
        (start < end
          ? clock.minuteOfDay < start || clock.minuteOfDay >= end
          : clock.minuteOfDay >= end && clock.minuteOfDay < start)) {
      return { closed: true, reason: "Luar Waktu Operasi" };
    }
    return { closed: false, reason: "" };
  }

  function reviewBusinessHoursLabel(config = {}) {
    const start = parseReviewBusinessTime(config.buka_jam);
    const end = parseReviewBusinessTime(config.tutup_jam);
    if (start === null || end === null) return config.business_hours_text || "";
    const format = minutes => {
      const hour = Math.floor(minutes / 60);
      return (hour % 12 || 12) + ":" + String(minutes % 60).padStart(2, "0") + (hour < 12 ? " PG" : " PTG");
    };
    return (Array.isArray(config.tutup_hari) && config.tutup_hari.length ? "Waktu operasi" : "Setiap hari")
      + ": " + format(start) + " – " + format(end);
  }

  // ── Promo Banner From Kedai Gist ───────────────────────────────
  const reviewPromoShell = document.getElementById("reviewPromoShell");
  const reviewPromoViewport = document.getElementById("reviewPromoViewport");
  const reviewPromoTrack = document.getElementById("reviewPromoTrack");
  const reviewPromoDots = document.getElementById("reviewPromoDots");
  const reviewPromoPrev = document.getElementById("reviewPromoPrev");
  const reviewPromoNext = document.getElementById("reviewPromoNext");
  let reviewPromoItems = [];
  let reviewPromoIndex = 0;
  let reviewPromoTimer = null;
  let reviewPromoInterval = 5500;
  let reviewPromoDrag = null;
  let reviewPromoSuppressClickUntil = 0;
  let reviewPromoFrame = 0;

  function normalizePromoFit(value) {
    const fit = String(value || "").toLowerCase();
    return fit === "contain" || fit === "cover" ? fit : "cover";
  }

  function escapePromoAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getReviewPromoImage(item) {
    if (!item) return "";
    const isPhone = window.matchMedia("(max-width: 640px)").matches;
    return isPhone && item.mobileImg ? item.mobileImg : (item.img || item.image || "");
  }

  function stopReviewPromoAuto() {
    if (reviewPromoTimer) clearInterval(reviewPromoTimer);
    reviewPromoTimer = null;
  }

  function startReviewPromoAuto() {
    stopReviewPromoAuto();
    if (reviewPromoItems.length <= 1) return;
    reviewPromoTimer = setInterval(() => showReviewPromo(reviewPromoIndex + 1), reviewPromoInterval);
  }

  function reviewPromoOffset(slideIndex) {
    const total = reviewPromoItems.length;
    if (total <= 1) return 0;
    let offset = slideIndex - reviewPromoIndex;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;
    return offset;
  }

  function updateReviewPromoVisuals(dragProgress = 0) {
    if (!reviewPromoTrack) return;
    reviewPromoTrack.querySelectorAll(".review-promo-slide").forEach((slide, index) => {
      const position = reviewPromoOffset(index) + dragProgress;
      const distance = Math.abs(position);
      const visible = distance < 1.65;
      if (visible) {
        slide.style.setProperty("--review-promo-shift", (position * 82).toFixed(2) + "%");
        slide.style.setProperty("--review-promo-scale", Math.max(.74, 1 - Math.min(distance, 2) * .13).toFixed(3));
        slide.style.setProperty("--review-promo-opacity", Math.max(.25, 1 - distance * .28).toFixed(3));
        slide.style.zIndex = String(Math.max(1, 20 - Math.round(distance * 10)));
      }
      const active = distance < .5;
      slide.classList.toggle("is-visible", visible);
      slide.classList.toggle("active", active);
      slide.setAttribute("aria-hidden", String(!active));
      slide.tabIndex = active && slide.classList.contains("has-link") ? 0 : -1;
    });
  }

  function showReviewPromo(nextIndex) {
    if (!reviewPromoTrack || !reviewPromoItems.length) return;
    reviewPromoIndex = (nextIndex + reviewPromoItems.length) % reviewPromoItems.length;
    updateReviewPromoVisuals();
    reviewPromoDots?.querySelectorAll("button").forEach((dot, index) => {
      dot.classList.toggle("active", index === reviewPromoIndex);
      dot.setAttribute("aria-current", index === reviewPromoIndex ? "true" : "false");
    });
  }

  function renderReviewPromoBanners(config = {}) {
    if (!reviewPromoShell || !reviewPromoTrack || !reviewPromoDots) return;
    const active = flagOn(config.promo_banner_active);
    const banners = Array.isArray(config.promo_banners) ? config.promo_banners.filter(item => getReviewPromoImage(item)) : [];
    reviewPromoItems = active ? banners : [];
    reviewPromoInterval = Math.max(2500, Number(config.promo_banner_interval) || 5500);
    reviewPromoIndex = 0;
    stopReviewPromoAuto();

    if (!reviewPromoItems.length) {
      reviewPromoShell.hidden = true;
      reviewPromoTrack.innerHTML = "";
      reviewPromoDots.innerHTML = "";
      return;
    }

    reviewPromoShell.hidden = false;
    reviewPromoShell.classList.toggle("has-multiple", reviewPromoItems.length > 1);
    reviewPromoPrev.hidden = reviewPromoItems.length <= 1;
    reviewPromoNext.hidden = reviewPromoItems.length <= 1;
    reviewPromoDots.hidden = reviewPromoItems.length <= 1;
    reviewPromoTrack.innerHTML = reviewPromoItems.map((item, index) => {
      const img = getReviewPromoImage(item);
      const alt = escapePromoAttr(item.alt || item.title || "Promo H4SX Store");
      const fit = normalizePromoFit(item.fit);
      const pos = escapePromoAttr(item.position || "center center");
      const link = String(item.link || "").trim();
      const safeLink = escapePromoAttr(link);
      return `
        <a class="review-promo-slide${link ? " has-link" : ""}" data-promo-index="${index}" data-fit="${fit}" style="--promo-pos:${pos};" href="${safeLink || "#"}" aria-label="${alt}">
          <img src="${img}" alt="${alt}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" draggable="false">
        </a>
      `;
    }).join("");

    reviewPromoDots.innerHTML = reviewPromoItems.map((_, index) => (
      `<button type="button" aria-label="Banner ${index + 1}" data-promo-dot="${index}"></button>`
    )).join("");

    reviewPromoTrack.querySelectorAll(".review-promo-slide").forEach(slide => {
      slide.addEventListener("click", (event) => {
        const item = reviewPromoItems[Number(slide.dataset.promoIndex) || 0];
        if (!String(item?.link || "").trim()) event.preventDefault();
      });
    });
    reviewPromoDots.querySelectorAll("button").forEach(dot => {
      dot.addEventListener("click", () => {
        showReviewPromo(Number(dot.dataset.promoDot) || 0);
        startReviewPromoAuto();
      });
    });
    showReviewPromo(0);
    startReviewPromoAuto();
  }

  function moveReviewPromoBy(delta) {
    showReviewPromo(reviewPromoIndex + delta);
    startReviewPromoAuto();
  }

  reviewPromoPrev?.addEventListener("click", () => moveReviewPromoBy(-1));
  reviewPromoNext?.addEventListener("click", () => moveReviewPromoBy(1));
  reviewPromoViewport?.addEventListener("pointerdown", (event) => {
    if (reviewPromoItems.length <= 1 || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (event.pointerType === "mouse") event.preventDefault();
    reviewPromoDrag = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      currentX: event.clientX, width: reviewPromoViewport.getBoundingClientRect().width || 1,
      axis: "", moved: false
    };
    reviewPromoShell?.classList.add("is-dragging");
    stopReviewPromoAuto();
  });
  window.addEventListener("pointermove", (event) => {
    const drag = reviewPromoDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.axis && Math.abs(deltaX) + Math.abs(deltaY) > 8) {
      drag.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      if (drag.axis === "vertical") {
        reviewPromoDrag = null;
        reviewPromoShell?.classList.remove("is-dragging");
        startReviewPromoAuto();
        return;
      }
    }
    if (drag.axis !== "horizontal") return;
    drag.currentX = event.clientX;
    if (Math.abs(deltaX) > 4) drag.moved = true;
    if (reviewPromoFrame) return;
    reviewPromoFrame = requestAnimationFrame(() => {
      reviewPromoFrame = 0;
      if (!reviewPromoDrag) return;
      const progress = Math.max(-1, Math.min(1, (reviewPromoDrag.currentX - reviewPromoDrag.startX) / reviewPromoDrag.width));
      updateReviewPromoVisuals(progress);
    });
  });
  function endReviewPromoDrag(event) {
    const drag = reviewPromoDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (reviewPromoFrame) cancelAnimationFrame(reviewPromoFrame);
    reviewPromoFrame = 0;
    const delta = drag.currentX - drag.startX;
    if (drag.moved) reviewPromoSuppressClickUntil = Date.now() + 650;
    reviewPromoDrag = null;
    reviewPromoShell?.classList.remove("is-dragging");
    if (Math.abs(delta) > Math.max(45, drag.width * .12)) {
      showReviewPromo(reviewPromoIndex + (delta < 0 ? 1 : -1));
    } else {
      showReviewPromo(reviewPromoIndex);
    }
    startReviewPromoAuto();
  }
  window.addEventListener("pointerup", endReviewPromoDrag);
  window.addEventListener("pointercancel", endReviewPromoDrag);
  function blockReviewPromoDragClick(event) {
    if (event.target.closest(".review-promo-slide") &&
        (reviewPromoDrag?.moved || Date.now() < reviewPromoSuppressClickUntil)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }
  reviewPromoShell?.addEventListener("click", blockReviewPromoDragClick, true);
  reviewPromoShell?.addEventListener("auxclick", blockReviewPromoDragClick, true);
  reviewPromoShell?.addEventListener("dragstart", event => event.preventDefault());
  reviewPromoShell?.addEventListener("mouseenter", stopReviewPromoAuto);
  reviewPromoShell?.addEventListener("mouseleave", () => {
    if (!reviewPromoDrag) startReviewPromoAuto();
  });
  window.addEventListener("resize", () => {
    if (reviewPromoItems.length) renderReviewPromoBanners({ promo_banner_active: true, promo_banner_interval: reviewPromoInterval, promo_banners: reviewPromoItems });
  });

  let reviewClosureCopy = {};

  function paparKedaiTutup(icon, tajuk, mesej, jamTeks, typeOverride = '') {
    const fallbackTitle = tajuk;
    if (fallbackTitle === 'Dalam Penyelenggaraan') {
      tajuk = reviewClosureCopy.maintenanceTitle || tajuk;
      mesej = reviewClosureCopy.maintenanceMessage || mesej;
    } else if (['Kedai Ditutup Sementara', 'Kedai Tutup Hari Ini', 'Di Luar Waktu Operasi'].includes(fallbackTitle)) {
      tajuk = reviewClosureCopy.closedTitle || tajuk;
      mesej = reviewClosureCopy.closedMessage || mesej;
    }
    const iconEl = document.querySelector('.shop-closed-icon');
    if (iconEl) iconEl.textContent = icon;
    document.querySelector('.shop-closed-title').textContent = tajuk;
    document.getElementById('shopClosedMsg').textContent = mesej;
    const overlayEl = document.getElementById('shopClosedOverlay');
    const type = typeOverride || (/luar waktu/i.test(fallbackTitle) ? 'hours' : (/(penyelenggaraan|selenggara|maintenance|maintain|update)/i.test(fallbackTitle) ? 'maintenance' : 'closed'));
    overlayEl?.setAttribute('data-closed-type', type);
    const timeEl = document.getElementById('shopClosedTime');
    if (jamTeks) {
      timeEl.textContent = '⏱ ' + jamTeks.replace(/\s*\|\s*$/, '');
      timeEl.style.display = 'inline-block';
    } else {
      timeEl.style.display = 'none';
    }
    overlayEl?.classList.add('active');
  }

  let latestReviewStoreConfig = null;
  async function semakStatusKedai(realtimeConfig = null, refreshPromo = true) {
    try {
      let data = realtimeConfig;
      if (!data) {
        const res = await fetch(KEDAI_GIST_URL + '?t=' + Date.now(), { cache: "no-store" });
        if (!res.ok) throw new Error('Gagal baca fallback config (' + res.status + ')');
        data = await res.json();
      }
      if (data?.storeConfig && typeof data.storeConfig === "object") {
        data = { ...data.storeConfig, ...data };
      }
      if (data) latestReviewStoreConfig = data;
      const hoursText = reviewBusinessHoursLabel(data || {});
      reviewClosureCopy = {
        closedTitle: String(data?.tajuk_tutup || data?.closed_title || '').trim(),
        closedMessage: String(data?.mesej_tutup || data?.closed_message || '').trim(),
        maintenanceTitle: String(data?.tajuk_maintenance || data?.maintenance_title || '').trim(),
        maintenanceMessage: String(data?.mesej_maintenance || data?.maintenance_message || '').trim()
      };
      if (refreshPromo) renderReviewPromoBanners(data);

      // Preview bypasses the closure overlay after shared page content is loaded.
      if (isPreviewBypass()) {
        document.getElementById('shopClosedOverlay').classList.remove('active');
        return;
      }

      // 1. Maintenance khas untuk page ulasan sahaja.
      if (data && (
        flagOn(data.review_maintenance) ||
        flagOn(data.maintenance_review) ||
        flagOn(data.ulasan_maintenance) ||
        flagOn(data.reviews_maintenance)
      )) {
        paparKedaiTutup(
          '🔧',
          data.review_maintenance_title || 'Ulasan Dalam Penyelenggaraan',
          data.review_maintenance_message || data.review_maintenance_msg || 'Sistem ulasan sedang diproses dan dikemas semula. Kemungkinan besar feature ulasan akan berfungsi kembali dalam sekitar 2 hari lagi.',
          hoursText,
          'maintenance'
        );
        return;
      }

      // 2. Mod penyelenggaraan global — untuk tutup semua website kalau perlu.
      if (data && flagOn(data.maintenance)) {
        paparKedaiTutup('🛠️', 'Dalam Penyelenggaraan', 'Kedai sedang dalam penyelenggaraan buat masa ini. Sila cuba lagi sebentar lagi.', hoursText, 'maintenance');
        return;
      }

      // 3. Suis manual admin — bukakedai:false = tutup terus, tak kira jam
      if (data && flagOff(data.bukakedai)) {
        paparKedaiTutup('🚫', 'Kedai Ditutup Sementara', 'Kami sedang berehat. Sila kembali kemudian.', hoursText);
        return;
      }

      // 4–5. Hari cuti dan jadual waktu, termasuk operasi lintas tengah malam.
      const automaticClosure = reviewAutomaticClosure(data || {});
      if (automaticClosure.reason === "Hari Tutup") {
        paparKedaiTutup('📅', 'Kedai Tutup Hari Ini', 'Kami tidak beroperasi pada hari ini.', hoursText);
        return;
      }
      if (automaticClosure.closed) {
        paparKedaiTutup('🕐', 'Di Luar Waktu Operasi', 'Kami sedang tutup buat masa ini. Sila kembali semasa waktu operasi kami.', hoursText);
        return;
      }

      // Semua ok — kedai buka
      document.getElementById('shopClosedOverlay').classList.remove('active');
    } catch (e) {
      console.log('Gagal semak status kedai', e);
      if (isPreviewBypass()) document.getElementById('shopClosedOverlay').classList.remove('active');
    }
  }
  let realtimeStoreConfigConnected = false;
  onValue(realtimeRef(realtimeDb, 'store/config'), snapshot => {
    realtimeStoreConfigConnected = true;
    latestReviewStoreConfig = snapshot.exists() ? snapshot.val() : null;
    semakStatusKedai(latestReviewStoreConfig);
  }, error => {
    realtimeStoreConfigConnected = false;
    console.warn('Realtime config review gagal, guna config terakhir:', error);
    if (latestReviewStoreConfig) semakStatusKedai(latestReviewStoreConfig, false);
    else semakStatusKedai();
  });
  setTimeout(() => {
    if (!realtimeStoreConfigConnected && !latestReviewStoreConfig) semakStatusKedai();
  }, 3500);

  // Firebase sends changes to the schedule; the clock must also recheck at
  // each Malaysian minute boundary while the page stays open.
  function scheduleReviewHoursCheck() {
    const delay = 60000 - (Date.now() % 60000) + 250;
    setTimeout(() => {
      if (latestReviewStoreConfig) semakStatusKedai(latestReviewStoreConfig, false);
      else semakStatusKedai();
      scheduleReviewHoursCheck();
    }, delay);
  }
  scheduleReviewHoursCheck();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && latestReviewStoreConfig) semakStatusKedai(latestReviewStoreConfig, false);
  });

  // ── Announcement Bar (Firebase) ───────────────────────────────
  const topAnnounceEl = document.getElementById('topAnnouncement');
  const announceTextWrap = document.getElementById('announcementTextWrap');
  const announcementTitle = document.getElementById('announcementTitle');
  const announcementFullText = document.getElementById('announcementFullText');
  const announcementToggle = document.getElementById('announcementToggle');
  function renderAnnouncementText(text) {
    if (!topAnnounceEl || !announceTextWrap || !announcementTitle || !announcementFullText || !announcementToggle) return;
    const clean = (text || "").trim();
    if (!clean) {
      topAnnounceEl.classList.remove('show', 'expanded');
      return;
    }
    const parts = clean.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const title = parts.length > 1 ? parts[0] : 'Pengumuman H4SX STORE';
    const body = parts.length > 1 ? parts.slice(1).join('\n\n') : parts[0];
    announcementTitle.textContent = title;
    announceTextWrap.textContent = body.length > 140 ? body.slice(0, 140).trim() + '...' : body;
    announcementFullText.textContent = body;
    topAnnounceEl.classList.remove('expanded');
    announcementToggle.textContent = 'Baca';
    announcementToggle.style.display = body.length > 140 || parts.length > 1 ? 'inline-flex' : 'none';
    topAnnounceEl.classList.add('show');
  }
  announcementToggle?.addEventListener('click', () => {
    const expanded = topAnnounceEl.classList.toggle('expanded');
    announcementToggle.textContent = expanded ? 'Tutup' : 'Baca';
  });
  if (topAnnounceEl) {
    onSnapshot(doc(db, "config", "announcement"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        renderAnnouncementText(d.text);
      } else {
        topAnnounceEl.classList.remove('show', 'expanded');
      }
    });
  }

  // -- Custom Badge Editor (Admin) ---------------------------------
  const badgeOverlayBg       = document.getElementById('badgeOverlayBg');
  const badgePanelModal      = document.getElementById('badgePanelModal');
  const badgeTextInput       = document.getElementById('badgeTextInput');
  const badgeSizeInput = document.getElementById('badgeSizeInput');
  const badgeSizeOutput = document.getElementById('badgeSizeOutput');
  function badgeSizePercent(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.max(70, Math.min(200, number)) : 100;
  }
  document.getElementById('badgeSizeReset').addEventListener('click', () => {
    badgeSizeInput.value = '100';
    kemaskiniBadgePreview();
  });
  const badgeEmojiInput = document.getElementById('badgeEmojiInput');
  const badgeEmojiStatus = document.getElementById('badgeEmojiStatus');
  const badgeColorInput      = document.getElementById('badgeColorInput');
  const badgeColorInput2     = document.getElementById('badgeColorInput2');
  const badgeTextColorInput  = document.getElementById('badgeTextColorInput');
  const badgeGlowColorInput  = document.getElementById('badgeGlowColorInput');
  const badgeGradientToggle  = document.getElementById('badgeGradientToggle');
  const badgeAnimatedToggle  = document.getElementById('badgeAnimatedToggle');
  const badgeRainbowToggle   = document.getElementById('badgeRainbowToggle');
  const badgeLivePreview     = document.getElementById('badgeLivePreview');
  const customCheckEnabledToggle = document.getElementById('customCheckEnabledToggle');
  const customCheckColorInput = document.getElementById('customCheckColorInput');
  const customCheckTypeSelect = document.getElementById('customCheckTypeSelect');
  const customCheckGifInput = document.getElementById('customCheckGifInput');
  const customCheckGifOptions = document.getElementById('customCheckGifOptions');
  const customCheckGifStatus = document.getElementById('customCheckGifStatus');
  const customCheckLivePreview = document.getElementById('customCheckLivePreview');
  const customCheckSizeInput = document.getElementById('customCheckSizeInput');
  const customCheckSizeOutput = document.getElementById('customCheckSizeOutput');
  document.getElementById('customCheckSizeReset').addEventListener('click', () => {
    customCheckSizeInput.value = '100';
    kemaskiniBadgePreview();
  });
  const verifiedBuyerEnabledToggle = document.getElementById('verifiedBuyerEnabledToggle');
  const btnRemoveVerifiedBuyer = document.getElementById('btnRemoveVerifiedBuyer');
  const btnSaveBadge         = document.getElementById('btnSaveBadge');
  const btnApplyBadgeAll     = document.getElementById('btnApplyBadgeAll');
  const btnRemoveCustomCheck = document.getElementById('btnRemoveCustomCheck');
  const btnRemoveBadge       = document.getElementById('btnRemoveBadge');
  const btnCancelBadge       = document.getElementById('btnCancelBadge');
  let editingBadgeId = null;

  function warnaHexSah(nilai, fallback) {
    return /^#[0-9a-f]{6}$/i.test(nilai || '') ? nilai : fallback;
  }
  function badgeStyle(data = {}) {
    const c1 = warnaHexSah(data.badgeColor, '#2fa8e0');
    const c2 = warnaHexSah(data.badgeColor2, '#7c3aed');
    const text = warnaHexSah(data.badgeTextColor, '#ffffff');
    const glow = warnaHexSah(data.badgeGlowColor, c1);
    const gradient = data.badgeGradient !== false;
    const rainbow = data.badgeRainbow === true;
    const bg = rainbow
      ? 'linear-gradient(90deg,#ff3158,#ff9f1c,#ffe600,#20d67b,#19bfff,#6558ff,#d946ef,#ff3158)'
      : (gradient ? `linear-gradient(120deg, ${c1}, ${c2}, ${c1})` : c1);
    return `zoom:${badgeSizePercent(data.badgeSize) / 100}; background:${bg}; background-size:${rainbow ? '400% 100%' : '230% 230%'}; color:${text}; --badge-glow:${rainbow ? '#7c3aed' : glow}; box-shadow:0 4px 16px -8px ${rainbow ? '#7c3aed' : glow}, inset 0 1px 0 rgba(255,255,255,.26); border:none;`;
  }
  function medalStyle(data = {}) {
    const c1 = warnaHexSah(data.medalColor, '#f0a500');
    const c2 = warnaHexSah(data.medalColor2, '#e05252');
    const text = warnaHexSah(data.medalTextColor, '#ffffff');
    const glow = warnaHexSah(data.medalGlowColor, c1);
    const gradient = data.medalGradient !== false;
    const rainbow = data.medalRainbow === true;
    const outline = data.medalOutline === true;
    const bg = rainbow
      ? 'linear-gradient(90deg,#ff3158,#ff9f1c,#ffe600,#20d67b,#19bfff,#6558ff,#d946ef,#ff3158)'
      : (gradient ? `linear-gradient(120deg, ${c1}, ${c2}, ${c1})` : c1);
    const border = outline ? `1.5px solid ${rainbow ? '#7c3aed' : glow}` : '1px solid rgba(255,255,255,.48)';
    return `background:${bg}; background-size:${rainbow ? '400% 100%' : '230% 230%'}; color:${text}; --medal-glow:${rainbow ? '#7c3aed' : glow}; border:${border}; box-shadow:0 5px 18px -9px ${rainbow ? '#7c3aed' : glow}, inset 0 1px 0 rgba(255,255,255,.28);`;
  }
  function nameStyle(data = {}, isReviewAdmin = false) {
    if (data.nameColorEnabled !== true) {
      return isReviewAdmin ? 'color: var(--accent);' : '';
    }
    const c1 = warnaHexSah(data.nameColor, '#2fa8e0');
    const c2 = warnaHexSah(data.nameColor2, '#7c3aed');
    const glow = warnaHexSah(data.nameGlowColor, c1);
    const weight = ['700','800','900'].includes(String(data.nameWeight)) ? String(data.nameWeight) : '800';
    const gradient = data.nameGradient !== false;
    const rainbow = data.nameRainbow === true;
    const base = `font-weight:${weight}; text-shadow:0 2px 12px ${glow}55;`;
    if (rainbow) return `${base} color:#ff3158; background:linear-gradient(90deg,#ff3158,#ff9f1c,#ffe600,#20d67b,#19bfff,#6558ff,#d946ef,#ff3158); background-size:400% 100%; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;`;
    if (!gradient) return `${base} color:${c1};`;
    return `${base} color:${c1}; background:linear-gradient(120deg, ${c1}, ${c2}, ${c1}); background-size:230% 230%; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;`;
  }
  function nameClass(data = {}) {
    const rainbow = data.nameColorEnabled === true && data.nameRainbow === true;
    const animated = data.nameColorEnabled === true && (rainbow || (data.nameAnimated !== false && data.nameGradient !== false));
    return 'buyer-name custom-name' + (animated ? ' is-animated' : '') + (rainbow ? ' is-rainbow' : '');
  }
  function reviewEmojiCandidates(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 2048) return [];
    let url;
    try { url = new URL(raw); } catch { return []; }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return [];
    const match = url.hostname.toLowerCase().replace(/^www\./, '') === 'emoji.gg'
      ? url.pathname.match(/^\/emoji\/([a-z0-9-]+)\/?$/i) : null;
    if (match) {
      const base = 'https://cdn3.emoji.gg/emojis/' + match[1];
      return [base + '.gif', base + '.webp', base + '.png'];
    }
    return [url.href];
  }
  function reviewEmojiMarkup(value, statusId = '') {
    const urls = reviewEmojiCandidates(value);
    if (!urls.length) return '';
    const attributes = urls.slice(1).map((url, index) => `data-fallback${index + 1}="${escapeHtml(url)}"`).join(' ');
    return `<span class="review-animated-emoji"><img src="${escapeHtml(urls[0])}" ${attributes} ${statusId ? `data-preview-status="${statusId}"` : ''} alt="" loading="${statusId ? 'eager' : 'lazy'}" decoding="async"></span>`;
  }
  function reviewEmojiValue(input, label) {
    const value = input.value.trim();
    if (value && !reviewEmojiCandidates(value).length) throw new Error(label + ': gunakan pautan HTTPS yang sah.');
    return value || null;
  }
  function reviewEmojiStatus(input, status) {
    if (!status) return;
    const value = input.value.trim();
    status.textContent = !value ? 'Pautan HTTPS GIF, WebP, PNG atau halaman emoji.gg.'
      : reviewEmojiCandidates(value).length ? 'Memuatkan preview…' : 'Pautan tidak sah. Gunakan HTTPS.';
  }
  document.addEventListener('load', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.closest('.review-animated-emoji')) return;
    const status = document.getElementById(img.dataset.previewStatus || '');
    if (status) status.textContent = 'Preview berjaya dimuatkan.';
  }, true);
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.closest('.review-animated-emoji')) return;
    const next = img.dataset.fallback1 || img.dataset.fallback2;
    if (img.dataset.fallback1) { img.dataset.fallback1 = ''; img.src = next; return; }
    if (img.dataset.fallback2) { img.dataset.fallback2 = ''; img.src = next; return; }
    const container = img.closest('.review-animated-emoji');
    const check = container.closest('.custom-check.is-gif');
    container.remove();
    check?.classList.remove('is-gif');
    const status = document.getElementById(img.dataset.previewStatus || '');
    if (status) status.textContent = 'Gambar gagal dimuatkan. Cuba pautan imej terus.';
  }, true);

  function medalMarkup(data = {}) {
    const teks = (data.medalText || '').trim();
    if (!teks) return '';
    const shape = ['pill','shield','round','ticket'].includes(data.medalShape) ? data.medalShape : 'pill';
    const size = ['sm','md','lg'].includes(data.medalSize) ? data.medalSize : 'sm';
    const animated = data.medalAnimated === false && data.medalRainbow !== true ? '' : ' is-animated';
    const rainbow = data.medalRainbow === true ? ' is-rainbow' : '';
    return `<span class="medal-badge medal-${shape} medal-${size}${animated}${rainbow}" style="${medalStyle(data)}">${reviewEmojiMarkup(data.medalEmoji)}${escapeHtml(teks)}</span>`;
  }
  function customCheckMarkup(data = {}) {
    if (data.customCheckEnabled !== true) return '';
    const color = warnaHexSah(data.customCheckColor, '#0284c7');
    const gif = data.customCheckType === 'gif' && reviewEmojiCandidates(data.customCheckGif).length
      ? reviewEmojiMarkup(data.customCheckGif) : '';
    return `<span class="custom-check${gif ? ' is-gif' : ''}" style="--check-color:${color};zoom:${badgeSizePercent(data.customCheckSize) / 100}" title="Disahkan H4SX" aria-label="Disahkan H4SX"><i class="fa-solid fa-check"></i>${gif}</span>`;
  }
  function bukaBadgeModal(id, teksSedia, warnaSedia, warnaTextSedia, warnaKeduaSedia, gradientSedia, animasiSedia, glowSedia, rainbowSedia, checkSedia, checkColorSedia, verifiedDisorok, emojiSedia, checkTypeSedia, checkGifSedia, sizeSedia, checkSizeSedia) {
    editingBadgeId = id;
    badgeSizeInput.value = badgeSizePercent(sizeSedia);
    customCheckSizeInput.value = badgeSizePercent(checkSizeSedia);
    badgeEmojiInput.value = emojiSedia || '';
    badgeTextInput.value = teksSedia || '';
    badgeColorInput.value = warnaHexSah(warnaSedia, '#2fa8e0');
    badgeColorInput2.value = warnaHexSah(warnaKeduaSedia, '#7c3aed');
    badgeTextColorInput.value = warnaHexSah(warnaTextSedia, '#ffffff');
    badgeGlowColorInput.value = warnaHexSah(glowSedia, warnaHexSah(warnaSedia, '#2fa8e0'));
    badgeGradientToggle.checked = gradientSedia !== false;
    badgeAnimatedToggle.checked = animasiSedia !== false;
    badgeRainbowToggle.checked = rainbowSedia === true;
    if (customCheckEnabledToggle) customCheckEnabledToggle.checked = checkSedia === true;
    if (customCheckColorInput) customCheckColorInput.value = warnaHexSah(checkColorSedia, '#0284c7');
    customCheckTypeSelect.value = checkTypeSedia === 'gif' ? 'gif' : 'default';
    customCheckGifInput.value = checkGifSedia || '';
    if (verifiedBuyerEnabledToggle) verifiedBuyerEnabledToggle.checked = verifiedDisorok !== true;
    syncColorEditors(badgePanelModal);
    kemaskiniBadgePreview();
    badgeOverlayBg.classList.add('show');
    badgePanelModal.classList.add('show');
    badgeTextInput.focus();
  }
  function tutupBadgeModal() {
    badgeOverlayBg.classList.remove('show');
    badgePanelModal.classList.remove('show');
    editingBadgeId = null;
  }
  function kemaskiniBadgePreview() {
    badgeSizeOutput.textContent = `${badgeSizePercent(badgeSizeInput.value)}%`;
    const teks = badgeTextInput.value.trim() || 'Preview';
    badgeLivePreview.innerHTML = reviewEmojiMarkup(badgeEmojiInput.value, 'badgeEmojiStatus') + escapeHtml(teks);
    reviewEmojiStatus(badgeEmojiInput, badgeEmojiStatus);
    badgeLivePreview.className = 'verified-badge custom-badge' + (badgeAnimatedToggle.checked || badgeRainbowToggle.checked ? ' is-animated' : '') + (badgeRainbowToggle.checked ? ' is-rainbow' : '');
    badgeLivePreview.style.cssText = badgeStyle({
      badgeSize: badgeSizePercent(badgeSizeInput.value),
      badgeColor: badgeColorInput.value,
      badgeColor2: badgeColorInput2.value,
      badgeTextColor: badgeTextColorInput.value,
      badgeGlowColor: badgeGlowColorInput.value,
      badgeGradient: badgeGradientToggle.checked,
      badgeRainbow: badgeRainbowToggle.checked
    });
    const gifSelected = customCheckTypeSelect.value === 'gif';
    customCheckGifOptions.hidden = !gifSelected;
    customCheckColorInput.closest('.custom-check-color-field').hidden = gifSelected;
    const gifReady = gifSelected && reviewEmojiCandidates(customCheckGifInput.value).length > 0;
    customCheckLivePreview.innerHTML = '<i class="fa-solid fa-check"></i>' + (gifReady ? reviewEmojiMarkup(customCheckGifInput.value, 'customCheckGifStatus') : '');
    customCheckSizeOutput.textContent = `${badgeSizePercent(customCheckSizeInput.value)}%`;
    customCheckLivePreview.style.zoom = badgeSizePercent(customCheckSizeInput.value) / 100;
    customCheckLivePreview.style.setProperty('--check-color', customCheckColorInput.value || '#0284c7');
    customCheckLivePreview.classList.toggle('is-gif', gifReady);
    customCheckLivePreview.classList.toggle('is-disabled', !customCheckEnabledToggle.checked);
    if (gifSelected) reviewEmojiStatus(customCheckGifInput, customCheckGifStatus);
  }
  [customCheckSizeInput, badgeSizeInput, badgeEmojiInput, badgeTextInput, badgeColorInput2, badgeColorInput, badgeTextColorInput, badgeGlowColorInput, badgeGradientToggle, badgeAnimatedToggle, badgeRainbowToggle, customCheckEnabledToggle, customCheckColorInput, customCheckTypeSelect, customCheckGifInput]
    .filter(Boolean).forEach(el => el.addEventListener('input', kemaskiniBadgePreview));
  customCheckTypeSelect.addEventListener('change', () => {
    if (customCheckTypeSelect.value === 'gif') customCheckEnabledToggle.checked = true;
    kemaskiniBadgePreview();
  });
  badgeOverlayBg.addEventListener('click', tutupBadgeModal);
  btnCancelBadge.addEventListener('click', tutupBadgeModal);

  const blockedReviewNamePatterns = [
    /^(anjing|babi|sial|bodoh|bangang|bangsat|celaka|laknat)+$/,
    /(pukimak|kimak|puki|butoh|butuh|kontol|memek|lancau|lanjiao|cibai|jibai|pundek)/,
    /(fuck|fucker|shit|bitch|asshole|dick|pussy)/,
    /(nigger|nigga|keling)/
  ];

  function normalizeReviewNameText(value = "") {
    return String(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[@4]/g, "a")
      .replace(/[!1|]/g, "i")
      .replace(/0/g, "o")
      .replace(/3/g, "e")
      .replace(/[$5]/g, "s")
      .replace(/7/g, "t")
      .replace(/[^a-z0-9]/g, "");
  }

  function isBlockedReviewName(name = "") {
    const clean = normalizeReviewNameText(name);
    if (!clean) return false;
    return blockedReviewNamePatterns.some(pattern => pattern.test(clean));
  }

  function cleanReplyName(name = "") {
    const clean = String(name || "pelanggan").replace(/\s+/g, " ").trim();
    return clean.slice(0, 40) || "pelanggan";
  }

  function buildAutoReply(name = "") {
    const replyName = cleanReplyName(name);
    return `Terima kasih, ${replyName}! Kami hargai masa anda memberi ulasan kepada H4SX STORE. Sokongan anda membantu pelanggan lain lebih yakin, dan kami akan terus perbaiki servis supaya pengalaman anda lebih kemas, laju dan selamat. 🙏💙`;
  }

  function reviewAllowsAutoReply(data = {}) {
    return data.autoReplyDisabled !== true && data.balasanDibuang !== true && !String(data.balasanAdmin || '').trim();
  }
  async function autoReplyEnabledForNewReview(reviewRef) {
    try {
      const [settings, review] = await Promise.all([getDoc(doc(db, "config", "review_admin")), getDoc(reviewRef)]);
      return (!settings.exists() || settings.data().autoReply !== false) && reviewAllowsAutoReply(review.data() || {});
    } catch (error) {
      console.warn("Tetapan auto balas tidak dapat disemak; review tetap disimpan tanpa auto balas.", error);
      return false;
    }
  }

  function withAutoReply(payload, dataDoc = {}) {
    const next = { ...payload };
    if (reviewAdminSettings.autoReply !== false && reviewAllowsAutoReply(dataDoc)) {
      next.balasanAdmin = buildAutoReply(dataDoc.nama || payload.nama);
      next.balasanPada = serverTimestamp();
    }
    return next;
  }

  const bulkSelectOverlayBg = document.getElementById('bulkSelectOverlayBg');
  const bulkSelectModal = document.getElementById('bulkSelectModal');
  const bulkSelectTitle = document.getElementById('bulkSelectTitle');
  const bulkReviewList = document.getElementById('bulkReviewList');
  const bulkSelectedCount = document.getElementById('bulkSelectedCount');
  const btnBulkSelectAll = document.getElementById('btnBulkSelectAll');
  const btnBulkClearAll = document.getElementById('btnBulkClearAll');
  const btnBulkConfirm = document.getElementById('btnBulkConfirm');
  const btnBulkCancel = document.getElementById('btnBulkCancel');
  let bulkAction = null;

  function bulkCheckedDocs() {
    const ids = [...bulkReviewList.querySelectorAll('.bulk-review-check:checked')].map(input => input.value);
    return allDocs.filter(item => ids.includes(item.id));
  }

  function updateBulkSelectedCount() {
    const jumlah = bulkReviewList.querySelectorAll('.bulk-review-check:checked').length;
    bulkSelectedCount.textContent = `${jumlah} dipilih`;
    btnBulkConfirm.disabled = jumlah === 0;
  }

  function tutupBulkSelect() {
    bulkSelectOverlayBg.classList.remove('show');
    bulkSelectModal.classList.remove('show');
    bulkAction = null;
    bulkReviewList.innerHTML = '';
  }

  function bukaBulkSelect({ title, confirmText, danger = false, onConfirm }) {
    if (!adminOk()) { bukaAdminLogin(); return; }
    if (!allDocs.length) { showToast("Tiada ulasan untuk dipilih.", "error"); return; }
    bulkAction = { onConfirm, danger };
    bulkSelectTitle.textContent = title;
    btnBulkConfirm.textContent = confirmText || 'Teruskan';
    btnBulkConfirm.classList.toggle('bulk-confirm-danger', danger);
    bulkReviewList.innerHTML = allDocs.map(data => {
      const nama = escapeHtml(data.nama || 'Pelanggan Misteri');
      const bintang = clampBintang(data.bintang);
      const masa = reviewDateText(data);
      const badge = data.badgeText?.trim() ? `<span class="bulk-mini-badge">${reviewEmojiMarkup(data.badgeEmoji)}${escapeHtml(data.badgeText)}</span>` : '';
      return `
        <label class="bulk-review-item">
          <input class="bulk-review-check" type="checkbox" value="${escapeHtml(data.id)}">
          <span class="bulk-review-main">
            <strong>${nama}</strong>
            <small>${'★'.repeat(bintang)}${'☆'.repeat(5-bintang)} · ${escapeHtml(masa)}</small>
          </span>
          ${badge}
        </label>`;
    }).join('');
    bulkReviewList.querySelectorAll('.bulk-review-check').forEach(input => {
      input.addEventListener('change', updateBulkSelectedCount);
    });
    updateBulkSelectedCount();
    bulkSelectOverlayBg.classList.add('show');
    bulkSelectModal.classList.add('show');
  }

  async function applyPayloadPilihan(basePayload, label, closeModalFn) {
    bukaBulkSelect({
      title: `Pilih ulasan untuk ${label}`,
      confirmText: `Apply ${label}`,
      onConfirm: async (selectedDocs) => {
        const tasks = selectedDocs.map(dataDoc => updateDoc(doc(db, "ratings", dataDoc.id), withAutoReply(basePayload, dataDoc)));
        await Promise.all(tasks);
        showToast(`${label} berjaya untuk ${selectedDocs.length} ulasan.`, "success");
        closeModalFn?.();
      }
    });
  }

  async function deletePilihan() {
    bukaBulkSelect({
      title: 'Pilih ulasan untuk delete',
      confirmText: 'Delete Pilihan',
      danger: true,
      onConfirm: async (selectedDocs) => {
        if (!confirm(`Padam ${selectedDocs.length} ulasan yang dipilih? Tindakan ni tak boleh diundur.`)) return false;
        await Promise.all(selectedDocs.map(dataDoc => deleteDoc(doc(db, "ratings", dataDoc.id))));
        showToast(`${selectedDocs.length} ulasan berjaya dipadam.`, "success");
      }
    });
  }

  btnBulkSelectAll.addEventListener('click', () => {
    bulkReviewList.querySelectorAll('.bulk-review-check').forEach(input => input.checked = true);
    updateBulkSelectedCount();
  });
  btnBulkClearAll.addEventListener('click', () => {
    bulkReviewList.querySelectorAll('.bulk-review-check').forEach(input => input.checked = false);
    updateBulkSelectedCount();
  });
  btnBulkCancel.addEventListener('click', tutupBulkSelect);
  bulkSelectOverlayBg.addEventListener('click', tutupBulkSelect);
  btnBulkConfirm.addEventListener('click', async () => {
    if (!bulkAction) return;
    const selectedDocs = bulkCheckedDocs();
    if (!selectedDocs.length) { showToast("Tick sekurang-kurangnya satu ulasan.", "error"); return; }
    btnBulkConfirm.disabled = true;
    const asalText = btnBulkConfirm.textContent;
    btnBulkConfirm.textContent = bulkAction.danger ? 'Memadam...' : 'Mengemaskini...';
    try {
      const result = await bulkAction.onConfirm(selectedDocs);
      if (result === false) {
        btnBulkConfirm.disabled = false;
        btnBulkConfirm.textContent = asalText;
        updateBulkSelectedCount();
        return;
      }
      tutupBulkSelect();
    } catch (err) {
      console.error(err);
      showToast("Gagal proses pilihan. Semak Firestore rules.", "error");
      btnBulkConfirm.disabled = false;
      btnBulkConfirm.textContent = asalText;
    }
  });

  function getBadgePayloadFromInputs() {
    const teks = badgeTextInput.value.trim();
    const checkEnabled = customCheckEnabledToggle.checked;
    const checkGifMode = checkEnabled && customCheckTypeSelect.value === 'gif';
    const checkGif = checkGifMode ? reviewEmojiValue(customCheckGifInput, 'GIF centang') : null;
    if (checkGifMode && !checkGif) throw new Error('Isi URL GIF centang dahulu.');
    return {
      badgeText: teks || null,
      badgeSize: teks ? badgeSizePercent(badgeSizeInput.value) : null,
      badgeEmoji: teks ? reviewEmojiValue(badgeEmojiInput, 'Emoji role') : null,
      badgeColor: teks ? badgeColorInput.value : null,
      badgeColor2: teks ? badgeColorInput2.value : null,
      badgeTextColor: teks ? badgeTextColorInput.value : null,
      badgeGlowColor: teks ? badgeGlowColorInput.value : null,
      badgeGradient: teks ? badgeGradientToggle.checked : null,
      badgeAnimated: teks ? badgeAnimatedToggle.checked : null,
      badgeRainbow: teks ? badgeRainbowToggle.checked : null,
      customCheckEnabled: checkEnabled,
      customCheckSize: checkEnabled ? badgeSizePercent(customCheckSizeInput.value) : null,
      customCheckType: checkEnabled ? (checkGifMode ? 'gif' : 'default') : null,
      customCheckGif: checkGif,
      customCheckColor: checkEnabled && !checkGifMode ? customCheckColorInput.value || '#0284c7' : null,
      hideVerifiedBadge: verifiedBuyerEnabledToggle?.checked === false
    };
  }

  async function simpanBadgePayload(payload, mesejBerjaya, dataDoc) {
    if (!editingBadgeId) return;
    try {
      // Rules 'update' wajibkan balasanAdmin sentiasa string sah - isi auto-reply
      // dulu kalau ulasan ni belum pernah dapat balasan.
      await updateDoc(doc(db,"ratings",editingBadgeId), withAutoReply(payload, dataDoc));
      showToast(mesejBerjaya, "success");
      tutupBadgeModal();
    } catch(err) {
      console.error(err);
      showToast(`Firebase gagal simpan: ${err?.code || err?.message || "ralat tidak diketahui"}`, "error");
    }
  }
  btnSaveBadge.addEventListener('click', () => {
    let payload;
    try { payload = getBadgePayloadFromInputs(); } catch (err) { showToast(err.message, 'error'); return; }
    const dataDoc = allDocs.find(d=>d.id===editingBadgeId) || {};
    simpanBadgePayload(payload, "Role dan centang berjaya disimpan!", dataDoc);
  });
  btnApplyBadgeAll.addEventListener('click', () => {
    let payload;
    try { payload = getBadgePayloadFromInputs(); } catch (err) { showToast(err.message, 'error'); return; }
    applyPayloadPilihan(payload, "Role & Centang", tutupBadgeModal);
  });
  btnRemoveVerifiedBuyer?.addEventListener('click', () => {
    const dataDoc = allDocs.find(d=>d.id===editingBadgeId) || {};
    simpanBadgePayload({ hideVerifiedBadge:true }, "Verified Buyer dibuang untuk review ini.", dataDoc);
  });
  btnRemoveCustomCheck?.addEventListener('click', () => {
    const dataDoc = allDocs.find(d=>d.id===editingBadgeId) || {};
    simpanBadgePayload({ customCheckEnabled:false, customCheckSize:null, customCheckType:null, customCheckGif:null, customCheckColor:null }, "Centang custom dibuang.", dataDoc);
  });
  btnRemoveBadge.addEventListener('click', () => {
    const dataDoc = allDocs.find(d=>d.id===editingBadgeId) || {};
    simpanBadgePayload({
      badgeText: null,
      badgeSize: null,
      badgeEmoji: null,
      badgeColor: null,
      badgeColor2: null,
      badgeTextColor: null,
      badgeGlowColor: null,
      badgeGradient: null,
      badgeAnimated: null,
      badgeRainbow: null
    }, "Badge dibuang, kembali ke default.", dataDoc);
  });

  // -- Customer Profile Editor (Admin) ----------------------------
  const customerOverlayBg = document.getElementById('customerOverlayBg');
  const customerPanelModal = document.getElementById('customerPanelModal');
  const customerNameInput = document.getElementById('customerNameInput');
  const customerShowRatingToggle = document.getElementById('customerShowRatingToggle');
  const nameEmojiInput = document.getElementById('nameEmojiInput');
  const nameEmojiStatus = document.getElementById('nameEmojiStatus');
  const medalEmojiInput = document.getElementById('medalEmojiInput');
  const medalEmojiStatus = document.getElementById('medalEmojiStatus');
  const customerColorInput = document.getElementById('customerColorInput');
  const customerEmojiInput = document.getElementById('customerEmojiInput');
  const customerAvatarPreview = document.getElementById('customerAvatarPreview');
  const customerAvatarText = document.getElementById('customerAvatarText');
  const customerNamePreview = document.getElementById('customerNamePreview');
  const nameColorEnabledToggle = document.getElementById('nameColorEnabledToggle');
  const nameColorInput = document.getElementById('nameColorInput');
  const nameColor2Input = document.getElementById('nameColor2Input');
  const nameGlowColorInput = document.getElementById('nameGlowColorInput');
  const nameGradientToggle = document.getElementById('nameGradientToggle');
  const nameAnimatedToggle = document.getElementById('nameAnimatedToggle');
  const nameRainbowToggle = document.getElementById('nameRainbowToggle');
  const nameWeightSelect = document.getElementById('nameWeightSelect');
  const customerMedalPreview = document.getElementById('customerMedalPreview');
  const medalLivePreview = document.getElementById('medalLivePreview');
  const medalTextInput = document.getElementById('medalTextInput');
  const medalColorInput = document.getElementById('medalColorInput');
  const medalColor2Input = document.getElementById('medalColor2Input');
  const medalTextColorInput = document.getElementById('medalTextColorInput');
  const medalGlowColorInput = document.getElementById('medalGlowColorInput');
  const medalShapeSelect = document.getElementById('medalShapeSelect');
  const medalSizeSelect = document.getElementById('medalSizeSelect');
  const medalGradientToggle = document.getElementById('medalGradientToggle');
  const medalAnimatedToggle = document.getElementById('medalAnimatedToggle');
  const medalOutlineToggle = document.getElementById('medalOutlineToggle');
  const medalRainbowToggle = document.getElementById('medalRainbowToggle');
  const reviewCollapseToggle = document.getElementById('reviewCollapseToggle');
  const reviewCollapseDefaultOpenToggle = document.getElementById('reviewCollapseDefaultOpenToggle');
  const reviewCollapseLinesSelect = document.getElementById('reviewCollapseLinesSelect');
  const reviewToggleColorInput = document.getElementById('reviewToggleColorInput');
  const reviewExpandLabelInput = document.getElementById('reviewExpandLabelInput');
  const reviewCollapseLabelInput = document.getElementById('reviewCollapseLabelInput');
  const btnSuggestCustomerProfile = document.getElementById('btnSuggestCustomerProfile');
  const btnRemoveCustomerImage = document.getElementById('btnRemoveCustomerImage');
  const btnSaveCustomer = document.getElementById('btnSaveCustomer');
  const btnApplyNameAll = document.getElementById('btnApplyNameAll');
  const btnApplyMedalAll = document.getElementById('btnApplyMedalAll');
  const btnRemoveNameColor = document.getElementById('btnRemoveNameColor');
  const btnRemoveMedal = document.getElementById('btnRemoveMedal');
  const btnCancelCustomer = document.getElementById('btnCancelCustomer');
  const profileSuggestions = [
    { warna:'#2fa8e0', emoji:'H' }, { warna:'#22c47a', emoji:'V' },
    { warna:'#7c3aed', emoji:'S' }, { warna:'#f0a500', emoji:'P' },
    { warna:'#ef5da8', emoji:'A' }, { warna:'#14b8a6', emoji:'Z' },
    { warna:'#0f2a45', emoji:'X' }, { warna:'#e05252', emoji:'M' }
  ];
  const medalPresets = {
    staff: { text:'STAFF', c1:'#2fa8e0', c2:'#22c47a', textColor:'#ffffff', glow:'#2fa8e0', shape:'pill', size:'sm', gradient:true, animated:true, outline:false },
    vip: { text:'VIP', c1:'#7c3aed', c2:'#ef5da8', textColor:'#ffffff', glow:'#7c3aed', shape:'shield', size:'md', gradient:true, animated:true, outline:false },
    top: { text:'#1', c1:'#f0a500', c2:'#e05252', textColor:'#ffffff', glow:'#f0a500', shape:'round', size:'md', gradient:true, animated:true, outline:false },
    og: { text:'OLD', c1:'#0f2a45', c2:'#2fa8e0', textColor:'#ffffff', glow:'#2fa8e0', shape:'ticket', size:'sm', gradient:true, animated:false, outline:true },
    trusted: { text:'TRUSTED', c1:'#22c47a', c2:'#14b8a6', textColor:'#ffffff', glow:'#22c47a', shape:'pill', size:'md', gradient:true, animated:true, outline:false },
    buyer: { text:'BUYER', c1:'#38bdf8', c2:'#2563eb', textColor:'#ffffff', glow:'#38bdf8', shape:'pill', size:'sm', gradient:true, animated:true, outline:false },
    legend: { text:'LEGEND', c1:'#f59e0b', c2:'#7c2d12', textColor:'#fff7ed', glow:'#f59e0b', shape:'shield', size:'lg', gradient:true, animated:true, outline:false },
    fast: { text:'FAST', c1:'#f97316', c2:'#ef4444', textColor:'#ffffff', glow:'#fb923c', shape:'ticket', size:'sm', gradient:true, animated:true, outline:false },
    safe: { text:'SAFE', c1:'#10b981', c2:'#0f766e', textColor:'#ffffff', glow:'#34d399', shape:'shield', size:'sm', gradient:true, animated:false, outline:true },
    rare: { text:'RARE', c1:'#ec4899', c2:'#8b5cf6', textColor:'#ffffff', glow:'#ec4899', shape:'round', size:'md', gradient:true, animated:true, outline:false },
    pro: { text:'PRO', c1:'#111827', c2:'#475569', textColor:'#ffffff', glow:'#64748b', shape:'pill', size:'sm', gradient:true, animated:false, outline:true },
    local: { text:'LOCAL', c1:'#06b6d4', c2:'#22c55e', textColor:'#ffffff', glow:'#06b6d4', shape:'ticket', size:'md', gradient:true, animated:true, outline:false },
    king: { text:'KING', c1:'#eab308', c2:'#ca8a04', textColor:'#ffffff', glow:'#facc15', shape:'shield', size:'md', gradient:true, animated:true, outline:true },
    new: { text:'NEW', c1:'#3b82f6', c2:'#60a5fa', textColor:'#ffffff', glow:'#60a5fa', shape:'round', size:'sm', gradient:true, animated:true, outline:false },
    oldsupport: { text:'OLD SUPPORT', c1:'#0f2a45', c2:'#f0a500', textColor:'#ffffff', glow:'#f0a500', shape:'ticket', size:'lg', gradient:true, animated:false, outline:true }
  };
  let editingCustomerId = null;
  let removeCustomerImage = false;
  const customerImageUrl = document.getElementById('customerImageUrl');
  const btnPreviewCustomerImage = document.getElementById('btnPreviewCustomerImage');
  let originalCustomerImage = null;
  let customerImageChanged = false;

  function customerImageLink() {
    const value = customerImageUrl.value.trim();
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch (_) {}
    throw new Error('Letak link gambar HTTPS yang sah.');
  }

  function previewCustomerImage(src) {
    customerAvatarPreview.querySelector('img')?.remove();
    customerAvatarPreview.classList.toggle('has-profile-image', Boolean(src));
    customerAvatarText.style.display = '';
    if (!src) return;
    const img = new Image();
    img.alt = 'Gambar profil pelanggan';
    img.className = 'av-img';
    img.referrerPolicy = 'no-referrer';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:inherit';
    img.onload = () => { if (img.parentNode) customerAvatarText.style.display = 'none'; };
    img.onerror = () => {
      if (!img.parentNode) return;
      img.remove();
      customerAvatarPreview.classList.remove('has-profile-image');
      customerAvatarText.style.display = '';
      showToast('Gambar tidak dapat dimuatkan. Semak link terus ke gambar.', 'error');
    };
    customerAvatarPreview.appendChild(img);
    img.src = src;
  }
  customerImageUrl.addEventListener('input', () => {
    customerImageChanged = true;
    removeCustomerImage = !customerImageUrl.value.trim();
    btnRemoveCustomerImage.disabled = false;
    btnRemoveCustomerImage.textContent = 'Buang Gambar Profil';
    previewCustomerImage(null);
  });
  btnPreviewCustomerImage.addEventListener('click', () => {
    try { previewCustomerImage(customerImageLink()); }
    catch (err) { showToast(err.message, 'error'); }
  });

  function kemaskiniCustomerPreview() {
    const nama = customerNameInput.value.trim() || 'Pelanggan';
    const warna = warnaHexSah(customerColorInput.value, warnaAuto(nama));
    const avatar = (customerEmojiInput.value.trim() || nama.charAt(0) || 'H').slice(0, 4).toUpperCase();
    const medalText = medalTextInput.value.trim();
    const medalPreviewText = medalText || 'Preview';
    const medalClass = `medal-badge medal-${medalShapeSelect.value} medal-${medalSizeSelect.value}${medalAnimatedToggle.checked || medalRainbowToggle.checked ? ' is-animated' : ''}${medalRainbowToggle.checked ? ' is-rainbow' : ''}`;
    const medalCss = medalStyle({
      medalColor: medalColorInput.value,
      medalColor2: medalColor2Input.value,
      medalTextColor: medalTextColorInput.value,
      medalGlowColor: medalGlowColorInput.value,
      medalGradient: medalGradientToggle.checked,
      medalRainbow: medalRainbowToggle.checked,
      medalOutline: medalOutlineToggle.checked
    });
    customerAvatarPreview.style.background = warna;
    customerAvatarText.textContent = avatar;
    customerNamePreview.innerHTML = reviewEmojiMarkup(nameEmojiInput.value, 'nameEmojiStatus') + escapeHtml(nama);
    reviewEmojiStatus(nameEmojiInput, nameEmojiStatus);
    customerNamePreview.className = nameClass({
      nameColorEnabled: nameColorEnabledToggle.checked,
      nameAnimated: nameAnimatedToggle.checked,
      nameGradient: nameGradientToggle.checked,
      nameRainbow: nameRainbowToggle.checked
    });
    customerNamePreview.style.cssText = nameStyle({
      nameColorEnabled: nameColorEnabledToggle.checked,
      nameColor: nameColorInput.value,
      nameColor2: nameColor2Input.value,
      nameGlowColor: nameGlowColorInput.value,
      nameGradient: nameGradientToggle.checked,
      nameAnimated: nameAnimatedToggle.checked,
      nameRainbow: nameRainbowToggle.checked,
      nameWeight: nameWeightSelect.value
    });
    customerMedalPreview.innerHTML = reviewEmojiMarkup(medalEmojiInput.value, 'medalEmojiStatus') + escapeHtml(medalPreviewText);
    reviewEmojiStatus(medalEmojiInput, medalEmojiStatus);
    customerMedalPreview.className = medalClass;
    customerMedalPreview.style.cssText = medalCss;
    customerMedalPreview.style.display = medalText ? 'inline-flex' : 'none';
    medalLivePreview.innerHTML = reviewEmojiMarkup(medalEmojiInput.value, 'medalEmojiStatus') + escapeHtml(medalPreviewText);
    medalLivePreview.className = medalClass;
    medalLivePreview.style.cssText = medalCss;
  }

  function parseImportedColor(raw) {
    const value = String(raw || '').replace(/&#(?:x[0-9a-f]+|\d+);/gi, ' ').trim();
    const hex = value.match(/#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/i)
      || value.match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
    if (hex) {
      const digits = hex[1].toLowerCase();
      return '#' + (digits.length === 3 ? [...digits].map(char => char + char).join('') : digits);
    }
    const rgb = value.match(/rgb\s*\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*\)/i);
    const channels = rgb ? rgb.slice(1) : value.match(/\d+/g);
    if (!channels || channels.length !== 3 || channels.some(channel => Number(channel) > 255)) return null;
    return '#' + channels.map(channel => Number(channel).toString(16).padStart(2, '0')).join('');
  }
  function formatImportedRgb(hex) {
    return 'RGB(' + [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(', ') + ')';
  }
  function syncColorField(picker) {
    const editor = picker.colorCodeEditor;
    if (!editor) return;
    const hex = picker.value.toUpperCase();
    editor.input.value = hex;
    editor.detail.textContent = hex + ' · ' + formatImportedRgb(hex);
    editor.root.classList.remove('is-error');
  }
  function syncColorEditors(panel) {
    panel.querySelectorAll('input[type="color"]').forEach(syncColorField);
  }
  function setupColorEditors(panel) {
    panel.querySelectorAll('input[type="color"]').forEach(picker => {
      const field = picker.closest('.badge-color-field');
      if (!field || picker.colorCodeEditor) return;
      const editor = document.createElement('div');
      editor.className = 'color-code-controls';
      editor.innerHTML = '<input type="text" maxlength="240" placeholder="Paste RGB / HEX"><button type="button" title="Salin kod HEX">Salin</button><small aria-live="polite"></small>';
      const label = field.matches('label') ? field.textContent.trim() : field.querySelector('label')?.textContent.trim() || 'warna';
      const input = editor.querySelector('input');
      const detail = editor.querySelector('small');
      input.setAttribute('aria-label', 'Paste RGB atau HEX untuk ' + label);
      if (field.matches('label')) field.insertAdjacentElement('afterend', editor);
      else { field.classList.add('has-color-code'); field.appendChild(editor); }
      picker.colorCodeEditor = { root:editor, input, detail };
      const importOne = raw => {
        const hex = parseImportedColor(raw);
        if (!hex) {
          editor.classList.add('is-error');
          detail.textContent = 'Format salah. Paste HEX atau RGB seperti 217 101 112.';
          return;
        }
        picker.value = hex;
        picker.dispatchEvent(new Event('input', { bubbles:true }));
        picker.dispatchEvent(new Event('change', { bubbles:true }));
        syncColorField(picker);
      };
      input.addEventListener('paste', event => {
        const pasted = event.clipboardData?.getData('text');
        if (!pasted) return;
        event.preventDefault();
        importOne(pasted);
      });
      input.addEventListener('change', () => importOne(input.value));
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        importOne(input.value);
      });
      picker.addEventListener('input', () => syncColorField(picker));
      picker.addEventListener('change', () => syncColorField(picker));
      editor.querySelector('button').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(picker.value.toUpperCase());
          detail.textContent = picker.value.toUpperCase() + ' disalin.';
        } catch (error) {
          input.select();
          detail.textContent = 'Pilih kod HEX dan salin secara manual.';
        }
      });
      syncColorField(picker);
    });
  }
  setupColorEditors(badgePanelModal);
  setupColorEditors(customerPanelModal);

  function bukaCustomerModal(id, data = {}) {
    const nama = data.nama || 'Pelanggan';
    editingCustomerId = id;
    removeCustomerImage = false;
    customerNameInput.value = nama;
    customerShowRatingToggle.checked = data.hideRating !== true;
    nameEmojiInput.value = data.nameEmoji || '';
    medalEmojiInput.value = data.medalEmoji || '';
    originalCustomerImage = data.profileImg || null;
    customerImageChanged = false;
    customerImageUrl.value = /^https:\/\//i.test(originalCustomerImage || '') ? originalCustomerImage : '';
    previewCustomerImage(originalCustomerImage);
    customerColorInput.value = warnaHexSah(data.warnaProfil, warnaAuto(nama));
    customerEmojiInput.value = data.emojiProfil || nama.charAt(0).toUpperCase();
    nameColorEnabledToggle.checked = data.nameColorEnabled === true;
    nameColorInput.value = warnaHexSah(data.nameColor, '#2fa8e0');
    nameColor2Input.value = warnaHexSah(data.nameColor2, '#7c3aed');
    nameGlowColorInput.value = warnaHexSah(data.nameGlowColor, warnaHexSah(data.nameColor, '#2fa8e0'));
    nameGradientToggle.checked = data.nameGradient !== false;
    nameAnimatedToggle.checked = data.nameAnimated !== false;
    nameRainbowToggle.checked = data.nameRainbow === true;
    nameWeightSelect.value = ['700','800','900'].includes(String(data.nameWeight)) ? String(data.nameWeight) : '800';
    medalTextInput.value = data.medalText || '';
    medalColorInput.value = warnaHexSah(data.medalColor, '#f0a500');
    medalColor2Input.value = warnaHexSah(data.medalColor2, '#e05252');
    medalTextColorInput.value = warnaHexSah(data.medalTextColor, '#ffffff');
    medalGlowColorInput.value = warnaHexSah(data.medalGlowColor, warnaHexSah(data.medalColor, '#f0a500'));
    medalShapeSelect.value = ['pill','shield','round','ticket'].includes(data.medalShape) ? data.medalShape : 'pill';
    medalSizeSelect.value = ['sm','md','lg'].includes(data.medalSize) ? data.medalSize : 'sm';
    medalGradientToggle.checked = data.medalGradient !== false;
    medalAnimatedToggle.checked = data.medalAnimated !== false;
    medalOutlineToggle.checked = data.medalOutline === true;
    medalRainbowToggle.checked = data.medalRainbow === true;
    reviewCollapseToggle.checked = data.reviewTextCollapsed === true;
    reviewCollapseDefaultOpenToggle.checked = data.reviewTextDefaultOpen === true;
    reviewCollapseLinesSelect.value = String(Math.min(6, Math.max(2, parseInt(data.reviewTextLines) || 4)));
    reviewToggleColorInput.value = warnaHexSah(data.reviewToggleColor, '#2fa8e0');
    reviewExpandLabelInput.value = data.reviewExpandLabel || 'Lihat lagi ↓';
    reviewCollapseLabelInput.value = data.reviewCollapseLabel || 'Tutup ↑';
    btnRemoveCustomerImage.disabled = !data.profileImg;
    btnRemoveCustomerImage.textContent = data.profileImg ? 'Buang Gambar Profil' : 'Tiada Gambar Profil';
    syncColorEditors(customerPanelModal);
    kemaskiniCustomerPreview();
    customerOverlayBg.classList.add('show');
    customerPanelModal.classList.add('show');
    setTimeout(() => customerNameInput.focus(), 50);
  }

  function tutupCustomerModal() {
    customerOverlayBg.classList.remove('show');
    customerPanelModal.classList.remove('show');
    editingCustomerId = null;
    removeCustomerImage = false;
  }

  async function simpanCustomerPayload(payload, mesejBerjaya, dataDoc) {
    if (!editingCustomerId) return;
    try {
      await updateDoc(doc(db, "ratings", editingCustomerId), withAutoReply(payload, dataDoc));
      showToast(mesejBerjaya, "success");
      tutupCustomerModal();
    } catch (err) {
      console.error(err);
      showToast("Gagal kemaskini pelanggan.", "error");
    }
  }

  [customerNameInput, nameEmojiInput, medalEmojiInput, customerColorInput, customerEmojiInput, nameColorEnabledToggle, nameColorInput, nameColor2Input, nameGlowColorInput, nameGradientToggle, nameAnimatedToggle, nameRainbowToggle, nameWeightSelect, medalTextInput, medalColorInput, medalColor2Input, medalTextColorInput, medalGlowColorInput, medalShapeSelect, medalSizeSelect, medalGradientToggle, medalAnimatedToggle, medalOutlineToggle, medalRainbowToggle]
    .forEach(el => {
      el.addEventListener('input', kemaskiniCustomerPreview);
      el.addEventListener('change', kemaskiniCustomerPreview);
    });
  document.querySelectorAll('[data-medal-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = medalPresets[btn.dataset.medalPreset];
      if (!preset) return;
      medalTextInput.value = preset.text;
      medalColorInput.value = preset.c1;
      medalColor2Input.value = preset.c2;
      medalTextColorInput.value = preset.textColor;
      medalGlowColorInput.value = preset.glow;
      medalShapeSelect.value = preset.shape;
      medalSizeSelect.value = preset.size;
      medalGradientToggle.checked = preset.gradient;
      medalAnimatedToggle.checked = preset.animated;
      medalOutlineToggle.checked = preset.outline;
      medalRainbowToggle.checked = false;
      kemaskiniCustomerPreview();
    });
  });
  customerOverlayBg.addEventListener('click', tutupCustomerModal);
  btnCancelCustomer.addEventListener('click', tutupCustomerModal);
  btnSuggestCustomerProfile.addEventListener('click', () => {
    const nama = customerNameInput.value.trim() || 'Pelanggan';
    const pilihan = profileSuggestions[Math.floor(Math.random() * profileSuggestions.length)];
    customerColorInput.value = pilihan.warna;
    customerEmojiInput.value = nama.charAt(0).toUpperCase() || pilihan.emoji;
    removeCustomerImage = true;
    customerImageUrl.value = '';
    customerImageChanged = true;
    previewCustomerImage(null);
    btnRemoveCustomerImage.disabled = false;
    btnRemoveCustomerImage.textContent = 'Gambar akan dibuang';
    kemaskiniCustomerPreview();
  });
  btnRemoveCustomerImage.addEventListener('click', () => {
    removeCustomerImage = true;
    customerImageUrl.value = '';
    customerImageChanged = true;
    previewCustomerImage(null);
    btnRemoveCustomerImage.disabled = false;
    btnRemoveCustomerImage.textContent = 'Gambar akan dibuang';
    kemaskiniCustomerPreview();
  });
  btnSaveCustomer.addEventListener('click', () => {
    const nama = customerNameInput.value.trim();
    if (nama.length < 1 || nama.length > 40) {
      showToast("Nama pelanggan mesti 1 hingga 40 aksara.", "error");
      return;
    }
    const emoji = customerEmojiInput.value.trim();
    const medal = medalTextInput.value.trim();
    let nameEmoji, medalEmoji;
    try { nameEmoji = reviewEmojiValue(nameEmojiInput, 'Emoji nama'); medalEmoji = reviewEmojiValue(medalEmojiInput, 'Emoji pingat'); }
    catch (err) { showToast(err.message, 'error'); return; }
    const dataDoc = allDocs.find(d => d.id === editingCustomerId) || {};
    const payload = {
      nama,
      nameEmoji,
      hideRating: !customerShowRatingToggle.checked,
      warnaProfil: customerColorInput.value,
      emojiProfil: emoji || null,
      nameColorEnabled: nameColorEnabledToggle.checked,
      nameColor: nameColorEnabledToggle.checked ? nameColorInput.value : null,
      nameColor2: nameColorEnabledToggle.checked ? nameColor2Input.value : null,
      nameGlowColor: nameColorEnabledToggle.checked ? nameGlowColorInput.value : null,
      nameGradient: nameColorEnabledToggle.checked ? nameGradientToggle.checked : null,
      nameAnimated: nameColorEnabledToggle.checked ? nameAnimatedToggle.checked : null,
      nameRainbow: nameColorEnabledToggle.checked ? nameRainbowToggle.checked : null,
      nameWeight: nameColorEnabledToggle.checked ? nameWeightSelect.value : null,
      medalText: medal || null,
      medalEmoji: medal ? medalEmoji : null,
      medalColor: medal ? medalColorInput.value : null,
      medalColor2: medal ? medalColor2Input.value : null,
      medalTextColor: medal ? medalTextColorInput.value : null,
      medalGlowColor: medal ? medalGlowColorInput.value : null,
      medalShape: medal ? medalShapeSelect.value : null,
      medalSize: medal ? medalSizeSelect.value : null,
      medalGradient: medal ? medalGradientToggle.checked : null,
      medalAnimated: medal ? medalAnimatedToggle.checked : null,
      medalOutline: medal ? medalOutlineToggle.checked : null,
      medalRainbow: medal ? medalRainbowToggle.checked : null,
      reviewTextCollapsed: reviewCollapseToggle.checked,
      reviewTextDefaultOpen: reviewCollapseDefaultOpenToggle.checked,
      reviewTextLines: parseInt(reviewCollapseLinesSelect.value) || 4,
      reviewToggleColor: reviewToggleColorInput.value,
      reviewExpandLabel: reviewExpandLabelInput.value.trim() || 'Lihat lagi ↓',
      reviewCollapseLabel: reviewCollapseLabelInput.value.trim() || 'Tutup ↑'
    };
    if (removeCustomerImage) payload.profileImg = null;
    else if (customerImageChanged) {
      try { payload.profileImg = customerImageLink(); }
      catch (err) { showToast(err.message, 'error'); customerImageUrl.focus(); return; }
    }
    simpanCustomerPayload(payload, "Profil pelanggan berjaya dikemaskini.", dataDoc);
  });
  function getNamePayloadFromInputs() {
    const nameEmoji = reviewEmojiValue(nameEmojiInput, 'Emoji nama');
    if (!nameColorEnabledToggle.checked && !nameEmoji) return null;
    return {
      nameEmoji,
      nameColorEnabled: nameColorEnabledToggle.checked,
      nameColor: nameColorEnabledToggle.checked ? nameColorInput.value : null,
      nameColor2: nameColorEnabledToggle.checked ? nameColor2Input.value : null,
      nameGlowColor: nameColorEnabledToggle.checked ? nameGlowColorInput.value : null,
      nameGradient: nameColorEnabledToggle.checked ? nameGradientToggle.checked : null,
      nameAnimated: nameColorEnabledToggle.checked ? nameAnimatedToggle.checked : null,
      nameRainbow: nameColorEnabledToggle.checked ? nameRainbowToggle.checked : null,
      nameWeight: nameColorEnabledToggle.checked ? nameWeightSelect.value : null
    };
  }
  btnApplyNameAll.addEventListener('click', () => {
    let payload;
    try { payload = getNamePayloadFromInputs(); } catch (err) { showToast(err.message, 'error'); return; }
    if (!payload) { showToast('Aktifkan warna nama atau isi URL emoji dulu.', 'error'); return; }
    applyPayloadPilihan(payload, 'Nama pelanggan', tutupCustomerModal);
  });
  btnRemoveNameColor.addEventListener('click', () => {
    const dataDoc = allDocs.find(d => d.id === editingCustomerId) || {};
    simpanCustomerPayload({
      nameColorEnabled: false,
      nameColor: null,
      nameColor2: null,
      nameGlowColor: null,
      nameGradient: null,
      nameAnimated: null,
      nameRainbow: null,
      nameWeight: null
    }, "Warna nama dibuang.", dataDoc);
  });
  function getMedalPayloadFromInputs() {
    const medal = medalTextInput.value.trim();
    if (!medal) return null;
    return {
      medalText: medal,
      medalEmoji: reviewEmojiValue(medalEmojiInput, 'Emoji pingat'),
      medalColor: medalColorInput.value,
      medalColor2: medalColor2Input.value,
      medalTextColor: medalTextColorInput.value,
      medalGlowColor: medalGlowColorInput.value,
      medalShape: medalShapeSelect.value,
      medalSize: medalSizeSelect.value,
      medalGradient: medalGradientToggle.checked,
      medalAnimated: medalAnimatedToggle.checked,
      medalOutline: medalOutlineToggle.checked,
      medalRainbow: medalRainbowToggle.checked
    };
  }
  btnApplyMedalAll.addEventListener('click', () => {
    let payload;
    try { payload = getMedalPayloadFromInputs(); } catch (err) { showToast(err.message, 'error'); return; }
    if (!payload) { showToast("Taip teks pingat dulu sebelum apply semua.", "error"); return; }
    applyPayloadPilihan(payload, "Pingat", tutupCustomerModal);
  });
  btnRemoveMedal.addEventListener('click', () => {
    const dataDoc = allDocs.find(d => d.id === editingCustomerId) || {};
    simpanCustomerPayload({
      medalText: null,
      medalEmoji: null,
      medalColor: null,
      medalColor2: null,
      medalTextColor: null,
      medalGlowColor: null,
      medalShape: null,
      medalSize: null,
      medalGradient: null,
      medalAnimated: null,
      medalOutline: null,
      medalRainbow: null
    }, "Pingat pelanggan dibuang.", dataDoc);
  });

  // -- Custom vote khusus website review --------------------------
  const REVIEW_VOTE_CONFIG_ID = 'review_custom_vote';
  const REVIEW_VOTE_ENTRIES = 'review_vote_entries';
  const REVIEW_VOTE_DEVICE_KEY = 'h4sx_review_vote_device';
  const REVIEW_VOTE_CHOICE_PREFIX = 'h4sx_review_vote_choice_';
  let reviewVoteConfig = null;
  let reviewVoteEntries = [];
  let reviewVoteConfigUnsubscribe = null;
  let reviewVoteEntriesUnsubscribe = null;
  let reviewVoteEndTimer = null;
  let reviewVoteDirectLinkHandled = false;
  const reviewVoteSection = document.getElementById('reviewVoteSection');
  const reviewVoteStatus = document.getElementById('reviewVoteStatus');
  const reviewVoteTitle = document.getElementById('reviewVoteTitle');
  const reviewVoteDescription = document.getElementById('reviewVoteDescription');
  const reviewVoteTotal = document.getElementById('reviewVoteTotal');
  const reviewVoteOptions = document.getElementById('reviewVoteOptions');
  const reviewVoteNote = document.getElementById('reviewVoteNote');
  const reviewVoteActive = document.getElementById('reviewVoteActive');
  const reviewVoteTitleInput = document.getElementById('reviewVoteTitleInput');
  const reviewVoteDescriptionInput = document.getElementById('reviewVoteDescriptionInput');
  const reviewVoteOptionsInput = document.getElementById('reviewVoteOptionsInput');
  const reviewVoteEndAtInput = document.getElementById('reviewVoteEndAtInput');
  const reviewVoteAdminStatus = document.getElementById('reviewVoteAdminStatus');
  const btnSaveReviewVote = document.getElementById('btnSaveReviewVote');
  const btnNewReviewVote = document.getElementById('btnNewReviewVote');
  const btnCopyReviewVoteLink = document.getElementById('btnCopyReviewVoteLink');

  function reviewVoteEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
  }
  function reviewVoteNewId() {
    const values = crypto.getRandomValues(new Uint32Array(2));
    return 'review_vote_' + Date.now().toString(36) + '_' + values[0].toString(36) + values[1].toString(36).slice(0, 5);
  }
  function reviewVoteDeviceId() {
    let id = localStorage.getItem(REVIEW_VOTE_DEVICE_KEY);
    if (!id) { id = 'review_device_' + reviewVoteNewId().replace('review_vote_', ''); localStorage.setItem(REVIEW_VOTE_DEVICE_KEY, id); }
    return id;
  }
  function reviewVoteNormalise(data = {}) {
    const options = [...new Set((Array.isArray(data.options) ? data.options : []).map(item => String(item || '').trim()).filter(Boolean))].slice(0, 6);
    return {
      active: data.active === true,
      pollId: String(data.pollId || 'review_vote_default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'review_vote_default',
      title: String(data.title || 'Vote H4SX Review').trim().slice(0, 80) || 'Vote H4SX Review',
      description: String(data.description || 'Pilih cadangan anda.').trim().slice(0, 180),
      options: options.length >= 2 ? options : ['Pilihan A', 'Pilihan B'],
      endAt: Number.isFinite(Date.parse(data.endAt || '')) ? new Date(data.endAt).toISOString() : null
    };
  }
  function reviewVoteEndTime(config = reviewVoteConfig) { const value = Date.parse(config?.endAt || ''); return Number.isFinite(value) ? value : null; }
  function reviewVoteIsOpen(config = reviewVoteConfig) { const end = reviewVoteEndTime(config); return !!config?.active && (!end || Date.now() < end); }
  function reviewVoteLocalDate(endAt) {
    const date = new Date(endAt || ''); if (Number.isNaN(date.getTime())) return '';
    const pad = value => String(value).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }
  function reviewVoteEndLabel(endAt) {
    try { return new Intl.DateTimeFormat('ms-MY', { dateStyle:'medium', timeStyle:'short' }).format(new Date(endAt)); }
    catch(e) { return endAt; }
  }
  function reviewVoteSetAdminStatus(text, type = '') {
    if (!reviewVoteAdminStatus) return;
    reviewVoteAdminStatus.textContent = text;
    reviewVoteAdminStatus.style.color = type === 'error' ? '#c2414a' : type === 'success' ? '#07855b' : '';
  }
  function reviewVoteDirectLink(config = reviewVoteConfig) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('vote', config?.pollId || 'active');
    url.hash = 'reviewVoteSection';
    return url.toString();
  }
  async function copyReviewVoteLink() {
    if (!adminOk()) return mintaAdmin();
    if (!reviewVoteConfig?.active) return reviewVoteSetAdminStatus('Hidupkan dan simpan vote dahulu sebelum copy link.', 'error');
    const link = reviewVoteDirectLink();
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
      else {
        const input = document.createElement('textarea');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      reviewVoteSetAdminStatus('Link vote sudah disalin. Bila dibuka, terus pergi ke undian ini.', 'success');
      showToast('Link undian review sudah copy.', 'success');
    } catch(error) {
      console.error(error);
      reviewVoteSetAdminStatus('Tak dapat copy link. Cuba semula.', 'error');
    }
  }
  function focusReviewVoteFromLink(config = reviewVoteConfig) {
    if (reviewVoteDirectLinkHandled || !reviewVoteSection || !config?.active) return;
    const requestedVote = new URLSearchParams(window.location.search).get('vote');
    if (!requestedVote || (requestedVote !== 'active' && requestedVote !== config.pollId)) return;
    reviewVoteDirectLinkHandled = true;
    requestAnimationFrame(() => {
      reviewVoteSection.scrollIntoView({ behavior:'smooth', block:'center' });
      reviewVoteSection.classList.add('is-direct-link');
      setTimeout(() => reviewVoteSection.classList.remove('is-direct-link'), 1900);
    });
  }
  function syncReviewVoteAdmin(config = reviewVoteConfig) {
    if (!config) return;
    if (reviewVoteActive) reviewVoteActive.checked = config.active;
    if (reviewVoteTitleInput) reviewVoteTitleInput.value = config.title;
    if (reviewVoteDescriptionInput) reviewVoteDescriptionInput.value = config.description;
    if (reviewVoteOptionsInput) reviewVoteOptionsInput.value = config.options.join('\n');
    if (reviewVoteEndAtInput) reviewVoteEndAtInput.value = reviewVoteLocalDate(config.endAt);
    if (!adminOk()) reviewVoteSetAdminStatus('Login admin untuk urus vote review.');
    else if (config.active && !reviewVoteIsOpen(config)) reviewVoteSetAdminStatus('Vote review sudah tamat. Keputusan masih dipaparkan.');
    else reviewVoteSetAdminStatus(config.active ? 'Vote review sedang dipaparkan.' : 'Vote review sedang dimatikan.', config.active ? 'success' : '');
  }
  function renderReviewVote() {
    const config = reviewVoteConfig;
    if (!reviewVoteSection || !reviewVoteOptions || !config?.active) { reviewVoteSection?.classList.add('is-hidden'); return; }
    reviewVoteSection.classList.remove('is-hidden');
    focusReviewVoteFromLink(config);
    reviewVoteTitle.textContent = config.title;
    reviewVoteDescription.textContent = config.description;
    const counts = Array.from({ length: config.options.length }, () => 0);
    reviewVoteEntries.forEach(entry => { const index = Number(entry.optionIndex); if (Number.isInteger(index) && index >= 0 && index < counts.length) counts[index] += 1; });
    const total = counts.reduce((sum, value) => sum + value, 0);
    const leadingCount = total ? Math.max(...counts) : 0;
    const stored = localStorage.getItem(REVIEW_VOTE_CHOICE_PREFIX + config.pollId);
    const choice = stored === null ? null : Number(stored);
    const voteOpen = reviewVoteIsOpen(config);
    reviewVoteTotal.textContent = String(total);
    if (reviewVoteStatus) reviewVoteStatus.textContent = voteOpen ? 'UNDIAN REVIEW' : 'VOTE TELAH TAMAT';
    reviewVoteSection.classList.toggle('is-ended', !voteOpen);
    reviewVoteOptions.innerHTML = config.options.map((option, index) => {
      const count = counts[index]; const percent = total ? Math.round(count / total * 100) : 0;
      const leading = leadingCount > 0 && count === leadingCount;
      const disabled = !voteOpen || Number.isInteger(choice) ? ' disabled' : '';
      return '<button class="review-vote-option' + (choice === index ? ' is-voted' : '') + (leading ? ' is-leading' : '') + '" type="button" data-review-vote="' + index + '"' + disabled + '><span class="review-vote-fill" style="--percent:' + percent + '%"></span><span class="review-vote-label">' + (leading ? '<span class="vote-leader-crown" title="Undian paling tinggi"><i class="fa-solid fa-crown"></i></span>' : '') + reviewVoteEscape(option) + '</span><span class="review-vote-count">' + count + '<small>' + percent + '%</small></span></button>';
    }).join('');
    reviewVoteOptions.querySelectorAll('[data-review-vote]').forEach(button => button.addEventListener('click', () => submitReviewVote(Number(button.dataset.reviewVote))));
    const end = reviewVoteEndTime(config);
    if (reviewVoteNote) reviewVoteNote.textContent = end ? (voteOpen ? 'Undian tamat pada ' + reviewVoteEndLabel(config.endAt) + '.' : 'Vote telah tamat. Keputusan terakhir masih dipaparkan.') : 'Satu undi untuk satu perangkat. Keputusan dikemas kini secara langsung.';
    if (reviewVoteEndTimer) clearTimeout(reviewVoteEndTimer);
    if (voteOpen && end) reviewVoteEndTimer = setTimeout(renderReviewVote, Math.min(Math.max(1000, end - Date.now() + 250), 2147483647));
  }
  function listenReviewVoteEntries() {
    if (reviewVoteEntriesUnsubscribe) reviewVoteEntriesUnsubscribe();
    reviewVoteEntries = [];
    if (!reviewVoteConfig?.active) return renderReviewVote();
    reviewVoteEntriesUnsubscribe = onSnapshot(query(collection(db, REVIEW_VOTE_ENTRIES), where('pollId', '==', reviewVoteConfig.pollId)), snapshot => {
      reviewVoteEntries = snapshot.docs.map(item => item.data()); renderReviewVote();
    }, error => { console.error(error); renderReviewVote(); });
  }
  function listenReviewVoteConfig() {
    if (reviewVoteConfigUnsubscribe) reviewVoteConfigUnsubscribe();
    reviewVoteConfigUnsubscribe = onSnapshot(doc(db, 'config', REVIEW_VOTE_CONFIG_ID), snapshot => {
      reviewVoteConfig = reviewVoteNormalise(snapshot.exists() ? snapshot.data() : {});
      syncReviewVoteAdmin(); listenReviewVoteEntries();
    }, error => { console.error(error); reviewVoteSetAdminStatus('Tak dapat baca vote review. Semak Firestore Rules.', 'error'); });
  }
  async function submitReviewVote(optionIndex) {
    const config = reviewVoteConfig;
    if (!config?.active || !reviewVoteIsOpen(config)) return showToast('Masa undian sudah tamat.', 'error');
    if (!Number.isInteger(optionIndex) || !config.options[optionIndex]) return;
    const choiceKey = REVIEW_VOTE_CHOICE_PREFIX + config.pollId;
    if (localStorage.getItem(choiceKey) !== null) return showToast('Anda sudah mengundi untuk vote ini.', 'error');
    const deviceId = reviewVoteDeviceId();
    try {
      await setDoc(doc(db, REVIEW_VOTE_ENTRIES, config.pollId + '_' + deviceId), { pollId:config.pollId, optionIndex, deviceId, createdAt:serverTimestamp() });
      localStorage.setItem(choiceKey, String(optionIndex)); renderReviewVote(); showToast('Undi berjaya direkodkan. Terima kasih!', 'success');
    } catch(error) { console.error(error); showToast('Tak dapat hantar undi. Semak sambungan atau rules.', 'error'); }
  }
  async function saveReviewVote(startNew = false) {
    if (!adminOk()) return mintaAdmin();
    const title = String(reviewVoteTitleInput?.value || '').trim();
    const description = String(reviewVoteDescriptionInput?.value || '').trim();
    const options = [...new Set(String(reviewVoteOptionsInput?.value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean))];
    const endInput = String(reviewVoteEndAtInput?.value || '').trim();
    const endTime = endInput ? new Date(endInput).getTime() : null;
    if (!title || options.length < 2 || options.length > 6 || options.some(item => item.length > 60) || (endInput && !Number.isFinite(endTime))) return reviewVoteSetAdminStatus('Semak tajuk, 2-6 pilihan dan masa tamat.', 'error');
    try {
      await setDoc(doc(db, 'config', REVIEW_VOTE_CONFIG_ID), { active:reviewVoteActive?.checked === true, pollId:startNew ? reviewVoteNewId() : (reviewVoteConfig?.pollId || reviewVoteNewId()), title:title.slice(0,80), description:description.slice(0,180), options:options.slice(0,6), endAt:endTime ? new Date(endTime).toISOString() : null, updatedAt:serverTimestamp(), updatedBy:currentUser.email || 'admin' }, { merge:true });
      reviewVoteSetAdminStatus(startNew ? 'Vote review baru dibuka, kiraan kembali 0.' : 'Vote review berjaya disimpan.', 'success');
      showToast(startNew ? 'Pusingan vote review baru dimulakan.' : 'Vote review berjaya disimpan.', 'success');
    } catch(error) { console.error(error); reviewVoteSetAdminStatus('Gagal simpan. Semak Firestore Rules.', 'error'); }
  }
  btnSaveReviewVote?.addEventListener('click', () => saveReviewVote(false));
  btnNewReviewVote?.addEventListener('click', () => { if (adminOk() && confirm('Mula pusingan vote review baru? Vote lama tidak lagi dikira.')) saveReviewVote(true); });
  btnCopyReviewVoteLink?.addEventListener('click', copyReviewVoteLink);
  listenReviewVoteConfig();

  // -- Admin Config Modal ────────────────────────────────────────
  const btnOpenAdminConfig = document.getElementById('btnOpenAdminConfig');
  const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');
  const btnOpenBulkDelete = document.getElementById('btnOpenBulkDelete');
  const adminOverlayBg = document.getElementById('adminOverlayBg');
  const adminPanelModal = document.getElementById('adminPanelModal');
  const btnCloseAdmin = document.getElementById('btnCloseAdmin');
  const btnSaveAdmin = document.getElementById('btnSaveAdmin');
  const adminAnnounceText = document.getElementById('adminAnnounceText');
  const adminCodePrefix = document.getElementById('adminCodePrefix');
  const adminCodeCount = document.getElementById('adminCodeCount');
  const btnGenerateCodes = document.getElementById('btnGenerateCodes');
  const btnRefreshCodes = document.getElementById('btnRefreshCodes');
  const adminCodeList = document.getElementById('adminCodeList');
  const adminOnlineVisitors = document.getElementById('adminOnlineVisitors');
  const adminTotalVisitors = document.getElementById('adminTotalVisitors');
  const adminLoginOverlayBg = document.getElementById('adminLoginOverlayBg');
  const adminLoginModal = document.getElementById('adminLoginModal');
  const adminLoginEmail = document.getElementById('adminLoginEmail');
  const adminLoginPassword = document.getElementById('adminLoginPassword');
  const btnAdminLogin = document.getElementById('btnAdminLogin');
  const btnCancelAdminLogin = document.getElementById('btnCancelAdminLogin');
  const AUTO_ZIXU_CONFIG_ID = "auto_post_zixu";
  const DEFAULT_ZIXU_MESSAGE = `📞 Link admin : https://wa.me/H4SXMY
☎️ Support Service : https://wa.me/H4SXMY
🛒 Website Market : https://www.h4sxmy.xyz/

⚠️ PERHATIAN ⚠️
Zixu tidak mempunyai sebarang akaun clone. Jika anda menemui mana-mana akaun yang mengaku sebagai Zixu, itu adalah 100% palsu (FAKE).

Zixu hanya menggunakan SATU nombor telefon rasmi dan semua ulasan (review) dikawal sepenuhnya oleh AI.

👑 Zixu Official Promoter H4SX Store Programmer 👑

☀️ Promote Link Buy Phone nom & Support Service Phone nom ☀️`;
  const DEFAULT_ZIXU_CONFIG = {
    enabled: false,
    intervalHours: 5,
    nama: "Z!xu Official",
    bintang: 5,
    ulasan: DEFAULT_ZIXU_MESSAGE,
    profileImg: "https://i.imgur.com/cLPulXQ.png",
    warnaProfil: "#0f2a45",
    badgeText: "ZIXU",
    badgeColor: "#9b5cff",
    badgeColor2: "#35d6ff",
    badgeTextColor: "#ffffff",
    badgeGlowColor: "#9b5cff",
    badgeGradient: true,
    badgeAnimated: true,
    medalText: "PAID PROMOTE",
    medalColor: "#a5b4fc",
    medalColor2: "#7c3aed",
    medalTextColor: "#ffffff",
    medalGlowColor: "#7c3aed",
    medalShape: "pill",
    medalSize: "sm",
    medalGradient: true,
    medalAnimated: true,
    medalOutline: false,
    nameColorEnabled: true,
    nameColor: "#8b5cf6",
    nameColor2: "#38bdf8",
    nameGlowColor: "#8b5cf6",
    nameGradient: true,
    nameAnimated: true,
    nameWeight: "900"
  };
  const autoZixuEnabled = document.getElementById('autoZixuEnabled');
  const autoZixuInterval = document.getElementById('autoZixuInterval');
  const autoZixuRating = document.getElementById('autoZixuRating');
  const autoZixuName = document.getElementById('autoZixuName');
  const autoZixuRole = document.getElementById('autoZixuRole');
  const autoZixuMedal = document.getElementById('autoZixuMedal');
  const autoZixuProfileImg = document.getElementById('autoZixuProfileImg');
  const autoZixuMessage = document.getElementById('autoZixuMessage');
  const autoZixuStatus = document.getElementById('autoZixuStatus');
  const btnRunZixuNow = document.getElementById('btnRunZixuNow');

  function isiAutoZixuForm(data = {}) {
    const cfg = { ...DEFAULT_ZIXU_CONFIG, ...data };
    if (!autoZixuEnabled) return;
    autoZixuEnabled.checked = cfg.enabled === true;
    autoZixuInterval.value = Math.max(1, Math.min(72, parseInt(cfg.intervalHours) || 5));
    autoZixuRating.value = Math.max(1, Math.min(5, parseInt(cfg.bintang) || 5));
    autoZixuName.value = cfg.nama || DEFAULT_ZIXU_CONFIG.nama;
    autoZixuRole.value = cfg.badgeText || DEFAULT_ZIXU_CONFIG.badgeText;
    autoZixuMedal.value = cfg.medalText || DEFAULT_ZIXU_CONFIG.medalText;
    autoZixuProfileImg.value = cfg.profileImg || "";
    autoZixuMessage.value = cfg.ulasan || DEFAULT_ZIXU_MESSAGE;
    if (autoZixuStatus) autoZixuStatus.textContent = cfg.lastPostAt?.toDate
      ? `Last post: ${cfg.lastPostAt.toDate().toLocaleString("ms-MY")}`
      : "Belum pernah auto post.";
  }
  function bacaAutoZixuForm(base = {}) {
    const intervalHours = Math.max(1, Math.min(72, parseInt(autoZixuInterval?.value) || 5));
    const rating = Math.max(1, Math.min(5, parseInt(autoZixuRating?.value) || 5));
    return {
      ...DEFAULT_ZIXU_CONFIG,
      ...base,
      enabled: autoZixuEnabled?.checked === true,
      intervalHours,
      bintang: rating,
      nama: (autoZixuName?.value || DEFAULT_ZIXU_CONFIG.nama).trim().slice(0, 40),
      ulasan: (autoZixuMessage?.value || DEFAULT_ZIXU_MESSAGE).trim().slice(0, 500),
      profileImg: (autoZixuProfileImg?.value || DEFAULT_ZIXU_CONFIG.profileImg).trim(),
      badgeText: (autoZixuRole?.value || DEFAULT_ZIXU_CONFIG.badgeText).trim().slice(0, 24),
      medalText: (autoZixuMedal?.value || DEFAULT_ZIXU_CONFIG.medalText).trim().slice(0, 18)
    };
  }
  async function loadAutoZixuConfig() {
    try {
      const snap = await getDoc(doc(db, "config", AUTO_ZIXU_CONFIG_ID));
      isiAutoZixuForm(snap.exists() ? snap.data() : DEFAULT_ZIXU_CONFIG);
      return snap.exists() ? snap.data() : DEFAULT_ZIXU_CONFIG;
    } catch(e) {
      console.error(e);
      isiAutoZixuForm(DEFAULT_ZIXU_CONFIG);
      return DEFAULT_ZIXU_CONFIG;
    }
  }
  async function saveAutoZixuConfig(extra = {}) {
    if (!adminOk()) return;
    const cfg = bacaAutoZixuForm(extra);
    await setDoc(doc(db, "config", AUTO_ZIXU_CONFIG_ID), cfg, { merge: true });
    return cfg;
  }
  function autoZixuReviewPayload(cfg = {}) {
    const data = { ...DEFAULT_ZIXU_CONFIG, ...cfg };
    return {
      nama: String(data.nama || DEFAULT_ZIXU_CONFIG.nama).trim().slice(0, 40),
      bintang: Math.max(1, Math.min(5, parseInt(data.bintang) || 5)),
      ulasan: String(data.ulasan || DEFAULT_ZIXU_MESSAGE).trim().slice(0, 500),
      diciptaPada: serverTimestamp(),
      profileImg: data.profileImg || DEFAULT_ZIXU_CONFIG.profileImg,
      warnaProfil: data.warnaProfil || DEFAULT_ZIXU_CONFIG.warnaProfil,
      badgeText: data.badgeText || DEFAULT_ZIXU_CONFIG.badgeText,
      badgeColor: data.badgeColor || DEFAULT_ZIXU_CONFIG.badgeColor,
      badgeColor2: data.badgeColor2 || DEFAULT_ZIXU_CONFIG.badgeColor2,
      badgeTextColor: data.badgeTextColor || DEFAULT_ZIXU_CONFIG.badgeTextColor,
      badgeGlowColor: data.badgeGlowColor || DEFAULT_ZIXU_CONFIG.badgeGlowColor,
      badgeGradient: data.badgeGradient !== false,
      badgeAnimated: data.badgeAnimated !== false,
      medalText: data.medalText || DEFAULT_ZIXU_CONFIG.medalText,
      medalColor: data.medalColor || DEFAULT_ZIXU_CONFIG.medalColor,
      medalColor2: data.medalColor2 || DEFAULT_ZIXU_CONFIG.medalColor2,
      medalTextColor: data.medalTextColor || DEFAULT_ZIXU_CONFIG.medalTextColor,
      medalGlowColor: data.medalGlowColor || DEFAULT_ZIXU_CONFIG.medalGlowColor,
      medalShape: data.medalShape || DEFAULT_ZIXU_CONFIG.medalShape,
      medalSize: data.medalSize || DEFAULT_ZIXU_CONFIG.medalSize,
      medalGradient: data.medalGradient !== false,
      medalAnimated: data.medalAnimated !== false,
      medalOutline: data.medalOutline === true,
      nameColorEnabled: data.nameColorEnabled === true,
      nameColor: data.nameColor || DEFAULT_ZIXU_CONFIG.nameColor,
      nameColor2: data.nameColor2 || DEFAULT_ZIXU_CONFIG.nameColor2,
      nameGlowColor: data.nameGlowColor || DEFAULT_ZIXU_CONFIG.nameGlowColor,
      nameGradient: data.nameGradient !== false,
      nameAnimated: data.nameAnimated !== false,
      nameWeight: data.nameWeight || DEFAULT_ZIXU_CONFIG.nameWeight,
      autoPostBy: "zixu",
      pinned: true,
      pinnedAt: serverTimestamp()
    };
  }
  async function postZixuReview(manual = false) {
    if (!adminOk()) {
      if (manual) showToast("Login admin dulu untuk post Z!xu.", "error");
      return false;
    }
    const snap = await getDoc(doc(db, "config", AUTO_ZIXU_CONFIG_ID));
    const saved = snap.exists() ? snap.data() : {};
    const cfg = manual ? bacaAutoZixuForm(saved) : { ...DEFAULT_ZIXU_CONFIG, ...saved };
    if (!manual && cfg.enabled !== true) return false;
    const intervalMs = Math.max(1, Math.min(72, parseInt(cfg.intervalHours) || 5)) * 60 * 60 * 1000;
    const lastMs = cfg.lastPostAt?.toMillis ? cfg.lastPostAt.toMillis() : 0;
    if (!manual && lastMs && Date.now() - lastMs < intervalMs) return false;
    const reviewRef = await addDoc(collection(db, "ratings"), autoZixuReviewPayload(cfg));
    await setDoc(doc(db, "config", AUTO_ZIXU_CONFIG_ID), {
      ...cfg,
      lastPostAt: serverTimestamp(),
      lastPostReviewId: reviewRef.id,
      updatedAt: serverTimestamp()
    }, { merge: true });
    if (autoZixuStatus) autoZixuStatus.textContent = "Z!xu baru sahaja post.";
    if (manual) showToast("Z!xu berjaya post sekarang.", "success");
    else showToast("Auto post Z!xu dihantar.", "success");
    return true;
  }
  async function checkAutoZixuPost() {
    if (!adminOk()) return;
    try { await postZixuReview(false); }
    catch(e) { console.error("Auto Z!xu gagal:", e); }
  }

  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user && !adminOk()) {
      showToast("Akaun ini bukan admin H4SX.", "error");
      signOut(auth);
      return;
    }
    updateAdminUi();
    window.H4SXAdminSessions?.bind({
      user:currentUser, signOut:() => signOut(auth),
      watchRevocations:callback => onSnapshot(doc(db, 'config', 'admin_session_security'), snapshot => callback(snapshot.data() || {}), () => {})
    });
    syncReviewCodesListener();
    syncVisitStatsListener();
    syncReviewVoteAdmin();
    if (latestCodeSnapshot) renderCodeListFromSnapshot(latestCodeSnapshot);
    if (latestCodeSnapshot) renderAdminCodes();
    try { renderReviews(); } catch (e) {}
    if (adminOk()) checkAutoZixuPost();
    else closeAdminReviewCenter();
  });

  btnAdminLogin.addEventListener('click', async () => {
    const email = adminLoginEmail.value.trim();
    const password = adminLoginPassword.value;
    if (!email || !password) { showToast("Masukkan email dan password admin.", "error"); return; }
    btnAdminLogin.disabled = true; btnAdminLogin.textContent = "Login...";
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!ADMIN_UIDS.includes(cred.user.uid)) {
        await signOut(auth);
        showToast("Akaun ini bukan admin H4SX.", "error");
        return;
      }
      tutupAdminLogin();
      showToast("Login admin berjaya.", "success");
    } catch (e) {
      console.error(e);
      showToast("Login admin gagal. Semak email/password.", "error");
    } finally {
      btnAdminLogin.disabled = false; btnAdminLogin.textContent = "Login";
    }
  });
  adminLoginPassword.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnAdminLogin.click();
  });
  btnCancelAdminLogin.addEventListener('click', tutupAdminLogin);
  adminLoginOverlayBg.addEventListener('click', tutupAdminLogin);
  updateAdminUi();

  btnOpenAdminConfig.addEventListener('click', async () => {
    if (!mintaAdmin()) return;
    syncReviewVoteAdmin();
    
    try {
      const snap = await getDoc(doc(db, "config", "announcement"));
      if (snap.exists()) adminAnnounceText.value = snap.data().text || DEFAULT_ANNOUNCEMENT_TEXT;
      else adminAnnounceText.value = DEFAULT_ANNOUNCEMENT_TEXT;
    } catch(e) {}
    await loadAutoZixuConfig();
    adminOverlayBg.classList.add('show');
    adminPanelModal.classList.add('show');
  });

  function tutupAdminPanel() {
    adminOverlayBg.classList.remove('show');
    adminPanelModal.classList.remove('show');
  }
  btnCloseAdmin.addEventListener('click', tutupAdminPanel);
  document.getElementById('btnCloseAdminTop')?.addEventListener('click', tutupAdminPanel);
  adminOverlayBg.addEventListener('click', tutupAdminPanel);

  btnOpenBulkDelete.addEventListener('click', () => {
    if (!mintaAdmin()) return;
    adminOverlayBg.classList.remove('show');
    adminPanelModal.classList.remove('show');
    deletePilihan();
  });

  btnSaveAdmin.addEventListener('click', async () => {
    btnSaveAdmin.disabled = true; btnSaveAdmin.textContent = "Menyimpan...";
    try {
      // Kita kena pastikan document wujud, setDoc dengan merge:true adalah cara yang betul
      await setDoc(doc(db, "config", "announcement"), { text: adminAnnounceText.value.trim() }, { merge: true });
      await saveAutoZixuConfig({ updatedAt: serverTimestamp() });
      showToast("Tetapan admin berjaya disimpan.", "success");
      btnCloseAdmin.click();
    } catch (e) {
      console.error(e);
      showToast("Gagal menyimpan tetapan. Sila semak rule Firebase.", "error");
    }
    btnSaveAdmin.disabled = false; btnSaveAdmin.textContent = "Simpan";
  });
  if (btnRunZixuNow) {
    btnRunZixuNow.addEventListener('click', async () => {
      if (!mintaAdmin()) return;
      btnRunZixuNow.disabled = true;
      btnRunZixuNow.textContent = "Posting...";
      try {
        await saveAutoZixuConfig({ updatedAt: serverTimestamp() });
        await postZixuReview(true);
      } catch(e) {
        console.error(e);
        showToast("Gagal post Z!xu. Semak rules ratings/config.", "error");
      } finally {
        btnRunZixuNow.disabled = false;
        btnRunZixuNow.textContent = "Post Z!xu Sekarang";
      }
    });
  }
  setInterval(checkAutoZixuPost, 5 * 60 * 1000);

  function randomCodePart(len = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    crypto.getRandomValues(new Uint32Array(len)).forEach(n => out += chars[n % chars.length]);
    return out;
  }
  function cleanCodePrefix(value) {
    return (value || "H4SX").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "H4SX";
  }
  function reviewIdForCode(code) {
    return "review_" + String(code || "").trim().toUpperCase();
  }
  function syncUsedReviewCodeIds(records = []) {
    usedReviewCodeIds = new Set(records
      .map(item => String(item?.id || ""))
      .filter(id => id.startsWith("review_") && id.length > 7)
      .map(id => id.slice(7).toUpperCase()));
  }
  function isReviewCodeUsed(code) {
    return usedReviewCodeIds.has(String(code || "").trim().toUpperCase());
  }
  function availableReviewCodeDocs(snapshot = latestCodeSnapshot) {
    const list = [];
    snapshot?.forEach(item => {
      if (!isReviewCodeUsed(item.id)) list.push(item);
    });
    return list;
  }
  async function createUnusedReviewCode(prefix, made = []) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const code = `${prefix}-${randomCodePart(6)}`;
      if (made.includes(code)) continue;
      const [codeSnap, reviewSnap] = await Promise.all([
        getDoc(doc(db, "review_codes", code)),
        getDoc(doc(db, "ratings", reviewIdForCode(code)))
      ]);
      if (!codeSnap.exists() && !reviewSnap.exists()) return code;
    }
    throw new Error("Tak dapat jana kod unik. Cuba lagi.");
  }
  async function cleanupUsedReviewCodes(snapshot = latestCodeSnapshot) {
    if (!adminOk() || !snapshot || reviewCodeCleanupRunning) return;
    const stale = [];
    snapshot.forEach(item => { if (isReviewCodeUsed(item.id)) stale.push(item.id); });
    if (!stale.length) return;
    reviewCodeCleanupRunning = true;
    try {
      const results = await Promise.allSettled(stale.map(code => deleteDoc(doc(db, "review_codes", code))));
      const removed = results.filter(result => result.status === "fulfilled").length;
      if (removed) console.info(`${removed} kod review terpakai dibersihkan daripada senarai tersedia.`);
    } finally {
      reviewCodeCleanupRunning = false;
    }
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Kod ${text} dicopy.`, "success");
    } catch(e) {
      showToast(`Kod: ${text}`, "success");
    }
  }
  async function generateReviewCodes() {
    if (!mintaAdmin()) return;
    const prefix = cleanCodePrefix(adminCodePrefix.value);
    const count = Math.max(1, Math.min(200, parseInt(adminCodeCount.value) || 1));
    adminCodePrefix.value = prefix;
    adminCodeCount.value = String(count);
    btnGenerateCodes.disabled = true;
    btnGenerateCodes.textContent = "Generating...";
    try {
      const made = [];
      for (let i = 0; i < count; i++) {
        const code = await createUnusedReviewCode(prefix, made);
        made.push(code);
        await setDoc(doc(db, "review_codes", code), {
          kod: code,
          diciptaPada: serverTimestamp(),
          diciptaOleh: currentUser?.uid || "admin"
        });
      }
      showToast(`${made.length} kod berjaya dijana ke Firebase.`, "success");
    } catch(e) {
      console.error(e);
      showToast("Gagal generate kod. Semak rules review_codes admin create.", "error");
    } finally {
      btnGenerateCodes.disabled = false;
      btnGenerateCodes.textContent = "Generate Kod";
    }
  }
  function renderCodeListFromSnapshot(snapshot) {
    if (!adminOk()) {
      adminCodeList.textContent = "Login admin untuk lihat kod.";
      return;
    }
    const codes = [];
    availableReviewCodeDocs(snapshot).forEach(item => codes.push(item.id));
    codes.sort();
    if (!codes.length) {
      adminCodeList.textContent = "Tiada kod tersedia.";
      return;
    }
    adminCodeList.innerHTML = codes.map(code => `<button class="admin-code-pill" type="button" data-code="${escapeHtml(code)}">${escapeHtml(code)}</button>`).join("");
    adminCodeList.querySelectorAll("[data-code]").forEach(btn => {
      btn.addEventListener("click", () => copyText(btn.dataset.code));
    });
  }
  let stopReviewCodesListener = null;
  function syncReviewCodesListener() {
    if (!adminOk()) {
      if (stopReviewCodesListener) stopReviewCodesListener();
      stopReviewCodesListener = null;
      latestCodeSnapshot = null;
      if (adminCodeList) adminCodeList.textContent = "Login admin untuk lihat kod.";
      return;
    }
    if (stopReviewCodesListener) return;
    stopReviewCodesListener = onSnapshot(collection(db, "review_codes"), snapshot => {
      latestCodeSnapshot = snapshot;
      renderCodeListFromSnapshot(snapshot);
      renderAdminCodes();
      cleanupUsedReviewCodes(snapshot);
    }, err => {
      console.warn("Gagal load kod review admin:", err);
      if (adminCodeList) adminCodeList.textContent = "Gagal load kod. Semak rules Firebase.";
    });
  }
  btnGenerateCodes.addEventListener("click", generateReviewCodes);
  btnRefreshCodes.addEventListener("click", () => showToast("Senarai kod auto update dari Firebase.", "success"));

  function getVisitorId() {
    const key = "h4sx_review_visitor_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, id);
    }
    return id;
  }
  const visitorId = getVisitorId();
  let stopVisitStatsListener = null;

  function readVisitTime(value) {
    if (value?.toMillis) return value.toMillis();
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function syncVisitStatsListener() {
    if (!adminOk()) {
      if (stopVisitStatsListener) {
        stopVisitStatsListener();
        stopVisitStatsListener = null;
      }
      if (adminOnlineVisitors) adminOnlineVisitors.textContent = "0";
      if (adminTotalVisitors) adminTotalVisitors.textContent = "0";
      return;
    }
    if (stopVisitStatsListener) return;

    stopVisitStatsListener = onSnapshot(collection(db, "review_visits"), snapshot => {
      const now = Date.now();
      let online = 0;
      snapshot.forEach(item => {
        const data = item.data();
        if (data.online === true && now - readVisitTime(data.lastSeen) < 45000) online++;
      });
      if (adminOnlineVisitors) adminOnlineVisitors.textContent = String(online);
      if (adminTotalVisitors) adminTotalVisitors.textContent = String(snapshot.size);
    }, err => {
      // Visitor statistics are intentionally admin-only in Firestore.
      if (adminOk()) console.warn("Gagal baca visit stats:", err);
    });
  }

  async function updateVisitPresence(online = true) {
    try {
      const firstSeenKey = "h4sx_review_first_seen";
      let firstSeen = localStorage.getItem(firstSeenKey);
      if (!firstSeen) {
        firstSeen = new Date().toISOString();
        localStorage.setItem(firstSeenKey, firstSeen);
      }
      await setDoc(doc(db, "review_visits", visitorId), {
        page: "review",
        online,
        firstSeen,
        // Keep this a plain ISO value so both older and newer Firestore rules accept it.
        lastSeen: new Date().toISOString(),
        userAgent: navigator.userAgent.slice(0, 140)
      }, { merge: true });
    } catch(e) {
      // Presence is optional. Do not spam the visitor console if analytics rules are disabled.
    }
  }
  updateVisitPresence(true);
  setInterval(() => updateVisitPresence(document.visibilityState !== "hidden"), 20000);
  document.addEventListener("visibilitychange", () => updateVisitPresence(document.visibilityState !== "hidden"));
  window.addEventListener("pagehide", () => updateVisitPresence(false));

  // ── Toast ─────────────────────────────────────────────────────
  const toastStack = document.getElementById("toastStack");
  function showToast(msg, type="info") {
    const icons = {success:"✅",error:"❌",info:"ℹ️"};
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${escapeHtml(msg)}</span>`;
    toastStack.appendChild(t);
    const rm = () => { t.classList.add("out"); t.addEventListener("animationend",()=>t.remove(),{once:true}); };
    const tid = setTimeout(rm, 3800);
    t.addEventListener("click", ()=>{ clearTimeout(tid); rm(); });
  }

  window.shareH4sxReview = async function shareH4sxReview() {
    const url = new URL(window.location.href);
    url.searchParams.delete("preview");
    url.searchParams.delete("refresh");
    const shareUrl = url.toString();
    const shareData = {
      title: "H4SX Review",
      text: "Semak pengalaman pembeli sebenar di H4SX Review.",
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        showToast("Terima kasih sebab kongsi H4SX Review!", "success");
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link review sudah disalin. Hantar dekat kawan anda!", "success");
    } catch (error) {
      if (error?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Link review sudah disalin. Hantar dekat kawan anda!", "success");
      } catch (copyError) {
        window.prompt("Copy link H4SX Review ini:", shareUrl);
      }
    }
  };

  // ── DOM ───────────────────────────────────────────────────────
  const kodVerification = document.getElementById("kodVerification");
  const namaPelanggan   = document.getElementById("namaPelanggan");
  const btnGenerateName = document.getElementById("btnGenerateName");
  const pilihBintang    = document.getElementById("pilihBintang");
  const ulasanPelanggan = document.getElementById("ulasanPelanggan");
  const butangHantar    = document.getElementById("butangHantar");
  const kotakPaparan    = document.getElementById("kotakPaparan");
  const purataSkor      = document.getElementById("purataSkor");
  const purataBintang   = document.getElementById("purataBintang");
  const jumlahUlasanVal = document.getElementById("jumlahUlasanVal");
  const pctLima         = document.getElementById("pctLima");
  const avatarPreview   = document.getElementById("avatarPreview");
  const swatchRow       = document.getElementById("swatchRow");
  const emojiRow        = document.getElementById("emojiRow");
  const charCounter     = document.getElementById("charCounter");
  const sortSelect      = document.getElementById("sortSelect");
  const reviewSearchInput = document.getElementById("reviewSearchInput");
  const btnClearReviewSearch = document.getElementById("btnClearReviewSearch");
  const reviewResultCount = document.getElementById("reviewResultCount");
  const btnReviewScreenshot = document.getElementById("btnReviewScreenshot");
  const fileInput       = document.getElementById("fileInput");
  const dropZone        = document.getElementById("dropZone");
  const clipboardZone   = document.getElementById("clipboardZone");
  const urlGambar       = document.getElementById("urlGambar");
  const btnLoadUrl      = document.getElementById("btnLoadUrl");
  const btnPasteProfileImg = document.getElementById("btnPasteProfileImg");
  const btnClearImg     = document.getElementById("btnClearImg");
  const btnDadu         = document.getElementById("btnDadu");
  const ratingSuggestion = document.getElementById("ratingSuggestion");
  const ratingSuggestionLabel = document.getElementById("ratingSuggestionLabel");
  const ratingSuggestionText = document.getElementById("ratingSuggestionText");
  const btnUseRatingSuggestion = document.getElementById("btnUseRatingSuggestion");
  const reviewStoryItem = document.getElementById("reviewStoryItem");
  const reviewStoryTime = document.getElementById("reviewStoryTime");
  const reviewStoryExperience = document.getElementById("reviewStoryExperience");
  const btnBuildOwnReview = document.getElementById("btnBuildOwnReview");
  const feedbackImageInput   = document.getElementById("feedbackImageInput");
  const btnPickFeedbackImage = document.getElementById("btnPickFeedbackImage");
  const btnClearFeedbackImage = document.getElementById("btnClearFeedbackImage");
  const feedbackImagePreview = document.getElementById("feedbackImagePreview");
  document.querySelector(".form-col")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target && e.target.tagName === "INPUT") {
      if (e.target === urlGambar) return;
      e.preventDefault();
    }
  });
  const feedbackImageModal = document.getElementById("feedbackImageModal");
  const feedbackImageModalImg = document.getElementById("feedbackImageModalImg");
  const btnCloseFeedbackImage = document.getElementById("btnCloseFeedbackImage");

  // ── Profile ───────────────────────────────────────────────────
  const WARNA = ['#2fa8e0','#7c5cbf','#22c47a','#f0a500','#e05252','#1a4470','#48a89e','#d96fb0'];
  const EMOJI  = ['😀','😎','🔥','🎮','👾','🐉','⚡','💎'];
  let pilihanWarna = null, pilihanEmoji = null, profileImgB64 = null, feedbackImgB64 = null;
  const NAMA_AUTO = [
    "Aiman", "Hakim", "Danish", "Aqil", "Farish", "Arif", "Nazri",
    "Syafiq", "Ammar", "Haziq", "Danial", "Adam", "Rizqi", "Rayyan", "Naufal",
    "Izzah", "Syahira", "Alya", "Nadia", "Sofea", "Humaira", "Aina", "Maisarah",
    "Zara", "Hana", "Mia", "Qistina", "Putri", "Nurul"
  ];
  const NAMA_SUFFIX = ["X", "Pro", "MY", "GG", "ID", "V2", "OP", "YT", "RX", "VX"];

  WARNA.forEach(w => {
    const sw = document.createElement("div");
    sw.className = "swatch"; sw.style.backgroundColor = w;
    sw.onclick = () => {
      pilihanWarna = w;
      document.querySelectorAll(".swatch").forEach(s=>s.classList.remove("active"));
      sw.classList.add("active"); updatePreview();
    };
    swatchRow.appendChild(sw);
  });

  EMOJI.forEach(em => {
    const opt = document.createElement("div");
    opt.className = "emoji-opt"; opt.textContent = em;
    opt.onclick = () => {
      pilihanEmoji = pilihanEmoji === em ? null : em;
      document.querySelectorAll(".emoji-opt").forEach(o=>o.classList.remove("active"));
      if (pilihanEmoji) { opt.classList.add("active"); clearProfileImg(false); }
      updatePreview();
    };
    emojiRow.appendChild(opt);
  });

  function warnaAuto(nama) {
    const n = (nama||"").trim();
    return n ? WARNA[n.length % WARNA.length] : WARNA[0];
  }
  function updatePreview() {
    const nama  = namaPelanggan.value.trim();
    const warna = pilihanWarna || warnaAuto(nama);
    const officialLogo = adminOk() && document.getElementById("adminOfficialReview").checked;
    const previewSrc = officialLogo ? H4SX_LOGO_URL : profileImgB64;
    const letter = avatarPreview.querySelector(".av-letter");
    avatarPreview.style.backgroundColor = warna;
    avatarPreview.classList.toggle("has-profile-image", Boolean(previewSrc));
    const oldImg = avatarPreview.querySelector("img.av-img");
    if (oldImg) oldImg.remove();
    if (previewSrc) {
      const img = document.createElement("img");
      img.className = "av-img"; img.src = previewSrc;
      avatarPreview.insertBefore(img, avatarPreview.querySelector(".av-edit-hint"));
      letter.textContent = "";
    } else {
      letter.textContent = pilihanEmoji || (nama ? nama.charAt(0).toUpperCase() : "H");
    }
  }
  namaPelanggan.addEventListener("input", updatePreview);
  document.getElementById("adminOfficialReview").addEventListener("change", updatePreview);
  btnGenerateName.addEventListener("click", () => {
    const nama = NAMA_AUTO[Math.floor(Math.random() * NAMA_AUTO.length)];
    const suffix = NAMA_SUFFIX[Math.floor(Math.random() * NAMA_SUFFIX.length)];
    namaPelanggan.value = `${nama}${suffix}`;
    pilihanWarna = WARNA[Math.floor(Math.random() * WARNA.length)];
    pilihanEmoji = null;
    document.querySelectorAll(".emoji-opt").forEach(o=>o.classList.remove("active"));
    document.querySelectorAll(".swatch").forEach(s=>s.classList.remove("active"));
    const warnaIndex = WARNA.indexOf(pilihanWarna);
    if (warnaIndex >= 0) swatchRow.children[warnaIndex]?.classList.add("active");
    clearProfileImg(false);
    updatePreview();
  });
  updatePreview();

  // Image upload tabs
  document.querySelectorAll(".img-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".img-tab").forEach(t=>t.classList.remove("active"));
      document.querySelectorAll(".img-tab-panel").forEach(p=>p.classList.remove("show"));
      tab.classList.add("active");
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add("show");
    });
  });

  avatarPreview.addEventListener("click", () => fileInput.click());

  function compressImage(src, cb, onFail) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const SIZE = 80, c = document.createElement("canvas");
        c.width = c.height = SIZE;
        const ctx = c.getContext("2d");
        const min = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - min)/2, sy = (img.naturalHeight - min)/2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        // toDataURL akan throw SecurityError kalau canvas "tainted" —
        // ini berlaku bila server URL gambar tu tak bagi header CORS
        // (Access-Control-Allow-Origin). Byk website block ni secara default.
        const dataUrl = c.toDataURL("image/jpeg", 0.75);
        cb(dataUrl);
      } catch (e) {
        console.error("Gagal proses gambar (kemungkinan sekatan CORS):", e);
        if (onFail) onFail(e);
        else showToast("Gambar dari URL ni tak boleh dimuatkan sebab sekatan pelayan (CORS). Cuba host lain (cth: i.imgur.com) atau upload terus dari galeri.", "error");
      }
    };
    img.onerror = () => {
      if (onFail) onFail(new Error("load-failed"));
      else showToast("Gagal muatkan gambar. Cuba URL lain.", "error");
    };
    img.src = src;
  }
  function applyProfileImg(b64) {
    profileImgB64 = b64; pilihanEmoji = null;
    document.querySelectorAll(".emoji-opt").forEach(o=>o.classList.remove("active"));
    btnClearImg.classList.add("show"); updatePreview();
    showToast("Gambar profil berjaya dimuatkan! 📸", "success");
  }
  function applyProfileFile(file, sourceLabel = "gambar") {
    if (!file || !file.type?.startsWith("image/")) {
      showToast(`Clipboard tiada gambar. Copy gambar dulu, kemudian paste.`, "error");
      return;
    }
    if (file.size > 5*1024*1024) {
      showToast("Gambar profil terlalu besar. Max 5MB.", "error");
      return;
    }
    const r = new FileReader();
    r.onload = e => compressImage(e.target.result, applyProfileImg);
    r.readAsDataURL(file);
    showToast(`Memproses ${sourceLabel}...`, "info");
  }
  async function pasteProfileFromClipboard() {
    if (!navigator.clipboard?.read) {
      showToast("Browser ini tidak support baca gambar clipboard. Guna Ctrl+V atau upload galeri.", "error");
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        applyProfileFile(new File([blob], "clipboard-profile.png", { type }), "gambar clipboard");
        return;
      }
      showToast("Clipboard tiada gambar. Copy gambar dulu.", "error");
    } catch (err) {
      console.error(err);
      showToast("Tak dapat baca clipboard. Cuba tekan Ctrl+V dalam kotak Clipboard.", "error");
    }
  }
  function clearProfileImg(showMsg=true) {
    profileImgB64 = null; btnClearImg.classList.remove("show");
    fileInput.value = ""; urlGambar.value = ""; updatePreview();
    if (showMsg) showToast("Gambar profil dibuang.", "info");
  }
  btnClearImg.addEventListener("click", ()=>clearProfileImg(true));
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (!f) return;
    applyProfileFile(f, "gambar profil");
  });
  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault(); dropZone.classList.remove("drag-over");
    const f = e.dataTransfer.files[0];
    applyProfileFile(f, "gambar drop");
  });
  if (btnPasteProfileImg) btnPasteProfileImg.addEventListener("click", pasteProfileFromClipboard);
  if (clipboardZone) {
    clipboardZone.addEventListener("click", () => clipboardZone.focus());
    clipboardZone.addEventListener("paste", e => {
      const file = [...(e.clipboardData?.items || [])]
        .find(item => item.type.startsWith("image/"))?.getAsFile();
      if (file) {
        e.preventDefault();
        applyProfileFile(file, "gambar clipboard");
      }
    });
  }
  document.addEventListener("paste", e => {
    const activePanel = document.getElementById("panel-clipboard");
    if (!activePanel?.classList.contains("show")) return;
    const file = [...(e.clipboardData?.items || [])]
      .find(item => item.type.startsWith("image/"))?.getAsFile();
    if (file) {
      e.preventDefault();
      applyProfileFile(file, "gambar clipboard");
    }
  });
  btnLoadUrl.addEventListener("click", () => {
    const url = urlGambar.value.trim();
    if (!url || !url.startsWith("http")) { showToast("URL tidak sah.", "error"); return; }
    btnLoadUrl.textContent = "Memuatkan..."; btnLoadUrl.disabled = true;
    let selesai = false;
    const tamatkan = () => { selesai = true; btnLoadUrl.textContent = "Muat"; btnLoadUrl.disabled = false; };
    compressImage(
      url,
      b64 => { if (selesai) return; applyProfileImg(b64); tamatkan(); },
      err => {
        if (selesai) return;
        tamatkan();
        if (err && err.message === "load-failed") {
          showToast("Gagal muatkan gambar. Semak URL tu betul & terus ke fail gambar (.jpg/.png).", "error");
        } else {
          showToast("URL ni tak boleh dimuatkan sebab sekatan pelayan (CORS). Cuba host lain (cth: i.imgur.com) atau upload terus dari galeri.", "error");
        }
      }
    );
    setTimeout(()=>{ if (!selesai) { tamatkan(); showToast("Muat gambar mengambil masa terlalu lama. Cuba lagi.", "error"); } }, 8000);
  });
  urlGambar.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnLoadUrl.click();
    }
  });

  function compressFeedbackImage(src, cb) {
    const img = new Image();
    img.onload = () => {
      const maxSide = 900;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      cb(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => showToast("Gagal proses gambar feedback. Cuba gambar lain.", "error");
    img.src = src;
  }
  function setFeedbackImage(b64) {
    feedbackImgB64 = b64;
    btnClearFeedbackImage.classList.add("show");
    feedbackImagePreview.textContent = "Gambar feedback sudah dipilih. Ia hanya muncul bila orang tekan See image.";
    showToast("Gambar feedback berjaya dimuatkan.", "success");
  }
  function clearFeedbackImage(showMsg=true) {
    feedbackImgB64 = null;
    feedbackImageInput.value = "";
    btnClearFeedbackImage.classList.remove("show");
    feedbackImagePreview.textContent = "";
    if (showMsg) showToast("Gambar feedback dibuang.", "info");
  }
  function openFeedbackImage(src) {
    if (!src) return;
    feedbackImageModalImg.src = src;
    feedbackImageModal.classList.add("show");
  }
  function closeFeedbackImage() {
    feedbackImageModal.classList.remove("show");
    feedbackImageModalImg.src = "";
  }
  btnPickFeedbackImage.addEventListener("click", () => feedbackImageInput.click());
  btnClearFeedbackImage.addEventListener("click", () => clearFeedbackImage(true));
  feedbackImageInput.addEventListener("change", () => {
    const f = feedbackImageInput.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { showToast("Fail feedback mesti gambar.", "error"); return; }
    if (f.size > 5*1024*1024) { showToast("Gambar feedback terlalu besar. Max 5MB.", "error"); return; }
    const r = new FileReader();
    r.onload = e => compressFeedbackImage(e.target.result, setFeedbackImage);
    r.readAsDataURL(f);
  });
  btnCloseFeedbackImage.addEventListener("click", closeFeedbackImage);
  feedbackImageModal.addEventListener("click", e => {
    if (e.target === feedbackImageModal) closeFeedbackImage();
  });

  // ── Dadu ──────────────────────────────────────────────────────
  const CDG_PREFIX = "cdg - ";
  let reviewSuggestionUsed = false;
  const CONTOH_RATING = {
    5: "Perfect product, fast response, proses sangat pantas dan seller trusted. Memang recommended!",
    4: "Produk diterima dengan baik dan seller responsif. Servis memuaskan, cuma ada sedikit kelewatan.",
    3: "Produk diterima dan urusan selesai. Servis okay, tetapi komunikasi dan masa proses boleh diperbaiki.",
    2: "Produk diterima, tetapi proses agak lambat dan kemas kini kurang jelas. Harap servis dapat ditambah baik.",
    1: "Pengalaman kali ini kurang memuaskan. Respons dan penyelesaian masalah perlu diperbaiki dengan segera."
  };
  const CADANGAN = {
    5:[
      "Servis memang laju dan mudah faham. Lepas payment terus diproses, seller pun friendly. Memang trusted untuk beli digital item. 🔥",
      "Urusan sangat smooth dari mula sampai siap. Detail produk jelas, seller respons cepat, dan item masuk seperti yang dijanjikan. ⭐",
      "First time beli dekat sini tapi puas hati. Proses pantas, harga okay, dan seller bantu sampai selesai. Recommended. 🙏",
      "Digital item diterima dengan selamat dan tak pening nak deal. Seller explain elok-elok, jadi rasa yakin nak repeat order. 💎",
      "Servis terbaik, cepat respond dan tak buat customer tertunggu lama. H4SX STORE memang boleh dipercayai untuk order online. 🚀"
    ],
    4:[
      "Keseluruhan puas hati. Proses order jelas dan seller senang bincang. Ada lambat sikit tapi masih okay. 👍",
      "Produk digital diterima seperti info yang diberi. Harga berpatutan dan support pun membantu. Boleh repeat lagi. 🙂",
      "Seller baik dan cepat bantu bila ada soalan. Ada minor delay, tapi urusan tetap selesai dengan baik.",
      "Pengalaman beli yang menyenangkan. Komunikasi aktif dan item mengikut detail. Satu bintang kurang sebab tunggu sikit.",
      "H4SX STORE bagus untuk beli item digital. Kalau proses lagi laju sikit, memang boleh jadi 5 bintang. 😊"
    ],
    3:[
      "Urusan okay, cuma masa proses agak lambat daripada jangkaan. Seller masih bantu sampai selesai.",
      "Item digital diterima, tapi komunikasi boleh diperkemas lagi supaya customer tak tertanya-tanya.",
      "Pengalaman sederhana. Order selesai, cuma ada beberapa bahagian yang boleh dibuat lebih smooth.",
      "Seller respond lambat sikit. Item okay, cuma harap update status order lebih kerap lepas ni.",
      "Neutral saja. Tak kecewa sangat, tapi masih ada ruang untuk improve dari segi kelajuan dan info."
    ],
    2:[
      "Agak kecewa sebab proses ambil masa lama dan update kurang jelas. Harap boleh diperbaiki.",
      "Order selesai tapi proses agak panjang. Seller ada bantu, cuma komunikasi perlu lebih kemas.",
      "Respons lambat dan status order kurang jelas. Untuk digital product, customer memang perlukan update cepat.",
      "Ada masalah dengan order tapi akhirnya settle. Belum pasti nak repeat kalau proses masih sama.",
      "Kurang puas hati. Harap H4SX ambil maklum supaya servis digital item jadi lebih pantas dan tersusun."
    ],
    1:[
      "Sangat kecewa dengan proses order kali ini. Respons lambat dan masalah tidak diterangkan dengan jelas.",
      "Pengalaman tidak memuaskan. Harap H4SX ambil serius feedback ini dan perbaiki cara handle customer.",
      "Detail produk tidak sama seperti yang saya faham semasa order. Mohon lebih jelas untuk pembeli seterusnya.",
      "Proses menyusahkan dari awal sampai akhir. Harap ada perubahan besar pada support dan update order.",
      "Satu bintang untuk pengalaman kali ini. Mohon H4SX perbaiki kualiti servis digital product segera."
    ]
  };
  function syncRatingSuggestion() {
    const rating = Math.max(1, Math.min(5, parseInt(pilihBintang.value) || 5));
    ratingSuggestionLabel.textContent = `Contoh ayat ${rating} bintang`;
    ratingSuggestionText.textContent = CONTOH_RATING[rating];
    ratingSuggestion.dataset.rating = String(rating);
  }

  function useRatingSuggestion() {
    if (suggestionTyping) return;
    const rating = Math.max(1, Math.min(5, parseInt(pilihBintang.value) || 5));
    const text = CDG_PREFIX + CONTOH_RATING[rating];
    ulasanPelanggan.value = text;
    charCounter.textContent = `${text.length} / 500`;
    reviewSuggestionUsed = true;
    ulasanPelanggan.focus();
  }

  btnBuildOwnReview.addEventListener("click", () => {
    if (suggestionTyping) return;
    const item = reviewStoryItem.value.trim();
    const time = reviewStoryTime.value.trim();
    const experience = reviewStoryExperience.value.trim();
    if (!item && !time && !experience) {
      showToast("Isi pengalaman sebenar dahulu, kemudian susun ayat.", "error");
      reviewStoryExperience.focus();
      return;
    }
    const finishSentence = value => /[.!?]$/.test(value) ? value : `${value}.`;
    const parts = [];
    if (item) parts.push(finishSentence(`Saya beli ${item}`));
    if (time) parts.push(finishSentence(`Proses mengambil masa ${time}`));
    if (experience) parts.push(finishSentence(experience));
    ulasanPelanggan.value = parts.join(" ").slice(0, 500);
    reviewSuggestionUsed = false;
    charCounter.textContent = `${ulasanPelanggan.value.length} / 500`;
    charCounter.classList.toggle("warn", ulasanPelanggan.value.length > 450);
    ulasanPelanggan.focus();
  });

  pilihBintang.addEventListener("change", syncRatingSuggestion);
  btnUseRatingSuggestion.addEventListener("click", useRatingSuggestion);
  syncRatingSuggestion();

  let lastDaduIdx = -1;
  let suggestionTyping = false;
  btnDadu.addEventListener("click", () => {
    if (suggestionTyping) return;
    const rating = parseInt(pilihBintang.value)||5;
    const pool   = CADANGAN[rating] || CADANGAN[5];
    let idx;
    do { idx = Math.floor(Math.random()*pool.length); } while (idx===lastDaduIdx && pool.length>1);
    lastDaduIdx = idx;
    const teks = CDG_PREFIX + pool[idx];
    reviewSuggestionUsed = true;
    ulasanPelanggan.value = ""; charCounter.textContent = "0 / 500";
    suggestionTyping = true;
    btnDadu.disabled = true;
    btnUseRatingSuggestion.disabled = true;
    btnBuildOwnReview.disabled = true;
    pilihBintang.disabled = true;
    butangHantar.disabled = true;
    ulasanPelanggan.readOnly = true;
    ulasanPelanggan.setAttribute("aria-busy", "true");
    let i = 0;
    const iv = setInterval(()=>{
      i = Math.min(i + 1, teks.length);
      ulasanPelanggan.value = teks.slice(0, i);
      charCounter.textContent = `${i} / 500`;
      charCounter.classList.toggle("warn", i > 450);
      if (i === teks.length) {
        clearInterval(iv);
        suggestionTyping = false;
        btnDadu.disabled = false;
        btnUseRatingSuggestion.disabled = false;
        btnBuildOwnReview.disabled = false;
        pilihBintang.disabled = false;
        butangHantar.disabled = false;
        ulasanPelanggan.readOnly = false;
        ulasanPelanggan.removeAttribute("aria-busy");
        ulasanPelanggan.focus();
      }
    }, 16);
    const d = btnDadu.querySelector(".dice-icon");
    d.style.transform="rotate(360deg) scale(1.3)";
    setTimeout(()=>d.style.transform="",420);
  });

  ulasanPelanggan.addEventListener("input", ()=>{
    const l = ulasanPelanggan.value.length;
    charCounter.textContent = `${l} / 500`;
    charCounter.classList.toggle("warn", l>450);
    if (!ulasanPelanggan.value.trim()) reviewSuggestionUsed = false;
  });

  // ── Submit ────────────────────────────────────────────────────
  butangHantar.addEventListener("click", async () => {
    const kod    = kodVerification.value.trim().toUpperCase();
    const nama   = namaPelanggan.value.trim();
    const bintang = parseInt(pilihBintang.value);
    let ulasan = ulasanPelanggan.value.trim();

    if (!kod)  return showToast("Sila masukkan Kod Pengesahan.", "error");
    if (!nama) return showToast("Sila isi nama atau username.", "error");
    if (isBlockedReviewName(nama)) {
      return showToast("Nama ini tidak dibenarkan. Sila guna nama yang sopan.", "error");
    }
    if (ulasan && ulasan.length < 1) {
      return showToast("Ulasan mesti sekurang-kurangnya 10 aksara, atau kosongkan untuk rating sahaja.", "error");
    }
    const gunaCadangan = reviewSuggestionUsed || /^cdg\s*[-:]/i.test(ulasan);
    if (gunaCadangan && ulasan && !/^cdg\s*[-:]/i.test(ulasan)) {
      ulasan = (CDG_PREFIX + ulasan).slice(0, 500);
    }
    
    // Block nama yang mengandungi "h4sx" jika bukan admin
    const namaLower = nama.toLowerCase();
    if (namaLower.includes("h4sx") && !adminOk()) {
      return showToast("Nama ini dikhaskan untuk admin H4SX STORE sahaja.", "error");
    }

    butangHantar.disabled = true;
    butangHantar.textContent = "Menghantar...";
    try {
      await verifyReviewTurnstile();
      const codeSnap = await getDoc(doc(db,"review_codes",kod));
      if (!codeSnap.exists()) {
        showToast("Kod pengesahan tidak sah atau telah digunakan.", "error"); 
        butangHantar.disabled = false; butangHantar.innerHTML = 'Hantar Ulasan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
        return;
      }
      
      // Hantar field asas sahaja masa pelanggan submit.
      // Firestore rules public biasanya tolak field tambahan semasa create.
      const dataToSave = {
        nama: nama, 
        bintang: bintang, 
        ulasan: ulasan || "Tiada ulasan ditinggalkan.",
        diciptaPada: serverTimestamp()
      };
      if (pilihanWarna) dataToSave.warnaProfil = pilihanWarna;
      if (pilihanEmoji) dataToSave.emojiProfil = pilihanEmoji;
      if (profileImgB64) dataToSave.profileImg = profileImgB64;
      if (feedbackImgB64) dataToSave.feedbackImg = feedbackImgB64;
      console.log("Data yang cuba disimpan:", dataToSave);
      
      const reviewRef = doc(db,"ratings","review_" + kod);
      const existingReview = await getDoc(reviewRef);
      if (existingReview.exists()) {
        showToast("Kod pengesahan ini telah digunakan.", "error");
        butangHantar.disabled = false; butangHantar.innerHTML = 'Hantar Ulasan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
        return;
      }
      await setDoc(reviewRef, dataToSave);
      if (adminOk() && document.getElementById("adminOfficialReview").checked) {
        try {
          await updateDoc(reviewRef, { adminAuthorUid:currentUser.uid, adminIdentityConfirmed:true });
        } catch (adminMarkError) {
          console.warn('Penanda logo admin tidak dapat disimpan:', adminMarkError);
        }
      }
      try {
        await deleteDoc(doc(db,"review_codes",kod));
      } catch (codeDeleteError) {
        // The current rules reserve code deletion for admins. The stable document ID above
        // blocks a second review from this code even when the cleanup is denied.
        console.warn("Kod review perlu dibersihkan oleh admin:", codeDeleteError);
      }

      // ── Auto-reply "terima kasih" untuk setiap ulasan baru ──────
      // Nota: rules 'create' sengaja block balasanAdmin (kena null semasa create),
      // jadi auto-reply ni kena dihantar sebagai 'update' selepas create berjaya —
      // sah ikut rules 'update' sebab nama/bintang/ulasan/diciptaPada tak diubah.
      try {
        if (await autoReplyEnabledForNewReview(reviewRef)) {
          await updateDoc(reviewRef, {
            balasanAdmin: buildAutoReply(nama),
            balasanPada: serverTimestamp()
          });
        }
      } catch(errBalasan) {
        console.error("Auto-reply gagal (ulasan tetap tersimpan):", errBalasan);
      }
      if (gunaCadangan) {
        try {
          await updateDoc(reviewRef, {
            cdg: true,
            cadanganDigunakan: true
          });
        } catch(errCdg) {
          console.warn("Flag cdg gagal disimpan, prefix cdg masih ada dalam teks ulasan:", errCdg);
        }
      }

      // Reset
      kodVerification.value = namaPelanggan.value = ulasanPelanggan.value = "";
      document.getElementById("adminOfficialReview").checked = false;
      reviewStoryItem.value = reviewStoryTime.value = reviewStoryExperience.value = "";
      pilihBintang.value = "5";
      reviewSuggestionUsed = false;
      pilihanWarna = pilihanEmoji = null;
      document.querySelectorAll(".swatch,.emoji-opt").forEach(el=>el.classList.remove("active"));
      clearProfileImg(false); clearFeedbackImage(false); charCounter.textContent = "0 / 500"; updatePreview();

      showToast("Ulasan berjaya dihantar! Terima kasih. 🙏", "success");
      setMobileReviewTab("reviews", true);
    } catch(err) {
      console.error("Ralat Firebase (Details):", err.code, err.message, err);
      if (String(err?.message || '').startsWith('turnstile-')) {
        showToast("Pengesahan keselamatan gagal. Cuba tekan Hantar Ulasan sekali lagi.", "error");
        return;
      }
      // Papar sebab sebenar terus dalam toast supaya senang debug tanpa F12
      const sebab = err.code ? `(${err.code})` : (err.message || "");
      showToast(`Gagal hantar ulasan ${sebab}. Cuba lagi.`, "error");
    } finally {
      butangHantar.disabled = false; butangHantar.innerHTML = 'Hantar Ulasan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
    }
  });

  // ── Admin reply ───────────────────────────────────────────────
  async function hantarBalasan(id, teks, btn) {
    if (!teks.trim()) { showToast("Taip balasan dahulu.", "error"); return; }
    btn.disabled=true; btn.textContent="Menghantar...";
    try {
      await updateDoc(doc(db,"ratings",id), { balasanAdmin:teks.trim(), balasanPada:serverTimestamp(), balasanDibuang:false });
      showToast("Balasan berjaya dikemaskini.", "success");
    } catch(err) {
      console.error(err); showToast("Gagal hantar balasan.", "error");
    } finally { btn.disabled=false; btn.textContent="Hantar Balasan"; }
  }

  async function simpanEditUlasan(id, teks, btn, dataDoc) {
    const ulasanBaru = teks.trim();
    if (ulasanBaru.length < 3) {
      showToast("Ulasan terlalu pendek.", "error");
      return;
    }
    if (ulasanBaru.length > 500) {
      showToast("Ulasan terlalu panjang. Maksimum 500 aksara.", "error");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    try {
      const payload = { ulasan: ulasanBaru, ulasanDieditPada: serverTimestamp() };
      if (reviewAdminSettings.autoReply !== false && reviewAllowsAutoReply(dataDoc)) {
        payload.balasanAdmin = buildAutoReply(dataDoc.nama);
        payload.balasanPada = serverTimestamp();
      }
      await updateDoc(doc(db,"ratings",id), payload);
      showToast("Ulasan pelanggan berjaya diedit.", "success");
    } catch(err) {
      console.error(err);
      showToast("Gagal edit ulasan. Pastikan rules admin benarkan update.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Simpan Ulasan";
    }
  }
  function timestampToDatetimeLocal(ts) {
    const date = ts?.toDate ? ts.toDate() : new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  async function simpanEditMasa(id, value, btn, dataDoc) {
    if (!value) {
      showToast("Pilih tarikh dan masa dahulu.", "error");
      return;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      showToast("Tarikh atau masa tidak sah.", "error");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Menyimpan...";
    try {
      const payload = { diciptaPada: Timestamp.fromDate(date), masaDieditPada: serverTimestamp() };
      if (reviewAdminSettings.autoReply !== false && reviewAllowsAutoReply(dataDoc)) {
        payload.balasanAdmin = buildAutoReply(dataDoc.nama);
        payload.balasanPada = serverTimestamp();
      }
      await updateDoc(doc(db,"ratings",id), payload);
      showToast("Tarikh dan masa review berjaya diedit.", "success");
    } catch(err) {
      console.error(err);
      showToast("Gagal edit masa. Semak rules admin update ratings.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Simpan Masa";
    }
  }

  // ── Filter & sort ─────────────────────────────────────────────
  let filterStar="all", sortMode="newest", reviewSearchTerm="", allDocs=[];
  const mobileReviewMedia = window.matchMedia("(max-width: 600px)");
  const btnMoreReviews = document.getElementById("btnMoreReviews");
  let mobileReviewLimit = 12;
  let directReviewFocusHandled = false;
  function reviewRecordTime(value) {
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    const time = new Date(value || "").getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function relativeReviewTime(value) {
    const time = typeof value === 'number' ? value : reviewRecordTime(value);
    if (!time) return 'Baru sahaja';
    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (seconds < 60) return 'Baru sahaja';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minit yang lalu`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam yang lalu`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} hari yang lalu`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} bulan yang lalu`;
    return `${Math.floor(seconds / 31536000)} tahun yang lalu`;
  }

  function reviewDateAndAge(value, includeTime = true) {
    const time = reviewRecordTime(value);
    if (!time) return 'Baru sahaja';
    const date = new Date(time);
    const absolute = date.toLocaleString('ms-MY', includeTime
      ? { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true }
      : { day:'numeric', month:'short', year:'numeric' });
    return `${absolute} - ${relativeReviewTime(time)}`;
  }

  function refreshRelativeReviewTimes() {
    document.querySelectorAll('[data-review-time]').forEach(element => {
      const time = Number(element.dataset.reviewTime || 0);
      if (time) element.textContent = reviewDateAndAge(time);
    });
  }
  setInterval(refreshRelativeReviewTimes, 60000);

  async function setReviewVisibility(id, field, hidden, button) {
    if (!mintaAdmin() || !['hidePinLabel', 'hideReviewTime'].includes(field)) return;
    button.disabled = true;
    try {
      await updateDoc(doc(db, 'ratings', id), { [field]: hidden });
      showToast(field === 'hidePinLabel' ? (hidden ? 'Label Pin disorok. Kedudukan semat kekal.' : 'Label Pin ditunjukkan.') : (hidden ? 'Tarikh dan masa disorok.' : 'Tarikh dan masa ditunjukkan.'), 'success');
    } catch (error) {
      console.error('Tetapan paparan ulasan gagal:', error);
      showToast('Tetapan gagal disimpan. Cuba lagi.', 'error');
    } finally { button.disabled = false; }
  }

  async function padamBalasanAdmin(id, nama, btn) {
    if (!mintaAdmin()) return;
    if (!confirm(`Padam balasan admin untuk ulasan "${nama}"? Ulasan pelanggan tidak akan dipadam.`)) return;
    const asalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Memadam...";
    try {
      await updateDoc(doc(db, "ratings", id), {
        balasanAdmin: deleteField(),
        balasanPada: deleteField(),
        balasanDibuang: true
      });
      showToast("Balasan admin berjaya dipadam.", "success");
    } catch (err) {
      console.error(err);
      showToast("Gagal padam balasan admin. Semak Firebase Rules.", "error");
      btn.disabled = false;
      btn.textContent = asalText;
    }
  }
  function uniqueReviewRecords(list = []) {
    const seen = new Set();
    return list.filter(data => {
      const time = reviewRecordTime(data.diciptaPada || data.timestamp || data.date);
      // Exact copies created in the same minute are treated as one review.
      if (!time) return true;
      const key = [
        String(data.nama || "").trim().toLowerCase(),
        clampBintang(data.bintang),
        String(data.ulasan || "").trim().toLowerCase(),
        Math.floor(time / 60000)
      ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function focusDirectReview() {
    if (directReviewFocusHandled) return;
    const reviewId = new URLSearchParams(window.location.search).get("reviewId");
    if (!reviewId) return;
    const card = [...kotakPaparan.querySelectorAll('[data-review-id]')]
      .find(item => item.dataset.reviewId === reviewId);
    if (!card) return;
    directReviewFocusHandled = true;
    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior:"smooth", block:"center" });
      card.classList.add("is-direct-link");
      const replyButton = card.querySelector(".admin-reply-view-toggle");
      if (replyButton?.getAttribute("aria-expanded") !== "true") replyButton?.click();
      setTimeout(() => card.classList.remove("is-direct-link"), 1900);
    });
  }
  document.querySelectorAll(".filter-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active"); filterStar=btn.dataset.filter; mobileReviewLimit=12; renderReviews();
    });
  });
  sortSelect.addEventListener("change",()=>{ sortMode=sortSelect.value; mobileReviewLimit=12; renderReviews(); });
  reviewSearchInput?.addEventListener("input", () => {
    reviewSearchTerm = reviewSearchInput.value.trim().toLocaleLowerCase("ms");
    if (btnClearReviewSearch) btnClearReviewSearch.hidden = !reviewSearchTerm;
    mobileReviewLimit = 12;
    renderReviews();
  });
  btnClearReviewSearch?.addEventListener("click", () => {
    reviewSearchInput.value = "";
    reviewSearchTerm = "";
    btnClearReviewSearch.hidden = true;
    reviewSearchInput.focus();
    mobileReviewLimit = 12;
    renderReviews();
  });
  btnMoreReviews?.addEventListener("click", () => {
    mobileReviewLimit += 12;
    renderReviews();
  });
  mobileReviewMedia.addEventListener("change", renderReviews);

  // Selamatkan diri drpd data rosak/prank (cth: bintang disave sbg 999 terus
  // dari Firebase console) — sentiasa clamp ke julat sah 0–5 sebelum digunakan.
  function clampBintang(n) {
    n = parseInt(n) || 0;
    if (n < 0) return 0;
    if (n > 5) return 5;
    return n;
  }

  // ── Live snapshot ─────────────────────────────────────────────
  const q = query(collection(db,"ratings"), orderBy("diciptaPada","desc"));
  onSnapshot(q, snapshot=>{
    allDocs=[];
    let total=0, count=0, lima=0;
    snapshot.forEach(d=>{
      const data = { id:d.id, ...d.data() };
      allDocs.push(data);
      const b = clampBintang(d.data().bintang);
      total+=b; count++;
      if (b===5) lima++;
    });
    syncUsedReviewCodeIds(allDocs);
    allDocs = uniqueReviewRecords(allDocs);
    if (latestCodeSnapshot) {
      renderCodeListFromSnapshot(latestCodeSnapshot);
      renderAdminCodes();
      cleanupUsedReviewCodes(latestCodeSnapshot);
    }
    const publicRecords = allDocs.filter(item => !['hidden','rejected'].includes(String(item.moderationStatus || 'published')));
    const ratedRecords = publicRecords.filter(item => item.hideRating !== true);
    total = ratedRecords.reduce((sum, item) => sum + clampBintang(item.bintang), 0);
    count = ratedRecords.length;
    lima = ratedRecords.filter(item => clampBintang(item.bintang) === 5).length;
    if (count===0) {
      purataSkor.textContent="0.0"; purataBintang.textContent="☆☆☆☆☆";
      jumlahUlasanVal.textContent=String(publicRecords.length); pctLima.textContent="—";
    } else {
      const avg=(total/count).toFixed(1);
      purataSkor.textContent=avg;
      const r=clampBintang(Math.round(parseFloat(avg)));
      purataBintang.textContent="★".repeat(r)+"☆".repeat(5-r);
      jumlahUlasanVal.textContent=String(publicRecords.length);
      pctLima.textContent=Math.round((lima/count)*100)+"%";
    }
    renderReviews();
    refreshAdminCenter();
    handleLowRatingAlerts(allDocs.filter(item => item.hideRating !== true));
  });

  // ── Render ────────────────────────────────────────────────────
  function getCurrentReviewList() {
    let list=[...allDocs].filter(data => !["hidden", "rejected"].includes(String(data.moderationStatus || "published")));
    if (filterStar!=="all") {
      list = list.filter(data => data.hideRating !== true);
      list = filterStar==="12" ? list.filter(d=>clampBintang(d.bintang)<=2) : list.filter(d=>clampBintang(d.bintang)===parseInt(filterStar));
    }
    if (reviewSearchTerm) {
      list = list.filter(data => [
        data.nama,
        data.ulasan,
        data.balasanAdmin,
        data.badgeText,
        data.medalText
      ].some(value => String(value || "").toLocaleLowerCase("ms").includes(reviewSearchTerm)));
    }
    if (sortMode==="highest") list.sort((a,b)=>clampBintang(b.bintang)-clampBintang(a.bintang));
    else if (sortMode==="lowest") list.sort((a,b)=>clampBintang(a.bintang)-clampBintang(b.bintang));

    // Ulasan yang di-pin sentiasa naik ke atas (pin terbaru dulu),
    // ikutan yang lain kekal ikut sortMode yang dipilih.
    const dipin = list.filter(d=>d.pinned===true)
      .sort((a,b)=>(b.pinnedAt?.toMillis?.()||0)-(a.pinnedAt?.toMillis?.()||0));
    const pilihan = list.filter(d=>d.pinned!==true && d.featured===true)
      .sort((a,b)=>(b.featuredAt?.toMillis?.()||0)-(a.featuredAt?.toMillis?.()||0));
    const takDipin = list.filter(d=>d.pinned!==true && d.featured!==true);
    list = [...dipin, ...pilihan, ...takDipin];
    return list;
  }

  function renderReviews() {
    const list = getCurrentReviewList();
    if (mobileReviewMedia.matches && !directReviewFocusHandled) {
      const directId = new URLSearchParams(window.location.search).get("reviewId");
      const directIndex = list.findIndex(item => item.id === directId);
      if (directIndex >= 0) mobileReviewLimit = Math.max(mobileReviewLimit, directIndex + 1);
    }
    const visibleList = mobileReviewMedia.matches ? list.slice(0, mobileReviewLimit) : list;
    if (btnMoreReviews) {
      const remaining = list.length - visibleList.length;
      btnMoreReviews.hidden = remaining <= 0;
      btnMoreReviews.textContent = `Lihat lagi ${Math.min(12, remaining)} ulasan (${remaining} berbaki)`;
    }

    if (reviewResultCount) {
      const totalPublished = allDocs.filter(data => !["hidden", "rejected"].includes(String(data.moderationStatus || "published"))).length;
      reviewResultCount.textContent = reviewSearchTerm || filterStar !== "all"
        ? `${list.length} daripada ${totalPublished} ulasan`
        : `${list.length} ulasan`;
      if (mobileReviewMedia.matches && visibleList.length < list.length) {
        reviewResultCount.textContent += ` · ${visibleList.length} dipaparkan`;
      }
    }

    kotakPaparan.innerHTML="";
    if (!list.length) {
      kotakPaparan.innerHTML=`<div class="no-reviews"><span class="no-icon">🔍</span><span>${reviewSearchTerm ? "Tiada ulasan sepadan dengan carian anda." : "Tiada ulasan untuk penapis ini."}</span></div>`;
      return;
    }

    visibleList.forEach((data,i)=>{
      const id=data.id, score=clampBintang(data.bintang);
      const rawBintang=parseInt(data.bintang)||0;
      const rawNama=data.nama||"Pelanggan Misteri";
      let namaDisorok=rawNama;
      
      // Semak adakah ini admin yang post ulasan
      const officialAdminReview = isOfficialAdminReview(data);
      const isReviewAdmin = officialAdminReview || rawNama.toLowerCase().includes("h4sx");
      
      if (rawNama!=="Pelanggan Misteri" && !isReviewAdmin) {
        // Jangan sensor kalau tak perlu, tapi sebab tadi awak cakap "jngn bgi sensor untuk nama tu",
        // saya akan matikan sistem bintang-bintang nama (sensor) sepenuhnya untuk semua orang
        // ATAU hanya untuk admin? Saya akan matikan sensor untuk semua orang mengikut arahan "jngn bgi sensor untuk nama tu"
        namaDisorok = rawNama;
      }
      
      const warna=data.warnaProfil||warnaAuto(rawNama);
      const hasImg=officialAdminReview || !!(data.profileImg);
      const avatarIsi=data.emojiProfil||rawNama.charAt(0).toUpperCase();
      const adaBalasan=!!(data.balasanAdmin?.trim());
      const adaUlasan = !!(data.ulasan?.trim()) && data.ulasan !== "Tiada ulasan ditinggalkan.";
      const gunaCadangan = data.cdg === true || data.cadanganDigunakan === true || /^cdg\s*[-:]/i.test(String(data.ulasan || "").trim());
      const adaFeedbackImg = !!(data.feedbackImg);
      const gunaTextToggle = adaUlasan && data.reviewTextCollapsed === true;
      const textMulaBuka = data.reviewTextDefaultOpen === true;
      const textLines = Math.min(6, Math.max(2, parseInt(data.reviewTextLines) || 4));
      const expandLabel = data.reviewExpandLabel || "Lihat lagi ↓";
      const collapseLabel = data.reviewCollapseLabel || "Tutup ↑";
      const toggleColor = warnaHexSah(data.reviewToggleColor, "#2fa8e0");

      const reviewTime = reviewRecordTime(data.diciptaPada || data.timestamp || data.date);
      let masa = reviewAdminSettings.showRelativeTime === false ? reviewDateText(data) : reviewDateAndAge(reviewTime);
      let masaBalasan="";
      if (data.balasanPada) masaBalasan=reviewAdminSettings.showRelativeTime === false ? reviewDateAndAge(data.balasanPada, false) : reviewDateAndAge(data.balasanPada);

      const starHtml=Array.from({length:5},(_,si)=>`<span style="color:${si<score?"#f0a500":"#cde"}">${si<score?"★":"☆"}</span>`).join("");
      const avatarLoading = i < 2 ? "eager" : "lazy";
      const avatarInner=officialAdminReview
        ? `<img src="${H4SX_LOGO_URL}" alt="H4SX Admin" loading="${avatarLoading}" decoding="async"><span class="admin-avatar-shield" aria-label="Admin rasmi"><i class="fa-solid fa-shield-halved"></i></span>`
        : hasImg ? `<img src="${escapeHtml(data.profileImg)}" alt="" loading="${avatarLoading}" decoding="async">` : escapeHtml(avatarIsi);
      
      const customBadgeStyle = badgeStyle(data);
      const customBadgeClass = "verified-badge custom-badge" + (data.badgeAnimated === false && data.badgeRainbow !== true ? "" : " is-animated") + (data.badgeRainbow === true ? " is-rainbow" : "");
      const verifiedTag = data.badgeText?.trim()
        ? `<span class="${customBadgeClass}" style="${customBadgeStyle}">${reviewEmojiMarkup(data.badgeEmoji)}${escapeHtml(data.badgeText)}</span>`
        : isReviewAdmin 
          ? `<span class="verified-badge custom-badge is-animated" style="${badgeStyle({ badgeColor:'#2fa8e0', badgeColor2:'#0f2a45', badgeTextColor:'#ffffff', badgeGlowColor:'#2fa8e0', badgeGradient:true })}">ADMIN RASMI</span>` 
          : data.hideVerifiedBadge === true ? "" : `<span class="verified-badge">Verified</span>`;

      const card=document.createElement("div");
      card.className="review-card"+(data.pinned===true && data.hidePinLabel!==true?" is-pinned":"")+(data.featured===true?" is-featured":"");
      card.dataset.reviewId = id;
      card.style.animationDelay=`${i*36}ms`;
      card.innerHTML=`
        <div class="avatar${hasImg ? " has-profile-image" : ""}${officialAdminReview ? " is-official-admin" : ""}" style="background:${warna}">${avatarInner}</div>
        <div class="review-content">
          <div class="review-header">
            <div class="buyer-name-container">
              ${data.featured===true?`<span class="featured-review-badge">Pilihan H4SX</span>`:""}
              ${data.pinned===true && data.hidePinLabel!==true?`<span class="pin-badge">📌 Disematkan</span>`:""}
              <span class="${nameClass(data)}" style="${nameStyle(data, isReviewAdmin)}">${reviewEmojiMarkup(data.nameEmoji)}${escapeHtml(namaDisorok)}</span>
              ${medalMarkup(data)}
              ${data.hideRating!==true && (rawBintang<0||rawBintang>5)?`<span style="background:linear-gradient(90deg,#f0a500,#e05252);color:#fff;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:10px;letter-spacing:.3px;">${rawBintang} Bintang</span>`:""}
              ${verifiedTag}
              ${customCheckMarkup(data)}
              ${gunaCadangan?`<span class="suggestion-badge">cdg</span>`:""}
            </div>
            ${data.hideRating===true ? "" : `<div class="star-display">${starHtml}</div>`}
          </div>
          ${data.hideReviewTime===true ? "" : `<div class="buyer-time" data-review-time="${reviewTime}">${masa}</div>`}
          ${adaUlasan
            ?`<p class="buyer-feedback${gunaTextToggle && !textMulaBuka ? " is-collapsed" : ""}" style="--review-lines:${textLines};">${formatMessageText(data.ulasan)}</p>
              ${gunaTextToggle ? `<button class="review-text-toggle" type="button" style="--toggle-color:${toggleColor};" data-open="${textMulaBuka ? "1" : "0"}" data-expand="${escapeHtml(expandLabel)}" data-collapse="${escapeHtml(collapseLabel)}">${escapeHtml(textMulaBuka ? collapseLabel : expandLabel)}</button>` : ""}`
            :`<p class="buyer-no-text">— Tiada ulasan teks —</p>`}
          <div class="admin-review-edit-form" data-nosnippet>
            <textarea maxlength="500" placeholder="Edit ulasan pelanggan...">${escapeHtml(data.ulasan || "")}</textarea>
            <div class="admin-reply-form-actions">
              <button class="btn-simpan-edit-ulasan">Simpan Ulasan</button>
              <button class="btn-batal-edit-ulasan">Batal</button>
            </div>
          </div>
          <div class="admin-time-edit-form" data-nosnippet>
            <input type="datetime-local" value="${escapeHtml(timestampToDatetimeLocal(data.diciptaPada))}">
            <div class="admin-reply-form-actions">
            <button type="button" class="btn-toggle-review-time admin-action-btn" title="Tunjuk atau sorok tarikh dan masa ulasan serta balasan">${data.hideReviewTime===true?"Tunjuk tarikh/masa":"Sorok tarikh/masa"}</button>
              <button class="btn-simpan-edit-masa">Simpan Masa</button>
              <button class="btn-batal-edit-masa">Batal</button>
            </div>
          </div>
          <div class="admin-time-edit-form admin-pin-controls" data-nosnippet>
            <strong>Tetapan semat</strong>
            <div class="admin-reply-form-actions">
            <button class="btn-pin-ulasan admin-action-btn admin-action-pin${data.pinned===true?" is-active":""}" title="Semat ulasan">${data.pinned===true?"Unpin":"Pin"}</button>
            <button type="button" class="btn-toggle-pin-label admin-action-btn" title="Sorok label dan hiasan pin tanpa membuang sematan">${data.hidePinLabel===true?"Tunjuk label Pin":"Sorok label Pin"}</button>
              <button type="button" class="btn-close-pin-controls">Tutup</button>
            </div>
          </div>
          ${adaFeedbackImg?`<button class="btn-see-feedback" type="button">See image</button>`:""}
          <button class="review-report-btn" type="button" data-nosnippet><i class="fa-regular fa-flag"></i> Lapor</button>
          ${adaBalasan?`
          <button class="admin-reply-view-toggle" type="button" aria-expanded="false">Balasan admin ↓</button>
          <div class="admin-reply-box">
            <div class="admin-reply-header">
              <span class="admin-reply-identity"><img src="https://i.imgur.com/cLPulXQ.png" class="admin-reply-avatar" alt="Logo H4SX STORE" loading="lazy" decoding="async"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></span>
              <div class="admin-reply-heading">
                <span class="admin-reply-kicker">JAWAPAN RASMI</span>
                <p class="admin-reply-label">H4SX STORE</p>
              </div>
            </div>
            <p class="admin-reply-text">${formatMessageText(data.balasanAdmin)}</p>
            <div class="admin-reply-footer">
              ${data.hideReviewTime===true ? "" : `<p class="admin-reply-time"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${masaBalasan || "Balasan H4SX"}</p>`}
              <button class="admin-reply-copy" type="button" aria-label="Salin balasan H4SX"><i class="fa-regular fa-copy" aria-hidden="true"></i> Salin</button>
            </div>
          </div>`:""}
          <div class="admin-reply-form-actions" style="margin-top:6px;${adminOk()?"":"display:none;"}" data-admin-ctrl-row data-nosnippet>
            <button class="reply-toggle-btn admin-action-btn admin-action-edit" title="Edit balasan">${adaBalasan?"Edit":"Balas"}</button>
            ${adaBalasan ? `<button class="btn-padam-balasan admin-action-btn admin-action-reply-delete" type="button" title="Padam balasan admin sahaja">Padam Balasan</button>` : ""}
            <button class="btn-edit-ulasan admin-action-btn admin-action-review" title="Edit ulasan pelanggan">Edit Ulasan</button>
            <button class="btn-edit-masa admin-action-btn admin-action-time" title="Edit tarikh masa">Masa</button>
            <button class="btn-profile-ulasan admin-action-btn admin-action-profile" title="Edit nama, profil dan pingat">Profile</button>
            <button type="button" class="btn-open-pin-controls admin-action-btn admin-action-pin${data.pinned===true?" is-active":""}" title="Tetapan semat dan label pin" aria-expanded="false">Pin</button>
            <button class="btn-badge-ulasan admin-action-btn admin-action-badge" title="Edit role dan custom centang">Role ✓</button>
            <button class="btn-padam-ulasan admin-action-btn admin-action-delete" type="button" title="Padam ulasan secara kekal" aria-label="Padam ulasan">Padam</button>
          </div>
          <div class="admin-reply-form" data-nosnippet>
            <label class="badge-switch"><input class="review-auto-reply-toggle" type="checkbox" ${data.autoReplyDisabled!==true?"checked":""}> Auto balas untuk ulasan ini</label>
            <small>Suis utama auto balas mesti ON. Balasan manual masih boleh dihantar.</small>
            <textarea maxlength="400" placeholder="Taip balasan rasmi H4SX STORE...">${adaBalasan?escapeHtml(data.balasanAdmin):""}</textarea>
            <div class="admin-reply-form-actions">
              <button class="btn-hantar-balasan">Hantar Balasan</button>
              <button class="btn-batal-balasan">Batal</button>
            </div>
          </div>
        </div>`;
      kotakPaparan.appendChild(card);

      const form=card.querySelector(".admin-reply-form");
      const ta=form.querySelector("textarea");
      const autoReplyToggle = form.querySelector('.review-auto-reply-toggle');
      autoReplyToggle.addEventListener('change', async () => {
        if (!mintaAdmin()) { autoReplyToggle.checked = data.autoReplyDisabled !== true; return; }
        const disabled = !autoReplyToggle.checked;
        autoReplyToggle.disabled = true;
        try {
          await updateDoc(doc(db, 'ratings', id), { autoReplyDisabled:disabled });
          showToast(disabled ? 'Auto balas dimatikan untuk ulasan ini.' : 'Auto balas dibenarkan untuk ulasan ini.', 'success');
        } catch (error) {
          autoReplyToggle.checked = data.autoReplyDisabled !== true;
          console.error('Tetapan auto balas ulasan gagal:', error);
          showToast('Tetapan auto balas gagal disimpan.', 'error');
        } finally { autoReplyToggle.disabled = false; }
      });
      const btnH=form.querySelector(".btn-hantar-balasan");
      const btnB=form.querySelector(".btn-batal-balasan");
      const toggleB=card.querySelector(".reply-toggle-btn");
      const btnPadamBalasan=card.querySelector(".btn-padam-balasan");
      const editReviewForm=card.querySelector(".admin-review-edit-form");
      const editReviewTa=editReviewForm.querySelector("textarea");
      const btnEditReview=card.querySelector(".btn-edit-ulasan");
      const btnSaveEditReview=card.querySelector(".btn-simpan-edit-ulasan");
      const btnCancelEditReview=card.querySelector(".btn-batal-edit-ulasan");
      const editTimeForm=card.querySelector(".admin-time-edit-form");
      const editTimeInput=editTimeForm.querySelector("input");
      const btnEditTime=card.querySelector(".btn-edit-masa");
      const btnSaveEditTime=card.querySelector(".btn-simpan-edit-masa");
      const btnCancelEditTime=card.querySelector(".btn-batal-edit-masa");
      const btnPadam=card.querySelector(".btn-padam-ulasan");
      const btnPin=card.querySelector(".btn-pin-ulasan");
      const pinControls = card.querySelector('.admin-pin-controls');
      const pinMenuButton = card.querySelector('.btn-open-pin-controls');
      pinMenuButton.addEventListener('click', () => {
        if (!mintaAdmin()) return;
        pinControls.classList.toggle('show');
        editTimeForm.classList.remove('show');
        pinMenuButton.setAttribute('aria-expanded', String(pinControls.classList.contains('show')));
      });
      card.querySelector('.btn-close-pin-controls').addEventListener('click', () => {
        pinControls.classList.remove('show');
        pinMenuButton.setAttribute('aria-expanded', 'false');
      });
      const btnProfile=card.querySelector(".btn-profile-ulasan");
      const btnBadge=card.querySelector(".btn-badge-ulasan");
      const btnSeeFeedback=card.querySelector(".btn-see-feedback");
      const btnReplyView=card.querySelector(".admin-reply-view-toggle");
      const btnCopyReply=card.querySelector(".admin-reply-copy");
      const btnTextToggle=card.querySelector(".review-text-toggle");
      const btnReport=card.querySelector(".review-report-btn");
      if (btnTextToggle) {
        const feedbackText = card.querySelector(".buyer-feedback");
        btnTextToggle.addEventListener("click", () => {
          const open = btnTextToggle.dataset.open !== "1";
          btnTextToggle.dataset.open = open ? "1" : "0";
          feedbackText.classList.toggle("is-collapsed", !open);
          btnTextToggle.textContent = open ? btnTextToggle.dataset.collapse : btnTextToggle.dataset.expand;
          btnTextToggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
      }
      if (btnSeeFeedback) btnSeeFeedback.addEventListener("click", () => openFeedbackImage(data.feedbackImg));
      if (btnReplyView) {
        const replyBox = card.querySelector(".admin-reply-box");
        btnReplyView.addEventListener("click", () => {
          const open = replyBox.classList.toggle("show");
          btnReplyView.setAttribute("aria-expanded", open ? "true" : "false");
          btnReplyView.textContent = open ? "Tutup balasan ↑" : "Balasan admin ↓";
        });
      }
      btnCopyReply?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(String(data.balasanAdmin || ""));
          showToast("Balasan H4SX disalin.", "success");
        } catch (error) {
          showToast("Tak dapat salin balasan. Cuba lagi.", "error");
        }
      });
      btnReport?.addEventListener("click",()=>openReviewReport(id, rawNama, btnReport));
      toggleB.addEventListener("click",()=>{
        if(!mintaAdmin())return;
        form.classList.toggle("show");
        if(form.classList.contains("show")) {
          if (!ta.value.trim()) ta.value = getAdminReplyTemplate(score, rawNama);
          ta.focus();
        }
      });
      btnB.addEventListener("click",()=>form.classList.remove("show"));
      btnH.addEventListener("click",()=>hantarBalasan(id,ta.value,btnH));
      btnPadamBalasan?.addEventListener("click",()=>padamBalasanAdmin(id, rawNama, btnPadamBalasan));
      btnEditReview.addEventListener("click",()=>{
        if(!mintaAdmin())return;
        editReviewForm.classList.toggle("show");
        if(editReviewForm.classList.contains("show")) editReviewTa.focus();
      });
      btnCancelEditReview.addEventListener("click",()=>editReviewForm.classList.remove("show"));
      btnSaveEditReview.addEventListener("click",()=>simpanEditUlasan(id, editReviewTa.value, btnSaveEditReview, data));
      btnEditTime.addEventListener("click",()=>{
        if(!mintaAdmin())return;
        pinControls.classList.remove("show");
        pinMenuButton.setAttribute("aria-expanded", "false");
        editTimeForm.classList.toggle("show");
        if(editTimeForm.classList.contains("show")) editTimeInput.focus();
      });
      btnCancelEditTime.addEventListener("click",()=>editTimeForm.classList.remove("show"));
      btnSaveEditTime.addEventListener("click",()=>simpanEditMasa(id, editTimeInput.value, btnSaveEditTime, data));
      btnBadge.addEventListener("click", ()=>{
        if(!mintaAdmin())return;
        bukaBadgeModal(id, data.badgeText, data.badgeColor, data.badgeTextColor, data.badgeColor2, data.badgeGradient, data.badgeAnimated, data.badgeGlowColor, data.badgeRainbow, data.customCheckEnabled, data.customCheckColor, data.hideVerifiedBadge, data.badgeEmoji, data.customCheckType, data.customCheckGif, data.badgeSize, data.customCheckSize);
      });
      btnProfile.addEventListener("click", ()=>{
        if(!mintaAdmin())return;
        bukaCustomerModal(id, data);
      });
      card.querySelector('.btn-toggle-pin-label').addEventListener('click', event => setReviewVisibility(id, 'hidePinLabel', data.hidePinLabel !== true, event.currentTarget));
      card.querySelector('.btn-toggle-review-time').addEventListener('click', event => setReviewVisibility(id, 'hideReviewTime', data.hideReviewTime !== true, event.currentTarget));
      btnPin.addEventListener("click", async ()=>{
        if(!mintaAdmin())return;
        const nakPin = data.pinned!==true;
        btnPin.disabled=true; btnPin.textContent = nakPin ? "Menyemat..." : "Membuang pin...";
        try {
          const payload = nakPin
            ? { pinned:true, pinnedAt:serverTimestamp() }
            : { pinned:false, pinnedAt:null };
          // Rules 'update' anda wajibkan balasanAdmin sentiasa string sah (1-400 aksara).
          // Kalau ulasan lama ni tak pernah dapat balasan lagi, isi dulu auto-reply
          // supaya update pin ni tak ditolak oleh Firestore rules.
          if (reviewAdminSettings.autoReply !== false && reviewAllowsAutoReply(data)) {
            payload.balasanAdmin = buildAutoReply(data.nama);
            payload.balasanPada = serverTimestamp();
          }
          await updateDoc(doc(db,"ratings",id), payload);
          showToast(nakPin ? "Ulasan berjaya disematkan. 📌" : "Pin dibuang.", "success");
        } catch(err) {
          console.error(err);
          showToast("Gagal kemaskini pin.", "error");
        } finally {
          btnPin.disabled=false;
        }
      });
      btnPadam.addEventListener("click", async ()=>{
        if(!mintaAdmin())return;
        if(!confirm(`Padam ulasan daripada "${rawNama}" ni? Tindakan ni tak boleh diundur.`)) return;
        btnPadam.disabled=true; btnPadam.textContent="Memadam...";
        try {
          await deleteDoc(doc(db,"ratings",id));
          showToast("Ulasan berjaya dipadam.", "success");
        } catch(err) {
          console.error(err);
          showToast("Gagal padam ulasan.", "error");
          btnPadam.disabled=false; btnPadam.textContent="Padam";
        }
      });
    });
    focusDirectReview();
  }

  function reviewDateText(data) {
    return reviewDateAndAge(data.diciptaPada || data.timestamp || data.date, false);
  }
  function makeScreenshotReviewCard(data) {
    const rawNama = data.nama || "Pelanggan Misteri";
    const score = clampBintang(data.bintang);
    const warna = data.warnaProfil || warnaAuto(rawNama);
    const avatarIsi = data.emojiProfil || rawNama.charAt(0).toUpperCase();
    const officialAdminReview = isOfficialAdminReview(data);
    const avatar = officialAdminReview ? `<img src="${H4SX_LOGO_URL}" alt="H4SX Admin">`
      : data.profileImg ? `<img src="${escapeHtml(data.profileImg)}" alt="">` : escapeHtml(avatarIsi);
    const stars = "★".repeat(score) + "☆".repeat(5-score);
    const text = data.ulasan && data.ulasan !== "Tiada ulasan ditinggalkan."
      ? data.ulasan
      : "Rating sahaja, tiada ulasan teks.";
    const badge = data.badgeText?.trim() ? data.badgeText : "Verified";
    const replied = !!(data.balasanAdmin?.trim());
    const cleanText = text.length > 150 ? text.slice(0, 150).trim() + "..." : text;
    return `
      <div class="ss-review-card">
        <div class="ss-review-top">
          <div class="ss-avatar${data.profileImg || officialAdminReview ? " has-profile-image" : ""}" style="background:${warna}">${avatar}</div>
          <div class="ss-review-meta">
            <div class="ss-review-name">${escapeHtml(rawNama)}</div>
            ${data.hideReviewTime===true ? "" : `<div class="ss-review-date">${reviewDateText(data)}</div>`}
          </div>
          <span class="ss-badge">${escapeHtml(badge)}</span>
        </div>
        ${data.hideRating===true ? "" : `<div class="ss-stars">${stars}</div>`}
        <div class="ss-review-text">${formatMessageText(cleanText)}</div>
        ${replied ? `<div class="ss-admin-responded">Admin responded</div>` : ""}
      </div>`;
  }
  function getVisibleReviewList() {
    const byId = new Map(allDocs.map(item => [item.id, item]));
    const boxRect = kotakPaparan.getBoundingClientRect();
    const cards = [...kotakPaparan.querySelectorAll(".review-card")];
    const firstVisibleIndex = cards.findIndex(card => {
      const rect = card.getBoundingClientRect();
      const overlap = Math.min(rect.bottom, boxRect.bottom) - Math.max(rect.top, boxRect.top);
      return overlap > 24;
    });
    const startIndex = Math.max(0, firstVisibleIndex);
    const pickedCards = cards.slice(startIndex, startIndex + 6);
    return pickedCards.map(card => byId.get(card.dataset.reviewId)).filter(Boolean);
  }
  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas blob kosong"));
      }, "image/png");
    });
  }
  function downloadCanvasFallback(canvas) {
    const a = document.createElement("a");
    a.download = `h4sx-reviews-${Date.now()}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }
  async function copyReviewScreenshot() {
    if (!window.html2canvas) {
      showToast("Library screenshot belum siap dimuat. Cuba tekan sekali lagi.", "error");
      return;
    }
    const list = getVisibleReviewList();
    if (!list.length) {
      showToast("Tiada review yang sedang nampak untuk screenshot.", "error");
      return;
    }
    btnReviewScreenshot.disabled = true;
    btnReviewScreenshot.textContent = "Copying...";
    try {
      const board = document.createElement("div");
      board.className = "ss-capture-board";
      board.innerHTML = `
        <div class="ss-board-head">
          <img src="https://i.imgur.com/cLPulXQ.png" alt="H4SX">
          <div>
            <div class="ss-board-title">H4SX STORE Reviews</div>
            <div class="ss-board-sub">Feedback pelanggan terkini</div>
          </div>
          <div class="ss-board-stats">
            <strong>${escapeHtml(purataSkor.textContent || "0.0")}</strong>
            <span>${escapeHtml(jumlahUlasanVal.textContent || "0")} ulasan</span>
          </div>
        </div>
        <div class="ss-review-grid">${list.map(makeScreenshotReviewCard).join("")}</div>
        <div class="ss-board-foot">www.h4sxmy.xyz</div>`;
      document.body.appendChild(board);
      const canvas = await html2canvas(board, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false
      });
      board.remove();
      const blob = await canvasToPngBlob(canvas);
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        showToast("Screenshot review dah dicopy ke clipboard.", "success");
      } else {
        downloadCanvasFallback(canvas);
        showToast("Browser tak support copy gambar. Screenshot dimuat turun sebagai backup.", "success");
      }
    } catch(e) {
      console.error(e);
      showToast("Gagal copy screenshot review. Cuba guna browser Chrome/Edge atau buka melalui HTTPS.", "error");
    } finally {
      btnReviewScreenshot.disabled = false;
      btnReviewScreenshot.textContent = "Copy SS";
    }
  }
  btnReviewScreenshot.addEventListener("click", copyReviewScreenshot);

  function escapeHtml(str) {
    const d=document.createElement("div"); d.textContent=str??""; return d.innerHTML;
  }
  function formatMessageText(str) {
    return escapeHtml(str ?? "")
      .replace(/\s+(?=\d+\s*:\s*H4SX-)/gi, "\n")
      .replace(/(\d+\s*:\s*)(H4SX-[A-Z0-9]+)/gi, "$1$2")
      .replace(/https?:\/\/[^\s<>"']+/gi, rawUrl => {
        const trailing = rawUrl.match(/[),.!?]+$/)?.[0] || "";
        const url = rawUrl.slice(0, rawUrl.length - trailing.length);
        return `<a class="message-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
      });
  }

  // -- H4SX Review Helper --------------------------------
  const reviewHelperPanel = document.getElementById("reviewHelperPanel");
  const reviewHelperBubble = document.getElementById("reviewHelperBubble");
  const reviewHelperClose = document.getElementById("reviewHelperClose");
  const reviewHelperMessages = document.getElementById("reviewHelperMessages");

  function openReviewHelper() {
    reviewHelperPanel?.classList.add("show");
    document.getElementById("reviewHelper")?.classList.add("is-open");
    reviewHelperBubble?.classList.add("hide");
  }
  function closeReviewHelper() {
    reviewHelperPanel?.classList.remove("show");
    document.getElementById("reviewHelper")?.classList.remove("is-open");
    reviewHelperBubble?.classList.remove("hide");
  }
  function reviewHelperFormat(text) {
    return formatMessageText(text).replace(/\n/g, "<br>");
  }
  function appendReviewHelperMessage(type, text) {
    if (!reviewHelperMessages) return null;
    const msg = document.createElement("div");
    msg.className = `review-helper-msg ${type === "user" ? "user" : "bot"}`;
    msg.innerHTML = reviewHelperFormat(text);
    reviewHelperMessages.appendChild(msg);
    reviewHelperMessages.scrollTop = reviewHelperMessages.scrollHeight;
    return msg;
  }
  function setReviewHelperTyping(msg) {
    if (!msg) return;
    msg.classList.add("typing");
    msg.innerHTML = "<span></span><span></span><span></span>";
  }
  function typeReviewHelperMessage(msg, text) {
    if (!msg) return;
    const fullText = String(text || "");
    let index = 0;
    msg.classList.remove("typing");
    msg.textContent = "";
    const step = () => {
      index = Math.min(fullText.length, index + 12);
      msg.textContent = fullText.slice(0, index);
      reviewHelperMessages.scrollTop = reviewHelperMessages.scrollHeight;
      if (index < fullText.length) setTimeout(step, 3);
      else msg.innerHTML = reviewHelperFormat(fullText);
    };
    step();
  }
  const REVIEW_HELPER_PRESETS = {
    code: {
      label: "Kod review",
      answer: "Kod pengesahan review ialah kod unik daripada admin selepas pembelian. Satu kod hanya boleh digunakan untuk satu ulasan.\n\nJika belum ada kod, hubungi admin: https://wa.me/60193263016"
    },
    review: {
      label: "Cara review",
      answer: "Cara hantar review:\n1. Masukkan kod pengesahan.\n2. Isi nama atau username.\n3. Pilih rating bintang.\n4. Tulis ulasan jika mahu.\n5. Tekan Hantar Ulasan."
    },
    website: {
      label: "Website H4SX",
      answer: "Website utama untuk melihat item:\nhttps://www.h4sxmy.xyz/\n\nPage review pelanggan:\nhttps://www.h4sxmy.xyz/review"
    }
  };
  function showReviewHelperPreset(key) {
    const preset = REVIEW_HELPER_PRESETS[key];
    if (!preset) return;
    appendReviewHelperMessage("user", preset.label);
    const thinking = appendReviewHelperMessage("bot", "");
    setReviewHelperTyping(thinking);
    setTimeout(() => typeReviewHelperMessage(thinking, preset.answer), 80);
  }
  reviewHelperBubble?.addEventListener("click", openReviewHelper);
  reviewHelperClose?.addEventListener("click", closeReviewHelper);
  document.querySelectorAll("[data-helper-preset]").forEach(btn => {
    btn.addEventListener("click", () => showReviewHelperPreset(btn.dataset.helperPreset));
  });

  // ── Block Inspect Element & DevTools ──────────────────────────
  // Admin Review Center
  const DEFAULT_REVIEW_ADMIN_SETTINGS = {
    showImages:true, showBadges:true, showReplies:true, autoReply:true, showRelativeTime:true, lowRatingAlert:true,
    replyTemplates:{
      5:"Terima kasih {nama}! Kami sangat hargai sokongan dan ulasan anda.",
      4:"Terima kasih {nama}! Kami gembira urusan berjalan lancar dan akan terus tingkatkan servis.",
      3:"Terima kasih {nama}. Maklum balas anda kami ambil perhatian untuk penambahbaikan.",
      2:"Maaf atas pengalaman tersebut, {nama}. Sila hubungi admin supaya kami boleh semak dan bantu.",
      1:"Maaf atas masalah yang berlaku, {nama}. Hubungi admin H4SX untuk semakan segera."
    }
  };
  let reviewAdminSettings = structuredClone(DEFAULT_REVIEW_ADMIN_SETTINGS);
  let adminReports = [], adminAudit = [], stopAdminReports = null, stopAdminAudit = null, lowAlertReady = false;
  const knownLowReviews = new Set(), selectedAdminReviews = new Set();
  const adminCenterOverlay = document.getElementById("adminReviewCenterOverlay");

  function applyReviewAdminSettings() {
    const root=document.documentElement;
    root.classList.toggle("hide-review-images",!reviewAdminSettings.showImages);
    root.classList.toggle("hide-review-badges",!reviewAdminSettings.showBadges);
    root.classList.toggle("hide-review-replies",!reviewAdminSettings.showReplies);
    const map={Images:"showImages",Badges:"showBadges",Replies:"showReplies",AutoReply:"autoReply",RelativeTime:"showRelativeTime",LowAlert:"lowRatingAlert"};
    Object.entries(map).forEach(([suffix,key])=>{const el=document.getElementById(`adminSetting${suffix}`);if(el)el.checked=reviewAdminSettings[key]!==false;});
    const rating=document.getElementById("adminTemplateRating")?.value||"5", template=document.getElementById("adminTemplateText");
    if(template)template.value=reviewAdminSettings.replyTemplates?.[rating]||"";
  }
  onSnapshot(doc(db,"config","review_admin"),snap=>{
    const remote=snap.exists()?snap.data():{};
    reviewAdminSettings={...DEFAULT_REVIEW_ADMIN_SETTINGS,...remote,replyTemplates:{...DEFAULT_REVIEW_ADMIN_SETTINGS.replyTemplates,...(remote.replyTemplates||{})}};
    applyReviewAdminSettings(); renderReviews();
  },applyReviewAdminSettings);
  function getAdminReplyTemplate(score,nama="pelanggan"){return String(reviewAdminSettings.replyTemplates?.[clampBintang(score)]||DEFAULT_REVIEW_ADMIN_SETTINGS.replyTemplates[clampBintang(score)]||"Terima kasih atas ulasan anda.").replaceAll("{nama}",nama);}

  function switchAdminCenterTab(name){
    document.querySelectorAll("[data-admin-center-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.adminCenterTab===name));
    document.querySelectorAll("[data-admin-center-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.adminCenterPanel===name));
  }
  let adminReviewReloading = false;
  async function reloadAdminReviews(showSuccess = false) {
    if (!adminOk() || adminReviewReloading) return;
    adminReviewReloading = true;
    const refreshButton = document.getElementById("btnAdminRefreshDashboard");
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Loading';
    }
    try {
      const snapshot = await getDocs(q);
      const rawReviewRecords = snapshot.docs.map(item => ({ id:item.id, ...item.data() }));
      syncUsedReviewCodeIds(rawReviewRecords);
      allDocs = uniqueReviewRecords(rawReviewRecords);
      if (latestCodeSnapshot) {
        renderCodeListFromSnapshot(latestCodeSnapshot);
        cleanupUsedReviewCodes(latestCodeSnapshot);
      }
      renderReviews();
      refreshAdminCenter();
      if (showSuccess) showToast(`${allDocs.length} rekod Firebase dimuatkan.`, "success");
    } catch (err) {
      console.error("Admin ratings load gagal:", err);
      showToast(`Firebase ratings error: ${err?.code || err?.message || "ralat tidak diketahui"}`, "error");
    } finally {
      adminReviewReloading = false;
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh';
      }
    }
  }
  function openAdminReviewCenter(tab="dashboard"){
    if(!mintaAdmin())return;
    document.getElementById("adminPanelModal")?.classList.remove("show");document.getElementById("adminOverlayBg")?.classList.remove("show");
    adminCenterOverlay?.classList.add("show");document.body.style.overflow="hidden";switchAdminCenterTab(tab);startAdminCenterStreams();refreshAdminCenter();reloadAdminReviews();
  }
  function closeAdminReviewCenter(){adminCenterOverlay?.classList.remove("show");document.body.style.removeProperty("overflow");}
  document.getElementById("btnOpenReviewCenter")?.addEventListener("click",()=>openAdminReviewCenter());
  document.getElementById("btnCloseReviewCenter")?.addEventListener("click",closeAdminReviewCenter);
  adminCenterOverlay?.addEventListener("click",e=>{if(e.target===adminCenterOverlay)closeAdminReviewCenter();});
  document.querySelectorAll("[data-admin-center-tab]").forEach(btn=>btn.addEventListener("click",()=>{
    switchAdminCenterTab(btn.dataset.adminCenterTab);
    if(btn.dataset.adminCenterTab==="reports")startAdminCenterStreams();
  }));
  document.querySelectorAll("[data-jump-admin-tab]").forEach(btn=>btn.addEventListener("click",()=>{if(btn.dataset.lowOnly)document.getElementById("adminReviewRatingFilter").value="12";switchAdminCenterTab(btn.dataset.jumpAdminTab);renderAdminModeration();}));

  function adminReviewStatus(data){return ["published","hidden","rejected"].includes(data.moderationStatus)?data.moderationStatus:"published";}
  function adminEmpty(text,icon="fa-inbox"){return `<div class="admin-empty-state"><i class="fa-solid ${icon}"></i><p>${escapeHtml(text)}</p></div>`;}
  function refreshAdminCenter(){if(!document.getElementById("adminReviewCenter"))return;renderAdminDashboard();renderAdminModeration();renderAdminCodes();renderAdminReports();renderAdminAudit();}
  function renderAdminDashboard(){
    const rated = allDocs.filter(r => r.hideRating !== true);
    const total=allDocs.length, average=rated.length?(rated.reduce((s,r)=>s+clampBintang(r.bintang),0)/rated.length).toFixed(1):"0.0", start=new Date();start.setHours(0,0,0,0);
    const today=allDocs.filter(r=>reviewRecordTime(r.diciptaPada)>=start.getTime()).length,low=allDocs.filter(r=>r.hideRating!==true && clampBintang(r.bintang)<=2).length,unreplied=allDocs.filter(r=>!r.balasanAdmin?.trim()).length,hidden=allDocs.filter(r=>adminReviewStatus(r)!=="published").length;
    Object.entries({adminDashTotal:total,adminDashAverage:average,adminDashToday:today,adminDashLow:low,adminDashUnreplied:unreplied,adminDashHidden:hidden,adminModerationCount:low+unreplied+hidden}).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
    const starLabel=document.getElementById("adminDashStars");if(starLabel)starLabel.textContent=rated.length?`${average} daripada 5 bintang`:"Belum ada rating";
    const distribution=document.getElementById("adminRatingDistribution");if(distribution)distribution.innerHTML=[5,4,3,2,1].map(star=>{const count=rated.filter(r=>clampBintang(r.bintang)===star).length,pct=rated.length?Math.round(count/rated.length*100):0;return `<div class="admin-rating-row"><span>${star} bintang</span><i><b style="width:${pct}%"></b></i><strong>${count}</strong></div>`;}).join("");
    const lows=allDocs.filter(r=>clampBintang(r.bintang)<=2).slice(0,5),lowList=document.getElementById("adminLowReviewList");if(lowList)lowList.innerHTML=lows.length?lows.map(r=>`<div class="admin-mini-item"><div><strong>${escapeHtml(r.nama||"Pelanggan")}</strong><span>${escapeHtml(String(r.ulasan||"Rating sahaja").slice(0,70))}</span></div><b>${clampBintang(r.bintang)} bintang</b></div>`).join(""):adminEmpty("Tiada rating rendah.","fa-circle-check");
    const recent=document.getElementById("adminRecentAudit");if(recent)recent.innerHTML=adminAuditMarkup(adminAudit.slice(0,5));
  }
  function getAdminModerationList(){
    const search=(document.getElementById("adminReviewSearch")?.value||"").trim().toLowerCase(),rating=document.getElementById("adminReviewRatingFilter")?.value||"all",status=document.getElementById("adminReviewStatusFilter")?.value||"all",sort=document.getElementById("adminReviewSort")?.value||"newest";
    let list=allDocs.filter(r=>!search||[r.id,r.nama,r.ulasan,r.badgeText,r.balasanAdmin].some(v=>String(v||"").toLowerCase().includes(search)));
    if(rating!=="all")list=list.filter(r=>rating==="12"?clampBintang(r.bintang)<=2:clampBintang(r.bintang)===Number(rating));
    if(status!=="all")list=list.filter(r=>status==="featured"?r.featured===true:status==="unreplied"?!r.balasanAdmin?.trim():status==="image"?!!r.feedbackImg:adminReviewStatus(r)===status);
    list.sort((a,b)=>sort==="oldest"?reviewRecordTime(a.diciptaPada)-reviewRecordTime(b.diciptaPada):sort==="highest"?clampBintang(b.bintang)-clampBintang(a.bintang):sort==="lowest"?clampBintang(a.bintang)-clampBintang(b.bintang):reviewRecordTime(b.diciptaPada)-reviewRecordTime(a.diciptaPada));return list;
  }
  function renderAdminModeration(){
    const box=document.getElementById("adminModerationList");if(!box)return;const list=getAdminModerationList();document.getElementById("adminModerationResult").textContent=`${list.length} rekod`;
    box.innerHTML=list.length?list.map(r=>{const status=adminReviewStatus(r),score=clampBintang(r.bintang),hasImg=!!r.profileImg,avatar=hasImg?`<img src="${escapeHtml(r.profileImg)}" alt="">`:escapeHtml(r.emojiProfil||String(r.nama||"P")[0]);return `<article class="admin-moderation-item${score<=2?" is-low":""}${status!=="published"?" is-hidden":""}" data-admin-review-id="${r.id}"><input class="admin-review-checkbox" type="checkbox" ${selectedAdminReviews.has(r.id)?"checked":""}><div class="admin-moderation-avatar${hasImg?" has-profile-image":""}" style="background:${r.warnaProfil||warnaAuto(r.nama||"P")}">${avatar}</div><div class="admin-moderation-copy"><header><strong>${escapeHtml(r.nama||"Pelanggan")}</strong><span class="admin-status-chip ${status}">${status}</span>${r.featured?'<span class="admin-status-chip featured">pilihan</span>':''}</header><p>${escapeHtml(r.ulasan||"Rating sahaja")}</p><small>${score} bintang · ${reviewDateText(r)}${r.balasanAdmin?.trim()?" · sudah dibalas":" · belum dibalas"}</small></div><div class="admin-moderation-actions"><button data-admin-row-action="publish" title="Terbit"><i class="fa-solid fa-eye"></i></button><button data-admin-row-action="hide" title="Sorok"><i class="fa-solid fa-eye-slash"></i></button><button data-admin-row-action="feature" title="Pilihan"><i class="fa-solid fa-star"></i></button><button data-admin-row-action="reply" title="Balas"><i class="fa-solid fa-reply"></i></button><button data-admin-row-action="open" title="Buka"><i class="fa-solid fa-arrow-up-right-from-square"></i></button><button class="danger" data-admin-row-action="delete" title="Padam"><i class="fa-solid fa-trash"></i></button></div></article>`;}).join(""):adminEmpty("Tiada ulasan sepadan dengan penapis.");updateAdminSelectionCount();
  }
  function updateAdminSelectionCount(){const el=document.getElementById("adminSelectedReviewsCount");if(el)el.textContent=`${selectedAdminReviews.size} dipilih`;}
  ["adminReviewSearch","adminReviewRatingFilter","adminReviewStatusFilter","adminReviewSort"].forEach(id=>document.getElementById(id)?.addEventListener(id==="adminReviewSearch"?"input":"change",renderAdminModeration));
  document.getElementById("adminModerationList")?.addEventListener("change",e=>{const row=e.target.closest("[data-admin-review-id]");if(!row||!e.target.matches(".admin-review-checkbox"))return;e.target.checked?selectedAdminReviews.add(row.dataset.adminReviewId):selectedAdminReviews.delete(row.dataset.adminReviewId);updateAdminSelectionCount();});
  document.getElementById("adminSelectAllReviews")?.addEventListener("change",e=>{getAdminModerationList().forEach(r=>e.target.checked?selectedAdminReviews.add(r.id):selectedAdminReviews.delete(r.id));renderAdminModeration();});
  document.getElementById("adminModerationList")?.addEventListener("click",e=>{const btn=e.target.closest("[data-admin-row-action]"),row=e.target.closest("[data-admin-review-id]");if(btn&&row)runAdminReviewAction(btn.dataset.adminRowAction,[row.dataset.adminReviewId]);});
  document.querySelectorAll("[data-admin-bulk-action]").forEach(btn=>btn.addEventListener("click",()=>runAdminReviewAction(btn.dataset.adminBulkAction,[...selectedAdminReviews])));
  async function runAdminReviewAction(action,ids){
    if(!mintaAdmin()||!ids.length){showToast("Pilih sekurang-kurangnya satu ulasan.","error");return;}const records=ids.map(id=>allDocs.find(r=>r.id===id)).filter(Boolean);
    if(action==="open"){
      closeAdminReviewCenter();
      const index = getCurrentReviewList().findIndex(item => item.id === ids[0]);
      if (mobileReviewMedia.matches && index >= mobileReviewLimit) {
        mobileReviewLimit = index + 1;
        renderReviews();
      }
      [...kotakPaparan.querySelectorAll("[data-review-id]")]
        .find(card => card.dataset.reviewId === ids[0])?.scrollIntoView({behavior:"smooth",block:"center"});
      return;
    }
    if(action==="delete"){if(!confirm(`Backup dan padam ${ids.length} ulasan secara kekal?`))return;downloadAdminData(records,`h4sx-review-backup-${Date.now()}.json`);}
    let reply="";if(action==="reply"){reply=prompt("Balasan untuk ulasan dipilih:",getAdminReplyTemplate(records[0]?.bintang,records[0]?.nama));if(!reply?.trim())return;}
    try{await Promise.all(records.map(r=>action==="delete"?deleteDoc(doc(db,"ratings",r.id)):action==="publish"?updateDoc(doc(db,"ratings",r.id),{moderationStatus:"published",moderatedAt:serverTimestamp()}):action==="hide"?updateDoc(doc(db,"ratings",r.id),{moderationStatus:"hidden",moderatedAt:serverTimestamp()}):action==="feature"?updateDoc(doc(db,"ratings",r.id),{featured:!r.featured,featuredAt:serverTimestamp()}):updateDoc(doc(db,"ratings",r.id),{balasanAdmin:reply.trim(),balasanPada:serverTimestamp(),balasanDibuang:false})));await logAdminAction(action,ids.join(","),`${ids.length} ulasan`);selectedAdminReviews.clear();showToast("Tindakan admin berjaya disimpan.","success");}catch(err){console.error(err);showToast("Tindakan gagal. Semak Firestore Rules admin.","error");}
  }

  const REPORT_HISTORY_KEY="h4sx_review_report_history_v2";
  const REPORT_GLOBAL_COOLDOWN_MS=60*1000;
  const REPORT_SAME_REVIEW_COOLDOWN_MS=24*60*60*1000;
  const REPORT_BURST_WINDOW_MS=60*60*1000;
  const REPORT_BURST_LIMIT=3;
  let reportSubmitBusy=false;
  function readReportHistory(){try{const list=JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY)||"[]");return Array.isArray(list)?list.filter(item=>Date.now()-Number(item?.time||0)<REPORT_SAME_REVIEW_COOLDOWN_MS):[];}catch(_){return[];}}
  function saveReportHistory(list){try{localStorage.setItem(REPORT_HISTORY_KEY,JSON.stringify(list.slice(-20)));}catch(_){}}
  function reportWaitMessage(reviewId){const now=Date.now(),history=readReportHistory(),latest=history.at(-1),same=history.find(item=>item.reviewId===reviewId),recent=history.filter(item=>now-item.time<REPORT_BURST_WINDOW_MS);if(same&&now-same.time<REPORT_SAME_REVIEW_COOLDOWN_MS)return"Ulasan ini sudah anda laporkan. Admin akan menyemaknya.";if(latest&&now-latest.time<REPORT_GLOBAL_COOLDOWN_MS)return`Tunggu ${Math.ceil((REPORT_GLOBAL_COOLDOWN_MS-(now-latest.time))/1000)} saat sebelum membuat laporan lain.`;if(recent.length>=REPORT_BURST_LIMIT)return"Had 3 laporan sejam telah dicapai. Cuba semula kemudian.";return"";}
  function cleanReportReason(value){return String(value||"").normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().slice(0,300);}
  async function reportDocumentId(reviewId){const source=getVisitorId()+"|"+reviewId;try{const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(source));return"r-"+[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("").slice(0,48);}catch(_){const hex=[...source].map(char=>char.charCodeAt(0).toString(16).padStart(2,"0")).join("");return"r-"+(hex+"0".repeat(48)).slice(0,48);}}
  async function openReviewReport(reviewId,reviewName,button){
    reviewId=String(reviewId||"").trim().slice(0,160);
    if(reportSubmitBusy)return showToast("Laporan sedang diproses. Tunggu sebentar.","error");
    if(!reviewId||!allDocs.some(item=>item.id===reviewId))return showToast("Ulasan ini tidak sah atau sudah tiada.","error");
    const waitMessage=reportWaitMessage(reviewId);if(waitMessage)return showToast(waitMessage,"error");
    const input=prompt(`Kenapa anda mahu laporkan ulasan ${reviewName}?\n\nTerangkan dengan ringkas (8–300 aksara). Jangan masukkan nombor telefon, link atau maklumat peribadi.`);
    if(input===null)return;
    const reason=cleanReportReason(input);
    if(reason.length<8)return showToast("Sebab laporan mestilah sekurang-kurangnya 8 aksara.","error");
    if(/https?:\/\/|www\.|wa\.me|t\.me/i.test(reason))return showToast("Link tidak dibenarkan dalam laporan.","error");
    if(/(?:\d[\s-]?){8,}/.test(reason))return showToast("Nombor telefon atau nombor peribadi tidak dibenarkan.","error");
    if(/(.)\1{7,}/i.test(reason))return showToast("Sebab laporan kelihatan seperti spam.","error");
    reportSubmitBusy=true;if(button){button.disabled=true;button.innerHTML='<i class="fa-solid fa-shield-halved"></i> Semak...';}
    try{
      await verifyReportTurnstile(reviewId);
      const deviceId=getVisitorId().slice(0,100),documentId=await reportDocumentId(reviewId);
      await setDoc(doc(db,"review_reports",documentId),{reviewId,reviewName:String(reviewName||"Ulasan").trim().slice(0,80),reason,status:"open",deviceId,createdAt:serverTimestamp()});
      const history=readReportHistory();history.push({reviewId,time:Date.now()});saveReportHistory(history);
      showToast("Laporan berjaya dihantar sekali kepada admin.","success");
    }catch(err){
      console.error("Review report gagal:",err);
      if(err?.message==="report-rate-limit"){const mins=Math.max(1,Math.ceil(Number(err.retryAfter||60)/60));showToast(`Terlalu banyak cubaan. Cuba lagi dalam ${mins} minit.`,"error");}
      else if(String(err?.message||"").startsWith("report-turnstile-"))showToast("Pengesahan keselamatan gagal. Cuba semula sebentar lagi.","error");
      else if(err?.code==="permission-denied")showToast("Laporan ini sudah dihantar atau ditolak oleh sistem keselamatan.","error");
      else showToast("Laporan gagal dihantar. Semak sambungan dan cuba semula.","error");
    }finally{reportSubmitBusy=false;if(button){button.disabled=false;button.innerHTML='<i class="fa-regular fa-flag"></i> Lapor';}}
  }
  function startAdminCenterStreams(){
    if(!adminOk())return;
    if(!stopAdminReports)stopAdminReports=onSnapshot(collection(db,"review_reports"),snap=>{
      adminReports=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>reviewRecordTime(b.createdAt)-reviewRecordTime(a.createdAt));
      renderAdminReports();
    },err=>{
      console.error("Admin report stream gagal:",err);
      const box=document.getElementById("adminReportList");
      if(box)box.innerHTML=adminEmpty(err?.code==="permission-denied"?"Firestore Rules belum membenarkan admin membaca review_reports.":"Laporan gagal dimuatkan. Semak sambungan Firebase.","fa-lock");
    });
    if(!stopAdminAudit)stopAdminAudit=onSnapshot(query(collection(db,"admin_audit"),orderBy("createdAt","desc")),snap=>{adminAudit=snap.docs.map(d=>({id:d.id,...d.data()}));renderAdminAudit();renderAdminDashboard();},()=>renderAdminAudit());
  }
  function renderAdminReports(){const box=document.getElementById("adminReportList");if(!box)return;const status=document.getElementById("adminReportStatusFilter")?.value||"open",list=adminReports.filter(r=>status==="all"||r.status===status);document.getElementById("adminReportCount").textContent=adminReports.filter(r=>r.status!=="resolved").length;box.innerHTML=list.length?list.map(r=>`<article class="admin-report-item" data-report-id="${r.id}"><div><h4>${escapeHtml(r.reviewName||"Ulasan")}</h4><p>${escapeHtml(r.reason||"Tiada sebab")}</p><small>${reviewDateAndAge(r.createdAt)} · ${escapeHtml(r.status||"open")}</small></div><div class="admin-report-actions"><button data-report-action="open" data-review-id="${escapeHtml(r.reviewId||"")}">Buka</button><button data-report-action="resolve">Selesai</button><button data-report-action="delete">Padam</button></div></article>`).join(""):adminEmpty("Tiada laporan untuk status ini.","fa-flag");}
  document.getElementById("adminReportStatusFilter")?.addEventListener("change",renderAdminReports);
  document.getElementById("adminReportList")?.addEventListener("click",async e=>{const btn=e.target.closest("[data-report-action]"),row=e.target.closest("[data-report-id]");if(!btn||!row)return;try{if(btn.dataset.reportAction==="open"){switchAdminCenterTab("moderation");document.getElementById("adminReviewSearch").value=btn.dataset.reviewId;renderAdminModeration();return;}if(btn.dataset.reportAction==="resolve")await updateDoc(doc(db,"review_reports",row.dataset.reportId),{status:"resolved",resolvedAt:serverTimestamp()});if(btn.dataset.reportAction==="delete")await deleteDoc(doc(db,"review_reports",row.dataset.reportId));await logAdminAction(`report_${btn.dataset.reportAction}`,row.dataset.reportId,"Laporan pengunjung");}catch(err){console.error(err);showToast("Gagal kemaskini laporan.","error");}});

  function getAdminCodes(){return availableReviewCodeDocs().map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.id.localeCompare(b.id));}
  function renderAdminCodes(){const box=document.getElementById("adminCenterCodeList");if(!box)return;const codes=getAdminCodes(),usedCount=usedReviewCodeIds.size,search=(document.getElementById("adminCenterCodeSearch")?.value||"").toLowerCase(),filtered=codes.filter(c=>c.id.toLowerCase().includes(search));document.getElementById("adminCenterAvailableCodes").textContent=codes.length;document.getElementById("adminCenterUsedCodes").textContent=usedCount;document.getElementById("adminCenterTotalCodes").textContent=codes.length+usedCount;box.innerHTML=filtered.length?filtered.map(c=>`<div class="admin-center-code-item"><div><strong>${escapeHtml(c.id)}</strong><small>${c.expiresAt?`Luput ${reviewDateAndAge(c.expiresAt,false)}`:"Tiada luput"}</small></div><button data-admin-copy-code="${escapeHtml(c.id)}"><i class="fa-solid fa-copy"></i></button></div>`).join(""):adminEmpty("Tiada kod tersedia.");}
  document.getElementById("adminCenterCodeSearch")?.addEventListener("input",renderAdminCodes);
  document.getElementById("adminCenterCodeList")?.addEventListener("click",e=>{const btn=e.target.closest("[data-admin-copy-code]");if(btn)copyText(btn.dataset.adminCopyCode);});
  document.getElementById("btnAdminCopyAllCodes")?.addEventListener("click",()=>navigator.clipboard.writeText(getAdminCodes().map(c=>c.id).join("\n")).then(()=>showToast("Semua kod dicopy.","success")));
  document.getElementById("btnAdminCenterGenerateCodes")?.addEventListener("click",async()=>{
    if(!mintaAdmin())return;
    const prefix=cleanCodePrefix(document.getElementById("adminCenterCodePrefix").value);
    const count=Math.max(1,Math.min(200,Number(document.getElementById("adminCenterCodeCount").value)||1));
    const days=Math.max(0,Number(document.getElementById("adminCenterCodeExpiry").value)||0),made=[];
    try{
      for(let i=0;i<count;i++){
        const code=await createUnusedReviewCode(prefix,made);
        made.push(code);
        const payload={kod:code,diciptaPada:serverTimestamp(),diciptaOleh:currentUser.uid};
        if(days)payload.expiresAt=Timestamp.fromDate(new Date(Date.now()+days*86400000));
        await setDoc(doc(db,"review_codes",code),payload);
      }
      await logAdminAction("generate_codes",prefix,`${count} kod`);
      showToast(`${count} kod berjaya dijana.`,"success");
    }catch(err){console.error(err);showToast(err?.message||"Gagal jana kod.","error");}
  });

  function adminAuditMarkup(list){return list.length?list.map(a=>`<div class="admin-audit-item"><div><strong>${escapeHtml(a.action||"Tindakan admin")}</strong><span>${escapeHtml(a.details||a.targetId||"")}</span></div><span>${reviewDateAndAge(a.createdAt||a.time)}</span></div>`).join(""):adminEmpty("Belum ada sejarah admin.","fa-clock");}
  function renderAdminAudit(){const box=document.getElementById("adminAuditList");if(box)box.innerHTML=adminAuditMarkup(adminAudit.slice(0,50));}
  async function logAdminAction(action,targetId,details){try{await addDoc(collection(db,"admin_audit"),{action,targetId,details,adminUid:currentUser?.uid||"",adminEmail:currentUser?.email||"",createdAt:serverTimestamp()});}catch(_){const local={action,targetId,details,time:new Date().toISOString()};adminAudit=[local,...adminAudit].slice(0,50);localStorage.setItem("h4sx_admin_audit",JSON.stringify(adminAudit));renderAdminAudit();}}
  document.getElementById("adminTemplateRating")?.addEventListener("change",e=>{document.getElementById("adminTemplateText").value=reviewAdminSettings.replyTemplates?.[e.target.value]||"";});
  document.getElementById("btnSaveAdminTemplate")?.addEventListener("click",async()=>{if(!mintaAdmin())return;const rating=document.getElementById("adminTemplateRating").value,text=document.getElementById("adminTemplateText").value.trim();if(!text){showToast("Template tidak boleh kosong.","error");return;}reviewAdminSettings.replyTemplates[rating]=text;try{await setDoc(doc(db,"config","review_admin"),{replyTemplates:reviewAdminSettings.replyTemplates},{merge:true});await logAdminAction("save_template",rating,`${rating} bintang`);showToast("Template balasan disimpan.","success");}catch(err){console.error(err);showToast("Gagal simpan template.","error");}});
  document.getElementById("btnSaveAdminDisplay")?.addEventListener("click",async()=>{if(!mintaAdmin())return;const next={showImages:document.getElementById("adminSettingImages").checked,showBadges:document.getElementById("adminSettingBadges").checked,showReplies:document.getElementById("adminSettingReplies").checked,autoReply:document.getElementById("adminSettingAutoReply").checked,showRelativeTime:document.getElementById("adminSettingRelativeTime").checked,lowRatingAlert:document.getElementById("adminSettingLowAlert").checked};try{await setDoc(doc(db,"config","review_admin"),next,{merge:true});showToast("Tetapan review disimpan.","success");}catch(err){console.error(err);showToast("Gagal simpan tetapan.","error");}});

  function serialiseReview(r){const out={...r};["diciptaPada","balasanPada","pinnedAt","featuredAt","moderatedAt"].forEach(k=>{if(out[k])out[k]=new Date(reviewRecordTime(out[k])).toISOString();});return out;}
  function downloadAdminData(data,name,type="application/json"){const text=type.includes("json")?JSON.stringify(Array.isArray(data)?data.map(serialiseReview):data,null,2):data,url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  document.getElementById("btnExportReviewsJson")?.addEventListener("click",()=>downloadAdminData(allDocs,`h4sx-reviews-${Date.now()}.json`));
  document.getElementById("btnExportReviewsCsv")?.addEventListener("click",()=>{const esc=v=>`"${String(v??"").replaceAll('"','""')}"`,csv=[["id","nama","bintang","ulasan","status","tarikh"].join(","),...allDocs.map(r=>[r.id,r.nama,clampBintang(r.bintang),r.ulasan,adminReviewStatus(r),reviewDateText(r)].map(esc).join(","))].join("\r\n");downloadAdminData(csv,`h4sx-reviews-${Date.now()}.csv`,`text/csv;charset=utf-8`);});
  document.getElementById("btnPrintAdminReport")?.addEventListener("click",()=>{const win=window.open("","_blank","width=900,height=700");if(!win)return;win.document.write(`<title>H4SX Review Report</title><style>body{font-family:Arial;padding:32px;color:#123}h1{color:#079bd4}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style><h1>H4SX Review Report</h1><p>Dijana ${new Date().toLocaleString("ms-MY")}</p><table><tr><th>Nama</th><th>Rating</th><th>Status</th><th>Tarikh</th></tr>${allDocs.map(r=>`<tr><td>${escapeHtml(r.nama)}</td><td>${clampBintang(r.bintang)}/5</td><td>${adminReviewStatus(r)}</td><td>${reviewDateText(r)}</td></tr>`).join("")}</table>`);win.document.close();win.focus();win.print();});
  document.getElementById("btnAdminRefreshDashboard")?.addEventListener("click",()=>reloadAdminReviews(true));
  function handleLowRatingAlerts(list){const lows=list.filter(r=>clampBintang(r.bintang)<=2);if(!lowAlertReady){lows.forEach(r=>knownLowReviews.add(r.id));lowAlertReady=true;return;}if(reviewAdminSettings.lowRatingAlert!==false&&adminOk())lows.filter(r=>!knownLowReviews.has(r.id)).forEach(r=>showToast(`Rating rendah baharu daripada ${r.nama||"pelanggan"}.`,"error"));lows.forEach(r=>knownLowReviews.add(r.id));}
  applyReviewAdminSettings();

  function blockInspect() {
    const notifyBlocked = message => {
      if (typeof showToast === 'function') showToast(message, 'error');
    };

    document.addEventListener('contextmenu', event => {
      event.preventDefault();
      notifyBlocked('Klik kanan dinyahaktifkan pada halaman ulasan.');
    }, { capture: true });

    document.addEventListener('keydown', event => {
      const key = String(event.key || '').toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const inspectShortcut = modifier && event.shiftKey && ['i', 'j', 'c'].includes(key);
      const macInspectShortcut = event.metaKey && event.altKey && ['i', 'j', 'c'].includes(key);
      const sourceShortcut = modifier && key === 'u';

      if (key !== 'f12' && !inspectShortcut && !macInspectShortcut && !sourceShortcut) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      notifyBlocked('Inspect Element dinyahaktifkan pada halaman ulasan.');
    }, { capture: true });

    // Jika overlay aktif dipadam melalui DevTools, pasang semula tanpa refresh.
    const protectedOverlay = document.getElementById('shopClosedOverlay');
    if (protectedOverlay && document.documentElement) {
      const overlayGuard = new MutationObserver(() => {
        if (protectedOverlay.classList.contains('active') && !protectedOverlay.isConnected) {
          document.body.prepend(protectedOverlay);
        }
      });
      overlayGuard.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  blockInspect();

  // Penghalang UI sahaja; data sensitif tetap dilindungi oleh Firebase Rules.
