/* Dynamic, opt-in AI conversation capture. Runs in isolated extension world. */
(() => {
  if(globalThis.__veyraCaptureInstalled) {
    globalThis.dispatchEvent(new Event('veyra:capture-now'));
    return;
  }
  globalThis.__veyraCaptureInstalled=true;
  const host=location.hostname.toLowerCase();
  const platform=host==='chatgpt.com'||host==='chat.openai.com'?'chatgpt':host==='claude.ai'?'claude':host==='gemini.google.com'?'gemini':host==='www.perplexity.ai'||host==='perplexity.ai'?'perplexity':host==='grok.com'?'grok':null;
  if(!platform) return;
  const selectors={
    chatgpt:'[data-message-author-role], [data-testid="conversation-turn"]',
    claude:'[data-testid="user-message"], [data-testid="assistant-message"], [data-testid="chat-message"]',
    gemini:'user-query, model-response',
    perplexity:'[data-testid="user-message"], [data-testid="answer"]',
    grok:'[data-testid="user-message"], [data-testid="assistant-message"]'
  };
  const allowedRoles=new Set(['user','assistant']);
  function roleFor(node) {
    const testId=(node.getAttribute('data-testid')||'').toLowerCase();
    const explicit=(node.getAttribute('data-message-author-role')||'').toLowerCase();
    if(allowedRoles.has(explicit)) return explicit;
    if(node.tagName.toLowerCase()==='user-query' || /user-message|human-message/.test(testId)) return 'user';
    if(node.tagName.toLowerCase()==='model-response'||/assistant-message|answer/.test(testId)) return 'assistant';
    const child=node.querySelector('[data-message-author-role]');
    const nested=(child?.getAttribute('data-message-author-role')||'').toLowerCase();
    return allowedRoles.has(nested)?nested:null;
  }
  function extract() {
    const nodes=[...document.querySelectorAll(selectors[platform])].slice(0,700);
    const messages=[];
    for(const node of nodes){
      if(node.closest('nav,aside,header,footer')) continue;
      // Do not count nested turn containers as separate messages.
      if(node.parentElement?.closest(selectors[platform]) && !node.hasAttribute('data-message-author-role')) continue;
      const role=roleFor(node);
      if(!role) continue;
      const content=node.querySelector('.markdown, .prose, [data-message-content], .whitespace-pre-wrap')||node;
      const text=(content.innerText||content.textContent||'').trim().slice(0,16000);
      if(!text) continue;
      if(messages.length && messages.at(-1).text===text && messages.at(-1).role===role)continue;
      messages.push({role,text});
    }
    return messages.slice(0,600);
  }
  let previous='',scheduled=null,active=true,route=location.href,inFlight=false;
  const conversationPaths={chatgpt:/\/(?:c\/|g\/[^/]+\/c\/|share\/)[^/]+/i,claude:/\/chat\/[^/]+/i,gemini:/\/(?:u\/\d+\/)?app\/[^/]+/i,perplexity:/\/(?:search|thread)\/[^/]+/i,grok:/\/chat\/[^/]+/i};
  const validRoute=()=>{try{return conversationPaths[platform].test(new URL(location.href).pathname);}catch{return false;}};
  async function save(force=false){
    if(!active||inFlight||(!force&&document.visibilityState==='hidden')||!validRoute())return;
    const messages=extract();if(!messages.length)return;
    const last=messages.at(-1);
    const fingerprint=`${location.href}|${messages.length}|${last.role}|${last.text}`;
    if(fingerprint===previous)return;
    inFlight=true;
    try {
      const result=await chrome.runtime.sendMessage({type:'SAVE_CHAT',payload:{platform,url:location.href,title:document.title,messages}});
      if(result?.ok)previous=fingerprint;
    } catch(error) {
      // A suspended service worker may reconnect later. Never permanently disable capture.
      console.warn('[Veyra] Capture retry scheduled:',error?.message||error);
    } finally { inFlight=false; }
  }
  function queue(delay=1200){clearTimeout(scheduled);scheduled=setTimeout(()=>save(),delay);}
  const observer=new MutationObserver(()=>queue());
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  addEventListener('popstate',()=>queue(300));
  addEventListener('hashchange',()=>queue(300));
  addEventListener('pageshow',()=>queue(300));
  addEventListener('focus',()=>queue(300));
  addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')queue(300)});
  addEventListener('veyra:capture-now',()=>save(true));
  chrome.runtime.onMessage.addListener(message=>{if(message?.type==='VEYRA_CAPTURE_NOW'){save(true);return false;}});
  // SPAs often use history.pushState from the page world: neither popstate nor the
  // isolated-world history object is guaranteed to see it. Poll the route as a fallback.
  const heartbeat=setInterval(()=>{
    if(location.href!==route){route=location.href;previous='';queue(200);}
    else if(document.visibilityState==='visible')save();
  },5000);
  addEventListener('pagehide',()=>{active=false;observer.disconnect();clearInterval(heartbeat);clearTimeout(scheduled);});
  queue(800);
})();
