// Real templates with isolated fixtures; never accesses the application's mail database.
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin, enabled = false, rejectUpdates = false, requests = [];
before(async () => {
    const pages = JSON.parse(execFileSync(path.join(root, '.venv/bin/python'), ['-c', `
from flask import Flask, render_template
import json, sys
app=Flask(__name__,template_folder=sys.argv[1]+'/templates')
app.jinja_env.globals['url_for']=lambda endpoint,**kw:'/static/'+kw['filename'] if endpoint=='static' else '/'+endpoint
pages={}
for owner in [True,False]:
 with app.test_request_context('/legacy/admin/system'):
  pages['owner' if owner else 'other']=render_template('admin/system.html', embedded=True, admin_username='tjt740' if owner else 'other', admin_permissions=['master_key','settings'], can_manage_public_mail_key=owner)
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
            if (pathname === '/api/public-mail-config') return res.end(JSON.stringify({success:true,key_required:enabled}));
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
                return res.end(JSON.stringify({success:true,mails:[{id:data.email,subject:'Protected message',from:'sender@example.com',to:data.email,body:'Fixture body',body_type:'text',date:'2026-10-02 16:00:00'}]}));
            }
            return res.end(JSON.stringify({success:true,language:'zh',data:[]}));
        }
        res.setHeader('Content-Type','text/html; charset=utf-8');
        res.end(pages[pathname === '/owner' ? 'owner' : pathname === '/other' ? 'other' : enabled ? 'enabled' : 'disabled']);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); origin=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close(); if(server) await new Promise(resolve=>server.close(resolve));});
async function shot(page,name) {
    if (!process.env.SCREENSHOT_DIR) return;
    fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,name+'.png'),fullPage:true});
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
        await page.getByRole('switch').uncheck();
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
        for (const language of ['zh','en','vi','fil']) for (const scene of ['day','night','rain']) {
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
