import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleTab,organizationPlan,organizeChromeTabs} from '../src/tab-organizer.js';

function mockChrome(initial){
  const tabs=initial.map(t=>({...t}));const groups=[];let nextId=900;
  const calls=[];
  function refresh(){for(const windowId of new Set(tabs.map(t=>t.windowId)))tabs.filter(t=>t.windowId===windowId).forEach((t,i)=>t.index=i);}
  refresh();
  return {tabs,groups,calls,api:{tabs:{
    async query(query={}){refresh();return tabs.filter(t=>query.windowId===undefined||t.windowId===query.windowId).map(t=>({...t}));},
    async move(ids,{index}){
      calls.push(['move',ids,index]);const chosen=Array.isArray(ids)?ids:[ids];
      const selected=chosen.map(id=>tabs.find(t=>t.id===id));
      assert.ok(selected.every(Boolean));const idSet=new Set(chosen);
      const win=selected[0].windowId;assert.ok(selected.every(t=>t.windowId===win&&!t.pinned&&(t.groupId==null||t.groupId===-1)));
      const remaining=tabs.filter(t=>!idSet.has(t.id));
      const targetIndex=index===-1?remaining.filter(t=>t.windowId===win).length:index;
      const winTabs=remaining.filter(t=>t.windowId===win);winTabs.splice(targetIndex,0,...selected);
      tabs.splice(0,tabs.length,...remaining.filter(t=>t.windowId!==win),...winTabs);refresh();
    },
    async group({tabIds,groupId,createProperties}){
      calls.push(['group',tabIds,groupId??null]);const ids=new Set(tabIds),group=groupId??nextId++;
      assert.ok(groupId||createProperties?.windowId!==undefined);
      for(const t of tabs.filter(t=>ids.has(t.id))){assert.ok(!t.pinned);assert.equal(t.groupId??-1,-1);t.groupId=group;}
      if(groupId===undefined)groups.push({id:group,windowId:createProperties.windowId,title:'',color:'grey'});
      return group;
    }
  },tabGroups:{
    async query({windowId}){return groups.filter(g=>g.windowId===windowId).map(g=>({...g}));},
    async update(id,props){calls.push(['update',id,props]);Object.assign(groups.find(g=>g.id===id),props);}
  }}};
}
const setup=[
 {id:1,url:'https://youtube.com/watch?v=abc',title:'Video',windowId:3,groupId:-1},
 {id:2,url:'https://chatgpt.com/c/1',title:'AI',windowId:3,groupId:-1},
 {id:3,url:'https://github.com/test',title:'Work',windowId:3,groupId:-1},
 {id:4,url:'https://example.com',title:'Pinned',windowId:3,groupId:-1,pinned:true},
 {id:5,url:'https://reddit.com',title:'Personal group',windowId:3,groupId:55},
 {id:6,url:'chrome://settings/',title:'Settings',windowId:3,groupId:-1},
 {id:7,url:'https://gemini.google.com/app',title:'AI2',windowId:4,groupId:-1},
 {id:8,url:'https://github.com/other',title:'Work2',windowId:4,groupId:-1}
];
test('pin/group protection and deterministic category sorting',()=>{
 assert.deepEqual(setup.map(eligibleTab),[true,true,true,false,false,false,true,true]);
 assert.deepEqual(organizationPlan(setup,{tabSort:'category'})[0].tabIds,[3,2,1]);
});
test('actual Chrome API operations are checked and existing tabs protected',async()=>{
 const {api,tabs,groups,calls}=mockChrome(setup);
 const result=await organizeChromeTabs(api,{tabSort:'category'});
 assert.equal(result.verified,true);assert.equal(result.errors.length,0);
 assert.equal(result.grouped,5);assert.equal(result.groupsCreated,5);
 assert.equal(tabs.find(t=>t.id===4).groupId,-1);assert.equal(tabs.find(t=>t.id===5).groupId,55);
 assert.ok(groups.some(g=>g.title==='AI'&&g.color==='purple'));
 assert.ok(calls.some(c=>c[0]==='move'&&c[1].join(',')==='3,2,1'));
 const second=await organizeChromeTabs(api,{tabSort:'category'});
 assert.equal(second.grouped,0);assert.equal(second.errors.length,0);
});
test('category grouping reuses a matching existing group',async()=>{
 const {api,groups,calls}=mockChrome(setup.slice(0,3));
 groups.push({id:77,windowId:3,title:'AI',color:'purple'});
 const r=await organizeChromeTabs(api,{tabSort:'category'},{mode:'group',categoryId:'ai'});
 assert.equal(r.grouped,1);assert.equal(r.groupsReused,1);assert.equal(r.groupsCreated,0);
 assert.ok(calls.some(c=>c[0]==='group'&&c[2]===77));
});
test('a failed Chrome move produces a visible error, not a success count',async()=>{
 const {api}=mockChrome(setup.slice(0,3));api.tabs.move=async()=>{throw Error('Tab strip locked')};
 const r=await organizeChromeTabs(api,{tabSort:'category'});
 assert.equal(r.verified,false);assert.equal(r.grouped,0);assert.match(r.errors[0].reason,/locked/);
});
test('zero eligible tabs yields a truthful no-change summary',async()=>{
 const {api}=mockChrome(setup.filter(t=>!eligibleTab(t)));
 const r=await organizeChromeTabs(api,{tabSort:'category'});
 assert.equal(r.eligible,0);assert.equal(r.moved,0);assert.equal(r.grouped,0);assert.ok(r.skipped>0);
});
