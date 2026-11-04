# Veyra — Saved Tabs and Chrome Bookmark Sync

**Status:** Implemented in v0.1.8; native Bookmark Sync must be enabled separately in Chrome.

## Data ownership and cross-device semantics

- Saved tabs and collections are stored as **ordinary Chrome Bookmarks**, in `Other bookmarks / Veyra — Saved Tabs / <category> / <collection> / <links>`.
- A single saved tab is placed directly under its category. A saved multi-tab session becomes a named folder under its category. A category is a standard bookmark folder.
- Chrome's own Bookmarks Sync replicates these URLs, names, groups and category folders across **Chrome profiles signed in to the same Google Account with bookmark syncing enabled**. The data is visible in Chrome's built-in Bookmark Manager even without Veyra installed on the second computer.
- Unlike `chrome.storage.sync`, bookmark syncing does **not depend on the same unpacked extension ID** across machines. The manifest `key` is intentionally unchanged to protect existing locally stored chat archives and extension settings. A future Web Store version can use a stable extension ID.
- Chrome does not provide an extension API that reliably verifies end-to-end cloud replication. A successful local bookmark save is NOT proof that the other computer has synced; verify there in Bookmark Manager.
- If syncing is turned off, saved tabs still persist in the local Chrome profile. Incognito tabs, Chrome internal pages and `file:` URLs are excluded.
- **Privacy:** URLs and titles saved in synced bookmarks may be stored in the user's Google Account. This is initiated only by the user's Save action; Veyra never automatically publishes the current browsing session. Do not save private or token-bearing links that should not sync.
- AI chat **full transcripts**, selected-folder handles, clips, and most site permissions stay **local** to the current Chrome profile. Chrome Bookmark Sync does not transfer full AI chat text; use manual Veyra JSON backup/import to move that archive. Local storage is not Chrome Sync.

## Implemented in v0.1.8

1. Dedicated Saved tabs sidebar section, count and searchable grouped library.
2. Save one current tab into its existing open-tab category; skips duplicates in that category.
3. Save all eligible open web tabs into one named workspace collection, retaining their order.
4. Save all open tabs **by existing open-tab category**, creating one named collection per category.
5. Create any custom category; existing bookmarks category folders follow automatically to other synced devices.
6. Filter collections by category and global search, plus sort by newest, oldest, name or size.
7. Move a saved tab or entire collection between categories.
8. Rename categories, collections and saved links.
9. Restore a single tab or entire collection; restoration of larger sets requires explicit confirmation, and multi-tab sets open in a new Chrome window.
10. Delete a saved tab or collection after confirmation. Nonempty categories cannot be deleted accidentally, and unrelated Chrome bookmarks are never touched.
11. Browser bookmark change listeners refresh the visible library when synced changes arrive.
12. Bilingual Persian RTL / English LTR labels and light/dark theme support.
13. Input sanitization of bookmark names, protocol filtering and exclusion of incognito tabs; no implicit tab closure.
14. Tests mock Chrome Bookmarks to verify session creation, moving, restoring, renaming, duplicate handling, security checks and rollback on partial failures.

## Expected behavior and limits

- Saving 150+ eligible tabs in a **single** session reports a visible error. Large saved collections should be split into more than one session.
- Chrome Bookmark Sync is browser/account-controlled. Sync may be delayed or disallowed by browser enterprise policy; Veyra shows guidance, not an invented sync state.
- Existing categories for *open tabs* are currently stored in the extension's local settings, while categories for *saved tabs* are native bookmark folders. The **saved** category name and collection membership are portable; automatic grouping rules and UI color preferences do not automatically transfer across unpacked installations.
- This is a local-first Chrome extension MVP; tests verify mocked API behavior, not a real multi-device Chrome account session.
- Browser extensions run only in the local browser; syncing bookmarks does not mean tabs automatically launch on a second computer. Users reopen saved sets deliberately.

## Manual acceptance procedure

1. Install/reload v0.1.8 in Chrome, open new tab -> Saved tabs.
2. Save two open web tabs to a custom category; then save a named collection. Confirm both in `chrome://bookmarks` under `Veyra — Saved Tabs`.
3. Rename the category, move a collection into another category, and reopen it. Confirm no original tabs were closed.
4. On another Chrome computer with the **same Google Account and Bookmark Sync enabled**, verify the `Veyra — Saved Tabs` folder appears in Chrome Bookmarks. Install Veyra on that computer if you want the Veyra UI.
5. Delete one saved tab and confirm the removal propagates after Chrome sync. Leave the AI chat archive on its original device unless explicitly exported/imported.
