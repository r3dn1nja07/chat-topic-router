# Chat Topic Router

**Made by Keiah.** A local-first browser extension for pulling one useful question out of a mixed AI chat and putting it in the right project inbox.

> Working in one project chat and remember a question for another? Select that passage, route it to the destination project, and continue it in the right chat while the original stays intact.

## What it does

- Captures only the text you select on ChatGPT, Claude, or Gemini.
- Organizes passages in local project inboxes with reusable project context.
- Searches, filters, marks done, moves, bulk-copies, and deletes saved passages.
- Creates a handoff prompt that carries the relevant project and passage context to another chat.
- Exports a filtered Markdown handoff list and backs up or restores all projects and passages as JSON.
- Keeps storage in the browser profile. No AI API key, account, server, analytics, or cloud sync.

## Install for testing

1. Download the `chat-topic-router-v0.3.0.zip` package from the [latest GitHub release](https://github.com/r3dn1nja07/chat-topic-router/releases/latest) and extract it, or clone this repository.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the folder containing `manifest.json`.
5. Open a ChatGPT, Claude, or Gemini conversation. Select the passage to route, then click **Route selection.** or right-click and choose **Route selected text to a project.**
6. Enter a project name (for example, `Project B`) and optional context. Open the extension popup to search, manage, and continue the saved passage.

This is an unpacked developer build. It does not auto-update and has not been published in a browser extension store.

## Run tests

Requires Node.js 18 or newer. From the repository folder:

```sh
npm test
```

The automated tests cover provider URL validation, selected-text limits, project creation, legacy data migration, and handoff privacy. They do not replace manual testing in signed-in provider chats.

## Privacy and limits

- The extension stores selected text, project notes, and source labels in `chrome.storage.local` on this browser profile.
- Source conversation URLs are stored locally but omitted from copied handoffs and Markdown exports by default.
- No network request, model API, account, or server is used by the extension itself.
- It does not read full conversation histories or physically move or remove messages in ChatGPT, Claude, or Gemini. It keeps a local copy and prepares a handoff for a separate chat.
- Backups can contain private conversation text. Store exported files with the same care as your chats.
- Browser vendor UI and permissions can change. Support is experimental until manually tested on each provider and browser.

## Author and license

Made by **Keiah**. Released under the MIT License; see [LICENSE](LICENSE).

