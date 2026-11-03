# ADR-0002: Tab workspace and opt-in conversation drafts (v0.1.4)

- Tab categories, URL assignments, and sort choice persist in `chrome.storage.local`; default grouping is computed without deleting or closing tabs.
- Assignment keyed by normalized URL means multiple identical URLs share a category. This is intentional until per-tab persisted identity is designed.
- Native grouping is only requested by the user and excludes pinned/already-grouped tabs, and is applied per window.
- Physical reorder is another explicit action, limited to ungrouped, unpinned tabs per window. No automatic rearrangement or bulk closing.
- An opted-in AI content script may send a draft from a landing page **only when a recognized authored user message is visible**. The draft is keyed by provider plus `sender.tab.id`, then deleted on successful canonical archive save.
- Drafts are kept locally in IndexedDB and not automatically exported as files. No site consent is bypassed, no request/response interception occurs, and provider DOM is treated as unstable.
- Browser MV3 dynamic content script registration persists, and manual recovery reinjects in open pages. Check failures visibly in Settings.

## Remaining risks

- Third-party DOM markup changes; no live site acceptance testing was possible in the provided headless Chromium environment.
- URL-keyed tab categories cannot distinguish two copies of an identical URL.
- Draft chat records are retained if a tab closes before a canonical URL appears; users can review/delete them in Veyra.
- Browser extension updates can reset IDs if installed in a different directory; users should preserve their installed folder and export backups.
