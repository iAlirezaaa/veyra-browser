import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const script=readFileSync(resolve(import.meta.dirname,'../src/content/capture.js'),'utf8');
function mockCapture(url){
  const nodes=[],sent=[],listeners=new Map(),timers=[],intervals=[];
  let observer;
  function node(role,text,attributes={}){
    const attrs={...(role?{'data-message-author-role':role}:{}),...attributes};
    return {
      tagName:'DIV',className:attrs.className||'',innerText:text,textContent:text,
      hasAttribute:name=>Object.hasOwn(attrs,name),
      getAttribute:name=>attrs[name]||null,
      closest:()=>null,parentElement:null,querySelector:()=>null
    };
  }
  const context={
    URL,Date,location:new URL(url),document:{documentElement:{},visibilityState:'visible',title:'AI chat',querySelectorAll:()=>nodes},
    chrome:{runtime:{sendMessage:async message=>{sent.push(message);return {ok:true,data:{saved:true}}},onMessage:{addListener:fn=>listeners.set('message',fn)}}},
    MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}},
    addEventListener:(name,fn)=>listeners.set(name,fn),
    dispatchEvent:evt=>listeners.get(evt.type)?.(),Event:class{constructor(type){this.type=type}},
    setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval:()=>{},
    console:{warn(){}},
  };
  vm.runInNewContext(script,context);
  const tick=async()=>{const tasks=timers.splice(0);for(const f of tasks)await f();for(let i=0;i<18;i++)await Promise.resolve();};
  const saves=()=>sent.filter(x=>x.type==='SAVE_CHAT');
  const health=()=>sent.filter(x=>x.type==='CAPTURE_HEALTH');
  return {nodes,sent,saves,health,listeners,intervals,context,node,tick,mutate:()=>observer()};
}
test('new ChatGPT conversation starts saving after unique URL appears',async()=>{
 const scene=mockCapture('https://chatgpt.com/');
 scene.nodes.push(scene.node('user','شروع کنیم'));
 await scene.tick();assert.equal(scene.saves().length,1);
 assert.equal(scene.saves()[0].payload.url,'https://chatgpt.com/');
 scene.context.location=new URL('https://chatgpt.com/c/new123');
 scene.intervals[0]();await scene.tick();
 assert.equal(scene.saves().length,2);
 scene.nodes.push(scene.node('assistant','جواب اول'));
 scene.mutate();await scene.tick();
 assert.equal(scene.saves().length,3);assert.equal(scene.saves()[2].payload.messages.length,2);
 scene.intervals[0]();await scene.tick();assert.equal(scene.saves().length,3);
});
test('content script retries after transient worker error and does not treat skipped as saved',async()=>{
 const scene=mockCapture('https://chatgpt.com/c/abc');scene.nodes.push(scene.node('user','retry me'));
 let count=0;scene.context.chrome.runtime.sendMessage=async message=>{
   if(message.type==='CAPTURE_HEALTH')return {ok:true};
   count++;if(count===1)throw Error('Worker asleep');
   if(count===2)return {ok:true,data:{skipped:true,reason:'No visible messages'}};
   return {ok:true,data:{saved:true}};
 };
 await scene.tick();assert.equal(count,1);
 scene.intervals[0]();await scene.tick();assert.equal(count,2);
 scene.intervals[0]();await scene.tick();assert.equal(count,3);
 scene.intervals[0]();await scene.tick();assert.equal(count,3);
});
test('2026 ChatGPT modern work layout extracts data-content-search-unit-key messages',async()=>{
 const scene=mockCapture('https://chatgpt.com/c/2026new');
 scene.nodes.push(scene.node(null,'مرحبا',{ 'data-content-search-unit-key':'new:0:user'}));
 scene.nodes.push(scene.node(null,'Hello from assistant',{ 'data-content-search-unit-key':'new:0:assistant'}));
 await scene.tick();
 assert.equal(scene.saves().length,1);
 assert.equal(scene.saves()[0].payload.messages.length,2);
 assert.deepEqual(Array.from(scene.saves()[0].payload.messages,x=>x.role),['user','assistant']);
});
test('new ChatGPT bubble fallback works without old data-message-author-role',async()=>{
 const scene=mockCapture('https://chatgpt.com/c/bubble');
 scene.nodes.push(scene.node(null,'Question text',{ 'data-user-message-bubble':'true'}));
 await scene.tick();
 assert.equal(scene.saves()[0].payload.messages[0].role,'user');
});
test('Claude modern font classes are recognized',async()=>{
 const scene=mockCapture('https://claude.ai/chat/c1');
 scene.nodes.push(scene.node(null,'My question',{className:'font-user-message'}));
 scene.nodes.push(scene.node(null,'My answer',{className:'font-claude-response'}));
 await scene.tick();
 assert.equal(scene.saves()[0].payload.messages.length,2);
});
test('diagnostics from no messages are reported without attempting archive',async()=>{
 const scene=mockCapture('https://chatgpt.com/c/empty');
 await scene.tick();assert.equal(scene.saves().length,0);
 assert.equal(scene.health().at(-1).status,'no-messages');
});
test('manual capture responds with status to popup and diagnostic caller',async()=>{
 const scene=mockCapture('https://chatgpt.com/c/manual');
 scene.nodes.push(scene.node('user','Manually save'));
 let resolved;
 scene.listeners.get('message')({type:'VEYRA_CAPTURE_NOW'},null,answer=>{resolved=answer});
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.equal(resolved?.status,'saved');
});
