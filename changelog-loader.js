const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '29 September 2026',
  time: '2:05 AM (MYT)',
  version: 'v5.4',
  sections: [
    {
      type: 'added',
      title: 'Baharu',
      items: [
        {
          icon: 'fa-eye',
          text: '<strong>Kawalan paparan ulasan</strong> membolehkan senarai review ditunjuk atau disorok.'
        },
        {
          icon: 'fa-link',
          text: '<strong>Hantar dan salin pautan ulasan</strong> kekal tersedia walaupun senarai review disorok.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Dikemas Kini',
      items: [
        {
          icon: 'fa-clock',
          text: '<strong>Waktu operasi</strong> kini lebih kemas, jelas dan mesra telefon.'
        },
        {
          icon: 'fa-window-maximize',
          text: '<strong>Changelog lebih kecil</strong> supaya mudah dibaca tanpa menutup terlalu banyak skrin.'
        }
      ]
    },
    {
      type: 'removed',
      title: 'Dibuang',
      items: [
        {
          icon: 'fa-truck-fast',
          text: '<strong>Delivery Live</strong>, penukar mata wang dan kalkulator harga dibuang.'
        },
        {
          icon: 'fa-grip-lines',
          text: '<strong>Bar teks bergerak</strong> serta alat lama yang tidak diperlukan dibersihkan.'
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
