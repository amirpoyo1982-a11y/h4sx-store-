import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { OFFICIAL_REVIEW_ADMIN_UID } from '../review/review-identity.js';

const source = await readFile(new URL('../review/review-presentation.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const presentation = context.window.H4ReviewPresentation;

test('review badge presentation supports the Hub rainbow effect and clamps its size', () => {
  const style = presentation.badgeStyle({ badgeRainbow: true, badgeSize: 250, badgeColor: '#123456' });
  assert.match(style, /zoom:2;/);
  assert.match(style, /linear-gradient\(90deg,#ff3158,#ff9f1c,#ffe600,#20d67b,#19bfff,#6558ff,#d946ef,#ff3158\)/);
  assert.match(style, /--badge-glow:#7c3aed/);
});

test('store and Review Hub share identical name and badge styles', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const hub = await readFile(new URL('../review/review-app.js', import.meta.url), 'utf8');
  assert.match(app, /reviewPresentation\(\)\.badgeStyle\(data\)/);
  assert.match(app, /reviewPresentation\(\)\.nameStyle\(data, isReviewAdmin\)/);
  assert.match(hub, /window\.H4ReviewPresentation\.badgeStyle\(data\)/);
  assert.match(hub, /window\.H4ReviewPresentation\.nameStyle\(data, isReviewAdmin\)/);
});

test('only the confirmed official admin identity receives the H4SX logo', () => {
  const logo = 'https://i.imgur.com/cLPulXQ.png';
  assert.equal(presentation.profileImageUrl({ adminAuthorUid: OFFICIAL_REVIEW_ADMIN_UID, adminIdentityConfirmed: true }), logo);
  assert.equal(presentation.profileImageUrl({ adminAuthorUid: OFFICIAL_REVIEW_ADMIN_UID, adminIdentityConfirmed: false, profileImg: 'https://example.com/avatar.png' }), 'https://example.com/avatar.png');
  assert.equal(presentation.profileImageUrl({ adminAuthorUid: 'untrusted', adminIdentityConfirmed: true, profileImg: 'https://example.com/avatar.png' }), 'https://example.com/avatar.png');
});

test('pinned then featured reviews stay above regular reviews in either date sort', () => {
  const reviews = [
    { id: 'old', diciptaPada: '2024-01-01' },
    { id: 'feature-old', featured: true, featuredAt: '2025-01-01', diciptaPada: '2020-01-01' },
    { id: 'pin-old', pinned: true, pinnedAt: '2025-01-01', diciptaPada: '2019-01-01' },
    { id: 'new', diciptaPada: '2026-01-01' },
    { id: 'pin-new', pinned: true, pinnedAt: '2026-01-01', diciptaPada: '2018-01-01' },
    { id: 'feature-new', featured: true, featuredAt: '2026-01-01', diciptaPada: '2017-01-01' },
    { id: 'hidden-pin', pinned: true, moderationStatus: 'hidden', diciptaPada: '2027-01-01' }
  ];

  assert.deepEqual(
    [...presentation.orderReviews(reviews)].map(item => item.id),
    ['pin-new', 'pin-old', 'feature-new', 'feature-old', 'new', 'old']
  );
  assert.deepEqual(
    [...presentation.orderReviews(reviews, 'oldest')].map(item => item.id),
    ['pin-new', 'pin-old', 'feature-new', 'feature-old', 'old', 'new']
  );
});
