import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../review/review-app.js',import.meta.url),'utf8');
const image='data:image/jpeg;base64,AAAA';
function setup(){
  const nodes=new Map(),toasts=[],decoded=[];
  const node=()=>({value:'',disabled:false,textContent:'',style:{},events:{},classList:{toggle(){},remove(){}},addEventListener(name,fn){this.events[name]=fn;},querySelector(){return this.img||null;},appendChild(img){this.img=img;img.parentNode=this;}});
  const el=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  const zoom={value:150,offset:12,set(value){this.value=value;},setOffset(value){this.offset=value;},get(){return this.value;},getOffset(){return this.offset;},apply(){}};
  const context={document:{getElementById:el},editingCustomerId:'review_TEST',customerSaveInProgress:false,removeCustomerImage:false,btnSaveCustomer:el('btnSaveCustomer'),btnRemoveCustomerImage:el('btnRemoveCustomerImage'),customerAvatarPreview:el('customerAvatarPreview'),customerAvatarText:el('customerAvatarText'),adminOk:()=>true,showToast:(...args)=>toasts.push(args),URL,
    Image:class{constructor(){this.style={};}remove(){this.parentNode.img=null;this.parentNode=null;}},
    File:class{constructor(parts,name,{type}){this.name=name;this.type=type;this.size=100;}},
    navigator:{clipboard:{read:async()=>[{types:['text/plain','image/png'],getType:async()=>({})}]}},
    window:{H4ReviewMedia:{createProfileZoom:()=>zoom,compressFile:async file=>{decoded.push(file);return image;},safeImage:value=>value===image?value:null}}
  };
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf("  const customerImageUrl ="),app.indexOf('  function kemaskiniCustomerPreview()')),context);
  return {context,el,zoom,toasts,decoded,run:code=>vm.runInContext(code,context),paste:()=>el('btnPasteCustomerImage').events.click()};
}
function installSave(t){
  const saved=[],handler=app.slice(app.indexOf("  btnSaveCustomer.addEventListener('click'"),app.indexOf('  function getNamePayloadFromInputs()'));
  for(const [,name] of handler.matchAll(/(\w+)\.(?:value|checked)/g))if(!(name in t.context))t.context[name]=t.el(name);
  for(const name of ['nameEmojiInput','medalEmojiInput','customerAnnouncementGifInput'])t.context[name]=t.el(name);
  t.context.customerNameInput.value='Ali';
  Object.assign(t.context,{TextEncoder,customerAnnouncementUploadedData:'',reviewEmojiValue:()=>'',allDocs:[{id:'review_TEST',profileImg:'https://example.com/original.png'}],chatBackgroundSettingsFromInputs:()=>({chatBackgroundType:'none'}),announcementSettingsFromInputs:()=>({}),identityBackplateSettingsFromInputs:()=>({}),announcementGifSize:()=>100,simpanCustomerPayload:payload=>saved.push(payload)});
  t.run(handler);
  return {saved,save:()=>t.context.btnSaveCustomer.events.click()};
}

test('admin clipboard button compresses image, previews it and uses it in the save image value',async()=>{
  const t=setup();await t.paste();
  assert.equal(t.decoded.length,1);assert.equal(t.decoded[0].type,'image/png');
  assert.equal(t.context.customerAvatarPreview.img.src,image);
  assert.equal(t.run('customerImageLink()'),image);
  assert.equal(t.run('customerImageChanged'),true);assert.equal(t.context.removeCustomerImage,false);
  assert.equal(t.zoom.value,100);assert.equal(t.zoom.offset,0);
  assert.equal(t.el('customerImageUrl').value,'');assert.equal(t.context.btnSaveCustomer.disabled,false);
  assert.match(t.el('customerProfileClipboardStatus').textContent,/Tekan Simpan/);
});

test('actual Save handler sends clipboard image and zoom, keeps untouched images, and supports explicit removal',async()=>{
  const t=setup(),s=installSave(t);s.save();assert.equal('profileImg' in s.saved[0],false);
  await t.paste();s.save();assert.equal(s.saved[1].profileImg,image);assert.equal(s.saved[1].profileZoom,100);assert.equal(s.saved[1].profileOffsetY,0);
  t.run('resetCustomerClipboard();removeCustomerImage=true');s.save();assert.equal(s.saved[2].profileImg,null);
});

test('Ctrl+V in the profile zone or URL input consumes images only and preserves text paste',async()=>{
  for(const target of ['customerProfileClipboard','customerImageUrl']){
    const t=setup(),file={type:'image/png',size:100};
    const event={clipboardData:{items:[{type:'image/png',getAsFile:()=>file}]},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
    await t.el(target).events.paste(event);
    assert(event.prevented&&event.stopped);assert.equal(t.decoded[0],file);
    const text={clipboardData:{items:[{type:'text/plain'}]},preventDefault(){assert.fail('text paste must not be intercepted');}};
    t.el(target).events.paste(text);assert.equal(t.decoded.length,1);
  }
});

test('unavailable, denied and empty clipboards show actionable errors and leave original image unchanged',async()=>{
  for(const mode of ['unsupported','denied','empty']){
    const t=setup();t.run("previewCustomerImage('https://example.com/original.png')");
    if(mode==='unsupported')t.context.navigator.clipboard={};
    if(mode==='denied')t.context.navigator.clipboard.read=async()=>{throw Error('NotAllowedError');};
    if(mode==='empty')t.context.navigator.clipboard.read=async()=>[{types:['text/plain']}];
    await t.paste();assert.equal(t.decoded.length,0);assert.equal(t.toasts.length,1);
    assert.match(t.toasts[0][0],mode==='empty'?/Copy gambar/:/Ctrl\+V/);
    assert.equal(t.context.customerAvatarPreview.img.src,'https://example.com/original.png');
    assert.equal(t.run('customerImageChanged'),false);assert.equal(t.context.btnSaveCustomer.disabled,false);
  }
});

test('invalid or oversized images do not replace an already selected clipboard image',async()=>{
  for(const bad of ['not-an-image','data:image/jpeg;base64,'+'A'.repeat(600000)]){
    const t=setup();await t.paste();t.context.window.H4ReviewMedia.compressFile=async()=>bad;
    await t.paste();assert.equal(t.run('customerImageLink()'),image);assert.equal(t.toasts.length,1);
    assert.equal(t.context.btnSaveCustomer.disabled,false);
  }
});

test('save is blocked during decoding and stale results cannot overwrite URL, removal or another editor',async()=>{
  for(const invalidate of ["document.getElementById('customerImageUrl').value='https://example.com/new.png';document.getElementById('customerImageUrl').events.input()",'resetCustomerClipboard();removeCustomerImage=true;',"resetCustomerClipboard();editingCustomerId='review_OTHER';"]){
    const t=setup(),s=installSave(t);let finish,start;const started=new Promise(resolve=>start=resolve);
    t.context.window.H4ReviewMedia.compressFile=()=>{start();return new Promise(resolve=>finish=resolve);};
    const pending=t.paste();await started;
    assert.equal(t.context.btnSaveCustomer.disabled,true);assert.equal(t.el('btnPasteCustomerImage').disabled,true);
    assert.equal(t.run('customerImageBusy'),true);s.save();assert.equal(s.saved.length,0);t.run(invalidate);finish(image);await pending;
    assert.equal(t.run('customerClipboardImage'),null);assert.equal(t.context.customerAvatarPreview.img,undefined);
    assert.equal(t.context.btnSaveCustomer.disabled,false);
  }
});

test('URL replacement takes precedence over clipboard, validates HTTPS, and reset preserves unchanged saved images',async()=>{
  const t=setup();await t.paste();t.el('customerImageUrl').value='https://example.com/new.png';t.el('customerImageUrl').events.input();
  assert.equal(t.run('customerImageLink()'),'https://example.com/new.png');
  t.el('customerImageUrl').value='javascript:alert(1)';assert.throws(()=>t.run('customerImageLink()'),/HTTPS/);
  t.run("resetCustomerClipboard();customerImageChanged=false;customerImageUrl.value='';previewCustomerImage('data:image/jpeg;base64,AAAA')");
  assert.equal(t.run('customerImageChanged'),false);assert.equal(t.context.customerAvatarPreview.img.src,image);
});

test('non-admin and saving editors cannot read the clipboard or start image processing',async()=>{
  for(const condition of ['editingCustomerId=null','adminOk=()=>false','customerSaveInProgress=true']){
    const t=setup();t.context.navigator.clipboard.read=()=>assert.fail('must not read clipboard');t.run(condition);await t.paste();assert.equal(t.decoded.length,0);
  }
});

test('editor resets clipboard drafts on open, close, suggest and remove, and guards both save paths while decoding',()=>{
  for(const [start,end] of [['  function bukaCustomerModal(', '  function tutupCustomerModal()'],['  function tutupCustomerModal()', '  async function simpanCustomerPayload'],["  btnSuggestCustomerProfile.addEventListener('click'", "  btnRemoveCustomerImage.addEventListener('click'"],["  btnRemoveCustomerImage.addEventListener('click'",'  function handleCustomerSaveShortcut']]){
    assert.match(app.slice(app.indexOf(start),app.indexOf(end)),/resetCustomerClipboard\(\)/);
  }
  assert.match(app,/async function simpanCustomerPayload[\s\S]*?customerSaveInProgress \|\| customerImageBusy/);
  assert.match(app,/btnSaveCustomer\.addEventListener\('click', \(\) => \{\s*if \([^\n]*customerImageBusy\) return/);
  assert.match(app,/if \(removeCustomerImage\) payload\.profileImg = null;\s*else if \(customerImageChanged\) \{\s*try \{ payload\.profileImg = customerImageLink\(\)/);
  const html=readFileSync(new URL('../review/index.htm',import.meta.url),'utf8');
  assert.match(html,/<button type="button"[^>]*id="btnPasteCustomerImage"/);
  assert.match(html,/id="customerProfileClipboard"[^>]*tabindex="0"/);
});
