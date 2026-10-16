const PAGE_SIZE = 100;
const REVIEW_ID = /^review_[A-Z0-9-]{4,40}$/;
const STATUSES = new Set(['pending', 'published', 'hidden', 'rejected', 'trash']);

function milliseconds(value) {
  if (value == null) return null;
  const time = typeof value.toMillis === 'function' ? value.toMillis()
    : typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export async function listReviewHistory(firestore, cursor = null) {
  if (cursor !== null && (typeof cursor !== 'string' || !/^review_[A-Za-z0-9_-]{1,121}$/.test(cursor))) {
    throw Error('Penanda halaman sejarah tidak sah.');
  }
  const snapshots = await Promise.all(['ratings', 'review_pending'].map(name => {
    let query = firestore.collection(name).orderBy('__name__').endAt('review_\uf8ff');
    query = cursor === null ? query.startAt('review_') : query.startAfter(cursor);
    const fields = name === 'ratings' ? ['nama', 'diciptaPada', 'moderationStatus']
      : ['review.nama', 'submittedAt', 'status'];
    return query.select(...fields).limit(PAGE_SIZE + 1).get();
  }));
  const ratings = new Map(snapshots[0].docs.map(item => [item.id, item.data()]));
  const pending = new Map(snapshots[1].docs.map(item => [item.id, item.data()]));
  const ids = [...new Set([...ratings.keys(), ...pending.keys()])].sort();
  const page = ids.slice(0, PAGE_SIZE);
  const records = page.filter(id => REVIEW_ID.test(id)).map(id => {
    const rating = ratings.get(id), entry = pending.get(id);
    const status = rating?.moderationStatus || entry?.status || 'published';
    return {
      id, code:id.slice(7), nama:rating?.nama || entry?.review?.nama || null,
      redeemedAt:milliseconds(entry?.submittedAt) ?? milliseconds(rating?.diciptaPada),
      status:STATUSES.has(status) ? status : 'published'
    };
  });
  return { success:true, records, nextCursor:ids.length > PAGE_SIZE ? page.at(-1) : null };
}
