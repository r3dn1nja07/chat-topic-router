import unittest
from test_router import SAMPLE, router, run_cli


class RegressionTests(unittest.TestCase):
    def test_secret_in_unverified_context_never_echoed(self):
        import json
        secret = "sk-" + "z" * 24
        result = run_cli("build", "-", stdin=json.dumps(dict(
            SAMPLE, verified=[{"text": secret, "basis": ""}])))
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(secret, result.stdout + result.stderr)

    def test_non_object_input_rejected_cleanly(self):
        result = run_cli("build", "-", stdin="[]")
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("Traceback", result.stderr)

    def test_request_whitespace_preserved(self):
        text = router.build(dict(SAMPLE, request="  first\nlast  "))
        self.assertIn(">   first\n> last  ", text)

    def test_both_copy_guarantees_required(self):
        good = router.build(SAMPLE)
        for phrase in ("Not a moved message; ", "the original conversation is unchanged."):
            self.assertTrue(router.lint(good.replace(phrase, ""))[0])
