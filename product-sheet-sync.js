// Optional admin-only sync. Firebase save/publish never awaits this network request.
(() => {
  const fullSync = document.getElementById('product-sheet-full-sync');
  const statusButton = document.getElementById('product-sheet-status');
  const output = document.getElementById('product-sheet-result');
  if (!fullSync || !statusButton || !output || !window.firebase) return;
  let busy = false, dirty = false, timer, paused = false, retryCount = 0;
  const messages = {
    UNAUTHENTICATED: 'Sesi tamat. Log masuk semula.',
    PERMISSION_DENIED: 'UID admin belum dibenarkan dalam PRODUCT_SYNC_ADMIN_UIDS.',
    RATE_LIMITED: 'Tunggu 60 saat sebelum full sync seterusnya.',
    SYNC_NOT_CONFIGURED: 'Auto sync belum dikonfigurasi di Vercel. Lihat PRODUCT-SHEETS-SYNC.md.'
  };
  function schedule(ms = 800) {
    dirty = true;
    clearTimeout(timer);
    if (!paused && firebase.auth().currentUser) timer = setTimeout(() => { timer = undefined; run('sync'); }, ms);
  }
  async function run(action) {
    if (busy) { if (action !== 'status') dirty = true; return; }
    const user = firebase.auth().currentUser;
    if (!user) { output.textContent = 'Log masuk sebagai admin dahulu.'; return; }
    busy = true;
    dirty = false;
    fullSync.disabled = statusButton.disabled = true;
    if (action !== 'sync') output.textContent = action === 'full-sync' ? 'Menjalankan full sync...' : 'Menyemak status...';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/product-sheet-sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }), signal: controller.signal, cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) {
        if ([401, 403].includes(response.status) || result.error === 'SYNC_NOT_CONFIGURED') paused = true;
        throw new Error(messages[result.error] || `Sync belum berjaya (${result.error || response.status}). Produk Firebase tetap disimpan.`);
      }
      retryCount = 0;
      paused = false;
      if (result.state === 'success') output.textContent = `Sync terakhir berjaya: ${result.products} produk • ${result.lastSuccessAt}.`;
      else if (result.state === 'not-run') output.textContent = 'Belum ada sync selesai. Tekan Full Sync selepas setup Vercel.';
      else output.textContent = `Sync ${result.state}${result.code ? ' (' + result.code + ')' : ''}. Akan cuba semula; simpan produk tidak terjejas.`;
      if (result.pending) schedule(Math.max(15000, Math.min(900000, Number(result.nextAttemptAt || 0) - Date.now())));
    } catch (error) {
      output.textContent = error.name === 'AbortError' ? 'Sync tamat masa. Akan semak/cuba semula; produk Firebase tetap disimpan.'
        : error instanceof TypeError || error instanceof SyntaxError ? 'API sync belum tersedia. Semak deployment Vercel; produk Firebase tetap disimpan.' : error.message;
      console.warn('Product Sheet sync request failed:', error.name);
      if (!paused && action !== 'status') schedule(Math.min(300000, 15000 * (2 ** Math.min(retryCount++, 4))));
    } finally {
      clearTimeout(timeout);
      busy = false;
      fullSync.disabled = statusButton.disabled = false;
      if (dirty && !timer && !paused) schedule();
    }
  }
  fullSync.addEventListener('click', () => { paused = false; run('full-sync'); });
  statusButton.addEventListener('click', () => run('status'));
  window.addEventListener('h4sx:catalog-saved', () => schedule());
  window.addEventListener('online', () => schedule());
  firebase.auth().onAuthStateChanged(user => {
    clearTimeout(timer); timer = undefined; paused = false;
    if (user) schedule();
  });
  setInterval(() => { if (!paused && !busy && navigator.onLine && firebase.auth().currentUser) schedule(); }, 60000);
})();
