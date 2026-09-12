import assert from 'node:assert/strict';import fs from 'node:fs/promises';
// Optional browser QA uses an operator-provided browser and private template.
// No paid design or browser dependency is bundled with the public application.
if (!process.env.PUPPETEER_MODULE_PATH || !process.env.CHROMIUM_PATH || !process.env.CHATFOLD_PRIVATE_TEMPLATE_PATH) throw new Error('Set the three browser QA paths described in README.md.');
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE_PATH);
const base=process.argv[2]||'http://localhost:4189';const label=process.argv[3]||'local';const dir=(process.env.CHATFOLD_QA_OUTPUT || '/tmp/chatfold-recovery-qa')+'/'+label;await fs.mkdir(dir,{recursive:true});
await fs.rm(dir+'/chatfold-keepsake.html',{force:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];const requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),body:r.postData(),method:r.method()}));const checks=[];
try{
 await page.setViewport({width:1440,height:1000});await page.goto(base,{waitUntil:'networkidle0'});await page.screenshot({path:dir+'/desktop.png',fullPage:true});
 assert.equal(await page.$eval('link[rel=canonical]',e=>e.href),'https://chatfold.tinotech.co.za/');const og=await page.$eval('meta[property="og:image"]',e=>e.content);assert.equal(og,'https://chatfold.tinotech.co.za/static/chatfold-social.png');
 await page.$eval('#analysis-form',e=>e.requestSubmit());assert.equal(await page.$eval('#error-message',e=>e.hidden),false);await page.click('#sample-button');assert.equal(await page.$eval('.stat-value',e=>e.textContent),'8');
 await page.$eval('#chat-input',e=>{e.value+='\n[03/08/2026, 08:03] Alice: edited-private-sentinel';e.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.$eval('#results',e=>e.hidden),true);assert.equal(await page.$$eval('.stat-value',e=>e.length),0);await page.$eval('#analysis-form',e=>e.requestSubmit());assert.equal(await page.$eval('.stat-value',e=>e.textContent),'9');checks.push('Unsupported input recovers; editing removes stale statistics');
 await page.evaluate(()=>{const input=document.querySelector('#file-input');Object.defineProperty(input,'files',{configurable:true,value:[{name:'delayed.txt',size:20,text:()=>new Promise(resolve=>window.resolvePrivateFile=resolve)}]});input.dispatchEvent(new Event('change'));});
 await page.$eval('#chat-input',e=>{e.value='user chose different private text';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.evaluate(()=>window.resolvePrivateFile('[03/08/2026, 08:03] OldName: outdated delayed file'));await new Promise(r=>setTimeout(r,100));assert.equal(await page.$eval('#chat-input',e=>e.value),'user chose different private text');checks.push('A delayed old file cannot replace a newer edit');
 await page.setViewport({width:390,height:844});await page.click('#sample-button');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.$eval('#keepsake',e=>e.scrollIntoView({behavior:'instant'}));await page.screenshot({path:dir+'/mobile.png'});
 const template=await fs.readFile(process.env.CHATFOLD_PRIVATE_TEMPLATE_PATH,'utf8');let heldTemplate;let hold=false;
 await page.setRequestInterception(true);page.on('request',r=>{
  if(r.url().includes('action=status'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({available:true,unlocked:true})});
  if(r.url().includes('action=template')){if(hold){heldTemplate=r;return;}return r.respond({status:200,contentType:'application/json',body:JSON.stringify({template})});}
  return r.continue();
 });
 await page.reload({waitUntil:'networkidle0'});await page.click('#sample-button');const cdp=await page.target().createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 await page.$eval('#report-title',e=>e.value='A private-sentinel dedication');await page.$eval('#report-form',e=>e.requestSubmit());await page.waitForFunction(()=>document.querySelector('#purchase-message').textContent.startsWith('Keepsake downloaded'));for(let i=0;i<100;i++){try{await fs.access(dir+'/chatfold-keepsake.html');break;}catch{await new Promise(r=>setTimeout(r,30));}}assert.ok((await fs.readFile(dir+'/chatfold-keepsake.html','utf8')).includes('private-sentinel'));await fs.unlink(dir+'/chatfold-keepsake.html');
 hold=true;await page.$eval('#report-form',e=>e.requestSubmit());await page.waitForFunction(()=>document.querySelector('#report-button').disabled);while(!heldTemplate)await new Promise(r=>setTimeout(r,20));await page.$eval('#chat-input',e=>{e.value='replaced-private-sentinel';e.dispatchEvent(new Event('input',{bubbles:true}));});await heldTemplate.respond({status:200,contentType:'application/json',body:JSON.stringify({template})});await page.waitForFunction(()=>document.querySelector('#purchase-message').textContent.includes('chat changed or was cleared'));assert.ok(!(await fs.readdir(dir)).includes('chatfold-keepsake.html'));checks.push('Mocked paid design downloads locally; stale pending design is rejected after source edit');
 assert.ok(!requests.some(r=>r.body?.includes('private-sentinel')||r.url.includes('private-sentinel')));assert.deepEqual(errors,[]);checks.push('No private chat data in requests; no browser exceptions; no mobile overflow');
 await fs.writeFile(dir+'/checks.json',JSON.stringify({base,label,checks,paidProvider:'mocked for browser rendering',charged:false},null,2));console.log(JSON.stringify({passed:true,checks,evidence:dir}));
}finally{await browser.close();}
