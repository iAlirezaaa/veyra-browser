/** User-owned tab categories. No tab is closed or transmitted to a server. */
import {categoryFor, hostOf, normalizeUrl, isWebTab} from './core.js';

export const COLORS=['grey','blue','red','yellow','green','pink','purple','cyan','orange'];
export const DEFAULT_CATEGORIES=[
  {id:'work',name:'Work',color:'blue'},
  {id:'ai',name:'AI',color:'purple'},
  {id:'learning',name:'Learning',color:'green'},
  {id:'media',name:'Media',color:'red'},
  {id:'social',name:'Social',color:'pink'},
  {id:'shopping',name:'Shopping',color:'orange'},
  {id:'other',name:'Other',color:'grey'}
];
export const TAB_SORTS=['category','domain','title','recent','browser'];
const ID=/^[a-z][a-z0-9-]{0,39}$/;
export function sanitizeCategories(value){
  const seen=new Set();const result=[];
  for(const input of Array.isArray(value)?value:DEFAULT_CATEGORIES){
    const id=String(input?.id||'').toLowerCase();
    if(!ID.test(id)||seen.has(id))continue;
    const name=String(input?.name||'').trim().slice(0,40);
    if(!name)continue;
    seen.add(id);result.push({id,name,color:COLORS.includes(input.color)?input.color:'grey'});
    if(result.length===30)break;
  }
  return result;
}
export function tabCategory(tab,settings={}){
  const categories=sanitizeCategories(settings.tabCategories);
  const assignment=settings.tabAssignments?.[normalizeUrl(tab.url)];
  const suggested=categoryFor(tab);
  const selected=categories.some(c=>c.id===assignment)?assignment:suggested;
  return categories.some(c=>c.id===selected)?selected:(categories.some(c=>c.id==='other')?'other':categories[0]?.id||'other');
}
export function orderedTabs(tabs,settings={}){
  const categories=sanitizeCategories(settings.tabCategories);
  const order=new Map(categories.map((x,i)=>[x.id,i]));
  const kind=TAB_SORTS.includes(settings.tabSort)?settings.tabSort:'category';
  const copy=(tabs||[]).filter(isWebTab).slice();
  if(kind==='browser')return copy.sort((a,b)=>a.windowId-b.windowId||a.index-b.index);
  return copy.sort((a,b)=>{
    let n=0;
    if(kind==='category')n=(order.get(tabCategory(a,settings))??999)-(order.get(tabCategory(b,settings))??999);
    if(kind==='domain')n=hostOf(a.url).localeCompare(hostOf(b.url));
    if(kind==='title')n=String(a.title||'').localeCompare(String(b.title||''));
    if(kind==='recent')n=(b.lastAccessed||0)-(a.lastAccessed||0);
    return n||a.windowId-b.windowId||a.index-b.index;
  });
}
export function groupedByCategory(tabs,settings={}){
  const categories=sanitizeCategories(settings.tabCategories);
  const map=new Map(categories.map(x=>[x.id,{...x,tabs:[]}]))
  for(const tab of orderedTabs(tabs,settings)){
    const id=tabCategory(tab,settings);
    if(!map.has(id))map.set(id,{id,name:id,color:'grey',tabs:[]});
    map.get(id).tabs.push(tab);
  }
  return [...map.values()].filter(x=>x.tabs.length);
}
export function newCategory(name,categories){
  const valid=String(name||'').trim().slice(0,40);
  if(!valid)throw Error('Category name is required');
  const existing=sanitizeCategories(categories);
  if(existing.length>=30)throw Error('Category limit reached');
  const base=valid.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,31)||'custom';
  let id=base,n=2;while(existing.some(c=>c.id===id))id=`${base}-${n++}`;
  return {id,name:valid,color:'blue'};
}
export function assignUrlCategory(assignments,url,categoryId,categories){
  const key=normalizeUrl(url);
  if(!key)throw Error('Invalid web URL');
  if(!sanitizeCategories(categories).some(c=>c.id===categoryId))throw Error('Unknown category');
  return {...(assignments||{}),[key]:categoryId};
}
