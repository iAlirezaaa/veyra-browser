/** Chrome tab-strip orchestration; no removal or cross-window migration. */
import {isWebTab} from './core.js';
import {orderedTabs, sanitizeCategories, tabCategory} from './tab-workspace.js';

const ungrouped=tab=>tab.groupId==null||tab.groupId===-1;
export function eligibleTab(tab){return Boolean(Number.isInteger(tab?.id)&&Number.isInteger(tab?.windowId)&&!tab.pinned&&ungrouped(tab)&&isWebTab(tab));}

export function organizationPlan(tabs,settings={},categoryId=null){
  const cats=sanitizeCategories(settings.tabCategories);
  if(categoryId && !cats.some(c=>c.id===categoryId))throw Error('Unknown category');
  const eligible=(tabs||[]).filter(t=>eligibleTab(t)&&(!categoryId||tabCategory(t,settings)===categoryId));
  const windows=new Map();
  for(const tab of eligible){if(!windows.has(tab.windowId))windows.set(tab.windowId,[]);windows.get(tab.windowId).push(tab);}
  return [...windows].sort(([a],[b])=>a-b).map(([windowId,items])=>{
    const sorted=orderedTabs(items,settings);
    const byCategory=[];
    for(const category of cats){const catTabs=sorted.filter(t=>tabCategory(t,settings)===category.id);if(catTabs.length)byCategory.push({category,tabIds:catTabs.map(t=>t.id)});}
    return {windowId,tabIds:sorted.map(t=>t.id),byCategory};
  });
}

/** Moves/groups only unpinned, ungrouped http(s) tabs; already grouped tabs are left alone.
 * Returns observably checked results, not a count of attempted API calls.
 */
export async function organizeChromeTabs(api,settings={},options={}){
  const mode=options.mode||'both';
  if(!['both','sort','group'].includes(mode))throw Error('Unknown organization operation');
  const original=await api.tabs.query({});
  const plan=organizationPlan(original,settings,options.categoryId||null);
  const skipped=original.filter(t=>isWebTab(t)&&(!eligibleTab(t))&&(!options.categoryId||tabCategory(t,settings)===options.categoryId)).length;
  const summary={windows:plan.length,eligible:plan.reduce((a,x)=>a+x.tabIds.length,0),moved:0,grouped:0,groupsCreated:0,groupsReused:0,skipped,errors:[],verified:true};
  for(const window of plan){
    const {windowId}=window;
    try{
      // Check the observed Chrome tab order, not just successful API calls.
      if(mode==='both'||mode==='sort'){
        const ids=mode==='both'?window.byCategory.flatMap(x=>x.tabIds):window.tabIds;
        if(ids.length>1){await api.tabs.move(ids,{index:-1});
          const now=(await api.tabs.query({windowId})).filter(t=>ids.includes(t.id));
          const actual=now.sort((a,b)=>a.index-b.index).map(t=>t.id);
          if(ids.join(',')!==actual.join(','))throw Error(`Chrome did not apply requested tab order in window ${windowId}`);
          summary.moved+=ids.length;
        }
      }
      if(mode==='both'||mode==='group'){
        const existing=await api.tabGroups.query({windowId});
        for(const {category,tabIds} of window.byCategory){
          const matching=existing.find(g=>g.title===category.name && g.color===category.color);
          const props=matching?{groupId:matching.id}:{createProperties:{windowId}};
          const groupId=await api.tabs.group({tabIds,...props});
          if(!matching){await api.tabGroups.update(groupId,{title:category.name,color:category.color});existing.push({id:groupId,windowId,title:category.name,color:category.color});summary.groupsCreated++;}
          else summary.groupsReused++;
          const checked=await api.tabs.query({windowId});
          if(!tabIds.every(id=>checked.some(t=>t.id===id&&t.groupId===groupId)))throw Error(`Chrome group verification failed in window ${windowId}`);
          summary.grouped+=tabIds.length;
        }
      }
    }catch(error){summary.verified=false;summary.errors.push({windowId,reason:String(error?.message||error)});}
  }
  return summary;
}
