# Installing Veyra 0.1.5 (Chrome / Edge / Brave)

**Installer package:** [dist/veyra-v0.1.5-chrome.zip](dist/veyra-v0.1.5-chrome.zip). It is an **unpacked extension archive**, not an executable installer and not a Chrome Web Store release.

1. Download the ZIP using GitHub's **Download raw file** action.
2. Extract all files to a permanent folder. Confirm `manifest.json` is directly inside that folder.
3. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode.
4. Choose **Load unpacked**, select the extracted folder, and open a new tab.
5. In Veyra Settings → Appearance & language, choose **System**, **Light** or **Dark**. The theme is saved and also applies to the toolbar popup; System tracks your operating-system appearance.

**Updates:** Download and extract the newer package into the **same folder**, then click **Reload** on the extension card in the browser. Moving the folder or loading an independently extracted copy can change its extension ID and isolate the old browser data. Back up your Veyra archive first using Settings → Export backup. Never delete your browser's old profile data before importing backup successfully.

**Security:** Third-party AI capture is opt-in and is not automatically activated. This MVP has not been reviewed by the Chrome Web Store. Review the permissions in `manifest.json` before installation. The ZIP's SHA-256 is listed in [dist/SHA256SUMS.txt](dist/SHA256SUMS.txt) and also checked by CI.

**Persian / فارسی:** فایل ZIP را دانلود و استخراج کنید، سپس به `chrome://extensions` بروید، Developer mode را فعال کنید و با Load unpacked پوشه حاوی `manifest.json` را انتخاب کنید. تغییر حالت روشن/تیره/سیستم از تنظیمات ویرا یا پنجره افزونه ممکن است.

## Update to v0.1.5

Download `dist/veyra-v0.1.5-chrome.zip`, extract over your **existing extension directory**, then Reload in `chrome://extensions`. Keep the original extension path to preserve its identity and locally stored chats. Make a backup before updating. If the dashboard doesn't show conversations, open Settings → Capture settings and explicitly enable the AI providers (or the one-click Enable automatic capture button).

## Capture troubleshooting (v0.1.5)

1. Open Veyra → Settings → **Enable automatic capture**, grant access to the selected AI website(s). Veyra cannot silently grant browser host permissions.
2. Start a **new** chat on one of those sites. Open Veyra → AI conversations; initial messages can appear as a draft before the site assigns a permanent URL.
3. If nothing appears: Veyra → Settings → **Check open AI chats**. Under each provider read **Last detected / Waiting URL / No messages / Capture error**.
4. Reload the AI tab after an extension upgrade. If the site changed its DOM, capture may require an extractor update; do not assume the archived chat is complete.
5. The selected-folder export is separate from the internal archive: the dashboard must stay open for synchronization and the folder must remain authorized.

## Tab organization
Open a new tab → **Open tabs** → **Organize Chrome tabs**. Click confirm. If you want new tabs grouped automatically, enable **Auto-organize new tabs**. This is off by default. Pinned tabs and already grouped tabs are preserved. The visible status reports the actual results and errors. **Dashboard sort** only sorts the Veyra list; it does not change your Chrome tab strip.
