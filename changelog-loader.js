const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '16 July 2026',
  time: 'Latest',
  version: 'v1.7',
  sections: [
    {
      type: 'added',
      title: 'Ditambah',
      items: [
        {
          icon: 'fa-receipt',
          text: '<strong>Histori Transaksi</strong> - pelanggan kini boleh semak pembelian menggunakan nombor transaksi atau nombor WhatsApp.'
        },
        {
          icon: 'fa-user-shield',
          text: '<strong>Panel transaksi admin</strong> - admin boleh tambah, edit, padam dan lihat transaksi terkini terus dari website.'
        },
        {
          icon: 'fa-wand-magic-sparkles',
          text: '<strong>Generate nombor transaksi</strong> - code H4SX rawak boleh dijana terus semasa membuat transaksi baru.'
        },
        {
          icon: 'fa-image',
          text: '<strong>Paste gambar produk</strong> - screenshot boleh dipaste terus dalam transaksi tanpa perlu upload satu-satu.'
        },
        {
          icon: 'fa-chart-line',
          text: '<strong>Statistik pelawat admin</strong> - jumlah dan sejarah pelawat website kini boleh dilihat oleh admin sahaja.'
        },
        {
          icon: 'fa-calendar-clock',
          text: '<strong>Tarikh transaksi custom</strong> - admin boleh set tarikh dan masa asal untuk transaksi lama.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Diperbaiki',
      items: [
        {
          icon: 'fa-eye-slash',
          text: '<strong>Privasi nombor WhatsApp</strong> - nombor customer dipaparkan dalam bentuk disembunyikan seperti 601*******32.'
        },
        {
          icon: 'fa-trash-can',
          text: '<strong>Padam transaksi</strong> - masalah admin tidak dapat memadam transaksi telah diperbaiki.'
        }
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

  if (titleEl) titleEl.textContent = data.title || 'Apa Yang Baru - H4SX STORE';
  if (dateEl) dateEl.textContent = data.date || '';
  if (timeEl) timeEl.textContent = data.time || '';

  const totalItems = (data.sections || []).reduce((sum, section) => sum + ((section.items || []).length), 0);
  let html = '<div class="changelog-summary">';
  html += '<div><span>Release</span><strong>' + (data.version || 'Latest') + '</strong></div>';
  html += '<div><span>Kemaskini</span><strong>' + totalItems + ' item</strong></div>';
  html += '<div><span>Status</span><strong>Live</strong></div>';
  html += '</div>';

  for (const section of (data.sections || [])) {
    const meta = changelogSectionMeta(section.type);
    const items = Array.isArray(section.items) ? section.items : [];

    html += '<div class="changelog-section-card ' + meta.className + '">';
    html += '<div class="changelog-section-title ' + meta.className + '"><span class="changelog-section-icon"><i class="fa-solid ' + meta.icon + '"></i></span><span>' + (section.title || meta.label) + '</span><b>' + items.length + '</b></div>';
    html += '<ul class="changelog-list">';
    for (const item of items) {
      html += '<li class="' + meta.className + '"><span class="changelog-item-icon"><i class="' + changelogIconClass(item.icon, meta.icon) + '"></i></span><span>' + (item.text || '') + '</span></li>';
    }
    html += '</ul>';
    html += '</div>';
  }

  changelogBody.innerHTML = html;
}

renderChangelog(CHANGELOG_DATA);
