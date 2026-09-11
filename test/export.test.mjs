import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { analyseChat } from "../static/analyser.mjs";
import { participantCsv, analysisJson, renderReport } from "../static/export.mjs";
import { reportTemplate } from "../_server/report-template.mjs";
const fixture = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"></head><body class="{{theme}}"><h1>{{title}}</h1><p>{{dedication}}</p><p>{{firstDate}} — {{lastDate}}</p><p>{{messages}} {{words}} {{people}} {{average}} {{days}}</p><table>{{participants}}</table><ul>{{topWords}}</ul><div>{{hours}}</div></body></html>';
const template = () => reportTemplate({CHATFOLD_TEMPLATE_HTML:fixture});
const analysis=analyseChat("[01/09/2026, 09:00] Alex: Hello there\n[01/09/2026, 10:00] Sam: Coffee time");

describe("free own-data exports",()=>{
  it("exports structured statistics and escaped CSV without an entitlement",()=>{
    assert.deepEqual(JSON.parse(analysisJson(analysis)),analysis);
    const csv=participantCsv({...analysis,participants:[{name:'=HYPERLINK("evil")',messages:1,words:2},{name:"Sam, Smith",messages:3,words:4}]});
    assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));assert.ok(csv.includes('"Sam, Smith"'));
  });
});
describe("local report rendering",()=>{
  it("fills both original designs without external assets or scripts",()=>{
    for(const theme of ["correspondence","after-hours"]){
      const html=renderReport(template(),analysis,{title:"Our little story",dedication:"For us",theme});
      assert.ok(html.includes("Our little story"));assert.ok(html.includes(`class="${theme}"`));assert.ok(!html.includes("{{messages}}"));
      assert.ok(!/<script|https?:\/\/|<iframe|<form/i.test(html));
    }
  });
  it("escapes private fields and never recursively interpolates user placeholders",()=>{
    const malicious=structuredClone(analysis);malicious.participants[0].name='<img src=x onerror=alert(1)>';
    malicious.summary.firstDate='<script>alert(1)</script>';
    const html=renderReport(template(),malicious,{title:'{{participants}} <script>alert(1)</script>',dedication:'" onclick="steal()',theme:'evil" onload="steal()'});
    assert.ok(!html.includes("<img src=x"));assert.ok(!html.includes("<script>"));assert.ok(html.includes("{{participants}} &lt;script&gt;"));assert.ok(html.includes('class="correspondence"'));
  });
  it("ships no paid template, secrets, server sources, or tests as static assets",async()=>{
    const build=spawnSync(process.execPath,["scripts/build.mjs"],{encoding:"utf8"});assert.equal(build.status,0,build.stderr);
    const files=await readdir("dist",{recursive:true});
    assert.ok(!files.some(path=>/(_server|api|\.env|test\/|report-template)/.test(path)));
    for(const path of files.filter(path=>/\.(html|mjs|css|json)$/.test(path))){
      const text=await readFile(`dist/${path}`,"utf8");assert.ok(!text.includes("A little more of the story."),path);
      assert.ok(!text.includes("CHATFOLD_UNLOCK_SECRET"),path);
    }
  });
});
