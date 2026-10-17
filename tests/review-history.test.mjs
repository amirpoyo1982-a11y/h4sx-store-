import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {listReviewHistory} from '../lib/review-history.js';
import {createModerationHandler} from '../api/review-moderation.js';
import {ADMIN_UID} from '../lib/review-moderation.js';

function database(values) {
  const reads=[];
  return {reads,doc(path){const [name,id]=path.split('/');return {async get(){return {data:()=>values[name]?.[id]};}};},collection(name) {
    const state={name,fields:[],start:null,end:null,exclusive:false,limit:0,order:[]};
    const query={
      orderBy(field,direction='asc'){state.order.push([field,direction]);return this;},
      endAt(value){state.end=value;return this;},
      startAt(value){state.start=value;return this;},
      startAfter(...values){state.start=values;state.exclusive=true;return this;},
      select(...fields){state.fields=fields;return this;},
      limit(value){state.limit=value;return this;},
      async get(){
        reads.push(state);
        const timeField=state.order[0][0],timed=timeField!=='__name__';
        const ms=value=>typeof value?.toMillis==='function'?value.toMillis():value instanceof Date?value.getTime():value;
        const docs=Object.entries(values[name]||{}).filter(([,data])=>!timed||data[timeField]!==undefined)
          .sort(([idA,a],[idB,b])=>timed?(ms(b[timeField])-ms(a[timeField])||idB.localeCompare(idA)):idA.localeCompare(idB))
          .filter(([id,data])=>{
            if(!timed)return (state.exclusive?id>state.start[0]:id>=state.start)&&id<=state.end;
            if(!state.exclusive)return true;
            const time=ms(data[timeField]),start=ms(state.start[0]);
            return time<start||time===start&&id<state.start[1];
          })
          .slice(0,state.limit).map(([id,data])=>({id,data:()=>data}));
        return {docs};
      }
    };
    return query;
  }};
}
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const request={method:'POST',headers:{origin:'https://www.h4sxmy.xyz',authorization:'Bearer TEST'},body:{action:'history'}};

test('history joins private pending and public reviews by ID without duplicating redeemed codes',async()=>{
  const firestore=database({
    ratings:{
      'review_H4SX-AAAA':{nama:'Ali terkini',diciptaPada:new Date(2000),moderationStatus:'hidden',feedbackImg:'PRIVATE_IMAGE'},
      'review_H4SX-BBBB':{nama:'Bala',diciptaPada:{toMillis:()=>3000}},
      'manual_123':{nama:'Admin tanpa kod'},
      'review_lowercase':{nama:'Bukan rekod kod'}
    },
    review_pending:{
      'review_H4SX-AAAA':{status:'published',submittedAt:1000},
      'review_H4SX-CCCC':{status:'pending',submittedAt:4000,review:{nama:'Chong',ulasan:'PRIVATE_TEXT',feedbackVideo:'PRIVATE_VIDEO'}},
      'review_H4SX-DDDD':{status:'rejected',submittedAt:5000,review:{nama:'Devi'}},
      'review_H4SX-EEEE':{status:'trash',submittedAt:6000,review:{nama:'Emi'}}
    }
  });
  const result=await listReviewHistory(firestore);
  assert.equal(result.records.length,5);assert.equal(result.nextCursor,null);
  assert.deepEqual(result.records.map(r=>r.code),['H4SX-EEEE','H4SX-DDDD','H4SX-CCCC','H4SX-BBBB','H4SX-AAAA']);
  assert.deepEqual(result.records.at(-1),{id:'review_H4SX-AAAA',code:'H4SX-AAAA',nama:'Ali terkini',redeemedAt:1000,status:'hidden'});
  assert.deepEqual(result.records.slice(0,3).map(r=>r.status),['trash','rejected','pending']);
  assert(!JSON.stringify(result).includes('PRIVATE_'));
  assert.deepEqual(firestore.reads.slice(0,2).map(r=>r.order),[[['diciptaPada','desc'],['__name__','desc']],[['submittedAt','desc'],['__name__','desc']]]);
  assert(firestore.reads.every(r=>r.limit<=101));
});

test('history handles missing names/timestamps and never substitutes approval time for redemption time',async()=>{
  const firestore=database({ratings:{'review_H4SX-AAAA':{diciptaPada:'invalid',moderationStatus:'forged'}},review_pending:{'review_H4SX-AAAA':{status:'published',moderatedAt:9999}}});
  const {records}=await listReviewHistory(firestore);assert.equal(records[0].nama,null);assert.equal(records[0].redeemedAt,null);assert.equal(records[0].status,'published');
});

test('bounded union pagination has no duplicates or gaps when one collection is sparse',async()=>{
  const values={ratings:{},review_pending:{}};
  for(let i=0;i<235;i++){
    const id='review_H4SX-'+String(i).padStart(4,'0');
    if(i%3!==0)values.ratings[id]={nama:'Awam '+i,diciptaPada:i+1000};
    if(i%2===0||i%3===0)values.review_pending[id]={submittedAt:i+1000,status:i%3===0?'pending':'published',review:{nama:'Pending '+i}};
  }
  const firestore=database(values),records=[];let cursor=null,pages=0;
  do{const result=await listReviewHistory(firestore,cursor);records.push(...result.records);cursor=result.nextCursor;pages++;assert(pages<5);}while(cursor);
  assert(pages>=3 && pages<=4);assert.equal(records.length,235);assert.equal(new Set(records.map(r=>r.id)).size,235);
  assert.deepEqual(records.map(r=>r.redeemedAt),Array.from({length:235},(_,i)=>1234-i));
  assert.equal(records.find(r=>r.id==='review_H4SX-0002').nama,'Awam 2');
});

test('newly redeemed code appears first regardless of its code and collection',async()=>{
  const firestore=database({ratings:{
    'review_ZZZZ':{nama:'Lama',diciptaPada:1000},
    'review_AAAA':{nama:'Terkini',diciptaPada:new Date(9000)}
  },review_pending:{'review_BBBB':{status:'pending',submittedAt:8000,review:{nama:'Baru'}}}});
  const result=await listReviewHistory(firestore);
  assert.deepEqual(result.records.map(r=>r.code),['AAAA','BBBB','ZZZZ']);
  assert.equal(result.nextCursor,null);
});

test('missing timestamps stay at the bottom and do not duplicate dated counterparts',async()=>{
  const firestore=database({ratings:{
    'review_AAAA':{nama:'Tanpa tarikh'},'review_BBBB':{nama:'Ada tarikh',diciptaPada:2000}
  },review_pending:{
    'review_AAAA':{status:'published'},'review_BBBB':{status:'published',review:{nama:'Lama'}}
  }});
  const result=await listReviewHistory(firestore);
  assert.deepEqual(result.records.map(r=>[r.code,r.redeemedAt]),[['BBBB',2000],['AAAA',null]]);
});

test('invalid pagination is rejected before database reads',async()=>{
  const firestore=database({});
  for(const cursor of ['',{},123,'../secret','ratings/other','review_'+ 'x'.repeat(122)])await assert.rejects(listReviewHistory(firestore,cursor),/Penanda/);
  assert.equal(firestore.reads.length,0);
});

test('history endpoint denies anonymous, non-admin, expired and revoked tokens before reading history',async()=>{
  for(const scenario of ['anonymous','customer','expired','revoked']){
    let reads=0,verifies=0;
    const handler=createModerationHandler(async()=>({
      firestore:{collection(){reads++;throw Error('must not read history');}},
      auth:{async verifyIdToken(token,checkRevoked){verifies++;assert.equal(checkRevoked,true);if(['expired','revoked'].includes(scenario))throw Object.assign(Error('invalid'),{code:'auth/id-token-'+scenario});return {uid:'customer'};}}
    }));
    const res=response();await handler({...request,headers:scenario==='anonymous'?{origin:request.headers.origin}:request.headers},res);
    assert.equal(res.code,scenario==='anonymous'?401:scenario==='customer'?403:400);
    assert.equal(reads,0);assert.equal(verifies,scenario==='anonymous'?0:1);assert(!res.body.records);assert.equal(res.headers['Cache-Control'],'no-store');
  }
});

test('history endpoint returns only the verified admin history and rejects untrusted origins',async()=>{
  const firestore=database({ratings:{'review_H4SX-AAAA':{nama:'Ali',diciptaPada:1000}}});let verifies=0;
  const handler=createModerationHandler(async()=>({firestore,auth:{async verifyIdToken(){verifies++;return {uid:ADMIN_UID};}}}));
  const denied=response();await handler({...request,headers:{...request.headers,origin:'https://evil.example'}},denied);assert.equal(denied.code,403);assert.equal(verifies,0);
  const res=response();await handler(request,res);assert.equal(res.code,200);assert.equal(res.body.records[0].code,'H4SX-AAAA');assert.equal(res.headers['Cache-Control'],'no-store');
});

const app=readFileSync(new URL('../review/review-app.js',import.meta.url),'utf8');
function client(records=[{id:'review_H4SX-AAAA',code:'H4SX-AAAA',nama:'<img onerror="evil()">',redeemedAt:1000,status:'published'}]){
  const elements=new Map(),handlers=new Map(),calls=[];
  function element(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',hidden:true,disabled:false,replaceChildren(){this.innerHTML='';},addEventListener(name,fn){handlers.set(id+':'+name,fn);}});return elements.get(id);}
  const context={currentUser:{uid:ADMIN_UID},AbortController,setTimeout,clearTimeout,Date,Map,
    document:{getElementById:element,querySelector:element},
    adminOk:()=>context.currentUser?.uid===ADMIN_UID,
    escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    adminEmpty:text=>text,
    moderationRequest:async(payload,signal)=>{calls.push({payload,signal});return {records,nextCursor:'review_H4SX-AAAA'};}
  };
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf('  let adminHistoryRecords='),app.indexOf('  async function loadQueuedReviews(){')),context);
  return {context,element,calls,handlers};
}
test('customer history calls stay blocked and leave no history in the DOM',async()=>{
  const c=client();c.context.currentUser=null;await c.context.loadAdminReviewHistory();assert.equal(c.calls.length,0);assert.equal(c.element('adminHistoryList').innerHTML,'');assert.equal(c.element('[data-admin-center-tab="history"]').hidden,true);assert.equal(c.element('[data-admin-center-panel="history"]').hidden,true);
});
test('admin history escapes names, searches loaded codes/names and deduplicates subsequent pages',async()=>{
  const c=client();await c.context.loadAdminReviewHistory();assert.equal(c.calls.length,1);assert.equal(c.calls[0].payload.action,'history');assert.equal(c.calls[0].payload.cursor,null);assert(!c.element('adminHistoryList').innerHTML.includes('<img'));assert(c.element('adminHistoryList').innerHTML.includes('&lt;img'));assert.equal(c.element('[data-admin-center-tab="history"]').hidden,false);
  c.element('adminHistorySearch').value='h4sx-aaaa';c.context.renderAdminReviewHistory();assert(c.element('adminHistoryList').innerHTML.includes('H4SX-AAAA'));
  c.element('adminHistorySearch').value='no match';c.context.renderAdminReviewHistory();assert.match(c.element('adminHistoryList').innerHTML,/Tiada rekod/);
  c.element('adminHistorySearch').value='';await c.context.loadAdminReviewHistory(false);assert.equal(c.calls[1].payload.cursor,'review_H4SX-AAAA');assert.equal(vm.runInContext('adminHistoryRecords.length',c.context),1);
});
test('admin history offers per-code reactivation only for published reviews',async()=>{
  const c=client([
    {id:'review_H4SX-AAAA',code:'H4SX-AAAA',nama:'Ali',redeemedAt:1000,status:'published'},
    {id:'review_H4SX-BBBB',code:'H4SX-BBBB',nama:'Bala',redeemedAt:900,status:'pending'},
    {id:'review_H4SX-CCCC',code:'H4SX-CCCC',nama:'Chong',redeemedAt:800,status:'rejected'}
  ]);
  await c.context.loadAdminReviewHistory();
  const html=c.element('adminHistoryList').innerHTML;
  assert.equal((html.match(/data-reactivate-edit=/g)||[]).length,1);
  assert(html.includes('data-reactivate-edit="review_H4SX-AAAA"'));
  assert(html.includes('data-edit-minutes="review_H4SX-AAAA"'));
  assert(!html.includes('data-reactivate-edit="review_H4SX-BBBB"'));
  assert(!html.includes('data-reactivate-edit="review_H4SX-CCCC"'));
});
test('logout clears loaded history and stale in-flight responses cannot restore it',async()=>{
  const c=client();await c.context.loadAdminReviewHistory();let finish;
  c.context.moderationRequest=()=>new Promise(resolve=>finish=resolve);
  const pending=c.context.loadAdminReviewHistory(false);c.context.currentUser=null;c.context.clearAdminReviewHistory();
  assert.equal(c.element('adminHistoryList').innerHTML,'');assert.equal(c.element('adminHistoryStatus').textContent,'');
  finish({records:[{id:'review_H4SX-BBBB',code:'H4SX-BBBB',nama:'Stale',status:'pending'}],nextCursor:null});await pending;
  assert.equal(c.element('adminHistoryList').innerHTML,'');assert.equal(vm.runInContext('adminHistoryRecords.length',c.context),0);
  assert(app.includes('currentUser = user;\n    clearAdminReviewHistory();'));
});
test('history request failure is visible and can be retried without remaining stuck loading',async()=>{
  const c=client();c.context.moderationRequest=async()=>{throw Error('Backend gagal');};await c.context.loadAdminReviewHistory();assert.equal(c.element('adminHistoryStatus').textContent,'Backend gagal');assert.equal(c.element('btnAdminRefreshHistory').disabled,false);
  c.context.moderationRequest=async()=>({records:[],nextCursor:null});await c.context.loadAdminReviewHistory();assert.match(c.element('adminHistoryStatus').textContent,/0 rekod/);assert.equal(c.element('btnAdminMoreHistory').hidden,true);
});
test('history tab starts hidden and does not modify customer edit controls',()=>{
  const html=readFileSync(new URL('../review/index.htm',import.meta.url),'utf8');assert(html.includes('data-admin-center-tab="history" hidden'));assert(html.includes('data-admin-center-panel="history" hidden'));assert(html.includes('data-customer-review-edit'));assert(html.includes('review-edit-reactivation-20261018'));assert(html.includes('review-reactivation-20261018'));assert(!html.includes('H4SX-AAAA'));
  const store=readFileSync(new URL('../index.htm',import.meta.url),'utf8');assert(store.includes('review-reactivation-20261018'));
});

test('review and store suggestions do not prefix CDG, and old badges/text are hidden',()=>{
  const store=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert(!app.includes('suggestion-badge'));assert(app.includes("ulasanPaparan = String(data.ulasan || '').replace(/^cdg"));
  assert(!app.includes('CDG_PREFIX'));assert(!store.includes("review.value = 'cdg - '"));
  assert(store.includes("(item.ulasan || item.komen || item.comment || item.feedback || 'Memberikan rating kepada H4SX STORE.').replace(/^cdg"));
});
