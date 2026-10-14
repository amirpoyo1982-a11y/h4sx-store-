import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReplyAppearance,resolveReplyAppearance,replyMediaUrl,replyAppearanceCss} from '../review/reply-theme.js';
test('global appearance reaches every reply; solo changes only its selected card',()=>{
 const global={enabled:true,logoUrl:'https://example.com/owner.gif',badgeUrl:'https://example.com/badge.gif',backgroundType:'video',backgroundUrl:'https://example.com/live.mp4',overlay:65};
 const solo={replyAppearanceSolo:true,replyAppearance:{enabled:true,logoUrl:'https://example.com/solo.png',backgroundColor:'#112233'}};
 assert.equal(resolveReplyAppearance(global,{}).logoUrl,global.logoUrl);
 assert.equal(resolveReplyAppearance(global,solo).logoUrl,solo.replyAppearance.logoUrl);
 assert.equal(resolveReplyAppearance(global,{}).backgroundUrl,global.backgroundUrl);
 assert.equal(resolveReplyAppearance(global,{...solo,replyAppearanceSolo:false}).logoUrl,global.logoUrl);
 assert.equal(global.logoUrl,'https://example.com/owner.gif');
});
test('disabled overall style preserves defaults while solo can still work independently',()=>{
 assert.equal(resolveReplyAppearance({enabled:false},{}).enabled,false);
 assert.equal(resolveReplyAppearance({enabled:false},{replyAppearanceSolo:true,replyAppearance:{enabled:true,badgeUrl:'https://example.com/a.gif'}}).enabled,true);
 assert.equal(resolveReplyAppearance({enabled:true},{replyAppearanceSolo:true,replyAppearance:{enabled:false}}).enabled,false);
});
test('custom media rejects unsafe schemes and credentials; GIF upload and direct live wallpaper work',()=>{
 for(const url of ['javascript:alert(1)','http://example.com/a.gif','https://user:secret@example.com/a.gif','data:image/svg+xml;base64,AAAA'])assert.equal(replyMediaUrl(url),'');
 assert.equal(replyMediaUrl('data:image/gif;base64,AAAA'),'data:image/gif;base64,AAAA');
 assert.equal(replyMediaUrl('https://example.com/live.mp4?v=1',true),'https://example.com/live.mp4?v=1');
 assert.equal(replyMediaUrl('https://example.com/page',true),'');
 const theme=normalizeReplyAppearance({enabled:true,textColor:'red;position:fixed',overlay:999,badgeSize:-10});
 assert.equal(theme.overlay,95);assert.equal(theme.badgeSize,12);assert(!replyAppearanceCss(theme).includes('position:fixed'));
 assert.deepEqual(normalizeReplyAppearance(theme),theme);
});

import {replyImageCandidates,replyBackgroundType} from '../review/reply-theme.js';
test('emoji.gg staff page resolves to actual media with PNG fallback instead of rendering HTML as an image',()=>{
 assert.deepEqual(replyImageCandidates('https://emoji.gg/emoji/150633-staff'),['https://cdn3.emoji.gg/emojis/150633-staff.gif','https://cdn3.emoji.gg/emojis/150633-staff.png','https://cdn3.emoji.gg/emojis/150633-staff.webp']);
 assert.deepEqual(replyImageCandidates('javascript:alert(1)'),[]);
 assert.deepEqual(replyImageCandidates('data:image/gif;base64,AAAA'),['data:image/gif;base64,AAAA']);
});
test('pasted live wallpaper is detected even when an old saved type is image or none',()=>{
 const url='https://motionbgs.com/media/6372/blue-haired-blind-girl.960x540.mp4';
 for(const type of ['none','image','video']){const config=normalizeReplyAppearance({enabled:true,backgroundType:type,backgroundUrl:url});assert.equal(config.backgroundType,'video');assert.equal(config.backgroundUrl,url);}
 assert.equal(replyBackgroundType('auto','https://example.com/a.gif'),'image');
 assert.equal(normalizeReplyAppearance({backgroundType:'none',backgroundUrl:''}).backgroundType,'none');
});

import {readReplyImageFile} from '../review/reply-theme.js';
test('folder upload preserves small GIF animation and resizes large transparent logos',async()=>{
 let compressed=0;const original='data:image/gif;base64,AAAA';
 assert.equal(await readReplyImageFile({type:'image/gif',size:1000},{read:async()=>original,compress:async()=>{compressed++;}}),original);assert.equal(compressed,0);
 const result=await readReplyImageFile({type:'image/png',size:2000000},{read:async()=>{throw Error('Must resize large file');},compress:async(file,side,quality,format)=>{assert.equal(side,256);assert.equal(format,'image/png');return 'data:image/png;base64,AAAA';}});
 assert.equal(result,'data:image/png;base64,AAAA');
 await assert.rejects(readReplyImageFile({type:'image/gif',size:500000},{read(){},compress(){}}),/GIF terlalu besar/);
 await assert.rejects(readReplyImageFile({type:'image/svg+xml',size:100},{read(){},compress(){}}),/Pilih gambar/);
});
