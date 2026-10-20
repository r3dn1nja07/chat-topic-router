# Handoff template and worked example

## Field rules

| Field | Rule |
|---|---|
| Suggested chat title | `<Project> — <specific topic>`, under about 70 characters |
| Destination project | Name the user used. If inferred, say so under assumptions |
| Source client | ChatGPT, Claude, Gemini, Codex, other, or `unknown` |
| Source conversation | Title or ID. `unknown` if not available. URL only if the user asks |
| Routed request | The user's own words, in a blockquote, unedited |
| Verified context | Each bullet ends with `(basis: ...)`. No basis means it is not verified |
| Assumptions and unknowns | Prefix each with `Assumption:` or `Unknown:` |
| Open questions | Questions the new chat should settle first, or `None identified` |
| Privacy boundaries | What was left out (in general terms) and anything the user said not to share |

## Worked example (harmless sample)

```markdown
## Chat Topic Router Handoff
**Suggested chat title:** Garden Planning — Raised bed layout
**Destination project:** Garden Planning
**Source client:** Claude
**Source conversation:** unknown
**Handoff type:** Copy pasted into a new chat. Not a moved message; the original conversation is unchanged.

### Routed request
> How should I lay out three raised beds in my yard?

### Verified context
- Each bed is 4 ft by 8 ft (basis: stated by the user in the source chat)
- Yard is 10 ft by 12 ft (basis: stated by the user in the source chat)

### Assumptions and unknowns
- Unknown: sun exposure
- Unknown: soil type
- Assumption: beds are freestanding, not built against a fence

### Open questions
- Which side of the yard gets the most sun?

### Privacy boundaries
- Source URL omitted. Only the routed request and the context above are carried over.

### Instructions for the new chat
Continue from the routed request using only the verified context above. Treat assumptions as unconfirmed and ask about unknowns before relying on them.
```
