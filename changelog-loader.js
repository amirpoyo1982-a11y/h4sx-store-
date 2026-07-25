const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '26 July 2026',
  time: 'Update hari ini',
  version: 'v2.1',
  sections: [
    {
      type: 'added',
      title: 'Ditambah Hari Ini',
      items: [
        {
          icon: 'fa-headset',
          text: '<strong>Kad konsultasi inventory</strong> - admin boleh tambah satu card konsultasi dalam inventory setiap game untuk urusan Gamepass, item khas atau pakej yang perlu semakan dahulu.'
        },
        {
          icon: 'fa-whatsapp',
          text: '<strong>Popup WhatsApp konsultasi</strong> - pelanggan kini dapat pilihan Cancel atau Pergi WhatsApp sebelum chat admin, dengan paparan ringan dan tidak menggelapkan skrin.'
        },
        {
          icon: 'fa-globe',
          text: '<strong>Domain rasmi baharu</strong> - website utama kini di <strong>www.h4sxmy.xyz</strong> dan laman ulasan di <strong>review.h4sxmy.xyz</strong>.'
        },
        {
          icon: 'fa-link',
          text: '<strong>Gist game lebih tahan</strong> - pembaca game kini menyokong struktur data biasa atau dibungkus supaya katalog tidak mudah kembali kepada cache lama.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Diperbaiki Hari Ini',
      items: [
        {
          icon: 'fa-box-open',
          text: '<strong>Item Non Perm</strong> - item dengan nama Non perm tidak lagi tersalah ditapis sebagai Permanent Fruit dan akan muncul semula dalam katalog Blox Fruits.'
        },
        {
          icon: 'fa-rotate',
          text: '<strong>Cache katalog</strong> - versi skrip dinaikkan supaya browser lebih cepat menerima pembetulan katalog selepas website dikemaskini.'
        },
        {
          icon: 'fa-calendar-check',
          text: '<strong>Tarikh changelog</strong> - simbol masa lama yang mengelirukan dibuang dan paparan release dikemas kini kepada versi v2.1.'
        }
      ]
    },
    {
      type: 'removed',
      title: 'Dibuang Hari Ini',
      items: [
        {
          icon: 'fa-trash',
          text: '<strong>Padanan Permanent yang terlalu luas</strong> - filter lama tidak lagi menyembunyikan item hanya kerana nama mengandungi perkataan Non perm.'
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
