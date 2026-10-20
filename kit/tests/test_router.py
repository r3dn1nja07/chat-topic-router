import json
import os
import re
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL = os.path.join(ROOT, "skill", "chat-topic-router")
SCRIPT = os.path.join(SKILL, "scripts", "router.py")
sys.path.insert(0, os.path.join(SKILL, "scripts"))
import router  # noqa: E402

SAMPLE = {
    "project": "Garden Planning",
    "topic": "Raised bed layout",
    "source_client": "Claude",
    "request": "How should I lay out three raised beds in my yard?",
    "verified": [{"text": "Each bed is 4 ft by 8 ft", "basis": "stated by the user"}],
    "assumptions": ["Unknown: sun exposure", "Assumption: beds are freestanding"],
    "open_questions": ["Which side gets the most sun?"],
}


def run_cli(*args, stdin=None):
    return subprocess.run([sys.executable, SCRIPT, *args], input=stdin,
                          capture_output=True, text=True)


class BuildTests(unittest.TestCase):
    def test_build_passes_lint(self):
        text = router.build(SAMPLE)
        errors, _ = router.lint(text)
        self.assertEqual(errors, [])

    def test_defaults_are_unknown(self):
        text = router.build(SAMPLE)
        self.assertIn("**Source conversation:** unknown", text)

    def test_conversation_id_preserved(self):
        d = dict(SAMPLE, source_conversation="Chat 42 (kitchen)")
        self.assertIn("**Source conversation:** Chat 42 (kitchen)", router.build(d))

    def test_copy_not_move_statement_present(self):
        text = router.build(SAMPLE)
        self.assertIn("Not a moved message", text)
        self.assertIn("original conversation is unchanged", text)

    def test_request_quoted_exactly_multiline(self):
        d = dict(SAMPLE, request="line one\n\nline two")
        text = router.build(d)
        self.assertIn("> line one\n>\n> line two", text)

    def test_empty_sections_say_none(self):
        d = {k: v for k, v in SAMPLE.items() if k not in ("assumptions", "open_questions", "verified")}
        text = router.build(d)
        self.assertEqual(text.count("- None identified"), 3)
        self.assertEqual(router.lint(text)[0], [])

    def test_verified_without_basis_rejected(self):
        d = dict(SAMPLE, verified=[{"text": "Soil is clay", "basis": ""}])
        with self.assertRaises(ValueError):
            router.build(d)

    def test_missing_required_inputs(self):
        for key in ("request", "project"):
            d = {k: v for k, v in SAMPLE.items() if k != key}
            with self.assertRaises(ValueError):
                router.build(d)

    def test_secret_blocks_build(self):
        d = dict(SAMPLE, request="why? key sk-abcdefghijklmnop1234567890")
        with self.assertRaises(ValueError) as cm:
            router.build(d)
        self.assertNotIn("sk-abcdefghijklmnop", str(cm.exception))

    def test_privacy_default_omits_url(self):
        self.assertIn("Source URL omitted", router.build(SAMPLE))


class LintTests(unittest.TestCase):
    def setUp(self):
        self.good = router.build(SAMPLE)

    def test_missing_field_fails(self):
        bad = self.good.replace("**Destination project:** Garden Planning\n", "")
        self.assertTrue(any("Destination project" in e for e in router.lint(bad)[0]))

    def test_missing_section_fails(self):
        bad = self.good.replace("### Open questions", "### Other")
        self.assertTrue(any("Open questions" in e for e in router.lint(bad)[0]))

    def test_unverified_bullet_fails(self):
        bad = self.good.replace(" (basis: stated by the user)", "")
        self.assertTrue(any("lacks a basis" in e for e in router.lint(bad)[0]))

    def test_unquoted_request_fails(self):
        bad = self.good.replace("> How should", "How should")
        self.assertTrue(any("blockquote" in e for e in router.lint(bad)[0]))

    def test_handoff_type_must_say_copy(self):
        bad = re.sub(r"\*\*Handoff type:\*\*.*", "**Handoff type:** Moved", self.good)
        self.assertTrue(any("Handoff type" in e for e in router.lint(bad)[0]))

    def test_secret_patterns(self):
        samples = ["sk-abcdefghijklmnop1234", "ghp_" + "a" * 30, "AKIA" + "A" * 16,
                   "xoxb-1234567890-abcdef", "-----BEGIN RSA PRIVATE KEY-----",
                   "password = hunter2hunter2", "Bearer abcdefghijklmnopqrstuvwx",
                   "eyJhbGciOiJI.eyJzdWIiOiIx.SflKxwRJSMeKKF2QT4"]
        for s in samples:
            errs, _ = router.lint(self.good + "\n" + s)
            self.assertTrue(any("secret" in e.lower() for e in errs), s)

    def test_false_move_claims_flagged(self):
        for s in ("I moved your messages to the new chat.",
                  "The messages were deleted from the original.",
                  "Router automatically moves messages for you."):
            errs, _ = router.lint(self.good + "\n" + s)
            self.assertTrue(any("moved/deleted" in e for e in errs), s)

    def test_negated_statements_not_flagged(self):
        ok = self.good + "\nNothing was moved; this is a copy. I did not delete anything."
        self.assertEqual(router.lint(ok)[0], [])

    def test_personal_data_is_warning_not_error(self):
        errs, warns = router.lint(self.good + "\ncontact: a.b@example.com")
        self.assertEqual(errs, [])
        self.assertTrue(any("Email" in w for w in warns))

    def test_long_handoff_warns(self):
        errs, warns = router.lint(self.good + "\n" + "x" * 7000)
        self.assertTrue(any("long" in w for w in warns))


class CliTests(unittest.TestCase):
    def test_build_then_lint_roundtrip(self):
        b = run_cli("build", "-", stdin=json.dumps(SAMPLE))
        self.assertEqual(b.returncode, 0, b.stderr)
        l = run_cli("lint", "-", stdin=b.stdout)
        self.assertEqual(l.returncode, 0, l.stdout)
        self.assertIn("OK", l.stdout)

    def test_lint_exit_code_on_failure(self):
        l = run_cli("lint", "-", stdin="just some text")
        self.assertEqual(l.returncode, 1)

    def test_lint_json_output(self):
        l = run_cli("lint", "-", "--json", stdin="nope")
        data = json.loads(l.stdout)
        self.assertFalse(data["ok"])

    def test_build_bad_json(self):
        b = run_cli("build", "-", stdin="{not json")
        self.assertEqual(b.returncode, 1)

    def test_build_secret_prints_nothing(self):
        d = dict(SAMPLE, request="token sk-abcdefghijklmnop1234567890")
        b = run_cli("build", "-", stdin=json.dumps(d))
        self.assertEqual(b.returncode, 1)
        self.assertEqual(b.stdout, "")


class PackageTests(unittest.TestCase):
    def read(self, *p):
        with open(os.path.join(ROOT, *p), encoding="utf-8") as fh:
            return fh.read()

    def test_skill_frontmatter(self):
        text = self.read("skill", "chat-topic-router", "SKILL.md")
        m = re.match(r"---\nname: (.+)\ndescription: (.+)\n---\n", text)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "chat-topic-router")
        self.assertEqual(m.group(1), os.path.basename(SKILL))
        self.assertLess(len(m.group(2)), 1024)
        self.assertLess(len(text.splitlines()), 500)

    def test_original_rules_preserved(self):
        text = self.read("skill", "chat-topic-router", "SKILL.md")
        for phrase in ("Unsorted", "do not claim", "exact request", "Do not invent",
                       "original stays unchanged", "verified context"):
            self.assertIn(phrase.lower(), text.lower(), phrase)

    def test_referenced_files_exist(self):
        text = self.read("skill", "chat-topic-router", "SKILL.md")
        for rel in re.findall(r"`((?:references|scripts)/[\w\-./]+)`", text):
            self.assertTrue(os.path.exists(os.path.join(SKILL, rel)), rel)

    def test_scripts_have_no_network_or_background_code(self):
        src = self.read("skill", "chat-topic-router", "scripts", "router.py")
        for banned in ("import socket", "import urllib", "import requests", "import http",
                       "import smtplib", "import ftplib", "import subprocess",
                       "import threading", "import sched", "while True", "os.system"):
            self.assertNotIn(banned, src, banned)

    def test_no_positive_move_claims_in_docs(self):
        files = [("skill", "chat-topic-router", "SKILL.md"),
                 ("skill", "chat-topic-router", "references", "handoff-template.md"),
                 ("adapters", "compact-prompt.md"), ("INSTALL.md",)]
        for f in files:
            errs, _ = router.lint("**x:** y\n" + self.read(*f))
            self.assertFalse(any("moved/deleted" in e for e in errs), f)

    def test_compact_prompt_has_required_labels(self):
        text = self.read("adapters", "compact-prompt.md")
        for label in router.FIELDS:
            self.assertIn(f"**{label}:**", text)
        for sec in router.SECTIONS:
            self.assertIn(f"### {sec}", text)
        self.assertIn("Never claim to move", text)

    def test_template_example_lints_clean(self):
        text = self.read("skill", "chat-topic-router", "references", "handoff-template.md")
        block = re.search(r"```markdown\n(.*?)```", text, re.S).group(1)
        self.assertEqual(router.lint(block)[0], [])

    def test_evals_file_valid(self):
        data = json.loads(self.read("evals", "evals.json"))
        self.assertEqual(data["skill_name"], "chat-topic-router")
        self.assertGreaterEqual(len(data["evals"]), 6)


if __name__ == "__main__":
    unittest.main()
