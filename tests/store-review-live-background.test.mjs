import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function between(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + 1);
  assert(from >= 0 && to > from, 'Expected app.js section: ' + start);
  return app.slice(from, to);
}

const context = { URL };
vm.createContext(context);
vm.runInContext('function warnaHexSah(v,f){return /^#[0-9a-f]{6}$/i.test(v||"")?v:f;} function escapeHtml(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}', context);
vm.runInContext(between('function gameNameEmojiImages(value) {', 'function advanceGameNameEmojiImage'), context);
vm.runInContext(between('/* STORE REVIEW LIVE BACKGROUND START */', '/* STORE REVIEW LIVE BACKGROUND END */'), context);

test('storefront reads the same chat background fields saved by H4SX Review', () => {
  const image = context.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://example.com/bg.gif', chatBackgroundMotion: true, chatBackgroundShade: '#112233', chatBackgroundTextColor: '#ffffff', chatBackgroundOverlay: 40 });
  assert.equal(image.enabled, true);
  assert.equal(image.type, 'image');
  assert.equal(image.target, 'card');
  assert.equal(image.motion, true);
  assert.equal(image.shade, '#112233');
  assert.equal(image.textColor, '#ffffff');
  assert.equal(image.overlay, 40);
  const message = context.reviewChatBackgroundConfig({ chatBackgroundType: 'video', chatBackgroundUrl: 'https://example.com/loop.mp4', chatBackgroundTarget: 'message' });
  assert.equal(message.enabled, true);
  assert.equal(message.target, 'message');
  assert.equal(message.overlay, 75);
});

test('unsafe or incomplete background settings are ignored', () => {
  for (const data of [
    {},
    { chatBackgroundType: 'image', chatBackgroundUrl: 'http://example.com/bg.png' },
    { chatBackgroundType: 'image', chatBackgroundUrl: 'https://user:pass@example.com/bg.png' },
    { chatBackgroundType: 'image', chatBackgroundUrl: 'javascript:alert(1)' },
    { chatBackgroundType: 'video', chatBackgroundUrl: 'https://example.com/page.html' },
    { chatBackgroundType: 'unknown', chatBackgroundUrl: 'https://example.com/bg.png' }
  ]) assert.equal(context.reviewChatBackgroundConfig(data).enabled, false);
  assert.equal(context.reviewChatBackgroundLayers(context.reviewChatBackgroundConfig({})), '');
});

test('overlay is clamped and invalid colors fall back to the Review defaults', () => {
  const config = context.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://example.com/a.png', chatBackgroundOverlay: 500, chatBackgroundShade: 'red', chatBackgroundTextColor: 'nope' });
  assert.equal(config.overlay, 95);
  assert.equal(config.shade, '#ffffff');
  assert.equal(config.textColor, '#173d56');
  assert.equal(context.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://example.com/a.png', chatBackgroundOverlay: -5 }).overlay, 0);
});

test('emoji.gg backgrounds use the first-party emoji endpoint like the Review page', () => {
  const config = context.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://emoji.gg/emoji/12345-party' });
  assert.equal(config.url, '/api/emoji?name=12345-party');
});

test('video layers load lazily and image layers render an img with a shade', () => {
  const video = context.reviewChatBackgroundLayers(context.reviewChatBackgroundConfig({ chatBackgroundType: 'video', chatBackgroundUrl: 'https://example.com/loop.webm' }));
  assert.match(video, /<video class="rv-chat-media" data-rv-video-src="https:\/\/example\.com\/loop\.webm" muted loop playsinline preload="none"/);
  assert.doesNotMatch(video, / src="/);
  assert.match(video, /class="rv-chat-shade"/);
  const image = context.reviewChatBackgroundLayers(context.reviewChatBackgroundConfig({ chatBackgroundType: 'image', chatBackgroundUrl: 'https://example.com/a.png' }));
  assert.match(image, /<span class="rv-chat-media"><img src="https:\/\/example\.com\/a\.png"/);
  assert.equal(context.reviewChatBackgroundVars({ shade: '#aabbcc', overlay: 60, textColor: '#000000' }), '--chat-shade:#aabbcc;--chat-overlay:0.6;--chat-text:#000000;');
});

test('review cards apply card or message backgrounds and announcement colors, and videos are bound', () => {
  const card = between('function reviewCardHTML(item) {', 'function bindReviewCardActions');
  assert.match(card, /reviewChatBackgroundConfig\(item\)/);
  assert.match(card, /cardClasses\.push\('has-chat-bg'\)/);
  assert.match(card, /cardClasses\.push\('is-announcement'\)/);
  assert.match(card, /reviewAnnouncementStyle\(announcement\)/);
  assert.match(card, /class="rv-chat-bg/);
  assert.match(app, /bindReviewChatVideos\(\);\s*if \(more\) more\.hidden/);
  assert.match(css, /\.rv-card\.has-chat-bg/);
  assert.match(css, /\.rv-card\.is-announcement/);
  assert.match(css, /@keyframes rvChatMotion/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ :is\(\.rv-card\.has-chat-bg, \.rv-chat-bg\)\.has-motion/);
});
