// Adapted from zarazhangrui/tab-out/extension/background.js (MIT, Zara Zhang 2026).
// https://github.com/zarazhangrui/tab-out — see THIRD_PARTY_NOTICES.md.
export async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.filter(t=>/^https?:\/\//i.test(t.url||'')).length;
    await chrome.action.setBadgeText({text:count>0?String(count):''});
    if(count) await chrome.action.setBadgeBackgroundColor({color:count<=10?'#3d7a4a':count<=20?'#b8892e':'#b35a5a'});
  } catch {await chrome.action.setBadgeText({text:''}).catch(()=>{});}
}
