# Chat Topic Router v0.3.1 — early tester build

Made by Keiah.

- Route selected passages in a separate tab so typing stays out of the AI chat box.
- Close the form automatically after a confirmed save.
- Explain when an AI chat tab needs refreshing after an extension reload.
- Fix Obsidian links for vaults and notes containing spaces.
- Optionally link captures to an existing main project note, with captures stored separately.
- Give the project editor more space and hide unused selection controls.

## Verified

Keiah verified capture, save, automatic closing, and export to a real Obsidian vault from ChatGPT on Chrome. A saved capture containing a project wikilink was independently read from the vault. Automated background, core, form, and content-script tests pass.

Claude, Gemini, Edge, and the latest popup layout still need live manual verification. This is an early tester build, not a claim of flawless cross-provider support. It copies selected text; it does not move or delete original chat messages. Native AI apps are not supported.

## Install or update

Extract the extension ZIP, open chrome://extensions or edge://extensions, enable Developer mode, and load the folder containing manifest.json. Existing unpacked installations can keep their current folder and use Reload after updating its files. Refresh open AI chat tabs after reloading.

For Obsidian setup, the vault field takes the vault name, the folder field takes a folder such as projects, and the per-project main-note field takes the existing note's vault-relative path. These are three separate settings.
