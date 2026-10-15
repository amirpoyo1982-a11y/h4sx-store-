import test from 'node:test';
import assert from 'node:assert/strict';
import {captureReviewViewport,restoreReviewViewport} from '../review/review-scroll.js';
function fixture(nested=false){
 const body={}, view={innerHeight:800,scrollX:0,scrollY:300,getComputedStyle:n=>({overflowY:n.overflow||'visible'}),scrollTo(p){this.scrollY=p.top;this.last=p;}};
 const ownerDocument={body,activeElement:null};
 const container={ownerDocument,parentElement:body,scrollTop:500,scrollLeft:0,scrollHeight:2400,clientHeight:500,overflow:nested?'auto':'visible',getBoundingClientRect:()=>({top:100,bottom:600}),querySelectorAll:()=>cards};
 let top=120,height=220;const button={setAttribute(k,v){this[k]=v}};const reply={classList:{add(v){reply.open=v==='show'}}};
 const card={dataset:{reviewId:'review_A'},getBoundingClientRect:()=>({top,bottom:top+height,height}),querySelector:s=>s==='.admin-reply-box.show'?reply:s==='.admin-reply-box'?reply:button};let cards=[card];
 return {view,container,card,reply,button,setTop:v=>top=v,setHeight:v=>height=v,setCards:v=>cards=v};
}
test('realtime refresh restores window anchor and open reply without smooth scrolling',()=>{const f=fixture();const p=captureReviewViewport(f.container,f.view);f.setTop(260);restoreReviewViewport(f.container,p,f.view);assert.equal(f.view.scrollY,440);assert.equal(f.view.last.behavior,'instant');assert.equal(f.button['aria-expanded'],'true');});
test('nested review list restores its own scroll without moving page',()=>{const f=fixture(true);const p=captureReviewViewport(f.container,f.view);f.container.scrollTop=0;f.setTop(200);restoreReviewViewport(f.container,p,f.view);assert.equal(f.container.scrollTop,580);assert.equal(f.view.scrollY,300);});
test('closing a tall editor keeps the shrunken card visible',()=>{const f=fixture();f.setTop(-450);f.setHeight(1000);const p=captureReviewViewport(f.container,f.view);f.setHeight(180);restoreReviewViewport(f.container,p,f.view);assert.equal(f.view.scrollY,-50);});
test('removed card falls back safely; offscreen lists do not move viewport',()=>{const f=fixture();const p=captureReviewViewport(f.container,f.view);f.setCards([]);restoreReviewViewport(f.container,p,f.view);assert.equal(f.view.scrollY,300);f.setCards([f.card]);f.setTop(900);assert.equal(captureReviewViewport(f.container,f.view),null);});
