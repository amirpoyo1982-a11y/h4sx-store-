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
