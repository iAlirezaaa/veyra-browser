import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const script=readFileSync(resolve(import.meta.dirname,'../src/content/capture.js'),'utf8');
function mockCapture(url){
  const nodes=[];const sent=[];const listeners=new Map();const timers=[];const intervals=[];
  let observer;
  function node(role,text){return {tagName:'DIV',innerText:text,hasAttribute:name=>name==='data-message-author-role',getAttribute:name=>name==='data-message-author-role'?role:null,closest:()=>null,parentElement:null,querySelector:()=>null};}
  const context={
    URL,location:new URL(url),document:{documentElement:{},visibilityState:'visible',title:'AI chat',querySelectorAll:()=>nodes},
    chrome:{runtime:{sendMessage:async message=>{sent.push(message);return {ok:true,data:{saved:true}}},onMessage:{addListener:fn=>listeners.set('message',fn)}}},
    MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}},
    addEventListener:(name,fn)=>listeners.set(name,fn),
    dispatchEvent:evt=>listeners.get(evt.type)?.(),Event:class{constructor(type){this.type=type}},
    setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval:()=>{},
    console:{warn(){}},
  };
  vm.runInNewContext(script,context);
  const tick=async()=>{const tasks=timers.splice(0);for(const f of tasks)await f();await Promise.resolve();await Promise.resolve();};
  return {nodes,sent,listeners,intervals,context,node,tick,mutate:()=>observer()};
}
test('chat capture starts as soon as a newly-created ChatGPT conversation receives an address',async()=>{
 const scene=mockCapture('https://chatgpt.com/');
 scene.nodes.push(scene.node('user','شروع کنیم'));
 await scene.tick();assert.equal(scene.sent.length,0,'do not overwrite different new chats at homepage URL');
 scene.context.location=new URL('https://chatgpt.com/c/new123');
 scene.intervals[0]();await scene.tick();
 assert.equal(scene.sent.length,1);assert.equal(scene.sent[0].payload.messages[0].role,'user');
 scene.nodes.push(scene.node('assistant','جواب اول'));
 scene.mutate();await scene.tick();
 assert.equal(scene.sent.length,2);assert.equal(scene.sent[1].payload.messages.length,2);
 scene.intervals[0]();await scene.tick();assert.equal(scene.sent.length,2,'avoid duplicate saves');
});
test('content script retries after a transient failed service worker request',async()=>{
 const scene=mockCapture('https://chatgpt.com/c/abc');scene.nodes.push(scene.node('user','retry me'));
 let count=0;scene.context.chrome.runtime.sendMessage=async()=>{count++;if(count===1)throw Error('Worker asleep');return {ok:true};};
 await scene.tick();assert.equal(count,1);
 scene.intervals[0]();await scene.tick();assert.equal(count,2);
});
