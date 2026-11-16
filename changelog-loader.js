const CHANGELOG_DATA = {
  title: 'WhatsApp Support Form + Pembelian Terkini Lebih Kemas',
  subtitle: 'Pesan support WhatsApp kini berteks lebih cantik dengan formatting bold yang betul, serta popup pembelian terapung dan berpusing satu demi satu.',
  date: '17 November 2026',
  releasedAt: '2026-11-17T00:00:00+08:00',
  time: 'Update pelanggan & sokongan',
  version: 'v6.5',
  sections: [
    {
      type: 'added',
      title: 'Borang sokongan WhatsApp',
      items: [
        { icon: 'fa-whatsapp', text: '<strong>Pesan support dengan formatting cantik</strong><br>Keseluruhan baris label dan nilai kini dibold sekaligus untuk paparan lebih jelas di WhatsApp.' },
        { icon: 'fa-mobile-screen', text: '<strong>Jarak baris lebih bersih</strong><br>Setiap medan sokongan dipisah dengan ruang yang cukup untuk mudah dibaca dalam perbualan WhatsApp.' },
        { icon: 'fa-lock', text: '<strong>Pengesahan pelanggan terintegrasi</strong><br>Nombor telefon pelanggan disertakan dalam setiap pesan untuk pengesahan identiti pasukan sokongan.' }
      ]
    },
    {
      type: 'added',
      title: 'Popup pembelian',
      items: [
        { icon: 'fa-bag-shopping', text: '<strong>Satu pembelian pada satu masa</strong><br>Popup Pembelian Terkini berpusing satu demi satu dan mula semula dari awal selepas pembelian terakhir.' },
        { icon: 'fa-eye', text: '<strong>Latar lut sinar yang jelas dibaca</strong><br>Kad lebih ringan dan tidak menutup kandungan, dengan teks yang kekal terang.' },
        { icon: 'fa-mobile-screen', text: '<strong>Sesuai di phone dan PC</strong><br>Popup duduk di atas bar navigasi bawah dan memberi ruang kepada butang Helper.' }
      ]
    },
    {
      type: 'fixed',
      title: 'Mesej dan prestasi admin',
      items: [
        { icon: 'fa-message', text: '<strong>Format pesan WhatsApp lebih konsisten</strong><br>Asterisk kini membungkus keseluruhan baris (label + nilai) untuk rendering bold yang betul dalam WhatsApp.' },
        { icon: 'fa-gauge-high', text: '<strong>Panel admin lebih lancar di PC</strong><br>Kesan blur skrin penuh dibuang dan animasi halaman dijeda semasa panel admin dibuka.' },
        { icon: 'fa-magnifying-glass', text: '<strong>Carian produk dan game lebih pantas</strong><br>Senarai dikemas kini selepas anda berhenti menaip, bukan pada setiap huruf.' }
      ]
    },
    {
      type: 'removed',
      title: 'Paparan popup',
      items: [
        { icon: 'fa-list', text: '<strong>Senarai berlipat dibuang</strong><br>Lencana jumlah dan butang buka atau lipat dibuang supaya popup lebih ringkas.' }
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
  const versionEl = document.getElementById('changelog-version');

  if (titleEl) titleEl.textContent = data.title || 'Apa Yang Baru - H4SX STORE';
  if (dateEl) dateEl.textContent = data.date || '';
  if (timeEl) timeEl.textContent = data.time || 'Terkini';
  if (versionEl) versionEl.textContent = data.version || '';

  const sections = Array.isArray(data.sections) ? data.sections : [];
  const totalItems = sections.reduce((sum, section) => sum + ((section.items || []).length), 0);
  let html = '<div class="cl-release-intro">';
  html += '<div class="cl-release-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>';
  html += '<div><span>UPDATE KEDAI</span><p>' + (data.subtitle || 'Pengalaman H4SX STORE yang lebih baik.') + '</p></div>';
  html += '<strong>' + totalItems + '<small>perubahan</small></strong>';
  html += '</div><div class="cl-release-grid">';
  for (const section of sections) {
    const meta = changelogSectionMeta(section.type);
    html += '<section class="cl-release-group ' + meta.className + '">';
    html += '<h3 class="cl-release-group-title"><i class="fa-solid ' + meta.icon + '"></i>' + (section.title || meta.label) + '</h3>';
    html += '<div class="cl-release-group-items">';
    for (const item of (section.items || [])) {
      html += '<article class="cl-release-card ' + meta.className + '">';
      html += '<span class="cl-release-card-icon"><i class="' + changelogIconClass(item.icon, meta.icon) + '"></i></span>';
      html += '<p>' + (item.text || '') + '</p>';
      html += '</article>';
    }
    html += '</div></section>';
  }
  html += '</div>';

  changelogBody.innerHTML = html;
}

renderChangelog(CHANGELOG_DATA);

// Last-Modified comes from the deployed index.htm, so the publish date updates with each Vercel deployment.
async function loadLastPublishedAt() {
  if (location.protocol === 'file:') return;
  try {
    const url = new URL('./index.htm', location.href);
    const response = await fetch(url, { method:'HEAD', cache:'no-store' });
    if (!response.ok) return;
    const value = response.headers.get('Last-Modified');
    const published = value ? new Date(value) : null;
    if (!published || Number.isNaN(published.getTime()) || published.getTime() > Date.now() + 300000) return;
    window.H4SX_LAST_PUBLISH_AT = published.toISOString();
    const dateEl = document.getElementById('changelog-date-text');
    const timeEl = document.getElementById('changelog-time-text');
    if (dateEl) dateEl.textContent = published.toLocaleDateString('ms-MY', { day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Kuala_Lumpur' });
    if (timeEl) timeEl.textContent = 'Last publish · ' + published.toLocaleTimeString('ms-MY', { hour:'numeric', minute:'2-digit', timeZone:'Asia/Kuala_Lumpur' });
  } catch (error) { console.warn('Tarikh publish tidak dapat disemak:', error); }
}
loadLastPublishedAt();
