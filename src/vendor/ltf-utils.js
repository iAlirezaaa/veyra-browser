// Adapted from localthink-org/localthink-builder/src/ltf.js, MIT License.
// See THIRD_PARTY_NOTICES.md for original notice and attribution.
export function slugify(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/&/g,' and ').replace(/[^\p{Letter}\p{Number}]+/gu,'-')
    .replace(/^-+|-+$/g,'').slice(0,80).replace(/-+$/g,'');
}
export function titleFromDocumentTitle(title) {
  return String(title||'').replace(/\s*[-|]\s*(ChatGPT|Claude|Gemini|Grok)\s*$/i,'')
    .replace(/^(ChatGPT|Claude|Gemini|Grok)\s*[-|]\s*/i,'').trim()||'AI Conversation';
}
