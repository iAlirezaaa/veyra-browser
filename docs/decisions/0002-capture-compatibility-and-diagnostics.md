# ADR 0002 — Robust AI DOM capture diagnostics (2026-11-03)

## Problem

Capture v0.1.2 frequently appeared to do nothing: new ChatGPT Chat/Work DOM can omit legacy `data-message-author-role`; service-worker/content-script failures were hidden and the manual scan always displayed a success toast. Users had no reliable path to distinguish missing site access, unsupported layout, browser archiving, and Markdown file export.

## Decision (old → new)

- Legacy role-attribute-only selectors → explicit per-platform role selector fallbacks, including ChatGPT's new content-search-unit markers. Only role-marked conversation nodes are collected.
- Silent failure → bounded diagnostic events (provider, status, count, timestamp, truncated error); no message text in diagnostics.
- Generic "success" manual scan → per-tab response showing saved/waiting/no-messages/error.
- Setup only from dashboard → optional **Start saving this AI chat** popup action with per-origin permission prompt.
- Preserve optional host permissions, no default broad capture, no new telemetry or cloud sync.

## Risks and rollback

The HTML selectors are best-effort and can become stale, especially with virtualized threads. A user can disable provider capture at any time; no automatic deletion or unrequested page scanning is introduced. If false positives appear, disable site capture and revert the per-site selector set. Keep IndexedDB `veyra-v1` unchanged, so rolling back to v0.1.2 does not migrate or erase local data.

## Verification

Node content-script route/DOM tests, service-worker storage contract tests, and Chromium simulated modern ChatGPT DOM smoke test. Real Chrome with a signed-in ChatGPT account still needs manual validation.
