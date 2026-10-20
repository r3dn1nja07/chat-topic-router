# Installing Chat Topic Router in each client

**Nothing here has been applied for you.** These are the steps you would take. Each changes a client setting, so do them yourself and only when ready. None of them connect Obsidian, Shared Brain, memory, or any cloud service.

Package contents you install:
- `skill/chat-topic-router/` : the skill folder (Claude, Codex, and other Agent Skills clients)
- `adapters/compact-prompt.md` : pasted instructions (ChatGPT, Gemini)

## Claude (claude.ai / desktop / mobile)
1. Zip the `chat-topic-router` folder so the folder itself is at the top of the zip (`chat-topic-router.zip` → `chat-topic-router/SKILL.md`). A prebuilt `chat-topic-router.zip` is included.
2. In Claude, open Settings → Capabilities (label may differ by version) → Skills → upload the zip.
3. Invoke: "Use chat-topic-router to route this to <project>." It can also trigger on its own when you ask to move or branch a question.

## Claude Code
Copy the folder to `~/.claude/skills/chat-topic-router/` (or `.claude/skills/` inside one project). Invoke the same way.

## Codex (OpenAI)
Codex reads Agent Skills and `AGENTS.md`. Verify the skills directory for your Codex version (commonly `~/.codex/skills/` or a project `.agents/skills/`), then copy the folder there. If your version does not load skills, paste `adapters/compact-prompt.md` into the project's `AGENTS.md` instead.

## ChatGPT
ChatGPT has no skill folder. Paste `adapters/compact-prompt.md` into a Project's instructions or a custom GPT's instructions. Without those, paste it at the start of a chat. ChatGPT cannot run `router.py`; it follows the template by hand.

## Gemini
Paste `adapters/compact-prompt.md` into a Gem's instructions, or save it as `GEMINI.md` for Gemini CLI. If your Gemini CLI version supports Agent Skills, the skill folder can be used instead; check its current docs.

## Browser extension
The separate extension (github.com/r3dn1nja07/chat-topic-router) is not required. It captures selected text and builds handoffs in the browser. This skill uses the same handoff idea and the same privacy default (source URLs omitted).

## Verify (any client)
Ask: "Route this to Garden Planning: how should I lay out three raised beds? Beds are 4 ft by 8 ft." Expect the handoff format, `Source conversation: unknown`, an Unknown for sun/soil, and the copy-not-moved line. It must not claim to have moved your message.
