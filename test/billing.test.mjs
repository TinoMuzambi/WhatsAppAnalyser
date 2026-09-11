import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHandler } from "../api/commerce.js";
import { AMOUNT, PRODUCT, config, createOrder, verifyTransaction, signOrder, readToken, token, cookieName, pendingCookie, paidOrder, provider } from "../_server/billing.mjs";

const env = { PAYSTACK_SECRET_KEY: "sk_test_" + "t".repeat(32), CHATFOLD_UNLOCK_SECRET: "s".repeat(48), CHATFOLD_APP_URL: "https://chatfold.test", NODE_ENV: "test", CHATFOLD_TEMPLATE_HTML: '<!doctype html><title>{{title}}</title><p>Conversation notes</p>' };
const cfg = config(env);
const transaction = order => ({id: 123456, reference: order.reference, amount: order.amount, currency: "ZAR", status: "success", domain: "test", customer:{email:order.email}, metadata:{order}});
const reply = data => ({ ok:true, json:async()=>({status:true,data}) });
const providerMock = data => async url => reply(url.includes("/transaction/verify/") ? data : []);
async function call(action, { body, cookies, method = body ? "POST" : "GET", headers = {}, customEnv = env, fetcher = async()=>{ throw new Error("Unexpected provider call"); } }={}) {
  const response = { statusCode:200, headers:{}, setHeader(key,value){this.headers[key]=value;}, end(value){this.data=JSON.parse(value);} };
  await createHandler({env:customEnv,fetcher})({method,url:`/api/commerce?action=${action}`, headers:{ origin:cfg.origin,"content-type":"application/json",cookie:cookies || "",...headers},body},response);
  return response;
}

describe("payment configuration",()=>{
  it("fails closed without secrets, weak unlock key, noncanonical origins or production test key",()=>{
    for(const bad of [{},{...env,CHATFOLD_UNLOCK_SECRET:"short"},{...env,CHATFOLD_APP_URL:"https://chatfold.test/evil"},{...env,CHATFOLD_APP_URL:"http://chatfold.test"},{...env,NODE_ENV:"production"}]) assert.throws(()=>config(bad));
    assert.equal(config({...env,NODE_ENV:"production",PAYSTACK_ALLOW_TEST_MODE:"true"}).mode,"test");
  });
  it("supports the product-scoped Tinotech gateway without exposing a merchant key",async()=>{
    const gateway = config({...env, PAYSTACK_SECRET_KEY: undefined, TINOTECH_PAYMENTS_URL: "https://www.tinotech.co.za/api/payments/paystack", TINOTECH_PAYMENTS_TOKEN: "g".repeat(48), PAYSTACK_MODE: "live"});
    assert.equal(gateway.mode,"live");let called;
    await provider("/transaction/verify/chatfold-"+"a".repeat(32),gateway,{fetcher:async(url,options)=>{called={url,options};return reply({ok:true});}});
    assert.ok(called.url.startsWith("https://www.tinotech.co.za/api/payments/paystack/transaction/verify/"));assert.equal(called.options.headers.Authorization,"Bearer "+"g".repeat(48));
    assert.throws(()=>config({...env,TINOTECH_PAYMENTS_URL:"https://evil.test/api",TINOTECH_PAYMENTS_TOKEN:"g".repeat(48),PAYSTACK_MODE:"live"}));
    assert.throws(()=>config({...env,TINOTECH_PAYMENTS_URL:"https://www.tinotech.co.za/api/payments/paystack",TINOTECH_PAYMENTS_TOKEN:"g".repeat(48)}));
  });
  it("reports unavailable and rejects paid actions when not provisioned",async()=>{
    assert.equal((await call("status",{customEnv:{}})).data.available,false);
    assert.equal((await call("status",{customEnv:{...env,CHATFOLD_TEMPLATE_HTML:undefined}})).data.available,false);
    assert.equal((await call("checkout",{body:{email:"a@example.com"},customEnv:{}})).statusCode,503);
  });
});
describe("product-bound receipts",()=>{
  it("uses 128-bit references allowed by Paystack and canonical email",()=>{
    const order=createOrder("  Alex@Example.com  ",cfg); assert.match(order.reference,/^chatfold-[a-f0-9]{32}$/); assert.equal(order.email,"alex@example.com");assert.equal(order.amount,7900);
    assert.notEqual(createOrder(order.email,cfg).reference,order.reference);
  });
  it("rejects mismatched product, reference, mode, amount, email, currency and unsigned metadata",()=>{
    const order=createOrder("alex@example.com",cfg);
    for(const mutate of [d=>d.status="failed",d=>d.domain="live",d=>d.currency="USD",d=>d.amount=1,d=>d.reference="someone-else",d=>d.customer.email="other@example.com",d=>d.metadata.order.product="other-product",d=>d.metadata.order.signature="0".repeat(64),d=>d.metadata.order.mode="live",d=>d.metadata.order.amount=1,d=>delete d.metadata]){
      const data=structuredClone(transaction(order));mutate(data);assert.throws(()=>verifyTransaction(data,order.reference,order.email,cfg));
    }
  });
  it("accepts a correctly signed historical order price without relying on the current price",()=>{
    const order=createOrder("alex@example.com",cfg);order.amount=6900;order.signature=signOrder(order,cfg.secret);
    assert.equal(verifyTransaction(transaction(order),order.reference,order.email,cfg).amount,6900);
  });
  it("rejects refunded/disputed receipts and malformed provider status responses",async()=>{
    const order=createOrder("alex@example.com",cfg);
    for(const status of ["refund","dispute","malformed"]){
      const fetcher=async url=>reply(url.includes("verify")?transaction(order):url.includes(status)?[{status:"processed"}]:status==="malformed"?{}:[]);
      await assert.rejects(paidOrder(order.reference,order.email,cfg,fetcher));
    }
    assert.equal((await paidOrder(order.reference,order.email,cfg,providerMock(transaction(order)))).product,PRODUCT);
  });
});
describe("signed browser claims",()=>{
  it("binds claims to purpose, product, mode, expiry and revocation",()=>{
    const order=createOrder("alex@example.com",cfg), now=Date.now();
    const value=token(order,"pending",cfg,60,now);
    assert.equal(readToken(value,"pending",cfg,now).reference,order.reference);
    assert.equal(readToken(value,"access",cfg,now),null);
    assert.equal(readToken(value,"pending",cfg,now+61000),null);
    assert.equal(readToken(value,"pending",{...cfg,mode:"live"},now),null);
    assert.equal(readToken(value,"pending",{...cfg,revoked:new Set([order.reference])},now),null);
    assert.equal(readToken(value.replace(/.$/,"x"),"pending",cfg),null);
    assert.equal(readToken(value.split(".")[0]+"."+"é".repeat(64),"pending",cfg),null);
    assert.match(pendingCookie(order,cfg),/HttpOnly; SameSite=Lax; Max-Age=3600; Secure/);
  });
});
describe("HTTP commerce boundary",()=>{
  it("rejects cross-origin, extra chat fields, oversized body, nonJSON and incorrect methods",async()=>{
    const email="alex@example.com";
    assert.equal((await call("checkout",{body:{email},headers:{origin:"https://evil.test"}})).statusCode,403);
    assert.equal((await call("checkout",{body:{email,chat:"private"}})).statusCode,400);
    assert.equal((await call("checkout",{body:{email:"a".repeat(3000)}})).statusCode,400);
    assert.equal((await call("checkout",{body:{email},headers:{"content-type":"text/plain"}})).statusCode,415);
    assert.equal((await call("checkout")).statusCode,405);
    assert.equal((await call("template")).statusCode,401);
  });
  it("initializes only the server price, returns no secrets and sets a secure pending cookie",async()=>{
    let sent;const fetcher=async(url,options)=>{sent=JSON.parse(options.body);return reply({authorization_url:"https://checkout.paystack.com/test",reference:sent.reference});};
    const response=await call("checkout",{body:{email:"alex@example.com"},fetcher});
    assert.equal(response.statusCode,200);assert.equal(sent.amount,AMOUNT);assert.equal(sent.metadata.order.product,PRODUCT);assert.equal(sent.callback_url,"https://chatfold.test/?payment=return");
    assert.ok(response.headers["Set-Cookie"].startsWith("__Host-chatfold-pending="));
    assert.ok(!JSON.stringify(response.data).includes(cfg.secret));assert.equal(response.headers["Cache-Control"],"private, no-store, max-age=0");
  });
  it("rejects attacker checkout URLs",async()=>{
    const fetcher=async(url,options)=>reply({authorization_url:"https://checkout.paystack.com.evil.test/pay",reference:JSON.parse(options.body).reference});
    assert.equal((await call("checkout",{body:{email:"alex@example.com"},fetcher})).statusCode,502);
  });
  it("requires callback binding; restores on another device and gates design delivery",async()=>{
    const order=createOrder("alex@example.com",cfg),fetcher=providerMock(transaction(order));
    assert.equal((await call("verify",{body:{reference:order.reference},fetcher})).statusCode,403);
    const pending=pendingCookie(order,cfg).split(";")[0];
    const verified=await call("verify",{body:{reference:order.reference},cookies:pending,fetcher});
    assert.equal(verified.statusCode,200);
    const restored=await call("restore",{body:{reference:order.reference,email:order.email},fetcher});
    assert.equal(restored.statusCode,200);assert.ok(restored.data.unlocked);
    const cookie=restored.headers["Set-Cookie"][0].split(";")[0];
    const delivered=await call("template",{cookies:cookie,fetcher});
    assert.equal(delivered.statusCode,200);assert.match(delivered.data.template,/Correspondence|Conversation notes/);
    assert.equal((await call("template",{cookies:cookie,fetcher:async()=>{throw new Error("down");}})).statusCode,502);
    assert.equal((await call("restore",{body:{reference:order.reference,email:"other@example.com"},fetcher})).statusCode,403);
  });
});
