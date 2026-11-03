// Runs only on user-authorized AI domains after explicit site opt-in.
// DOM extraction is intentionally conservative and may miss virtualized messages.
(() => {
  if(window.__veyraCaptureInstalled) return;
  window.__veyraCaptureInstalled=true;
  const h=location.hostname;
  const platform=h==='chatgpt.com'||h==='chat.openai.com'?'chatgpt':h==='claude.ai'?'claude':h==='gemini.google.com'?'gemini':h.includes('perplexity.ai')?'perplexity':h==='grok.com'?'grok':null;
  if(!platform) return;
  const configs={
    chatgpt:{selector:'[data-message-author-role]',role:n=>n.getAttribute('data-message-author-role')},
    claude:{selector:'[data-testid="user-message"], [data-testid="assistant-message"], [data-is-streaming], [data-testid="chat-message"]',role:n=>/user/.test((n.getAttribute('data-testid')||'').toLowerCase())?'user':'assistant'},
    gemini:{selector:'user-query, model-response',role:n=>n.tagName.toLowerCase()==='user-query'?'user':'assistant'},
    perplexity:{selector:'[data-testid="user-message"], [data-testid="answer"], [class*="prose"]',role:n=>/user/.test(n.getAttribute('data-testid')||'')?'user':'assistant'},
    grok:{selector:'[data-testid="user-message"], [data-testid="assistant-message"]',role:n=>/user/.test(n.getAttribute('data-testid')||'')?'user':'assistant'}
  };
  let last='',timer=null,alive=true;
  function readMessages() {
    const config=configs[platform];
    const found=[...document.querySelectorAll(config.selector)].slice(0,600);
    const messages=[];
    for(const node of found) {
      if(node.closest('nav,aside,header,footer')) continue;
      const text=(node.innerText||'').trim().slice(0,16000);
      if(!text) continue;
      const role=config.role(node)==='user'?'user':'assistant';
      if(messages.length && messages.at(-1).text===text && messages.at(-1).role===role) continue;
      messages.push({role,text});
    }
    return messages;
  }
  async function capture() {
    if(!alive||document.visibilityState==='hidden') return;
    const messages=readMessages();
    if(!messages.length) return;
    const fingerprint=`${location.href}|${messages.length}|${messages.at(-1).text.slice(-96)}`;
    if(fingerprint===last) return;
    last=fingerprint;
    try {
      const result=await chrome.runtime.sendMessage({type:'SAVE_CHAT',payload:{platform,url:location.href,title:document.title,messages}});
      if(!result?.ok) last='';
    } catch {alive=false;}
  }
  function queue() {clearTimeout(timer); timer=setTimeout(capture,1700);}
  const observer=new MutationObserver(queue);
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  addEventListener('popstate',queue);
  addEventListener('hashchange',queue);
  addEventListener('beforeunload',()=>{alive=false;observer.disconnect();clearTimeout(timer)});
  queue();
})();
