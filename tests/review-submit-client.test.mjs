import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../review-submit-client.js',import.meta.url),'utf8');
function client(callback){let removed=0,requests=0;const box={removeAttribute(){}},root={turnstile:{render:(element,options)=>{assert.equal(options.size,'normal');assert.equal(options.execution,'render');queueMicrotask(()=>callback(options));return 7;},remove:id=>{assert.equal(id,7);removed++;}}};const context={window:root,document:{getElementById:()=>box},Date,setTimeout,clearTimeout,AbortController,fetch:async()=>{requests++;return {ok:true,json:async()=>({success:true,status:'pending'})};}};vm.runInNewContext(source,context);return {submit:root.H4ReviewSubmit.submit,get removed(){return removed},get requests(){return requests}};}
test('fresh verification renders once per submission and removes used widgets',async()=>{const c=client(o=>o.callback('token'));assert.equal((await c.submit({})).status,'pending');await c.submit({});assert.equal(c.removed,2);assert.equal(c.requests,2);});
test('Cloudflare error is immediate, never posts a review, and allows retry',async()=>{let failed=true;const c=client(o=>failed?o['error-callback']('300030'):o.callback('token'));await assert.rejects(c.submit({}),/300030/);assert.equal(c.requests,0);assert.equal(c.removed,1);failed=false;await c.submit({});assert.equal(c.requests,1);assert.equal(c.removed,2);});
