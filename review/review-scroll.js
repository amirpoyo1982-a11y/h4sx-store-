// Keep the visible review stable when a realtime update replaces its DOM.
export function captureReviewViewport(container, view = window) {
  const scrollParents = [];
  for (let node = container; node && node !== container.ownerDocument.body; node = node.parentElement) {
    if (/(auto|scroll)/.test(view.getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) {
      scrollParents.push({node, top: node.scrollTop, left: node.scrollLeft});
    }
  }
  const clipTop = Math.max(0, ...scrollParents.map(({node}) => node.getBoundingClientRect().top));
  const clipBottom = Math.min(view.innerHeight, ...scrollParents.map(({node}) => node.getBoundingClientRect().bottom));
  const cards = [...container.querySelectorAll('[data-review-id]')];
  const visible = cards.filter(card => {
    const rect = card.getBoundingClientRect();
    return rect.bottom > clipTop && rect.top < clipBottom;
  });
  if (!visible.length) return null;
  const focused = container.ownerDocument.activeElement?.closest('[data-review-id]');
  const anchor = visible.includes(focused) ? focused : visible[0];
  return {
    x: view.scrollX, y: view.scrollY, scrollParents, clipTop,
    anchors: [anchor, ...visible.filter(card => card !== anchor)].map(card => ({
      id: card.dataset.reviewId, top: card.getBoundingClientRect().top
    })),
    openReplies: cards.filter(card => card.querySelector('.admin-reply-box.show'))
      .map(card => card.dataset.reviewId)
  };
}

export function restoreReviewViewport(container, position, view = window) {
  if (!position) return;
  for (const {node, top, left} of position.scrollParents) {
    node.scrollTop = top;
    node.scrollLeft = left;
  }
  const cards = [...container.querySelectorAll('[data-review-id]')];
  const byId = new Map(cards.map(card => [card.dataset.reviewId, card]));
  for (const id of position.openReplies) {
    const card = byId.get(id);
    card?.querySelector('.admin-reply-box')?.classList.add('show');
    const button = card?.querySelector('.admin-reply-view-toggle');
    if (button) {
      button.setAttribute('aria-expanded', 'true');
      button.textContent = 'Tutup balasan ↑';
    }
  }
  for (const anchor of position.anchors) {
    const card = byId.get(anchor.id);
    if (!card) continue;
    const rect = card.getBoundingClientRect();
    // A saved editor closes on refresh: keep at least the card's last
    // 80 pixels visible instead of restoring an offset into the removed form.
    const top = Math.max(anchor.top, position.clipTop - Math.max(0, rect.height - 80));
    const delta = rect.top - top;
    if (position.scrollParents.length) {
      position.scrollParents[0].node.scrollTop += delta;
      view.scrollTo({left: position.x, top: position.y, behavior: 'instant'});
    } else view.scrollTo({ left: position.x, top: view.scrollY + delta, behavior: 'instant' });
    return;
  }
  view.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
}
