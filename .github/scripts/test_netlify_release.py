import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("release", Path(__file__).with_name("netlify-release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
DEPLOY = "a" * 24
ORIGIN = f"https://{DEPLOY}--{release.CONFIG['name']}.netlify.app"


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.checks = []
        self.deployment = {"site_id": release.CONFIG["site"], "deploy_id": DEPLOY, "deploy_url": ORIGIN}
        self.ready = {"id": DEPLOY, "site_id": release.CONFIG["site"], "state": "ready"}
        self.health = {"status": True, "data": {"mode": "live", "product": release.CONFIG["product"]}}
        self.current = {"sha": "c" * 40}
        self.published = DEPLOY

    def call(self, method, url, token, body=None):
        self.calls.append((method, url, token, body))
        if url == release.GATEWAY:
            return self.health
        if url.startswith("https://api.github.com/"):
            return self.current
        if url.endswith("/deploys/" + DEPLOY):
            return self.ready
        return {"published_deploy": {"id": self.published}}

    def publish(self, check=None):
        return release.publish(self.deployment, "fixture-netlify", "p" * 48, "c" * 40, "fixture-github", self.call, check or self.checks.append)

    def test_exact_release_and_read_only_product_health(self):
        self.assertEqual(self.publish(), release.CONFIG["defaultOrigin"])
        self.assertEqual(self.checks, [ORIGIN, release.CONFIG["defaultOrigin"]])
        self.assertEqual([c[0] for c in self.calls], ["GET", "GET", "GET", "POST", "GET"])
        self.assertEqual(self.calls[1], ("GET", release.GATEWAY, "p" * 48, None))
        self.assertTrue(self.calls[-2][1].endswith("/restore"))

    def test_untrusted_candidate_never_receives_credentials(self):
        for field, value in [("site_id", "foreign"), ("deploy_id", "../other"), ("deploy_url", "https://foreign.example"), ("deploy_url", ORIGIN + "?x=1")]:
            with self.subTest(field=field):
                saved = self.deployment.copy()
                self.deployment[field] = value
                with self.assertRaises(ValueError):
                    self.publish()
                self.assertEqual(self.calls, [])
                self.deployment = saved

    def test_unready_wrong_product_test_mode_or_changed_branch_cannot_publish(self):
        for target, field, value in [(self.ready, "state", "error"), (self.ready, "site_id", "foreign"), (self.health, "status", False), (self.health["data"], "mode", "test"), (self.health["data"], "product", "another-product"), (self.current, "sha", "d" * 40)]:
            with self.subTest(field=field, value=value):
                previous = target[field]
                target[field] = value
                self.calls.clear()
                with self.assertRaises(ValueError):
                    self.publish()
                self.assertFalse(any(c[0] == "POST" for c in self.calls))
                target[field] = previous

    def test_hosted_failure_prevents_publication(self):
        def fail(_):
            raise ValueError("Private file exposed")
        with self.assertRaises(ValueError):
            self.publish(fail)
        self.assertFalse(any(c[0] == "POST" for c in self.calls))

    def test_ambiguous_publish_has_no_retry(self):
        def fail(method, url, token, body=None):
            if url.endswith("/restore"):
                self.calls.append((method, url, token, body))
                raise TimeoutError()
            return self.call(method, url, token, body)
        with self.assertRaises(TimeoutError):
            release.publish(self.deployment, "fixture-api", "p" * 48, "c" * 40, "fixture-github", fail, self.checks.append)
        self.assertEqual(sum(c[0] == "POST" for c in self.calls), 1)

    def test_published_id_mismatch_is_not_success(self):
        self.published = "b" * 24
        with self.assertRaises(ValueError):
            self.publish()
        self.assertEqual(self.checks, [ORIGIN])


if __name__ == "__main__":
    unittest.main()
