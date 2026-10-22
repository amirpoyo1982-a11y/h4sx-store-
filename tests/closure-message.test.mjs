import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../closure-message.js', import.meta.url), 'utf8');
const storePage = readFileSync(new URL('../index.htm', import.meta.url), 'utf8');
const reviewPage = readFileSync(new URL('../review/index.htm', import.meta.url), 'utf8');
const storeApp = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const reviewApp = readFileSync(new URL('../review/review-app.js', import.meta.url), 'utf8');
const storeCss = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const reviewCss = readFileSync(new URL('../review/review-style.css', import.meta.url), 'utf8');

function createRenderer() {
  const document = {
    createDocumentFragment: () => ({ children: [], append(...nodes) { this.children.push(...nodes); } }),
    createTextNode: text => ({ type: 'text', text }),
    createElement: tag => ({ type: tag, set textContent(text) { this.text = text; } })
  };
  const window = {};
  vm.runInNewContext(source, { window, document, URL });
  const container = { replaceChildren(fragment) { this.children = fragment.children; } };
  return { render: message => window.H4SXClosureMessage.render(container, message), container };
}

test('closure messages link only valid HTTP(S) URLs and preserve line breaks safely', () => {
  const { render, container } = createRenderer();
  render('Baca https://example.com/info.\nA atau http://example.org dan javascript:alert(1) <img src=x onerror=alert(1)>');
  const output = container.children;
  assert.deepEqual(output.filter(node => node.type === 'a').map(node => ({
    href: node.href, text: node.text, target: node.target, rel: node.rel
  })), [
    { href: 'https://example.com/info', text: 'https://example.com/info', target: '_blank', rel: 'noopener noreferrer' },
    { href: 'http://example.org/', text: 'http://example.org', target: '_blank', rel: 'noopener noreferrer' }
  ]);
  assert(output.some(node => node.type === 'text' && node.text === '.'));
  assert(output.some(node => node.type === 'text' && node.text.includes('javascript:alert(1) <img src=x onerror=alert(1)>')));
  assert(output.some(node => node.type === 'br'));
  assert(output.some(node => node.type === 'text' && node.text.startsWith('A atau ')));
});

test('legacy break tags become text-node line breaks, not interpreted HTML', () => {
  const { render, container } = createRenderer();
  render('Baris pertama<br>Baris kedua<br/>https://example.com');
  assert.deepEqual(container.children.map(node => node.type), ['text', 'br', 'text', 'br', 'a']);
  assert.equal(container.children[0].text, 'Baris pertama');
  assert.equal(container.children[2].text, 'Baris kedua');
  assert.equal(container.children[4].href, 'https://example.com/');
});

test('Store and Review close panels load and use the shared safe message renderer', () => {
  assert.match(storePage, /closure-message\.js/);
  assert.match(reviewPage, /closure-message\.js/);
  assert.equal((storeApp.match(/H4SXClosureMessage\.render\(messageEl, message\)/g) || []).length, 2);
  assert.match(reviewApp, /H4SXClosureMessage\.render\(document\.getElementById\('shopClosedMsg'\), mesej\)/);
  assert.match(storePage, /aria-modal="true" aria-labelledby="closure-title"/);
  assert.match(reviewPage, /aria-modal="true" aria-labelledby="shopClosedTitle"/);
  assert.match(reviewApp, /reviewSupportUrl\(latestReviewStoreConfig \|\| \{\}\)/);
  assert.match(reviewPage, /id="shopClosedContact".*hidden/);
  assert.match(storeCss, /\.closure-contact \{/);
  assert.match(reviewCss, /\.shop-closed-contact \{/);
});
