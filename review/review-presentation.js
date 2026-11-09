(function (root) {
  const OFFICIAL_ADMIN_UID = 'LWRN6IDv4OV1PZd7Vldgp6F9pdH3';
  const H4SX_LOGO_URL = 'https://i.imgur.com/cLPulXQ.png';
  const RAINBOW = 'linear-gradient(90deg,#ff3158,#ff9f1c,#ffe600,#20d67b,#19bfff,#6558ff,#d946ef,#ff3158)';

  function warnaHexSah(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  }

  function isOfficialAdmin(data = {}) {
    return data.adminAuthorUid === OFFICIAL_ADMIN_UID && data.adminIdentityConfirmed === true;
  }

  function badgeStyle(data = {}) {
    const c1 = warnaHexSah(data.badgeColor, '#2fa8e0');
    const c2 = warnaHexSah(data.badgeColor2, '#7c3aed');
    const text = warnaHexSah(data.badgeTextColor, '#ffffff');
    const glow = warnaHexSah(data.badgeGlowColor, c1);
    const rainbow = data.badgeRainbow === true;
    const gradient = data.badgeGradient !== false;
    const size = Number(data.badgeSize);
    const zoom = Number.isFinite(size) && size > 0 ? Math.max(70, Math.min(200, size)) / 100 : 1;
    const bg = rainbow ? RAINBOW : (gradient ? `linear-gradient(120deg, ${c1}, ${c2}, ${c1})` : c1);
    const effectiveGlow = rainbow ? '#7c3aed' : glow;
    return `zoom:${zoom}; background:${bg}; background-size:${rainbow ? '400% 100%' : '230% 230%'}; color:${text}; --badge-glow:${effectiveGlow}; box-shadow:0 4px 16px -8px ${effectiveGlow}, inset 0 1px 0 rgba(255,255,255,.26); border:none;`;
  }

  function nameStyle(data = {}, isReviewAdmin = false) {
    if (data.nameColorEnabled !== true) return isReviewAdmin ? 'color: var(--accent);' : '';
    const c1 = warnaHexSah(data.nameColor, '#2fa8e0');
    const c2 = warnaHexSah(data.nameColor2, '#7c3aed');
    const glow = warnaHexSah(data.nameGlowColor, c1);
    const weight = ['700', '800', '900'].includes(String(data.nameWeight)) ? String(data.nameWeight) : '800';
    const gradient = data.nameGradient !== false;
    const rainbow = data.nameRainbow === true;
    const base = `font-weight:${weight}; text-shadow:0 2px 12px ${glow}55;`;
    if (rainbow) return `${base} color:#ff3158; background:${RAINBOW}; background-size:400% 100%; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;`;
    if (!gradient) return `${base} color:${c1};`;
    return `${base} color:${c1}; background:linear-gradient(120deg, ${c1}, ${c2}, ${c1}); background-size:230% 230%; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;`;
  }

  function nameClass(data = {}) {
    const rainbow = data.nameColorEnabled === true && data.nameRainbow === true;
    const animated = data.nameColorEnabled === true && (rainbow || (data.nameAnimated !== false && data.nameGradient !== false));
    return 'buyer-name custom-name' + (animated ? ' is-animated' : '') + (rainbow ? ' is-rainbow' : '');
  }

  function profileImageUrl(data = {}) {
    return isOfficialAdmin(data) ? H4SX_LOGO_URL : String(data.profileImg || '');
  }

  function orderReviews(list = [], sort = 'newest') {
    const direction = sort === 'oldest' ? 1 : -1;
    const recordTime = value => {
      if (typeof value?.toMillis === 'function') return value.toMillis();
      if (typeof value?.toDate === 'function') return value.toDate().getTime();
      const time = new Date(value || '').getTime();
      return Number.isFinite(time) ? time : 0;
    };
    const reviewTime = item => recordTime(item.diciptaPada || item.timestamp || item.date);
    const publicReviews = list.filter(item =>
      !['hidden', 'rejected', 'pending', 'trash'].includes(String(item.moderationStatus || 'published').trim().toLowerCase())
    );
    return publicReviews.slice().sort((a, b) => {
      const priority = Number(b.pinned === true) - Number(a.pinned === true)
        || Number(b.featured === true) - Number(a.featured === true);
      if (priority) return priority;
      if (a.pinned === true) {
        const pinnedTime = recordTime(b.pinnedAt) - recordTime(a.pinnedAt);
        if (pinnedTime) return pinnedTime;
      } else if (a.featured === true) {
        const featuredTime = recordTime(b.featuredAt) - recordTime(a.featuredAt);
        if (featuredTime) return featuredTime;
      }
      const dateDifference = (reviewTime(a) - reviewTime(b)) * direction;
      if (dateDifference) return dateDifference;
      return String(a.id || '').localeCompare(String(b.id || '')) * direction;
    });
  }

  root.H4ReviewPresentation = Object.freeze({
    isOfficialAdmin,
    badgeStyle,
    nameStyle,
    nameClass,
    profileImageUrl,
    orderReviews
  });
})(typeof window === 'undefined' ? globalThis : window);
