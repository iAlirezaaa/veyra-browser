// Functional browser-data rules: conservative, non-destructive, and testable.
export const WEB_URL = /^https?:\/\//i;
export function isWebTab(tab) { return Boolean(tab?.url && WEB_URL.test(tab.url)); }
export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') || 'unknown'; }
  catch { return 'unknown'; }
}
export function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(k) || ['fbclid','gclid','mc_cid','mc_eid'].includes(k)) u.searchParams.delete(k);
    }
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch { return ''; }
}
export function categoryFor(tab) {
  const domain = hostOf(tab.url || '');
  if (/chatgpt|openai|claude\.ai|gemini\.google|perplexity|grok\.com|poe\.com|huggingface/.test(domain)) return 'ai';
  if (/github|gitlab|stackoverflow|npmjs|developer\.|vercel|localhost/.test(domain)) return 'work';
  if (/youtube|vimeo|netflix|spotify|soundcloud/.test(domain)) return 'media';
  if (/reddit|instagram|x\.com|twitter|facebook|linkedin|discord/.test(domain)) return 'social';
  if (/wikipedia|coursera|udemy|arxiv|scholar\./.test(domain)) return 'learning';
  if (/amazon|ebay|etsy|shopify/.test(domain)) return 'shopping';
  return 'other';
}
export function groupTabs(tabs) {
  const map = new Map();
  for (const tab of (tabs || []).filter(isWebTab)) {
    const host = hostOf(tab.url);
    if (!map.has(host)) map.set(host, []);
    map.get(host).push({ ...tab, category: categoryFor(tab) });
  }
  return [...map].map(([host, items])=>({host,tabs:items, count:items.length}))
    .sort((a,b)=>b.count-a.count || a.host.localeCompare(b.host));
}
export function buildSuggestions(tabs, dismissed = {}, now = Date.now()) {
  const seen = new Map(); const suggestions = [];
  for (const tab of (tabs || []).filter(isWebTab)) {
    const url = normalizeUrl(tab.url);
    if (!url) continue;
    if (seen.has(url) && !tab.pinned) {
      suggestions.push({id:`duplicate:${tab.id}`,type:'duplicate',tabId:tab.id,title:tab.title||url,url,host:hostOf(url)});
    } else seen.set(url,tab);
    // Chrome's lastAccessed isn't always present. No automatic action for missing timestamps.
    if (!tab.pinned && tab.lastAccessed && now - tab.lastAccessed > 7*86400000) {
      suggestions.push({id:`stale:${tab.id}`,type:'stale',tabId:tab.id,title:tab.title||url,url,host:hostOf(url)});
    }
  }
  return suggestions.filter(s=>(dismissed[s.id]||0)<now).slice(0,30);
}
export function safeFilename(value) {
  return String(value || 'untitled').normalize('NFKD').replace(/[^\p{L}\p{N}\-_ ]/gu,'').trim().replace(/\s+/g,'-').slice(0,76) || 'untitled';
}
export function toMarkdown(chat) {
  const title = String(chat.title || 'AI conversation').replace(/\r?\n/g,' ');
  const lines = [`# ${title}`,'',`Source: ${chat.url || ''}`,`Platform: ${chat.platform || ''}`,`Saved: ${chat.updatedAt || ''}`,''];
  for (const msg of chat.messages || []) lines.push(`## ${msg.role === 'user' ? 'User' : 'Assistant'}`,'',String(msg.text||''),'');
  return lines.join('\n');
}
export const PROVIDERS = {
  chatgpt: {name:'ChatGPT',matches:['https://chatgpt.com/*','https://chat.openai.com/*']},
  claude: {name:'Claude',matches:['https://claude.ai/*']},
  gemini: {name:'Gemini',matches:['https://gemini.google.com/*']},
  perplexity: {name:'Perplexity',matches:['https://www.perplexity.ai/*']},
  grok: {name:'Grok',matches:['https://grok.com/*']},
  deepseek: {name:'DeepSeek',matches:['https://chat.deepseek.com/*']},
  qwen: {name:'Qwen',matches:['https://chat.qwen.ai/*']},
  kimi: {name:'Kimi',matches:['https://www.kimi.com/*','https://kimi.moonshot.cn/*']},
  yuanbao: {name:'Tencent Yuanbao',matches:['https://yuanbao.tencent.com/*']},
  cohere: {name:'Cohere',matches:['https://coral.cohere.com/*']},
  mistral: {name:'Mistral Le Chat',matches:['https://chat.mistral.ai/*']},
  huggingchat: {name:'HuggingChat',matches:['https://huggingface.co/chat/*']},
  poe: {name:'Poe',matches:['https://poe.com/*']},
  you: {name:'You.com',matches:['https://you.com/*']},
  character: {name:'Character.AI',matches:['https://character.ai/*']},
  manuss: {name:'Manus',matches:['https://manus.im/*']},
  higgsfield: {name:'Higgsfield',matches:['https://higgsfield.ai/*','https://app.higgsfield.ai/*']}
};
export function providerFromUrl(url) {
  let h;try{h=new URL(url).hostname.toLowerCase().replace(/^www\./,'')}catch{return null}
  return Object.keys(PROVIDERS).find(p=>({chatgpt:['chatgpt.com','chat.openai.com'],openai:['platform.openai.com'],claude:['claude.ai'],gemini:['gemini.google.com'],perplexity:['www.perplexity.ai','perplexity.ai'],grok:['grok.com'],deepseek:['chat.deepseek.com'],qwen:['chat.qwen.ai'],kimi:['www.kimi.com','kimi.moonshot.cn'],yuanbao:['yuanbao.tencent.com'],cohere:['coral.cohere.com'],mistral:['chat.mistral.ai'],huggingchat:['huggingface.co'],poe:['poe.com'],you:['you.com'],character:['character.ai'],manuss:['manus.im'],higgsfield:['higgsfield.ai','app.higgsfield.ai']}[p]||[]).includes(h))||null;
}
