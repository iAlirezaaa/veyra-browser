# Veyra — Your browser, in order.

**Veyra** is a local-first, bilingual (English/Persian) Chromium Manifest V3 workspace. Its New Tab dashboard organizes tabs, bookmarks, saved links and explicitly enabled AI chat archives; the redesigned toolbar popup provides categorized quick-save and configurable full-page Markdown export, using a restrained SkyVision-inspired palette.

![Veyra product preview](assets/product-preview.png)

*Product concept based on the current interface. Example content is illustrative; this is not a live-browser test screenshot.*

> Status: **working MVP source, not Chrome Web Store published or browser-tested**. Run tests and manually verify on Chrome before treating the capture adapters or Laya integration as reliable. This repository uses small adapted MIT-licensed parts from [Tab Out](https://github.com/zarazhangrui/tab-out) and [LTF Builder](https://github.com/localthink-org/localthink-builder); see [third-party notices](THIRD_PARTY_NOTICES.md). It is not an official fork of either project.

[فارسی / Persian instructions](README.fa.md)

## Quick install (Chrome/Edge/Brave)

1. Download or unzip [`veyra-v0.1.11-chrome.zip`](dist/veyra-v0.1.11-chrome.zip) (or use this repository's root for development).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Select **Load unpacked**, then select the folder containing `manifest.json`.
4. Open a **new tab**. The Veyra dashboard replaces Chrome's new-tab page.
5. Open **Settings**. Enable capture for each chat provider you trust, granting **site-specific access** on request. No conversation capture is enabled by default.

Chrome extensions may replace `chrome://newtab` but **cannot silently take over Chrome's startup settings**. For the dashboard at browser launch, use Chrome Settings → On startup → Open the New Tab page, or configure a startup page to open the dashboard yourself.

## Features

- **New-tab workspace:** current tabs grouped by domain, quick access, bookmarks, recent AI captures and simple statistics.
- **Tab review:** local duplicate detection, manually observed inactive pages, and **Yes/No** review cards. Closing tabs or bookmarking them is *never automatic*.
- **AI conversations:** opt-in capture per site for ChatGPT, Claude, Gemini, Perplexity, and Grok. Current DOM extraction is **best effort**, and virtualized/changed sites may not yield complete transcripts. Capture starts only after explicit host permission. More robust export engines can be incorporated later.
- **Local archive:** AI chats and selected text/link clips saved in IndexedDB. Conversation Markdown downloads and portable JSON backup/import.
- **Bookmarks:** read and search existing Chrome bookmarks, save open tabs with a click.
- **Organized bookmarks:** browse bookmarks in collapsible sections by their current Chrome folder; search titles, folders and sites; sort by title, date or site. The sections do not move your bookmarks.
- **AI archive organizer:** group saved conversations by AI provider and time (Today, Yesterday, This week, Earlier), or switch the grouping and sort order. Search reaches titles, URLs, providers and saved message text, with short excerpts in results.
- **Popup quick-save:** save the active web tab into Repo, Agents, AI LLM, or another saved category shared with the dashboard.
- **Full-page Markdown:** configure a `{title}`, `{domain}`, `{date}` filename pattern, ask for a destination on each save, or use a chosen subfolder under Downloads. Popup and context-menu exports share these preferences; Downloads permission is optional and requested only when needed.
- **AI completion notifications:** detect completion on supported AI interfaces and optionally deliver an event to a user-configured HTTPS webhook. Detection depends on page UI signals and may vary by provider.
- **Update check:** check the public GitHub Release version at startup and periodically. It reports availability but does not install code automatically; unpacked extensions must be reloaded by the user.
- **RTL tools:** enable right-to-left editing fields for a specific site with permission; also includes full RTL Persian interface.
- **Optional history:** history is *not* requested at installation. A separate button requests permission before reading recent visits.
- **Optional local Laya:** calls `http://127.0.0.1:8000/predict` only after explicit opt-in, and sends **only a tab title, domain and suggestion type** to the user's own local server. If Laya is absent, basic deterministic suggestions still work. Model output never triggers deletion.
- **Background review:** an MV3 alarm reevaluates tab suggestions roughly every 10 minutes while the browser is active. MV3 background workers are not truly always running.
- **No Veyra account, hosted backend, or analytics.** Data stays local unless you explicitly enable Laya on localhost or configure the external completion webhook; the webhook sends task metadata, not prompts or responses.

## Development

No build system or npm dependencies are required to load the extension. Node.js ≥20 is only needed for tests:

```bash
npm test
npm run check
```

The package includes a GitHub Actions Node test workflow. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PRODUCT_CHARTER.md`](docs/PRODUCT_CHARTER.md) and [`AGENTS.md`](AGENTS.md).

## Local Laya (optional)

Laya is an independent, locally hosted decision model, **not bundled with Veyra**. Review [the upstream project](https://github.com/NandhaKishorM/laya) for setup and compatible `/predict` service. Enable Laya in Settings after starting it. The adapter expects `answers.archive.noul` and optional `confidence` from the service. Keep it disabled if you do not want any tab metadata sent even to localhost. API compatibility should be checked against the actual installed Laya version.

## Security and limits

Chrome's permissions are visible in `manifest.json`. Site access and history are optional. No clipboard-wide, global keystroke, password, cookie, or hidden-page collection is implemented. AI captures include only text that can be read from the displayed DOM; content parsing can break as websites change. No encryption is provided for local archives in this MVP; protect your OS profile and export backups appropriately. Incognito is not explicitly handled and should remain disabled for this extension.

## Next steps

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for structured plans around a full library, bidirectional connectors, stronger chat extraction, local semantic indexing and advanced Laya decisions.

See [`docs/UPDATES_AND_PAGE_EXPORT.md`](docs/UPDATES_AND_PAGE_EXPORT.md) for the exact export, update-check and webhook behavior and limitations.

## License

MIT, with retained notices for the adapted components. [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## v0.1.10 — Popup quick-save and page Markdown export

The toolbar popup now saves the active tab into the Veyra Saved Tabs category chosen in the popup and offers a full-page Markdown export. Configure the filename with `{title}`, `{domain}` and `{date}`, then choose a save dialog or a Downloads subfolder. The popup follows the proposed SkyVision palette and supports the extension's English/Persian and theme preferences. This release also contains AI task-finished notifications, optional HTTPS webhook delivery and a GitHub release version check; the version check does not install extension code.

[Install v0.1.10](dist/veyra-v0.1.10-chrome.zip) · [SHA-256](dist/SHA256SUMS.txt) · [Feature details](docs/UPDATES_AND_PAGE_EXPORT.md)

## v0.1.11 — Searchable, organized libraries

Bookmarks now appear in collapsible sections by their existing Chrome folder and can be searched or sorted. AI conversations are grouped by provider and time, with alternate grouping and sort controls; archive search also checks locally stored message text and shows a short matching excerpt.

[Install v0.1.11](dist/veyra-v0.1.11-chrome.zip) · [SHA-256](dist/SHA256SUMS.txt)

## v0.1.2 — Automatic AI capture and storage destination

**Quick start:** open Settings → Capture settings → **Enable automatic capture**, approve the individual AI domain permissions, then open/start a conversation. Capture status and the last successfully saved conversation are shown on the dashboard. For already-open tabs, click **Check open AI chats**. Capture still requires explicit user approval before site access.

**Storage destination:** Settings → Chat storage location provides (1) Browser only (local IndexedDB), (2) automatic Markdown export to a configurable subfolder of Chrome Downloads (optional Downloads permission, while browser is running), or (3) any user-selected folder via the browser's directory picker (mirrors when the Veyra dashboard is open and directory write access is granted; resumes on reopen). Chrome forbids extensions from silently writing to arbitrary absolute filesystem paths. The browser archive is retained regardless of the export setting. See [ADR 0001](docs/decisions/0001-chat-auto-save-and-file-destination.md).

**Limitation:** DOM adapters capture visible, loaded messages rather than requesting private server-side chat history. Very long virtualized conversations may have gaps. The optional file mirrors are plaintext Markdown, so keep destination folders private.

## v0.1.5 — Chrome tab organization (early release)

- **Organize Chrome tabs** is the explicit, confirmed operation that sorts **real open tabs** and creates color-coded **Chrome Tab Groups** by category in each window.
- **Auto-organize new tabs** is opt-in and is **off by default**. It organizes new eligible tabs after load (Chrome event/alarm-based, not instantaneous).
- **Dashboard sort** changes only the displayed list, whereas **Organize Chrome tabs** changes the actual browser tab strip.
- Pinned tabs, existing unrelated groups, and browser-internal pages remain untouched. Already grouped tabs are not forcibly reassigned; category-group reuse is based on matching name and color.
- The operation verifies the observed order and group membership with fresh Chrome queries. If the Chrome API refuses a change, the UI reports an error instead of a false success.
- Regression tests use a simulated Chrome tabs/tabGroups contract; **the final behavior in a real user browser has not yet been verified**.

[Download unpacked Chrome ZIP v0.1.5](dist/veyra-v0.1.5-chrome.zip) · [Installation and upgrade instructions](INSTALL.md)

## v0.1.6 — Fix: “Tab organization not available” from Veyra New Tab

Version 0.1.5 incorrectly rejected its own dashboard requests because Chrome correctly provides `sender.tab` for extension New Tab pages. The service worker now **validates the extension ID and exact dashboard URL** rather than rejecting every tab-based message. This restores category assignments, real tab organization and the auto-organize toggle while preventing AI-site content scripts from controlling tabs.

**Install:** [Download Chrome ZIP v0.1.6](dist/veyra-v0.1.6-chrome.zip), extract over your **existing** Veyra extension folder, Reload on `chrome://extensions`, then refresh/open a new dashboard tab. When Chrome requires approval for the `tabGroups` permission, accept and re-enable the extension. Try Open tabs → Organize Chrome tabs with two eligible web tabs.

**Validation:** The regression now has an explicit background-message test. Unit/contract tests pass; live interaction in your own browser is not yet confirmed. See [ADR 0003](docs/decisions/0003-dashboard-message-authorization.md) and [installation guide](INSTALL.md).

## v0.1.7 — Incremental synchronization for long AI conversations

Veyra now merges new and edited DOM turns into the same canonical local conversation record rather than overwriting it with the currently visible window. Capture transmits bounded, overlapping batches (up to 5,000 currently loaded turns per scan), with a protective archive maximum of 20,000 turns or 24 million characters. Streamed responses and later follow-ups can update the same chat. If older messages are virtualized out of the site's DOM, Veyra preserves the archived content and refuses to guess an unanchored fragment's location. For large conversations, Downloads exports produce numbered Markdown parts instead of skipping oversized files. The chat viewer loads the newest 120 messages first, with an option to show more.

[Download Veyra 0.1.7 Chrome ZIP](dist/veyra-v0.1.7-chrome.zip) · [Installation instructions](INSTALL.md)

**Limitations:** Explicit per-provider capture permission is still required. Historical messages never rendered in the page cannot be recovered through DOM capture. Real-site end-to-end compatibility remains unverified; automated tests exercise modeled extraction, merging, Chrome API messaging and archive export.


## v0.1.8 — Saved Tabs library and multi-device Chrome Bookmark Sync

A new **Saved tabs** area saves one browser tab or an entire named multi-tab collection, grouped under standard/custom categories. You can search, sort, rename, move, delete and restore saved items without closing the originals. **Save by open-tab category** creates one collection per existing category.

These are standard folders in Chrome's bookmarks (`Other bookmarks / Veyra — Saved Tabs`). With **Bookmark Sync enabled for the same Google account**, the saved links and folders become available on the next computer, even in Chrome Bookmarks without Veyra installed. Chrome doesn't expose cloud completion status to the extension. **AI conversation text stays local**; use JSON backup/import to move chat history.

See [full feature catalog and planned backlog](docs/FEATURE_CATALOG.md), [Saved Tabs behavior and migration](docs/SAVED_TABS_AND_SYNC.md), and [installation notes](INSTALL.md).
