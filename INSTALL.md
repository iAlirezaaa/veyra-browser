# Installing Veyra 0.1.2 (Chrome / Edge / Brave)

**Installer package:** [dist/veyra-v0.1.2-chrome.zip](dist/veyra-v0.1.2-chrome.zip). It is an **unpacked extension archive**, not an executable installer and not a Chrome Web Store release.

1. Download the ZIP using GitHub's **Download raw file** action.
2. Extract all files to a permanent folder. Confirm `manifest.json` is directly inside that folder.
3. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode.
4. Choose **Load unpacked**, select the extracted folder, and open a new tab.
5. In Veyra Settings → Appearance & language, choose **System**, **Light** or **Dark**. The theme is saved and also applies to the toolbar popup; System tracks your operating-system appearance.

**Updates:** Download and extract the newer package into the **same folder**, then click **Reload** on the extension card in the browser. Moving the folder or loading an independently extracted copy can change its extension ID and isolate the old browser data. Back up your Veyra archive first using Settings → Export backup. Never delete your browser's old profile data before importing backup successfully.

**Security:** Third-party AI capture is opt-in and is not automatically activated. This MVP has not been reviewed by the Chrome Web Store. Review the permissions in `manifest.json` before installation. The ZIP's SHA-256 is listed in [dist/SHA256SUMS.txt](dist/SHA256SUMS.txt) and also checked by CI.

**Persian / فارسی:** فایل ZIP را دانلود و استخراج کنید، سپس به `chrome://extensions` بروید، Developer mode را فعال کنید و با Load unpacked پوشه حاوی `manifest.json` را انتخاب کنید. تغییر حالت روشن/تیره/سیستم از تنظیمات ویرا یا پنجره افزونه ممکن است.


## Enable automatic conversation capture

After reloading the extension, open Veyra Settings and click **Enable automatic AI capture**. Accept the explicit per-site browser permissions. Start a new ChatGPT/Claude/Gemini/Perplexity/Grok conversation and check the **last capture** indicator. For a tab already open before enabling capture, reload the AI page if necessary. Captures are stored in local browser IndexedDB.

## Choose an export destination

- **Browser only (default):** conversation archive stays in the Chrome profile, without writing OS files.
- **Downloads subfolder:** enter a relative subfolder like `Veyra/Chats`, grant Downloads permission, and enable automatic Markdown exports. Absolute paths, traversal and invalid characters are rejected.
- **Selected folder:** click **Choose folder**, pick an OS directory, and approve the browser's read/write permission. Sync happens from the Veyra dashboard when open and resumes at next dashboard visit; background arbitrary-folder writes are not possible while the dashboard is closed.

Do not uninstall your old extension before exporting a backup. The v0.1.2 build is an early developer-mode build, not a Chrome Web Store verified installer.
