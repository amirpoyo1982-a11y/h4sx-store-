const CHANGELOG_DATA = {
  title: 'Apa Yang Baru - H4SX STORE',
  date: '22 September 2026',
  time: '5:03 PM (MYT)',
  version: 'v3.4',
  sections: [
    {
      type: 'added',
      title: 'Ditambah Hari Ini',
      items: [
        {
          icon: 'fa-fire-flame-curved',
          text: '<strong>Firebase Realtime Database</strong> - inventory, senarai game dan tetapan kedai kini dikemas kini secara langsung tanpa perlu edit Gist dan refresh manual.'
        },
        {
          icon: 'fa-sliders',
          text: '<strong>Catalog Control dalam website</strong> - admin boleh tambah, edit, duplicate dan padam produk atau game terus daripada panel admin yang sama.'
        },
        {
          icon: 'fa-ticket',
          text: '<strong>Promo Code Manager</strong> - cipta kod untuk mana-mana produk, pilih peratus atau potongan RM, tetapkan kuota pelanggan, waktu mula, waktu tamat dan tempoh penggunaan selepas redeem.'
        },
        {
          icon: 'fa-image',
          text: '<strong>Upload gambar melalui ImgBB</strong> - admin boleh pilih fail, drag-and-drop atau terus tekan Ctrl + V; URL gambar dimasukkan secara automatik.'
        },
        {
          icon: 'fa-xmark',
          text: '<strong>Butang buang gambar</strong> - gambar yang tersalah pilih atau URL lama boleh dikosongkan terus melalui butang X sebelum item disimpan.'
        },
        {
          icon: 'fa-wand-magic-sparkles',
          text: '<strong>Ambil ID kosong</strong> - editor produk kini boleh mencari dan mengisi nombor ID paling kecil yang belum digunakan secara automatik.'
        },
        {
          icon: 'fa-user-check',
          text: '<strong>Semakan profil Roblox per item</strong> - admin boleh aktifkan pengesanan untuk produk pilihan sahaja; butang Beli WhatsApp kini meminta username dahulu, username tepat terus disahkan, dan carian seperti Adam memaparkan beberapa profil untuk dipilih.'
        },
        {
          icon: 'fa-headset',
          text: '<strong>Editor konsultasi WhatsApp</strong> - nombor, teks butang dan mesej WhatsApp kini boleh diedit terus untuk produk dan game.'
        },
        {
          icon: 'fa-gamepad',
          text: '<strong>Katalog Firebase lengkap</strong> - data produk dan game lama sudah dipindahkan ke pangkalan data realtime dan kekal serasi dengan paparan kedai.'
        }
      ]
    },
    {
      type: 'fixed',
      title: 'Diperbaiki Hari Ini',
      items: [
        {
          icon: 'fa-tag',
          text: '<strong>Konsultasi tidak perlukan harga</strong> - apabila mod Konsultasi WhatsApp diaktifkan, ruangan harga tidak lagi diwajibkan.'
        },
        {
          icon: 'fa-clock',
          text: '<strong>Masa promo dipatuhi</strong> - kod belum boleh digunakan sebelum waktu mula dan akan ditolak secara automatik selepas waktu tamat.'
        },
        {
          icon: 'fa-users',
          text: '<strong>Had promo boleh dikemas kini</strong> - perubahan kuota dalam panel digunakan pada transaksi Firebase seterusnya tanpa tersekat pada nilai lama.'
        },
        {
          icon: 'fa-hourglass-start',
          text: '<strong>Countdown bermula selepas redeem</strong> - tempoh penggunaan peribadi tidak lagi berjalan atau dipaparkan sebelum pelanggan menekan butang Guna.'
        },
        {
          icon: 'fa-rotate',
          text: '<strong>Harga promo kekal selepas refresh</strong> - status redeem pada peranti dipulihkan semula dan harga diskaun dipaparkan sehingga tempohnya tamat.'
        },
        {
          icon: 'fa-unlock',
          text: '<strong>Input promo tidak terkunci</strong> - apabila satu kod tamat, pelanggan masih boleh mengosongkan input dan mencuba kod lain.'
        },
        {
          icon: 'fa-server',
          text: '<strong>Fallback API profil Roblox</strong> - semakan username kini mencuba endpoint utama dan endpoint Vercel sedia ada; ralat objek tidak lagi dipaparkan sebagai [object Object].'
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
