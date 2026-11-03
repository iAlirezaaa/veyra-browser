/**
 * Incremental, loss-averse conversation synchronization.
 *
 * AI sites often virtualize older DOM turns. Incoming batches are *windows*,
 * never proof that earlier messages disappeared. Never replace a full archived
 * transcript with a short visible window. Explicit DOM message ids are best;
 * an overlap of existing text is a conservative fallback.
 */
export const MAX_CHAT_MESSAGES = 20000;
export const MAX_CHAT_CHARS = 24_000_000;
export const MAX_MESSAGE_CHARS = 128_000;
export const MAX_BATCH_CHARS = 220_000;

export function normalizeMessages(items) {
  if (!Array.isArray(items)) return [];
  let chars = 0;
  return items.slice(0, 100).flatMap(item => {
    if (!['user', 'assistant'].includes(item?.role) || typeof item?.text !== 'string') return [];
    const text = item.text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!text || chars + text.length > MAX_BATCH_CHARS) return [];
    chars += text.length;
    const sourceId = typeof item.sourceId === 'string' && /^[\w.:-]{1,180}$/.test(item.sourceId)
      ? item.sourceId : undefined;
    return [{ role: item.role, text, ...(sourceId ? { sourceId } : {}) }];
  });
}

const key = m => `${m.role}\u0000${m.text}`;
const same = (a, b) => a?.role === b?.role && (Boolean(a?.sourceId && b?.sourceId && a.sourceId === b.sourceId) || a?.text === b?.text);
const stream = (a, b) => a?.role === b?.role && a?.text?.length >= 28 && b?.text?.startsWith(a.text);

/**
 * Return {messages,changed,reason}. If a partial window cannot be safely
 * placed in the archive, return 'unanchored' and leave existing data intact.
 *
 * Source ids and text matches are anchored in document order. Do not delete
 * unseen messages, even if the live site recycles or unmounts their nodes.
 */
export function mergeCapturedMessages(stored = [], incoming = []) {
  const old = Array.isArray(stored) ? stored : [];
  const fresh = normalizeMessages(incoming);
  if (!fresh.length) return { messages: old, changed: false, reason: 'empty' };
  if (!old.length) return { messages: fresh, changed: true, reason: 'new' };
  const ids = new Map(), contents = new Map();
  old.forEach((m,i) => {
    if (m.sourceId) {
      if (!ids.has(m.sourceId)) ids.set(m.sourceId, []);
      if (ids.get(m.sourceId).length < 20) ids.get(m.sourceId).push(i);
    }
    const k = key(m);
    if (!contents.has(k)) contents.set(k, []);
    if (contents.get(k).length < 20) contents.get(k).push(i);
  });
  const candidates = new Map();
  for (let j=0;j<fresh.length;j++) {
    const item=fresh[j];
    const pairs = [];
    for (const i of (item.sourceId ? ids.get(item.sourceId)||[] : []))
      if (old[i].role===item.role) pairs.push([i, 12]);
    for (const i of contents.get(key(item))||[])
      if (!item.sourceId || old[i].sourceId===item.sourceId || !old[i].sourceId) pairs.push([i, item.text.length>=28 ? 4 : 1]);
    for (const [i,score] of pairs) {
      const offset=i-j;
      const row=candidates.get(offset)||{score:0,anchors:0,distinct:new Set()};
      row.score+=score;row.anchors++;row.distinct.add(j);candidates.set(offset,row);
    }
  }
  // A single streaming response is a valid anchor if it grows from the stored
  // tail; do not mistake a short reused sentence for a complete conversation.
  for(let j=0;j<fresh.length;j++) {
    const item=fresh[j];
    for(let i=Math.max(0,old.length-3);i<old.length;i++) if(stream(old[i],item)) {
      const offset=i-j,row=candidates.get(offset)||{score:0,anchors:0,distinct:new Set()};
      row.score+=5;row.anchors++;row.distinct.add(j);candidates.set(offset,row);
    }
  }
  const ranked=[...candidates.entries()].sort((a,b)=>b[1].score-a[1].score || b[1].distinct.size-a[1].distinct.size);
  if(!ranked.length || (ranked[0][1].score<4 && !(old.length<=2 && ranked[0][1].score>=1 && ranked[0][1].distinct.size>=1)) || (ranked.length>1 && ranked[0][1].score===ranked[1][1].score))
    return { messages: old, changed: false, reason: 'unanchored' };
  const offset=ranked[0][0];
  const matches=[];
  for(let j=0;j<fresh.length;j++) {
    const i=offset+j;
    if(i>=0&&i<old.length && (same(old[i],fresh[j]) || stream(old[i],fresh[j]))) matches.push([i,j]);
  }
  if(!matches.length) return { messages: old, changed: false, reason: 'unanchored' };
  // Only modify an existing message if we can identify it by stable id or
  // matching content/prefix. Preserve old, unseen turns in every other case.
  const merged=old.slice();
  let added=0;
  for (const [i,j] of matches) {
    const current=merged[i], next=fresh[j];
    if(current.sourceId && next.sourceId && current.sourceId!==next.sourceId) continue;
    if(current.role===next.role && (same(current,next)||stream(current,next)))
      merged[i]={...current,...next,...(next.sourceId||current.sourceId?{sourceId:next.sourceId||current.sourceId}:{})};
  }
  // Prepend older material only if it leads directly into the first stored turn.
  const [firstI,firstJ]=matches[0];
  if(firstI===0 && firstJ>0) { merged.unshift(...fresh.slice(0,firstJ));added+=firstJ; }
  // Insert turns strictly between TWO known anchors. This keeps edits and
  // branches local instead of moving or erasing unrelated archived turns.
  for(let k=matches.length-2;k>=0;k--) {
    const [leftI,leftJ]=matches[k], [rightI,rightJ]=matches[k+1];
    if(rightI===leftI+1 && rightJ>leftJ+1) {
      merged.splice(leftI+1,0,...fresh.slice(leftJ+1,rightJ));added+=rightJ-leftJ-1;
    }
  }
  const [lastI,lastJ]=matches.at(-1);
  if(lastI===old.length-1 && lastJ<fresh.length-1) {
    merged.push(...fresh.slice(lastJ+1));added+=fresh.length-lastJ-1;
  }
  const size=merged.reduce((n,m)=>n+m.text.length,0);
  if(merged.length>MAX_CHAT_MESSAGES || size>MAX_CHAT_CHARS)
    return {messages:old,changed:false,reason:'archive-limit'};
  const changed=added>0 || matches.some(([i,j])=>old[i].text!==fresh[j].text || (!old[i].sourceId && Boolean(fresh[j].sourceId)));
  return {messages:changed?merged:old,changed,reason:changed?'merged':'unchanged'};
}

/** Overlapping, byte-budgeted DOM windows for long-chat capture. */
export function chunkMessages(messages,{maxCount=72,maxChars=MAX_BATCH_CHARS,overlap=4}={}) {
  const chunks=[];
  for(let start=0;start<messages.length;){
    let end=start, chars=0;
    while(end<messages.length && end-start<maxCount) {
      const n=messages[end]?.text?.length||0;
      if(end>start && chars+n>maxChars)break;
      chars+=n;end++;
    }
    if(end===start)end++;
    chunks.push(messages.slice(start,end));
    if(end===messages.length)break;
    start=Math.max(start+1,end-Math.min(overlap,end-start-1));
  }
  return chunks;
}
