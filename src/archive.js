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
