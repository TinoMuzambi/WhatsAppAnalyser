"""Publish only this product's checked draft; never initialize a checkout."""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

CONFIG = {'site': 'e75ec399-552d-4f46-ae74-41d885179082', 'name': 'chatfold-tinotech', 'repo': 'TinoMuzambi/WhatsAppAnalyser', 'branch': 'master', 'brand': 'https://chatfold.tinotech.co.za', 'defaultOrigin': 'https://chatfold-tinotech.netlify.app', 'product': 'chatfold-keepsake-v1', 'healthPath': '/api/commerce?action=status', 'assetPrefix': '/static/', 'legacy': 'https://whatsapp-analyser-gilt-omega.vercel.app/#restore-purchase', 'recoveryText': 'Do not buy the pack again', 'privatePaths': ['/_server/report-template.mjs', '/.env', '/private-assets/chatfold/keepsake.html', '/.netlify/functions/commerce']}
API = "https://api.netlify.com/api/v1"
GATEWAY = "https://www.tinotech.co.za/api/payments/paystack/health"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def response(method, url, token=None, body=None, origin=None):
    headers = {"Content-Type": "application/json", "User-Agent": "TinotechProductRelease/1.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if origin:
        headers["Origin"] = origin
    req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), method=method, headers=headers)
    try:
        result = urllib.request.build_opener(NoRedirect).open(req, timeout=45)
    except urllib.error.HTTPError as error:
        result = error
    with result:
        data = result.read(4194305)
        if len(data) > 4194304:
            raise ValueError("Response exceeds release-check limit")
        return result.status, result.headers, data


def request(method, url, token, body=None):
    status, _, data = response(method, url, token, body)
    if status != 200:
        raise ValueError("Authenticated release check failed")
    return json.loads(data)


def candidate_origin(deployment):
    deploy_id = deployment.get("deploy_id", "")
    if deployment.get("site_id") != CONFIG["site"] or not isinstance(deploy_id, str) or not re.fullmatch(r"[a-f0-9]{24}", deploy_id):
        raise ValueError("Unexpected deployment identity")
    origin = f"https://{deploy_id}--{CONFIG['name']}.netlify.app"
    if deployment.get("deploy_url") != origin:
        raise ValueError("Unexpected deployment origin")
    return origin


class PageAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = set()
        self.canonical = self.social = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.assets.add(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.assets.add(attrs.get("href", ""))
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href")
        if tag == "meta" and attrs.get("property") == "og:url":
            self.social = attrs.get("content")


def hosted_checks(base):
    def check(path, expected, method="GET", body=None, origin=None):
        status, headers, data = response(method, base + path, body=body, origin=origin)
        if status != expected:
            raise ValueError("Hosted release guard failed: " + path)
        return headers, data

    _, html = check("/", 200)
    page = PageAssets()
    page.feed(html.decode("utf-8"))
    if not page.canonical or page.canonical.rstrip("/") != CONFIG["brand"] or not page.social or page.social.rstrip("/") != CONFIG["brand"]:
        raise ValueError("Canonical or social origin is incorrect")
    scripts = 0
    for path in sorted(page.assets):
        url = urljoin(base, path)
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.netloc != urlparse(base).netloc or not parsed.path.startswith(CONFIG["assetPrefix"]):
            raise ValueError("Unexpected browser asset origin or path")
        headers, _ = check(parsed.path + ("?" + parsed.query if parsed.query else ""), 200)
        mime = headers.get_content_type()
        if mime not in ("application/javascript", "text/javascript", "text/css"):
            raise ValueError("Browser asset has an incorrect content type")
        scripts += mime.endswith("javascript")
    if not scripts:
        raise ValueError("No working browser scripts")
    for path in CONFIG["privatePaths"]:
        check(path, 404)
    _, health = check(CONFIG["healthPath"], 200)
    health = json.loads(health)
    if CONFIG["product"] == "chatfold-keepsake-v1":
        if health.get("available") is not True or health.get("unlocked") is not False or health.get("testMode") is not False or health.get("amount") != 7900:
            raise ValueError("Chatfold is not locked and configured for live payment")
        headers, _ = check("/api/commerce?action=template", 401)
        check("/api/commerce?action=verify", 403, "POST", {}, CONFIG["defaultOrigin"])
        check("/api/commerce?action=checkout", 400, "POST", {}, CONFIG["defaultOrigin"])
        check("/api/commerce?action=checkout", 403, "POST", {}, "https://foreign.example")
        restore = html
    else:
        if health.get("paystackConfigured") is not True or health.get("paymentMode") != "live" or health.get("priceZar") != 149 or health.get("siteUrl") != CONFIG["brand"]:
            raise ValueError("ChaseKit is not configured for live payment")
        headers, _ = check("/api/templates", 401, "POST", {}, CONFIG["defaultOrigin"])
        check("/api/paystack/initialize", 400, "POST", {}, CONFIG["defaultOrigin"])
        check("/api/paystack/initialize", 403, "POST", {}, "https://foreign.example")
        check("/api/paystack/restore", 400, "POST", {}, CONFIG["defaultOrigin"])
        _, restore = check("/restore", 200)
    if "no-store" not in headers.get("Cache-Control", ""):
        raise ValueError("Paid response must not be cached")
    if CONFIG["legacy"].encode() not in restore or CONFIG["recoveryText"].encode() not in restore:
        raise ValueError("Original receipt recovery is unavailable")


def publish(deployment, api_token, product_token, expected_sha, github_token, call=request, check=hosted_checks):
    origin = candidate_origin(deployment)
    deploy_id = deployment["deploy_id"]
    if not api_token or not isinstance(product_token, str) or len(product_token) < 32 or not github_token or not re.fullmatch(r"[a-f0-9]{40}", expected_sha or ""):
        raise ValueError("Release credentials are missing")
    actual = call("GET", f"{API}/deploys/{deploy_id}", api_token)
    if actual.get("id") != deploy_id or actual.get("site_id") != CONFIG["site"] or actual.get("state") != "ready":
        raise ValueError("Deployment is not ready on the expected site")
    check(origin)
    # Only a fixed, authenticated GET: no charge, checkout, refund or dispute mutation.
    health = call("GET", GATEWAY, product_token)
    if health.get("status") is not True or health.get("data", {}).get("mode") != "live" or health.get("data", {}).get("product") != CONFIG["product"]:
        raise ValueError("Scoped live gateway authentication failed")
    current = call("GET", f"https://api.github.com/repos/{CONFIG['repo']}/commits/{CONFIG['branch']}", github_token)
    if current.get("sha") != expected_sha:
        raise ValueError("Default branch changed during release; rebuild its current revision")
    call("POST", f"{API}/sites/{CONFIG['site']}/deploys/{deploy_id}/restore", api_token)
    site = call("GET", f"{API}/sites/{CONFIG['site']}", api_token)
    if (site.get("published_deploy") or {}).get("id") != deploy_id:
        raise ValueError("Published identity is unconfirmed; inspect before retrying")
    check(CONFIG["defaultOrigin"])
    return CONFIG["defaultOrigin"]


if __name__ == "__main__":
    try:
        with open(sys.argv[1]) as source:
            deployment = json.load(source)
        if len(sys.argv) == 3 and sys.argv[2] == "--check":
            hosted_checks(candidate_origin(deployment))
            print("Candidate assets, origins, live-only settings, unpaid guards and legacy recovery passed.")
        else:
            origin = publish(deployment, os.environ.get("NETLIFY_AUTH_TOKEN"), os.environ.get("TINOTECH_PAYMENTS_TOKEN"), os.environ.get("GITHUB_SHA"), os.environ.get("GITHUB_TOKEN"))
            print("Published and checked the exact product release: " + origin)
            if os.environ.get("GITHUB_STEP_SUMMARY"):
                with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
                    summary.write(f"Published [verified product]({origin}) from `{os.environ['GITHUB_SHA']}`. Live gateway authentication and unpaid delivery guards passed; no checkout was created.\n")
    except Exception:
        print("Release unconfirmed. Inspect the failed step and published deployment before retrying; no automatic publication retry was made.", file=sys.stderr)
        sys.exit(1)
