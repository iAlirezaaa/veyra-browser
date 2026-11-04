import test from 'node:test';
import assert from 'node:assert/strict';
import {saveTab,saveSession,getSavedLibrary,ensureSavedCategory,moveSavedItem,renameSavedItem,deleteSavedItem,urlsForSavedItem,saveable,uniqueWebTabs,ROOT_TITLE} from '../src/saved-tabs.js';

// The bookmark tree is the syncable source of truth. Both simulated device
// clients use the same tree, regardless of their extension installation paths.
function mockBookmarks(){
 let index=3;const nodes=new Map();
 nodes.set('0',{id:'0',title:'',children:['1','2']});nodes.set('1',{id:'1',title:'Bookmarks bar',parentId:'0',children:[]});nodes.set('2',{id:'2',title:'Other bookmarks',parentId:'0',children:[]});
 let failAt=0,creates=0;
 const clone=(id)=>{const n=nodes.get(id);if(!n)throw Error('Missing bookmark '+id);return {id:n.id,title:n.title,parentId:n.parentId,...(n.url?{url:n.url}:{children:n.children.map(clone)})};};
 const unlink=id=>{const n=nodes.get(id);nodes.get(n.parentId)?.children.splice(nodes.get(n.parentId).children.indexOf(id),1);};
 const api={
  getTree:async()=>[clone('0')],
  getSubTree:async id=>[clone(id)],
  create:async data=>{creates++;if(failAt&&creates===failAt)throw Error('Simulated Chrome failure');const id=String(++index),p=nodes.get(data.parentId);if(!p||!p.children)throw Error('Bad parent');const n={id,title:data.title,parentId:data.parentId,...(data.url?{url:data.url}:{children:[]})};nodes.set(id,n);p.children.push(id);return clone(id);},
  move:async(id,data)=>{unlink(id);nodes.get(id).parentId=data.parentId;nodes.get(data.parentId).children.push(id);return clone(id);},
  update:async(id,data)=>{nodes.get(id).title=data.title;return clone(id);},
  remove:async id=>{if(nodes.get(id)?.children)throw Error('Cannot remove folder');unlink(id);nodes.delete(id);},
  removeTree:async id=>{const del=x=>{for(const c of [...(nodes.get(x).children||[])])del(c);nodes.delete(x)};unlink(id);del(id);},
  failNextCreateAt:n=>{failAt=n;},
  get created(){return creates;}
 };return api;
}
const tab=(url,title='Example')=>({url,title});
test('only web tabs without incognito are syncable',()=>{
 assert.equal(saveable(tab('https://example.org')),true);
 for(const url of ['chrome://extensions','file:///tmp/a','javascript:alert(1)','data:text/x,hi'])assert.equal(saveable(tab(url)),false);
 assert.equal(saveable({url:'https://example.com',incognito:true}),false);
});
test('bookmark native root is created lazily and without affecting existing bookmarks',async()=>{
 const api=mockBookmarks();assert.equal((await getSavedLibrary(api)).rootId,null);
 await ensureSavedCategory(api,'Work');const tree=await api.getTree();assert.equal(tree[0].children[1].children[0].title,ROOT_TITLE);
 assert.equal((await getSavedLibrary(api)).categories[0].name,'Work');
});
test('a category is reused case insensitively',async()=>{
 const api=mockBookmarks();const a=await ensureSavedCategory(api,'Research');const b=await ensureSavedCategory(api,'research');assert.equal(a.id,b.id);
});
test('single tab can be saved, duplicate does not create another bookmark',async()=>{
 const api=mockBookmarks();const first=await saveTab(api,tab('https://example.com'),'Read later');const second=await saveTab(api,tab('https://example.com'),'Read later');
 assert.equal(first.id,second.id);assert.equal(second.duplicate,true);assert.equal((await getSavedLibrary(api)).total,1);
});
test('session stores multiple URLs and deduplicates preserving their order',async()=>{
 const api=mockBookmarks();const result=await saveSession(api,[tab('https://a.com'),tab('https://b.com'),tab('https://a.com'),tab('chrome://flags')],'Work','Sprint');
 const data=await getSavedLibrary(api);assert.equal(result.count,2);assert.equal(data.sessions,1);assert.deepEqual(urlsForSavedItem(data,result.id),['https://a.com','https://b.com']);
});
test('moving a saved item to another synced category preserves its URL',async()=>{
 const api=mockBookmarks();const from=await saveTab(api,tab('https://a.com'),'Work');const to=await ensureSavedCategory(api,'Personal');
 await moveSavedItem(api,from.id,to.id);const data=await getSavedLibrary(api);assert.equal(data.categories.find(x=>x.id===to.id).looseTabs[0].url,'https://a.com');
});
test('a saved session can move between categories and then restore',async()=>{
 const api=mockBookmarks();const g=await saveSession(api,[tab('https://a.com'),tab('https://b.com')],'Work','Sprint');const to=await ensureSavedCategory(api,'Research');
 await moveSavedItem(api,g.id,to.id);assert.deepEqual(urlsForSavedItem(await getSavedLibrary(api),g.id),['https://a.com','https://b.com']);
});
test('renaming category and session is reflected across devices',async()=>{
 const api=mockBookmarks();const session=await saveSession(api,[tab('https://a.com')],'Work','Sprint');const library=await getSavedLibrary(api);
 await renameSavedItem(api,library.categories[0].id,'Projects');await renameSavedItem(api,session.id,'Future');
 const otherDevice=await getSavedLibrary(api);assert.equal(otherDevice.categories[0].name,'Projects');assert.equal(otherDevice.categories[0].sessions[0].title,'Future');
});
test('renaming a category to an existing category name fails',async()=>{
 const api=mockBookmarks();await ensureSavedCategory(api,'Work');const b=await ensureSavedCategory(api,'Research');await assert.rejects(renameSavedItem(api,b.id,'work'),/already exists/);
});
test('category cannot be deleted when it still contains saved tabs',async()=>{
 const api=mockBookmarks();await saveTab(api,tab('https://a.com'),'Work');const data=await getSavedLibrary(api);
 await assert.rejects(deleteSavedItem(api,data.categories[0].id),/Move or delete/);
});
test('delete only a saved tab, preserving the category',async()=>{
 const api=mockBookmarks();const result=await saveTab(api,tab('https://a.com'),'Work');await deleteSavedItem(api,result.id);
 const data=await getSavedLibrary(api);assert.equal(data.total,0);assert.equal(data.categories.length,1);
});
test('refuses moving and deleting ordinary user bookmarks outside Veyra',async()=>{
 const api=mockBookmarks();const outside=await api.create({parentId:'1',title:'Personal bookmark',url:'https://outside.com'});
 await assert.rejects(deleteSavedItem(api,outside.id),/not found/);
 await assert.rejects(moveSavedItem(api,outside.id,'2'),/Only saved/);
});
test('partial creation failure rolls back empty/incomplete snapshot',async()=>{
 const api=mockBookmarks();await ensureSavedCategory(api,'Work');api.failNextCreateAt(api.created+3);
 await assert.rejects(saveSession(api,[tab('https://a.com'),tab('https://b.com')],'Work','Failing'),/Simulated Chrome failure/);
 assert.equal((await getSavedLibrary(api)).sessions,0);
});
test('empty or unsafe batch is rejected before creating a folder',async()=>{
 const api=mockBookmarks();await assert.rejects(saveSession(api,[tab('chrome://extensions')],'Work'),/No savable/);assert.equal((await getSavedLibrary(api)).rootId,null);
});
test('uniqueWebTabs strips unsafe, duplicate and incognito entries',()=>{
 const values=uniqueWebTabs([tab('https://example.com'),tab('https://example.com'),tab('file:///tmp'),{url:'https://secret.com',incognito:true}]);assert.equal(values.length,1);
});
