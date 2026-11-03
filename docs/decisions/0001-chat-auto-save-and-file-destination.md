# ADR-0001 — Opt-in AI capture and user-controlled storage

**Status:** Accepted for Veyra 0.1.2 (2026-11-03).

## Problem

Creating a new AI conversation may change its URL client-side without a full navigation; content is streamed. The old one-time capture did not reliably detect the new conversation. Users also need OS-level choice of file destination.

## Decisions

1. Opt-in per-AI-site permissions are mandatory; never silently read conversations.
2. Detect SPA route changes, observe message mutations, debounce snapshots, and retry transient extension-worker errors. Do not save a generic homepage as a conversation.
3. Store captures first in local IndexedDB to avoid OS permission failures preventing capture.
4. Export Markdown via three modes: browser-only; validated subfolder relative to Downloads using Chrome Downloads API; selected arbitrary OS folder via a user-initiated File System Access picker.
5. The selected folder handle is persisted locally in IndexedDB. The File System Access API only operates in the open dashboard context with permission. A closed dashboard cannot guarantee background arbitrary-folder export.
6. Deduplicate snapshots and track file-export acknowledgements/receipts to avoid uncontrolled repeat writes.
7. Never upload captured user content to GitHub, external analytics, or remote servers. Respect MV3 service worker lifetime.

## Verification

Unit tests for URL canonicalization, safe paths, capture routing and folder adapters; npm run check; ZIP package validation in CI. DOM selectors on third-party AI services may change, so end-to-end browser testing remains required.

## Rollback

An archive-only mode is always available. Optional permissions can be revoked in Chrome. Export JSON backup before reinstalling or resetting the profile.
