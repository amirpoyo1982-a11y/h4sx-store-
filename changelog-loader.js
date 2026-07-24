const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '25 July 2026',
  time: 'Update hari ini',
  version: 'v2.0',
  sections: [
    {
      type: 'added',
      title: 'Ditambah Hari Ini',
      items: [
        {
          icon: 'fa-square-poll-vertical',
          text: '<strong>Custom Vote berasingan</strong> - undian H4SX STORE dan H4SX Review kini menggunakan ruang data masing-masing supaya tajuk, pilihan dan kiraan tidak bercampur.'
        },
        {
          icon: 'fa-clock',
          text: '<strong>Masa tamat undian</strong> - admin boleh set tarikh dan masa tamat; pilihan automatik terkunci selepas tamat, manakala keputusan masih boleh dilihat.'
        },
        {
          icon: 'fa-image',
          text: '<strong>Logo pada card vote</strong> - card undian kini menggunakan logo H4SX STORE supaya lebih kemas dan mudah dikenali.'
        },
        {
          icon: 'fa-mobile-screen-button',
          text: '<strong>Mobile hardening</strong> - susun atur khas phone ditambah untuk mengunci saiz card, modal dan kawalan bawah agar lebih stabil.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Diperbaiki Hari Ini',
      items: [
        {
          icon: 'fa-table-cells-large',
          text: '<strong>Pilih game lebih compact</strong> - card Roblox dan Free Fire pada phone kini dua kolum, tidak lagi jadi carousel atau kotak terlalu besar.'
        },
        {
          icon: 'fa-mobile-screen-button',
          text: '<strong>Game card phone</strong> - grid game, gambar dan tajuk dikemas supaya muat tanpa melimpah atau mengubah lebar halaman.'
        },
        {
          icon: 'fa-window-maximize',
          text: '<strong>Changelog phone</strong> - pop-up changelog kini terkunci di tengah skrin, boleh scroll dalam kotak sendiri dan tidak terkeluar dari paparan.'
        }
      ]
    },
    {
      type: 'removed',
      title: 'Dibuang Hari Ini',
      items: [
        {
          icon: 'fa-trash',
          text: '<strong>Gaya mobile bertindih</strong> - rule lama yang menjadikan card platform besar atau boleh bergerak ke tepi telah ditindih dengan susun atur baru yang stabil.'
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
