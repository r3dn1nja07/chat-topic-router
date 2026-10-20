# v0.4.0 — Cross-client skill kit

## Added

- Optional Agent Skill under `kit/skill/chat-topic-router`, with handoff and export-triage references.
- Compact instructions for clients that accept pasted prompts, manual installation guidance, seven behavioral evaluations, and a Python build/lint helper.
- Context source requirements, explicit copy semantics, privacy checks, and manifest-first export triage.

## Fixed

- The helper checks for secrets before validation errors can echo private context.
- Request whitespace is preserved, non-object JSON is rejected cleanly, and the linter requires both copy guarantees.

## Compatibility

The browser extension remains v0.3.1 with unchanged runtime files and permissions. The repository/package release is v0.4.0. The helper uses Python 3.8+ and the standard library. Client behavior evaluations require manual execution; automated tests do not prove client integration.

No installation or client settings are applied by downloading this package. The repository MIT license covers the kit. Pasting handoffs into a hosted AI client shares that text with that client according to its settings.
