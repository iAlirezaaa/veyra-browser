# Installing Veyra 0.1.6 (Chrome / Edge / Brave)

**Installer package:** [dist/veyra-v0.1.6-chrome.zip](dist/veyra-v0.1.6-chrome.zip). It is an **unpacked extension archive**, not an executable installer and not a Chrome Web Store release.

1. Download the ZIP using GitHub's **Download raw file** action.
2. Extract all files to a permanent folder. Confirm `manifest.json` is directly inside that folder.
3. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode.
4. Choose **Load unpacked**, select the extracted folder, and open a new tab.
5. In Veyra Settings → Appearance & language, choose **System**, **Light** or **Dark**. The theme is saved and also applies to the toolbar popup; System tracks your operating-system appearance.

**Updates:** Download and extract the newer package into the **same folder**, then click **Reload** on the extension card in the browser. Moving the folder or loading an independently extracted copy can change its extension ID and isolate the old browser data. Back up your Veyra archive first using Settings → Export backup. Never delete your browser's old profile data before importing backup successfully.

**Security:** Third-party AI capture is opt-in and is not automatically activated. This MVP has not been reviewed by the Chrome Web Store. Review the permissions in `manifest.json` before installation. The ZIP's SHA-256 is listed in [dist/SHA256SUMS.txt](dist/SHA256SUMS.txt) and also checked by CI.

**Persian / فارسی:** فایل ZIP را دانلود و استخراج کنید، سپس به `chrome://extensions` بروید، Developer mode را فعال کنید و با Load unpacked پوشه حاوی `manifest.json` را انتخاب کنید. تغییر حالت روشن/تیره/سیستم از تنظیمات ویرا یا پنجره افزونه ممکن است.

## Update to v0.1.6

Download `dist/veyra-v0.1.6-chrome.zip`, extract over your **existing extension directory**, then Reload in `chrome://extensions`. Keep the original extension path to preserve its identity and locally stored chats. Make a backup before updating. If the dashboard doesn't show conversations, open Settings → Capture settings and explicitly enable the AI providers (or the one-click Enable automatic capture button).

## Capture troubleshooting (v0.1.6)

1. Open Veyra → Settings → **Enable automatic capture**, grant access to the selected AI website(s). Veyra cannot silently grant browser host permissions.
2. Start a **new** chat on one of those sites. Open Veyra → AI conversations; initial messages can appear as a draft before the site assigns a permanent URL.
3. If nothing appears: Veyra → Settings → **Check open AI chats**. Under each provider read **Last detected / Waiting URL / No messages / Capture error**.
4. Reload the AI tab after an extension upgrade. If the site changed its DOM, capture may require an extractor update; do not assume the archived chat is complete.
5. The selected-folder export is separate from the internal archive: the dashboard must stay open for synchronization and the folder must remain authorized.

## Tab organization
Open a new tab → **Open tabs** → **Organize Chrome tabs**. Click confirm. If you want new tabs grouped automatically, enable **Auto-organize new tabs**. This is off by default. Pinned tabs and already grouped tabs are preserved. The visible status reports the actual results and errors. **Dashboard sort** only sorts the Veyra list; it does not change your Chrome tab strip.

## When “Organization not available” is shown

Previous versions blocked requests from the Veyra new-tab page because they incorrectly checked `sender.tab`. This has been corrected in v0.1.6. In `chrome://extensions`, check that the extension card shows **0.1.6**. Extract into the existing installation directory and click **Reload**. **Close old Veyra dashboard tabs and open a fresh new tab** so you are not running the old page script. Review any pending Chrome permission prompts, including Tab Groups permission, after the upgrade.

If it still fails, open `chrome://extensions` → Veyra → **Service worker / Inspect views** and record the exact console error (do not share any chat text). Also check whether the operation has web tabs available: pinned tabs, internal Chrome URLs and pre-existing groups are intentionally excluded.

## Version 0.1.7 — Long conversation updates

Download [Veyra 0.1.7 ZIP](dist/veyra-v0.1.7-chrome.zip), extract into the **existing extension directory**, then click **Reload** in chrome://extensions and open a fresh Veyra dashboard tab. Existing locally archived chats are not cleared by this version update. Enable per-site AI capture in Settings. New replies update the same conversation. For older virtualized turns, scroll within the original AI site to make them visible. The Capture health status reports non-overlapping windows rather than silently overwriting prior content.


## v0.1.8 — Saved tabs and cross-device Chrome Bookmarks

Open a new Veyra tab -> **Saved tabs**. Choose a category, optionally enter a collection name, then Save open tabs or Save by category. Single tab rows also have a Save to Veyra action. Saved collections appear in Chrome Bookmarks under `Other bookmarks / Veyra — Saved Tabs`.

To access them on a second machine, sign into the **same Google Account in Chrome** and enable **Bookmarks Sync** in Chrome settings. Sync completion is controlled by Chrome and is not reported by the extension. Install Veyra on the second machine to access the dashboard, or open the bookmarks directly without it. If Chrome Sync is disabled, the data remains local. AI chat transcripts do not move this way.

The unpacked extension ID has not been changed. This intentionally preserves access to existing local chat archives when upgrading in the same installation folder.
