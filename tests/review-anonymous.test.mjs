import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('storefront and /review forms provide anonymous name opt-out and submit its state', () => {
 const storefront=read('../index.htm'),storefrontClient=read('../app.js');
 const reviewPage=read('../review/index.htm'),reviewClient=read('../review/review-app.js');
 assert.match(storefront,/<input type="checkbox" id="h4rf-anonymous">/);
 assert.match(reviewPage,/<input type="checkbox" id="anonymousReviewName">/);
 assert.match(storefrontClient,/name\.required = !anonymousName\.checked/);
 assert.match(storefrontClient,/anonymous:isAnonymous/);
 assert.match(reviewClient,/namaPelanggan\.required = !anonymousReviewName\.checked/);
 assert.match(reviewClient,/anonymous:isAnonymous/);
 assert.match(storefront,/Nama ulasan dipaparkan sebagai customer has#N\./);
 assert.match(reviewPage,/Nama ulasan dipaparkan sebagai customer has#N\./);
 assert.match(storefrontClient,/const customerName = isAnonymous \? 'customer has#N'/);
 assert.match(reviewClient,/const nama\s+= isAnonymous \? "customer has#N"/);
 const backend=read('../lib/review-moderation.js');
 assert.match(backend,/allocateAnonymousReviewName/);
 assert.match(backend,/review_anonymous_names/);
 assert.match(storefrontClient,/submissionResult\.anonymousName/);
 assert.match(reviewClient,/submissionResult\.anonymousName/);
});
