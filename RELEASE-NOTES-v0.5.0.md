# v0.5.0 — Central brain retrieval and capture

- Added optional authenticated loopback bridge on port 4828 using the existing local search module.
- Added cited Obsidian/Shared Brain search and manual capture buttons in the extension.
- Captures are exclusive-create Markdown files under the vault's `Chat Inbox/Router Captures`, available immediately through existing Shared Brain search. The memory graph remains a separate store for selected durable facts; passage bodies are not duplicated into it.
- Source URLs are omitted, common credential formats are blocked, and duplicate saves are idempotent.
- Added one extension host permission: `http://127.0.0.1:4828/*`.
- The bridge requires separate local setup and pairing. No automatic capture, cloud service, startup task, history import, or automatic insertion into AI chats is enabled.

See [bridge/README.md](bridge/README.md). Existing skill kit remains included. Browser integration needs live verification after extension reload and pairing.
