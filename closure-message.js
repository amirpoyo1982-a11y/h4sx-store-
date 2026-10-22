(function (root) {
  const linkPattern = /https?:\/\/[^\s<>]+/gi;
  const trailingPunctuation = /[.,!?;:)\]}'"]+$/;

  function safeHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function render(container, message) {
    const text = String(message ?? '').replace(/<br\s*\/?>/gi, '\n');
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    const appendText = value => {
      value.split('\n').forEach((line, index) => {
        if (index) fragment.append(document.createElement('br'));
        if (line) fragment.append(document.createTextNode(line));
      });
    };

    text.replace(linkPattern, (match, offset) => {
      const punctuation = match.match(trailingPunctuation)?.[0] || '';
      const candidate = match.slice(0, match.length - punctuation.length);
      const href = safeHttpUrl(candidate);
      if (!href) return match;

      appendText(text.slice(cursor, offset));
      const link = document.createElement('a');
      link.href = href;
      link.textContent = candidate;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      fragment.append(link);
      appendText(punctuation);
      cursor = offset + match.length;
      return match;
    });

    appendText(text.slice(cursor));
    container.replaceChildren(fragment);
  }

  root.H4SXClosureMessage = { render };
})(window);
