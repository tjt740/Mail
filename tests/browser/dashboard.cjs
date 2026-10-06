// Dashboard fixtures only. Never touches the project database or real mailboxes.
const assert=require('node:assert/strict');
const {before,after,test}=require('node:test');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..');
let server,browser,origin,fail=false,requests=0,data;
function fixture(){return {success:true,updated_at:'2026-10-02 16:00:00',mailboxes:{total:1200,health:{normal:960,banned:24,invalid_credentials:36,network_error:40,test_error:20,pending:120}},trend:Array.from({length:7},(_,i)=>({day:`2026-${i<5?'09':'10'}-${i<5?26+i:String(i-4).padStart(2,'0')}`,received:[85,110,96,140,132,167,128][i],processed:0,failed:[5,9,6,12,5,8,3][i]})),proxies:{total:32,enabled:28,tested:30,latency_ms:168},cards:{total:500,active:342,expired:58},poller:{started:true,running:true,enabled:true,interval:300,last_checked_count:120,last_new_count:18,last_failed_count:2,last_finished_at:'2026-10-02 15:58:12',next_run_at:'2026-10-02 16:03:12'},recent_failures:[{email:'<img src=x onerror=alert(1)>@example.com',created_at:'2026-10-02 15:42:10'},{email:'support@example.com',created_at:'2026-10-02 15:20:00'}]};}
before(async()=>{
 const html=execFileSync(process.env.PYTHON_BIN||path.join(root,'.venv/bin/python'),['-c',`
from flask import Flask, render_template
import sys
app=Flask(__name__,template_folder=sys.argv[1]+'/templates')
app.jinja_env.globals['url_for']=lambda endpoint,**kw:'/static/'+kw['filename'] if endpoint=='static' else '/'+endpoint
with app.test_request_context('/legacy/admin/home'):
 print(render_template('admin/home.html',embedded=True,admin_username='fixture',admin_permissions=['home','mailbox','cards','proxies','mail_logs','settings']))
`,root],{encoding:'utf8',maxBuffer:2*1024*1024});
 server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/static/')){const file=path.resolve(root,'.'+url.pathname);if(file.startsWith(root+'/static/')&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');return res.end(fs.readFileSync(file));}res.statusCode=404;return res.end();}
  if(url.pathname==='/admin/api/dashboard'){requests++;res.setHeader('Content-Type','application/json');if(fail){res.statusCode=503;return res.end(JSON.stringify({success:false}));}return res.end(JSON.stringify(data));}
  if(url.pathname.includes('/api/')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({success:true,language:'zh'}));}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function pageFor(options={}){fail=false;requests=0;data=fixture();const page=await browser.newPage({viewport:{width:1440,height:1100},...options});page.setDefaultTimeout(6000);await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#metricTotal').textContent==='1,200');return page;}
test('panels show real snapshot values, date inspection and escaped failure text',async()=>{
 const page=await pageFor({reducedMotion:'reduce'});try{
  assert.equal(await page.locator('#metricHealth').innerText(),'80%');assert.equal(await page.locator('#metricReceived').innerText(),'128');assert.equal(await page.locator('#metricFailed').innerText(),'3');
  assert.equal(await page.locator('#monitorProxyCount').innerText(),'28 / 32');
  assert.equal(await page.locator('#monitorRecentFailures img').count(),0);
  await page.locator('#monitorChartDays button').first().focus();assert.match(await page.locator('#monitorChartDetail').innerText(),/2026-09-26.*85.*5/);
  assert.equal(await page.locator('#monitorPollerState').innerText(),'运行中');
  if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'dashboard-desktop.png'),fullPage:true});}
 }finally{await page.close();}
});
test('refresh failures keep timestamp and values, recover, and unavailable panels never become zeros',async()=>{
 const page=await pageFor({reducedMotion:'reduce'});try{
  fail=true;await page.locator('#monitorRefresh').click();await page.locator('#monitorError').waitFor({state:'visible'});
  assert.match(await page.locator('#monitorError').innerText(),/保留上次数据/);assert.match(await page.locator('#monitorUpdated').innerText(),/16:00:00/);
  fail=false;data.updated_at='2026-10-02 16:01:00';data.trend=null;data.proxies=null;data.cards=null;data.poller=null;data.recent_failures=null;
  data.mailboxes={total:0,health:{normal:0,banned:0,invalid_credentials:0,network_error:0,test_error:0,pending:0}};
  await page.locator('#monitorRefresh').click();await page.waitForFunction(()=>document.querySelector('#monitorUpdated').textContent.includes('16:01:00'));
  assert.equal(await page.locator('#metricTotal').innerText(),'0');assert.equal(await page.locator('#metricHealth').innerText(),'—');assert.equal(await page.locator('#metricReceived').innerText(),'—');
  assert.equal(await page.locator('#monitorProxyCount').innerText(),'无权限');assert.equal(await page.locator('#monitorPollerState').innerText(),'无权限');assert.equal(await page.locator('#monitorError').isVisible(),false);
 }finally{await page.close();}
});
test('3D canvas animates with bounded pixels and stops for lifecycle and reduced motion',async()=>{
 const page=await pageFor({deviceScaleFactor:3});try{
  await page.waitForFunction(()=>MailDashboard.scene?.frameCount>8);
  let count=await page.evaluate(()=>MailDashboard.scene.frameCount);await page.waitForTimeout(120);assert.ok(await page.evaluate(()=>MailDashboard.scene.frameCount)>count);
  assert.ok(await page.evaluate(()=>{const c=document.querySelector('#monitorScene');return c.width*c.height<=1204000;}));
  await page.locator('.monitor-metric').first().hover();await page.waitForFunction(()=>document.querySelector('.monitor-metric').hasAttribute('data-depth-active'));
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));count=await page.evaluate(()=>MailDashboard.scene.frameCount);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>MailDashboard.scene.frameCount),count);assert.equal(await page.evaluate(()=>MailDashboard.scene.animating),false);
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await page.waitForFunction(()=>MailDashboard.scene.animating);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!MailDashboard.scene.animating);
  assert.equal(await page.locator('.monitor-metric[data-depth-active]').count(),0);
  const values=await page.locator('#metricTotal').innerText();assert.equal(values,'1,200');
 }finally{await page.close();}
});
test('mobile layout and unavailable Canvas keep monitoring usable',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});fail=false;data=fixture();try{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#metricTotal').textContent==='1,200');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#monitorChartDays button').count(),7);
  await page.locator('#monitorChartDays button').last().click();assert.match(await page.locator('#monitorChartDetail').innerText(),/128/);
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'dashboard-mobile.png'),fullPage:true});
 }finally{await page.close();}
});
test('health and attention actions open the matching mailbox filter',async()=>{
 const page=await pageFor({reducedMotion:'reduce'});try{
  await page.evaluate(()=>{window.goAdmin=url=>window.testNavigation=url;});
  await page.locator('#monitorHealthList button').nth(2).click();
  assert.equal(await page.evaluate(()=>window.testNavigation),'/admin/mailbox?status=invalid_credentials&group=all');
  await page.locator('#monitorRetry').click();
  assert.equal(await page.evaluate(()=>window.testNavigation),'/admin/mailbox?status=retry&group=all');
 }finally{await page.close();}
});
test('mobile charts and translated labels fit in all supported languages',async()=>{
 const page=await pageFor({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});try{
  for(const language of ['en','vi','zh','fil']){
   await page.evaluate(language=>AppI18n.setLanguage(language),language);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,language);
   assert.equal(await page.locator('#monitorRecentFailures span').first().textContent(),'<img src=x onerror=alert(1)>@example.com');
   assert.equal(await page.locator('#monitorTrend').isVisible(),true);
  }
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'dashboard-mobile-chart.png'),fullPage:true});
 }finally{await page.close();}
});
