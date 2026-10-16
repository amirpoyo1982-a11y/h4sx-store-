import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');const app=read('review/review-app.js');
test('approval shortcut is visible at the top of the admin menu, without duplicating the old button',()=>{const html=read('review/index.htm');assert.equal((html.match(/id="btnOpenReviewCenter"/g)||[]).length,1);assert(html.indexOf('id="btnOpenReviewCenter"')<html.indexOf('id="adminAnnounceText"'));assert(html.includes('Semak ulasan — Lulus / Tolak'));});
test('shortcut clears old filters and opens the waiting list directly',()=>{const fields=Object.fromEntries(['adminReviewSearch','adminReviewRatingFilter','adminReviewStatusFilter','adminReviewSort'].map(id=>[id,{value:'old'}]));let tab,loaded=0;const selected=new Set(['old']);const context={document:{getElementById:id=>fields[id]},mintaAdmin:()=>true,selectedAdminReviews:selected,openAdminReviewCenter:name=>tab=name,loadQueuedReviews:()=>loaded++};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('  function openWaitingReviews(){'),app.indexOf('  let queuedReviews=')),context);context.openWaitingReviews();assert.equal(tab,'moderation');assert.equal(fields.adminReviewStatusFilter.value,'needsReview');assert.equal(fields.adminReviewSearch.value,'');assert.equal(fields.adminReviewRatingFilter.value,'all');assert.equal(selected.size,0);assert.equal(loaded,1);});
test('waiting review shows labelled approve/reject buttons rather than ambiguous icons',()=>{const context={adminReviewStatus:r=>r.moderationStatus||"published"};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('  function moderationActionsMarkup('),app.indexOf('  function renderAdminModeration(){')),context);const html=context.moderationActionsMarkup({pendingSource:true,hasFeedbackImage:true});assert(html.includes('> Luluskan</button>'));assert(html.includes('> Tolak</button>'));assert(html.includes('data-admin-row-action="detail"'));assert(!html.includes('data-admin-row-action="reply"'));assert(context.moderationActionsMarkup({pendingSource:false}).includes('data-admin-row-action="reply"'));});

test('trash uses a separate no-download path and exposes restore controls',()=>{const context={adminReviewStatus:r=>r.moderationStatus||'published'};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('  function moderationActionsMarkup('),app.indexOf('  function renderAdminModeration(){')),context);const html=context.moderationActionsMarkup({moderationStatus:'trash'});assert(html.includes('data-admin-row-action="restore"'));assert(!html.includes('data-admin-row-action="publish"'));const branch=app.slice(app.indexOf("    if(['trash','restore'].includes(action))"),app.indexOf("    if(action==='detail')",app.indexOf('async function runAdminReviewAction')));assert(!branch.includes('downloadAdminData'));assert(read('app.js').includes("'pending', 'trash'"));});

test('badge action grid has labelled icons above text and a full-width cancel button',()=>{
 const html=read('review/index.htm'),start=html.indexOf('class="admin-btn-row badge-action-grid"'),grid=html.slice(start,html.indexOf('</div>',start));
 for(const id of ['btnSaveBadge','btnApplyBadgeAll','btnRemoveVerifiedBuyer','btnRemoveCustomCheck','btnRemoveApprovedRole','btnRemoveBadge','btnCancelBadge'])assert.match(grid,new RegExp('id="'+id+'"><i[^>]+aria-hidden="true"></i><span>[^<]+</span></button>'));
 assert.equal((grid.match(/<span>/g)||[]).length,7);
 const css=read('review/review-style.css');assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));assert(css.includes('flex-direction:column'));assert(css.includes('grid-column:1 / -1'));assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
});
test('custom approved role uses escaped per-review text and respects global and per-review visibility',()=>{
 const context={DEFAULT_REVIEW_ADMIN_SETTINGS:{approvedRole:{enabled:true,text:'DILULUSKAN'}},reviewAdminSettings:{},warnaHexSah:(value,fallback)=>fallback,escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')};
 vm.createContext(context);vm.runInContext(app.slice(app.indexOf('  function approvedRoleMarkup('),app.indexOf('  function switchAdminCenterTab(')),context);
 assert.match(context.approvedRoleMarkup({approvedRoleGranted:true,approvedRoleText:'Diluluskan & diedit'}),/Diluluskan &amp; diedit/);
 assert.match(context.approvedRoleMarkup({approvedRoleGranted:true,approvedRoleText:''}),/DILULUSKAN/);
 const escaped=context.approvedRoleMarkup({approvedRoleGranted:true,approvedRoleText:'<script>bad</script>'});assert(!escaped.includes('<script>'));assert(escaped.includes('&lt;script&gt;'));
 assert.equal(context.approvedRoleMarkup({approvedRoleText:'OWNER'}),'');assert.equal(context.approvedRoleMarkup({approvedRoleGranted:true,approvedRoleRemoved:true}),'');
 context.reviewAdminSettings={approvedRole:{enabled:false}};assert.equal(context.approvedRoleMarkup({approvedRoleGranted:true,approvedRoleText:'Custom'}),'');
});
test('both pending and reported reviews expose the role editor, but trashed reviews do not',()=>{
 const context={adminReviewStatus:r=>r.moderationStatus||'published'};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('  function moderationActionsMarkup('),app.indexOf('  function renderAdminModeration(){')),context);
 for(const record of [{pendingSource:true,moderationStatus:'pending'},{moderationStatus:'hidden',autoHiddenByReports:true}])assert(context.moderationActionsMarkup(record).includes('data-admin-row-action="editFeedback"'));
 assert(!context.moderationActionsMarkup({moderationStatus:'trash'}).includes('data-admin-row-action="editFeedback"'));
});

function roleEditor(){
 const calls=[],elements=new Map(),handlers=new Map();let mounted=0,loaded=0,disposed=0,dialogExists=false;
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{value:'',textContent:'',disabled:false,addEventListener:(name,fn)=>handlers.set(selector+':'+name,fn)});return elements.get(selector);};
 const dialog={open:false,querySelector:element,showModal(){this.open=true;dialogExists=true;},close(){this.open=false;handlers.get('dialog:close')?.();},remove(){dialogExists=false;},addEventListener:(name,fn)=>handlers.set('dialog:'+name,fn)};
 const context={document:{createElement:()=>dialog,body:{append(){}},querySelector:()=>dialogExists?dialog:null},mintaAdmin:()=>true,adminOk:()=>true,
  moderationRequest:async payload=>{calls.push(payload);if(payload.action==='detail')return {review:{nama:'Ali',ulasan:'Asal',approvedRoleText:'Disemak'}};if(context.failSave)throw Error('Backend gagal');return {success:true};},
  mountAdminFeedbackFields:()=>{mounted++;return {getPatch:async()=>({}),setSaving:value=>element('.admin-feedback-save').disabled=value,dispose:()=>disposed++};},
  showToast(){},loadQueuedReviews:async()=>loaded++};
 vm.createContext(context);vm.runInContext(app.slice(app.indexOf('  async function openAdminFeedbackDialog('),app.indexOf('  function timestampToDatetimeLocal(')),context);
 return {context,element,dialog,calls,save:()=>handlers.get('.admin-feedback-save:click')(),get mounted(){return mounted;},get loaded(){return loaded;},get disposed(){return disposed;}};
}
test('role editor loads current values and saves review-specific text without approving automatically',async()=>{
 const c=roleEditor();await c.context.openAdminFeedbackDialog({id:'review_ROLE'});assert.equal(c.element('.admin-feedback-role-input').value,'Disemak');assert.equal(c.element('textarea').value,'Asal');
 assert(c.dialog.innerHTML.includes('maxlength="24"'));assert(c.dialog.innerHTML.includes('for="adminFeedbackText"'));
 await c.context.openAdminFeedbackDialog({id:'review_ROLE'});assert.equal(c.calls.length,1);
 c.element('.admin-feedback-role-input').value='Diluluskan & diedit';c.element('textarea').value='Dikemaskini';await c.save();
 assert.equal(JSON.stringify(c.calls[1]),JSON.stringify({action:'editFeedback',id:'review_ROLE',patch:{ulasan:'Dikemaskini',approvedRoleText:'Diluluskan & diedit'}}));
 assert.equal(c.calls.length,2);assert.equal(c.dialog.open,false);assert.equal(c.loaded,1);assert.equal(c.disposed,1);
});
test('role editor retains edits after a failed save and can retry; customers cannot open it',async()=>{
 const c=roleEditor();c.context.mintaAdmin=()=>false;await c.context.openAdminFeedbackDialog({id:'review_ROLE'});assert.equal(c.calls.length,0);assert.equal(c.dialog.open,false);
 c.context.mintaAdmin=()=>true;await c.context.openAdminFeedbackDialog({id:'review_ROLE'});c.context.failSave=true;c.element('.admin-feedback-role-input').value='Custom';await c.save();
 assert.equal(c.dialog.open,true);assert.equal(c.element('p').textContent,'Backend gagal');assert.equal(c.element('.admin-feedback-save').disabled,false);assert.equal(c.element('.admin-feedback-role-input').value,'Custom');assert.equal(c.loaded,0);
 c.context.failSave=false;await c.save();assert.equal(c.dialog.open,false);assert.equal(c.loaded,1);
});
test('role editor does not mount sensitive fields after auth is lost during loading',async()=>{
 const c=roleEditor();let finish;c.context.moderationRequest=()=>new Promise(resolve=>finish=resolve);
 const loading=c.context.openAdminFeedbackDialog({id:'review_ROLE'});c.context.adminOk=()=>false;
 finish({review:{ulasan:'PRIVATE',approvedRoleText:'PRIVATE'}});await loading;
 assert.equal(c.mounted,0);assert.equal(c.element('textarea').value,'');assert.equal(c.element('.admin-feedback-save').disabled,true);
});
