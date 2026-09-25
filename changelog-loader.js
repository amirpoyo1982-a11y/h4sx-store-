const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '26 September 2026',
  time: '12:45 AM (MYT)',
  version: 'v5.3',
  sections: [
    {
      type: 'added',
      title: 'Ciri Baharu',
      items: [
        {
          icon: 'fa-receipt',
          text: '<strong>Salin nombor transaksi</strong> terus daripada rekod pembelian.'
        },
        {
          icon: 'fa-cart-shopping',
          text: '<strong>Troli lebih lengkap</strong> dengan pilihan item, kuantiti dan ringkasan pesanan.'
        },
        {
          icon: 'fa-link',
          text: '<strong>Pautan promo terus</strong> membuka produk dan mengisi kod secara automatik.'
        },
        {
          icon: 'fa-copy',
          text: '<strong>Salin deskripsi produk</strong> dengan satu tekan.'
        },
        {
          icon: 'fa-eye-slash',
          text: '<strong>Ruang ulasan boleh dipapar atau disorok</strong> tanpa membuang butang hantar dan salin pautan.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Penambahbaikan',
      items: [
        {
          icon: 'fa-bolt',
          text: '<strong>Website lebih ringan</strong> selepas fungsi lama dan proses latar yang tidak diperlukan dibersihkan.'
        },
        {
          icon: 'fa-mobile-screen',
          text: '<strong>Susun atur responsif</strong> kini lebih kemas pada komputer dan telefon.'
        },
        {
          icon: 'fa-clock',
          text: '<strong>Promo lebih stabil</strong> termasuk masa, kuota dan harga selepas halaman dimuat semula.'
        },
        {
          icon: 'fa-store',
          text: '<strong>Status waktu operasi diperbaharui</strong> dengan paparan yang lebih kemas dan jelas.'
        }
      ]
    },
    {
      type: 'removed',
      title: 'Dibuang',
      items: [
        {
          icon: 'fa-truck-fast',
          text: '<strong>Paparan Delivery Live</strong> telah dibuang untuk menjadikan halaman utama lebih ringkas.'
        },
        {
          icon: 'fa-code',
          text: '<strong>Alat bantuan lama</strong> yang tidak digunakan telah dibersihkan.'
        },
        {
          icon: 'fa-grip-lines',
          text: '<strong>Bar teks bergerak lama</strong> telah dibuang daripada bahagian atas website.'
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
  if (timeEl) timeEl.textContent = data.time || 'Terkini';

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
