# Veyra — Feature Catalog and Product Backlog

Use statuses literally: **Implemented** means source/UI exists, not verified on every live site; **Planned** means not yet shipped. Tests and release notes must not claim browser end-to-end verification without evidence.

## Implemented capability catalog (v0.1.12)

| Domain | Feature | Status and caveat |
|---|---|---|
| Workspace | New-tab replacement with dashboard, navigation, statistics and global search | Implemented |
| Interface | English/Persian RTL language switch, Light/Dark/System theme | Implemented |
| Interface | Branded toolbar popup with contextual page, theme and language support | Implemented; SkyVision colors are a proposed reference, not approved trademark assets |
| Brand | SkyVision primary product identity with Veyra workspace name and Hades attribution | Implemented in v0.1.12 across Chrome name, toolbar popup, dashboard and product docs |
| Open tabs | Browse/focus/close/bookmark tabs, domain grouping, detect duplicates | Implemented; closing requires approval |
| Open tabs | Classify tabs into default/custom categories with editable names/colors | Implemented; tab assignment stored locally |
| Open tabs | Sort visually by category, domain, title, recent activity or browser order | Implemented |
| Open tabs | Move/order and group actual Chrome tabs with optional auto-organize | Implemented; pinned and protected tabs preserved |
| Saved tabs | Save one web tab into a named category | Implemented in v0.1.8 |
| Saved tabs | Save active web tab from toolbar popup into Repo, Agents, AI LLM or a custom dashboard category | Implemented in v0.1.10; uses Chrome bookmark storage |
| Saved tabs | Save all web tabs as a named collection or save by category | Implemented in v0.1.8 |
| Saved tabs | Custom bookmark categories, rename, move, filter, search, sort | Implemented in v0.1.8 |
| Saved tabs | Restore a saved link or multi-tab collection | Implemented in v0.1.8; explicit action |
| Saved tabs | Chrome's native Bookmark Sync for saved links/folders | Implemented in v0.1.8; Chrome profile sync needed |
| Bookmarks | Search existing Chrome bookmarks | Implemented |
| Bookmarks | Browse Chrome bookmarks grouped by folder, search by title/folder/site and sort by title, date or site | Implemented in v0.1.11; sections are views over existing folders and do not move bookmarks |
| AI archive | Opt-in DOM-based ChatGPT/Claude/Gemini/Perplexity/Grok capture | Implemented; real sites can change DOM |
| AI archive | Incremental long-chat update, stream edit handling, loss-averse merge | Implemented; missing virtualized DOM requires anchors |
| AI archive | IndexedDB local archive; chat view and Markdown export | Implemented, content stays local |
| AI archive | Automatic model and time sections, configurable grouping and sort, full-message search | Implemented in v0.1.11; search is local and returns short matching excerpts |
| Export | Save current page content, headings and links as Markdown with configurable `{title}`, `{domain}`, `{date}` filename | Implemented in v0.1.10; best-effort page extraction |
| Export | Ask for a destination or save under a configured Downloads subfolder | Implemented in v0.1.10; optional Downloads permission required |
| Export | Automatic Markdown to Downloads, selected folder when dashboard open | Implemented; browser permission required |
| Portability | JSON backup/import for chat transcripts and clips | Implemented, manual; not cloud chat sync |
| Quick save | Capture selected text or links from browser context menu | Implemented |
| Preferences | Optional RTL text fields on permitted sites | Implemented |
| Local agent | Optional local Laya decision suggestions | Implemented integration; requires external local process |
| Security | Per-site capture permission, opt-in host permissions, no server upload | Implemented intent; ongoing audit required |
| Quality | Node tests and GitHub Actions extension checks/package | Implemented; no complete live-provider E2E suite |

The toolbar popup and page-Markdown behavior are described in `docs/UPDATES_AND_PAGE_EXPORT.md`. The product preview is a concept illustration, not evidence of live Chrome validation.

## Prioritized proposed features (not implemented)

### P0 — Reliability and data safety

- **Live Chrome E2E tests** for starting/changing/continuing AI chats and saving/restoring bookmark collections. Verify realistic site changes, service-worker restarts and multi-device Bookmark Sync manually.
- **Sync diagnostics**: show Chrome bookmark path, bookmark sync user checklist, recent local bookmark changes, and explicit 'sync status not observable' rather than claiming cloud success.
- **Crash-safe bulk actions**: resumable session writes, progress and cancel, multi-folder rollback and large-list pagination.
- **Export/restore all Veyra data**: include saved-tab folder structure, category rules and UI settings, without copying unrelated personal bookmarks.
- **Privacy review**: redact known sensitive URL query parameters on demand, warn about token-bearing URLs, protect sensitive settings from content-script access.
- **Remove UI hardcoded translations**, strengthen authorization for sensitive background messages, independent test results for every supported AI provider.

### P1 — Saved-tab productivity

- **Workspaces and projects:** reusable named spaces spanning categories, checklists and notes.
- **Snapshots and history:** update an existing saved collection, compare snapshots and undo an erroneous move/delete.
- **Auto-save on close / restore last session:** OFF by default, configurable rules and privacy exceptions.
- **Tab suspend / memory-saver assistant:** suggestion-first, do not discard without consent.
- **Tags and favorites:** multiple tags per link, pinned collections and smart filters.
- **Keyboard commands and bulk select:** multi-select move/save/restore, drag-and-drop reordering.
- **Cross-device handoff:** identify source machine, see recently active tabs and optionally reopen in a new window.
- **Search index:** fuzzy search saved-tab titles/URLs, deduplication by canonical URL and similarity groups.
- **Templates:** predefined Work/Research/Personal sessions and shared bundles by a user-generated export file.
- **Session reminders:** scheduled revisit, snooze, temporary collections and expiration warnings.

### P2 — Long-term extension platform

- **Secure full archive sync:** optional end-to-end encrypted storage with an explicit provider, account setup and quota budget, separately from Chrome Bookmark Sync.
- **Google Drive / WebDAV / local folder backup:** user-chosen opt-in provider, conflict resolution and encryption.
- **Browser-independent portability:** Firefox/Edge cross-browser export/import and stable extension IDs for managed deployments.
- **Offline full-text search of captured AI chats** with indexed highlights and full Unicode/Persian support.
- **AI organization:** local-model semantic grouping, duplicate detection and title suggestions, never auto-deleting.
- **Advanced workspaces:** custom fields, statuses, notes, kanban/board, tasks, attachment references and review calendar.
- **Permission dashboard:** clear site access controls, storage usage, export health and an audit log.
- **Automatic and scheduled reports:** activity review, unread/revisit backlog and category utilization.
- **Public release pipeline:** signed distribution via Chrome Web Store, release notes, upgrade/migration path and end-to-end smoke checks.
- **Accessibility:** WCAG-focused keyboard workflows, screen-reader semantics, reduced motion, localization validation and high-contrast mode.

## Explicit non-goals / guardrails

- Never confuse bookmark-folder portability with full AI transcript sync.
- No full account tracking, hidden history capture, automatic deletion or remote upload without clear user consent.
- Do not change the existing unpacked extension ID without backup/migration instructions; this can disconnect existing local chat archives.
- Never silently overwrite or erase the user's preexisting bookmarks outside `Veyra — Saved Tabs`.
