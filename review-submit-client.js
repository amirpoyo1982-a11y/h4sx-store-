(function(root){
  let widget=null,active=false;
  async function requestReviewToken(action='review_submit',anchor){
    if(!root.turnstile&&typeof root.loadPromoTurnstile==='function')await root.loadPromoTurnstile();
    if(!root.turnstile&&!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;document.head.appendChild(script);}
    const started=Date.now();while(!root.turnstile){if(Date.now()-started>8000)throw Error('Cloudflare belum bersedia. Cuba lagi.');await new Promise(r=>setTimeout(r,100));}
    let box=document.getElementById('h4rf-turnstile');
    if(!box){box=document.createElement('div');box.id='h4rf-turnstile';(document.getElementById('butangHantar')||document.getElementById('h4rf-submit')).before(box);}
    if(anchor)anchor.before(box);
    else (document.getElementById('butangHantar')||document.getElementById('h4rf-submit')).before(box);
    box.removeAttribute('aria-hidden');
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(error,token)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(token);};
      const timer=setTimeout(()=>finish(Error('Pengesahan belum selesai. Jika kotak Cloudflare muncul, lengkapkan pengesahan dan cuba lagi.')),60000);
      try{widget=root.turnstile.render(box,{sitekey:'0x4AAAAAAECCSulruVRqWTEI',size:root.innerWidth<380?'compact':'normal',appearance:'always',execution:'render',action,retry:'never',callback:token=>finish(null,token),'error-callback':code=>{finish(Error('Pengesahan Cloudflare gagal ('+String(code||'unknown')+'). Cuba lagi atau semak sambungan internet.'));return true;},'expired-callback':()=>finish(Error('Pengesahan tamat. Cuba lagi.')),'timeout-callback':()=>finish(Error('Masa pengesahan Cloudflare tamat. Cuba lagi.'))});}
      catch(error){finish(error);}
    });
  }
  async function send(payload,{token,adminToken,anchor}={},report=false,edit=false){
    if(active)throw Error('Ulasan sedang dihantar. Tunggu sebentar.');active=true;
    try{if(!report)payload={...payload,review:await root.H4ReviewMedia?.prepareFeedback?.(payload.code,payload.review,anchor)||payload.review};const headers={'Content-Type':'application/json'};if(adminToken)headers.Authorization='Bearer '+adminToken;const captchaToken=token||await requestReviewToken(edit?'review_edit':report?'report_review':'review_submit',anchor);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let response;try{response=await fetch(edit?'/api/review-edit':report?'/api/review-report':'/api/review-submit',{method:'POST',headers,signal:controller.signal,body:JSON.stringify(report||edit?{...payload,token:captchaToken}:{submission:payload,token:captchaToken})});}finally{clearTimeout(timer);}const result=await response.json();if(!response.ok){const error=Error(result.error||'Gagal menghantar. Cuba lagi.');if(response.status===409&&!report&&!edit)error.code='review-code-invalid';error.retryAfter=result.retryAfter;throw error;}if(!report)root.H4ReviewMedia?.completeFeedback?.(anchor,edit);return result;}
    catch(error){if(error.name==='AbortError')throw Error('Pelayan mengambil masa terlalu lama. Semak status ulasan sebelum cuba semula.');throw error;}
    finally{active=false;if(widget!==null){try{root.turnstile?.remove(widget);}catch(_){}widget=null;}}
  }
  root.H4ReviewSubmit={submit:(payload,options)=>send(payload,options),report:(payload,options)=>send(payload,options,true),edit:(payload,options)=>send(payload,options,false,true)};
})(window);
