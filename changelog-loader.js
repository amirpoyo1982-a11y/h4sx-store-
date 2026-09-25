const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '25 September 2026',
  time: '9:04 PM (MYT)',
  version: 'v5.0',
  sections: [
    {
      type: 'added',
      title: 'Ciri Baharu',
      items: [
        {
          icon: 'fa-cart-shopping',
          text: '<strong>Troli belanja lebih lengkap</strong> - pilih beberapa item, ubah kuantiti, lihat subtotal dan hantar ringkasan pesanan dengan lebih mudah.'
        },
        {
          icon: 'fa-ticket',
          text: '<strong>Promo untuk pilihan produk tertentu</strong> - kod diskaun kini boleh digunakan pada pilihan atau variasi yang layak sahaja.'
        },
        {
          icon: 'fa-link',
          text: '<strong>Link terus ke tebus kod</strong> - pautan promo boleh membuka produk berkaitan dan mengisi kod secara automatik.'
        },
        {
          icon: 'fa-copy',
          text: '<strong>Salin deskripsi produk</strong> - butang salin disediakan supaya maklumat produk boleh disalin dengan satu tekan.'
        },
        {
          icon: 'fa-user-check',
          text: '<strong>Semakan profil Roblox</strong> - produk terpilih akan meminta username dan menunjukkan profil untuk disahkan sebelum meneruskan pesanan.'
        },
        {
          icon: 'fa-download',
          text: '<strong>Pasang H4SX sebagai app</strong> - website kini boleh dipasang pada PC atau telefon yang menyokong pemasangan web app.'
        },
        {
          icon: 'fa-thumbtack',
          text: '<strong>Susunan produk lebih teratur</strong> - produk penting boleh muncul lebih awal dan katalog kini lebih mudah dilayari.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Penambahbaikan',
      items: [
        {
          icon: 'fa-bolt',
          text: '<strong>Website lebih ringan</strong> - kod lama dan permintaan rangkaian yang tidak diperlukan telah dibersihkan untuk mengurangkan kelewatan.'
        },
        {
          icon: 'fa-panorama',
          text: '<strong>Paparan banner responsif</strong> - banner lebih jelas pada komputer dan kekal sesuai pada skrin telefon.'
        },
        {
          icon: 'fa-clock',
          text: '<strong>Promo lebih stabil</strong> - masa mula, masa tamat, kuota dan tempoh selepas tebus kini dipatuhi dengan betul.'
        },
        {
          icon: 'fa-rotate',
          text: '<strong>Harga promo kekal selepas refresh</strong> - diskaun yang masih aktif tidak hilang apabila halaman dimuatkan semula.'
        },
        {
          icon: 'fa-mobile-screen',
          text: '<strong>Kad produk lebih kemas</strong> - saiz produk dikecilkan dan gambar dikekalkan jelas pada komputer serta telefon.'
        }
      ]
    },
    {
      type: 'removed',
      title: 'Dibuang',
      items: [
        {
          icon: 'fa-calculator',
          text: '<strong>Kalkulator harga dan penukar mata wang</strong> - dibuang daripada halaman utama kerana tidak penting dan menambah beban pada website.'
        },
        {
          icon: 'fa-code',
          text: '<strong>Kod lama yang tidak digunakan</strong> - fungsi serta gaya berkaitan telah dibersihkan supaya website lebih kemas.'
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
