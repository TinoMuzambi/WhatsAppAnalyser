# Netlify production releases

The customer release is published at <https://chatfold-tinotech.netlify.app>. The branded address `https://chatfold.tinotech.co.za` is bound to the Netlify site; DNS cutover is coordinated with Tinotech and must be checked separately. Existing Vercel receipt verification stays available at <https://whatsapp-analyser-gilt-omega.vercel.app/#restore-purchase>.

## Verified launch on 12 September 2026

The first Netlify production deployment is `6aa575db31cf6b6798195528` on site `e75ec399-552d-4f46-ae74-41d885179082`. It was published through the supported restore endpoint from the exact reviewed, ready candidate after a full combined production-context build. Twelve hosted guards passed along with normal-browser checks for free use, mobile layout and original receipt recovery. No live checkout was initialized during this launch.

Genuine Paystack TEST acceptance completed through the provider's ordinary documented Success UI: R79 TEST payment, receipt restore, wrong-buyer denial, repeat restore and both original offline keepsake themes. The original callback browser nonce had expired, so interrupted-return recovery was verified through the actual restore UI; callback transport remains covered by native-adapter tests. Successful delivery included actual provider transaction verification and refund/dispute reads. Refund/dispute mutations were not performed: the normal merchant dashboard required owner sign-in. Automated suites cover reversal, wrong-product, malformed-provider and failure denials separately. Private references, browser claims and generated paid files remain outside Git.

## Publish an application change

1. Merge the independently reviewed change into `master` after CI passes.
2. Keep Netlify Production and Deploy Preview payment settings equivalent: same durable product unlock secret, scoped gateway token, live mode, false test opt-in, allowed origins and private template where applicable. Netlify's production-context unpublished draft has deploy-preview runtime configuration. Sensitive values cannot be compared through management reads; update both contexts together using the existing saved copies and repeat acceptance after any billing configuration change. Do not infer payment proof from an available/configured status alone.
3. Run the **Netlify Production Release** workflow on `master`:

   ```sh
   gh workflow run netlify-production.yml --repo TinoMuzambi/WhatsAppAnalyser --ref master
   ```

The workflow installs dependencies, validates the source, runs release authorization tests, performs a full combined `netlify deploy --context production` build, and checks the unpublished candidate. It verifies browser script/style origins and content types, canonical/social origin, private file denials, live-only status, unpaid delivery, origin checks and legacy receipt recovery. It then authenticates the product against the fixed Tinotech gateway using GET health, rechecks the current default-branch SHA, publishes that exact ready draft via `POST /sites/{site}/deploys/{deploy}/restore`, confirms its published ID, and repeats hosted checks on the default production origin. It creates no checkout or charge and has no automatic publication retry.

Repository Secrets contain only `NETLIFY_AUTH_TOKEN` for deployment and the existing product-scoped `TINOTECH_PAYMENTS_TOKEN` for gateway readiness. Merchant keys, unlock secrets and paid design contents stay in the hosting configuration/private backup. Release secrets are used only by the manually dispatched default-branch workflow, not pull-request CI.

A failure after the restore request can mean publication already happened. Inspect the site's `published_deploy.id` before retrying. Keep the previous accepted deployment ID for a deliberate rollback through the same supported restore endpoint; never delete or regenerate receipt secrets while rolling back. After changes to callbacks, cookies, payment validation or delivery, repeat genuine isolated TEST acceptance before running a customer release.

## Preserve earlier receipt support

`vercel.json` disables Git-triggered deployment of `master`. This prevents an ordinary merge from silently changing the legacy production runtime. It does not delete a project, change its existing keys, or remove the original receipt URL. Preview Git behavior remains unchanged.

A reviewed legacy verifier fix can still be deployed deliberately through the supported Vercel CLI/API. Use a clean export of the reviewed revision, link it to the existing project `prj_HGZ8hXhbUeq0JaZs0IsqjU5Bp5e4` in team `team_pYEyndT70bUFuso6V8GAgGtN`, confirm the resulting project identity, and run `vercel deploy --prod` from that linked export. Use its existing hosted production environment; do not copy Netlify unlock secrets into Vercel or point old receipts to the new verifier. If an explicit legacy change also affects Netlify, run and verify the Netlify release separately. The sites must continue to offer original-host recovery without forwarding buyer emails or references in link URLs.

References: [Netlify deployment contexts](https://docs.netlify.com/deploy/contexts/), [Netlify Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Vercel Git deployment controls](https://vercel.com/docs/project-configuration/git-configuration), [Paystack TEST payments](https://paystack.com/docs/payments/test-payments/).
