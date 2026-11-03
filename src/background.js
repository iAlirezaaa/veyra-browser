import { buildSuggestions, isWebTab, normalizeUrl, hostOf, PROVIDERS, providerFromUrl } from './core.js';
import { dbAll, dbGet, dbPut, dbDelete } from './db.js';
import { layaKeepSuggestion } from './laya.js';
import { updateBadge } from './vendor/tabout-badge.js';
import { archiveId, isConversationUrl, chatArchiveName, cleanDownloadsFolder, downloadFilename } from './archive.js';
import { toMarkdown } from './core.js';
import {sanitizeCategories, DEFAULT_CATEGORIES, TAB_SORTS, assignUrlCategory, tabCategory} from './tab-workspace.js';
import {organizeChromeTabs} from './tab-organizer.js';
import {isTrustedDashboardSender} from './message-auth.js';
import {mergeCapturedMessages,normalizeMessages,MAX_CHAT_MESSAGES,MAX_CHAT_CHARS} from './chat-sync.js';
import {markdownParts} from './archive.js';

const DEFAULTS={language:'en',theme:'system',capture:{},layaEnabled:false,autoReview:true,rtlSites:{},dismissed:{},activity:{},exportMode:'local',downloadsFolder:'Veyra/AI-Chats',tabCategories:DEFAULT_CATEGORIES,tabAssignments:{},tabSort:'category',autoOrganizeTabs:false};
const EXPORT_ALARM='veyra-export';
const HEALTH_STATES=new Set(['waiting-url','no-messages','saved','skipped','error','active']);
const saveQueues=new Map();
const CAPTURE_SCRIPT_PREFIX='veyra-capture-';
const getSettings=async()=>({ ...DEFAULTS,...(await chrome.storage.local.get('settings')).settings });
async function patchSettings(patch) {
  const old=await getSettings();
  if(patch.exportMode && !['local','downloads','folder'].includes(patch.exportMode))throw new Error('Invalid export mode');
  if(patch.downloadsFolder && !cleanDownloadsFolder(patch.downloadsFolder))throw new Error('Invalid Downloads folder');
  if(patch.exportMode==='downloads' && !await chrome.permissions.contains({permissions:['downloads']}))throw new Error('Downloads permission required');
  const next={...old,...patch};
  await chrome.storage.local.set({settings:next});
  return next;
}
function rtlOnPage(enabled) {
  const id='veyra-rtl-fields'; document.getElementById(id)?.remove();
  if(enabled) {
    const node=document.createElement('style');node.id=id;
    node.textContent='textarea,input[type="text"],input[type="search"],[contenteditable="true"],[role="textbox"]{direction:rtl!important;text-align:right!important;}';
    document.documentElement.appendChild(node);
  }
}
async function applyRtl(tabId,url) {
  const config=await getSettings();
  try {
    const origin=new URL(url).origin;
    if(config.rtlSites[origin] && await chrome.permissions.contains({origins:[`${origin}/*`]})) {
      await chrome.scripting.executeScript({target:{tabId},func:rtlOnPage,args:[true]});
    }
  } catch { /* Chrome internal pages cannot be scripted. */ }
}
async function syncCaptureScripts() {
  const current=await chrome.scripting.getRegisteredContentScripts();
  const ours=current.filter(x=>x.id.startsWith(CAPTURE_SCRIPT_PREFIX)).map(x=>x.id);
  if(ours.length) await chrome.scripting.unregisterContentScripts({ids:ours});
  const config=await getSettings(); const scripts=[];
  for(const [key,site] of Object.entries(PROVIDERS)) {
    if(!config.capture[key]) continue;
    const permitted=[];
    for(const match of site.matches) if(await chrome.permissions.contains({origins:[match]})) permitted.push(match);
    if(permitted.length) scripts.push({id:CAPTURE_SCRIPT_PREFIX+key,js:['src/content/capture.js'],matches:permitted,runAt:'document_idle',allFrames:false,persistAcrossSessions:true});
  }
  if(scripts.length) await chrome.scripting.registerContentScripts(scripts);
  // A newly granted permission does not inject dynamically registered scripts
  // into pages that were already open. Run them there explicitly and surface errors.
  const tabs=await chrome.tabs.query({});
  const errors=[];
  for(const tab of tabs){
    if(!tab.id || !tab.url)continue;
    if(!scripts.some(script=>script.matches.some(pattern=>tab.url.startsWith(pattern.slice(0,-1)))))continue;
    try { await chrome.scripting.executeScript({target:{tabId:tab.id},files:['src/content/capture.js']}); }
    catch(error){errors.push({tabId:tab.id,error:String(error?.message||error).slice(0,140)});}
  }
  if(errors.length)await chrome.storage.local.set({captureInjectionErrors:errors.slice(0,12)});
  else await chrome.storage.local.remove('captureInjectionErrors');
  return scripts.map(s=>s.id);
}
async function captureHealth(payload,sender){
  const site=providerFromUrl(sender?.tab?.url||'');
  const settings=await getSettings();
  if(!site||!settings.capture?.[site]||site!==payload.platform)throw new Error('Capture status from an unapproved site');
  const status=String(payload.status||'');
  if(!HEALTH_STATES.has(status))throw new Error('Unknown capture status');
  const old=(await chrome.storage.local.get('captureHealth')).captureHealth||{};
  const record={...old,[site]:{
    status,detail:String(payload.detail||'').slice(0,140),
    count:Math.min(Math.max(Number(payload.count)||0,0),MAX_CHAT_MESSAGES),
    checkedAt:new Date().toISOString(),tabId:sender.tab.id
  }};
  await chrome.storage.local.set({captureHealth:record});
  return {recorded:true};
}
async function captureOpenTabs(){
  const ids=await syncCaptureScripts();
  const config=await getSettings();
  const tabs=(await chrome.tabs.query({})).filter(t=>t.id && providerFromUrl(t.url||'') && config.capture?.[providerFromUrl(t.url||'')]);
  const results=[];
  for(const tab of tabs){
    const platform=providerFromUrl(tab.url);
    try {
      // First, a registered script will auto-inject into new pages; this
      // request triggers a fresh check in already-open conversations.
      try{ await chrome.scripting.executeScript({target:{tabId:tab.id},files:['src/content/capture.js']}); }
      catch(error){ throw new Error(`Cannot inject capture script: ${error.message||error}`); }
      const result=await chrome.tabs.sendMessage(tab.id,{type:'VEYRA_CAPTURE_NOW'});
      results.push({platform,status:result?.status||'unknown',count:result?.count||0});
    }catch(error){
      const detail=String(error.message||error).slice(0,140);
      const old=(await chrome.storage.local.get('captureHealth')).captureHealth||{};
      await chrome.storage.local.set({captureHealth:{...old,[platform]:{status:'error',detail,checkedAt:new Date().toISOString(),tabId:tab.id}}});
      results.push({platform,status:'error',reason:detail});
    }
  }
  return {ids,tabs:results};
}

async function scheduleExport() {
  if(!(await chrome.alarms.get(EXPORT_ALARM))) await chrome.alarms.create(EXPORT_ALARM,{when:Date.now()+60000});
}
async function saveChat(payload,sender) {
  const source=sender?.tab?.url||'';
  const site=providerFromUrl(source),config=await getSettings();
  if(!site || !config.capture?.[site] || payload.platform!==site) throw new Error('Capture not enabled for this site');
  if(!payload.url || hostOf(payload.url)!==hostOf(source)) throw new Error('Invalid source URL');
  // A React SPA can render turns before assigning a permanent conversation URL.
  const canonicalId=archiveId(payload.url);
  const draftId=`draft:${site}:${sender.tab.id}`;
  const id=canonicalId||draftId;
  const url=normalizeUrl(payload.url);
  const messages=normalizeMessages(payload.messages);
  if(!messages.length) return {skipped:true,reason:'No visible messages'};
  const previous=await dbGet('chats',id);
  const oldDraft=canonicalId ? await dbGet('chats',draftId) : null;
  const starting=previous?.messages||oldDraft?.messages||[];
  const result=mergeCapturedMessages(starting,messages);
  if(result.reason==='unanchored')return {skipped:true,reason:'Unanchored window',count:starting.length};
  if(result.reason==='archive-limit')return {skipped:true,reason:'Archive size limit reached; existing content preserved',count:starting.length};
  if(!result.changed && previous) return {skipped:true,reason:'Unchanged',count:starting.length};
  if(!result.messages.length) return {skipped:true,reason:'No visible messages'};
  const updatedAt=new Date().toISOString();
  const title=String(payload.title||site).slice(0,250);
  const archiveName=previous?.archiveName || (canonicalId ? chatArchiveName({url,title}) : `Draft-${site}-${sender.tab.id}.md`);
  await dbPut('chats',{id,url,platform:site,title,messages:result.messages,archiveName,createdAt:previous?.createdAt||oldDraft?.createdAt||updatedAt,updatedAt,draft:!canonicalId});
  if(canonicalId && oldDraft)await dbDelete('chats',draftId);
  await chrome.storage.local.set({captureEvent:{id,platform:site,updatedAt,count:result.messages.length}});
  if(config.exportMode==='downloads') await scheduleExport();
  return {saved:true,count:result.messages.length};
}
function queueChatSave(payload,sender) {
  // Multiple content scripts/tabs may update the SAME long conversation.
  // Serialize read/merge/write per URL to avoid lost updates in IndexedDB.
  const site=providerFromUrl(sender?.tab?.url||'');
  const key=archiveId(payload?.url)||`draft:${site}:${sender?.tab?.id}`;
  const pending=saveQueues.get(key)||Promise.resolve();
  const task=pending.catch(()=>{}).then(()=>saveChat(payload,sender));
  saveQueues.set(key,task);
  task.finally(()=>{if(saveQueues.get(key)===task)saveQueues.delete(key);}).catch(()=>{});
  return task;
}
function markdownDataUrl(content){
  // Chrome's downloads API can write a data URL to a relative Downloads path.
  return 'data:text/markdown;charset=utf-8;base64,'+btoa(unescape(encodeURIComponent(content)));
}
async function flushDownloads() {
  const settings=await getSettings();
  if(settings.exportMode!=='downloads' || !await chrome.permissions.contains({permissions:['downloads']}))return {skipped:true};
  const dir=cleanDownloadsFolder(settings.downloadsFolder);
  if(!dir)throw new Error('Invalid Downloads subfolder');
  const [chats,receipts]=await Promise.all([dbAll('chats'),dbAll('receipts')]);
  const byId=new Map(receipts.map(x=>[x.id,x]));
  let started=0, pending=false;
  outer: for(const chat of chats.filter(x=>!x.draft).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt))){
    const parts=markdownParts(chat);
    for(let index=0;index<parts.length;index++) {
      const part=parts[index];
      const key=`download:${chat.id}:${index+1}`;
      const receipt=byId.get(key);
      const destination=downloadFilename({...chat,archiveName:part.filename},dir);
      if(receipt?.updatedAt===chat.updatedAt && receipt.filePath===destination && receipt.status==='complete')continue;
      if(receipt?.updatedAt===chat.updatedAt && receipt.filePath===destination && receipt.status==='pending') {
        const matches=await chrome.downloads.search({id:receipt.downloadId});
        if(matches[0]?.state==='in_progress'){pending=true;continue;}
        if(matches[0]?.state==='complete') {
          await dbPut('receipts',{...receipt,status:'complete'});continue;
        }
      }
      const downloadId=await chrome.downloads.download({url:markdownDataUrl(part.content),filename:destination,saveAs:false,conflictAction:'overwrite'});
      await dbPut('receipts',{id:key,updatedAt:chat.updatedAt,status:'pending',downloadId,filePath:destination});
      started++;pending=true;
      if(started>=8)break outer;
    }
  }
  if(started>=8 || pending) await scheduleExport();
  await chrome.storage.local.set({exportStatus:{mode:'downloads',started,updatedAt:new Date().toISOString()}});
  return {started};
}

async function review() {
  const settings=await getSettings();
  const activity=settings.activity||{};
  const tabs=(await chrome.tabs.query({})).filter(isWebTab).map(t=>({...t,lastAccessed:activity[normalizeUrl(t.url)]||undefined}));
  const suggestions=buildSuggestions(tabs,settings.dismissed||{});
  const result={createdAt:Date.now(),suggestions};
  if(settings.layaEnabled && suggestions.length) {
    let checked=0;
    for(const item of suggestions.slice(0,3)) {
      try {
        const decision=await layaKeepSuggestion(item);
        item.laya=decision;checked++;
      } catch {break;}
    }
    result.layaChecked=checked;
  }
  await chrome.storage.local.set({review:result});
  return result;
}
async function snapshot() {
  const settings=await getSettings();
  const [tabs,bookmarkTree,chats,clips]=await Promise.all([
    chrome.tabs.query({}),chrome.bookmarks.getTree(),dbAll('chats'),dbAll('clips')
  ]);
  return {tabs,bookmarkTree,chats:chats.map(({messages,...rest})=>({...rest,messageCount:messages.length})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),clips:clips.map(x=>({...x,text:x.text.slice(0,220)})).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)),settings};
}
async function importBackup(data) {
  if(data?.format!=='veyra-backup-v1') throw new Error('Unsupported backup format');
  let chatCount=0,clipCount=0;
  for(const item of (Array.isArray(data.chats)?data.chats:[]).slice(0,2000)) {
    if(!item.url || !Array.isArray(item.messages) || !normalizeUrl(item.url)) continue;
    const messages=item.messages.slice(0,MAX_CHAT_MESSAGES).filter(m=>['user','assistant'].includes(m?.role)&&typeof m?.text==='string')
      .map(m=>({role:m.role,text:m.text.slice(0,128000),...(typeof m.sourceId==='string'?{sourceId:m.sourceId.slice(0,180)}:{})}));
    if(messages.some(m=>m.text)&&messages.reduce((n,m)=>n+m.text.length,0)<=MAX_CHAT_CHARS){
      await dbPut('chats',{id:`chat:${normalizeUrl(item.url)}`,url:normalizeUrl(item.url),platform:providerFromUrl(item.url)||'other',title:String(item.title||'Imported conversation').slice(0,250),messages,createdAt:item.createdAt||new Date().toISOString(),updatedAt:item.updatedAt||new Date().toISOString()});chatCount++;
    }
  }
  for(const item of (Array.isArray(data.clips)?data.clips:[]).slice(0,5000)) {
    if(typeof item.text!=='string') continue;
    await dbPut('clips',{id:crypto.randomUUID(),title:String(item.title||'Clip').slice(0,250),url:normalizeUrl(item.url)||'',text:item.text.slice(0,16000),savedAt:new Date().toISOString()});clipCount++;
  }
  // Imported backups must never silently enable site access, capture or a model endpoint.
  if(['fa','en'].includes(data?.settings?.language)||['light','dark','system'].includes(data?.settings?.theme)) {
    const settings=await getSettings();
    await patchSettings({language:['fa','en'].includes(data?.settings?.language)?data.settings.language:settings.language,theme:['light','dark','system'].includes(data?.settings?.theme)?data.settings.theme:settings.theme,tabCategories:Array.isArray(data?.settings?.tabCategories)?sanitizeCategories(data.settings.tabCategories):settings.tabCategories,tabSort:TAB_SORTS.includes(data?.settings?.tabSort)?data.settings.tabSort:settings.tabSort,tabAssignments:typeof data?.settings?.tabAssignments==='object'&&!Array.isArray(data.settings.tabAssignments)?Object.fromEntries(Object.entries(data.settings.tabAssignments).filter(([url,id])=>normalizeUrl(url) && sanitizeCategories(data?.settings?.tabCategories??settings.tabCategories).some(c=>c.id===id)).slice(0,2500)):settings.tabAssignments});
  }
  return {chatCount,clipCount};
}
async function handle(message,sender) {
  switch(message?.type) {
    case 'TAB_ASSIGN': {
      if(!isTrustedDashboardSender(sender,chrome.runtime))throw new Error('Open Veyra in its New Tab dashboard to manage Chrome tabs');
      const tab=await chrome.tabs.get(Number(message.tabId));
      if(!isWebTab(tab))throw new Error('Not a web tab');
      const settings=await getSettings();
      const assignments=assignUrlCategory(settings.tabAssignments,tab.url,message.categoryId,settings.tabCategories);
      return {settings:await patchSettings({tabAssignments:assignments})};
    }
    case 'TAB_CATEGORIES': {
      if(!isTrustedDashboardSender(sender,chrome.runtime))throw new Error('Open Veyra in its New Tab dashboard to manage Chrome tabs');
      const categories=sanitizeCategories(message.categories);
      if(!categories.length)throw new Error('At least one category is required');
      return {settings:await patchSettings({tabCategories:categories})};
    }
    case 'TAB_SORT': {
      if(!isTrustedDashboardSender(sender,chrome.runtime))throw new Error('Open Veyra in its New Tab dashboard to manage Chrome tabs');
      if(!TAB_SORTS.includes(message.sort))throw new Error('Invalid tab sorting mode');
      return {settings:await patchSettings({tabSort:message.sort})};
    }
    case 'TAB_GROUP_CHROME':
    case 'TAB_REORDER_CHROME':
    case 'TAB_ORGANIZE_CHROME': {
      if(!isTrustedDashboardSender(sender,chrome.runtime))throw new Error('Open Veyra in its New Tab dashboard to manage Chrome tabs');
      const settings=await getSettings();
      const mode=message.type==='TAB_GROUP_CHROME'?'group':message.type==='TAB_REORDER_CHROME'?'sort':'both';
      const result=await organizeChromeTabs(chrome,settings,{mode,categoryId:message.categoryId});
      await chrome.storage.local.set({tabOrganizationReport:{...result,at:new Date().toISOString(),mode}});
      return result;
    }
    case 'TAB_AUTO_ORGANIZE': {
      if(!isTrustedDashboardSender(sender,chrome.runtime))throw new Error('Open Veyra in its New Tab dashboard to manage Chrome tabs');
      const enabled=message.enabled===true;
      const settings=await patchSettings({autoOrganizeTabs:enabled});
      const result=enabled?await organizeChromeTabs(chrome,settings,{mode:'both'}):null;
      if(result)await chrome.storage.local.set({tabOrganizationReport:{...result,at:new Date().toISOString(),mode:'auto'}});
      return {settings,result};
    }
    case 'SNAPSHOT': return snapshot();
    case 'SAVE_CHAT': return queueChatSave(message.payload||{},sender);
    case 'CAPTURE_HEALTH': return captureHealth(message,sender);
    case 'GET_REVIEW': return review();
    case 'SETTINGS': return patchSettings(message.patch||{});
    case 'SYNC_CAPTURE': return {ids:await syncCaptureScripts()};
    case 'CAPTURE_OPEN_TABS': return captureOpenTabs();
    case 'GET_EXPORT_QUEUE': {
      const [chats,receipts]=await Promise.all([dbAll('chats'),dbAll('receipts')]);
      const map=new Map(receipts.filter(x=>x.id.startsWith('folder:')).map(x=>[x.id,x]));
      const directoryId=String(message.directoryId||'').slice(0,64);
      if(!directoryId)throw new Error('Missing destination');
      return {chats:chats.filter(c=>!c.draft && (map.get(`folder:${c.id}`)?.updatedAt!==c.updatedAt || map.get(`folder:${c.id}`)?.directoryId!==directoryId)).slice(0,8)};
    }
    case 'ACK_FOLDER_EXPORT': {
      const chat=await dbGet('chats',message.id);
      if(!chat||chat.updatedAt!==message.updatedAt || !message.directoryId) return {acknowledged:false};
      await dbPut('receipts',{id:`folder:${chat.id}`,updatedAt:chat.updatedAt,directoryId:String(message.directoryId).slice(0,64),status:'complete'});
      return {acknowledged:true};
    }
    case 'FLUSH_DOWNLOADS': return flushDownloads();
    case 'GET_CHAT': return dbGet('chats',message.id);
    case 'DELETE_CHAT': if(!isTrustedDashboardSender(sender,chrome.runtime))throw new Error('Deleting a chat requires the Veyra New Tab dashboard');await dbDelete('chats',message.id);return {deleted:true};
    case 'DELETE_CLIP': if(!isTrustedDashboardSender(sender,chrome.runtime))throw new Error('Deleting a clip requires the Veyra New Tab dashboard');await dbDelete('clips',message.id);return {deleted:true};
    case 'DECISION': if(!isTrustedDashboardSender(sender,chrome.runtime))throw new Error('Recording a decision requires the Veyra New Tab dashboard');{
      const settings=await getSettings();
      const dismissed={...(settings.dismissed||{}),[message.id]:Date.now()+7*86400000};
      await patchSettings({dismissed});
      await dbPut('decisions',{id:crypto.randomUUID(),item:message.id,answer:message.answer==='yes'?'yes':'no',date:new Date().toISOString()});
      return {saved:true};
    }
    case 'RTL_SITE': {
      const tab=await chrome.tabs.get(message.tabId);
      if(!isWebTab(tab)) throw new Error('Not a web page');
      const origin=new URL(tab.url).origin;
      if(!await chrome.permissions.contains({origins:[`${origin}/*`]})) throw new Error('Site permission required');
      const s=await getSettings();const rtlSites={...s.rtlSites,[origin]:Boolean(message.enabled)};
      await patchSettings({rtlSites});
      await chrome.scripting.executeScript({target:{tabId:tab.id},func:rtlOnPage,args:[Boolean(message.enabled)]});
      return {enabled:Boolean(message.enabled)};
    }
    case 'EXPORT': {
      const [chats,clips]=await Promise.all([dbAll('chats'),dbAll('clips')]);
      const settings=await getSettings();
      return {format:'veyra-backup-v1',exportedAt:new Date().toISOString(),chats,clips,settings:{language:settings.language,theme:settings.theme,tabCategories:settings.tabCategories,tabAssignments:settings.tabAssignments,tabSort:settings.tabSort,autoOrganizeTabs:settings.autoOrganizeTabs}};
    }
    case 'IMPORT': if(!isTrustedDashboardSender(sender,chrome.runtime))throw new Error('Importing a backup requires the Veyra New Tab dashboard');return importBackup(message.data);
    default: throw new Error('Unsupported message');
  }
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  handle(message,sender).then(data=>reply({ok:true,data})).catch(error=>reply({ok:false,error:String(error?.message||error)}));
  return true;
});
chrome.runtime.onInstalled.addListener(async()=>{
  await chrome.alarms.create('veyra-review',{periodInMinutes:10});
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({id:'veyra-clip',title:'Save selection to Veyra',contexts:['selection']});
  chrome.contextMenus.create({id:'veyra-link',title:'Save link to Veyra',contexts:['link']});
  await syncCaptureScripts(); await scheduleExport(); await updateBadge();
});
chrome.runtime.onStartup.addListener(()=>{chrome.alarms.create('veyra-review',{periodInMinutes:10});syncCaptureScripts().catch(error=>console.warn('[Veyra] Capture registration:',error));scheduleExport().catch(()=>{});updateBadge();});
chrome.permissions.onRemoved.addListener(removed=>{if(removed.origins?.length)syncCaptureScripts().catch(error=>console.warn('[Veyra] Permission changed:',error));});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='veyra-tab-auto')getSettings().then(s=>s.autoOrganizeTabs?organizeChromeTabs(chrome,s,{mode:'both'}):null).then(r=>r&&chrome.storage.local.set({tabOrganizationReport:{...r,at:new Date().toISOString(),mode:'auto'}})).catch(error=>console.warn('[Veyra] Tab organization:',error));if(a.name==='veyra-review') review().catch(()=>{});if(a.name===EXPORT_ALARM)flushDownloads().catch(error=>chrome.storage.local.set({exportStatus:{error:String(error.message||error),updatedAt:new Date().toISOString()}}));});
chrome.downloads?.onChanged?.addListener(async delta=>{if(!delta.state?.current)return;try {const entries=await dbAll('receipts');for(const entry of entries){if(entry.downloadId!==delta.id || entry.status!=='pending')continue;await dbPut('receipts',{...entry,status:delta.state.current==='complete'?'complete':'interrupted'});}}catch(error){console.warn('[Veyra] Download completion tracking:',error);}});
chrome.contextMenus.onClicked.addListener(async(info,tab)=>{
  const text=info.menuItemId==='veyra-clip'?info.selectionText:info.linkUrl;
  if(!text) return;
  await dbPut('clips',{id:crypto.randomUUID(),title:String(tab?.title||'Saved item').slice(0,250),url:normalizeUrl(tab?.url)||'',text:String(text).slice(0,16000),savedAt:new Date().toISOString()});
});
async function rememberActivity(tabId) {
  try {
    const t=await chrome.tabs.get(tabId);
    if(!isWebTab(t)) return;
    const s=await getSettings(); const activity={...(s.activity||{})};
    activity[normalizeUrl(t.url)]=Date.now();
    // Only keep the newest 500 observations.
    const sorted=Object.entries(activity).sort((a,b)=>b[1]-a[1]).slice(0,500);
    await patchSettings({activity:Object.fromEntries(sorted)});
  }catch{}
}
async function scheduleTabOrganization(){const settings=await getSettings();if(settings.autoOrganizeTabs)await chrome.alarms.create('veyra-tab-auto',{when:Date.now()+5000});}
chrome.tabs.onActivated.addListener(({tabId})=>rememberActivity(tabId).catch(()=>{}));
chrome.tabs.onCreated.addListener(()=>{updateBadge();scheduleTabOrganization().catch(()=>{});});
chrome.tabs.onRemoved.addListener(()=>updateBadge());
chrome.tabs.onUpdated.addListener((id,change,tab)=>{
  if(change.url){updateBadge();rememberActivity(id).catch(()=>{});scheduleTabOrganization().catch(()=>{});}
  if(change.status==='complete' && isWebTab(tab)) {
    scheduleTabOrganization().catch(()=>{});
    applyRtl(id,tab.url).catch(()=>{});
    // Recover from a stale dynamic registration without requiring user action.
    getSettings().then(s=>{const site=providerFromUrl(tab.url);if(!site||!s.capture?.[site])return;return chrome.scripting.executeScript({target:{tabId:id},files:['src/content/capture.js']});}).catch(error=>console.warn('[Veyra] Chat injection:',error));
  }
});
updateBadge();
