/** Pure archive routing and naming. Treat every conversation URL as untrusted input. */
import {hostOf, normalizeUrl, safeFilename, providerFromUrl} from './core.js';

const CONVERSATION_PATHS = {
  chatgpt: /\/(?:c\/|g\/[^/]+\/c\/|share\/)[^/]+/i,
  claude: /\/chat\/[^/]+/i,
  gemini: /\/(?:u\/\d+\/)?app\/[^/]+/i,
  perplexity: /\/(?:search|thread)\/[^/]+/i,
  grok: /\/chat\/[^/]+/i
};
export function isConversationUrl(url, provider = providerFromUrl(url)) {
  try {
    const parsed = new URL(url);
    return Boolean(provider && providerFromUrl(url) === provider && CONVERSATION_PATHS[provider]?.test(parsed.pathname));
  } catch { return false; }
}
export function archiveId(url) {
  const normal=normalizeUrl(url);
  if(!normal || !isConversationUrl(normal)) return '';
  return `chat:${normal}`;
}
// FNV-1a 32: deterministic, non-cryptographic collision suffix for human-readable files.
function hash(value) {
  let n=0x811c9dc5;
  for(const char of value) { n ^= char.charCodeAt(0); n=Math.imul(n,0x01000193)>>>0; }
  return n.toString(16).padStart(8,'0');
}
export function chatArchiveName(chat) {
  const canonical = normalizeUrl(chat.url);
  const base = safeFilename(chat.title || 'Conversation').slice(0,54);
  return `${base || 'Conversation'}--${hash(canonical)}.md`;
}
export function cleanDownloadsFolder(raw) {
  const pieces = String(raw || '').replaceAll('\\','/').split('/');
  if (!pieces.length || pieces.length>4) return '';
  if (pieces.some(x=>!x || x==='.' || x==='..' || x.startsWith('.') || !/^[\p{L}\p{N} _-]{1,42}$/u.test(x))) return '';
  return pieces.join('/');
}
export function downloadFilename(chat, root = 'Veyra/AI-Chats') {
  const valid=cleanDownloadsFolder(root);
  const site=providerFromUrl(chat.url);
  if (!valid || !site) throw new Error('Invalid export folder or provider');
  return `${valid}/${site}/${chat.archiveName || chatArchiveName(chat)}`;
}

/**
 * Download long transcripts in bounded Markdown parts rather than silently
 * skipping them when a data: URL would grow too large for the Downloads API.
 * The first part retains the historical archive filename; subsequent parts
 * append --part-002, --part-003, ... . Every new revision overwrites each part.
 */
export function markdownParts(chat, maxChars = 200_000) {
  if (!Number.isInteger(maxChars) || maxChars < 512) throw new Error('Invalid Markdown part size');
  const title=String(chat.title||'AI conversation').replace(/\r?\n/g,' ').slice(0,250);
  const header=`# ${title}\n\nSource: ${chat.url||''}\nPlatform: ${chat.platform||''}\nSaved: ${chat.updatedAt||''}\n\n`;
  const maxBody=maxChars-header.length-100;
  if(maxBody<120)throw new Error('Archive header exceeds part size');
  const groups=[];
  let body='';
  for (const msg of chat.messages||[]) {
    const role=msg.role==='user'?'User':'Assistant';
    const prefix=`## ${role}\n\n`;
    const text=String(msg.text||'');
    for(let i=0;i<text.length || i===0;) {
      const allowance=Math.max(1,maxBody-prefix.length-3);
      const segment=text.slice(i,i+allowance);
      const block=prefix+segment+'\n\n';
      if(body && body.length+block.length>maxBody) {groups.push(body);body='';}
      body+=block;
      i+=Math.max(1,segment.length);
    }
  }
  groups.push(body);
  const base=String(chat.archiveName||chatArchiveName(chat));
  return groups.map((segment,i)=>({
    filename:i===0?base:base.replace(/\.md$/i,`--part-${String(i+1).padStart(3,'0')}.md`),
    content:header+(groups.length>1?`Part: ${i+1} of ${groups.length}\n\n`:'')+segment
  }));
}
