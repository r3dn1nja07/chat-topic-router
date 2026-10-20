# Chat Topic Router kit

Cross-client skill for routing a question or passage into a standalone handoff for the right project chat. A handoff is a copy pasted into a new chat; nothing is moved in the source conversation.

- `skill/chat-topic-router/` installable skill (Claude, Claude Code, Codex, other Agent Skills clients)
- `adapters/compact-prompt.md` pasted instructions for ChatGPT and Gemini
- `INSTALL.md` per-client steps (nothing is applied automatically)
- `tests/` run with `python3 -m unittest discover -s tests -v` (Python 3.8+, no dependencies)
- `evals/evals.json` manual behavior checks to run in each client

No network, watchers, background tasks, or writes to Obsidian, Shared Brain, or memory.
