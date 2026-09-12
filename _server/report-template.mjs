import { BillingError } from "./billing.mjs";
import { gunzipSync } from "node:zlib";

const MAX_HTML_BYTES = 60000;
const MAX_ENCODED_CHARS = 5000;

// The original design is provisioned from Tinotech's private asset repository.
// This public MIT repository contains only the renderer and payment boundary.
export function reportTemplate(env = process.env) {
  try {
    let html = env.CHATFOLD_TEMPLATE_HTML?.trim();
    if (!html && env.CHATFOLD_TEMPLATE_GZIP_BASE64) {
      // Lossless server-only storage for hosts with a per-variable size limit.
      // Bound compressed input and decompressed output before decoding UTF-8.
      const encoded = env.CHATFOLD_TEMPLATE_GZIP_BASE64.trim();
      if (!encoded || encoded.length > MAX_ENCODED_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error();
      const compressed = Buffer.from(encoded, "base64");
      if (compressed.toString("base64") !== encoded) throw new Error();
      html = new TextDecoder("utf-8", { fatal: true }).decode(gunzipSync(compressed, { maxOutputLength: MAX_HTML_BYTES })).trim();
    }
    if (!html || !html.startsWith("<!doctype html>") || Buffer.byteLength(html) > MAX_HTML_BYTES) throw new Error();
    return html;
  } catch {
    throw new BillingError("The keepsake pack is not available yet. Free analysis and exports still work.", 503);
  }
}
