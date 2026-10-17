export const DEFAULT_REPLY_APPEARANCE={enabled:false,logoUrl:'https://i.imgur.com/cLPulXQ.png',badgeUrl:'',backgroundType:'none',backgroundUrl:'',overlay:80,backgroundColor:'#f0fbff',textColor:'#173d56',borderColor:'#bae7ee',badgeSize:20};
export function replyMediaUrl(value,video=false){
  if(typeof value!=='string'||value.length>600000)return '';
  if(!video&&/^data:image\/(?:gif|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))return value;
  try{const url=new URL(value.trim());if(url.protocol!=='https:'||url.username||url.password)return '';if(video&&!/\.(mp4|webm)$/i.test(url.pathname))return '';return url.href;}catch{return '';}
}
export function normalizeReplyAppearance(raw={}){
  raw=raw&&typeof raw==='object'?raw:{};
  const color=(key)=>/^#[0-9a-f]{6}$/i.test(raw[key]||'')?raw[key]:DEFAULT_REPLY_APPEARANCE[key];
  const number=(key,min,max)=>raw[key]!=null&&Number.isFinite(Number(raw[key]))?Math.max(min,Math.min(max,Number(raw[key]))):DEFAULT_REPLY_APPEARANCE[key];
  const backgroundType=replyBackgroundType(raw.backgroundType,raw.backgroundUrl);
  return {enabled:raw.enabled===true,logoUrl:replyMediaUrl(raw.logoUrl)||DEFAULT_REPLY_APPEARANCE.logoUrl,badgeUrl:replyMediaUrl(raw.badgeUrl),backgroundType,backgroundUrl:replyMediaUrl(raw.backgroundUrl,backgroundType==='video'),overlay:number('overlay',0,95),backgroundColor:color('backgroundColor'),textColor:color('textColor'),borderColor:color('borderColor'),badgeSize:number('badgeSize',12,64)};
}
export function resolveReplyAppearance(global,review={}){return normalizeReplyAppearance(review.replyAppearanceSolo===true?review.replyAppearance:global);}
export function replyAppearanceCss(theme){const c=normalizeReplyAppearance(theme);return '--reply-bg:'+c.backgroundColor+';--reply-text:'+c.textColor+';--reply-border:'+c.borderColor+';--chat-shade:'+c.backgroundColor+';--chat-overlay:'+c.overlay/100+';--reply-badge-size:'+c.badgeSize+'px';}

export function replyImageCandidates(value){
 const safe=replyMediaUrl(value);if(!safe)return [];
 try{const url=new URL(safe),host=url.hostname.toLowerCase().replace(/^www\./,'');
 const match=host==='emoji.gg'?url.pathname.match(/^\/emoji\/([a-z0-9-]+)\/?$/i):host==='cdn3.emoji.gg'?url.pathname.match(/^\/emojis\/([a-z0-9-]+)\.(?:gif|png|webp)$/i):null;
 if(match)return ['/api/emoji?name='+encodeURIComponent(match[1])];
 }catch{}return [safe];
}
export function replyBackgroundType(type,url){
 if(!replyMediaUrl(url))return 'none';
 try{if(/\.(mp4|webm)$/i.test(new URL(url).pathname))return 'video';}catch{}
 return type==='video'?'video':'image';
}

export async function readReplyImageFile(file,{read,compress}){
 if(!file||!/^image\/(gif|png|jpeg|webp)$/.test(file.type))throw Error('Pilih gambar PNG, JPG, WebP atau GIF.');
 if(file.size>20*1024*1024)throw Error('Gambar terlalu besar. Maksimum 20MB.');
 if(file.type==='image/gif'&&file.size>400000)throw Error('GIF terlalu besar. Maksimum 400KB; guna link untuk GIF lebih besar.');
 const value=file.size<=400000?await read(file):await compress(file,256,.8,file.type==='image/jpeg'?'image/jpeg':'image/png');
 if(!replyMediaUrl(value))throw Error('Gambar tidak dapat diproses. Cuba gambar lain.');
 return value;
}

export function normalizeReplyDirectLink(raw={}){
 raw=raw&&typeof raw==='object'?raw:{};let url='';
 if(typeof raw.url==='string'&&raw.url.length<=2048){try{const parsed=new URL(raw.url.trim());if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)url=parsed.href;}catch{}}
 return {enabled:raw.enabled===true,text:String(raw.text||'Lihat lanjut').trim().slice(0,60)||'Lihat lanjut',url};
}
export function resolveReplyDirectLink(global,review={}){return normalizeReplyDirectLink(review.replyDirectLinkSolo===true?review.replyDirectLink:global);}
