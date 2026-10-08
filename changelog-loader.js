const CHANGELOG_DATA = {
  title: 'H4SX Lebih Lancar',
  subtitle: 'Perubahan terbaru untuk pelanggan: lebih mudah pilih item, semak maklumat dan terus chat kami.',
  date: '8 Oktober 2026',
  releasedAt: '2026-10-08T00:00:00+08:00',
  time: 'Update pelanggan',
  version: 'v6.1',
  sections: [
    {
      type: 'added',
      title: 'WhatsApp & pesanan',
      items: [
        { icon: 'fa-brands fa-whatsapp', text: '<strong>Chat terus tanpa tunggu</strong><br>Pada pilihan konsultasi, tekan Terus ke WhatsApp tanpa menunggu masa tamat.' },
        { icon: 'fa-comment-dots', text: '<strong>Mesej lebih mudah dibaca</strong><br>Ayat WhatsApp kini ikut item yang dipilih dan bahagian penting ditulis tebal.' }
      ]
    },
    {
      type: 'info',
      title: 'Banner & game',
      items: [
        { icon: 'fa-hand-pointer', text: '<strong>Banner boleh diseret</strong><br>Gerakkan promosi ke kiri atau kanan tanpa tersalah buka pautan.' },
        { icon: 'fa-circle-exclamation', text: '<strong>Notis game lebih jelas</strong><br>Maklumat penting sebelum membeli dipaparkan pada game yang berkaitan.' }
      ]
    },
    {
      type: 'fixed',
      title: 'Pengalaman kedai',
      items: [
        { icon: 'fa-link', text: '<strong>Pautan game terus dibuka</strong><br>Masuk melalui link promosi tidak lagi mengulang intro kedai.' },
        { icon: 'fa-clock', text: '<strong>Waktu kedai lebih tepat</strong><br>Jadual yang melangkaui tengah malam kini mengikut waktu Malaysia dengan betul.' },
        { icon: 'fa-mobile-screen-button', text: '<strong>Lebih selesa di telefon</strong><br>Paparan awal lebih ringan dan notis tidak lagi bertindih di atas skrin.' }
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
