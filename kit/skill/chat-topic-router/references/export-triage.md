# Export and transcript triage

Use when the user supplies a chat export, transcript, or pasted multi-topic log.

1. **Inspect first.** Identify the format (JSON, Markdown, plain text) and what it contains: speakers, timestamps, message or conversation IDs. Report what you found before sorting. Do not guess at fields that are absent.
2. **Preserve.** Keep message order, speaker, timestamps, and source identifiers for every segment you carry over.
3. **Group.** Assign segments to a project and topic. Anything ambiguous goes in `Unsorted` with a one-line reason. Never force a guess.
4. **Manifest before handoffs.** Return a table first: segment range, proposed project, proposed topic, confidence (high/medium/low), reason. Let the user correct it before you write full handoffs.
5. **Handoffs.** One per selected group, using the standard format. Classification is a proposal; do not present it as a verified project fact.
6. **Source safety.** Never overwrite, delete, or edit the export. Write new files only if the user asked for files, and never next to the original under the same name.
7. **Sensitive content.** Do not copy credentials, tokens, or unrelated personal details. Tell the user if the source contains such content, in general terms, and what you omitted.
8. **Scope.** If the user asked for a subset (a project, a date range), do not process or summarize the rest.
9. **Mixed chats.** A segment cannot be removed from its original conversation. Produce a new-chat handoff for it.
