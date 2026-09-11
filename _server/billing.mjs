import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PRODUCT = "chatfold-keepsake-v1";
export const AMOUNT = 7900;
export const CURRENCY = "ZAR";
export const REFERENCE = /^chatfold-[a-f0-9]{32}$/;
const HOUR = 3600;
export class BillingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function config(env = process.env) {
  let key = env.PAYSTACK_SECRET_KEY?.trim() || "";
  let providerUrl = "https://api.paystack.co";
  let mode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : null;
  if (env.TINOTECH_PAYMENTS_URL || env.TINOTECH_PAYMENTS_TOKEN) {
    try {
      const url = new URL(env.TINOTECH_PAYMENTS_URL || "");
      if (url.origin !== "https://www.tinotech.co.za" || url.pathname.replace(/\/$/, "") !== "/api/payments/paystack" || url.username || url.password || url.search || url.hash) throw new Error();
      providerUrl = url.toString().replace(/\/$/, "");
      key = env.TINOTECH_PAYMENTS_TOKEN?.trim() || "";
      mode = ["live", "test"].includes(env.PAYSTACK_MODE) ? env.PAYSTACK_MODE : null;
      if (key.length < 32) throw new Error();
    } catch { throw new BillingError("Purchases are not available yet. Free analysis and exports still work.", 503); }
  }
  const secret = env.CHATFOLD_UNLOCK_SECRET?.trim() || "";
  const production = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  let origin;
  try {
    const url = new URL(env.CHATFOLD_APP_URL || "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local && !production)) throw new Error();
    origin = url.origin;
  } catch { origin = null; }
  if (!mode || key.length < 20 || secret.length < 32 || !origin ||
      (production && mode === "test" && env.PAYSTACK_ALLOW_TEST_MODE !== "true")) {
    throw new BillingError("Purchases are not available yet. Free analysis and exports still work.", 503);
  }
  return { key, providerUrl, secret, mode, origin, secure: origin.startsWith("https:"),
    revoked: new Set((env.CHATFOLD_REVOKED_REFERENCES || "").split(",").map(s => s.trim()).filter(Boolean)) };
}
export function emailAddress(value) {
  if (typeof value !== "string" || value.length > 254) throw new BillingError("Enter the email address used for your receipt.");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BillingError("Enter a valid email address.");
  return email;
}
function mac(secret, text) { return createHmac("sha256", secret).update(text).digest("hex"); }
function equal(a, b) {
  return typeof a === "string" && typeof b === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function signOrder(order, secret) {
  return mac(secret, "order:" + JSON.stringify([order.product, order.reference, order.email, order.amount, order.currency, order.mode]));
}
export function createOrder(email, cfg) {
  const order = { product: PRODUCT, reference: `chatfold-${randomBytes(16).toString("hex")}`,
    email: emailAddress(email), amount: AMOUNT, currency: CURRENCY, mode: cfg.mode };
  return { ...order, signature: signOrder(order, cfg.secret) };
}
export function token(payload, purpose, cfg, seconds, now = Date.now()) {
  const value = Buffer.from(JSON.stringify({ ...payload, product: PRODUCT, mode: cfg.mode, exp: Math.floor(now / 1000) + seconds })).toString("base64url");
  return `${value}.${mac(cfg.secret, `${purpose}:${value}`)}`;
}
export function readToken(value, purpose, cfg, now = Date.now()) {
  if (typeof value !== "string" || value.length > 2500) return null;
  const [payload, signature, extra] = value.split(".");
  if (extra || !equal(signature, mac(cfg.secret, `${purpose}:${payload}`))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (claims.product !== PRODUCT || claims.mode !== cfg.mode || !Number.isSafeInteger(claims.exp) ||
        claims.exp <= Math.floor(now / 1000) || !REFERENCE.test(claims.reference) ||
        cfg.revoked.has(claims.reference) || emailAddress(claims.email) !== claims.email) return null;
    return claims;
  } catch { return null; }
}
export function cookieName(kind, cfg) { return `${cfg.secure ? "__Host-" : ""}chatfold-${kind}`; }
export function cookie(kind, value, cfg, seconds) {
  return `${cookieName(kind, cfg)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${cfg.secure ? "; Secure" : ""}`;
}
export function getCookie(req, kind, cfg) {
  const key = cookieName(kind, cfg);
  return (req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith(`${key}=`))?.slice(key.length + 1);
}
export const pendingCookie = (order, cfg) => cookie("pending", token(order, "pending", cfg, HOUR), cfg, HOUR);
export const accessCookie = (order, cfg) => cookie("access", token({reference: order.reference, email: order.email}, "access", cfg, 90 * 24 * HOUR), cfg, 90 * 24 * HOUR);
export async function provider(path, cfg, { fetcher = fetch, body } = {}) {
  let response;
  try {
    response = await fetcher(`${cfg.providerUrl}${path}`, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== true || !payload.data) throw new Error();
    return payload.data;
  } catch { throw new BillingError("The payment provider could not confirm this request. Try again shortly; do not pay again if you already paid.", 502); }
}
export function verifyTransaction(data, reference, email, cfg) {
  let metadata = data?.metadata;
  try { if (typeof metadata === "string") metadata = JSON.parse(metadata); } catch { metadata = null; }
  const order = metadata?.order;
  const valid = order && order.product === PRODUCT && REFERENCE.test(reference) &&
    !cfg.revoked.has(reference) && data.reference === reference && order.reference === reference &&
    data.status === "success" && data.domain === cfg.mode && order.mode === cfg.mode &&
    data.currency === CURRENCY && order.currency === CURRENCY &&
    Number.isSafeInteger(order.amount) && order.amount > 0 && data.amount === order.amount &&
    order.email === email && data.customer?.email?.trim().toLowerCase() === email &&
    equal(order.signature, signOrder(order, cfg.secret));
  if (!valid) throw new BillingError("This receipt does not confirm a paid Chatfold keepsake pack. Check the receipt reference and email, or contact support.", 403);
  return order;
}
export async function paidOrder(reference, email, cfg, fetcher) {
  if (!REFERENCE.test(reference || "")) throw new BillingError("Enter the Chatfold reference from your receipt.");
  const normalEmail = emailAddress(email);
  const data = await provider(`/transaction/verify/${reference}`, cfg, { fetcher });
  const order = verifyTransaction(data, reference, normalEmail, cfg);
  const id = typeof data.id === "number" && Number.isSafeInteger(data.id) && data.id > 0 ? String(data.id) :
    typeof data.id === "string" && /^[1-9]\d{0,19}$/.test(data.id) ? data.id : null;
  if (!id) throw new BillingError("Payment details could not be confirmed. Contact support with your receipt.", 502);
  const [refunds, disputes] = await Promise.all([
    provider(`/refund?transaction=${id}&perPage=100`, cfg, { fetcher }),
    provider(`/dispute?transaction=${id}&perPage=100`, cfg, { fetcher }),
  ]);
  if (!Array.isArray(refunds) || !Array.isArray(disputes)) throw new BillingError("Payment status could not be confirmed. Try again shortly.", 502);
  if (refunds.length >= 100 || refunds.some(refund => refund?.status !== "failed") || disputes.length > 0) {
    throw new BillingError("This purchase has a refund or dispute. Contact support with your receipt reference.", 403);
  }
  return order;
}
