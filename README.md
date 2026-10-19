# Chat Topic Router

**Made by Keiah.** A local-first browser extension for pulling one useful question out of a mixed AI chat and putting it in the right project inbox.

**Works on its own. Even better with Obsidian.** Use Router independently to organize selected chat passages, search your project inboxes, and copy handoffs to another AI chat. No Obsidian setup is required. Connect it to Obsidian when you want to keep captures as local Markdown notes and link them to your existing project knowledge.

> Working in one project chat and remember a question for another? Select that passage, route it to the destination project, and continue it in the right chat while the original stays intact.

## What it does

- Captures only the text you select on ChatGPT, Claude, or Gemini.
- Opens the routing form in its own extension tab, keeping typing out of the AI chat box.
- Organizes passages in local project inboxes with reusable project context.
- Searches, filters, marks done, moves, bulk-copies, and deletes saved passages.
- Creates a handoff prompt that carries the relevant project and passage context to another chat.
- Optionally appends routed passages to project notes in an Obsidian vault.
- Exports a filtered Markdown handoff list and backs up or restores all projects and passages as JSON.
- Keeps storage in the browser profile. No AI API key, account, server, analytics, or cloud sync.

## Install for testing

1. Download **Source code (zip)** from the [latest GitHub release](https://github.com/r3dn1nja07/chat-topic-router/releases/latest) and extract it, or clone this repository.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the folder containing `manifest.json`.
5. Open a ChatGPT, Claude, or Gemini conversation. Select the passage to route, then click **Route selection.** or right-click and choose **Route selected text to a project.**
6. Enter a project name (for example, `Project B`) and optional context. Open the extension popup to search, manage, and continue the saved passage.

This is an unpacked developer build. It does not auto-update and has not been published in a browser extension store.

After selecting text, choose **Route selection** or right-click and choose **Route selected text to a project**. The form opens in a separate Chat Topic Router tab. Its temporary passage draft stays in browser session storage, is not placed in the tab URL, and is cleared when saved or when the form tab is closed.

## Optional Obsidian destination

Chat Topic Router works without Obsidian. If you already use Obsidian, open the extension popup, choose **Obsidian**, enter your vault's exact name and an optional folder, then save. Each saved passage has an **Add to Obsidian** action that opens or appends it to a note named for its project. Obsidian creates the note if it does not exist.

This uses Obsidian's local [`obsidian://` URI handler](https://help.obsidian.md/Extending+Obsidian/Obsidian+URI). Obsidian must be installed and the vault name must match. The Router keeps its browser-local copy as well; it does not sync or delete it after opening Obsidian. The source conversation URL is omitted from the note. Very long passages should be exported as Markdown instead, because operating systems limit the size of links passed to desktop apps.

### Link an existing project note

To connect captures to an existing Obsidian project note, choose **Projects → Edit**, enter its vault-relative path in **Main Obsidian project note** (for example, `projects/Project A Main`), and save. Future **Add to Obsidian** actions append to a separate `Project A Captures.md` note in your configured folder, with a `[[projects/Project A Main]]` link. Obsidian shows that capture note in the main note's backlinks. Router cannot verify that the target exists; use its exact path. Leaving this field blank preserves the existing destination. Earlier exports are unchanged, and backups preserve this setting.

## Run tests

Requires Node.js 18 or newer. From the repository folder:

```sh
npm test
```

The automated tests cover provider URL validation, selected-text limits, project creation, legacy data migration, handoff privacy, and Obsidian link generation. They do not replace manual testing in signed-in provider chats or opening links in the Obsidian desktop app.

## Privacy and limits

- The extension stores selected text, project notes, and source labels in `chrome.storage.local` on this browser profile.
- Source conversation URLs are stored locally but omitted from copied handoffs and Markdown exports by default.
- No network request, model API, account, or server is used by the extension itself.
- It does not read full conversation histories or physically move or remove messages in ChatGPT, Claude, or Gemini. It keeps a local copy and prepares a handoff for a separate chat.
- Backups can contain private conversation text. Store exported files with the same care as your chats.
- Browser vendor UI and permissions can change. Support is experimental until manually tested on each provider and browser.

## Author and license

Made by **Keiah**. Released under the MIT License; see [LICENSE](LICENSE).
