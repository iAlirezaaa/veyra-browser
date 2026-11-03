/* Opt-in, DOM-only AI capture. Never reads auth tokens or private network responses. */
(() => {
  if (globalThis.__veyraCaptureInstalled) {
    globalThis.dispatchEvent(new Event('veyra:capture-now'));
    return;
  }
  globalThis.__veyraCaptureInstalled = true;
  const host = location.hostname.toLowerCase();
  const platform = host === 'chatgpt.com' || host === 'chat.openai.com' ? 'chatgpt'
    : host === 'claude.ai' ? 'claude'
    : host === 'gemini.google.com' ? 'gemini'
    : host === 'www.perplexity.ai' || host === 'perplexity.ai' ? 'perplexity'
    : host === 'grok.com' ? 'grok' : null;
  if (!platform) return;

  // Site HTML changes independently from Veyra. Keep role markers explicit:
  // do NOT scan every paragraph in the page as though it were a conversation.
  const selectors = {
    chatgpt: [
      '[data-message-author-role]',
      '[data-content-search-unit-key$=":user"]',
      '[data-content-search-unit-key$=":assistant"]',
      '[data-user-message-bubble="true"]',
      '[data-role="user"]', '[data-role="assistant"]',
      '[data-message-author="user"]', '[data-message-author="assistant"]',
      '[data-testid^="conversation-turn-"]', '.user-turn', '.agent-turn'
    ],
    claude: [
      '[data-testid="human-message"]', '[data-testid="user-message"]',
      '[data-testid="chat-message"]', '[data-testid="assistant-message"]',
      '[data-testid="ai-message"]', '[data-testid="message-human"]',
      '[data-testid="message-assistant"]',
      '.font-user-message', '.font-claude-response', '.font-claude-message'
    ],
    gemini: [
      'user-query', 'model-response', '.user-query', '.model-response',
      '[data-test-id="user-query"]', '[data-test-id="model-response"]',
      '.gemini-user-message', '.gemini-response'
    ],
    perplexity: [
      '[data-testid="user-message"]', '[data-testid="answer"]',
      '[data-testid="assistant-message"]', '[data-testid="query"]'
    ],
    grok: [
      '[data-testid="user-message"]', '[data-testid="assistant-message"]',
      '[data-role="user"]', '[data-role="assistant"]'
    ]
  };
  selectors.chatgpt.push('article[data-testid^="conversation-turn"]');
  const selector = selectors[platform].join(', ');
  const roles = new Set(['user', 'assistant']);

  function roleFor(node) {
    if (!node || typeof node.getAttribute !== 'function') return null;
    for (const attribute of ['data-message-author-role', 'data-role', 'data-message-author']) {
      const value = String(node.getAttribute(attribute) || '').toLowerCase();
      if (roles.has(value)) return value;
    }
    const key = String(node.getAttribute('data-content-search-unit-key') || '').toLowerCase();
    if (/(?:^|:)user$/.test(key)) return 'user';
    if (/(?:^|:)assistant$/.test(key)) return 'assistant';
    if (node.getAttribute('data-user-message-bubble') === 'true') return 'user';
    if (node.querySelector?.('[data-user-message-bubble="true"]') && !node.querySelector?.('[data-message-author-role="assistant"]'))return 'user';
    const testId = String(node.getAttribute('data-testid') || node.getAttribute('data-test-id') || '').toLowerCase();
    if (/(?:^|[-_])(user|human)(?:[-_]|$)|^query$/.test(testId)) return 'user';
    if (/(?:^|[-_])(assistant|ai|answer)(?:[-_]|$)|^answer$/.test(testId)) return 'assistant';
    const tag = String(node.tagName || '').toLowerCase();
    if (tag === 'user-query') return 'user';
    if (tag === 'model-response') return 'assistant';
    const classes = String(node.className?.baseVal || node.className || '').toLowerCase();
    if (/(^|\s)(font-user-message|user-turn|user-query|gemini-user-message)(\s|$)/.test(classes)) return 'user';
    if (/(^|\s)(font-claude-response|font-claude-message|agent-turn|model-response|gemini-response)(\s|$)/.test(classes)) return 'assistant';
    // Some wrapper nodes carry the turn id, not its role. Only trust explicitly
    // marked descendants rather than guessing who authored a turn.
    const child = node.querySelector?.('[data-message-author-role], [data-content-search-unit-key$=":user"], [data-content-search-unit-key$=":assistant"], [data-user-message-bubble="true"]');
    return child && child !== node ? roleFor(child) : null;
  }
  function stableMessageId(node) {
    // Prefer message-scoped DOM identities; generic class names or test ids
    // such as "assistant-message" are shared across turns and cannot be keys.
    const marked = node.closest?.('[data-message-id], [data-testid^="conversation-turn-"], [data-content-search-unit-key]') || node;
    for (const element of [node, marked]) {
      const raw = element?.getAttribute?.('data-message-id')
        || element?.getAttribute?.('data-content-search-unit-key')
        || element?.getAttribute?.('data-testid');
      if (/^(conversation-turn-[-\w]+|[-\w:.]{8,180})$/.test(String(raw || ''))
          && !/^(assistant-message|human-message|user-message|chat-message|model-response)$/.test(raw))
        return String(raw).slice(0,180);
    }
    return undefined;
  }
  function extract() {
    // Keep a tail of the DOM for very large pages. Missing older DOM turns
    // must never mean that their archived copies should be deleted.
    const nodes = [...document.querySelectorAll(selector)].slice(-6000);
    const messages = [];
    for (const node of nodes) {
      if (node.closest?.('nav,aside,header,footer,[role="navigation"]')) continue;
      // A wrapper and its marked descendant must count as one message.
      const parent = node.parentElement?.closest?.(selector);
      if (parent && roleFor(parent)) continue;
      const role = roleFor(node);
      if (!role) continue;
      const content = node.querySelector?.('.markdown, .standard-markdown, .progressive-markdown, .prose, [data-message-content], [data-user-message-bubble="true"], .whitespace-pre-wrap, [class*="markdown"]') || node;
      const text = String(content.innerText || content.textContent || '').trim().slice(0,128000);
      if (!text) continue;
      if (messages.length && messages.at(-1).role === role && messages.at(-1).text === text) continue;
      const sourceId=stableMessageId(node);
      messages.push({role, text,...(sourceId?{sourceId}:{})});
    }
    return messages.slice(-5000);
  }
  const conversationPaths = {
    chatgpt: /\/(?:c\/|g\/[^/]+\/c\/|share\/)[^/]+/i,
    claude: /\/chat\/[^/]+/i,
    gemini: /\/(?:u\/\d+\/)?app\/[^/]+/i,
    perplexity: /\/(?:search|thread)\/[^/]+/i,
    grok: /\/chat\/[^/]+/i
  };
  const validRoute = () => { try { return conversationPaths[platform].test(new URL(location.href).pathname); } catch { return false; } };

  let previousChunks = new Map(), scheduled = null, route = location.href, inFlight = false, dirty = false;
  let lastReport = '', lastReportAt = 0;
  function windows(messages) {
    // Max 72 turns and ~220k characters per message to the MV3 worker.
    // Four repeated turns anchor each following batch without re-saving the
    // entire chat on every token of a streaming response.
    const batches=[];
    for(let start=0;start<messages.length;) {
      let end=start, size=0;
      while(end<messages.length && end-start<72) {
        const length=messages[end].text.length;
        if(end>start && size+length>220000)break;
        size+=length;end++;
      }
      if(end===start)end++;
      batches.push(messages.slice(start,end));
      if(end===messages.length)break;
      start=Math.max(start+1,end-Math.min(4,end-start-1));
    }
    return batches;
  }
  async function report(status, detail = '', count = 0) {
    const key = `${status}:${detail}:${count}`;
    if (key === lastReport && Date.now() - lastReportAt < 20000) return;
    lastReport = key; lastReportAt = Date.now();
    try { await chrome.runtime.sendMessage({type:'CAPTURE_HEALTH', platform, status, detail:String(detail).slice(0,140), count}); }
    catch { /* A closed extension context must not break page behavior. */ }
  }
  async function save(force = false) {
    if (inFlight) { dirty = true; return {status:'busy'}; }
    if (!force && document.visibilityState === 'hidden') return {status:'busy'};
    const messages = extract();
    if (!messages.length) { await report(validRoute()?'no-messages':'waiting-url', 'No recognized message elements', 0); return {status:'no-messages'}; }
    if (!validRoute() && !messages.some(m=>m.role==='user')){await report('waiting-url','Waiting for a conversation URL');return {status:'waiting-url'};}
    inFlight = true;
    let updated=0;
    try {
      const batches=windows(messages);
      // Store only fingerprints successfully acknowledged by the worker.
      // If capture fails, retry the same window on the next heartbeat.
      for (let index=0;index<batches.length;index++) {
        const batch=batches[index];
        const fingerprint=JSON.stringify([location.href,batch]);
        if (!force && previousChunks.get(index)===fingerprint) continue;
        const response=await chrome.runtime.sendMessage({type:'SAVE_CHAT',payload:{platform,url:location.href,title:document.title,messages:batch}});
        if(!response?.ok) throw new Error(response?.error||'Background capture request failed');
        if(response.data?.saved || ['Unchanged','unchanged'].includes(response.data?.reason)) {
          previousChunks.set(index,fingerprint);
          if(response.data?.saved)updated++;
        } else if(response.data?.reason==='Unanchored window') {
          await report('skipped','Partial chat window has no overlap; older messages preserved',messages.length);
          return {status:'skipped',reason:'Unanchored window',count:messages.length};
        } else {
          const reason=response.data?.reason||'Archive rejected the capture';
          await report('skipped',reason,messages.length);
          return {status:'skipped',reason,count:messages.length};
        }
      }
      // Do not cache by route only; streaming edits earlier in the transcript
      // must re-sync the affected window even when message count is unchanged.
      for(const key of previousChunks.keys())if(key>=batches.length)previousChunks.delete(key);
      if(updated || force) await report('saved', '', messages.length);
      return {status:updated?'saved':'unchanged',count:messages.length,updated};
    } catch(error) {
      console.warn('[Veyra] Capture failed, retrying:',error?.message || error);
      await report('error',error?.message || 'Capture failed',messages.length);
      return {status:'error',error:String(error?.message||error)};
    } finally { inFlight=false; if(dirty){dirty=false;queue(400);} }
  }
  function queue(delay = 800) { clearTimeout(scheduled); scheduled = setTimeout(() => {save().catch(console.warn);}, delay); }
  const observer = new MutationObserver(() => queue());
  const watch = () => observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  watch();
  addEventListener('popstate', () => queue(250));
  addEventListener('hashchange', () => queue(250));
  addEventListener('pageshow', () => {watch(); queue(300);});
  addEventListener('focus', () => queue(300));
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') queue(300); });
  addEventListener('veyra:capture-now', () => { save(true).catch(console.warn); });
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.type !== 'VEYRA_CAPTURE_NOW') return false;
    save(true).then(reply).catch(error=>reply({status:'error',error:String(error?.message || error)}));
    return true;
  });
  // React apps use pushState without popstate. Route polling is a backstop.
  const heartbeat = setInterval(() => {
    if (location.href !== route) {route = location.href;previousChunks.clear(); queue(250);}
    else if (document.visibilityState === 'visible') save().catch(console.warn);
  }, 4000);
  addEventListener('pagehide', () => {observer.disconnect(); clearTimeout(scheduled);});
  queue(350);
})();
