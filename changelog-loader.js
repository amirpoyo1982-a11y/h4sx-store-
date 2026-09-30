const CHANGELOG_DATA = {
  title: 'Kedai Lebih Mudah',
  subtitle: 'Harga lebih jelas, promo lebih tepat dan pengalaman membeli lebih kemas.',
  date: '1 October 2026',
  time: 'Versi terkini',
  version: 'v6.0',
  sections: [
    {
      type: 'added',
      title: 'Pembelian',
      items: [
        { icon: 'fa-tags', text: '<strong>Harga variant automatik</strong><br>Setiap pilihan kini terus menunjukkan harga sebenar yang telah ditetapkan.' },
        { icon: 'fa-ticket', text: '<strong>Diskaun ikut pilihan</strong><br>Harga variant berubah selepas kod promo berjaya digunakan.' },
        { icon: 'fa-bullseye', text: '<strong>Promo lebih tepat</strong><br>Kod khas hanya memberi diskaun pada variant yang layak, bukan semua pilihan.' }
      ]
    },
    {
      type: 'info',
      title: 'Pesanan',
      items: [
        { icon: 'fa-box-open', text: '<strong>Maklumat pesanan lebih jelas</strong><br>Status, nota dan maklumat serahan lebih mudah dilihat serta disalin.' }
      ]
    },
    {
      type: 'fixed',
      title: 'Paparan',
      items: [
        { icon: 'fa-mobile-screen-button', text: '<strong>Panduan telefon 2 × 2</strong><br>Empat langkah membeli kini lebih kecil dan tidak memanjang ke bawah.' },
        { icon: 'fa-list-check', text: '<strong>Aliran membeli dipermudah</strong><br>Pilih item, hubungi WhatsApp, sahkan dan terima pesanan dengan lebih jelas.' },
        { icon: 'fa-bolt', text: '<strong>Update lebih cepat dikesan</strong><br>Cache website diperbaharui supaya versi terkini lebih mudah muncul.' }
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

  const sections = Array.isArray(data.sections) ? data.sections : [];
  const totalItems = sections.reduce((sum, section) => sum + ((section.items || []).length), 0);
  let html = '<div class="cl-release-intro">';
  html += '<div class="cl-release-icon"><i class="fa-solid fa-store"></i></div>';
  html += '<div><span>UPDATE KEDAI</span><p>' + (data.subtitle || 'Pengalaman H4SX STORE yang lebih baik.') + '</p></div>';
  html += '<strong>' + totalItems + '<small>upgrade</small></strong>';
  html += '</div><div class="cl-release-grid">';
  for (const section of sections) {
    const meta = changelogSectionMeta(section.type);
    for (const item of (section.items || [])) {
      html += '<article class="cl-release-card ' + meta.className + '">';
      html += '<span class="cl-release-card-icon"><i class="' + changelogIconClass(item.icon, meta.icon) + '"></i></span>';
      html += '<div><small>' + (section.title || meta.label) + '</small><p>' + (item.text || '') + '</p></div>';
      html += '</article>';
    }
  }
  html += '</div>';

  changelogBody.innerHTML = html;
}

renderChangelog(CHANGELOG_DATA);
