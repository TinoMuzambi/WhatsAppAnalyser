import { createHandler } from "../api/commerce.js";

const LIMIT = 2048;
async function boundedBody(request) {
  if (Number(request.headers.get("content-length")) > LIMIT) throw new Error("oversized");
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) { await reader.cancel(); throw new Error("oversized"); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}

export function createNetlifyHandler(options = {}) {
  const commerce = createHandler(options);
  return async function netlifyHandler(request) {
    const headers = new Headers({ "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
    const reject = (status, error) => {
      headers.set("Content-Type", "application/json; charset=utf-8");
      return new Response(JSON.stringify({ error }), { status, headers });
    };
    if (new URL(request.url).pathname !== "/api/commerce") return reject(404, "Unknown request.");
    let body;
    if (request.method === "POST") {
      try { body = await boundedBody(request); }
      catch { return reject(413, "Request is too large or could not be read."); }
    }
    let payload;
    const response = {
      statusCode: 200,
      setHeader(name, value) {
        headers.delete(name);
        for (const entry of Array.isArray(value) ? value : [value]) headers.append(name, String(entry));
      },
      end(value) { payload = value; },
    };
    await commerce({ url: request.url, method: request.method, headers: Object.fromEntries(request.headers), body }, response);
    return new Response(payload, { status: response.statusCode, headers });
  };
}
