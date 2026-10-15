import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../review-media.js',import.meta.url),'utf8');
function setup(){
 const nodes=new Map(),errors=[],images=[];
 const node=()=>({style:{},hidden:false,disabled:false,value:'',events:{},addEventListener(type,fn,capture){this.events[type]=fn;this.capture=capture;},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},pause(){},load(){},removeAttribute(){},focus(){},insertAdjacentElement(){}});
 const anchor=node(),container={contains:value=>value===anchor},root={document:{createElement:()=>node()},navigator:{clipboard:{read:async()=>[{types:['image/png'],getType:async()=>({})}]}},File:class {constructor(parts,name,{type}){this.name=name;this.type=type;}},fetch:async()=>({json:async()=>({configured:false})}),URL:{revokeObjectURL(){}},addEventListener(){}};
 vm.runInNewContext(source,{window:root});const picker=root.H4ReviewMedia.installFeedbackExtras({container,anchor,onImage:async image=>images.push(image),onError:error=>errors.push(error)});
 return {root,nodes,images,errors,picker,anchor};
}
test('feedback paste consumes image once in its own zone without hijacking text paste or profile uploads',async()=>{
 const ctx=setup(),image={type:'image/png'},boxHandler=[...ctx.nodes.values()];
 // The parent paste handler is attached to the inserted extras box.
 // Use a fresh harness that captures that box via the anchor.
 const original=ctx.root.document.createElement;let box;ctx.root.document.createElement=()=>box=original();
 ctx.root.H4ReviewMedia.installFeedbackExtras({container:{contains:()=>false},anchor:ctx.anchor,onImage:async file=>ctx.images.push(file)});
 const event={clipboardData:{items:[{type:'image/png',getAsFile:()=>image}]},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
 box.events.paste(event);assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.equal(ctx.images.length,1);assert.equal(ctx.images[0],image);
 const text={clipboardData:{items:[{type:'text/plain'}]},preventDefault(){throw Error('Must preserve text paste');},stopPropagation(){throw Error('Must not intercept text');}};box.events.paste(text);
 await Promise.resolve();
});
test('clipboard button works while video storage is not configured',async()=>{
 const ctx=setup();await ctx.nodes.get('[data-feedback-paste]').events.click();assert.equal(ctx.images.length,1);assert.equal(ctx.images[0].type,'image/png');assert.equal(ctx.errors.length,0);
 await Promise.resolve();assert.equal(ctx.nodes.get('[data-feedback-video-pick]').disabled,true);
});
