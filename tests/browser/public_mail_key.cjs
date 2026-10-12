// Real templates with isolated fixtures; never accesses the application's mail database.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin, enabled = false, rejectUpdates = false, requests = [], supply = false, tokenConfigured = false, tokenRequests = [], supplyLimit = 5, testFails = false, previewMode = 'mail', connectionState = {status:'untested'};
let supplyResponseGate = null, supplyTestRequests = 0;
let savedSupplyToken = 'valid-fixture-token', revealRequests = 0, revealFails = false;
before(async () => {
    const pages = JSON.parse(execFileSync(path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask, render_template
import json, sys
app=Flask(__name__,template_folder=sys.argv[1]+'/templates')
app.jinja_env.globals['url_for']=lambda endpoint,**kw:'/static/'+kw['filename'] if endpoint=='static' else '/'+endpoint
pages={}
for owner in [True,False]:
 with app.test_request_context('/legacy/admin/system'):
  pages['owner' if owner else 'other']=render_template('admin/system.html', embedded=True, admin_username='tjt740' if owner else 'other', admin_permissions=['master_key','settings'], can_manage_public_mail_key=owner, can_manage_supply_token=owner)
for enabled in [True,False]:
 with app.test_request_context('/legacy/'):
  pages['enabled' if enabled else 'disabled']=render_template('frontend/index.html', embedded=True, public_mail_key_required=enabled)
print(json.dumps(pages))
`, root], { encoding: 'utf8', maxBuffer: 4*1024*1024 }));
    server = http.createServer(async (req,res) => {
        const pathname = new URL(req.url,'http://localhost').pathname;
        if (pathname.startsWith('/static/')) {
            const file = path.resolve(root,'.'+pathname);
            if (file.startsWith(root+'/static/') && fs.existsSync(file) && fs.statSync(file).isFile()) {
                res.setHeader('Content-Type', {'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)] || 'application/octet-stream');
                return res.end(fs.readFileSync(file));
            }
            res.statusCode=404; return res.end();
        }
        if (pathname.includes('/api/')) {
            res.setHeader('Content-Type','application/json');
            if (pathname === '/api/public-mail-config') return res.end(JSON.stringify({success:true,key_required:enabled,provider:supply?'supply':'mailbox',email_limit:supply?supplyLimit:5}));
            if (pathname === '/admin/api/supply-token') {
                if (req.method === 'POST') {
                    let body=''; for await (const chunk of req) body+=chunk;
                    const data=JSON.parse(body);
                    if (data.action === 'test') supplyTestRequests++;
                    if (supplyResponseGate) await supplyResponseGate;
                    if (data.action === 'reveal') {
                        revealRequests++;
                        if (revealFails) {
                            res.statusCode=403;
                            return res.end(JSON.stringify({success:false,message:'会话已过期，请重新登录'}));
                        }
                        return res.end(JSON.stringify({success:true,token:savedSupplyToken}));
                    }
                    if (data.action === 'settings') {
                        supplyLimit = data.email_limit;
                        return res.end(JSON.stringify({success:true,email_limit:supplyLimit}));
                    }
                    connectionState={status:'connected',checked_at:'2026-10-12T12:00:00Z',latency_ms:123,stage:data.action==='preview'?'mail':'token'};
                    if (!data.action || data.action==='save') {
                        tokenRequests.push(data.token);
                        if (data.token === 'invalid-fixture-token') {
                            connectionState.status='failed';
                            res.statusCode=422; return res.end(JSON.stringify({success:false,message:'邮件服务凭证已失效，请联系管理员更新',connection:connectionState}));
                        }
                        tokenConfigured=true;
                        savedSupplyToken=data.token;
                    }
                    if (data.action === 'test' && testFails || data.action === 'preview' && previewMode==='error') {
                        connectionState.status='failed';
                        res.statusCode=502; return res.end(JSON.stringify({success:false,message:'邮件服务暂时无法连接，请稍后重试',connection:connectionState}));
                    }
                    if (data.action === 'preview') {
                        return res.end(JSON.stringify({success:true,configured:true,connection:connectionState,mails:previewMode==='empty'?[]:Array.from({length:Math.min(data.email_limit,8)},(_,i)=>({subject:'原始邮件 '+(8-i),body_type:previewMode==='html'?'html':'text',body:'验证码 003821 <script>window.previewInjected=true</script>',from:'sender@example.com',to:data.email,date:'2026-10-12T12:00:00Z'}))}));
                    }
                }
                return res.end(JSON.stringify({success:true,configured:tokenConfigured,email_limit:supplyLimit,connection:connectionState}));
            }
            if (pathname === '/admin/api/system-config') {
                if (req.method === 'POST') {
                    let body=''; for await (const chunk of req) body+=chunk;
                    if (rejectUpdates) { res.statusCode=403; return res.end(JSON.stringify({success:false,message:'无权修改前台密钥设置'})); }
                    const data=JSON.parse(body); assert.equal(data.action,'update_public_mail_key'); enabled=data.enabled;
                }
                return res.end(JSON.stringify({success:true,data:{public_mail_key_required:enabled,admin_master_key_set:true,admin_users:[],permissions:['settings','master_key'],database_type:'sqlite'}}));
            }
            if (pathname === '/api/get_mail') {
                let body=''; for await (const chunk of req) body+=chunk;
                const data=JSON.parse(body); requests.push(data);
                if (enabled && data.master_key !== 'fixture-access-key') {
                    res.statusCode=403; return res.end(JSON.stringify({success:false,message:'密钥无效或已撤销授权'}));
                }
                if (supply) {
                    assert.equal(data.email_limit,supplyLimit);
                    return res.end(JSON.stringify({success:true,mails:Array.from({length:supplyLimit},(_,i)=>({id:String(i),subject:`原始邮件 ${5-i}`,from:'sender@example.com',to:data.email,body:'验证码 003821 <script>window.mailInjected=true</script>',body_type:'text',date:`2026-10-${String(12-i).padStart(2,'0')}T12:00:00Z`}))}));
                }
                return res.end(JSON.stringify({success:true,mails:[{id:data.email,subject:'Protected message',from:'sender@example.com',to:data.email,body:'Fixture body',body_type:'text',date:'2026-10-02 16:00:00'}]}));
            }
            return res.end(JSON.stringify({success:true,language:'zh',data:[]}));
        }
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end(pages[pathname === '/owner' ? 'owner' : pathname === '/other' ? 'other' : enabled ? 'enabled' : 'disabled']);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); origin=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
});
after(async()=>{await browser?.close(); if(server) await new Promise(resolve=>server.close(resolve));});
async function shot(page,name) {
    if (!process.env.SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,name+'.png'),fullPage:true,animations:'disabled'});
}
test('owner switch saves and survives refresh, rolls back failed updates, and is absent for other admins',async()=>{
    enabled=false; rejectUpdates=false;
    const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    try {
        await page.goto(origin+'/owner#sec-masterkey');
        await page.waitForFunction(()=>!document.getElementById('publicMailKeyRequired').disabled);
        await page.getByRole('switch').check();
        await page.waitForFunction(()=>document.getElementById('publicMailKeyStatus').textContent.includes('已开启'));
        assert.equal(enabled,true);
        await page.reload();
        await page.waitForFunction(()=>document.getElementById('publicMailKeyRequired').checked);
        await shot(page,'owner-key-settings');
        rejectUpdates=true;
        // A rejected save can roll back before Playwright's uncheck assertion.
        await page.getByRole('switch').click();
        await page.waitForFunction(()=>!document.getElementById('publicMailKeyRequired').disabled);
        assert.equal(await page.getByRole('switch').isChecked(),true);
        assert.equal(enabled,true);
        await page.goto(origin+'/other');
        assert.equal(await page.locator('#publicMailKeyRequired').count(),0);
        assert.deepEqual(errors,[]);
    } finally {rejectUpdates=false; await page.close();}
});
test('enabling on an already open page requires a key and batch retrieval includes it without persisting it',async()=>{
    enabled=false; requests=[];
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    try {
        await page.goto(origin);
        assert.equal(await page.locator('#publicMailKeyField').isVisible(),false);
        await page.locator('#emailInput').fill('one@example.com, two@example.com');
        enabled=true;
        await page.locator('.get-mail-btn').click();
        await page.locator('#publicMailKeyField').waitFor({state:'visible'});
        assert.equal(await page.locator('#publicMailKeyInput').evaluate(el=>el===document.activeElement),true);
        assert.equal(requests.length,0);
        await page.locator('#publicMailKeyInput').fill('invalid');
        await page.locator('.get-mail-btn').click();
        await page.waitForFunction(()=>document.body.textContent.includes('密钥无效或已撤销授权'));
        assert.equal(await page.locator('#mailTableBody').getByText('Protected message',{exact:true}).count(),0);
        requests=[];
        await page.locator('#publicMailKeyInput').fill('fixture-access-key');
        await page.locator('.get-mail-btn').click();
        await page.locator('#mailTableBody').getByText('Protected message',{exact:true}).first().waitFor();
        assert.equal(requests.length,2);
        assert.ok(requests.every(data=>data.master_key==='fixture-access-key'));
        assert.equal(await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes('fixture-access-key')),false);
        await shot(page,'public-key-required');
        await page.reload();
        assert.equal(await page.locator('#publicMailKeyInput').inputValue(),'');
        assert.equal(await page.locator('#publicMailKeyField').isVisible(),true);
        assert.deepEqual(errors,[]);
    } finally {await page.close();}
});
test('disabling hides and clears a stale key, and policy errors prevent retrieval',async()=>{
    enabled=true; requests=[];
    const page=await browser.newPage({reducedMotion:'reduce'});
    try {
        await page.goto(origin); await page.locator('#emailInput').fill('one@example.com');
        await page.locator('#publicMailKeyInput').fill('fixture-access-key');
        enabled=false;
        await page.locator('.get-mail-btn').click();
        await page.locator('#mailTableBody').getByText('Protected message',{exact:true}).waitFor();
        assert.equal(await page.locator('#publicMailKeyField').isVisible(),false);
        assert.equal(await page.locator('#publicMailKeyInput').inputValue(),'');
        assert.equal(requests.length,1); assert.equal('master_key' in requests[0],false);
        requests=[];
        await page.route('**/api/public-mail-config',route=>route.fulfill({status:503,contentType:'application/json',body:'{"success":false}'}));
        await page.locator('.get-mail-btn').click();
        await page.waitForFunction(()=>document.body.textContent.includes('暂时无法确认取件方式'));
        assert.equal(requests.length,0);
    } finally {await page.close();}
});
for(const width of [390,768,1440]) test(`key field remains readable in all languages and scenes at ${width}px`,async()=>{
    enabled=true;
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    try {
        await page.goto(origin);
        for (const language of ['zh','zh-TW','en','vi','fil']) for (const scene of ['day','night','rain']) {
            await page.evaluate(language=>AppI18n.setLanguage(language),language);
            await page.locator(`[data-scene="${scene}"]`).click();
            const rect=await page.locator('#publicMailKeyInput').boundingBox();
            assert.ok(rect && rect.x>=0 && rect.x+rect.width<=width);
            const button=await page.locator('.get-mail-btn').boundingBox();
            assert.ok(rect.y+rect.height<=button.y, 'Credential input must precede the retrieve action');
            assert.ok(await page.locator('#publicMailKeyHint').isVisible());
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        }
        await page.evaluate(()=>AppI18n.setLanguage('zh'));
        await shot(page,'public-key-'+width);
    } finally {await page.close();}
});

test('Supply token form is owner-only, validates before saving, clears input and never persists credentials', async()=>{
    tokenConfigured=false; tokenRequests=[]; supplyLimit=5; connectionState={status:'untested'};
    const page=await browser.newPage({viewport:{width:390,height:1000},reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    try {
        await page.goto(origin+'/owner#sec-supply');
        await page.locator('#supplyTokenInput').waitFor({state:'visible'});
        await page.locator('#supplyTokenInput').fill('invalid-fixture-token');
        await page.locator('#supplyTokenSubmit').click();
        await page.waitForFunction(()=>!document.getElementById('supplyTokenSubmit').disabled);
        assert.equal(tokenConfigured,false);
        assert.equal(await page.locator('#supplyTokenInput').inputValue(),'');
        await page.locator('#supplyTokenInput').fill('valid-fixture-token');
        await page.locator('#supplyTokenSubmit').click();
        await page.waitForFunction(()=>document.getElementById('supplyTokenStatus').textContent==='已配置 Supply Token');
        assert.deepEqual(tokenRequests,['invalid-fixture-token','valid-fixture-token']);
        assert.equal(await page.locator('#supplyTokenInput').inputValue(),'');
        assert.equal(await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes('fixture-token')),false);
        await page.evaluate(()=>AppI18n.setLanguage('zh-TW'));
        await page.waitForFunction(()=>document.getElementById('supplyTokenSubmit').textContent==='驗證並儲存 Token');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await shot(page,'supply-token-traditional-mobile');
        await page.reload();
        await page.waitForFunction(()=>document.getElementById('supplyTokenStatus').textContent==='已設定 Supply Token');
        assert.equal(await page.locator('#supplyTokenInput').inputValue(),'');
        await page.goto(origin+'/other');
        assert.equal(await page.locator('#supplyTokenInput').count(),0);
        assert.deepEqual(errors,[]);
    } finally {await page.close();}
});
test('owner can reveal saved or draft tokens without caching them or changing connection status',async()=>{
    tokenConfigured=true; savedSupplyToken='saved-token-fixture-123'; revealRequests=0; revealFails=false;
    connectionState={status:'untested'};
    const page=await browser.newPage({viewport:{width:390,height:1100},reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    let release;
    try {
        await page.goto(origin+'/owner#sec-supply');
        const input=page.locator('#supplyTokenInput'), toggle=page.locator('#supplyTokenToggle');
        await page.waitForFunction(()=>!document.getElementById('supplyTokenToggle').disabled);
        assert.equal(await input.inputValue(),'');
        assert.equal(revealRequests,0,'Loading settings must not fetch plaintext');
        await toggle.click();
        await page.waitForFunction(()=>document.getElementById('supplyTokenInput').type==='text');
        assert.equal(await input.inputValue(),savedSupplyToken);
        assert.equal(revealRequests,1);
        assert.equal(await page.locator('#supplyHealth').getAttribute('data-state'),'untested');
        assert.equal(await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes('saved-token-fixture')),false);
        await page.evaluate(()=>AppI18n.setLanguage('zh-TW'));
        assert.equal(await toggle.getAttribute('aria-label'),'隱藏 Token');
        await toggle.click();
        assert.equal(await input.getAttribute('type'),'password');
        assert.equal(await input.inputValue(),'');
        assert.equal(await toggle.getAttribute('aria-label'),'查看已儲存的 Token');
        await input.fill('draft-token-fixture');
        await toggle.click();
        assert.equal(await input.getAttribute('type'),'text');
        assert.equal(revealRequests,1,'A draft is shown locally');
        await toggle.click();
        assert.equal(await input.inputValue(),'draft-token-fixture');
        assert.equal(await input.getAttribute('type'),'password');
        await input.fill('');
        await toggle.click();
        await page.waitForFunction(()=>document.getElementById('supplyTokenInput').type==='text');
        await page.locator('a[href="#sec-account"]').click();
        await page.waitForFunction(()=>document.getElementById('supplyTokenInput').value==='');
        await page.locator('a[href="#sec-supply"]').click();
        assert.equal(await input.getAttribute('type'),'password');
        supplyResponseGate=new Promise(resolve=>{release=resolve;});
        await toggle.click();
        await page.locator('a[href="#sec-account"]').click();
        supplyResponseGate=null; release();
        await page.locator('a[href="#sec-supply"]').click();
        assert.equal(await input.inputValue(),'','Leaving the section cancels a pending reveal');
        revealFails=true;
        await toggle.click();
        await page.waitForFunction(()=>!document.getElementById('supplyTokenToggle').disabled);
        assert.equal(await input.inputValue(),'');
        assert.equal(await input.getAttribute('type'),'password');
        revealFails=false;
        await toggle.click();
        await page.waitForFunction(()=>document.getElementById('supplyTokenInput').type==='text');
        await page.locator('#supplyTokenSubmit').click();
        await page.waitForFunction(()=>!document.getElementById('supplyTokenSubmit').disabled);
        assert.equal(tokenRequests.at(-1),'saved-token-fixture-123','Saving a displayed token must not submit an empty value');
        assert.equal(await input.inputValue(),'');
        assert.equal(await input.getAttribute('type'),'password');
        await shot(page,'supply-token-eye-mobile');
        await page.reload();
        assert.equal(await input.inputValue(),'');
        await page.goto(origin+'/other');
        assert.equal(await toggle.count(),0);
        assert.deepEqual(errors,[]);
    } finally {supplyResponseGate=null; release?.(); revealFails=false; await page.close();}
});

for (const width of [390,1440]) test(`Supply displays all five recent messages and preserves their original text at ${width}px`, async()=>{
    enabled=false; supply=true; requests=[]; supplyLimit=5;
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    try {
        await page.goto(origin);
        await page.evaluate(()=>AppI18n.setLanguage('zh-TW'));
        await page.locator('#emailInput').fill('one@example.com, two@example.com');
        await page.locator('.get-mail-btn').click();
        await page.waitForFunction(()=>document.querySelectorAll('#mailTableBody tr[data-mail-id]').length===10);
        assert.equal(requests.length,2);
        assert.ok(requests.every(data=>data.email_limit===5));
        assert.equal(await page.locator('[data-folder="trash"]').isVisible(),false);
        assert.equal(await page.locator('#mailPerPageSelect').count(),0);
        assert.equal(await page.locator('#mailTableBody .col-subject').first().innerText(),'原始邮件 5');
        await page.locator('#mailTableBody tr[data-mail-id]').first().click();
        assert.equal(await page.evaluate(()=>window.mailInjected),undefined);
        await page.evaluate(()=>AppI18n.setLanguage('en'));
        await page.evaluate(()=>AppI18n.setLanguage('zh-TW'));
        await page.evaluate(()=>closeMailModal(true));
        assert.equal(await page.locator('#mailTableBody .col-subject').first().innerText(),'原始邮件 5');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await shot(page,'supply-five-traditional-'+width);
        assert.deepEqual(errors,[]);
    } finally {supply=false; await page.close();}
});

test('Supply frontend follows the saved quantity without displaying a limit hint',async()=>{
    enabled=false; supply=true; supplyLimit=7; requests=[];
    const page=await browser.newPage({reducedMotion:'reduce'});
    try {
        await page.goto(origin);
        await page.waitForFunction(()=>window.AppI18n);
        await page.evaluate(()=>AppI18n.setLanguage('zh-TW'));
        assert.equal(await page.locator('#publicMailLimitHint').count(),0);
        await page.evaluate(()=>AppI18n.setLanguage('en'));
        assert.equal(await page.locator('#publicMailLimitHint').count(),0);
        await page.locator('#emailInput').fill('reader@example.com');
        await page.locator('.get-mail-btn').click();
        await page.waitForFunction(()=>document.querySelectorAll('#mailTableBody tr[data-mail-id]').length===7);
        assert.equal(requests[0].email_limit,7);
        supplyLimit=9;
        await page.locator('.get-mail-btn').click();
        await page.waitForFunction(()=>document.querySelectorAll('#mailTableBody tr[data-mail-id]').length===9);
        assert.equal(requests[1].email_limit,9);
        await page.evaluate(()=>AppI18n.setLanguage('zh-TW'));
        assert.equal(await page.locator('#publicMailLimitHint').count(),0);
    } finally {supply=false; supplyLimit=5; await page.close();}
});

for (const width of [390,1440]) test(`Supply settings save quantity, report connectivity and safely preview mail at ${width}px`,async()=>{
    tokenConfigured=true; supplyLimit=5; testFails=false; previewMode='mail'; connectionState={status:'untested'};
    const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    try {
        await page.goto(origin+'/owner#sec-supply');
        await page.waitForFunction(()=>!document.getElementById('supplyTestButton').disabled);
        assert.equal(await page.locator('#sec-supply').getByText('配置后，前台通过 Supply 获取每个邮箱最近的 5 封邮件。').count(),0);
        assert.equal(await page.locator('#sec-supply').getByText('仅 tjt740 本人可配置。Token 只保存在服务端，保存后不回显。').count(),0);
        await page.locator('#supplyMailLimit').fill('7');
        await page.locator('#supplyLimitSubmit').click();
        await page.waitForFunction(()=>document.getElementById('supplyLimitStatus').textContent==='已保存');
        assert.equal(supplyLimit,7);
        await page.locator('#supplyTestButton').click();
        await page.waitForFunction(()=>document.getElementById('supplyConnectionStatus').textContent==='已连通');
        assert.equal(await page.locator('#supplyLatency').textContent(),'123 ms');
        assert.ok(await page.locator('#supplyCheckedAt').textContent());
        await page.reload();
        await page.waitForFunction(()=>!document.getElementById('supplyTestButton').disabled);
        assert.equal(await page.locator('#supplyMailLimit').inputValue(),'7');
        assert.equal(await page.locator('#supplyConnectionStatus').textContent(),'已连通');
        await page.locator('#supplyMailLimit').fill('3');
        await page.locator('#supplyPreviewEmail').fill('reader@example.com');
        await page.locator('#supplyPreviewButton').click();
        await page.waitForFunction(()=>document.querySelectorAll('#supplyPreviewResults details').length===3);
        assert.equal(supplyLimit,7,'Preview must not save the draft quantity');
        assert.equal(await page.locator('#supplyPreviewResults pre').first().textContent(),'验证码 003821 <script>window.previewInjected=true</script>');
        assert.equal(await page.evaluate(()=>window.previewInjected),undefined);
        await page.evaluate(()=>AppI18n.setLanguage('zh-TW'));
        await page.waitForFunction(()=>document.getElementById('supplyPreviewButton').textContent==='預覽郵件');
        assert.equal(await page.locator('#supplyPreviewResults time').first().textContent(),await page.evaluate(()=>AppI18n.formatDate('2026-10-12T12:00:00Z')));
        assert.equal(await page.locator('#supplyPreviewResults summary').first().textContent(),'原始邮件 8');
        assert.equal(await page.locator('#supplyPreviewResults pre').first().textContent(),'验证码 003821 <script>window.previewInjected=true</script>');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await shot(page,'supply-preview-'+width);
        previewMode='html';
        await page.locator('#supplyPreviewButton').click();
        const htmlPreview=page.locator('#supplyPreviewResults .supply-mail-frame').first();
        await htmlPreview.waitFor();
        const mailFrame=await (await htmlPreview.elementHandle()).contentFrame();
        assert.ok((await mailFrame.locator('body').textContent()).includes('验证码 003821'));
        assert.equal(await mailFrame.locator('script').count(),0);
        assert.equal(await page.evaluate(()=>window.previewInjected),undefined);
        previewMode='empty';
        await page.locator('#supplyPreviewButton').click();
        await page.waitForFunction(()=>!document.getElementById('supplyPreviewButton').disabled && document.getElementById('supplyPreviewStatus').textContent);
        assert.equal(await page.locator('#supplyPreviewStatus').textContent(),'郵箱中暫無郵件');
        assert.equal(await page.locator('#supplyPreviewResults details').count(),0);
        assert.equal(await page.locator('#supplyConnectionStatus').getAttribute('data-state'),'connected');
        previewMode='error';
        await page.locator('#supplyPreviewButton').click();
        await page.waitForFunction(()=>document.getElementById('supplyConnectionStatus').dataset.state==='failed');
        assert.equal(await page.locator('#supplyPreviewResults details').count(),0);
        previewMode='mail'; testFails=false;
        await page.locator('#supplyTestButton').click();
        await page.waitForFunction(()=>document.getElementById('supplyConnectionStatus').dataset.state==='connected');
        await page.goto(origin+'/other#sec-supply');
        assert.equal(await page.locator('a[href="#sec-supply"]').count(),0);
        assert.equal(await page.locator('#supplyPreviewEmail').count(),0);
        assert.deepEqual(errors,[]);
    } finally {supplyLimit=5; previewMode='mail'; testFails=false; await page.close();}
});

test('Supply animation follows real results, pauses when hidden and respects reduced motion',async()=>{
    tokenConfigured=true; supplyLimit=5; testFails=false; previewMode='mail'; connectionState={status:'untested'};
    const page=await browser.newPage({viewport:{width:1100,height:1100},reducedMotion:'no-preference'});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    let release;
    try {
        await page.goto(origin+'/owner#sec-supply');
        await page.waitForFunction(()=>!document.getElementById('supplyTestButton').disabled);
        assert.equal(await page.locator('#supplyHealth').getAttribute('data-state'),'untested');
        assert.equal(await page.locator('#supplyConnectionCanvas').getAttribute('data-animating'),'false');
        supplyResponseGate=new Promise(resolve=>{release=resolve;});
        const requestsBefore=supplyTestRequests;
        await page.locator('#supplyConnectionHub').focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(()=>document.getElementById('supplyConnectionCanvas').dataset.animating==='true',null,{timeout:5000});
        assert.equal(await page.locator('#supplyHealth').getAttribute('data-state'),'checking');
        assert.equal(await page.locator('#supplyTestButton').getAttribute('aria-busy'),'true');
        assert.equal(await page.locator('#supplyConnectionHub').getAttribute('aria-busy'),'true');
        assert.ok(await page.locator('#supplyConnectionHub').isDisabled());
        assert.equal(await page.locator('#supplySceneStatus').innerText(),'等待响应…');
        await page.keyboard.press('Enter');
        assert.equal(supplyTestRequests,requestsBefore+1,'The hub starts one real test and prevents duplicate requests');
        const firstFrame=await page.locator('#supplyConnectionCanvas').evaluate(canvas=>canvas.toDataURL());
        await page.waitForFunction(first=>document.getElementById('supplyConnectionCanvas').toDataURL()!==first,firstFrame);
        assert.ok(await page.locator('#supplyConnectionHub').evaluate(el=>el.getAnimations({subtree:true}).filter(animation=>animation.animationName==='supply-spin' && animation.playState==='running').length>=2),'Waiting rings must keep rotating alongside the Canvas signals');
        assert.equal(await page.locator('#supplyHealth').getAttribute('data-state'),'checking','Moving signals must not invent a successful response');
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.waitForFunction(()=>document.getElementById('supplyConnectionCanvas').dataset.animating==='false');
        assert.equal(await page.locator('.supply-scene-hub').evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.waitForFunction(()=>document.getElementById('supplyConnectionCanvas').dataset.animating==='true');
        assert.ok(await page.locator('#supplyLimitSubmit').isDisabled());
        await shot(page,'supply-motion-checking');
        supplyResponseGate=null; release();
        await page.waitForFunction(()=>document.getElementById('supplyHealth').dataset.state==='connected');
        assert.equal(await page.locator('#supplyConnectionCanvas').getAttribute('data-feedback'),'connected');
        assert.ok(await page.locator('.supply-icon-check').isVisible());
        assert.equal(await page.locator('#supplyTestButton').getAttribute('aria-busy'),'false');
        await shot(page,'supply-motion-connected');
        await page.locator('[data-limit="10"]').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#supplyMailLimit').inputValue(),'10');
        assert.equal(await page.locator('[data-limit="10"]').getAttribute('aria-pressed'),'true');
        assert.equal(supplyLimit,5,'A preset changes the draft, not the saved configuration');
        await page.locator('#supplyPreviewEmail').fill('reader@example.com');
        supplyResponseGate=new Promise(resolve=>{release=resolve;});
        await page.locator('#supplyPreviewButton').click();
        assert.equal(await page.locator('.supply-skeleton').count(),3);
        assert.equal(await page.locator('#supplyPreviewResults').getAttribute('aria-busy'),'true');
        supplyResponseGate=null; release();
        await page.waitForFunction(()=>document.querySelectorAll('#supplyPreviewResults details').length===8);
        assert.equal(await page.locator('.supply-skeleton').count(),0);
        assert.equal(await page.locator('#supplyPreviewResults').getAttribute('aria-busy'),'false');
        await page.locator('#supplyPreviewResults summary').nth(1).click();
        assert.equal(await page.locator('#supplyPreviewResults details').nth(1).evaluate(el=>el.open),true);
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#supplyPreviewResults details').nth(1).evaluate(el=>el.open),false);
        testFails=true;
        await page.locator('#supplyTestButton').click();
        await page.waitForFunction(()=>document.getElementById('supplyHealth').dataset.state==='failed');
        assert.ok(await page.locator('.supply-icon-failed').isVisible());
        assert.equal(await page.locator('#supplyConnectionCanvas').getAttribute('data-feedback'),'failed');
        await page.waitForFunction(()=>document.getElementById('supplyConnectionCanvas').dataset.animating==='false');
        assert.equal(await page.locator('#supplyConnectionHub').getAttribute('aria-label'),'重新测试连通');
        assert.equal(await page.locator('#supplySceneStatus').innerText(),'点击重试');
        await shot(page,'supply-motion-failed');
        testFails=false;
        await page.locator('#supplyConnectionHub').click();
        await page.waitForFunction(()=>document.getElementById('supplyHealth').dataset.state==='connected');
        assert.equal(await page.locator('.au-toast.error').count(),0,'Retry must clear stale Supply errors');
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.waitForFunction(()=>document.getElementById('supplyConnectionCanvas').dataset.animating==='false');
        assert.ok(await page.locator('.supply-icon-check').isVisible());
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.waitForFunction(()=>document.getElementById('supplyConnectionCanvas').dataset.animating==='true',null,{timeout:5000});
        await page.locator('a[href="#sec-account"]').click();
        await page.waitForFunction(()=>document.getElementById('supplyConnectionCanvas').dataset.animating==='false');
        assert.equal(await page.locator('#supplyConnectionScene').evaluate(el=>getComputedStyle(el).getPropertyValue('--supply-play-state').trim()),'paused');
        await page.locator('a[href="#sec-supply"]').click();
        await page.waitForFunction(()=>document.getElementById('supplyConnectionCanvas').dataset.animating==='true');
        await page.evaluate(()=>AppColorTheme.setTheme('night',{persist:false}));
        await page.waitForFunction(()=>getComputedStyle(document.getElementById('supplyHealth')).backgroundColor==='rgb(29, 39, 64)');
        await shot(page,'supply-motion-night');
        assert.deepEqual(errors,[]);
    } catch (error) {
        console.error('Supply motion failure context:',await page.evaluate(()=>({
            reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
            hidden:document.hidden,sectionHidden:document.getElementById('sec-supply').hidden,
            rect:document.getElementById('supplyConnectionScene').getBoundingClientRect().toJSON(),
            state:document.getElementById('supplyHealth').dataset.state,
            animating:document.getElementById('supplyConnectionCanvas').dataset.animating,
            motion:document.getElementById('supplyConnectionCanvas').dataset.motion,
            rings:{name:getComputedStyle(document.getElementById('supplyConnectionHub'),'::before').animationName,
                playState:getComputedStyle(document.getElementById('supplyConnectionHub'),'::before').animationPlayState,
                animations:document.getElementById('supplyConnectionHub').getAnimations({subtree:true}).map(animation=>({name:animation.animationName,state:animation.playState}))}
        })),errors);
        await shot(page,'supply-motion-failure-context');
        throw error;
    } finally {supplyResponseGate=null; release?.(); testFails=false; await page.close();}
});
