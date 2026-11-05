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
const grouped=[];const moved=[];const activeGroups=[];
const sampleTabs=[{id:11,windowId:1,groupId:-1,index:0, url:'https://github.com/test',title:'GitHub',pinned:false},{id:12,windowId:1,groupId:-1,index:1,url:'https://chatgpt.com/c/group',title:'GPT',pinned:false},{id:13,windowId:1,groupId:3,index:2,url:'https://chatgpt.com/c/already',title:'Grouped',pinned:false}];
let listener;
const event=()=>({addListener:fn=>{}});
globalThis.chrome={
  storage:{local:{get:async key=>typeof key==='string'?{[key]:state[key]}:Object.fromEntries(key.map(x=>[x,state[x]])),set:async patch=>Object.assign(state,patch),remove:async key=>delete state[key]}},
  runtime:{id:'veyra-test-extension',getURL:path=>'chrome-extension://veyra-test-extension/'+path,onMessage:{addListener:fn=>listener=fn},onInstalled:event(),onStartup:event()},
  tabs:{query:async(query={})=>sampleTabs.filter(t=>query.windowId===undefined||query.windowId===t.windowId),get:async(id)=>sampleTabs.find(t=>t.id===id)||{},group:async args=>{grouped.push(args);for(const t of sampleTabs)if(args.tabIds.includes(t.id))t.groupId=args.groupId??77;if(!args.groupId)activeGroups.push({id:77,windowId:1,title:'',color:'grey'});return args.groupId??77},move:async(id,opts)=>{moved.push({id,opts});const ids=Array.isArray(id)?id:[id];for(const t of sampleTabs.filter(t=>ids.includes(t.id)))t.index=ids.indexOf(t.id)},onActivated:event(),onCreated:event(),onRemoved:event(),onUpdated:event()},
  tabGroups:{query:async({windowId})=>activeGroups.filter(x=>x.windowId===windowId),update:async(id,opts)=>{grouped.push({id,opts});Object.assign(activeGroups.find(x=>x.id===id),opts)}},
  action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
  alarms:{get:async()=>null,create:async()=>{},onAlarm:event()},
  downloads:{onChanged:event()},contextMenus:{onClicked:event(),removeAll:async()=>{},create:()=>{}},
  permissions:{onRemoved:event(),contains:async()=>false},
  scripting:{getRegisteredContentScripts:async()=>[],registerContentScripts:async()=>{},unregisterContentScripts:async()=>{}},
  bookmarks:{getTree:async()=>[]}
};
await import('../src/background.js');
const dashboard={id:'veyra-test-extension',url:'chrome-extension://veyra-test-extension/src/ui/newtab.html',tab:{id:99,url:'chrome-extension://veyra-test-extension/src/ui/newtab.html'}};
async function send(message,sender={tab:{id:1,url:'https://chatgpt.com/c/abc'}}){
 return new Promise(resolve=>{listener(message,sender,resolve);});
}
const readDashboard=message=>send(message,dashboard);
test('capture message persists content through actual background handler and IndexedDB',async()=>{
 const text='A question from modern ChatGPT';
 const reply=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url:'https://chatgpt.com/c/abc',title:'Real flow fixture',messages:[{role:'user',text},{role:'assistant',text:'Response'}]}});
 assert.equal(reply.ok,true);assert.equal(reply.data.saved,true);
 const snapshot=await readDashboard({type:'SNAPSHOT'});
 assert.equal(snapshot.ok,true);assert.equal(snapshot.data.chats.length,1);
 assert.equal(snapshot.data.chats[0].messageCount,2);
 assert.equal(state.captureEvent?.count,2);
 const detail=await readDashboard({type:'GET_CHAT',id:'chat:https://chatgpt.com/c/abc'});
 assert.equal(detail.data.messages[0].text,text);
});
test('capture reports health without collecting chat text in diagnostic telemetry',async()=>{
 const r=await send({type:'CAPTURE_HEALTH',platform:'chatgpt',status:'saved',count:2});
 assert.equal(r.ok,true);assert.equal(state.captureHealth.chatgpt.status,'saved');
 assert.equal(JSON.stringify(state.captureHealth).includes('A question from modern ChatGPT'),false);
});
test('content scripts cannot read the local archive or change extension settings',async()=>{
 const sender={id:'veyra-test-extension',url:'https://chatgpt.com/c/abc',tab:{id:1,url:'https://chatgpt.com/c/abc'}};
 for(const type of ['SNAPSHOT','GET_CHAT','EXPORT','SETTINGS','GET_REVIEW']){
  const response=await send({type,id:'chat:https://chatgpt.com/c/abc',patch:{notificationWebhook:'https://attacker.example'}},sender);
  assert.equal(response.ok,false,`${type} unexpectedly succeeded`);
 }
 assert.equal(state.settings.notificationWebhook,undefined);
});
test('background rejects messages from an unrelated domain',async()=>{
 const r=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url:'https://chatgpt.com/c/a',messages:[{role:'user',text:'sensitive'}]}},{tab:{id:2,url:'https://evil.invalid/'}});
 assert.equal(r.ok,false);assert.match(r.error,/not enabled/);
});

test('opt-in drafts are persisted before the SPA conversation URL, then migrated',async()=>{
  const draft=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url:'https://chatgpt.com/',title:'New chat',messages:[{role:'user',text:'Question before route'}]}},{tab:{id:57,url:'https://chatgpt.com/'}});
  assert.equal(draft.ok,true);assert.equal(draft.data.saved,true);
  let result=await readDashboard({type:'SNAPSHOT'});assert.ok(result.data.chats.some(x=>x.id==='draft:chatgpt:57'));
  const stable=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url:'https://chatgpt.com/c/assigned',title:'New chat',messages:[{role:'user',text:'Question before route'},{role:'assistant',text:'Answer after route'}]}},{tab:{id:57,url:'https://chatgpt.com/c/assigned'}});
  assert.equal(stable.ok,true);result=await readDashboard({type:'SNAPSHOT'});
  assert.ok(result.data.chats.some(x=>x.id==='chat:https://chatgpt.com/c/assigned'));
  assert.ok(!result.data.chats.some(x=>x.id==='draft:chatgpt:57'));
});
test('tab actions assign, group by category, and exclude existing Chrome groups',async()=>{
 const dashboard={id:'veyra-test-extension',url:'chrome-extension://veyra-test-extension/src/ui/newtab.html',tab:{id:99,url:'chrome-extension://veyra-test-extension/src/ui/newtab.html'}};
 const set=await send({type:'TAB_ASSIGN',tabId:12,categoryId:'work'},dashboard);
 assert.equal(set.ok,true);assert.equal(set.data.settings.tabAssignments['https://chatgpt.com/c/group'],'work');
 const sorted=await send({type:'TAB_REORDER_CHROME'},dashboard);
 assert.equal(sorted.ok,true);assert.ok(moved.length>=1);
 const res=await send({type:'TAB_GROUP_CHROME',categoryId:'work'},dashboard);
 assert.equal(res.ok,true);assert.equal(res.data.grouped,2);
 assert.deepEqual(grouped[0].tabIds,[11,12]);
 assert.equal(grouped[1].opts.title,'Work');
 const second=await send({type:'TAB_GROUP_CHROME',categoryId:'work'},dashboard);
 assert.equal(second.ok,true);assert.equal(second.data.grouped,0);
 const denied=await send({type:'TAB_ASSIGN',tabId:12,categoryId:'ai'},{id:'veyra-test-extension',url:'https://chatgpt.com/c/group',tab:{id:12,url:'https://chatgpt.com/c/group'}});
 assert.equal(denied.ok,false);
 assert.match(denied.error,/New Tab dashboard/);
});


test('newtab messages with tab sender are trusted and can invoke combined Chrome organization',async()=>{
 const dashboard={id:'veyra-test-extension',url:'chrome-extension://veyra-test-extension/src/ui/newtab.html',tab:{id:99,url:'chrome-extension://veyra-test-extension/src/ui/newtab.html'}};
 const response=await send({type:'TAB_ORGANIZE_CHROME'},dashboard);
 assert.equal(response.ok,true, response.error);
 assert.equal(response.data.verified,true);
 assert.ok(Array.isArray(response.data.errors));
 const auto=await send({type:'TAB_AUTO_ORGANIZE',enabled:false},dashboard);
 assert.equal(auto.ok,true, auto.error);
});

test('untrusted tab, content script and spoofed extension sender cannot organize Chrome tabs',async()=>{
 const attempts=[
 {id:'veyra-test-extension',url:'https://chatgpt.com/c/x',tab:{id:3,url:'https://chatgpt.com/c/x'}},
 {id:'evil-extension',url:'chrome-extension://veyra-test-extension/src/ui/newtab.html',tab:{id:3,url:'chrome-extension://veyra-test-extension/src/ui/newtab.html'}},
 {id:'veyra-test-extension',url:'chrome-extension://veyra-test-extension/src/ui/newtab.html.evil'},
 {id:'veyra-test-extension',url:'chrome-extension://veyra-test-extension/src/ui/popup.html'}
 ];
 for(const sender of attempts){const reply=await send({type:'TAB_ORGANIZE_CHROME'},sender);assert.equal(reply.ok,false,JSON.stringify(sender));}
});
test('partial late window appends to the same persistent chat without losing 650 stored turns',async()=>{
 const url='https://chatgpt.com/c/long-case';
 const initial=Array.from({length:650},(_,i)=>({role:i%2?'assistant':'user',text:`Specific stored turn number ${i}: ${'information '.repeat(5)}`}));
 for(let start=0;start<initial.length;start+=68){
   const part=initial.slice(Math.max(0,start-4),Math.min(start+68,initial.length));
   const reply=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url,title:'long test',messages:part}});
   assert.equal(reply.ok,true,reply.error);
 }
 const id='chat:https://chatgpt.com/c/long-case';
 let got=(await readDashboard({type:'GET_CHAT',id})).data;
 assert.equal(got.messages.length,650);
 const tail=initial.slice(-5);
 const append=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url,title:'long test',messages:[...tail,{role:'user',text:'One entirely new appended user question after 650 earlier turns.'}]}});
 assert.equal(append.ok,true,append.error);assert.equal(append.data.count,651);
 got=(await readDashboard({type:'GET_CHAT',id})).data;
 assert.equal(got.messages.length,651);
 assert.equal(got.messages[0].text,initial[0].text.trim());
 const repeat=await send({type:'SAVE_CHAT',payload:{platform:'chatgpt',url,title:'long test',messages:tail}});
 assert.equal(repeat.data.reason,'Unchanged');
 assert.equal((await readDashboard({type:'GET_CHAT',id})).data.messages.length,651);
});

test('destructive and bulk data operations require the trusted New Tab dashboard sender',async()=>{
  const validImport={format:'veyra-backup-v1',chats:[{url:'https://chatgpt.com/c/evil-import',title:'Evil import',messages:[{role:'user',text:'should not land'}]}],clips:[]};
  const untrusted={id:'veyra-test-extension',url:'https://chatgpt.com/c/x',tab:{id:3,url:'https://chatgpt.com/c/x'}};
  const spoofed={id:'evil-extension',url:'chrome-extension://veyra-test-extension/src/ui/newtab.html',tab:{id:3,url:'chrome-extension://veyra-test-extension/src/ui/newtab.html'}};
  for(const sender of [untrusted,spoofed]){
    assert.equal((await send({type:'DELETE_CHAT',id:'chat:x'},sender)).ok,false);
    assert.equal((await send({type:'DELETE_CLIP',id:'clip:x'},sender)).ok,false);
    const imp=await send({type:'IMPORT',data:validImport},sender);
    assert.equal(imp.ok,false);assert.match(imp.error,/dashboard/);
    const dec=await send({type:'DECISION',id:'sug-x',answer:'no'},sender);
    assert.equal(dec.ok,false);assert.match(dec.error,/dashboard/);
  }
  // The guard, not the format check, blocked the untrusted import: nothing landed.
  assert.equal((await readDashboard({type:'GET_CHAT',id:'chat:https://chatgpt.com/c/evil-import'})).data,undefined);
  const dashboard={id:'veyra-test-extension',url:'chrome-extension://veyra-test-extension/src/ui/newtab.html',tab:{id:99,url:'chrome-extension://veyra-test-extension/src/ui/newtab.html'}};
  if(!stores.has('chats'))stores.set('chats',new Map());
  stores.get('chats').set('chat:auth-del',{id:'chat:auth-del',url:'https://chatgpt.com/c/auth-del',title:'fixture',messages:[{role:'user',text:'x'}]});
  const del=await send({type:'DELETE_CHAT',id:'chat:auth-del'},dashboard);
  assert.equal(del.ok,true,del.error);assert.equal(del.data.deleted,true);
  assert.equal((await send({type:'GET_CHAT',id:'chat:auth-del'},dashboard)).data,undefined);
  const goodImport=await send({type:'IMPORT',data:{format:'veyra-backup-v1',chats:[{url:'https://chatgpt.com/c/imported',title:'Imported',messages:[{role:'user',text:'hi'}]}],clips:[]}},dashboard);
  assert.equal(goodImport.ok,true,goodImport.error);assert.equal(goodImport.data.chatCount,1);
  const dec=await send({type:'DECISION',id:'suggestion-auth',answer:'no'},dashboard);
  assert.equal(dec.ok,true,dec.error);
});
