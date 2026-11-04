/**
 * Saved tab workspaces backed by Chrome Bookmarks, NOT extension-local storage.
 * Chrome's native bookmark sync is independent of the unpacked extension ID.
 * Nothing is saved until the user explicitly clicks Save.
 */
export const ROOT_TITLE = 'Veyra — Saved Tabs';
export const FALLBACK_CATEGORY = 'Unsorted';
export const MAX_SESSION_TABS = 150;
export const DEFAULT_SAVED_CATEGORIES = ['Work', 'Research', 'Personal', 'Read later', 'AI'];

export function safeTitle(text, fallback='Untitled') {
  const value=String(text??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
  return value || fallback;
}
export function saveable(tab) {
  try { const url=new URL(tab?.url); return ['http:','https:'].includes(url.protocol) && !tab.incognito; }
  catch { return false; }
}
export function uniqueWebTabs(tabs) {
  const seen=new Set();return (Array.isArray(tabs)?tabs:[]).filter(tab=>{
    if(!saveable(tab) || seen.has(tab.url))return false;
    seen.add(tab.url);return true;
  }).slice(0,MAX_SESSION_TABS);
}
export function findRoot(bookmarkTree) {
  const root=bookmarkTree?.[0];
  // Only trust one of Chrome's top-level bookmark containers, never a random
  // user folder with a similar title elsewhere.
  for(const container of root?.children||[])
    for(const node of container.children||[])
      if(!node.url && node.title===ROOT_TITLE)return node;
  return null;
}
function nativeFolder(tree){
  const all=tree?.[0]?.children||[];
  return all.find(x=>x.id==='2')||all.find(x=>!x.unmodifiable && !x.url)||null;
}
export async function getSavedLibrary(api){
  const root=findRoot(await api.getTree());
  if(!root)return {rootId:null,categories:[],total:0,sessions:0};
  const children=(await api.getSubTree(root.id))?.[0]?.children||[];
  const categories=children.filter(x=>!x.url).map(category=>{
    const direct=(category.children||[]);
    const sessions=direct.filter(x=>!x.url).map(group=>({
      id:group.id,title:group.title,dateAdded:group.dateAdded||0,tabs:(group.children||[]).filter(x=>saveable(x)).map(x=>({id:x.id,title:x.title,url:x.url,dateAdded:x.dateAdded||0}))
    }));
    const looseTabs=direct.filter(x=>saveable(x)).map(x=>({id:x.id,title:x.title,url:x.url,dateAdded:x.dateAdded||0}));
    return {id:category.id,name:category.title,sessions,looseTabs,count:looseTabs.length+sessions.reduce((sum,x)=>sum+x.tabs.length,0)};
  });
  return {rootId:root.id,categories,total:categories.reduce((sum,x)=>sum+x.count,0),sessions:categories.reduce((sum,x)=>sum+x.sessions.length,0)};
}
async function ensureRoot(api){
  const tree=await api.getTree(),found=findRoot(tree);
  if(found)return found;
  const folder=nativeFolder(tree);
  if(!folder)throw new Error('Cannot locate a writable Chrome bookmarks folder');
  return api.create({parentId:folder.id,title:ROOT_TITLE});
}
export async function ensureSavedCategory(api,name){
  const title=safeTitle(name,FALLBACK_CATEGORY),root=await ensureRoot(api);
  const children=(await api.getSubTree(root.id))?.[0]?.children||[];
  const found=children.find(x=>!x.url && x.title.toLocaleLowerCase()===title.toLocaleLowerCase());
  return found||api.create({parentId:root.id,title});
}
export async function saveTab(api,tab,category=FALLBACK_CATEGORY){
  if(!saveable(tab))throw new Error('Only normal http(s) tabs can be saved');
  const parent=await ensureSavedCategory(api,category);
  const children=(await api.getSubTree(parent.id))?.[0]?.children||[];
  const existing=children.find(x=>x.url===tab.url);
  return existing?{id:existing.id,duplicate:true}:{id:(await api.create({parentId:parent.id,title:safeTitle(tab.title,tab.url),url:tab.url})).id,duplicate:false};
}
export async function saveSession(api,tabs,category=FALLBACK_CATEGORY,title){
  const eligible=uniqueWebTabs(tabs);
  if(!eligible.length)throw new Error('No savable web tabs');
  if(eligible.length < (Array.isArray(tabs)?tabs:[]).filter(saveable).length && eligible.length===MAX_SESSION_TABS)
    throw new Error(`A session cannot exceed ${MAX_SESSION_TABS} tabs`);
  const parent=await ensureSavedCategory(api,category);
  const session=await api.create({parentId:parent.id,title:safeTitle(title,`Session ${new Date().toLocaleString('en-GB')}`)});
  try{
    for(const tab of eligible)await api.create({parentId:session.id,title:safeTitle(tab.title,tab.url),url:tab.url});
    return {id:session.id,count:eligible.length};
  }catch(error){await api.removeTree(session.id).catch(()=>{});throw error;}
}
function itemInLibrary(library,id){
  for(const category of library.categories){
    if(category.id===id)return {type:'category',item:category,category};
    for(const tab of category.looseTabs)if(tab.id===id)return {type:'tab',item:tab,category};
    for(const session of category.sessions){
      if(session.id===id)return {type:'session',item:session,category};
      for(const tab of session.tabs)if(tab.id===id)return {type:'tab',item:tab,category};
    }
  }
  return null;
}
export async function moveSavedItem(api,id,destination){
  const library=await getSavedLibrary(api),record=itemInLibrary(library,String(id));
  if(!record || record.type==='category')throw new Error('Only saved tabs and sessions can be moved');
  const folder=library.categories.find(x=>x.id===destination);
  if(!folder)throw new Error('Select a saved category');
  if(record.category.id===folder.id && record.type==='session')return {moved:false};
  await api.move(String(id),{parentId:folder.id});return {moved:true};
}
export async function renameSavedItem(api,id,name){
  const library=await getSavedLibrary(api),record=itemInLibrary(library,String(id));
  if(!record)throw new Error('Saved item not found');
  const title=safeTitle(name,'');if(!title)throw new Error('Enter a name');
  if(record.type==='category' && library.categories.some(x=>x.id!==id && x.name.toLocaleLowerCase()===title.toLocaleLowerCase()))throw new Error('Category already exists');
  await api.update(String(id),{title});return {renamed:true};
}
export async function deleteSavedItem(api,id){
  const library=await getSavedLibrary(api),record=itemInLibrary(library,String(id));
  if(!record)throw new Error('Saved item not found');
  if(record.type==='category' && record.category.count>0)throw new Error('Move or delete the saved tabs before deleting this category');
  if(record.type==='tab')await api.remove(String(id));
  else await api.removeTree(String(id));
  return {deleted:true};
}
export function urlsForSavedItem(library,id){
  const record=itemInLibrary(library,String(id));
  if(!record)throw new Error('Saved item not found');
  const tabs=record.type==='tab'?[record.item]:record.type==='session'?record.item.tabs:[...record.item.looseTabs,...record.item.sessions.flatMap(x=>x.tabs)];
  return uniqueWebTabs(tabs).map(x=>x.url);
}
