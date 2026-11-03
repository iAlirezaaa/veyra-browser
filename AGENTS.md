# Agent Handoff — Veyra

## Mission

Build a fast, trustworthy, bilingual browser command center that both humans and automation can understand. Preserve user control and discoverability. Read `docs/PRODUCT_CHARTER.md` **before** changing behavior or data models.

## Non-negotiable architecture rules

1. **Local first, permission first:** no bulk collection, transmission or AI-page injection before explicit consent per origin. History must remain optional.
2. **Human-approved destructive actions:** never delete chats, clips, bookmarks, history or tabs based solely on Laya, heuristics or the background review job.
3. **Accessible in both languages:** every new UI string must have English and Persian translations, proper `dir=rtl/ltr`, visible labels and keyboard access.
4. **Data survives upgrades:** do not replace IndexedDB schema or remove records without a migration plan and a rollback test; export uses open JSON/Markdown.
5. **Keep startup quick:** the new-tab UI must render useful cached content before a slow Laya endpoint or network request.
6. **Respect upstream licenses:** adapted MIT sources require original notices. Keep `THIRD_PARTY_NOTICES.md` current; do not copy incompatible code.
7. **Modular providers:** AI DOM capture lives in `src/content/capture.js`; avoid reading unrelated page content. Track limitations and add per-provider fixtures/tests before claiming full transcript fidelity.
8. **No unsolicited data exfiltration, analytics, background uploads or undisclosed integrations.**

## Repo layout

- `manifest.json`: Chrome MV3 capabilities/permissions.
- `src/ui/*`: bilingual new-tab page, popup, view controllers, responsive styles.
- `src/core.js`: pure tab classification, duplicates and export logic.
- `src/background.js`: permissions, alarms, bounded data handling, context menu and controlled actions.
- `src/db.js`: versioned local IndexedDB.
- `src/content/*`: consent-gated site adapters.
- `src/laya.js`: localhost-only advisory decision transport.
- `src/vendor/*`: adapted MIT components.
- `tests/*`: unit tests. Use `npm run check` before proposing merges.
- `docs/*`: stable charter, architecture and staged roadmap.

## QA checklist

- Test Persian and English, dark and light, keyboard navigation, 320px to desktop.
- Test a real Chrome profile with the five AI platforms and a long virtualized chat (manual validation is still pending).
- Test denying host/history permission. Confirm no chat was written.
- Test tabs that navigate after a review card renders, private/internal URLs, duplicate query params, pinned tabs, and Chrome service worker suspension.
- Test backup roundtrip and legacy database migrations before release.
- Treat `npm test` as necessary but not sufficient. Never mark Chrome behavior production-ready without browser testing.

## Change policy

If a change affects consent, deletion, data ownership, bilingual support, new-tab ownership or the product's purpose: document an ADR in `docs/decisions/` with **old → new**, tradeoffs, risks and rollback; request owner approval before merging.
