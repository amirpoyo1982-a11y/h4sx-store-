import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import verifyReview from '../api/review-verify-turnstile.js';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
test('review route and every local page asset resolve in the main project', () => {
  const routes=JSON.parse(read('vercel.json')).rewrites;
  assert(routes.some(route=>route.source==='/review'&&route.destination==='/review/index.htm'));
  const html=read('review/index.htm');
  for(const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)){
    const url=match[1];if(!url.startsWith('/')||url==='/')continue;
    assert(existsSync(new URL('..'+url,import.meta.url)),url+' must exist');
  }
  assert(html.includes('href="https://www.h4sxmy.xyz/review"'));
  assert(!html.includes('review.h4sxmy.xyz'));
});
test('rating, VIP badge, GIF check, suggestions and admin controls are retained', () => {
  const html=read('review/index.htm'),app=read('review/review-app.js');
  for(const id of ['pilihBintang','badgeTextInput','badgeEmojiInput','customCheckEnabledToggle','customCheckGifInput','nameColorEnabledToggle','adminReviewStatusFilter','btnBuildOwnReview','btnReviewAdminSessions','reviewPromoShell'])assert(html.includes('id="'+id+'"'),id);
  for(const feature of ['function badgeStyle','function customCheckMarkup','function nameStyle','function simpanBadgePayload','function simpanCustomerPayload','function renderReviews'])assert(app.includes(feature),feature);
  assert(app.includes('projectId:"h4sx-6712c"'));
  assert(app.includes("fetch('/api/review-verify-turnstile'"));
  assert(app.includes("fetch('/review/index.htm'"));
  assert(app.includes('const publicRecords ='));
  assert(!app.includes('reg.unregister()'));
});
test('service worker keeps review and storefront navigation caches separate', async () => {
  const events={},saved=[];
  const cache={put:async(key)=>saved.push(key),addAll:async()=>{}};
  const context={self:{location:{origin:'https://www.h4sxmy.xyz'},addEventListener:(name,fn)=>events[name]=fn},URL,fetch:async()=>({ok:true,clone(){return this;}}),caches:{open:async()=>cache,match:async()=>null}};
  vm.runInNewContext(read('sw.js'),context);
  for(const pathname of ['/review?preview=on','/']){
    let promise;events.fetch({request:{method:'GET',mode:'navigate',url:'https://www.h4sxmy.xyz'+pathname},respondWith:value=>promise=value});await promise;await Promise.resolve();
  }
  assert(saved.includes('/review'));assert(saved.includes('./index.htm'));
});
test('Turnstile review API accepts the new hostname and rejects mismatched origins', async () => {
  const oldFetch=globalThis.fetch,oldSecret=process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SECRET_KEY='TEST_ONLY';
  globalThis.fetch=async()=>({json:async()=>({success:true,hostname:'www.h4sxmy.xyz',action:'review_submit'})});
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
  try{
    const req={method:'POST',headers:{origin:'https://www.h4sxmy.xyz','user-agent':'migration-unit-test'},body:{token:'TEST',action:'review_submit'}};
    const good=response();await verifyReview(req,good);assert.equal(good.code,200);
    const bad=response();await verifyReview({...req,headers:{origin:'https://untrusted.example'}},bad);assert.equal(bad.code,403);
  }finally{globalThis.fetch=oldFetch;if(oldSecret===undefined)delete process.env.TURNSTILE_SECRET_KEY;else process.env.TURNSTILE_SECRET_KEY=oldSecret;}
});
test('store review links stay within the combined website', () => {
  const html=read('index.htm'),app=read('app.js');
  assert(html.includes('href="/review" class="review-all-btn"'));
  assert(app.includes("'https://www.h4sxmy.xyz/review?reviewId='"));
  assert(!app.includes('review.h4sxmy.xyz'));
});
