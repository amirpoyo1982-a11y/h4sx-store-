export function parseReviewPublishedAt(value, now = Date.now()) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > now + 300000) return null;
  return new Date(timestamp);
}
