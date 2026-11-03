import test from 'node:test';
import assert from 'node:assert/strict';

// A browser-like IndexedDB + Chrome messaging contract test. This exercises the
// actual service-worker save path and archive storage; no website is contacted.
const stores = new Map();
const database = {
  objectStoreNames:{contains:name=>stores.has(name)},
  createObjectStore:name=>{stores.set(name,new Map());},
  transaction(name,mode){
    const t={oncomplete:null,onerror:null,onabort:null};
    t.objectStore=()=>({
      get(key){return request(()=>stores.get(name).get(key));},
      getAll(){return request(()=>[...stores.get(name).values()]);},
      put(value){return request(()=>{stores.get(name).set(value.id,value);return value.id;});},
      delete(key){return request(()=>stores.get(name).delete(key));}
    });
    function request(op){
      const r={onsuccess:null,onerror:null,result:undefined,error:null};
      queueMicrotask(()=>{try{r.result=op();r.onsuccess?.();queueMicrotask(()=>t.oncomplete?.());}
        catch(error){r.error=error;r.onerror?.();t.onerror?.();}});
      return r;
    }
    return t;
  }
};
globalThis.indexedDB={open(){
  const r={result:database,onupgradeneeded:null,onsuccess:null,onerror:null};
  queueMicrotask(()=>{r.onupgradeneeded?.();r.onsuccess?.();});return r;
}};
const state={settings:{capture:{chatgpt:true},exportMode:'local'}};
let listener;
const event=()=>({addListener:fn=>{}});
globalThis.chrome={
  storage:{local:{get:async key=>typeof key==='string'?{[key]:state[key]}:Object.fromEntries(key.map(x=>[x,state[x]])),set:async patch=>Object.assign(state,patch)}},
  runtime:{onMessage:{addListener:fn=>listener=fn},onInstalled:event(),onStartup:event()},
  tabs:{query:async()=>[],get:async()=>({}),onActivated:event(),onCreated:event(),onRemoved:event(),onUpdated:event()},
  action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
  alarms:{get:async()=>null,create:async()=>{},onAlarm:event()},
  downloads:{onChanged:event()},contextMenus:{onClicked:event(),removeAll:async()=>{},create:()=>{}},
  permissions:{onRemoved:event(),contains:async()=>false},
  scripting:{getRegisteredContentScripts:async()=>[],registerContentScripts:async()=>{},unregisterContentScripts:async()=>{}},
  bookmarks:{getTree:async()=>[]}
};
await import('../src/background.js');
async function send(message,sender={tab:{id:1,url:'https://chatgpt.com/c/abc'}}){
 return new Promise(resolve=>{listener(message,sender,resolve);});
}
test('capture message persists content through actual background handler and IndexedDB',async()=>{
 const text='A question from modern ChatGPT';
 const reply=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url:'https://chatgpt.com/c/abc',title:'Real flow fixture',messages:[{role:'user',text},{role:'assistant',text:'Response'}]}});
 assert.equal(reply.ok,true);assert.equal(reply.data.saved,true);
 const snapshot=await send({type:'SNAPSHOT'});
 assert.equal(snapshot.ok,true);assert.equal(snapshot.data.chats.length,1);
 assert.equal(snapshot.data.chats[0].messageCount,2);
 assert.equal(state.captureEvent?.count,2);
 const detail=await send({type:'GET_CHAT',id:'chat:https://chatgpt.com/c/abc'});
 assert.equal(detail.data.messages[0].text,text);
});
test('capture reports health without collecting chat text in diagnostic telemetry',async()=>{
 const r=await send({type:'CAPTURE_HEALTH',platform:'chatgpt',status:'saved',count:2});
 assert.equal(r.ok,true);assert.equal(state.captureHealth.chatgpt.status,'saved');
 assert.equal(JSON.stringify(state.captureHealth).includes('A question from modern ChatGPT'),false);
});
test('background rejects messages from an unrelated domain',async()=>{
 const r=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url:'https://chatgpt.com/c/a',messages:[{role:'user',text:'sensitive'}]}},{tab:{id:2,url:'https://evil.invalid/'}});
 assert.equal(r.ok,false);assert.match(r.error,/not enabled/);
});
