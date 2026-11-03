import {groupTabs, buildSuggestions, normalizeUrl, hostOf, categoryFor, isWebTab, safeFilename, toMarkdown, PROVIDERS} from '../core.js';
import {titleFromDocumentTitle} from '../vendor/ltf-utils.js';
import {applyTheme, resolveTheme} from './appearance.js';
import {cleanDownloadsFolder} from '../archive.js';
import {groupedByCategory, tabCategory, DEFAULT_CATEGORIES, sanitizeCategories, newCategory, TAB_SORTS, orderedTabs} from '../tab-workspace.js';
import {chooseFolder, getChosenFolder, getFolderAccess, syncFolder as syncSelectedFolder} from './folder-sync.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words={
 en:{brandSubtitle:'Browser workspace',workspace:'WORKSPACE',overview:'Overview',tabs:'Open tabs',chats:'AI conversations',bookmarks:'Bookmarks',clips:'Saved clips',settings:'Settings',private:'Private by design',privateCaption:'Your archive stays on this device',space:'Personal space',yourSpace:'YOUR SPACE, REIMAGINED',subtitle:'Everything important, beautifully in its place.',search:'Search tabs, chats and bookmarks...',smartOverview:'SMART OVERVIEW',needsAttention:'Needs your attention',refresh:'Refresh',flow:'YOUR FLOW',activeSpaces:'Active spaces',viewAll:'View all',recentCaptures:'RECENT CAPTURES',chatLibrary:'AI chat library',browserManagement:'BROWSER MANAGEMENT',tabsHelp:'Browse domains, find duplicates, and bring order to your workspace.',reviewNow:'Review tabs',chatsHelp:'An offline library of the conversations you chose to save.',captureSettings:'Capture settings',bookmarkHelp:'Search existing Chrome bookmarks without moving or deleting them.',clipsHelp:'Select text or right-click a link and save it to Veyra.',settingsHelp:'A quiet interface, with control over every permission.',captureHelp:'Enable automatic capture for individual AI sites. Only visible conversations are saved, locally.',layaHelp:'Optional decision engine on your own computer. Suggestions only; never deletes items automatically.',enableLaya:'Enable local Laya',layaOffline:'Install and start Laya separately. No cloud API is used.',appearance:'Appearance & language',appearanceHelp:'Switch the interface instantly between Persian RTL and English LTR.',language:'Language',theme:'Theme',system:'System',light:'Light',dark:'Dark',themeToggle:'Toggle dark mode',color:'Color',chatRange:'Showing messages {start}–{end} of {total}',loadOlder:'Load 120 older messages',backup:'Backup & portability',backupHelp:'Export or restore chats and clips as an open JSON file.',export:'Export backup',import:'Import backup',history:'Recent history',historyHelp:'History access is optional and requires your permission.',showHistory:'Show recent history',downloadMarkdown:'Download Markdown',goodMorning:'Good morning. Stay focused.',goodAfternoon:'Good afternoon. Stay focused.',goodEvening:'Good evening. Stay focused.',statTabs:'open tabs',statDomains:'active domains',statChats:'saved conversations',statBookmarks:'bookmarks',noSuggestions:'Your workspace looks clear. No tab decisions need review.',suggestDuplicate:'Duplicate tab — review before closing',suggestStale:'Not used for over 7 days — consider archiving',yes:'Yes, archive',no:'No, keep',noData:'Nothing here yet.',noChats:'Enable capture for an AI service in Settings, then visit a conversation.',noClips:'Use the right-click menu on selected text or a link to save it here.',noTabs:'No matching web tabs.',noBookmarks:'No matching bookmarks.',open:'Open',save:'Bookmark',rtl:'RTL fields',close:'Close',delete:'Delete',captured:'Captured',messages:'messages',saved:'Saved',confirmClose:'Close this tab?',confirmDelete:'Permanently remove this local item?',confirmArchive:'Bookmark and close this tab?',success:'Saved successfully',failed:'Action failed',backupDone:'Backup exported',backupImported:'Backup imported',denied:'Permission was not granted',reviewed:'Review complete',closeWarning:'Closing tabs always requires your approval.',localLaya:'Laya suggestion',suggestKeep:'Suggested for review',cannotCapture:'This site has not been enabled for capture',openSource:'Open source',enable:'Enable',disable:'Disable',historyEmpty:'No recent history or permission was not granted.',enableAllCapture:'Enable automatic capture',captureOpenTabs:'Check open AI chats',captureConsent:'Capture requires your permission for each AI website. No chats are sent to a Veyra server.',captureOff:'Automatic capture is off. Enable it to start saving new AI conversations.',captureOn:'Capture active on {count} AI services.',lastCapture:'Last saved: {platform} · {date}',storageTitle:'Chat storage location',storageHelp:'Chats save immediately inside the browser. Optionally export Markdown files to a destination of your choice.',exportDestination:'Export destination',localOnly:'Browser only',downloadsMode:'Downloads subfolder (automatic)',customFolder:'Selected folder (sync while dashboard open)',downloadsSubfolder:'Downloads subfolder',savePath:'Save path',chooseFolder:'Choose folder…',syncFolder:'Sync now',folderCaution:'Selected folders sync only while Veyra is open and folder access is granted. Downloads exports work while Chrome runs.',localStorageStatus:'Stored locally in this browser.',downloadsStatus:'Automatic export to Downloads/{folder}.',folderMissing:'Choose a folder to enable syncing.',folderGranted:'Selected folder: {folder}. Pending chats sync automatically while Veyra is open.',folderDenied:'Folder access expired. Choose the folder again.',folderSyncDone:'Folder sync complete ({count} updated).',badPath:'Use a relative Downloads subfolder such as Veyra/AI-Chats; no absolute paths or ..',folderUnsupported:'This Chrome version does not support choosing a local folder.',permissionNeeded:'Browser permission is needed to enable this feature.',captureDebug:'Capture health',captureWorking:'Last detected {date} · {count} messages',captureWaiting:'Waiting for a conversation URL',captureNoMessages:'No messages detected — the site layout may have changed',captureError:'Capture error: {detail}',captureCheck:'Checked {count} AI tabs. {saved} saved, {errors} errors.',captureNoTabs:'No enabled AI chat tabs are open.',organizeChrome:'Organize Chrome tabs',autoOrganize:'Auto-organize new tabs',organizeDone:'Organized {count} tabs into {groups} groups; {skipped} protected.',organizeFailed:'Organization incomplete: {detail}',organizeConfirm:'Organize tabs in Chrome now? Existing groups and pinned tabs are preserved.',organizeInactive:'No tab organization has run yet.',sortBy:'Dashboard sort',sortCategory:'Category',sortDomain:'Domain',sortTitle:'Title',sortRecent:'Recently active',sortBrowser:'Browser order',reorderChrome:'Reorder in Chrome',manageCategories:'Edit categories',groupChrome:'Create Chrome group',createCategory:'Add category',categoryName:'Category name',saveCategory:'Save',removeCategory:'Remove',categoryEditHelp:'Names and colors are saved locally; grouping does not close tabs.',confirmRemoveCategory:'Remove this category? Its tabs will fall back to automatic categories.',confirmReorder:'Rearrange ungrouped, unpinned tabs in the real Chrome windows?',categoryChanged:'Tab category updated',newCategoryName:'Enter a category name',categoryNotFound:'Category was not found',groupDone:'Grouped {count} tabs in Chrome.',sortDone:'Moved {count} tabs in Chrome.'},
 fa:{organizeChrome:'مرتب‌سازی واقعی در کروم',autoOrganize:'مرتب‌سازی خودکار تب‌های جدید',organizeDone:'{count} تب در {groups} گروه مرتب شد؛ {skipped} تب محافظت‌شده تغییر نکرد.',organizeFailed:'مرتب‌سازی ناقص: {detail}',organizeConfirm:'تب‌های کروم مرتب و دسته‌بندی شوند؟ تب‌های پین‌شده و گروه‌های قبلی دست‌نخورده می‌مانند.',organizeInactive:'هنوز مرتب‌سازی انجام نشده است.',brandSubtitle:'فضای کاری مرورگر',workspace:'فضای کاری',overview:'نمای کلی',tabs:'تب‌های باز',chats:'گفتگوهای هوش مصنوعی',bookmarks:'نشانک‌ها',clips:'ذخیره‌های سریع',settings:'تنظیمات',private:'حریم خصوصی در اولویت',privateCaption:'آرشیو فقط روی دستگاه شماست',space:'فضای شخصی',yourSpace:'فضایی تازه برای مرورگر',subtitle:'همه چیزهای مهم، مرتب و در دسترس.',search:'جستجو در تب‌ها، گفتگوها و نشانک‌ها...',smartOverview:'مرور هوشمند',needsAttention:'نیازمند بررسی شما',refresh:'به‌روزرسانی',flow:'جریان کاری شما',activeSpaces:'فضاهای فعال',viewAll:'مشاهده همه',recentCaptures:'ذخیره‌های اخیر',chatLibrary:'آرشیو گفتگوها',browserManagement:'مدیریت مرورگر',tabsHelp:'تب‌ها را بر اساس دامنه ببینید و موارد تکراری را مدیریت کنید.',reviewNow:'بررسی تب‌ها',chatsHelp:'کتابخانه محلی مکالمه‌هایی که اجازه ذخیره آن‌ها را داده‌اید.',captureSettings:'تنظیم ضبط گفتگو',bookmarkHelp:'جستجو در نشانک‌های فعلی کروم بدون جابه‌جایی یا حذف.',clipsHelp:'متنی را انتخاب کنید یا روی لینک راست‌کلیک کنید و در ویرا ذخیره کنید.',settingsHelp:'رابط ساده، با کنترل روشن برای هر دسترسی.',captureHelp:'ضبط خودکار را برای هر سرویس جداگانه فعال کنید. فقط گفتگوی قابل مشاهده، به‌صورت محلی ذخیره می‌شود.',layaHelp:'موتور تصمیم‌گیری اختیاری روی کامپیوتر خودتان. فقط پیشنهاد می‌دهد و هرگز خودکار حذف نمی‌کند.',enableLaya:'فعال‌سازی لایای محلی',layaOffline:'لایا را جداگانه نصب و اجرا کنید. از API ابری استفاده نمی‌شود.',appearance:'ظاهر و زبان',appearanceHelp:'تغییر فوری بین فارسی راست‌چین و انگلیسی چپ‌چین.',language:'زبان',theme:'ظاهر',system:'سیستم',light:'روشن',dark:'تیره',themeToggle:'تغییر حالت شب',color:'رنگ',chatRange:'نمایش پیام‌های {start} تا {end} از {total}',loadOlder:'نمایش ۱۲۰ پیام قدیمی‌تر',backup:'پشتیبان‌گیری و جابه‌جایی',backupHelp:'خروجی یا بازیابی گفتگوها و ذخیره‌ها در قالب JSON آزاد.',export:'گرفتن پشتیبان',import:'بازیابی پشتیبان',history:'تاریخچه اخیر',historyHelp:'دسترسی به تاریخچه اختیاری است و به اجازه شما نیاز دارد.',showHistory:'نمایش تاریخچه اخیر',downloadMarkdown:'دریافت Markdown',goodMorning:'صبح به‌خیر. با تمرکز ادامه بده.',goodAfternoon:'ظهر به‌خیر. با تمرکز ادامه بده.',goodEvening:'عصر به‌خیر. با تمرکز ادامه بده.',statTabs:'تب باز',statDomains:'دامنه فعال',statChats:'گفتگوی ذخیره‌شده',statBookmarks:'نشانک',noSuggestions:'فضای کاری مرتب است؛ پیشنهادی برای بررسی نداریم.',suggestDuplicate:'تب تکراری — قبل از بستن بررسی کنید',suggestStale:'بیش از هفت روز استفاده نشده — می‌توانید آرشیوش کنید',yes:'بله، آرشیو',no:'نه، نگه‌دار',noData:'فعلاً چیزی در این بخش نیست.',noChats:'از تنظیمات، ضبط یکی از سرویس‌ها را فعال کنید و وارد صفحه گفتگو شوید.',noClips:'با راست‌کلیک روی متن انتخاب‌شده یا لینک، آن را اینجا ذخیره کنید.',noTabs:'تب وب مرتبطی پیدا نشد.',noBookmarks:'نشانک مرتبطی پیدا نشد.',open:'بازکردن',save:'نشانک',rtl:'راست‌چین ورودی',close:'بستن',delete:'حذف',captured:'ذخیره شده',messages:'پیام',saved:'ذخیره شد',confirmClose:'این تب بسته شود؟',confirmDelete:'این مورد محلی برای همیشه حذف شود؟',confirmArchive:'این تب نشانک‌گذاری و بسته شود؟',success:'با موفقیت انجام شد',failed:'عملیات ناموفق بود',backupDone:'فایل پشتیبان دریافت شد',backupImported:'فایل پشتیبان بازیابی شد',denied:'اجازه دسترسی داده نشد',reviewed:'بررسی انجام شد',closeWarning:'بستن تب‌ها نیازمند تأیید شماست.',localLaya:'پیشنهاد لایا',suggestKeep:'پیشنهاد برای بررسی',cannotCapture:'ضبط این سایت فعال نشده است',openSource:'متن‌باز',enable:'فعال',disable:'غیرفعال',historyEmpty:'تاریخچه‌ای دریافت نشد یا دسترسی داده نشده است.',enableAllCapture:'فعال‌سازی ذخیره خودکار چت‌ها',captureOpenTabs:'بررسی چت‌های باز',captureConsent:'ذخیره گفتگو برای هر سایت AI نیازمند اجازه شماست. داده‌ای به سرور ویرا فرستاده نمی‌شود.',captureOff:'ذخیره خودکار خاموش است. برای ضبط چت‌های جدید آن را فعال کنید.',captureOn:'ضبط چت در {count} سرویس هوش مصنوعی فعال است.',lastCapture:'آخرین ذخیره: {platform} · {date}',storageTitle:'مسیر ذخیره چت‌ها',storageHelp:'گفتگوها فوراً داخل مرورگر ذخیره می‌شوند. در صورت تمایل مسیر خروجی Markdown را انتخاب کنید.',exportDestination:'مقصد فایل‌های خروجی',localOnly:'فقط داخل مرورگر',downloadsMode:'زیرپوشه Downloads (خودکار)',customFolder:'پوشه دلخواه (همگام‌سازی با داشبورد باز)',downloadsSubfolder:'زیرپوشه Downloads',savePath:'ذخیره مسیر',chooseFolder:'انتخاب پوشه…',syncFolder:'همگام‌سازی اکنون',folderCaution:'پوشه دلخواه وقتی داشبورد ویرا باز است و اجازه دسترسی دارد همگام می‌شود. خروجی Downloads هنگام اجرای کروم خودکار است.',localStorageStatus:'در مرورگر محلی ذخیره می‌شود.',downloadsStatus:'خروجی خودکار در Downloads/{folder}.',folderMissing:'برای شروع، پوشه دلخواه را انتخاب کنید.',folderGranted:'پوشه انتخاب‌شده: {folder}. با باز بودن ویرا تغییرات خودکار همگام می‌شود.',folderDenied:'مجوز پوشه منقضی شده است؛ دوباره پوشه را انتخاب کنید.',folderSyncDone:'همگام‌سازی پوشه کامل شد ({count} مورد).',badPath:'زیرپوشه نسبی مثل Veyra/AI-Chats وارد کنید؛ مسیر مطلق یا .. مجاز نیست.',folderUnsupported:'انتخاب پوشه در این نسخه مرورگر پشتیبانی نمی‌شود.',permissionNeeded:'برای این قابلیت، اجازه دسترسی مرورگر ضروری است.',captureDebug:'وضعیت واقعی ذخیره',captureWorking:'آخرین دریافت {date} · {count} پیام',captureWaiting:'در انتظار ساخته‌شدن آدرس گفتگو',captureNoMessages:'پیامی پیدا نشد؛ احتمال تغییر ساختار سایت وجود دارد',captureError:'خطای ضبط: {detail}',captureCheck:'{count} تب بررسی شد؛ {saved} ذخیره و {errors} خطا.',captureNoTabs:'هیچ تب فعال هوش مصنوعی با اجازه ضبط باز نیست.',sortBy:'مرتب‌سازی',sortCategory:'دسته',sortDomain:'دامنه',sortTitle:'عنوان',sortRecent:'آخرین فعالیت',sortBrowser:'ترتیب مرورگر',reorderChrome:'مرتب‌کردن در کروم',manageCategories:'ویرایش دسته‌ها',groupChrome:'گروه‌بندی در کروم',createCategory:'ساخت دسته',categoryName:'نام دسته',saveCategory:'ذخیره',removeCategory:'حذف',categoryEditHelp:'نام و رنگ دسته‌ها محلی ذخیره می‌شود؛ گروه‌بندی تب‌ها را نمی‌بندد.',confirmRemoveCategory:'این دسته حذف شود؟ تب‌های آن به دسته‌بندی خودکار برمی‌گردند.',confirmReorder:'تب‌های گروه‌نشده و پین‌نشده در پنجره‌های واقعی کروم مرتب شوند؟',categoryChanged:'دسته تب تغییر کرد',newCategoryName:'نام دسته تازه',categoryNotFound:'دسته پیدا نشد',groupDone:'{count} تب در کروم گروه‌بندی شدند.',sortDone:'{count} تب در کروم جابه‌جا شدند.'},
};
let visibleChatCount=120;
let state={settings:{language:'en',theme:'system',capture:{},rtlSites:{}},captureHealth:{},tabs:[],bookmarkTree:[],bookmarks:[],chats:[],clips:[],view:'overview',search:'',review:[],activeChat:null,history:[]};
const t=k=>words[state.settings.language]?.[k]||words.en[k]||k;
const fmt=(key,vars={})=>t(key).replace(/\{(\w+)\}/g,(_,k)=>String(vars[k]??''));
let selectedFolderName='',folderPermission='missing',folderSyncBusy=false;
async function send(type,payload={}){const result=await chrome.runtime.sendMessage({type,...payload});if(!result?.ok)throw new Error(result?.error||'Unknown error');return result.data;}
function toast(message){const e=$('#toast');e.textContent=message;e.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove('show'),3600);}
function flatten(nodes,trail=[]){const out=[];for(const n of nodes||[]){if(n.url)out.push({id:n.id,title:n.title||n.url,url:n.url,folder:trail.filter(Boolean).join(' / ')});if(n.children)out.push(...flatten(n.children,[...trail,n.title||'']));}return out;}
function matched(...values){return !state.search||values.join(' ').toLocaleLowerCase().includes(state.search.toLocaleLowerCase());}
function shortDate(value){try{return new Intl.DateTimeFormat(state.settings.language==='fa'?'fa-IR':'en-US',{month:'short',day:'numeric'}).format(new Date(value));}catch{return ''}}
function syncLabels(){document.documentElement.lang=state.settings.language;document.documentElement.dir=state.settings.language==='fa'?'rtl':'ltr';document.body.dir=document.documentElement.dir;const effectiveTheme=applyTheme(state.settings.theme,{systemDark:window.matchMedia('(prefers-color-scheme: dark)').matches});$('#themeButton').textContent=effectiveTheme==='dark'?'☀':'☾';$('#themeButton').title=t('themeToggle');$('#themeButton').setAttribute('aria-label',t('themeToggle'));$('#themeButton').setAttribute('aria-pressed',String(effectiveTheme==='dark'));
 for(const e of document.querySelectorAll('[data-i18n]')) e.textContent=t(e.dataset.i18n);
 for(const e of document.querySelectorAll('[data-i18n-placeholder]')) e.placeholder=t(e.dataset.i18nPlaceholder);
 $('#languageSelect').value=state.settings.language;$('#themeSelect').value=state.settings.theme;
 const hour=new Date().getHours();$('#greeting').textContent=t(hour<12?'goodMorning':hour<17?'goodAfternoon':'goodEvening');
 const date=new Date();$('#today').innerHTML=`<strong>${esc(new Intl.DateTimeFormat(state.settings.language==='fa'?'fa-IR':'en-US',{day:'numeric',month:'short'}).format(date))}</strong><span>${esc(new Intl.DateTimeFormat(state.settings.language==='fa'?'fa-IR':'en-US',{weekday:'long',year:'numeric'}).format(date))}</span>`;
 $('#layaSwitch').setAttribute('aria-checked',Boolean(state.settings.layaEnabled));}
function navigate(view){state.view=view;document.querySelectorAll('.view').forEach(e=>e.classList.toggle('is-active',e.id==='view-'+view));document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===view));$('#crumbCurrent').textContent=t(view);window.scrollTo({top:0,behavior:'instant'});render();}
function stat(n,k,icon){return `<div class="stat"><span class="stat-icon">${icon}</span><strong>${n.toLocaleString(state.settings.language==='fa'?'fa-IR':'en-US')}</strong><span>${esc(t(k))}</span></div>`;}
function renderStats(){const tabs=state.tabs.filter(isWebTab);$('#navTabCount').textContent=tabs.length;$('#stats').innerHTML=stat(tabs.length,'statTabs','▤')+stat(groupTabs(tabs).length,'statDomains','◈')+stat(state.chats.length,'statChats','◎')+stat(state.bookmarks.length,'statBookmarks','◇');}
function itemRow(title,desc,icon,side=''){return `<div class="item-row"><span class="item-icon">${esc(icon)}</span><div class="item-main"><strong title="${esc(title)}">${esc(title)}</strong><small>${esc(desc)}</small></div><span class="item-count">${side}</span></div>`;}
function renderOverview(){const groups=groupTabs(state.tabs).filter(g=>matched(g.host,...g.tabs.map(x=>x.title))).slice(0,6);$('#overviewGroups').innerHTML=groups.length?groups.map(g=>itemRow(g.host,`${g.count} ${t('statTabs')}`,g.host[0],'' )).join(''):`<div class="empty">${t('noData')}</div>`;
 const chats=state.chats.filter(c=>matched(c.title,c.platform,c.url)).slice(0,5);$('#overviewChats').innerHTML=chats.length?chats.map(c=>itemRow(titleFromDocumentTitle(c.title),`${c.platform} · ${shortDate(c.updatedAt)}`,'◎',String(c.messageCount))).join(''):`<div class="empty">${t('noChats')}</div>`;
 renderReview();}
function renderReview(){const suggestions=state.review.filter(s=>matched(s.title,s.host,s.type)).slice(0,4);$('#reviewList').innerHTML=suggestions.length?suggestions.map(s=>`<div class="review-card"><span class="review-symbol">◇</span><div class="review-copy"><strong>${esc(s.title)}</strong><small>${esc(s.host)} · ${esc(t(s.type==='duplicate'?'suggestDuplicate':'suggestStale'))}${s.laya?.confidence>=.8?` · ${esc(t('localLaya'))}: ${Math.round(s.laya.yesProbability*100)}%`:''}</small></div><div class="review-actions"><button class="tiny-button" data-action="no" data-id="${esc(s.id)}">${esc(t('no'))}</button><button class="tiny-button accent" data-action="yes" data-id="${esc(s.id)}">${esc(t('yes'))}</button></div></div>`).join(''):`<div class="empty">${esc(t('noSuggestions'))}</div>`;}
function tabRows(tabs){
 const categories=sanitizeCategories(state.settings.tabCategories);
 return tabs.map(x=>{
  const selected=tabCategory(x,state.settings);
  const options=categories.map(c=>`<option value="${esc(c.id)}" ${selected===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  return `<div class="item-row"><span class="item-icon">${esc(hostOf(x.url)[0]||'?')}</span><div class="item-main"><strong title="${esc(x.title||x.url)}">${esc(x.title||x.url)}</strong><small>${esc(hostOf(x.url))}</small></div><div class="row-actions"><select class="tab-category-select" data-category-tab="${x.id}" aria-label="${esc(t('sortCategory'))}">${options}</select><button class="icon-button" data-action="focus" data-tab="${x.id}">${esc(t('open'))}</button><button class="icon-button" data-action="bookmark" data-tab="${x.id}">${esc(t('save'))}</button><button class="icon-button" data-action="close" data-tab="${x.id}" aria-label="${esc(t('close'))}">×</button></div></div>`;
 }).join('');
}
function renderTabs(){
 $('#tabSort').value=TAB_SORTS.includes(state.settings.tabSort)?state.settings.tabSort:'category';
 $('#autoOrganize').checked=Boolean(state.settings.autoOrganizeTabs);
 const report=state.tabOrganizationReport;$('#organizationStatus').textContent=report?(report.errors?.length?fmt('organizeFailed',{detail:report.errors.map(e=>e.reason).join('; ')}):fmt('organizeDone',{count:report.grouped??0,groups:(report.groupsCreated??0)+(report.groupsReused??0),skipped:report.skipped??0})):t('organizeInactive');
 const mode=state.settings.tabSort||'category';
 const groups=(mode==='category'?groupedByCategory(state.tabs,state.settings):[{id:'all',name:t('tabs'),color:'blue',tabs:orderedTabs(state.tabs,state.settings)}]).map(g=>({...g,tabs:g.tabs.filter(x=>matched(x.title,x.url,g.name,hostOf(x.url)))})).filter(g=>g.tabs.length);
 $('#allTabs').innerHTML=groups.length?groups.map(g=>`<div class="group-card"><div class="group-head"><strong><span class="category-dot color-${esc(g.color)}"></span>${esc(g.name)}</strong><div class="category-header-actions"><small>${g.tabs.length} ${esc(t('statTabs'))}</small>${g.id==='all'?'':`<button class="outline-button" data-action="group-chrome" data-category="${esc(g.id)}">${esc(t('groupChrome'))}</button>`}</div></div>${tabRows(g.tabs)}</div>`).join(''):`<div class="empty">${esc(t('noTabs'))}</div>`;
 renderCategoryEditor();
}
function renderCategoryEditor(){
 const e=$('#categoryEditor');if(e.hidden)return;
 const categories=sanitizeCategories(state.settings.tabCategories);
 e.innerHTML=`<p class="hint">${esc(t('categoryEditHelp'))}</p><div class="category-form"><input id="newCategoryName" type="text" maxlength="40" placeholder="${esc(t('newCategoryName'))}" aria-label="${esc(t('newCategoryName'))}"><button id="createCategory" class="primary-button">${esc(t('createCategory'))}</button></div>`+
 categories.map(c=>`<div class="category-form" data-category-id="${esc(c.id)}"><span class="category-dot color-${esc(c.color)}"></span><input class="category-name" value="${esc(c.name)}" maxlength="40" aria-label="${esc(t('categoryName'))}"><select class="category-color" aria-label="${esc(t('color'))}">${['grey','blue','red','yellow','green','pink','purple','cyan','orange'].map(color=>`<option value="${color}" ${c.color===color?'selected':''}>${color}</option>`).join('')}</select><button class="outline-button" data-action="category-save" data-category="${esc(c.id)}">${esc(t('saveCategory'))}</button><button class="outline-button" data-action="category-delete" data-category="${esc(c.id)}" ${categories.length<2?'disabled':''}>${esc(t('removeCategory'))}</button></div>`).join('');
}

function renderChats(){const chats=state.chats.filter(c=>matched(c.title,c.url,c.platform));$('#allChats').innerHTML=chats.length?`<div class="group-card">${chats.map(c=>`<div class="item-row"><span class="item-icon">◎</span><div class="item-main"><strong>${esc(titleFromDocumentTitle(c.title))}</strong><small>${esc(c.platform)} · ${c.messageCount} ${esc(t('messages'))} · ${esc(shortDate(c.updatedAt))}</small></div><div class="row-actions"><button class="icon-button" data-action="chat-open" data-id="${esc(c.id)}">${esc(t('open'))}</button><button class="icon-button" data-action="chat-delete" data-id="${esc(c.id)}">${esc(t('delete'))}</button></div></div>`).join('')}</div>`:`<div class="empty">${esc(t('noChats'))}</div>`;}
function renderBookmarks(){const books=state.bookmarks.filter(b=>matched(b.title,b.url,b.folder)).slice(0,120);$('#allBookmarks').innerHTML=books.length?`<div class="group-card">${books.map(b=>`<div class="item-row"><span class="item-icon">◇</span><div class="item-main"><strong>${esc(b.title)}</strong><small>${esc(b.folder||hostOf(b.url))}</small></div><button class="icon-button" data-action="open-url" data-url="${esc(encodeURIComponent(b.url))}">${esc(t('open'))}</button></div>`).join('')}</div>`:`<div class="empty">${esc(t('noBookmarks'))}</div>`;}
function renderClips(){const clips=state.clips.filter(c=>matched(c.text,c.title,c.url)).slice(0,120);$('#allClips').innerHTML=clips.length?`<div class="group-card">${clips.map(c=>`<div class="item-row"><span class="item-icon">▧</span><div class="item-main"><strong>${esc(c.title||c.text.slice(0,90))}</strong><small>${esc(c.text.slice(0,175))}</small></div><button class="icon-button" data-action="clip-delete" data-id="${esc(c.id)}">${esc(t('delete'))}</button></div>`).join('')}</div>`:`<div class="empty">${esc(t('noClips'))}</div>`;}
function captureHealthText(site){
 const record=state.captureHealth?.[site];
 if(!record)return t('captureWaiting');
 const date=shortDate(record.checkedAt);
 if(record.status==='saved')return fmt('captureWorking',{date,count:record.count||0});
 if(record.status==='waiting-url')return t('captureWaiting');
 if(record.status==='no-messages')return t('captureNoMessages');
 if(record.status==='error')return fmt('captureError',{detail:record.detail||'-'});
 if(record.status==='skipped')return fmt('captureError',{detail:record.detail||'Skipped'});
 return t('captureWaiting');
}
function renderSettings(){
 const capture=state.settings.capture||{};
 $('#providerSettings').innerHTML=Object.entries(PROVIDERS).map(([key,provider])=>{
  const status=capture[key]?captureHealthText(key):t('captureOff');
  return `<div class="setting-row"><div><strong>${esc(provider.name)}</strong><small>${esc(status)}</small></div><button class="switch" role="switch" aria-label="${esc(provider.name)}" aria-checked="${Boolean(capture[key])}" data-action="capture" data-site="${key}"><span></span></button></div>`;
 }).join('');
 renderCaptureStatus();renderStorageStatus();
}
function renderCaptureStatus(){
 const on=Object.keys(PROVIDERS).filter(k=>state.settings.capture?.[k]);
 const last=state.captureEvent;
 const summary=on.length?fmt('captureOn',{count:on.length}):t('captureOff');
 const details=last?` ${fmt('lastCapture',{platform:PROVIDERS[last.platform]?.name||last.platform,date:shortDate(last.updatedAt)})}`:'';
 $('#captureStatus').textContent=summary+details;
 $('#captureBanner').textContent=summary+details;
 $('#enableAllCapture').disabled=on.length===Object.keys(PROVIDERS).length;
}
function renderStorageStatus(){
 const mode=state.settings.exportMode||'local';
 $('#exportMode').value=mode;
 if(document.activeElement!==$('#downloadsSubfolder'))$('#downloadsSubfolder').value=state.settings.downloadsFolder||'Veyra/AI-Chats';
 $('#folderStatus').textContent=mode==='folder'?(folderPermission==='granted'?fmt('folderGranted',{folder:selectedFolderName}):folderPermission==='needs-permission'?t('folderDenied'):t('folderMissing')):mode==='downloads'?fmt('downloadsStatus',{folder:state.settings.downloadsFolder||'Veyra/AI-Chats'}):t('localStorageStatus');
}
function render(){syncLabels();renderStats();renderOverview();renderTabs();renderChats();renderBookmarks();renderClips();renderSettings();}
async function refresh(doReview=false){try{const data=await send('SNAPSHOT');state={...state,...data,bookmarks:flatten(data.bookmarkTree)};const stored=await chrome.storage.local.get(['review','captureEvent','captureHealth','tabOrganizationReport']);state.captureEvent=stored.captureEvent;state.captureHealth=stored.captureHealth||{};state.tabOrganizationReport=stored.tabOrganizationReport;const cached=stored.review;state.review=cached?.suggestions||[];render();if(state.settings.exportMode==='folder')queueFolderSync();if(doReview||!cached||Date.now()-cached.createdAt>15*60000){state.review=(await send('GET_REVIEW')).suggestions;renderReview();}}catch(error){toast(`${t('failed')}: ${error.message}`);}}
function download(filename,content,type='application/json'){const blob=new Blob([content],{type:`${type};charset=utf-8`});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderChatDialog(){
 const c=state.activeChat;if(!c)return;
 const total=c.messages.length, start=Math.max(0,total-visibleChatCount);
 $('#chatExcerptInfo').textContent=fmt('chatRange',{start:start+1,end:total,total});
 $('#loadOlderChat').hidden=start===0;
 $('#loadOlderChat').textContent=t('loadOlder');
 $('#dialogBody').innerHTML=c.messages.slice(start).map(m=>`<div class="conversation-message"><strong>${esc(m.role==='user'?'USER':'ASSISTANT')}</strong><p>${esc(m.text)}</p></div>`).join('');
}
async function openChat(id){const c=await send('GET_CHAT',{id});if(!c)return;state.activeChat=c;visibleChatCount=120;$('#dialogTitle').textContent=titleFromDocumentTitle(c.title);renderChatDialog();$('#chatDialog').showModal();}
async function actOnReview(id,yes){const s=state.review.find(x=>x.id===id);if(!s)return;if(yes){const tab=await chrome.tabs.get(s.tabId).catch(()=>null);if(!tab||normalizeUrl(tab.url)!==s.url){toast(t('failed'));return;}const message=s.type==='stale'?t('confirmArchive'):t('confirmClose');if(!confirm(message))return;if(s.type==='stale')await chrome.bookmarks.create({title:tab.title||s.url,url:tab.url});await chrome.tabs.remove(s.tabId);}await send('DECISION',{id,answer:yes?'yes':'no'});await refresh(true);}
async function enableAllCapture(){
 const matches=[...new Set(Object.values(PROVIDERS).flatMap(provider=>provider.matches))];
 const allowed=await chrome.permissions.request({origins:matches});
 if(!allowed){toast(t('denied'));return;}
 const capture=Object.fromEntries(Object.keys(PROVIDERS).map(key=>[key,true]));
 state.settings=await send('SETTINGS',{patch:{capture}});
 await send('SYNC_CAPTURE');
 await refresh();toast(t('success'));
}
async function refreshOpenChats(){const report=await send('CAPTURE_OPEN_TABS');await refresh();const tabs=report.tabs||[];if(!tabs.length){toast(t('captureNoTabs'));return;}toast(fmt('captureCheck',{count:tabs.length,saved:tabs.filter(x=>x.status==='saved'||x.status==='unchanged').length,errors:tabs.filter(x=>x.status==='error').length}));}
let pendingFolderTimer=null;
function queueFolderSync(){clearTimeout(pendingFolderTimer);if(state.settings.exportMode==='folder')pendingFolderTimer=setTimeout(()=>performFolderSync().catch(e=>{$('#folderStatus').textContent=e.message}),1200);}
async function performFolderSync(){
 if(folderSyncBusy || state.settings.exportMode!=='folder')return;
 folderSyncBusy=true;
 try {
  const handle=await getChosenFolder();
  folderPermission=await getFolderAccess(handle);selectedFolderName=handle?.name||'';
  if(folderPermission==='granted'){
   const result=await syncSelectedFolder({send,handle});
   if(result.saved)$('#folderStatus').textContent=fmt('folderSyncDone',{count:result.saved});
   else renderStorageStatus();
  } else renderStorageStatus();
 } finally {folderSyncBusy=false;}
}
async function selectFolder(){
 try {
  const handle=await chooseFolder();
  selectedFolderName=handle.name;folderPermission=await getFolderAccess(handle);
  if(folderPermission!=='granted')throw new Error(t('folderDenied'));
  state.settings=await send('SETTINGS',{patch:{exportMode:'folder'}});
  render();await performFolderSync();toast(t('success'));
 } catch(error){if(error.name!=='AbortError')toast(error.message);renderStorageStatus();}
}
async function changeExportMode(mode){
 if(mode==='folder'){
  const handle=await getChosenFolder();
  if(!handle){await selectFolder();return;}
  if(await getFolderAccess(handle)!=='granted'){toast(t('folderDenied'));renderStorageStatus();return;}
  selectedFolderName=handle.name;folderPermission='granted';
 }
 if(mode==='downloads'){
  const allowed=await chrome.permissions.request({permissions:['downloads']});
  if(!allowed){toast(t('denied'));renderStorageStatus();return;}
 }
 state.settings=await send('SETTINGS',{patch:{exportMode:mode}});
 render();if(mode==='downloads')await send('FLUSH_DOWNLOADS');if(mode==='folder')queueFolderSync();
}
async function updateDownloadsFolder(){
 const folder=cleanDownloadsFolder($('#downloadsSubfolder').value.trim());
 if(!folder){toast(t('badPath'));return;}
 state.settings=await send('SETTINGS',{patch:{downloadsFolder:folder}});
 render();if(state.settings.exportMode==='downloads')await send('FLUSH_DOWNLOADS');toast(t('success'));
}
async function applyCapture(site){const was=Boolean(state.settings.capture?.[site]);if(!was){const patterns=PROVIDERS[site].matches;const allowed=await chrome.permissions.request({origins:patterns});if(!allowed){toast(t('denied'));return;}}
 const capture={...state.settings.capture,[site]:!was};state.settings=await send('SETTINGS',{patch:{capture}});await send('SYNC_CAPTURE');
 if(!was){const active=await chrome.tabs.query({});for(const tab of active.filter(x=>PROVIDERS[site].matches.some(p=>x.url?.startsWith(p.slice(0,-2))))){try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['src/content/capture.js']});}catch{}}}
 render();toast(t('success'));}
async function toggleLaya(){const next=!state.settings.layaEnabled;if(next){const allowed=await chrome.permissions.request({origins:['http://127.0.0.1:8000/*']});if(!allowed){toast(t('denied'));return;}}
 state.settings=await send('SETTINGS',{patch:{layaEnabled:next}});render();if(next)await refresh(true);}
async function enableRtl(id){const tab=state.tabs.find(t=>t.id===id);if(!tab||!isWebTab(tab))return;const origin=new URL(tab.url).origin;const enabled=!(state.settings.rtlSites||{})[origin];if(enabled){const allowed=await chrome.permissions.request({origins:[`${origin}/*`]});if(!allowed){toast(t('denied'));return;}}
 await send('RTL_SITE',{tabId:id,enabled});state.settings.rtlSites={...state.settings.rtlSites,[origin]:enabled};toast(t('success'));}
async function act(el){const action=el.dataset.action;const id=el.dataset.id;const tabId=Number(el.dataset.tab);const tab=state.tabs.find(x=>x.id===tabId);switch(action){
 case 'group-chrome':{const result=await send('TAB_GROUP_CHROME',{categoryId:el.dataset.category});toast(result.errors?.length?fmt('organizeFailed',{detail:result.errors.map(e=>e.reason).join('; ')}):fmt('groupDone',{count:result.grouped}));await refresh();return;}
 case 'category-save':{const row=el.closest('[data-category-id]');const categories=sanitizeCategories(state.settings.tabCategories).map(c=>c.id===el.dataset.category?{...c,name:row.querySelector('.category-name').value.trim()||c.name,color:row.querySelector('.category-color').value}:c);const result=await send('TAB_CATEGORIES',{categories});state.settings=result.settings;render();return;}
 case 'category-delete':{if(!confirm(t('confirmRemoveCategory')))return;const categories=sanitizeCategories(state.settings.tabCategories).filter(c=>c.id!==el.dataset.category);const result=await send('TAB_CATEGORIES',{categories});state.settings=result.settings;render();return;}
 case 'yes':return actOnReview(id,true);case 'no':return actOnReview(id,false);
 case 'capture':return applyCapture(el.dataset.site);
 case 'focus':if(tab){await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});}return;
 case 'bookmark':if(tab&&isWebTab(tab)){await chrome.bookmarks.create({title:tab.title||tab.url,url:tab.url});toast(t('success'));await refresh();}return;
 case 'rtl':return enableRtl(tabId);
 case 'close':if(tab&&confirm(t('confirmClose'))){await chrome.tabs.remove(tabId);await refresh(true);}return;
 case 'open-url':{const url=decodeURIComponent(el.dataset.url||'');if(/^https?:\/\//.test(url))await chrome.tabs.create({url});return;}
 case 'chat-open':return openChat(id);
 case 'chat-delete':if(confirm(t('confirmDelete'))){await send('DELETE_CHAT',{id});await refresh();}return;
 case 'clip-delete':if(confirm(t('confirmDelete'))){await send('DELETE_CLIP',{id});await refresh();}return;
 }}
document.addEventListener('click',async(event)=>{try{const view=event.target.closest('[data-view]')?.dataset.view;const go=event.target.closest('[data-go]')?.dataset.go;if(view||go){navigate(view||go);return;}const a=event.target.closest('[data-action]');if(a)await act(a);}catch(error){toast(`${t('failed')}: ${error.message}`)}});
document.addEventListener('change',async event=>{const el=event.target;if(!el.matches('[data-category-tab]'))return;try{const result=await send('TAB_ASSIGN',{tabId:Number(el.dataset.categoryTab),categoryId:el.value});state.settings=result.settings;await refresh();toast(t('categoryChanged'));}catch(error){toast(error.message);await refresh();}});
$('#tabSort').addEventListener('change',async e=>{try{const result=await send('TAB_SORT',{sort:e.target.value});state.settings=result.settings;renderTabs();}catch(error){toast(error.message)}});
$('#manageCategories').addEventListener('click',()=>{const editor=$('#categoryEditor');editor.hidden=!editor.hidden;renderCategoryEditor()});
$('#organizeChrome').addEventListener('click',async()=>{if(!confirm(t('organizeConfirm')))return;try{const result=await send('TAB_ORGANIZE_CHROME');if(result.errors?.length)toast(fmt('organizeFailed',{detail:result.errors.map(e=>e.reason).join('; ')}));else toast(fmt('organizeDone',{count:result.grouped,groups:result.groupsCreated+result.groupsReused,skipped:result.skipped}));await refresh()}catch(error){toast(error.message)}});
$('#autoOrganize').addEventListener('change',async e=>{try{const result=await send('TAB_AUTO_ORGANIZE',{enabled:e.target.checked});state.settings=result.settings;await refresh()}catch(error){toast(error.message);e.target.checked=!e.target.checked}});
$('#reorderChrome').addEventListener('click',async()=>{if(!confirm(t('confirmReorder')))return;try{const result=await send('TAB_REORDER_CHROME');toast(result.errors?.length?fmt('organizeFailed',{detail:result.errors.map(e=>e.reason).join('; ')}):fmt('sortDone',{count:result.moved}));await refresh()}catch(error){toast(error.message)}});
document.addEventListener('click',async e=>{if(e.target.id!=='createCategory')return;try{const editor=$('#categoryEditor');const name=editor.querySelector('#newCategoryName').value;const categories=[...sanitizeCategories(state.settings.tabCategories),newCategory(name,state.settings.tabCategories)];const result=await send('TAB_CATEGORIES',{categories});state.settings=result.settings;render();toast(t('success'))}catch(error){toast(error.message)}});
$('#globalSearch').addEventListener('input',e=>{state.search=e.target.value.trim();render();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#globalSearch').focus();}if(e.key==='Escape'&&$('#chatDialog').open)$('#chatDialog').close();});
$('#refreshReview').addEventListener('click',()=>refresh(true).then(()=>toast(t('reviewed'))));
$('#reviewTabs').addEventListener('click',()=>{navigate('overview');refresh(true)});
$('#goCaptureSettings').addEventListener('click',()=>navigate('settings'));
$('#enableAllCapture').addEventListener('click',()=>enableAllCapture().catch(e=>toast(e.message)));
$('#captureOpenTabs').addEventListener('click',()=>refreshOpenChats().catch(e=>toast(e.message)));
$('#exportMode').addEventListener('change',e=>changeExportMode(e.target.value).catch(error=>{toast(error.message);renderStorageStatus()}));
$('#chooseFolder').addEventListener('click',()=>selectFolder());
$('#syncFolder').addEventListener('click',()=>{const task=state.settings.exportMode==='downloads'?send('FLUSH_DOWNLOADS'):performFolderSync();task.catch(e=>toast(e.message))});
$('#saveDownloadsPath').addEventListener('click',()=>updateDownloadsFolder().catch(e=>toast(e.message)));
$('#languageButton').addEventListener('click',async()=>{state.settings=await send('SETTINGS',{patch:{language:state.settings.language==='fa'?'en':'fa'}});render()});
$('#themeButton').addEventListener('click',async()=>{const effective=resolveTheme(state.settings.theme,window.matchMedia('(prefers-color-scheme: dark)').matches);const next=effective==='dark'?'light':'dark';state.settings=await send('SETTINGS',{patch:{theme:next}});render()});
$('#languageSelect').addEventListener('change',async e=>{state.settings=await send('SETTINGS',{patch:{language:e.target.value}});render()});
$('#themeSelect').addEventListener('change',async e=>{state.settings=await send('SETTINGS',{patch:{theme:e.target.value}});render()});
$('#layaSwitch').addEventListener('click',()=>toggleLaya().catch(error=>toast(error.message)));
$('#exportBackup').addEventListener('click',async()=>{try{const data=await send('EXPORT');download(`veyra-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2));toast(t('backupDone'));}catch(error){toast(error.message)}});
$('#importBackup').addEventListener('click',()=>$('#backupInput').click());
$('#backupInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>70*1024*1024)throw new Error('Backup exceeds 70MB');const data=JSON.parse(await file.text());await send('IMPORT',{data});await refresh();toast(t('backupImported'));}catch(error){toast(`${t('failed')}: ${error.message}`)}finally{e.target.value=''}});
$('#enableHistory').addEventListener('click',async()=>{try{const granted=await chrome.permissions.request({permissions:['history']});if(!granted){toast(t('denied'));return;}state.history=await chrome.history.search({text:'',maxResults:16,startTime:Date.now()-14*86400000});$('#historyList').innerHTML=state.history.length?state.history.map(h=>itemRow(h.title||h.url,hostOf(h.url),'◷',shortDate(h.lastVisitTime))).join(''):`<div class="empty">${esc(t('historyEmpty'))}</div>`;}catch(error){toast(error.message)}});
$('#closeDialog').addEventListener('click',()=>$('#chatDialog').close());
$('#loadOlderChat').addEventListener('click',()=>{visibleChatCount+=120;renderChatDialog()});
$('#downloadChat').addEventListener('click',()=>{if(state.activeChat)download(`${safeFilename(titleFromDocumentTitle(state.activeChat.title))}.md`,toMarkdown(state.activeChat),'text/markdown')});
const media=window.matchMedia('(prefers-color-scheme: dark)');
media.addEventListener('change',()=>{if(state.settings.theme==='system')syncLabels()});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area!=='local')return;
 if(changes.settings?.newValue){state.settings={...state.settings,...changes.settings.newValue};render();}
 if(changes.captureEvent?.newValue){state.captureEvent=changes.captureEvent.newValue;renderCaptureStatus();queueFolderSync();refresh().catch(()=>{});if($('#chatDialog').open&&state.activeChat?.id===changes.captureEvent.newValue.id)send('GET_CHAT',{id:state.activeChat.id}).then(c=>{if(c){state.activeChat=c;renderChatDialog()}}).catch(()=>{});}
 if(changes.captureHealth?.newValue){state.captureHealth=changes.captureHealth.newValue;renderSettings();}
});
// Apply the system preference immediately, then hydrate the saved choice.
applyTheme('system',{systemDark:media.matches});
(async()=>{const handle=await getChosenFolder().catch(()=>null);selectedFolderName=handle?.name||'';folderPermission=await getFolderAccess(handle).catch(()=> 'needs-permission');renderStorageStatus();})();
refresh();setInterval(()=>{if(!document.hidden){refresh();queueFolderSync()}},45000);
addEventListener('visibilitychange',()=>{if(!document.hidden)queueFolderSync()});
