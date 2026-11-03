# ADR 0004 — Loss-averse incremental long-chat sync

Date: 2026-11-03. Status: implemented in v0.1.7.

## Problem

The previous capture adapter read at most 600 turns, clipped text to 16,000 characters per message, and limited total stored transcript text to 250,000 characters. Longer conversations could stop updating or lose history when third-party AI sites only rendered a subset of the DOM.

## Decision

- Read only opt-in permitted AI pages; send overlapping, bounded batches from currently loaded DOM messages.
- Match stable message identifiers when available and exact contextual overlaps otherwise. Preserve stored unseen history, even if the currently loaded page shows only the tail.
- Merge changes into the canonical URL record (including edits and streaming updates) using serialized background writes to prevent concurrent lost updates.
- Reject ambiguous, unanchored partial windows instead of inventing an ordering. Report the condition in capture diagnostics.
- Keep a 20,000 message / 24 million character per-conversation safety limit with a visible failure rather than silently truncating the oldest turns.
- Mirror long chats to Downloads in multiple numbered Markdown files; retain selected-folder sync and Markdown export from the complete archive.
- Avoid rendering the full chat DOM inside Veyra: show recent 120 turns with an older-messages control.

## Limits

No server-side API scraping or hidden-page collection. Sites may virtualize turns outside the loaded DOM. Without shared anchors the app cannot prove the placement of a new fragment. The model tests cover 1,500-turn chats, streaming edits, duplicate suppression, and partial-window retention, but real Chrome/provider E2E testing is still required.
