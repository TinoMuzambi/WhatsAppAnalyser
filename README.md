# Chatfold

Private WhatsApp-export analysis, free data exports, and an optional original keepsake design pack sold through Tinotech’s Paystack merchant account.

Live at [chatfold.tinotech.co.za](https://chatfold.tinotech.co.za). The original Vercel address remains available for existing browser access and receipt recovery.

Chat text, contributor names, titles and dedications stay in browser memory. Free JSON, CSV and original-text downloads never require payment. A R79 once-off purchase unlocks two original printable designs. Buyers download a self-contained HTML report and save it as PDF from their browser. This is a pricing experiment, not evidence of validated demand or earned revenue.

## Develop and verify

Use Node.js 22 or newer. There are no runtime dependencies.

```sh
npm run dev
npm run check
```

Development serves the allowlisted `dist/` output and the commerce endpoint on `http://localhost:4187`. Without billing configuration the free tool works and purchases clearly remain unavailable. Tests exercise real request handlers with mocked provider boundaries; they do not make charges.

## Configure a deployment

The existing Vercel project uses `npm run build`, `dist/`, and `api/commerce.js`. Never deploy the repository root as a static directory. The build copies an explicit public asset allowlist; server modules, environment files and private designs are excluded.

Server-only settings:

| Variable | Purpose |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Direct Tinotech merchant key; production requires a live key, optional when gateway mode is configured |
| `TINOTECH_PAYMENTS_URL` | Optional central gateway: `https://www.tinotech.co.za/api/payments/paystack` |
| `TINOTECH_PAYMENTS_TOKEN` | Server-only per-product gateway token of at least 32 characters |
| `PAYSTACK_MODE` | Explicit `live` or `test` in gateway mode; live for customer deployment |
| `CHATFOLD_UNLOCK_SECRET` | Unique random product secret of at least 32 characters |
| `CHATFOLD_APP_URL` | Exact canonical HTTPS origin, `https://chatfold.tinotech.co.za` |
| `CHATFOLD_ADDITIONAL_ORIGINS` | Optional JSON array of at most five explicitly trusted old origins; preserve `https://whatsapp-analyser-gilt-omega.vercel.app` for old browser access and receipt recovery |
| `CHATFOLD_TEMPLATE_HTML` | Complete UTF-8 original template from the private Tinotech repository |
| `CHATFOLD_TEMPLATE_GZIP_BASE64` | Optional lossless gzip/base64 version of the same private template for hosts with per-variable length limits; at most 5,000 characters, server-only secret |
| `PAYSTACK_ALLOW_TEST_MODE` | Explicit staging override for test keys on a production-mode runtime; leave false for the customer site |
| `CHATFOLD_REVOKED_REFERENCES` | Optional comma-separated manually suspended receipt references |

The original template lives in the private `tinotech-co-za/tinotech` repository at `private-assets/chatfold/keepsake.html`. Provision its complete contents as `CHATFOLD_TEMPLATE_HTML`; do not copy the template into this public repository. CI uses a deliberately plain template fixture to test the renderer and billing boundary.

On Netlify, use `CHATFOLD_TEMPLATE_GZIP_BASE64` because its per-variable limit is 5,000 characters. Gzip the UTF-8 file and base64-encode those bytes without line wrapping; keep the result secret. This preserves the original design and decodes only inside the server handler. Decompression is bounded to 60,000 bytes and malformed configuration disables checkout. Configure one template format; the existing plaintext value takes precedence when both are present.

`CHATFOLD_UNLOCK_SECRET` signs historical order metadata as well as browser claims. Preserve it for receipt restoration. Rotating it invalidates receipts signed with the previous secret; plan a versioned migration before rotation and retain the old value securely if existing purchases need support.

## Payment and delivery model

1. The server creates a random `chatfold-<32 hex>` reference and fixes the price at 7,900 ZAR cents. The client can only provide a receipt email.
2. It signs product, reference, canonical email, amount, currency and test/live mode in Paystack order metadata. A signed, HttpOnly pending cookie binds the browser callback.
3. Checkout opens in a separate tab, preserving the original tab’s private chat memory. Its callback uses the request's explicitly allowed Origin so the host-only pending cookie remains on the browser's starting host. Card details are entered only on Paystack. The gateway must allow every configured callback origin. Canonical metadata does not redirect old checkout or recovery pages; the durable unlock secret must not change during a domain move.
4. Confirmation verifies the Paystack result, exact signed historical amount, reference, email, ZAR, product and mode. A receipt for another Tinotech product cannot unlock the pack.
5. The server checks transaction-filtered refund and dispute lists. Any nonfailed refund or dispute suspends downloads; provider failure or malformed responses fail closed.
6. A signed HttpOnly access cookie remembers the purchase for 90 days. Template retrieval repeats provider verification. Receipt reference plus email restores access on another browser. No merchant webhook or shared-account webhook configuration is changed.
7. Only the blank paid template returns to the browser. Escaped personal values fill it locally. No chat body, name, title, dedication or statistics are accepted by the payment endpoint.

The API uses exact-origin POST checks, bounded JSON, method allowlists, provider timeouts, a fixed Paystack API origin, a checkout-host allowlist, secure production cookies and private/no-store responses. Configure hosting-level rate limits on checkout, verify, restore and template endpoints before promoting a heavily publicised release; this version uses an unguessable receipt capability and bounded requests, not a distributed rate-limit database. Keep hosting request-body logging off.

Check signed transaction metadata in the Paystack dashboard for support and revenue attribution (`chatfold-keepsake-v1`). Process refunds through the existing merchant dashboard. Preserve receipt references and never ask customers to send their chat. Historical successful downloads remain with the customer; digital files cannot be recalled.

## Release checks

- Run `npm run check`; test the original private template with fictional data in both themes and print to A4 PDF.
- Optional browser regression: with a local app running, set `PUPPETEER_MODULE_PATH` to the absolute installed Puppeteer module, `CHROMIUM_PATH` to its browser executable and `CHATFOLD_PRIVATE_TEMPLATE_PATH` to the privately stored design. Run `node scripts/browser-qa.mjs http://localhost:4189 local`. It checks mobile layout, parser recovery, stale file/report races and local design delivery using a mocked entitlement; it does not charge a payment. Screenshots and results go to `/tmp/chatfold-recovery-qa` or `CHATFOLD_QA_OUTPUT`. Never commit the supplied private template or generated private report.
- On a staging deployment, complete a Paystack test purchase; check return, restore, rejection of another product receipt, and downloaded HTML/PDF.
- Set live merchant key, a durable unlock secret, original template, and canonical production origin; confirm test mode is not enabled.
- Check no private template is accessible at a static path and API responses use no-store.
- Confirm support email in the purchase terms is monitored. Check receipt amounts in ZAR.

Gateway mode keeps the merchant key inside Tinotech’s central payment runtime. Product-specific bearer tokens scope requests to this product; direct key mode remains available for isolated staging. Both modes run the same signed receipt checks.

Provider contracts: [transaction initialization and verification](https://paystack.com/docs/api/transaction/), [refund list](https://paystack.com/docs/api/refund/), [dispute list](https://paystack.com/docs/api/dispute/). The refund and dispute list filters use the numeric transaction ID, not the payment reference.

## Product boundary

Counts describe the supplied export, not a relationship’s quality. Common iOS/Android formats are supported; missing or unusual export formats can affect results. No analytics, advertising SDK, AI service or third-party runtime dependency is used. Optional billing introduces essential payment cookies and requests containing payment details only; see [privacy](privacy.html).

The public application code remains MIT licensed. The separately held original paid designs have their own personal-use terms and are not included under this repository’s MIT grant.

## Netlify customer releases

The verified Netlify production site is <https://chatfold-tinotech.netlify.app>. Use the [production release workflow and legacy receipt runbook](docs/netlify-production.md) for future releases. Ordinary default-branch commits no longer deploy Vercel production automatically; the original Vercel verifier remains available for earlier receipts.
