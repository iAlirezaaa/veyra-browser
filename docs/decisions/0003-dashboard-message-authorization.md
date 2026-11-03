# ADR-0003: Authenticate new-tab messages by extension page identity

Date: 2026-11-03 | Status: accepted

## Problem
Versions 0.1.5 and earlier denied `TAB_ASSIGN`, `TAB_CATEGORIES`, `TAB_SORT`, `TAB_GROUP_CHROME`, `TAB_REORDER_CHROME`, `TAB_ORGANIZE_CHROME`, and `TAB_AUTO_ORGANIZE` whenever `sender.tab` existed. **Chrome populates `sender.tab` for messages originating from the Veyra new-tab override**, so legitimate actions were rejected with “This action is only available from the Veyra dashboard.”

## Decision
Use `isTrustedDashboardSender(sender, chrome.runtime)` to verify both the runtime extension ID and the exact `chrome-extension://.../src/ui/newtab.html` URL path. Do not use `sender.tab` as a content-script discriminator: both extension tabs and content scripts may have one.

The dashboard may have an optional fragment/query string. All third-party sites, other extension IDs, and other extension pages fail this authorization gate. Capture messages remain handled separately.

## Verification
Regression tests exercise the actual service-worker message handler with a sender carrying both `sender.tab` and a legitimate new-tab URL, plus rejected content-script/forged messages. Sorting/grouping tests remain in `tab-organizer.integration.test.js`. After installation, use the Open tabs → Organize Chrome tabs button on a Chrome window containing at least two unpinned, ungrouped HTTP(S) tabs.

## Limitations
Automated tests simulate the browser messaging contract and tab APIs. Native Chromium end-to-end integration could not be completed in the current execution environment. Do not interpret test success as proof of user-browser behavior.
