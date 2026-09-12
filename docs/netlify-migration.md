# Netlify migration

`netlify.toml` builds the existing public asset allowlist into `dist`. A native Netlify function serves `/api/commerce` through the same billing handler used by Vercel. Node 24 is the build and function runtime. Keep the Vercel deployment working until hosted acceptance and DNS cutover are complete.

The adapter bounds streamed payment request bodies to 2 KB, preserves separate `Set-Cookie` headers, and keeps existing origin checks, signed pending/access cookies, receipt verification and refund/dispute checks. The hosted entry enforces production policy; a separate test deployment requires explicit `PAYSTACK_ALLOW_TEST_MODE=true`.

## Private design and configuration

Save the exact existing `CHATFOLD_TEMPLATE_HTML`, `CHATFOLD_UNLOCK_SECRET` and `TINOTECH_PAYMENTS_TOKEN` as secret variables in the owned Netlify site's deployment environment. Do not rotate them as part of hosting migration. The original design must remain in private source storage and runtime configuration; never copy it into this public repository, `dist`, function source, or a browser bundle.

This function uses Netlify's native Request/Response API, not Lambda compatibility. Netlify documents that native functions do not have the Lambda compatibility API's 4 KB aggregate environment limit. The original template is loaded only when the server handles a request. Free accounts cannot restrict variables to the Functions scope, so retain the explicit public build allowlist and review any future build tooling before granting it secret access.

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

References: [native functions](https://docs.netlify.com/build/functions/overview/), [runtime environment variables](https://docs.netlify.com/build/functions/environment-variables/), [function configuration](https://docs.netlify.com/build/functions/configuration/).
