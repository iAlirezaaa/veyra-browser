import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCapturedMessages,chunkMessages,MAX_CHAT_MESSAGES} from '../src/chat-sync.js';
const m=(role,text,sourceId)=>({role,text,...(sourceId?{sourceId}:{})});
const transcript=(count)=>Array.from({length:count},(_,i)=>m(i%2?'assistant':'user',`Conversation turn number ${i} – ${'detail '.repeat(9)}${i}`));
function capture(old,items){const result=mergeCapturedMessages(old,items);assert.notEqual(result.reason,'unanchored');return result.messages;}
test('long 1500-message chat saves in overlapping windows and maintains order',()=>{
 const msgs=transcript(1500),windows=chunkMessages(msgs);
 assert.ok(windows.length>20);
 let archive=[];
 for(const w of windows)archive=capture(archive,w);
 assert.deepEqual(archive,msgs);
 archive=capture(archive,windows.at(-1));
 assert.equal(archive.length,1500,'repeat scan must not duplicate messages');
});
test('a short visible virtualized tail never deletes previously saved turns',()=>{
 const old=transcript(700),partial=old.slice(-12);
 const saved=capture(old,partial);
 assert.deepEqual(saved,old);
 const next=[...partial,m('user','A new long and specific question at the end of this chat.')];
 const result=capture(saved,next);
 assert.equal(result.length,701);
 assert.equal(result.at(0).text,old[0].text);
});
test('live streaming update changes one existing message in place, without dupes',()=>{
 const base=[m('user','Explain synchronization in detail','u-1'),m('assistant','Synchronization is a process that','a-1')];
 const next=[m('user','Explain synchronization in detail','u-1'),m('assistant','Synchronization is a process that merges new content','a-1')];
 const result=capture(base,next);
 assert.equal(result.length,2);assert.equal(result[1].text,next[1].text);
 const edited=[...next];edited[1]=m('assistant','A revised answer with new wording.','a-1');
 const again=capture(result,edited);assert.equal(again.length,2);assert.equal(again[1].text,edited[1].text);
});
test('no stable ids: append streaming answer using prefix, preserve earlier history',()=>{
 const old=[...transcript(300),m('assistant','The explanation starts with a detailed overview of the system')];
 const next=[m('assistant','The explanation starts with a detailed overview of the system and its requirements')];
 const saved=capture(old,next);
 assert.equal(saved.length,301);assert.match(saved.at(-1).text,/requirements/);
});
test('unmatched window is rejected without injecting duplicate unrelated content',()=>{
 const old=transcript(100),unrelated=[m('user','Entirely unrelated user content (no overlap).'),m('assistant','Completely different assistant response content.')];
 const result=mergeCapturedMessages(old,unrelated);
 assert.equal(result.changed,false);assert.equal(result.reason,'unanchored');assert.deepEqual(result.messages,old);
});
test('a changed old response with id does not remove subsequent turns',()=>{
 const old=[m('user','First question','u1'),m('assistant','Initial answer','a1'),m('user','Second question','u2')];
 const updated=[m('assistant','Changed earlier answer','a1'),m('user','Second question','u2')];
 const actual=capture(old,updated);
 assert.deepEqual(actual.map(x=>x.text),['First question','Changed earlier answer','Second question']);
});
test('duplicates with short identical turns align using stronger adjacent anchors',()=>{
 const old=[m('user','OK'),m('assistant','Different content alpha please'),m('user','OK'),m('assistant','Different content beta please')];
 const next=[m('user','OK'),m('assistant','Different content beta please'),m('user','And one further question after that')];
 const result=capture(old,next);
 assert.equal(result.length,5);
 assert.equal(result[0].text,'OK');assert.equal(result.at(-1).role,'user');
});
test('boundary refuses unbounded archive size instead of dropping first turns',()=>{
 const old=Array.from({length:MAX_CHAT_MESSAGES},(_,i)=>m('user',`Long item ${i} content that does not repeat`));
 const result=mergeCapturedMessages(old,[old.at(-1),m('assistant','one more valid turn')]);
 assert.equal(result.changed,false);assert.equal(result.reason,'archive-limit');
});
