# Updates and full-page Markdown export

## Save a complete web page

Open any normal `http` or `https` page and use the Veyra toolbar popup to save the current page as Markdown, or use the browser context menu:

**Save page as Markdown (.md)**

Veyra asks for the optional Downloads permission only when a Markdown export is requested. In the popup, choose a filename pattern (`{title}`, `{domain}`, `{date}`), then either choose a destination each time or save directly into a configurable subfolder under Downloads. These settings also apply to the context-menu command. The exported file contains page title, canonical URL, capture time, description, readable main content, headings and up to 100 page links. Tab bookmarks are organized in a selected category shared with the dashboard. This is a user-triggered export; no page is collected in the background.

## Updates

The GitHub Actions workflow runs on every push and pull request, validates the extension, and on pushes to `main` publishes a fresh installable ZIP plus SHA-256 checksum under `dist/`.

Chrome does not allow an unpacked extension to silently replace its own code from a Git commit. For a local installation, install the newly generated ZIP (or reload the unpacked extension after pulling). For hands-off browser updates, publish the extension through the Chrome Web Store; Chrome then manages updates using the Web Store update mechanism.

Veyra can also check the public GitHub Releases endpoint at Chrome startup and every six hours. It displays the current/latest version and release link in Settings. This is a version check, not an automatic code installer. Ordinary commits are visible there only after a GitHub Release is created.

## External completion notifications

In Settings, enter an HTTPS webhook URL and save it. Veyra sends a JSON POST for a finished task with `event`, page title, origin, task URL and timestamp. Prompt and response text are excluded. Use **Send test event** to validate the receiver. Leaving the URL blank disables external delivery. HTTPS and a URL without embedded credentials are required.
