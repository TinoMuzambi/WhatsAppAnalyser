# Netlify migration

`netlify.toml` builds the existing public asset allowlist into `dist`. A native Netlify function serves `/api/commerce` through the same billing handler used by Vercel. Node 24 is the build and function runtime. Keep the Vercel deployment working until hosted acceptance and DNS cutover are complete.

The adapter bounds streamed payment request bodies to 2 KB, preserves separate `Set-Cookie` headers, and keeps existing origin checks, signed pending/access cookies, receipt verification and refund/dispute checks. The hosted entry enforces production policy; a separate test deployment requires explicit `PAYSTACK_ALLOW_TEST_MODE=true`.

## Private design and configuration

Save the exact existing `CHATFOLD_UNLOCK_SECRET` and `TINOTECH_PAYMENTS_TOKEN` as secret variables in the owned Netlify site's deployment environment. Do not rotate them as part of hosting migration. Provision the original private template through `CHATFOLD_TEMPLATE_GZIP_BASE64`: gzip its UTF-8 bytes, then base64-encode without line wrapping. The 5,957-byte original exceeds Netlify's 5,000-character per-variable cap; its lossless encoded form is 3,188 characters. Compression changes storage only; receipt verification and the delivered design stay the same. The original design and its encoded form must remain in private source storage and runtime configuration; never copy either into this public repository, `dist`, function source, or a browser bundle.

This function uses Netlify's native Request/Response API, not Lambda compatibility. Netlify documents that native functions do not have the Lambda compatibility API's 4 KB aggregate environment limit. The original template is loaded only when the server handles a request. Free accounts cannot restrict variables to the Functions scope, so retain the explicit public build allowlist and review any future build tooling before granting it secret access.

Secret variables use the `builds`, `functions` and `runtime` scopes; Netlify rejects secrets in `post-processing`. Set the values for both `production` and `deploy-preview`. If using the fixed `migration-qa` alias, also set values for that exact branch (`context: "branch", context_parameter: "migration-qa"`). The CLI alias creates a `branch-deploy` even with a preview build context; inspect the resulting deployment metadata and require `published_at: null`. The server rejects malformed gzip/base64, encoded input over 5,000 characters or decompressed output over 60,000 bytes. Existing Vercel plaintext configuration remains supported.

Preserve these public settings at cutover:

- `CHATFOLD_APP_URL=https://chatfold.tinotech.co.za`
- `CHATFOLD_ADDITIONAL_ORIGINS` containing `https://whatsapp-analyser-gilt-omega.vercel.app`; add only exact approved preview origins when needed.
- `TINOTECH_PAYMENTS_URL=https://www.tinotech.co.za/api/payments/paystack`
- `PAYSTACK_MODE=live`, `PAYSTACK_ALLOW_TEST_MODE=false`

The gateway intentionally accepts only its existing canonical URL. Do not replace it with an arbitrary preview URL. A draft checkout also requires its exact callback origin in the central gateway's allowlist. Host-only cookies remain on the browser's current host; preserve the old host for callbacks and receipt restoration. Do not redirect old callbacks to a different host.

## Validation and release

Run `npm test`, then `netlify build --offline --context deploy-preview` with Node 24. The function manifest must report `runtimeAPIVersion: 2` and an exact `/api/commerce` route. The adapter tests cover streamed body limits, two-cookie restoration, trusted callback origins, an over-4-KB private design, unpaid access and production test-key opt-in.

A draft deployment without credentials must keep free analysis/exports working, report purchases unavailable, and deny paid template delivery. Check desktop/mobile rendering, security headers and absence of chat contents in network requests. Configuring variables requires a fresh deployment before they are available at runtime. A build or an initialized checkout alone is not proof of a completed paid purchase/restoration/export.

Before production cutover, verify the configured hosted payment lifecycle, original-design protection, old receipt restoration and both stable hosts. Keep DNS and existing production keys unchanged until that acceptance is recorded. Netlify Free has a shared hard usage allowance; track account credits before production releases.

## Recovery when original secrets cannot be retrieved

On 12 September 2026 the owner explicitly authorized new Netlify product/unlock values after supported Vercel retrieval returned no Sensitive values. This is an exception to the preservation-first migration procedure above. Keep the original Vercel unlock secret unchanged and keep its owned origin available for receipts it issued. The gateway must accept both the unchanged original product token and the new Netlify token during this transition.

New Netlify receipts and existing Vercel receipts remain bound to their issuing unlock secret; do not accept an unsigned receipt or skip provider verification to bridge them. The restore form links to `https://whatsapp-analyser-gilt-omega.vercel.app/#restore-purchase` in a new tab without adding the email/reference to the URL. Failed callbacks open the restore section. Earlier buyers should use that original site or contact `info@tinotech.co.za`, without purchasing again. Do not retire the original host until a separate versioned receipt migration or support fulfillment process is verified.

References: [native functions](https://docs.netlify.com/build/functions/overview/), [runtime environment variables](https://docs.netlify.com/build/functions/environment-variables/), [function configuration](https://docs.netlify.com/build/functions/configuration/).
