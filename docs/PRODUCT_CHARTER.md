# Veyra product charter — protected design intent

**Primary purpose:** A single, low-friction browser workspace for humans and agents. Users can always **find, read, understand, organize and export** their own information. The browser is a knowledge space, not merely a tab counter.

## Invariants

1. **One clear home:** new-tab becomes the core dashboard; the main navigation stays predictable as modules grow.
2. **Readable + discoverable:** categories, provenance, search and accessible UI must be preserved alongside machine-readable records.
3. **Local-first data ownership:** durable, exportable data, minimal permissions, explicit integrations.
4. **Human + agent compatibility:** users make final decisions; future agents receive typed, logged capabilities and never uncontrolled delete rights.
5. **Fast + quiet:** prioritize instant navigation, low memory use, lazy loading, incremental analysis and unobtrusive notifications.
6. **Decision layer, not automation authority:** Laya produces typed yes/no, choice, score suggestions and calibrated confidence; uncertain cases go to the user.
7. **Bilingual from day one:** Persian and English translations, RTL/LTR, proper dates/numerals and culturally neutral visual language.
8. **Expandable modules:** tabs, bookmarks, history, AI chats, clips, notes, saved media, imports, browser sync, right-to-left fields and integrations can be added without destroying original data.
9. **Reversible organization:** never silently delete originals, alter bookmarks, move tabs or submit chats without informed permission.
10. **Third-party integrity:** respect licensing and avoid vendor lock-in.

This charter is a **guardrail**, not an excuse to block engineering improvement. Any incompatible proposal must come with an ADR specifying what changes, why it is superior, and how users can opt out or roll back.

## Current product surface (v0.1.10)

- **Dashboard:** new-tab workspace for open tabs, saved tabs, bookmarks, chat archive, clips, settings and local review suggestions.
- **Toolbar popup:** contextual quick save of the active tab into the Veyra bookmark library; opt-in AI chat capture; page-to-Markdown export with configurable filename tokens and destination; language/theme controls.
- **Saved-tab taxonomy:** default categories include Repo, Agents and AI LLM; dashboard users can maintain additional categories, shared with the popup through saved bookmarks.
- **Markdown destination:** ask for a location per export or save into a validated relative subfolder beneath Chrome Downloads. The optional Downloads permission is requested from an explicit user action.
- **Visual direction:** restrained unslop-informed UI and proposed SkyVision semantic colors. SkyVision's source repository describes its identity as unapproved and its license as unspecified; the product references published color tokens and does not bundle its artwork or logo assets.
- **Illustration:** `assets/product-preview.png` is a concept rendering of the current interface for documentation. It is not evidence of live-browser operation or production approval.

See `docs/UPDATES_AND_PAGE_EXPORT.md` for behavior and limitations. Automated test success does not imply provider-site or browser end-to-end verification.
