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
const grouped=[];const moved=[];
const sampleTabs=[{id:11,windowId:1,groupId:-1,index:0, url:'https://github.com/test',title:'GitHub',pinned:false},{id:12,windowId:1,groupId:-1,index:1,url:'https://chatgpt.com/c/group',title:'GPT',pinned:false},{id:13,windowId:1,groupId:3,index:2,url:'https://chatgpt.com/c/already',title:'Grouped',pinned:false}];
let listener;
const event=()=>({addListener:fn=>{}});
globalThis.chrome={
  storage:{local:{get:async key=>typeof key==='string'?{[key]:state[key]}:Object.fromEntries(key.map(x=>[x,state[x]])),set:async patch=>Object.assign(state,patch),remove:async key=>delete state[key]}},
  runtime:{onMessage:{addListener:fn=>listener=fn},onInstalled:event(),onStartup:event()},
  tabs:{query:async()=>sampleTabs,get:async(id)=>sampleTabs.find(t=>t.id===id)||{},group:async args=>{grouped.push(args);return 77},move:async(id,opts)=>{moved.push({id,opts})},onActivated:event(),onCreated:event(),onRemoved:event(),onUpdated:event()},
  tabGroups:{update:async(id,opts)=>{grouped.push({id,opts})}},
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

test('opt-in drafts are persisted before the SPA conversation URL, then migrated',async()=>{
  const draft=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url:'https://chatgpt.com/',title:'New chat',messages:[{role:'user',text:'Question before route'}]}},{tab:{id:57,url:'https://chatgpt.com/'}});
  assert.equal(draft.ok,true);assert.equal(draft.data.saved,true);
  let result=await send({type:'SNAPSHOT'});assert.ok(result.data.chats.some(x=>x.id==='draft:chatgpt:57'));
  const stable=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url:'https://chatgpt.com/c/assigned',title:'New chat',messages:[{role:'user',text:'Question before route'},{role:'assistant',text:'Answer after route'}]}},{tab:{id:57,url:'https://chatgpt.com/c/assigned'}});
  assert.equal(stable.ok,true);result=await send({type:'SNAPSHOT'});
  assert.ok(result.data.chats.some(x=>x.id==='chat:https://chatgpt.com/c/assigned'));
  assert.ok(!result.data.chats.some(x=>x.id==='draft:chatgpt:57'));
});
test('tab actions assign, group by category, and exclude existing Chrome groups',async()=>{
 const set=await send({type:'TAB_ASSIGN',tabId:12,categoryId:'work'},{id:'extension'});
 assert.equal(set.ok,true);assert.equal(set.data.settings.tabAssignments['https://chatgpt.com/c/group'],'work');
 const res=await send({type:'TAB_GROUP_CHROME',categoryId:'work'},{id:'extension'});
 assert.equal(res.ok,true);assert.equal(res.data.grouped,2);
 assert.deepEqual(grouped[0].tabIds,[11,12]);
 assert.equal(grouped[1].opts.title,'Work');
 const sorted=await send({type:'TAB_REORDER_CHROME'},{id:'extension'});
 assert.equal(sorted.ok,true);assert.ok(moved.length>=2);
 const denied=await send({type:'TAB_ASSIGN',tabId:12,categoryId:'ai'},{tab:{id:12,url:'https://chatgpt.com/c/group'}});
 assert.equal(denied.ok,false);
});
