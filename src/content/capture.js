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
  function extract() {
    const nodes = [...document.querySelectorAll(selector)].slice(0,900);
    const messages = [];
    for (const node of nodes) {
      if (node.closest?.('nav,aside,header,footer,[role="navigation"]')) continue;
      // A wrapper and its marked descendant must count as one message.
      const parent = node.parentElement?.closest?.(selector);
      if (parent && roleFor(parent)) continue;
      const role = roleFor(node);
      if (!role) continue;
      const content = node.querySelector?.('.markdown, .standard-markdown, .progressive-markdown, .prose, [data-message-content], [data-user-message-bubble="true"], .whitespace-pre-wrap, [class*="markdown"]') || node;
      const text = String(content.innerText || content.textContent || '').trim().slice(0,16000);
      if (!text) continue;
      if (messages.length && messages.at(-1).role === role && messages.at(-1).text === text) continue;
      messages.push({role, text});
    }
    return messages.slice(0,600);
  }
  const conversationPaths = {
    chatgpt: /\/(?:c\/|g\/[^/]+\/c\/|share\/)[^/]+/i,
    claude: /\/chat\/[^/]+/i,
    gemini: /\/(?:u\/\d+\/)?app\/[^/]+/i,
    perplexity: /\/(?:search|thread)\/[^/]+/i,
    grok: /\/chat\/[^/]+/i
  };
  const validRoute = () => { try { return conversationPaths[platform].test(new URL(location.href).pathname); } catch { return false; } };

  let previous = '', scheduled = null, route = location.href, inFlight = false, dirty = false;
  let lastReport = '', lastReportAt = 0;
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
    const last = messages.at(-1);
    // Changing an earlier response must invalidate the cache too.
    const fingerprint = JSON.stringify([location.href,messages]);
    if (fingerprint === previous) return {status:'unchanged', count:messages.length};
    inFlight = true;
    try {
      const result = await chrome.runtime.sendMessage({type:'SAVE_CHAT',payload:{platform,url:location.href,title:document.title,messages}});
      if (!result?.ok) throw new Error(result?.error || 'Background capture request failed');
      if (result.data?.saved || result.data?.reason === 'Unchanged') {
        previous = fingerprint;
        await report('saved', '', messages.length);
        return {status:'saved',count:messages.length};
      }
      const reason = result.data?.reason || 'Archive rejected the capture';
      await report('skipped', reason, messages.length);
      return {status:'skipped',reason,count:messages.length};
    } catch(error) {
      console.warn('[Veyra] Capture failed, retrying:',error?.message || error);
      await report('error',error?.message || 'Capture failed',messages.length);
      return {status:'error',error:String(error?.message || error)};
    } finally { inFlight = false; if(dirty){dirty=false;queue(400);} }
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
    if (location.href !== route) {route = location.href;previous = ''; queue(250);}
    else if (document.visibilityState === 'visible') save().catch(console.warn);
  }, 4000);
  addEventListener('pagehide', () => {observer.disconnect(); clearTimeout(scheduled);});
  queue(350);
})();
