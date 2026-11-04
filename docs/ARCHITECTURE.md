# Architecture

## Runtime overview

Chrome Manifest V3 `chrome_url_overrides.newtab` → `src/ui/newtab.html` (fast static load) → extension service worker (`src/background.js`) → Chrome tabs/bookmarks and local IndexedDB. Browser context menu stores text/link clips. A 10-minute Chrome alarm recomputes suggestions. Captures are DOM-based content scripts dynamically registered **only for opted-in providers with granted permissions**. Laya is a separate optional local HTTP endpoint (`/predict`).

```
New Tab UI (FA / EN, RTL / LTR)
  | -- Chrome tabs / bookmarks API
  | -- background messages -> IndexedDB [chats, clips, decisions]
  | -- manual approval -> tab close / bookmark / per-site RTL
  | -- optional permission -> history API

Opted-in AI sites -> dynamic content script -> sanitized bounded SAVE_CHAT -> IndexedDB

Alarm (10 min) -> duplicate/idle heuristics -> optional localhost Laya -> review suggestions
                                                        (never executes deletions)

Chrome startup / 6-hour alarm -> GitHub Releases API -> local update status in dashboard
AI task completion -> optional local notification + optional HTTPS webhook (metadata only)
```

## Permissions

`tabs`, `bookmarks`, `storage`, `alarms`, `scripting`, `contextMenus` are required. `history`, `downloads`, and `notifications` are optional. `http(s)://*/*` and GitHub API access are optional host permissions; page access is requested for the *specific* site on user gesture. Wildcard patterns do not grant access at installation.

## Data contracts

- Chat: `{id:'chat:<normalized URL>',url,platform,title,messages:[{role,text}],createdAt,updatedAt}`.
- Clip: `{id:UUID,title,url,text,savedAt}`.
- Decision: `{id:UUID,item,answer,date}`.
- Preference: `chrome.storage.local.settings`. Bounded observation of recent tab activity; no remote telemetry.
- Update check: reads the public GitHub latest-release metadata on Chrome startup and every six hours; it does not execute downloaded code or silently install a ZIP. It sends no browser data to GitHub.
- Notification webhook: optional HTTPS POST to the URL explicitly entered by the user. It contains event type, page title, site origin, task URL and completion time; chat prompt/response text is excluded.
- Backup: `{format:'veyra-backup-v1',chats,clips,settings:{language,theme}}`.

## Boundaries and known risks

- Chrome MV3 background service workers sleep. `alarms` are best effort, not an always-on agent.
- Browser tabs are ephemeral. `tabId` is not a persistent cross-session identity; review decisions must verify the current URL before acting.
- DOM chat extraction is not a complete export method, especially for virtualized and edited conversations. Better upstream adapters may be imported after fixtures, license review and consent tests.
- Current IndexedDB local records are unencrypted at rest. Sensitive users should protect browser/OS profiles and handle exported backups securely.
- Laya's installed HTTP API shape may evolve. Verify endpoint compatibility before deployment. Confidence is displayed only above threshold; no auto action.
- Browsers may limit new-tab override or show an extension-change confirmation. Startup page remains a browser setting.

## Source provenance

The adapted MIT badge module derives from Tab Out; title slug helpers derive from LTF Builder. Full upstream source trees are not embedded. See THIRD_PARTY_NOTICES.md.

## Test constraints (as of initial delivery)

Unit tests and JavaScript syntax verification run locally. The available automated Chromium process rejects browser/localhost navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`, so a real installed-extension smoke test and visual screenshot could not be completed in this execution environment. The extension must be loaded and validated by a user-controlled Chrome profile prior to distribution.
