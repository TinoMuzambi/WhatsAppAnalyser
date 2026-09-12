import { BillingError } from "./billing.mjs";

// The original design is provisioned from Tinotech's private asset repository.
// This public MIT repository contains only the renderer and payment boundary.
export function reportTemplate(env = process.env) {
  const html = env.CHATFOLD_TEMPLATE_HTML?.trim();
  if (!html || !html.startsWith("<!doctype html>") || Buffer.byteLength(html) > 60000) {
    throw new BillingError("The keepsake pack is not available yet. Free analysis and exports still work.", 503);
  }
  return html;
}
