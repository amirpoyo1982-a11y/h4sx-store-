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
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(app, /reviewPresentation\(\)\.badgeMarkup\(data,/);
  assert.match(app, /reviewPresentation\(\)\.nameMarkup\(item, name, officialAdminReview\)/);
  assert.equal((app.match(/reviewPresentation\(\)\.nameMarkup\(item, name, officialAdminReview\)/g) || []).length, 2);
  assert.doesNotMatch(app, /collection\('config'\)\.doc\('review_admin'\)\.onSnapshot/);
  assert.match(styles, /\.review-popup-name strong\.is-animated/);
  assert.match(styles, /\.review-popup-roles \.is-animated/);
  assert.match(styles, /\.rv-card-name strong\.is-animated/);
  assert.match(styles, /\.rv-card-roles \.is-animated/);
  assert.match(hub, /badgeText: teks \|\| null/);
  assert.match(hub, /badgeColor: teks \? badgeColorInput\.value/);
  assert.match(hub, /badgeColor2: teks \? badgeColorInput2\.value/);
  assert.match(hub, /badgeGradient: teks \? badgeGradientToggle\.checked/);
  assert.match(hub, /badgeRainbow: teks \? badgeRainbowToggle\.checked/);
  assert.match(hub, /nameColorEnabled: nameColorEnabledToggle\.checked/);
  assert.match(hub, /nameColor2: nameColorEnabledToggle\.checked \? nameColor2Input\.value/);
  assert.match(hub, /nameGradient: nameColorEnabledToggle\.checked \? nameGradientToggle\.checked/);
  assert.match(hub, /nameRainbow: nameColorEnabledToggle\.checked \? nameRainbowToggle\.checked/);
  assert.match(hub, /window\.H4ReviewPresentation\.badgeStyle\(data\)/);
  assert.match(hub, /window\.H4ReviewPresentation\.nameStyle\(data, isReviewAdmin\)/);
});

test('only the confirmed official admin identity receives the H4SX logo', () => {
  const logo = 'https://i.imgur.com/cLPulXQ.png';
  assert.equal(presentation.profileImageUrl({ adminAuthorUid: OFFICIAL_REVIEW_ADMIN_UID, adminIdentityConfirmed: true }), logo);
  assert.equal(presentation.profileImageUrl({ adminAuthorUid: OFFICIAL_REVIEW_ADMIN_UID, adminIdentityConfirmed: false, profileImg: 'https://example.com/avatar.png' }), 'https://example.com/avatar.png');
  assert.equal(presentation.profileImageUrl({ adminAuthorUid: 'untrusted', adminIdentityConfirmed: true, profileImg: 'https://example.com/avatar.png' }), 'https://example.com/avatar.png');
});

test('real review rating identity fields generate gradient name and OWNER badge markup', () => {
  const rating = {
    nama: 'NAI GANTENK',
    nameColorEnabled: true,
    nameColor: '#ff3158',
    nameColor2: '#ff9f1c',
    nameGlowColor: '#ff3158',
    nameGradient: true,
    nameAnimated: true,
    badgeText: 'OWNER',
    badgeColor: '#ff3158',
    badgeColor2: '#6558ff',
    badgeTextColor: '#ffffff',
    badgeGlowColor: '#ff3158',
    badgeGradient: true,
    badgeAnimated: true
  };
  const nameMarkup = presentation.nameMarkup(rating, rating.nama);
  const badgeMarkup = presentation.badgeMarkup(rating);

  assert.match(nameMarkup, /class="buyer-name custom-name is-animated"/);
  assert.match(nameMarkup, /background:linear-gradient\(120deg, #ff3158, #ff9f1c, #ff3158\)/);
  assert.match(nameMarkup, /-webkit-text-fill-color:transparent/);
  assert.match(badgeMarkup, />OWNER<\/span>$/);
  assert.match(badgeMarkup, /linear-gradient\(120deg, #ff3158, #6558ff, #ff3158\)/);
  assert.match(badgeMarkup, /class="review-identity-role is-animated"/);
});

test('official admin fallback name styling is passed into the shared rendered markup', () => {
  const markup = presentation.nameMarkup({}, 'NAI GANTENK', true);
  assert.match(markup, /style="color: var\(--accent\);"/);
  assert.match(markup, />NAI GANTENK<\/strong>$/);
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

// Storefront review cards must show the same live background and announcement colours saved by the Review Hub.
const storeApp = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const storeCss = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

function storeSection(start, end) {
  const from = storeApp.indexOf(start);
  const to = storeApp.indexOf(end, from + 1);
  assert(from >= 0 && to > from, 'Expected app.js section: ' + start);
  return storeApp.slice(from, to);
}

const liveBg = { URL };
vm.createContext(liveBg);
vm.runInContext('function warnaHexSah(v,f){return /^#[0-9a-f]{6}$/i.test(v||"")?v:f;} function escapeHtml(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}', liveBg);
vm.runInContext(storeSection('function gameNameEmojiImages(value) {', 'function advanceGameNameEmojiImage'), liveBg);
vm.runInContext(storeSection('/* STORE REVIEW LIVE BACKGROUND START */', '/* STORE REVIEW LIVE BACKGROUND END */'), liveBg);

test('storefront reads the same chat background fields saved by H4SX Review', () => {
  const image = liveBg.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://example.com/bg.gif', chatBackgroundMotion: true, chatBackgroundShade: '#112233', chatBackgroundTextColor: '#ffffff', chatBackgroundOverlay: 40 });
  assert.equal(image.enabled, true);
  assert.equal(image.type, 'image');
  assert.equal(image.target, 'card');
  assert.equal(image.motion, true);
  assert.equal(image.shade, '#112233');
  assert.equal(image.textColor, '#ffffff');
  assert.equal(image.overlay, 40);
  const message = liveBg.reviewChatBackgroundConfig({ chatBackgroundType: 'video', chatBackgroundUrl: 'https://example.com/loop.mp4', chatBackgroundTarget: 'message' });
  assert.equal(message.enabled, true);
  assert.equal(message.target, 'message');
  assert.equal(message.overlay, 75);
});

test('unsafe or incomplete storefront background settings are ignored', () => {
  for (const data of [
    {},
    { chatBackgroundType: 'image', chatBackgroundUrl: 'http://example.com/bg.png' },
    { chatBackgroundType: 'image', chatBackgroundUrl: 'https://user:pass@example.com/bg.png' },
    { chatBackgroundType: 'image', chatBackgroundUrl: 'javascript:alert(1)' },
    { chatBackgroundType: 'video', chatBackgroundUrl: 'https://example.com/page.html' },
    { chatBackgroundType: 'unknown', chatBackgroundUrl: 'https://example.com/bg.png' }
  ]) assert.equal(liveBg.reviewChatBackgroundConfig(data).enabled, false);
  assert.equal(liveBg.reviewChatBackgroundLayers(liveBg.reviewChatBackgroundConfig({})), '');
});

test('storefront overlay is clamped, invalid colours fall back, and emoji.gg uses the first-party endpoint', () => {
  const config = liveBg.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://example.com/a.png', chatBackgroundOverlay: 500, chatBackgroundShade: 'red', chatBackgroundTextColor: 'nope' });
  assert.equal(config.overlay, 95);
  assert.equal(config.shade, '#ffffff');
  assert.equal(config.textColor, '#173d56');
  assert.equal(liveBg.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://example.com/a.png', chatBackgroundOverlay: -5 }).overlay, 0);
  assert.equal(liveBg.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://emoji.gg/emoji/12345-party' }).url, '/api/emoji?name=12345-party');
});

test('storefront video backgrounds load lazily and image backgrounds render an img with a shade', () => {
  const video = liveBg.reviewChatBackgroundLayers(liveBg.reviewChatBackgroundConfig({ chatBackgroundType: 'video', chatBackgroundUrl: 'https://example.com/loop.webm' }));
  assert.match(video, /<video class="rv-chat-media" data-rv-video-src="https:\/\/example\.com\/loop\.webm" muted loop playsinline preload="none"/);
  assert.doesNotMatch(video, / src="/);
  assert.match(video, /class="rv-chat-shade"/);
  const image = liveBg.reviewChatBackgroundLayers(liveBg.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://example.com/a.png' }));
  assert.match(image, /<span class="rv-chat-media"><img src="https:\/\/example\.com\/a\.png"/);
  assert.equal(liveBg.reviewChatBackgroundVars({ shade: '#aabbcc', overlay: 60, textColor: '#000000' }), '--chat-shade:#aabbcc;--chat-overlay:0.6;--chat-text:#000000;');
});

test('storefront review cards apply card or message backgrounds and announcement colours, and bind videos', () => {
  const card = storeSection('function reviewCardHTML(item) {', 'function bindReviewCardActions');
  assert.match(card, /reviewChatBackgroundConfig\(item\)/);
  assert.match(card, /cardClasses\.push\('has-chat-bg'\)/);
  assert.match(card, /cardClasses\.push\('is-announcement'\)/);
  assert.match(card, /reviewAnnouncementStyle\(announcement\)/);
  assert.match(card, /class="rv-chat-bg/);
  assert.match(storeApp, /bindReviewChatVideos\(\);\s*if \(more\) more\.hidden/);
  assert.match(storeCss, /\.rv-card\.has-chat-bg/);
  assert.match(storeCss, /\.rv-card\.is-announcement/);
  assert.match(storeCss, /@keyframes rvChatMotion/);
  assert.match(storeCss, /prefers-reduced-motion: reduce\) \{ :is\(\.rv-card\.has-chat-bg, \.rv-chat-bg\)\.has-motion/);
});


// Storefront star filter: 5, 4, 3, 2, 1 with live counts.
const starFilter = { Number };
vm.createContext(starFilter);
vm.runInContext('function clampRating(v){const n=parseInt(v,10);return Math.min(5,Math.max(1,Number.isFinite(n)?n:5));}', starFilter);
vm.runInContext(storeSection('/* STORE REVIEW STAR FILTER START */', '/* STORE REVIEW STAR FILTER END */'), starFilter);

test('storefront star filter returns only the chosen rating and ignores hidden ratings', () => {
  const list = [
    { id: 'a', bintang: 5 }, { id: 'b', bintang: 5 }, { id: 'c', bintang: 4 },
    { id: 'd', bintang: 3 }, { id: 'e', bintang: 2 }, { id: 'f', bintang: 1 },
    { id: 'g', bintang: 5, hideRating: true }
  ];
  const ids = star => [...starFilter.filterReviewsByStar(list, star)].map(item => item.id);
  assert.deepEqual(ids('5'), ['a', 'b']);
  assert.deepEqual(ids('4'), ['c']);
  assert.deepEqual(ids('3'), ['d']);
  assert.deepEqual(ids('2'), ['e']);
  assert.deepEqual(ids('1'), ['f']);
  assert.equal(ids('all').length, 7);
  assert.equal(ids('9').length, 7);
});

test('storefront star counts match each button and the page wires the filter', async () => {
  const counts = starFilter.reviewStarCounts([{ bintang: 5 }, { bintang: 5 }, { bintang: 1 }, { bintang: 4, hideRating: true }]);
  assert.equal(counts.all, 4);
  assert.equal(counts[5], 2);
  assert.equal(counts[1], 1);
  assert.equal(counts[4], 0);
  const page = await readFile(new URL('../index.htm', import.meta.url), 'utf8');
  for (const star of ['all', '5', '4', '3', '2', '1']) assert.match(page, new RegExp('data-rv-star="' + star + '"'));
  assert.match(storeApp, /data-rv-star\]'\)/);
  assert.match(storeApp, /setReviewsStar\(starBtn\.dataset\.rvStar\)/);
  assert.match(storeCss, /\.rv-star-filter button\.is-active/);
  assert.match(storeCss, /prefers-reduced-motion: no-preference\) \{\s*\.rv-card-name strong\.is-animated/);
});

