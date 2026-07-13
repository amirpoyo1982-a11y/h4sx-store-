const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '13 July 2026',
  time: 'Latest',
  version: 'v1.5',
  sections: [
    {
      type: 'added',
      title: 'Ditambah',
      items: [
        {
          icon: 'fa-link',
          text: '<strong>Direct link produk</strong> - setiap barang kini boleh dibuka terus melalui link khas, jadi senang share item tertentu kepada pelanggan.'
        },
        {
          icon: 'fa-copy',
          text: '<strong>Copy Link dalam detail produk</strong> - butang Copy Link ditambah supaya link barang boleh disalin terus dari popup produk.'
        },
        {
          icon: 'fa-play',
          text: '<strong>Slider gambar & video Free Fire</strong> - detail produk Free Fire kini ada gallery yang boleh diseret kiri kanan untuk lihat gambar dan video.'
        },
        {
          icon: 'fa-chevron-left',
          text: '<strong>Anak panah media produk</strong> - popup produk kini ada butang kiri dan kanan untuk tukar media dengan lebih mudah di PC dan phone.'
        },
        {
          icon: 'fa-image',
          text: '<strong>Mode banner promo baru</strong> - banner promosi kini boleh guna fit cover atau contain melalui Gist supaya gambar biasa tetap nampak kemas.'
        },
        {
          icon: 'fa-wand-magic-sparkles',
          text: '<strong>Background blur untuk banner</strong> - jika gambar bukan saiz banner panjang, website akan isi ruang kosong dengan blur background yang lebih cantik.'
        },
        {
          icon: 'fa-mobile-screen-button',
          text: '<strong>Support gambar PC dan phone</strong> - banner promosi masih boleh guna gambar berasingan untuk desktop dan mobile melalui setting Gist.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Diperbaiki',
      items: [
        {
          icon: 'fa-gauge-high',
          text: '<strong>Load gambar dipercepatkan</strong> - gambar produk dan banner dioptimumkan supaya website tidak terlalu lama tunggu media penuh.'
        },
        {
          icon: 'fa-photo-film',
          text: '<strong>Poster video lebih tepat</strong> - item video kini boleh tunjuk gambar poster biasa pada card, bukan paparan video kosong atau pelik.'
        },
        {
          icon: 'fa-crosshairs',
          text: '<strong>Media Free Fire lebih kemas</strong> - gambar dan video tidak lagi dipaksa kecil dalam satu kotak; media kini dipaparkan satu persatu dalam slider.'
        },
        {
          icon: 'fa-expand',
          text: '<strong>Popup detail produk diperbaiki</strong> - paparan full produk kini lebih sesuai untuk melihat gambar dan video dengan jelas.'
        },
        {
          icon: 'fa-window-restore',
          text: '<strong>Banner PC lebih fleksibel</strong> - banner tidak lagi wajib gambar landscape sempurna; mode contain boleh bantu gambar biasa nampak elok.'
        },
        {
          icon: 'fa-code',
          text: '<strong>Script disemak semula</strong> - perubahan JavaScript telah diperiksa supaya tiada syntax error sebelum publish.'
        }
      ]
    },
    {
      type: 'removed',
      title: 'Dibuang',
      items: [
        {
          icon: 'fa-trash',
          text: '<strong>Popup masalah ulasan lama</strong> - notis gangguan ulasan yang sudah selesai telah dibuang daripada website utama.'
        },
        {
          icon: 'fa-eraser',
          text: '<strong>Isi changelog lama</strong> - senarai release lama digantikan dengan changelog terbaru supaya pelanggan nampak update semasa sahaja.'
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
