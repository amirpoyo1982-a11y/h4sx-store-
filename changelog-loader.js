const CHANGELOG_DATA = {
  title: 'Kongsi & Kawal Kedai',
  subtitle: 'Kongsi produk dengan mudah, nikmati paparan lebih kemas dan kawal notis kedai dengan lebih jelas.',
  date: '6 November 2026',
  releasedAt: '2026-11-06T00:00:00+08:00',
  time: 'Update pelanggan',
  version: 'v6.3',
  sections: [
    {
      type: 'added',
      title: 'Kongsi produk',
      items: [
        { icon: 'fa-link', text: '<strong>Copy Link pada kad produk</strong><br>Salin pautan produk terus daripada kad individu.' },
        { icon: 'fa-link', text: '<strong>Copy Link pilihan variant</strong><br>Salin pautan variant yang dipilih terus daripada modal produk.' }
      ]
    },
    {
      type: 'removed',
      title: 'Paparan produk',
      items: [
        { icon: 'fa-image', text: '<strong>Ruang gambar produk lebih luas</strong><br>Butang WhatsApp dan “Pilih Type” dibuang daripada lapisan atas gambar kad produk.' }
      ]
    },
    {
      type: 'info',
      title: 'Kawalan notis kedai',
      items: [
        { icon: 'fa-toggle-on', text: '<strong>Notis tutup Store dan Review dikawal berasingan</strong><br>Admin boleh memilih untuk memaparkan atau menyembunyikan setiap notis tutup biasa; notis maintenance tetap dipaparkan.' },
        { icon: 'fa-store', text: '<strong>Status TUTUP kekal kelihatan</strong><br>Apabila notis penuh disembunyikan, status kedai pada bar atas tetap memaparkan TUTUP. Pelanggan boleh melihat katalog, tetapi pesanan tetap disekat selagi <code>bukakedai</code> ditutup.' }
      ]
    }
  ]
};

function changelogIconClass(icon, fallback) {
  const value = String(icon || fallback || 'fa-circle-info').trim();
  if (/^fa-(solid|regular|brands)\s/.test(value)) return value;
  return 'fa-solid ' + value;
}

function changelogSectionMeta(type) {
  if (type === 'added') return { icon: 'fa-plus-circle', label: 'Baru', className: 'added' };
  if (type === 'fixed') return { icon: 'fa-wrench', label: 'Fix', className: 'fixed' };
  if (type === 'removed') return { icon: 'fa-trash', label: 'Buang', className: 'removed' };
  return { icon: 'fa-circle-info', label: 'Info', className: 'info' };
}

function renderChangelog(data) {
  const changelogBody = document.getElementById('changelog-body');
  if (!changelogBody) return;

  const titleEl = document.getElementById('changelog-title');
  const dateEl = document.getElementById('changelog-date-text');
  const timeEl = document.getElementById('changelog-time-text');
  const versionEl = document.getElementById('changelog-version');

  if (titleEl) titleEl.textContent = data.title || 'Apa Yang Baru - H4SX STORE';
  if (dateEl) dateEl.textContent = data.date || '';
  if (timeEl) timeEl.textContent = data.time || 'Terkini';
  if (versionEl) versionEl.textContent = data.version || '';

  const sections = Array.isArray(data.sections) ? data.sections : [];
  const totalItems = sections.reduce((sum, section) => sum + ((section.items || []).length), 0);
  let html = '<div class="cl-release-intro">';
  html += '<div class="cl-release-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>';
  html += '<div><span>UPDATE KEDAI</span><p>' + (data.subtitle || 'Pengalaman H4SX STORE yang lebih baik.') + '</p></div>';
  html += '<strong>' + totalItems + '<small>perubahan</small></strong>';
  html += '</div><div class="cl-release-grid">';
  for (const section of sections) {
    const meta = changelogSectionMeta(section.type);
    html += '<section class="cl-release-group ' + meta.className + '">';
    html += '<h3 class="cl-release-group-title"><i class="fa-solid ' + meta.icon + '"></i>' + (section.title || meta.label) + '</h3>';
    html += '<div class="cl-release-group-items">';
    for (const item of (section.items || [])) {
      html += '<article class="cl-release-card ' + meta.className + '">';
      html += '<span class="cl-release-card-icon"><i class="' + changelogIconClass(item.icon, meta.icon) + '"></i></span>';
      html += '<p>' + (item.text || '') + '</p>';
      html += '</article>';
    }
    html += '</div></section>';
  }
  html += '</div>';

  changelogBody.innerHTML = html;
}

renderChangelog(CHANGELOG_DATA);

// Last-Modified comes from the deployed index.htm, so the publish date updates with each Vercel deployment.
async function loadLastPublishedAt() {
  if (location.protocol === 'file:') return;
  try {
    const url = new URL('./index.htm', location.href);
    const response = await fetch(url, { method:'HEAD', cache:'no-store' });
    if (!response.ok) return;
    const value = response.headers.get('Last-Modified');
    const published = value ? new Date(value) : null;
    if (!published || Number.isNaN(published.getTime()) || published.getTime() > Date.now() + 300000) return;
    window.H4SX_LAST_PUBLISH_AT = published.toISOString();
    const dateEl = document.getElementById('changelog-date-text');
    const timeEl = document.getElementById('changelog-time-text');
    if (dateEl) dateEl.textContent = published.toLocaleDateString('ms-MY', { day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Kuala_Lumpur' });
    if (timeEl) timeEl.textContent = 'Last publish · ' + published.toLocaleTimeString('ms-MY', { hour:'numeric', minute:'2-digit', timeZone:'Asia/Kuala_Lumpur' });
  } catch (error) { console.warn('Tarikh publish tidak dapat disemak:', error); }
}
loadLastPublishedAt();
