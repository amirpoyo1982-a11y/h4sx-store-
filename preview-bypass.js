(function (root) {
  const disabledValues = new Set(['0', 'false', 'off', 'no']);

  root.H4SXPreviewBypass = {
    isEnabled(search = root.location.search) {
      const params = new URLSearchParams(search);
      return !disabledValues.has(String(params.get('preview') || '').trim().toLowerCase());
    }
  };
})(window);
