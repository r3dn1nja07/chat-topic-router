---
name: chat-topic-router
description: Route an off-topic question or a mixed-topic passage into a clean, standalone handoff for the right project chat, and triage supplied chat exports into per-project handoffs. Use whenever the user asks to route, move, branch, split, sort, label, park, or reorganize a question, passage, or conversation into another project or chat, or says things like "this belongs in my other chat", "save this for Project X", or "make a handoff". A handoff is a COPY pasted into a new chat; this skill never moves messages inside ChatGPT, Gemini, Claude, or Codex.
---

# Chat Topic Router

Keep work in the right project conversation. Detect the topic boundary, keep the user's exact request plus only the context the new chat needs, and return a standalone handoff the user pastes into a new chat or project.

## Hard limits (always state them when relevant)

- A handoff is a **copy**. Nothing is moved, deleted, or reordered in the source conversation, and the original stays unchanged. Never say or imply otherwise.
- Do not claim you can move individual messages inside ChatGPT, Gemini, Claude, or Codex. Supported actions apply to whole chats (move chat to project, branch from a message where the interface offers it). Use one only if the user asked for it, the interface actually offers it, and you can perform it; otherwise give the shortest manual step.
- No background work: no watchers, schedulers, uploads, cloud services, or writes to other tools (Obsidian, notes apps, memory, project files) unless the user explicitly asks in this conversation. Routing produces text only.
- Do not invent project history. Use only what is visible in this conversation, supplied files, or what the user states.

## Route a live topic change

1. **Destination.** Infer the project from the user's words. Ask one short question only if it cannot be inferred safely. For a direct instruction ("route this to Fridgely") do not ask for confirmation; prepare the handoff.
2. **Exact request.** Find the request being routed and quote it as written. Do not answer it unless asked.
3. **Verified context only.** Include a fact only if you can name its basis (user said it, file, earlier message). Put guesses under assumptions and gaps under unknowns. Keep decisions, constraints, paths, and open questions relevant to the destination; drop everything else.
4. **Source.** Record the source client and a conversation identifier (title, ID, or similar) when available; otherwise write `unknown`. Leave source URLs out unless the user asks to include them.
5. **Privacy.** Exclude credentials, tokens, keys, and unrelated personal or sensitive details. Say what was excluded in general terms, not by repeating it. If the routed text itself contains a secret, stop and tell the user before producing the handoff.
6. **Return one copy-ready block** in the format below, then at most two lines on the manual next step.

If the user only wants a title or destination, give just that.

## Handoff format (use exactly these labels)

Full template and a worked example: `references/handoff-template.md`.

```markdown
## Chat Topic Router Handoff
**Suggested chat title:** <Project> — <specific topic>
**Destination project:** <project>
**Source client:** <ChatGPT | Claude | Gemini | Codex | other | unknown>
**Source conversation:** <title or ID, or unknown>
**Handoff type:** Copy pasted into a new chat. Not a moved message; the original conversation is unchanged.

### Routed request
> <user's exact wording>

### Verified context
- <fact> (basis: <where it came from>)

### Assumptions and unknowns
- <assumption or unknown, labeled>

### Open questions
- <question for the new chat, or None>

### Privacy boundaries
- <what was excluded or must not be shared>

### Instructions for the new chat
Continue from the routed request using only the verified context above. Treat assumptions as unconfirmed and ask about unknowns before relying on them.
```

Empty sections say `- None identified`. Never leave a label out.

## Organize supplied exports or transcripts

Read `references/export-triage.md` before starting. In short: inspect the format first; preserve order, speaker, timestamps, and identifiers; group by project and topic; put unclear segments in `Unsorted` with a one-line reason; produce a manifest and proposed handoffs before anything else; never modify or delete the source; flag sensitive content that affects sharing; do not import a whole history when the user asked for a subset.

## Optional helpers (only where code can run)

`scripts/router.py` builds a handoff from JSON and lints one (required fields, copy-not-move statement, basis on every verified item, secret patterns, false "moved/deleted" claims). It is local, standard-library only, and makes no network calls. If code cannot run (ChatGPT chat, Gemini app), follow the template by hand; the instructions above are complete without it.

## Self-check before replying

All labels present; request quoted exactly; every context item has a basis; assumptions separate from facts; source client and conversation filled or `unknown`; privacy line present; copy-not-move wording present; no secret repeated; no claim of moving or deleting messages.
