import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createNetlifyHandler } from "../_server/netlify-adapter.mjs";
import { createOrder, config } from "../_server/billing.mjs";
import { gzipSync } from "node:zlib";

const env = { NODE_ENV:"production", PAYSTACK_SECRET_KEY:"sk_test_"+"t".repeat(32), PAYSTACK_ALLOW_TEST_MODE:"true", CHATFOLD_UNLOCK_SECRET:"s".repeat(48), CHATFOLD_APP_URL:"https://chatfold.tinotech.co.za", CHATFOLD_ADDITIONAL_ORIGINS:'["https://legacy-chatfold.example"]', CHATFOLD_TEMPLATE_HTML:'<!doctype html><title>{{title}}</title><!--'+"private-design-fixture".repeat(260)+'-->' };
function request(action, body, { origin=env.CHATFOLD_APP_URL, cookies, headers={} }={}) {
  return new Request(origin+"/api/commerce?action="+action,{method:body===undefined?"GET":"POST",headers:{origin,...(body===undefined?{}:{"Content-Type":"application/json"}),...(cookies?{cookie:cookies}:{}),...headers},...(body===undefined?{}:{body:typeof body==="string"?body:JSON.stringify(body)})});
}
const reply = data => new Response(JSON.stringify({status:true,data}),{status:200,headers:{"Content-Type":"application/json"}});
function provider(order, state="success") {
  return async url => reply(url.includes("/transaction/verify/")?{id:1234,reference:order.reference,amount:7900,currency:"ZAR",status:state,domain:"test",customer:{email:order.email},metadata:{order}}:[]);
}
describe("Netlify native function adapter",()=>{
  it("returns JSON and fail-closed status without credentials or an explicit production test opt-in",async()=>{
    for (const customEnv of [{},{...env,PAYSTACK_ALLOW_TEST_MODE:"false"}]) {
      const handle=createNetlifyHandler({env:customEnv});const status=await handle(request("status"));
      assert.equal(status.status,200);assert.equal((await status.json()).available,false);
      const paid=await handle(request("checkout",{email:"buyer@example.com"}));assert.equal(paid.status,503);
      assert.match(paid.headers.get("cache-control"),/no-store/);assert.equal(paid.headers.get("content-type"),"application/json; charset=utf-8");
    }
  });
  it("streams no more than 2KB, even with absent/false content length, and rejects chat fields before a provider call",async()=>{
    let calls=0;const handle=createNetlifyHandler({env,fetcher:async()=>{calls++;throw new Error();}});
    const streamed=new Request(env.CHATFOLD_APP_URL+"/api/commerce?action=checkout",{method:"POST",headers:{origin:env.CHATFOLD_APP_URL,"content-type":"application/json","content-length":"1"},duplex:"half",body:new ReadableStream({start(c){c.enqueue(new Uint8Array(1024));c.enqueue(new Uint8Array(1025));c.close();}})});
    assert.equal((await handle(streamed)).status,413);
    assert.equal((await handle(request("checkout","x".repeat(2049)))).status,413);
    assert.equal((await handle(request("checkout",{email:"buyer@example.com",chat:"private conversation"}))).status,400);
    assert.equal(calls,0);
  });
  it("keeps callback origins and host-only pending cookies intact on both trusted hosts",async()=>{
    for(const origin of [env.CHATFOLD_APP_URL,"https://legacy-chatfold.example"]) {
      let sent;const handle=createNetlifyHandler({env,fetcher:async(url,options)=>{sent=JSON.parse(options.body);return reply({authorization_url:"https://checkout.paystack.com/test",reference:sent.reference});}});
      const response=await handle(request("checkout",{email:"buyer@example.com"},{origin}));assert.equal(response.status,200);
      assert.equal(sent.callback_url,origin+"/?payment=return");assert.deepEqual(Object.keys(await response.json()).sort(),["amount","currency","reference","url"]);
      const cookies=response.headers.getSetCookie();assert.equal(cookies.length,1);assert.match(cookies[0],/^__Host-chatfold-pending=/);assert.match(cookies[0],/HttpOnly; SameSite=Lax; Max-Age=3600; Secure/);assert.ok(!cookies[0].includes("Domain="));
    }
  });
  it("preserves two distinct Set-Cookie headers on restore and gates a >4KB design after fresh verification",async()=>{
    for (const templateEnv of [env, {...env,CHATFOLD_TEMPLATE_HTML:undefined,CHATFOLD_TEMPLATE_GZIP_BASE64:gzipSync(env.CHATFOLD_TEMPLATE_HTML).toString("base64")}]) {
    const order=createOrder("buyer@example.com",config(templateEnv));const handle=createNetlifyHandler({env:templateEnv,fetcher:provider(order)});
    assert.ok(Buffer.byteLength(env.CHATFOLD_TEMPLATE_HTML)>4096);
    assert.equal((await handle(request("template"))).status,401);
    const restored=await handle(request("restore",{email:order.email,reference:order.reference}));assert.equal(restored.status,200);
    const cookies=restored.headers.getSetCookie();assert.equal(cookies.length,2);assert.match(cookies[0],/^__Host-chatfold-access=/);assert.match(cookies[1],/^__Host-chatfold-pending=;.*Max-Age=0/);
    const delivered=await handle(request("template",undefined,{cookies:cookies[0].split(";")[0]}));assert.equal(delivered.status,200);assert.equal((await delivered.json()).template,env.CHATFOLD_TEMPLATE_HTML);
    const denied=createNetlifyHandler({env:templateEnv,fetcher:provider(order,"abandoned")});assert.equal((await denied(request("template",undefined,{cookies:cookies[0].split(";")[0]}))).status,403);
    }
  });
  it("retains unbound callback, unrelated-origin, bad-method and path denials",async()=>{
    const handle=createNetlifyHandler({env,fetcher:async()=>{throw new Error("Provider should not be called");}});
    assert.equal((await handle(request("verify",{reference:"chatfold-"+"a".repeat(32)}))).status,403);
    assert.equal((await handle(request("checkout",{email:"buyer@example.com"},{origin:"https://evil.example"}))).status,403);
    const method=await handle(new Request(env.CHATFOLD_APP_URL+"/api/commerce?action=checkout"));assert.equal(method.status,405);assert.equal(method.headers.get("allow"),"POST");
    assert.equal((await handle(new Request(env.CHATFOLD_APP_URL+"/.netlify/functions/commerce"))).status,404);
  });
});
