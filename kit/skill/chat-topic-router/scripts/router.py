#!/usr/bin/env python3
"""Chat Topic Router helper: build and lint handoffs.

Local only. Standard library only. No network, no file writes unless you
redirect output yourself. Never reads or modifies conversation exports.

  python router.py build input.json      # JSON -> handoff markdown (stdout)
  python router.py lint handoff.md       # check a handoff (exit 1 on errors)
  python router.py lint -                # read handoff from stdin
Add --json to lint for machine-readable output.
"""
import argparse
import json
import re
import sys

COPY_STATEMENT = (
    "Copy pasted into a new chat. Not a moved message; "
    "the original conversation is unchanged."
)
INSTRUCTIONS = (
    "Continue from the routed request using only the verified context above. "
    "Treat assumptions as unconfirmed and ask about unknowns before relying on them."
)
DEFAULT_PRIVACY = (
    "Source URL omitted. Only the routed request and the context above are carried over."
)
NONE_LINE = "- None identified"

FIELDS = [
    "Suggested chat title",
    "Destination project",
    "Source client",
    "Source conversation",
    "Handoff type",
]
SECTIONS = [
    "Routed request",
    "Verified context",
    "Assumptions and unknowns",
    "Open questions",
    "Privacy boundaries",
    "Instructions for the new chat",
]

SECRET_PATTERNS = [
    ("OpenAI-style API key", r"\bsk-[A-Za-z0-9_\-]{16,}"),
    ("GitHub token", r"\bgh[pousr]_[A-Za-z0-9]{20,}"),
    ("AWS access key ID", r"\bAKIA[0-9A-Z]{16}\b"),
    ("Slack token", r"\bxox[abprs]-[A-Za-z0-9\-]{10,}"),
    ("Google API key", r"\bAIza[0-9A-Za-z_\-]{30,}"),
    ("Private key block", r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    ("JWT", r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}"),
    ("Bearer token", r"\bBearer\s+[A-Za-z0-9._\-]{20,}"),
    ("Password assignment", r"(?i)\b(password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*\S{6,}"),
]
WARN_PATTERNS = [
    ("Email address", r"\b[\w.+\-]+@[\w\-]+\.[\w.\-]+\b"),
    ("Phone-like number", r"(?<!\d)(?:\+?\d{1,2}[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}(?!\d)"),
]
FALSE_CLAIMS = [
    r"\b(i|we|router|claude|chatgpt|gemini|codex)\s+(?:have\s+|has\s+|had\s+)?(?:just\s+)?(moved|deleted|removed|transferred)\b[^.\n]{0,40}\b(message|messages|passage|passages|conversation|chat)\b",
    r"\b(message|messages|passage|passages)\b[^.\n]{0,30}\b(was|were|has been|have been|got)\s+(moved|deleted|removed)\b",
    r"\bautomatically\s+(moves?|deletes?|removes?)\b[^.\n]{0,40}\b(message|messages)\b",
]
MAX_CHARS_WARN = 6000


def _clean(value, default="unknown"):
    v = (value or "").strip()
    return v if v else default


def find_secrets(text):
    return [name for name, pat in SECRET_PATTERNS if re.search(pat, text)]


def build(data):
    """Build handoff markdown from a dict. Raises ValueError on bad input."""
    if not isinstance(data, dict):
        raise ValueError("Input must be a JSON object.")
    if find_secrets(json.dumps(data)):
        raise ValueError("Refusing to build: possible secret(s) detected. Remove them and tell the user.")
    request = data.get("request") or ""
    if not isinstance(request, str) or not request.strip():
        raise ValueError("'request' is required (the user's exact wording).")
    project = (data.get("project") or "").strip()
    if not project:
        raise ValueError("'project' is required.")
    topic = (data.get("topic") or "").strip()
    title = (data.get("title") or "").strip() or (f"{project} — {topic}" if topic else "")
    if not title:
        raise ValueError("'title' or 'topic' is required.")

    verified = []
    for item in data.get("verified", []) or []:
        text = (item.get("text") or "").strip() if isinstance(item, dict) else ""
        basis = (item.get("basis") or "").strip() if isinstance(item, dict) else ""
        if not text:
            continue
        if not basis:
            raise ValueError(
                "Verified item has no basis. Move it to 'assumptions' or add a basis."
            )
        verified.append(f"- {text} (basis: {basis})")

    def bullets(key, default_line=NONE_LINE):
        items = [str(x).strip() for x in (data.get(key) or []) if str(x).strip()]
        return [f"- {x}" for x in items] or [default_line]

    quoted = "\n".join("> " + ln if ln.strip() else ">" for ln in request.splitlines())
    privacy = bullets("privacy", f"- {DEFAULT_PRIVACY}")

    out = [
        "## Chat Topic Router Handoff",
        f"**Suggested chat title:** {title}",
        f"**Destination project:** {project}",
        f"**Source client:** {_clean(data.get('source_client'))}",
        f"**Source conversation:** {_clean(data.get('source_conversation'))}",
        f"**Handoff type:** {COPY_STATEMENT}",
        "",
        "### Routed request",
        quoted,
        "",
        "### Verified context",
        *(verified or [NONE_LINE]),
        "",
        "### Assumptions and unknowns",
        *bullets("assumptions"),
        "",
        "### Open questions",
        *bullets("open_questions"),
        "",
        "### Privacy boundaries",
        *privacy,
        "",
        "### Instructions for the new chat",
        INSTRUCTIONS,
        "",
    ]
    text = "\n".join(out)
    leaked = find_secrets(text)
    if leaked:
        raise ValueError(
            "Refusing to build: possible secret(s) detected (" + ", ".join(leaked)
            + "). Remove them and tell the user."
        )
    return text


def _sections(text):
    parts = re.split(r"(?m)^###\s+", text)
    out = {}
    for part in parts[1:]:
        head, _, body = part.partition("\n")
        out[head.strip()] = body.strip()
    return out


def lint(text):
    """Return (errors, warnings) for a handoff markdown string."""
    errors, warnings = [], []
    for field in FIELDS:
        m = re.search(rf"(?m)^\*\*{re.escape(field)}:\*\*[ \t]*(.*)$", text)
        if not m:
            errors.append(f"Missing field: {field}")
        elif not m.group(1).strip():
            errors.append(f"Empty field: {field}")
        elif field == "Handoff type":
            v = m.group(1).lower()
            if "copy" not in v or "not a moved" not in v or "unchanged" not in v:
                errors.append("Handoff type must say it is a copy, not a moved message, and the original is unchanged.")

    secs = _sections(text)
    for name in SECTIONS:
        if name not in secs:
            errors.append(f"Missing section: {name}")
        elif not secs[name]:
            errors.append(f"Empty section: {name}")

    req = secs.get("Routed request", "")
    if req and not all(ln.startswith(">") for ln in req.splitlines() if ln.strip()):
        errors.append("Routed request must be a blockquote of the user's exact wording.")

    ver = secs.get("Verified context", "")
    for ln in ver.splitlines():
        s = ln.strip()
        if not s.startswith("-"):
            continue
        if s.lower() in ("- none identified", "- none"):
            continue
        if "(basis:" not in s.lower():
            errors.append(f"Verified item lacks a basis: {s[:70]}")

    if "None identified" in secs.get("Privacy boundaries", "") and len(secs.get("Privacy boundaries", "")) < 20:
        warnings.append("Privacy boundaries is empty-ish; state what was excluded or that the URL was omitted.")

    for name in find_secrets(text):
        errors.append(f"Possible secret in handoff: {name}")
    for name, pat in WARN_PATTERNS:
        if re.search(pat, text):
            warnings.append(f"Possible personal data: {name}. Confirm it is needed.")
    for pat in FALSE_CLAIMS:
        if re.search(pat, text, re.I):
            errors.append("Handoff claims messages were moved/deleted/removed. A handoff is a copy.")
            break
    if len(text) > MAX_CHARS_WARN:
        warnings.append(f"Handoff is long ({len(text)} chars); prefer one concise handoff.")
    return errors, warnings


def _read(path):
    if path == "-":
        return sys.stdin.read()
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("input", help="JSON file, or - for stdin")
    l = sub.add_parser("lint")
    l.add_argument("input", help="handoff markdown file, or - for stdin")
    l.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    if args.cmd == "build":
        try:
            print(build(json.loads(_read(args.input))), end="")
            return 0
        except (ValueError, json.JSONDecodeError) as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1

    errors, warnings = lint(_read(args.input))
    if args.json:
        print(json.dumps({"ok": not errors, "errors": errors, "warnings": warnings}, indent=2))
    else:
        for e in errors:
            print(f"ERROR: {e}")
        for w in warnings:
            print(f"WARN: {w}")
        print("OK" if not errors else f"FAILED ({len(errors)} error(s))")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
