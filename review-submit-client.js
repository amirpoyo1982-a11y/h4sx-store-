(function(root){
  let widget=null,resolveToken,rejectToken,timer;
  async function requestReviewToken(){
    if(!root.turnstile&&typeof root.loadPromoTurnstile==='function')await root.loadPromoTurnstile();
    if(!root.turnstile&&!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;document.head.appendChild(script);}
    const started=Date.now();while(!root.turnstile){if(Date.now()-started>8000)throw Error('Cloudflare belum bersedia. Cuba lagi.');await new Promise(r=>setTimeout(r,100));}
    if(widget===null){const box=document.createElement('div');box.id='h4rf-turnstile';document.getElementById('h4rf-submit').before(box);widget=root.turnstile.render(box,{sitekey:'0x4AAAAAAECCSulruVRqWTEI',size:'invisible',execution:'execute',action:'review_submit',callback:token=>{clearTimeout(timer);const done=resolveToken;resolveToken=rejectToken=null;done?.(token);},'error-callback':()=>rejectToken?.(Error('Pengesahan keselamatan gagal.')),'expired-callback':()=>rejectToken?.(Error('Pengesahan tamat. Cuba lagi.'))});}
    root.turnstile.reset(widget);
    return new Promise((resolve,reject)=>{resolveToken=resolve;rejectToken=reject;timer=setTimeout(()=>reject(Error('Pengesahan mengambil masa terlalu lama. Cuba lagi.')),18000);try{root.turnstile.execute(widget);}catch(error){reject(error);}});
  }
  async function submit(submission,{token,adminToken}={}){
    try{const headers={'Content-Type':'application/json'};if(adminToken)headers.Authorization='Bearer '+adminToken;const response=await fetch('/api/review-submit',{method:'POST',headers,body:JSON.stringify({submission,token:token||await requestReviewToken()})});const result=await response.json();if(!response.ok)throw Error(result.error||'Gagal hantar ulasan. Cuba lagi.');return result;}
    finally{clearTimeout(timer);resolveToken=rejectToken=null;if(widget!==null){try{root.turnstile?.reset(widget);}catch(_){}}}
  }
  root.H4ReviewSubmit={submit};
})(window);
