import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import handler from "../api/commerce.js";
const root = resolve(new URL("../dist", import.meta.url).pathname);
const types = { ".html":"text/html", ".mjs":"application/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".ico":"image/x-icon", ".svg":"image/svg+xml", ".ttf":"font/ttf" };
const port = Number(process.env.PORT || 4187);
const headers = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url))).headers[0].headers;
createServer(async (req, res) => {
  for (const {key,value} of headers) res.setHeader(key, value);
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === "/api/commerce") {
    if (req.method === "POST") {
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 2048) { res.statusCode=413; res.end("Request too large"); return; } chunks.push(chunk); }
      req.body = Buffer.concat(chunks).toString();
    }
    await handler(req,res); return;
  }
  let path;
  try { path = resolve(root, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`); } catch { res.statusCode=400; res.end(); return; }
  if (!path.startsWith(root + sep)) { res.statusCode=404; res.end(); return; }
  try { const body = await readFile(path); res.setHeader("Content-Type", types[extname(path)] || "application/octet-stream"); res.end(body); }
  catch { res.statusCode=404; res.end("Not found"); }
}).listen(port,"0.0.0.0",()=>console.log(`Chatfold at http://localhost:${port}`));
