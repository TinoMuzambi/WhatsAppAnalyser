import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { reportTemplate } from "../_server/report-template.mjs";
import { createNetlifyHandler } from "../_server/netlify-adapter.mjs";

const encode = value => gzipSync(value).toString("base64");
const fixture = '<!doctype html><title>{{title}}</title><p>Conversation notes — café</p><!--' + "synthetic layout spacing ".repeat(250) + '-->\n';
const unavailable = error => error.status === 503 && /not available/.test(error.message);

describe("private template configuration", () => {
  it("losslessly loads an original-sized design below the hosted variable limit", () => {
    assert.ok(Buffer.byteLength(fixture) > 5000);
    const encoded = encode(fixture);
    assert.ok(encoded.length < 5000);
    assert.equal(reportTemplate({ CHATFOLD_TEMPLATE_GZIP_BASE64: encoded }), reportTemplate({ CHATFOLD_TEMPLATE_HTML: fixture }));
  });
  it("preserves existing plaintext configuration when both formats are present", () => {
    assert.equal(reportTemplate({ CHATFOLD_TEMPLATE_HTML: fixture, CHATFOLD_TEMPLATE_GZIP_BASE64: "invalid" }), fixture.trim());
  });
  it("fails closed on corrupt, oversized, non-HTML and invalid UTF-8 compressed values", () => {
    for (const value of ["not base64!", "YQ", "YQ==", "A".repeat(5004), encode("<!doctype html>" + "x".repeat(60000)), encode("not a design"), encode(Buffer.from([0xff, 0xfe]))]) {
      assert.throws(() => reportTemplate({ CHATFOLD_TEMPLATE_GZIP_BASE64: value }), unavailable);
    }
  });
  it("keeps invalid configured designs unavailable without calling the payment provider", async () => {
    let calls = 0;
    const origin = "https://chatfold.example";
    const handler = createNetlifyHandler({
      env: { NODE_ENV: "production", PAYSTACK_SECRET_KEY: "sk_live_" + "t".repeat(32), CHATFOLD_UNLOCK_SECRET: "s".repeat(48), CHATFOLD_APP_URL: origin, CHATFOLD_TEMPLATE_GZIP_BASE64: "corrupt" },
      fetcher: async () => { calls++; throw new Error("Provider must not be called"); },
    });
    const status = await handler(new Request(origin + "/api/commerce?action=status"));
    assert.equal((await status.json()).available, false);
    const checkout = await handler(new Request(origin + "/api/commerce?action=checkout", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: "buyer@example.com" }) }));
    assert.equal(checkout.status, 503);
    assert.equal(calls, 0);
  });
});
