export function formatReviewMessageText(str, escapeHtml) {
  return escapeHtml(str ?? '')
    .replace(/\s+(?=\d+\s*:\s*H4SX-)/gi, '\n')
    .replace(/https?:\/\/[^\s<>"']+/gi, rawUrl => {
      const trailing = rawUrl.match(/[),.!?]+$/)?.[0] || '';
      const url = rawUrl.slice(0, rawUrl.length - trailing.length);
      if (!/^https?:\/\//i.test(url)) return rawUrl;
      return `<a class="message-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
    });
}
