(function () {
  'use strict';
  const ADMIN_UID = 'LWRN6IDv4OV1PZd7Vldgp6F9pdH3';
  const ENDPOINT = 'https://www.h4sxmy.xyz/api/admin-sessions';
  let context = null, generation = 0, unsubscribe = null, timer = null, lastRegister = 0, panel = null;
  let currentSessionId = '', signedInTime = 0, securityState = null, visibleDevices = [];
  let deviceId;
  try {
    deviceId = localStorage.getItem('h4sx_admin_device_id');
    if (!/^[a-f0-9-]{16,64}$/i.test(deviceId || '')) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('h4sx_admin_device_id', deviceId);
    }
  } catch { deviceId = crypto.randomUUID(); }

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const date = value => value ? new Date(value).toLocaleString('ms-MY', { timeZone:'Asia/Kuala_Lumpur', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Belum direkod';

  async function request(action, extra = {}) {
    const user = context?.user;
    const requestGeneration = generation;
    if (!user || user.uid !== ADMIN_UID) throw new Error('Login admin diperlukan.');
    const token = await user.getIdToken();
    const response = await fetch(ENDPOINT, {
      method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + token },
      body:JSON.stringify({ action, deviceId, ...extra }), signal:AbortSignal.timeout(12000)
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('API sesi belum tersedia. Semak deployment H4SX.'); }
    if (response.status === 401) {
      if (requestGeneration === generation) await signOutEverywhereLocally();
      throw new Error('Sesi telah ditamatkan. Login semula.');
    }
    if (!response.ok) throw Object.assign(new Error(data.error || 'Pengurusan sesi gagal.'), {code:data.code});
    if (action === 'register' && requestGeneration === generation) {
      currentSessionId = data.sessionId;
      applySecurityState();
    }
    return data;
  }

  async function signOutEverywhereLocally() {
    const logout = context?.signOut;
    if (!logout) return;
    await logout();
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'h4sx-admin-sessions';
    panel.className = 'h4sx-session-overlay';
    panel.hidden = true;
    panel.innerHTML = '<section class="h4sx-session-panel" role="dialog" aria-modal="true" aria-labelledby="h4sx-session-title">' +
      '<header><div><small>KESELAMATAN ADMIN</small><h2 id="h4sx-session-title">Perangkat & sesi login</h2></div><button type="button" data-session-close aria-label="Tutup senarai perangkat">×</button></header>' +
      '<p>Senarai dikongsi oleh website kedai dan review. Nama perangkat dikenal pasti daripada browser, jadi model telefon mungkin tidak tersedia. Setiap browser dan website boleh mempunyai rekod berasingan.</p>' +
      '<div class="h4sx-session-actions"><button type="button" data-session-refresh>Muat semula</button><button type="button" data-session-revoke disabled>Logout semua perangkat</button></div>' +
      '<p data-session-status role="status"></p><div data-session-list></div>' +
      '<footer>Sehingga 100 rekod terbaru, bermula selepas ciri ini diaktifkan. Masa menggunakan waktu Malaysia. “Sesi ini” merujuk browser dan website semasa.</footer></section>';
    document.body.appendChild(panel);
    panel.querySelector('[data-session-close]').addEventListener('click', close);
    panel.addEventListener('click', event => { if (event.target === panel) close(); });
    panel.querySelector('[data-session-refresh]').addEventListener('click', refresh);
    panel.querySelector('[data-session-revoke]').addEventListener('click', revokeAll);
    panel.querySelector('[data-session-list]').addEventListener('click', event => {
      const button = event.target.closest('[data-device-action]');
      if (button) deviceAction(button);
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close(); });
    return panel;
  }

  function close() { if (panel) panel.hidden = true; }
  function status(message, error = false) {
    const element = ensurePanel().querySelector('[data-session-status]');
    element.textContent = message;
    element.classList.toggle('is-error', error);
  }

  async function refresh() {
    const current = generation;
    const root = ensurePanel();
    const refreshButton = root.querySelector('[data-session-refresh]');
    const revokeButton = root.querySelector('[data-session-revoke]');
    refreshButton.disabled = true;
    revokeButton.disabled = true;
    status('Memuatkan perangkat…');
    try {
      await request('register');
      lastRegister = Date.now();
      startValidation();
      const data = await request('list');
      if (current !== generation) return;
      visibleDevices = data.devices;
      root.querySelector('[data-session-list]').innerHTML = data.devices.length ? data.devices.map(item =>
        '<article class="h4sx-session-device"><div class="h4sx-session-device-head"><strong>' + escape(item.device) + ' · ' + escape(item.browser) + '</strong><span class="' + (item.revoked ? 'is-revoked' : '') + '">' + (item.current ? 'Sesi ini' : item.revoked ? 'Sesi ditamatkan' : 'Belum ditamatkan') + '</span></div>' +
        '<p>' + (item.site === 'review' ? 'H4SX Review' : 'H4SX Store') + '</p><small>Login: ' + escape(date(item.authTime)) + '<br>Aktiviti direkod: ' + escape(date(item.lastSeen)) + '</small>' +
        '<div class="h4sx-session-device-actions"><button type="button" data-device-action="' + (item.revoked ? 'delete-record' : 'revoke-one') + '" data-device-id="' + escape(item.id) + '">' + (item.revoked ? 'Padam rekod' : 'Logout sesi ini') + '</button></div></article>'
      ).join('') : '<p>Belum ada perangkat direkod.</p>';
      status(data.devices.length + ' rekod perangkat. Rekod lama sebelum pemasangan tidak tersedia.');
      revokeButton.disabled = false;
    } catch (error) {
      if (current !== generation) return;
      root.querySelector('[data-session-list]').textContent = '';
      status(error.message, true);
    } finally { refreshButton.disabled = false; }
  }

  async function deviceAction(button) {
    const item = visibleDevices.find(device => device.id === button.dataset.deviceId);
    if (!item) return;
    const action = button.dataset.deviceAction;
    const label = item.device + ' · ' + item.browser + ' (' + (item.site === 'review' ? 'H4SX Review' : 'H4SX Store') + ')';
    const message = action === 'delete-record'
      ? 'Padam rekod sesi yang sudah ditamatkan ini? ' + label
      : 'Logout sesi ini sahaja? ' + label + (item.current ? '\nSesi yang sedang anda guna akan ditamatkan.' : '\nSesi lain kekal login.');
    if (!confirm(message)) return;
    button.disabled = true;
    status(action === 'delete-record' ? 'Memadam rekod sesi…' : 'Menamatkan sesi terpilih…');
    try {
      const result = await request(action, { sessionId:item.id });
      if (action === 'revoke-one' && result.current) {
        const logout = context?.signOut;
        if (logout) await logout();
        close();
        return;
      }
      if (action === 'revoke-one' && result.realtimeLogout === false) alert('Sesi disekat. Perangkat terpilih akan logout pada pemeriksaan seterusnya, biasanya dalam 60 saat ketika halaman terbuka.');
      await refresh();
    } catch (error) { status(error.message, true); button.disabled = false; }
  }

  async function revokeAll() {
    if (!confirm('Logout semua sesi akaun admin H4SX pada kedua-dua website? Sesi ini juga akan ditamatkan dan semua perangkat perlu login semula.')) return;
    const button = ensurePanel().querySelector('[data-session-revoke]');
    button.disabled = true;
    status('Menamatkan semua sesi…');
    try {
      const result = await request('revoke-all');
      const logout = context?.signOut;
      if (logout) await logout();
      close();
      alert(result.realtimeLogout ? 'Semua sesi admin ditamatkan. Login semula untuk meneruskan.' : 'Token semua sesi dibatalkan. Penamatan segera pada tab lain belum disahkan; token lama boleh kekal sehingga 1 jam.');
    } catch (error) { status(error.message, true); button.disabled = false; }
  }

  function bind(next) {
    generation++;
    const current = generation;
    unsubscribe?.(); unsubscribe = null;
    clearInterval(timer); timer = null;
    context = next?.user?.uid === ADMIN_UID ? next : null;
    currentSessionId = ''; signedInTime = 0; securityState = null; visibleDevices = [];
    if (!context) { close(); return; }
    const user = context.user;
    user.getIdTokenResult().then(result => {
      if (current !== generation) return;
      signedInTime = Date.parse(result.authTime);
      unsubscribe = context.watchRevocations(value => {
        if (current !== generation) return;
        securityState = typeof value === 'number' ? { revokedAt:value } : value;
        applySecurityState();
      });
    }).catch(() => {});
    request('register').then(() => { if (current === generation) { lastRegister = Date.now(); startValidation(); } }).catch(() => {});
  }
  function applySecurityState() {
    if (!context || !securityState) return;
    if (Number(securityState.revokedAt) > signedInTime || (currentSessionId && securityState.blockedSessions?.[currentSessionId])) {
      signOutEverywhereLocally().catch(() => {});
    }
  }
  function startValidation() {
    if (timer || !context) return;
    timer = setInterval(() => { if (!document.hidden) request('check').catch(() => {}); }, 60000);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !context) return;
    const action = Date.now() - lastRegister > 300000 ? 'register' : 'check';
    request(action).then(() => { if (action === 'register') lastRegister = Date.now(); }).catch(() => {});
  });

  window.H4SXAdminSessions = {
    bind,
    async endCurrentSession() {
      if (!context) return;
      try {
        if (!currentSessionId) await request('register');
        if (currentSessionId) await request('revoke-one', { sessionId:currentSessionId });
      } catch { /* Normal local logout must work even when the API is offline. */ }
    },
    open() {
      if (!context) { alert('Login admin dahulu untuk lihat perangkat.'); return; }
      ensurePanel().hidden = false;
      panel.querySelector('[data-session-close]').focus();
      refresh();
    }
  };
})();
