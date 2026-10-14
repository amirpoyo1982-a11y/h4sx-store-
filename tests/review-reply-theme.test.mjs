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
