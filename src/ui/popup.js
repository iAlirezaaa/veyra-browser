import {applyTheme, resolveTheme, normalizeTheme} from './appearance.js';
const $=selector=>document.querySelector(selector);
const dict={
  en:{caption:'A calmer place for everything in your browser.',open:'Open workspace',save:'Bookmark current tab',success:'Saved to Chrome bookmarks',error:'Not a web page',toDark:'Switch to dark mode',toLight:'Switch to light mode',failed:'Could not save appearance'},
  fa:{caption:'همه چیز در مرورگر، مرتب و یک‌جا.',open:'باز کردن فضای کاری',save:'نشانک کردن تب فعلی',success:'در نشانک‌های کروم ذخیره شد',error:'این صفحه وب نیست',toDark:'فعال‌سازی حالت شب',toLight:'فعال‌سازی حالت روشن',failed:'تنظیم ظاهر ذخیره نشد'}
};
let settings={language:'en',theme:'system'};
const media=window.matchMedia('(prefers-color-scheme: dark)');
function render(){
 const language=settings.language==='fa'?'fa':'en';
 document.documentElement.lang=language;document.documentElement.dir=language==='fa'?'rtl':'ltr';
 const effective=applyTheme(settings.theme,{systemDark:media.matches});
 $('#caption').textContent=dict[language].caption;
 $('#openLabel').textContent=dict[language].open;
 $('#saveLabel').textContent=dict[language].save;
 const themeLabel=effective==='dark'?dict[language].toLight:dict[language].toDark;
 $('#themeLabel').textContent=themeLabel;
 $('#themeToggle').setAttribute('aria-label',themeLabel);
 $('#themeToggle').setAttribute('aria-pressed',String(effective==='dark'));
}
media.addEventListener('change',()=>{if(normalizeTheme(settings.theme)==='system')render()});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.settings?.newValue){settings={...settings,...changes.settings.newValue};render()}});
(async()=>{try{settings={...settings,...(await chrome.storage.local.get('settings')).settings}}catch{}render()})();
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
