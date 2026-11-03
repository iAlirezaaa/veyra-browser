# Roadmap (proposed, not implemented)

## 0.1 — current MVP

- [x] Chrome Manifest V3 new-tab dashboard; modern responsive minimal UI
- [x] Tab and bookmark overview; dedup suggestions; opt-in history
- [x] Local chat snapshots, context-menu clips, Markdown and JSON export
- [x] FA/EN with RTL; per-site text field RTL toggles
- [x] Local opt-in Laya decision suggestions; human Yes/No approval
- [x] Node unit tests and GitHub CI workflow
- [ ] Real Chrome manual integration testing, accessibility audit, provider fixtures
- [ ] Full Chrome Web Store permission/privacy review

## 0.2 — robust capture & organization

- [ ] Browser-tested ChatGPT/Claude/Gemini/Grok/Perplexity capture adapters and long-chat virtual scrolling
- [ ] One-click manual full chat export through explicitly invoked upstream export adapters
- [ ] User-created tags, folders, session snapshots and advanced search filters
- [ ] Incremental full-text search index, metadata normalization, dedup/migration tests
- [ ] Search across saved links, URLs, selections and conversation content with clear privacy control
- [ ] Read-only connector to Second Brain OS through consented local API

## 0.3 — extensible browser workspace

- [ ] Native messaging companion for reliable encrypted local archive and user-chosen folder writes
- [ ] Bidirectional send/receive adapters to agent workflows, open JSON/Markdown standards
- [ ] Browser notes, read-it-later, session restoration, optional sync with E2E encryption
- [ ] Structured Laya choice/score decisions, confidence gating and decision audit trail
- [ ] User-configurable automation rules with dry-run, confirmation, undo and rollback
- [ ] Plugin API for language tools, site RTL, accessibility and custom productivity widgets

## Release gates

Before claiming stability: test capture completeness on real production pages; evaluate security permissions; measure dashboard cold start and memory; implement IndexedDB migrations; test backup restore and browser shutdown recovery. Do not confuse a unit-tested MVP with a published or production-ready extension.
