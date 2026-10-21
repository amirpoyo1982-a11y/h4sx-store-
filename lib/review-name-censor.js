const REVIEW_ID = /^[A-Za-z0-9_-]{1,128}$/;

function replaceName(text, originalName, maskedName) {
  const escaped = originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).replace(new RegExp(escaped, 'giu'), maskedName);
}

export function maskReviewName(name) {
  return String(name ?? '').split(/(\s+)/u).map(part => {
    if (/^\s+$/u.test(part)) return part;
    const characters = Array.from(part);
    if (characters.length <= 2) return '*'.repeat(characters.length);
    return characters[0] + '*'.repeat(characters.length - 2) + characters.at(-1);
  }).join('');
}

export async function setReviewNameCensor(firestore, database, id, enabled, now = Date.now()) {
  if (!REVIEW_ID.test(String(id || ''))) throw Error('ID ulasan tidak sah.');
  if (typeof enabled !== 'boolean') throw Error('Tetapan sensor nama tidak sah.');

  const ratingRef = firestore.doc('ratings/' + id);
  const pendingRef = firestore.doc('review_pending/' + id);
  const privateRef = database.ref('review_private_names/' + id);
  const [ratingSnap, pendingSnap, privateSnap] = await Promise.all([
    ratingRef.get(),
    pendingRef.get(),
    privateRef.once('value')
  ]);
  const rating = ratingSnap.data();
  const pending = pendingSnap.data();
  const privateRecord = privateSnap.val();
  const currentName = rating?.nama ?? pending?.review?.nama;
  const currentReply = rating?.balasanAdmin ?? pending?.review?.balasanAdmin;
  const hasReview = ratingSnap.exists || typeof pending?.review?.nama === 'string';

  if (!hasReview) throw Error('Ulasan tidak ditemui.');

  if (enabled) {
    const originalName = privateRecord?.originalName ?? currentName;
    if (typeof originalName !== 'string' || !originalName.trim()) throw Error('Nama asal ulasan tidak tersedia.');
    const maskedName = maskReviewName(originalName);
    const originalReply = privateRecord?.originalReply ?? currentReply;
    const maskedReply = typeof originalReply === 'string' ? replaceName(originalReply, originalName, maskedName) : undefined;
    if (!privateRecord) await privateRef.set({ originalName, censoredAt:now, ...(typeof originalReply === 'string' ? { originalReply, censoredReply:maskedReply } : {}) });
    if (ratingSnap.exists) await ratingRef.update({ nama:maskedName, nameCensored:true, ...(maskedReply !== undefined ? { balasanAdmin:maskedReply } : {}) });
    if (typeof pending?.review?.nama === 'string') {
      await pendingRef.update({ 'review.nama':maskedName, 'review.nameCensored':true, ...(maskedReply !== undefined ? { 'review.balasanAdmin':maskedReply } : {}) });
    }
    return { success:true, censored:true };
  }

  if (!privateRecord) {
    if (rating?.nameCensored === true || pending?.review?.nameCensored === true) {
      throw Error('Nama asal ulasan tidak ditemui. Nama tidak dapat dipulihkan.');
    }
    return { success:true, censored:false };
  }
  if (typeof privateRecord.originalName !== 'string') throw Error('Rekod nama asal tidak sah.');
  const restoredReply = typeof currentReply === 'string' && currentReply === privateRecord.censoredReply && typeof privateRecord.originalReply === 'string'
    ? privateRecord.originalReply
    : currentReply;
  if (ratingSnap.exists) await ratingRef.update({ nama:privateRecord.originalName, nameCensored:false, ...(restoredReply !== undefined ? { balasanAdmin:restoredReply } : {}) });
  if (typeof pending?.review?.nama === 'string') {
    await pendingRef.update({ 'review.nama':privateRecord.originalName, 'review.nameCensored':false, ...(restoredReply !== undefined ? { 'review.balasanAdmin':restoredReply } : {}) });
  }
  await privateRef.remove();
  return { success:true, censored:false };
}

export async function listReviewNameCensors(database) {
  const snapshot = await database.ref('review_private_names').once('value');
  const records = snapshot.val() || {};
  return Object.fromEntries(Object.entries(records)
    .filter(([, value]) => typeof value?.originalName === 'string')
    .map(([id, value]) => [id, value.originalName]));
}
