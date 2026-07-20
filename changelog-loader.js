const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '20 July 2026',
  time: 'Latest',
  version: 'v1.8',
  sections: [
    {
      type: 'added',
      title: 'Ditambah Hari Ini',
      items: [
        {
          icon: 'fa-mobile-screen-button',
          text: '<strong>Mobile view premium</strong> - paparan phone H4SX dikemas semula dengan header compact, menu lebih kemas, banner lebih ngam dan product card 2 column yang lebih cantik.'
        },
        {
          icon: 'fa-robot',
          text: '<strong>H4SX Helper tanpa API</strong> - helper kini guna jawapan pantas dari website sendiri untuk bantu pelanggan tentang cara beli, harga, stok, resit, proses dan link admin.'
        },
        {
          icon: 'fa-comments',
          text: '<strong>Balasan.ID widget</strong> - widget support Balasan.ID ditambah pada website utama H4SX untuk percubaan live chat/support.'
        },
        {
          icon: 'fa-link',
          text: '<strong>URL rasmi baru</strong> - semua link lama ditukar kepada domain baru H4SX: h4sxmy.vercel.app dan h4sxreview.vercel.app.'
        },
        {
          icon: 'fa-image',
          text: '<strong>H4SX Helper logo</strong> - logo helper baru dipasang khas pada bubble dan panel helper sahaja.'
        },
        {
          icon: 'fa-wand-magic-sparkles',
          text: '<strong>Price List Maker</strong> - tool poster price list dibuat dengan import gambar dari file, clipboard, buang background hitam dan template bingkai H4SX STORE.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Diperbaiki Hari Ini',
      items: [
        {
          icon: 'fa-gauge-high',
          text: '<strong>Phone layout lebih ringan</strong> - hero, banner promo, game card, product card dan modal produk disusun semula supaya kurang sempit dan lebih smooth di mobile.'
        },
        {
          icon: 'fa-window-restore',
          text: '<strong>Modal produk mobile</strong> - paparan detail produk di phone kini jadi gaya bottom sheet, gambar/video lebih terkawal dan button tidak tenggelam.'
        },
        {
          icon: 'fa-arrows-left-right',
          text: '<strong>Banner dan media produk</strong> - carousel/banner dikemas supaya boleh digeser dan link produk lebih senang digunakan.'
        },
        {
          icon: 'fa-seedling',
          text: '<strong>Gambar fruit non-perm</strong> - gambar inventory Blox Fruits non-permanent fruit dalam Gist telah diganti dengan link gambar baru.'
        },
        {
          icon: 'fa-broom',
          text: '<strong>Changelog dibersihkan</strong> - changelog lama dibuang dan release ini hanya memaparkan update yang dibuat hari ini sahaja.'
        }
      ]
    },
    {
      type: 'removed',
      title: 'Dibuang Hari Ini',
      items: [
        {
          icon: 'fa-plug-circle-xmark',
          text: '<strong>Kebergantungan AI API pada helper utama</strong> - helper H4SX tidak lagi tersangkut menunggu Gemini/OpenAI untuk jawapan asas pelanggan.'
        },
        {
          icon: 'fa-trash',
          text: '<strong>Isi changelog lama</strong> - semua nota update lama telah dikeluarkan daripada paparan changelog terbaru.'
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