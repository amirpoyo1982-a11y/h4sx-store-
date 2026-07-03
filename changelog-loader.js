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
      
      let html = '';
      for (const section of data.sections) {
        let iconClass;
        if (section.type === 'added') iconClass = 'fa-plus-circle';
        else if (section.type === 'fixed') iconClass = 'fa-wrench';
        else if (section.type === 'removed') iconClass = 'fa-trash';
        
        html += '<div>';
        html += `<div class="changelog-section-title ${section.type}"><i class="fa-solid ${iconClass}"></i> ${section.title}</div>`;
        html += '<ul class="changelog-list">';
        for (const item of section.items) {
          html += `<li class="${section.type}"><i class="fa-solid ${item.icon}"></i><span>${item.text}</span></li>`;
        }
        html += '</ul>';
        html += '</div>';
      }
      changelogBody.innerHTML = html;
      
    } catch (error) {
      console.error('Error loading changelog from Gist:', error);
      // Fallback to default changelog if Gist fails
      let fallbackHtml = '';
      fallbackHtml += '<div>';
      fallbackHtml += '<div class="changelog-section-title added"><i class="fa-solid fa-plus-circle"></i> Ditambah</div>';
      fallbackHtml += '<ul class="changelog-list">';
      fallbackHtml += '<li class="added"><i class="fa-solid fa-gauge-high"></i><span><strong>Performance Optimizations</strong> â€” smooth scrolling &amp; less lag!</span></li>';
      fallbackHtml += '</ul>';
      fallbackHtml += '</div>';
      fallbackHtml += '<div>';
      fallbackHtml += '<div class="changelog-section-title fixed"><i class="fa-solid fa-wrench"></i> Diperbaiki</div>';
      fallbackHtml += '<ul class="changelog-list">';
      fallbackHtml += '<li class="fixed"><i class="fa-solid fa-mobile-screen-button"></i><span><strong>Saiz item Mobile</strong> â€” kad produk lebih kecil &amp; kemas!</span></li>';
      fallbackHtml += '<li class="fixed"><i class="fa-solid fa-scroll"></i><span><strong>Changelog Modal</strong> â€” modal changelog lebih mudah untuk PC &amp; Phone!</span></li>';
      fallbackHtml += '</ul>';
      fallbackHtml += '</div>';
      changelogBody.innerHTML = fallbackHtml;
    }
  }

  // Run on page load
  loadChangelogFromGist();

