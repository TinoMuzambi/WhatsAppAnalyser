import { AMOUNT, PRODUCT, CURRENCY, BillingError, config, createOrder, provider, paidOrder,
  pendingCookie, accessCookie, readToken, getCookie, cookie } from "../_server/billing.mjs";
import { reportTemplate } from "../_server/report-template.mjs";

export function createHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Vary", "Cookie");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status, data) => { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(data)); };
    const action = new URL(req.url, "http://local.invalid").searchParams.get("action") || "status";
    const methods = { status: "GET", checkout: "POST", verify: "POST", restore: "POST", template: "GET" };
    if (!methods[action]) return send(404, { error: "Unknown request." });
    if (req.method !== methods[action]) { res.setHeader("Allow", methods[action]); return send(405, { error: "Method not allowed." }); }
    try {
      let cfg;
      let design;
      try { cfg = config(env); design = reportTemplate(env); } catch (error) {
        if (action === "status") return send(200, { available: false, unlocked: false, product: PRODUCT, amount: AMOUNT, currency: CURRENCY });
        throw error;
      }
      if (req.headers["sec-fetch-site"] === "cross-site" ||
          (req.method === "POST" && req.headers.origin !== cfg.origin)) {
        throw new BillingError("Open Chatfold directly and try again.", 403);
      }
      const access = readToken(getCookie(req, "access", cfg), "access", cfg);
      if (action === "status") return send(200, { available: true, unlocked: Boolean(access), product: PRODUCT, amount: AMOUNT, currency: CURRENCY, testMode: cfg.mode === "test" });
      if (action === "template") {
        if (!access) throw new BillingError("Buy a keepsake pack or restore your purchase to use this design.", 401);
        await paidOrder(access.reference, access.email, cfg, fetcher);
        return send(200, { template: design, reference: access.reference });
      }
      if (String(req.headers["content-type"] || "").toLowerCase().split(";")[0].trim() !== "application/json") throw new BillingError("Send a JSON request.", 415);
      const length = Number(req.headers["content-length"] || 0);
      if (length > 2048) throw new BillingError("Request is too large.", 413);
      let body = req.body;
      if (Buffer.isBuffer(body)) body = body.toString();
      if (typeof body === "string") { if (Buffer.byteLength(body) > 2048) throw new BillingError("Request is too large.", 413); try { body = JSON.parse(body); } catch { throw new BillingError("Invalid request."); } }
      if (!body || typeof body !== "object" || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 2048) throw new BillingError("Invalid request.");
      const allowed = action === "checkout" ? ["email"] : action === "verify" ? ["reference"] : ["email", "reference"];
      if (Object.keys(body).some(key => !allowed.includes(key))) throw new BillingError("Only payment details may be sent. Chat text is never accepted.");
      if (action === "checkout") {
        const order = createOrder(body.email, cfg);
        const data = await provider("/transaction/initialize", cfg, { fetcher, body: {
          amount: order.amount, email: order.email, currency: order.currency, reference: order.reference,
          callback_url: `${cfg.origin}/?payment=return`, metadata: { product: PRODUCT, order },
        } });
        let url;
        try { url = new URL(data.authorization_url); } catch { throw new BillingError("The payment provider returned an invalid checkout.", 502); }
        if (url.origin !== "https://checkout.paystack.com" || url.username || url.password || data.reference !== order.reference) throw new BillingError("The payment provider returned an invalid checkout.", 502);
        res.setHeader("Set-Cookie", pendingCookie(order, cfg));
        return send(200, { url: url.toString(), reference: order.reference, amount: AMOUNT, currency: CURRENCY });
      }
      let email = body.email;
      if (action === "verify") {
        const pending = readToken(getCookie(req, "pending", cfg), "pending", cfg);
        if (!pending || pending.reference !== body.reference) throw new BillingError("This browser cannot match the payment. Use Restore purchase with your receipt reference and email.", 403);
        email = pending.email;
      }
      const order = await paidOrder(body.reference, email, cfg, fetcher);
      res.setHeader("Set-Cookie", [accessCookie(order, cfg), cookie("pending", "", cfg, 0)]);
      return send(200, { unlocked: true, reference: order.reference });
    } catch (error) {
      return send(error instanceof BillingError ? error.status : 500, { error: error instanceof BillingError ? error.message : "The purchase could not be completed. Try again or contact support with your receipt reference." });
    }
  };
}
export default createHandler();
