import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../review-media.js',import.meta.url),'utf8');
function setup(overrides={}){
  const events={},inputs={name:{value:'Ali',maxLength:40},rating:{value:'5',maxLength:-1},review:{value:'Barang sampai',maxLength:500}},saved=new Map(),timers=new Map();let next=0;
  const root={document:{hidden:false,getElementById:id=>inputs[id],addEventListener:(name,fn)=>events[name]=fn,querySelectorAll:()=>[]},sessionStorage:{setItem:(key,value)=>saved.set(key,value),getItem:key=>saved.get(key)||null,removeItem:key=>saved.delete(key)},addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name],setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),innerHeight:800,...overrides};
  vm.runInNewContext(source,{window:root});return {root,events,inputs,saved,timers,api:root.H4ReviewMedia};
}
test('camera compression resizes before drawing and releases bitmap and canvas',async()=>{
  let options,closed=false;const canvas={getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,AAAA'};
  const ctx=setup({createImageBitmap:async(file,opts)=>{options=opts;return {width:900,height:1200,close(){closed=true;}};}});ctx.root.document.createElement=()=>canvas;
  assert.equal(await ctx.api.compressFile({type:'image/jpeg',size:9*1024*1024}),'data:image/jpeg;base64,AAAA');assert.equal(options.resizeWidth,900);assert.equal(closed,true);assert.equal(canvas.width,0);assert.equal(canvas.height,0);
});
test('fallback revokes object URL when camera image cannot load',async()=>{
  let revoked;const ctx=setup({URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:url=>revoked=url},Image:class{set src(value){this.onerror();}}});await assert.rejects(ctx.api.compressFile({type:'image/jpeg',size:3000}),/Gagal membaca/);assert.equal(revoked,'blob:test');
});
test('oversized and non-image feedback is rejected before decoding',async()=>{
  const ctx=setup({createImageBitmap:()=>assert.fail('must not decode invalid uploads')});await assert.rejects(ctx.api.compressFile({type:'application/pdf',size:1000}),/gambar/);await assert.rejects(ctx.api.compressFile({type:'image/jpeg',size:21*1024*1024}),/20MB/);
});
test('draft survives reload, stays isolated by page and clears after successful submit',()=>{
  const ctx=setup();let extra={feedbackImage:'data:image/jpeg;base64,AAAA'},restored;const opts={key:'store',container:{addEventListener(){}},fields:['name','rating','review'],getExtra:()=>extra,restoreExtra:data=>restored=data,isOpen:()=>true};const draft=ctx.api.createDraft(opts);draft.save();assert(ctx.saved.has('store'));ctx.inputs.name.value='';ctx.inputs.review.value='';assert(draft.restore());assert.equal(ctx.inputs.name.value,'Ali');assert.equal(restored.feedbackImage,extra.feedbackImage);assert.equal(ctx.api.createDraft({...opts,key:'review-page'}).restore(),false);draft.clear();ctx.events.pagehide();assert.equal(ctx.saved.has('store'),false);
});
test('storage quota fallback preserves text even if images cannot fit',()=>{
  const ctx=setup();ctx.root.sessionStorage.setItem=(key,value)=>{if(JSON.parse(value).extra.feedbackImage)throw Error('quota');ctx.saved.set(key,value);};ctx.api.createDraft({key:'draft',container:{addEventListener(){}},fields:['name','review'],getExtra:()=>({feedbackImage:'large-photo'}),restoreExtra(){}}).save();const data=JSON.parse(ctx.saved.get('draft'));assert.equal(data.fields.review,'Barang sampai');assert.equal(data.extra.feedbackImage,null);
});
test('camera picker checkpoints draft and pauses videos before launching camera; cancel does not reload',()=>{
  const ctx=setup();const calls=[],listeners={};ctx.root.document.querySelectorAll=()=>[{paused:false,pause:()=>calls.push('pause'),isConnected:true,getBoundingClientRect:()=>({width:100,height:100,bottom:200,top:100}),play:()=>{calls.push('resume');return Promise.resolve();}}];const input={addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name],click:()=>calls.push('camera')};ctx.api.pickFile(input,{save:()=>calls.push('save')});assert.deepEqual(calls,['save','pause','camera']);listeners.cancel();[...ctx.timers.values()].forEach(fn=>fn());assert.deepEqual(calls,['save','pause','camera','resume']);
});
