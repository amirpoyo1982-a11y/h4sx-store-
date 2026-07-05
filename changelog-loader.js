// ======================================
  // CONFIG: GANTI DENGAN URL RAW GIST ANDA!
  // ======================================
  const CHANGELOG_GIST_URL = "https://gist.githubusercontent.com/amirpoyo1982-a11y/f3bc2c131056d998c768765d36f29b58/raw/";

  function updateChangelogTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ms-MY', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    const timeEl = document.getElementById('changelog-time-text');
    const dateEl = document.getElementById('changelog-date-text');
    if (timeEl) timeEl.textContent = timeString;
    if (dateEl) dateEl.textContent = now.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }

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

  // Fetch and render changelog from Gist
  async function loadChangelogFromGist() {
    const changelogBody = document.getElementById('changelog-body');
    try {
      const response = await fetch(CHANGELOG_GIST_URL);
      const data = await response.json();
      
      if (data.title) {
        document.getElementById('changelog-title').textContent = data.title;
      }
      
      // Update date & time from Gist, or use current time
      const dateEl = document.getElementById('changelog-date-text');
      const timeEl = document.getElementById('changelog-time-text');
      if (dateEl) {
        dateEl.textContent = data.date || new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      if (data.time && timeEl) {
        timeEl.textContent = data.time;
      } else {
        // Fallback to current time if no custom time
        const now = new Date();
        const timeString = now.toLocaleTimeString('ms-MY', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        timeEl.textContent = timeString;
      }
      
      const totalItems = (data.sections || []).reduce((sum, section) => sum + ((section.items || []).length), 0);
      let html = '<div class="changelog-summary">';
      html += '<div><span>Release</span><strong>' + (data.version || data.date || 'Latest') + '</strong></div>';
      html += '<div><span>Kemaskini</span><strong>' + totalItems + ' item</strong></div>';
      html += '<div><span>Status</span><strong>Live</strong></div>';
      html += '</div>';

      for (const section of (data.sections || [])) {
        const meta = changelogSectionMeta(section.type);
        const items = Array.isArray(section.items) ? section.items : [];

        html += `<div class="changelog-section-card ${meta.className}">`;
        html += `<div class="changelog-section-title ${meta.className}"><span class="changelog-section-icon"><i class="fa-solid ${meta.icon}"></i></span><span>${section.title || meta.label}</span><b>${items.length}</b></div>`;
        html += '<ul class="changelog-list">';
        for (const item of items) {
          html += `<li class="${meta.className}"><span class="changelog-item-icon"><i class="${changelogIconClass(item.icon, meta.icon)}"></i></span><span>${item.text || ''}</span></li>`;
        }
        html += '</ul>';
        html += '</div>';
      }
      changelogBody.innerHTML = html;
      
    } catch (error) {
      console.error('Error loading changelog from Gist:', error);
      // Fallback to default changelog if Gist fails
      let fallbackHtml = '';
      fallbackHtml += '<div class="changelog-summary"><div><span>Release</span><strong>Latest</strong></div><div><span>Kemaskini</span><strong>3 item</strong></div><div><span>Status</span><strong>Live</strong></div></div>';
      fallbackHtml += '<div class="changelog-section-card added">';
      fallbackHtml += '<div class="changelog-section-title added"><span class="changelog-section-icon"><i class="fa-solid fa-plus-circle"></i></span><span>Ditambah</span><b>1</b></div>';
      fallbackHtml += '<ul class="changelog-list">';
      fallbackHtml += '<li class="added"><span class="changelog-item-icon"><i class="fa-solid fa-gauge-high"></i></span><span><strong>Performance Optimizations</strong> - smooth scrolling &amp; less lag!</span></li>';
      fallbackHtml += '</ul>';
      fallbackHtml += '</div>';
      fallbackHtml += '<div class="changelog-section-card fixed">';
      fallbackHtml += '<div class="changelog-section-title fixed"><span class="changelog-section-icon"><i class="fa-solid fa-wrench"></i></span><span>Diperbaiki</span><b>2</b></div>';
      fallbackHtml += '<ul class="changelog-list">';
      fallbackHtml += '<li class="fixed"><span class="changelog-item-icon"><i class="fa-solid fa-mobile-screen-button"></i></span><span><strong>Saiz item Mobile</strong> - kad produk lebih kecil &amp; kemas!</span></li>';
      fallbackHtml += '<li class="fixed"><span class="changelog-item-icon"><i class="fa-solid fa-scroll"></i></span><span><strong>Changelog Modal</strong> - modal changelog lebih mudah untuk PC &amp; Phone!</span></li>';
      fallbackHtml += '</ul>';
      fallbackHtml += '</div>';
      changelogBody.innerHTML = fallbackHtml;
    }
  }

  // Run on page load
  loadChangelogFromGist();

