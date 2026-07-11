const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '11 July 2026',
  time: '17:30 PM',
  version: 'v1.4',
  sections: [
    {
      type: 'added',
      title: 'Ditambah',
      items: [
        {
          icon: 'fa-palette',
          text: '<strong>Redesign website utama</strong> - reka bentuk website jualan dikemas semula supaya nampak lebih fresh, modern dan tak membosankan.'
        },
        {
          icon: 'fa-layer-group',
          text: '<strong>Selection Roblox & Free Fire baru</strong> - pelanggan kini pilih platform besar dahulu sebelum melihat game, item atau akaun yang tersedia.'
        },
        {
          icon: 'fa-cube',
          text: '<strong>Roblox lebih tersusun</strong> - semua game dan item Roblox dikumpulkan dalam bahagian Roblox sahaja supaya tidak bercampur dengan platform lain.'
        },
        {
          icon: 'fa-crosshairs',
          text: '<strong>Free Fire diasingkan</strong> - item dan akaun Free Fire kini berada dalam pilihan Free Fire sahaja, lebih mudah dicari.'
        },
        {
          icon: 'fa-sparkles',
          text: '<strong>Game picker dinaik taraf</strong> - bahagian Pilih Game Anda kini ada card platform bergambar, efek glow, badge kemas dan hover yang lebih cantik.'
        },
        {
          icon: 'fa-circle-half-stroke',
          text: '<strong>Dark mode & light mode dipolish</strong> - warna, border dan background section baru diselaraskan supaya sedap dilihat di dua-dua mode.'
        },
        {
          icon: 'fa-bullhorn',
          text: '<strong>Notis sistem ulasan</strong> - popup makluman masalah ulasan ditambah dengan pilihan hide selama 1 jam 30 minit.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Diperbaiki',
      items: [
        {
          icon: 'fa-up-right-and-down-left-from-center',
          text: '<strong>Card game terlalu besar</strong> - masalah gambar game membesar bila item sedikit telah diperbaiki.'
        },
        {
          icon: 'fa-filter-circle-check',
          text: '<strong>Filter platform lebih tepat</strong> - Free Fire kini boleh dikesan daripada inventory juga, bukan bergantung pada senarai game lama sahaja.'
        },
        {
          icon: 'fa-mobile-screen-button',
          text: '<strong>Paparan phone lebih kemas</strong> - grid game dan platform card dilaraskan supaya tidak sempit atau terlalu besar di mobile.'
        },
        {
          icon: 'fa-tags',
          text: '<strong>Badge game lebih stabil</strong> - label seperti NEW dan AKAN DIHAPUS kini duduk lebih kemas pada gambar game.'
        },
        {
          icon: 'fa-shield-halved',
          text: '<strong>Cover image platform lebih selamat</strong> - gambar latar platform kini dibersihkan dahulu supaya tidak mudah rosak jika data luar ada simbol pelik.'
        },
        {
          icon: 'fa-code',
          text: '<strong>Script disemak</strong> - perubahan JavaScript telah diperiksa supaya tiada syntax error sebelum publish.'
        }
      ]
    },
    {
      type: 'removed',
      title: 'Dibuang',
      items: [
        {
          icon: 'fa-trash',
          text: '<strong>Selection lama yang bercampur</strong> - gaya pilihan kategori lama yang kurang menarik telah diganti dengan flow platform baru.'
        },
        {
          icon: 'fa-eraser',
          text: '<strong>Isi changelog lama</strong> - senarai update lama dibuang dan digantikan dengan changelog terbaru untuk release ini.'
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
