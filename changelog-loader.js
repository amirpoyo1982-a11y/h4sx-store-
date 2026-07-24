const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '24 July 2026',
  time: 'Latest',
  version: 'v1.9',
  sections: [
    {
      type: 'added',
      title: 'Ditambah Hari Ini',
      items: [
        {
          icon: 'fa-square-poll-vertical',
          text: '<strong>Custom Vote Firebase</strong> - admin boleh hidup atau matikan undian, tukar tajuk, ayat dan 2 hingga 6 pilihan jawapan. Keputusan pelanggan dikemas kini secara live.'
        },
        {
          icon: 'fa-whatsapp',
          text: '<strong>Katalog terus ke WhatsApp</strong> - setiap button beli kini berwarna hijau dengan logo WhatsApp supaya pelanggan terus faham pembelian dibuat melalui chat admin.'
        },
        {
          icon: 'fa-money-bill-transfer',
          text: '<strong>Penukar mata wang live</strong> - converter baru menyokong banyak mata wang, dengan pilihan MYR dan IDR serta kadar disimpan sementara untuk loading lebih pantas.'
        },
        {
          icon: 'fa-calculator',
          text: '<strong>Kalkulator harga</strong> - pelanggan boleh kira jumlah harga ikut kuantiti terus pada website tanpa perlu tanya admin untuk kiraan asas.'
        },
        {
          icon: 'fa-gamepad',
          text: '<strong>Menu platform baru</strong> - Roblox dan Free Fire kini ada kad pilihan tersendiri; tekan platform untuk lihat game atau item yang berkaitan sahaja.'
        },
        {
          icon: 'fa-cart-shopping',
          text: '<strong>Troli ke WhatsApp</strong> - pelanggan boleh hantar senarai penuh item dalam troli terus ke chat admin bersama jumlah pesanan.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Diperbaiki Hari Ini',
      items: [
        {
          icon: 'fa-list-check',
          text: '<strong>Aliran beli lebih jelas</strong> - panduan pembelian, FAQ dan mesej checkout dikemas supaya pelanggan tahu langkah selepas pilih item.'
        },
        {
          icon: 'fa-magnifying-glass',
          text: '<strong>Carian produk</strong> - hasil carian kini menggunakan button beli WhatsApp yang sama seperti katalog utama.'
        },
        {
          icon: 'fa-mobile-screen-button',
          text: '<strong>Mobile dan PC lebih konsisten</strong> - warna button beli, label katalog dan susun atur tool baru disesuaikan untuk kedua-dua paparan.'
        },
        {
          icon: 'fa-gauge-high',
          text: '<strong>Kadar mata wang lebih tahan</strong> - jika internet atau API kadar terganggu, website masih guna kadar sandaran MYR dan IDR supaya tool tidak kosong.'
        }
      ]
    },
    {
      type: 'removed',
      title: 'Dibuang Hari Ini',
      items: [
        {
          icon: 'fa-credit-card',
          text: '<strong>Button bayar lama pada katalog</strong> - label pembayaran lama diganti dengan tindakan Beli WhatsApp agar tidak mengelirukan pelanggan.'
        },
        {
          icon: 'fa-trash',
          text: '<strong>Nota changelog v1.8</strong> - paparan ini dibersihkan semula supaya hanya perubahan release hari ini dipaparkan.'
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
