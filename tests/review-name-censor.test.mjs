import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {maskReviewName,listReviewNameCensors,setReviewNameCensor} from '../lib/review-name-censor.js';
import {createModerationHandler} from '../api/review-moderation.js';
import {ADMIN_UID} from '../lib/review-moderation.js';

function reviewStores(values={}) {
  const privateNames={};
  const firestore={doc(path){
    const [collection,id]=path.split('/');
    return {
      async get(){const value=values[collection]?.[id];return {exists:value!==undefined,data:()=>value};},
      async update(patch){
        const value=values[collection]?.[id];
        if(!value)throw Error('missing');
        for(const [key,next] of Object.entries(patch)){
          const parts=key.split('.');
          let target=value;
          for(const part of parts.slice(0,-1))target=target[part]||=( {});
          target[parts.at(-1)]=next;
        }
      }
    };
  }};
  const database={ref(path){
    const id=path.split('/')[1];
    return {
      async once(){return {val:()=>id?privateNames[id]:privateNames};},
      async set(value){privateNames[id]=value;},
      async remove(){delete privateNames[id];}
    };
  }};
  return {firestore,database,values,privateNames};
}

test('name masks retain readable first and last characters, whitespace, and Unicode',()=>{
  assert.equal(maskReviewName('Danish'),'D****h');
  assert.equal(maskReviewName('Al'),'**');
  assert.equal(maskReviewName('A'),'*');
  assert.equal(maskReviewName('  Danish   Ali  '),'  D****h   A*i  ');
  assert.equal(maskReviewName('Élodie 张伟'),'É****e **');
});

test('censoring stores original names privately and can be reversed for published and pending reviews',async()=>{
  const store=reviewStores({
    ratings:{review_AAAA:{nama:'Danish',nameCensored:false,balasanAdmin:'Terima kasih, Danish!'}},
    review_pending:{review_BBBB:{status:'pending',review:{nama:'Ari',ulasan:'Teks'}}}
  });
  assert.deepEqual(await setReviewNameCensor(store.firestore,store.database,'review_AAAA',true,123),{success:true,censored:true});
  assert.equal(store.values.ratings.review_AAAA.nama,'D****h');
  assert.equal(store.values.ratings.review_AAAA.nameCensored,true);
  assert.equal(store.values.ratings.review_AAAA.balasanAdmin,'Terima kasih, D****h!');
  assert.equal(store.privateNames.review_AAAA.originalName,'Danish');
  assert.equal(store.privateNames.review_AAAA.originalReply,'Terima kasih, Danish!');
  assert.deepEqual(await setReviewNameCensor(store.firestore,store.database,'review_BBBB',true,124),{success:true,censored:true});
  assert.equal(store.values.review_pending.review_BBBB.review.nama,'A*i');
  assert.equal(store.privateNames.review_BBBB.originalName,'Ari');
  assert.deepEqual(await listReviewNameCensors(store.database),{review_AAAA:'Danish',review_BBBB:'Ari'});
  await setReviewNameCensor(store.firestore,store.database,'review_AAAA',false,125);
  await setReviewNameCensor(store.firestore,store.database,'review_BBBB',false,126);
  assert.equal(store.values.ratings.review_AAAA.nama,'Danish');
  assert.equal(store.values.ratings.review_AAAA.nameCensored,false);
  assert.equal(store.values.ratings.review_AAAA.balasanAdmin,'Terima kasih, Danish!');
  assert.equal(store.values.review_pending.review_BBBB.review.nama,'Ari');
  assert.deepEqual(await listReviewNameCensors(store.database),{});
});

test('censor action is idempotent and rejects invalid IDs, values, and inconsistent private state',async()=>{
  const store=reviewStores({ratings:{review_AAAA:{nama:'Danish'}}});
  await setReviewNameCensor(store.firestore,store.database,'review_AAAA',true,123);
  await setReviewNameCensor(store.firestore,store.database,'review_AAAA',true,124);
  assert.equal(store.privateNames.review_AAAA.originalName,'Danish');
  await assert.rejects(setReviewNameCensor(store.firestore,store.database,'../x',true),/ID ulasan/);
  await assert.rejects(setReviewNameCensor(store.firestore,store.database,'review_AAAA','true'),/Tetapan sensor/);
  delete store.privateNames.review_AAAA;
  store.values.ratings.review_AAAA.nameCensored=true;
  await assert.rejects(setReviewNameCensor(store.firestore,store.database,'review_AAAA',false),/Nama asal/);
});

test('the admin-only moderation API returns private names only after verifying the admin',async()=>{
  let privateReads=0;
  const makeHandler=uid=>createModerationHandler(async()=>({
    auth:{async verifyIdToken(){return {uid};}},
    firestore:{doc(){return {async get(){return {data:()=>({})};}};},collection(){return {where(){return this;},limit(){return this;},async get(){return {docs:[]};}};}},
    database:{ref(){return {async once(){privateReads++;return {val:()=>({review_AAAA:{originalName:'Danish'}})};}};}}
  }));
  const req={method:'POST',headers:{origin:'https://www.h4sxmy.xyz',authorization:'Bearer token'},body:{action:'list'}};
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  const denied=response();await makeHandler('customer')(req,denied);
  assert.equal(denied.code,403);
  assert.equal(privateReads,0);
  const allowed=response();await makeHandler(ADMIN_UID)(req,allowed);
  assert.deepEqual(allowed.body.nameCensors,{review_AAAA:'Danish'});
  assert.equal(privateReads,1);
});

test('permanent review deletion also removes its private original-name record',async()=>{
  const docs=new Map([['ratings/review_AAAA',{nama:'D****h',nameCensored:true}]]);
  const privateNames=new Map([['review_private_names/review_AAAA',{originalName:'Danish'}]]);
  const firestore={
    doc(path){return {path,async get(){const value=docs.get(path);return {exists:docs.has(path),data:()=>value};}}},
    async runTransaction(callback){
      const writes=[];
      const result=await callback({get:ref=>ref.get(),delete:ref=>writes.push(()=>docs.delete(ref.path)),set:(ref,value)=>writes.push(()=>docs.set(ref.path,value)),update:(ref,value)=>writes.push(()=>docs.set(ref.path,{...docs.get(ref.path),...value}))});
      writes.forEach(write=>write());
      return result;
    }
  };
  const handler=createModerationHandler(async()=>({
    auth:{async verifyIdToken(){return {uid:ADMIN_UID};}},
    firestore,
    database:{ref(path){return {async remove(){privateNames.delete(path);}};}}
  }));
  const response={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:'POST',headers:{origin:'https://www.h4sxmy.xyz',authorization:'Bearer token'},body:{action:'delete',id:'review_AAAA'}},response);
  assert.equal(response.code,200);
  assert.equal(docs.has('ratings/review_AAAA'),false);
  assert.equal(privateNames.has('review_private_names/review_AAAA'),false);
});

test('storefront and public review cards render the public nama field while admin moderation has censor controls',()=>{
  const store=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../review/review-app.js',import.meta.url),'utf8');
  assert(store.includes("doc.id, ...doc.data()"));
  assert.match(store,/const name = item\.nama \|\| item\.name/);
  assert.match(store,/escapeHtml\(name\)/);
  assert(app.includes('escapeHtml(rawNama)'));
  assert(!app.includes('deleteDoc(doc(db,"ratings"'));
  assert(app.includes("moderationRequest({action:'delete',id}"));
  assert(app.includes('data-admin-row-action="${censored?\'uncensorName\':\'censorName\'}"'));
  assert(app.includes("adminOriginalNames=new Map(Object.entries(data.nameCensors||{})"));
});

test('admin moderation shows originals only in its authenticated review-management name lookup',()=>{
  const app=readFileSync(new URL('../review/review-app.js',import.meta.url),'utf8');
  const context={adminOriginalNames:new Map([['review_AAAA','Danish']])};
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf('  function adminReviewName('),app.indexOf('  function getAdminModerationList(')),context);
  assert.equal(context.adminReviewName({id:'review_AAAA',nama:'D****h'}),'Danish');
  assert.equal(context.adminReviewName({id:'review_BBBB',nama:'A*i'}),'A*i');
  assert.match(context.reviewNameCensorControl({id:'review_AAAA'}),/uncensorName/);
  assert.match(context.reviewNameCensorControl({id:'review_BBBB'}),/censorName/);
});
