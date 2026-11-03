const status=document.querySelector('#status');
const dict={en:{caption:'A calmer place for everything in your browser.',open:'Open workspace',save:'Bookmark current tab',success:'Saved to Chrome bookmarks',error:'Not a web page'},fa:{caption:'همه چیز در مرورگر، مرتب و یک‌جا.',open:'باز کردن فضای کاری',save:'نشانک کردن تب فعلی',success:'در نشانک‌های کروم ذخیره شد',error:'این صفحه وب نیست'}};
let language='en';
(async()=>{try{language=(await chrome.storage.local.get('settings')).settings?.language==='fa'?'fa':'en'}catch{}
 document.documentElement.lang=language;document.documentElement.dir=language==='fa'?'rtl':'ltr';
 document.querySelector('#caption').textContent=dict[language].caption;
 document.querySelector('#openLabel').textContent=dict[language].open;
 document.querySelector('#saveLabel').textContent=dict[language].save;})();
document.querySelector('#open').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('src/ui/newtab.html')}));
document.querySelector('#save').addEventListener('click',async()=>{
 try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!/^https?:\/\//.test(tab?.url||''))throw new Error(dict[language].error);await chrome.bookmarks.create({title:tab.title||tab.url,url:tab.url});status.textContent=dict[language].success;}
 catch(e){status.textContent=e.message;}
});
