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
  const backgroundType=['image','video'].includes(raw.backgroundType)?raw.backgroundType:'none';
  return {enabled:raw.enabled===true,logoUrl:replyMediaUrl(raw.logoUrl)||DEFAULT_REPLY_APPEARANCE.logoUrl,badgeUrl:replyMediaUrl(raw.badgeUrl),backgroundType,backgroundUrl:replyMediaUrl(raw.backgroundUrl,backgroundType==='video'),overlay:number('overlay',0,95),backgroundColor:color('backgroundColor'),textColor:color('textColor'),borderColor:color('borderColor'),badgeSize:number('badgeSize',12,64)};
}
export function resolveReplyAppearance(global,review={}){return normalizeReplyAppearance(review.replyAppearanceSolo===true?review.replyAppearance:global);}
export function replyAppearanceCss(theme){const c=normalizeReplyAppearance(theme);return '--reply-bg:'+c.backgroundColor+';--reply-text:'+c.textColor+';--reply-border:'+c.borderColor+';--chat-shade:'+c.backgroundColor+';--chat-overlay:'+c.overlay/100+';--reply-badge-size:'+c.badgeSize+'px';}
