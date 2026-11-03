import { buildSuggestions, isWebTab, normalizeUrl, hostOf, PROVIDERS, providerFromUrl } from './core.js';
import { dbAll, dbGet, dbPut, dbDelete } from './db.js';
import { layaKeepSuggestion } from './laya.js';
import { updateBadge } from './vendor/tabout-badge.js';
import { archiveId, isConversationUrl, chatArchiveName, cleanDownloadsFolder, downloadFilename } from './archive.js';
import { toMarkdown } from './core.js';

const DEFAULTS={language:'en',theme:'system',capture:{},layaEnabled:false,autoReview:true,rtlSites:{},dismissed:{},activity:{},exportMode:'local',downloadsFolder:'Veyra/AI-Chats'};
const EXPORT_ALARM='veyra-export';
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
  // Dynamic registrations apply to future document loads; already-open AI tabs
  // must be injected immediately after a user grants permission.
  const tabs=await chrome.tabs.query({});
  for(const tab of tabs){
    if(!tab.id || !tab.url)continue;
    if(!scripts.some(script=>script.matches.some(pattern=>tab.url.startsWith(pattern.slice(0,-1)))))continue;
    try { await chrome.scripting.executeScript({target:{tabId:tab.id},files:['src/content/capture.js']}); }
    catch { /* Protected tabs, discarded tabs, or navigations may reject injection. */ }
  }
  return scripts.map(s=>s.id);
}
async function scheduleExport() {
  if(!(await chrome.alarms.get(EXPORT_ALARM))) await chrome.alarms.create(EXPORT_ALARM,{when:Date.now()+60000});
}
async function saveChat(payload,sender) {
  const source=sender?.tab?.url||'';
  const site=providerFromUrl(source),config=await getSettings();
  if(!site || !config.capture?.[site] || payload.platform!==site) throw new Error('Capture not enabled for this site');
  if(!payload.url || hostOf(payload.url)!==hostOf(source)) throw new Error('Invalid source URL');
  const id=archiveId(payload.url);
  if(!id || !isConversationUrl(payload.url,site)) return {skipped:true,reason:'Conversation URL not assigned yet'};
  const url=normalizeUrl(payload.url);
  const raw=Array.isArray(payload.messages)?payload.messages.slice(0,600):[];
  const messages=raw.filter(m=>['user','assistant'].includes(m?.role) && typeof m.text==='string' && m.text.trim())
    .map(m=>({role:m.role,text:m.text.trim().slice(0,16000)}));
  if(!messages.length) return {skipped:true,reason:'No visible messages'};
  let length=0;
  const safe=messages.filter(m=>(length+=m.text.length)<=250000);
  if(!safe.length) return {skipped:true,reason:'Too large'};
  const previous=await dbGet('chats',id);
  if(previous && previous.messages.length>safe.length) return {skipped:true,reason:'Partial capture'};
  if(previous && JSON.stringify(previous.messages)===JSON.stringify(safe)) return {skipped:true,reason:'Unchanged'};
  const updatedAt=new Date().toISOString();
  const title=String(payload.title||site).slice(0,250);
  const archiveName=previous?.archiveName || chatArchiveName({url,title});
  await dbPut('chats',{id,url,platform:site,title,messages:safe,archiveName,createdAt:previous?.createdAt||updatedAt,updatedAt});
  await chrome.storage.local.set({captureEvent:{id,platform:site,updatedAt,count:safe.length}});
  if(config.exportMode==='downloads') await scheduleExport();
  return {saved:true,count:safe.length};
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
  let started=0;
  for(const chat of chats.sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt))){
    const key=`download:${chat.id}`,receipt=byId.get(key);
    const destination=downloadFilename(chat,dir);
    if(receipt?.updatedAt===chat.updatedAt && receipt.filePath===destination && receipt.status==='complete')continue;
    if(receipt?.updatedAt===chat.updatedAt && receipt.filePath===destination && receipt.status==='pending') {
      const matches=await chrome.downloads.search({id:receipt.downloadId});
      if(matches[0]?.state==='in_progress')continue;
      if(matches[0]?.state==='complete') {
        await dbPut('receipts',{...receipt,status:'complete'});continue;
      }
    }
    const text=toMarkdown(chat);
    if(text.length>300000)continue; // never create huge data URLs
    const downloadId=await chrome.downloads.download({url:markdownDataUrl(text),filename:destination,saveAs:false,conflictAction:'overwrite'});
    await dbPut('receipts',{id:key,updatedAt:chat.updatedAt,status:'pending',downloadId,filePath:destination});
    started++;
    if(started>=8)break;
  }
  // Recheck pending downloads even if a worker was suspended during completion.
  if(started===8 || byId.size) await scheduleExport();
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
    const messages=item.messages.slice(0,600).filter(m=>['user','assistant'].includes(m?.role)&&typeof m?.text==='string')
      .map(m=>({role:m.role,text:m.text.slice(0,16000)}));
    if(messages.some(m=>m.text)&&messages.reduce((n,m)=>n+m.text.length,0)<=250000){
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
    await patchSettings({language:['fa','en'].includes(data?.settings?.language)?data.settings.language:settings.language,theme:['light','dark','system'].includes(data?.settings?.theme)?data.settings.theme:settings.theme});
  }
  return {chatCount,clipCount};
}
async function handle(message,sender) {
  switch(message?.type) {
    case 'SNAPSHOT': return snapshot();
    case 'SAVE_CHAT': return saveChat(message.payload||{},sender);
    case 'GET_REVIEW': return review();
    case 'SETTINGS': return patchSettings(message.patch||{});
    case 'SYNC_CAPTURE': return {ids:await syncCaptureScripts()};
    case 'CAPTURE_OPEN_TABS': {
      const ids=await syncCaptureScripts();
      return {ids,requested:true};
    }
    case 'GET_EXPORT_QUEUE': {
      const [chats,receipts]=await Promise.all([dbAll('chats'),dbAll('receipts')]);
      const map=new Map(receipts.filter(x=>x.id.startsWith('folder:')).map(x=>[x.id,x]));
      const directoryId=String(message.directoryId||'').slice(0,64);
      if(!directoryId)throw new Error('Missing destination');
      return {chats:chats.filter(c=>map.get(`folder:${c.id}`)?.updatedAt!==c.updatedAt || map.get(`folder:${c.id}`)?.directoryId!==directoryId).slice(0,8)};
    }
    case 'ACK_FOLDER_EXPORT': {
      const chat=await dbGet('chats',message.id);
      if(!chat||chat.updatedAt!==message.updatedAt || !message.directoryId) return {acknowledged:false};
      await dbPut('receipts',{id:`folder:${chat.id}`,updatedAt:chat.updatedAt,directoryId:String(message.directoryId).slice(0,64),status:'complete'});
      return {acknowledged:true};
    }
    case 'FLUSH_DOWNLOADS': return flushDownloads();
    case 'GET_CHAT': return dbGet('chats',message.id);
    case 'DELETE_CHAT': await dbDelete('chats',message.id);return {deleted:true};
    case 'DELETE_CLIP': await dbDelete('clips',message.id);return {deleted:true};
    case 'DECISION': {
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
      return {format:'veyra-backup-v1',exportedAt:new Date().toISOString(),chats,clips,settings:{language:settings.language,theme:settings.theme}};
    }
    case 'IMPORT': return importBackup(message.data);
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
chrome.runtime.onStartup.addListener(()=>{chrome.alarms.create('veyra-review',{periodInMinutes:10});syncCaptureScripts().catch(()=>{});scheduleExport().catch(()=>{});updateBadge();});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='veyra-review') review().catch(()=>{});if(a.name===EXPORT_ALARM)flushDownloads().catch(error=>chrome.storage.local.set({exportStatus:{error:String(error.message||error),updatedAt:new Date().toISOString()}}));});
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
chrome.tabs.onActivated.addListener(({tabId})=>rememberActivity(tabId).catch(()=>{}));
chrome.tabs.onCreated.addListener(()=>updateBadge());
chrome.tabs.onRemoved.addListener(()=>updateBadge());
chrome.tabs.onUpdated.addListener((id,change,tab)=>{
  if(change.url){updateBadge();rememberActivity(id).catch(()=>{});}
  if(change.status==='complete' && isWebTab(tab)) applyRtl(id,tab.url).catch(()=>{});
});
updateBadge();
