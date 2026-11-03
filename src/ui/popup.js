import {applyTheme, resolveTheme, normalizeTheme} from './appearance.js';
import {PROVIDERS, providerFromUrl} from '../core.js';
const $=selector=>document.querySelector(selector);
const dict={
  en:{caption:'A calmer place for everything in your browser.',open:'Open workspace',save:'Bookmark current tab',success:'Saved to Chrome bookmarks',error:'Not a web page',toDark:'Switch to dark mode',toLight:'Switch to light mode',failed:'Could not save appearance',captureChat:'Start saving this AI chat',captureDone:'Capture ready. New messages will be saved locally.',captureStatus:'Capture check: ',capturePermission:'Site access was not granted'},
  fa:{caption:'همه چیز در مرورگر، مرتب و یک‌جا.',open:'باز کردن فضای کاری',save:'نشانک کردن تب فعلی',success:'در نشانک‌های کروم ذخیره شد',error:'این صفحه وب نیست',toDark:'فعال‌سازی حالت شب',toLight:'فعال‌سازی حالت روشن',failed:'تنظیم ظاهر ذخیره نشد',captureChat:'شروع ذخیره خودکار این گفتگو',captureDone:'ضبط فعال شد. پیام‌های جدید محلی ذخیره می‌شوند.',captureStatus:'وضعیت ضبط: ',capturePermission:'مجوز دسترسی سایت داده نشد'}
};
let settings={language:'en',theme:'system'};
let activeChatTab=null;let activeProvider=null;
const media=window.matchMedia('(prefers-color-scheme: dark)');
function render(){
 const language=settings.language==='fa'?'fa':'en';
 document.documentElement.lang=language;document.documentElement.dir=language==='fa'?'rtl':'ltr';
 const effective=applyTheme(settings.theme,{systemDark:media.matches});
 $('#caption').textContent=dict[language].caption;
 $('#openLabel').textContent=dict[language].open;
 $('#saveLabel').textContent=dict[language].save;
 $('#captureChatLabel').textContent=dict[language].captureChat;
 $('#captureChat').hidden=!activeProvider;
 const themeLabel=effective==='dark'?dict[language].toLight:dict[language].toDark;
 $('#themeLabel').textContent=themeLabel;
 $('#themeToggle').setAttribute('aria-label',themeLabel);
 $('#themeToggle').setAttribute('aria-pressed',String(effective==='dark'));
}
media.addEventListener('change',()=>{if(normalizeTheme(settings.theme)==='system')render()});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.settings?.newValue){settings={...settings,...changes.settings.newValue};render()}});
(async()=>{try{settings={...settings,...(await chrome.storage.local.get('settings')).settings};const [tab]=await chrome.tabs.query({active:true,currentWindow:true});activeChatTab=tab;activeProvider=providerFromUrl(tab?.url||'');}catch{}render()})();
$('#open').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('src/ui/newtab.html')}));
$('#themeToggle').addEventListener('click',async()=>{
 const effective=resolveTheme(settings.theme,media.matches), next=effective==='dark'?'light':'dark';
 try{const result=await chrome.runtime.sendMessage({type:'SETTINGS',patch:{theme:next}});if(!result?.ok)throw new Error(result?.error||'Failed');settings={...settings,...result.data};render()}
 catch{$('#status').textContent=dict[settings.language==='fa'?'fa':'en'].failed}
});
$('#save').addEventListener('click',async()=>{
 const language=settings.language==='fa'?'fa':'en';
 try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!/^https?:\/\//.test(tab?.url||''))throw new Error(dict[language].error);await chrome.bookmarks.create({title:tab.title||tab.url,url:tab.url});$('#status').textContent=dict[language].success;}
 catch(e){$('#status').textContent=e.message;}
});

$('#captureChat').addEventListener('click',async()=>{
 const language=settings.language==='fa'?'fa':'en';
 if(!activeChatTab?.id||!activeProvider)return;
 const button=$('#captureChat');button.disabled=true;
 try{
  // Request only the site the user is viewing, not permissions for all AI sites.
  const provider=PROVIDERS[activeProvider];
  const match=provider.matches.find(pattern=>activeChatTab.url.startsWith(pattern.replace(/\*$/,'')));
  if(!match)throw new Error('Unsupported URL');
  const permission=await chrome.permissions.request({origins:[match]});
  if(!permission)throw new Error(dict[language].capturePermission);
  const patch={capture:{...(settings.capture||{}),[activeProvider]:true}};
  const saved=await chrome.runtime.sendMessage({type:'SETTINGS',patch});
  if(!saved?.ok)throw new Error(saved?.error||'Could not enable capture');
  settings={...settings,...saved.data};
  const scripts=await chrome.runtime.sendMessage({type:'SYNC_CAPTURE'});
  if(!scripts?.ok)throw new Error(scripts?.error||'Could not register capture');
  const result=await chrome.runtime.sendMessage({type:'CAPTURE_OPEN_TABS'});
  if(!result?.ok)throw new Error(result?.error||'Could not check capture');
  const tabResult=result.data?.tabs?.find(x=>x.platform===activeProvider);
  $('#status').textContent=dict[language].captureDone+(tabResult?' '+dict[language].captureStatus+tabResult.status:'');
 }catch(error){$('#status').textContent=String(error?.message||error)}
 finally{button.disabled=false}
});
