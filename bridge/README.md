# Central brain bridge

Node.js 20+, no dependencies. Search reuses an existing `searchSources(query, {roots, limit})` module. The read roots are your existing Obsidian vault and Shared Brain JSONL; captures write only under `Chat Inbox/Router Captures` in that vault. Search makes each saved Markdown capture available to existing Shared Brain search clients, without duplicating the passage into the memory graph or rewriting memory.jsonl.

## Setup

Run once, with absolute paths appropriate to your PC:

```sh
node bridge/setup.mjs PRIVATE_FOLDER VAULT MEMORY_JSONL SEARCH_MODULE
node bridge/server.mjs PRIVATE_FOLDER/bridge-config.json
```

Keep PRIVATE_FOLDER outside the repository. Its configuration and `pairing-key.txt` contain the private pairing key. The bridge listens on `127.0.0.1:4828`; it has no automatic startup task. Stop the Node process to disconnect it. No npm install is needed.

Reload the updated unpacked extension. In Router, expand **Central brain**, paste the key from `pairing-key.txt`, and select **Connect / check**. The extension stores the key in browser-local extension storage, separately from backups. Use **Disconnect** to remove that browser's key; to revoke all paired clients, stop the bridge and replace its configuration with a freshly generated key.

Search returns bounded source/line excerpts, with a copy action. It never automatically inserts retrieved private text into a hosted AI chat. Each passage's **Save to central brain** button writes one capture note, excludes the source URL, and shows the saved path. Repeated clicks do not append duplicate notes. Edited content with the same capture ID produces a conflict; existing notes are never overwritten. Pattern checks block common credential formats but cannot detect every secret or sensitive detail; review passages before saving.

The bridge checks the pairing key, loopback Host, and extension Origin when present. It provides no CORS grants to ordinary web pages and does not accept browser-page requests. The key is an access credential; anyone possessing it locally can use the configured read and capture capabilities. Private setup files and browser storage rely on your Windows account permissions, not encryption.

## Checks

`npm test` includes isolated bridge HTTP and capture tests. Live pairing in Chrome/Edge must be verified in the installed extension; Node tests cannot prove browser permissions or local-network policies.
