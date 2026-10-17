import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../review/review-app.js',import.meta.url),'utf8');
function setup(){const classList=()=>({values:new Set(),add(v){this.values.add(v)},remove(v){this.values.delete(v)}}),status={textContent:''},save={tagName:'BUTTON',disabled:false},announce={tagName:'TEXTAREA',disabled:false,value:'old'},overlay={classList:classList()},panel={classList:classList(),querySelectorAll:()=>[save,announce]};let finish,timedOut,reads=0;const context={mintaAdmin:()=>true,adminOk:()=>true,adminOverlayBg:overlay,adminPanelModal:panel,adminAnnounceText:announce,btnSaveAdmin:save,document:{getElementById:()=>status},syncReviewVoteAdmin(){},db:{},doc:(db,...parts)=>parts.join('/'),getDoc:()=>{reads++;return new Promise(resolve=>finish=resolve)},AUTO_ZIXU_CONFIG_ID:'zixu',DEFAULT_ZIXU_CONFIG:{},isiAutoZixuForm(){},setTimeout:fn=>{timedOut=fn;return 1},clearTimeout(){}};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('  const DEFAULT_ANNOUNCEMENT_TEXT ='),app.indexOf("  btnOpenAdminConfig.addEventListener('click',openAdminSettings);")),context);return {context,status,save,announce,overlay,panel,get reads(){return reads},timeout:()=>timedOut(),complete:()=>finish({exists:()=>true,data:()=>({text:'new'})})};}
test('Admin panel opens immediately while Firebase reads remain unresolved; repeated clicks do not duplicate reads',async()=>{const t=setup();const loading=t.context.openAdminSettings();assert(t.panel.classList.values.has('show'));assert(t.overlay.classList.values.has('show'));assert.equal(t.reads,2);assert.equal(t.save.disabled,true);await t.context.openAdminSettings();assert.equal(t.reads,2);t.panel.classList.remove('show');t.overlay.classList.remove('show');t.timeout();await loading;assert(!t.panel.classList.values.has('show'));assert.match(t.status.textContent,/Firebase lambat/);assert.equal(t.announce.value,'old');assert.equal(t.save.disabled,true);});
test('successful retry enables Save after a loading timeout',async()=>{const t=setup();const first=t.context.openAdminSettings();t.timeout();await first;t.context.getDoc=async()=>({exists:()=>true,data:()=>({text:'new'})});await t.context.openAdminSettings();assert.equal(t.announce.value,'new');assert.equal(t.save.disabled,false);assert.equal(t.status.textContent,'');});
test('unauthenticated click keeps settings closed and performs no reads',async()=>{const t=setup();t.context.mintaAdmin=()=>false;await t.context.openAdminSettings();assert.equal(t.reads,0);assert(!t.panel.classList.values.has('show'));});
test('missing or empty stored announcement uses the declared fallback while non-empty text is preserved',async()=>{
 const t=setup(),fallback=vm.runInContext('DEFAULT_ANNOUNCEMENT_TEXT',t.context);let announcement={exists:()=>true,data:()=>({text:''})};
 t.context.getDoc=async reference=>reference.endsWith('/announcement')?announcement:{exists:()=>false,data:()=>undefined};
 await t.context.openAdminSettings();assert.equal(t.announce.value,fallback);assert(fallback.includes('OLD SUPPORTER'));
 for(const value of [undefined,null,'   ']){
  announcement={exists:()=>true,data:()=>({text:value})};
  await t.context.openAdminSettings();assert.equal(t.announce.value,fallback);
 }
 announcement={exists:()=>true,data:()=>({text:'Pengumuman tersimpan'})};
 await t.context.openAdminSettings();assert.equal(t.announce.value,'Pengumuman tersimpan');
});
