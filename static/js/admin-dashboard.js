(function () {
    'use strict';
    let initialized = false, snapshot = null, timer = null, request = null, suspended = false, chartFrame = null, chartProgress = 1, activeDay = -1;
    let scene = null, chartObserver = null;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const counters = new Map();
    const colors = { normal: '#6c9b83', banned: '#c97b62', invalid_credentials: '#dfa274', network_error: '#88a6b3', test_error: '#b7a785', pending: '#d8d5ce' };
    const labels = { normal: '正常', banned: '封禁', invalid_credentials: '凭据失效', network_error: '网络异常', test_error: '检测异常', pending: '未检测' };
    const t = value => window.AppI18n?.t(value) || value;
    const el = id => document.getElementById(id);
    const number = value => new Intl.NumberFormat(window.AppI18n?.language || 'zh').format(value);
    const text = (id, value) => { if (el(id)) el(id).textContent = value; };
    function animateNumber(id, value, suffix = '') {
        const element = el(id); if (!element) return;
        const old = counters.get(id); if (old) cancelAnimationFrame(old.frame);
        counters.delete(id);
        if (value === null || value === undefined) { element.textContent = '—'; delete element.dataset.number; return; }
        const from = Number(element.dataset.number || 0);
        element.dataset.number = String(value);
        const finish = () => { element.textContent = number(value) + suffix; counters.delete(id); };
        if (reduced.matches || document.hidden || from === value) { finish(); return; }
        const start = performance.now();
        const entry = { frame: null, finish };
        const tick = now => {
            const p = Math.min(1, (now-start)/600);
            const v = from + (value-from) * (1-Math.pow(1-p,3));
            element.textContent = number(suffix ? Math.round(v*10)/10 : Math.round(v)) + suffix;
            if (p < 1) entry.frame = requestAnimationFrame(tick); else finish();
        };
        counters.set(id, entry); entry.frame = requestAnimationFrame(tick);
    }
    function settleAnimations() {
        counters.forEach(entry => { cancelAnimationFrame(entry.frame); entry.finish(); }); counters.clear();
        if (chartFrame !== null) cancelAnimationFrame(chartFrame); chartFrame = null; chartProgress = 1;
    }
    function goMailbox(status) { window.goAdmin(`/admin/mailbox?status=${encodeURIComponent(status)}&group=all`); }
    function renderHealth(data) {
        const palette = window.MailThemes?.get(document.documentElement.dataset.colorTheme);
        if (palette) Object.assign(colors, { normal: palette.mint, banned: palette.coral, invalid_credentials: palette.gold, network_error: palette.cyan, test_error: palette.violet, pending: palette.muted });
        const health = data.mailboxes.health, total = data.mailboxes.total;
        animateNumber('metricTotal', total);
        animateNumber('metricHealth', total ? Math.round(health.normal / total * 1000)/10 : null, '%');
        text('metricHealthNote', `${number(health.normal)} / ${number(total)} · ${t('按最近一次检测结果')}`);
        text('monitorHealthCount', number(health.normal));
        let angle = 0;
        const stops = Object.keys(colors).map(key => { const start = angle; angle += total ? health[key]/total*360 : 0; return `${colors[key]} ${start}deg ${angle}deg`; });
        el('monitorDonut').style.background = total ? `conic-gradient(${stops.join(',')})` : 'var(--surface-3)';
        const list = el('monitorHealthList'); list.replaceChildren();
        for (const key of Object.keys(colors)) {
            const accessible = document.querySelector('.monitor-home').dataset.mailboxAccess === 'true';
            const item = document.createElement(accessible ? 'button' : 'div'); item.className = 'monitor-health-item';
            if (accessible) { item.type = 'button'; item.addEventListener('click', () => goMailbox(key)); }
            const dot = document.createElement('i'); dot.style.background = colors[key];
            const label = document.createElement('span'); label.textContent = t(labels[key]);
            const count = document.createElement('b'); count.textContent = number(health[key]);
            item.append(dot, label, count); list.append(item);
        }
        text('monitorInvalid', number(health.banned + health.invalid_credentials));
        text('monitorRetry', number(health.network_error + health.test_error)); text('monitorPending', number(health.pending));
    }
    function renderResources(data) {
        const proxy = data.proxies;
        text('monitorProxyCount', proxy ? `${number(proxy.enabled)} / ${number(proxy.total)}` : t('无权限'));
        text('monitorProxyDetail', proxy ? `${t('已检测')} ${number(proxy.tested)} · ${t('最近检测平均延迟')} ${proxy.latency_ms === null ? '—' : number(proxy.latency_ms) + ' ms'}` : t('需要代理池权限'));
        el('monitorProxyBar').style.width = proxy?.total ? proxy.enabled / proxy.total * 100 + '%' : '0%';
        const cards = data.cards;
        text('monitorCardCount', cards ? `${number(cards.active)} / ${number(cards.total)}` : t('无权限'));
        text('monitorCardDetail', cards ? `${t('已过期')} ${number(cards.expired)} · ${t('可用卡密未过期且仍有次数')}` : t('需要卡密管理权限'));
        el('monitorCardBar').style.width = cards?.total ? cards.active / cards.total * 100 + '%' : '0%';
    }
    function renderPoller(state) {
        text('monitorPollerState', t(!state ? '无权限' : !state.enabled ? '已暂停' : !state.started ? '未启动' : state.running ? '运行中' : '等待下次轮询'));
        el('monitorPollerState').dataset.running = String(Boolean(state?.running && state.enabled));
        el('monitorPollerState').closest('.monitor-panel').classList.toggle('is-polling', Boolean(state?.running && state.enabled));
        const facts = el('monitorPollerFacts'); facts.replaceChildren();
        const pairs = state ? [
            ['轮询间隔', `${number(state.interval)} ${t('秒')}`],
            ['上次检查邮箱', number(state.last_checked_count || 0)],
            ['上次新增 / 失败', `${number(state.last_new_count || 0)} / ${number(state.last_failed_count || 0)}`],
            ['上次完成', state.last_finished_at || '—'],
            ['下次计划', state.enabled && state.started ? state.next_run_at || '—' : '—']
        ] : [['需要系统设置权限', '—']];
        for (const [label, value] of pairs) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = t(label); dd.textContent = value; facts.append(dt, dd); }
    }
    function renderFailures(rows) {
        const list = el('monitorRecentFailures'); list.replaceChildren();
        if (!rows?.length) { const p = document.createElement('p'); p.textContent = t(rows ? '近 7 天暂无失败记录' : '需要收件日志权限'); list.append(p); return; }
        rows.forEach(row => { const item = document.createElement('div'), email = document.createElement('span'), date = document.createElement('time'); email.setAttribute('translate', 'no'); email.textContent = row.email; email.title = row.email; date.textContent = row.created_at.slice(5, 16); item.append(email, date); list.append(item); });
    }
    function selectedDay(index) {
        activeDay = index;
        const point = snapshot?.trend?.[index]; if (!point) return;
        text('monitorChartDetail', `${point.day} · ${t('收件')} ${number(point.received)} · ${t('已处理')} ${number(point.processed)} · ${t('失败')} ${number(point.failed)}`);
        el('monitorChartDays').querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
        drawChart(chartProgress);
    }
    function drawChart(progress = 1) {
        const canvas = el('monitorTrend'); let ctx; try { ctx = canvas.getContext('2d'); } catch (_) { return; } if (!ctx) return;
        const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
        const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(1400000/(width*height)));
        if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) { canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr); }
        ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
        const rows = snapshot?.trend || []; if (!rows.length) return;
        const max = Math.max(1, ...rows.flatMap(row => [row.received, row.failed]));
        const left = 38, right = 14, top = 12, bottom = height-12;
        const x = i => left + i/(rows.length-1 || 1)*(width-left-right), y = value => bottom-value/max*(bottom-top)*progress;
        const palette = window.MailThemes?.get(document.documentElement.dataset.colorTheme) || { muted: '#63748a', border: '#dce3eb', cyan: '#007f9d', coral: '#c45869' };
        ctx.font = '11px system-ui'; ctx.fillStyle = palette.muted;
        for (let i=0;i<4;i++) { const yy = top+(bottom-top)*i/3; ctx.beginPath(); ctx.moveTo(left,yy); ctx.lineTo(width-right,yy); ctx.strokeStyle=palette.border; ctx.lineWidth=1; ctx.stroke(); ctx.fillText(number(Math.round(max*(1-i/3))),0,yy+4); }
        if (activeDay >= 0) { ctx.fillStyle=palette.cyan+'0c'; ctx.fillRect(x(activeDay)-15,top,30,bottom-top); }
        for (const [key, color] of [['received',palette.cyan], ['failed',palette.coral]]) {
            ctx.beginPath(); rows.forEach((row,i) => i ? ctx.lineTo(x(i),y(row[key])) : ctx.moveTo(x(i),y(row[key])));
            ctx.lineWidth=2.3; ctx.strokeStyle=color; ctx.lineJoin='round'; ctx.stroke();
            if (key === 'received') { ctx.lineTo(x(rows.length-1),bottom); ctx.lineTo(x(0),bottom); ctx.closePath(); const fill=ctx.createLinearGradient(0,top,0,bottom); fill.addColorStop(0,color+'30'); fill.addColorStop(1,color+'00'); ctx.fillStyle=fill; ctx.fill(); }
            rows.forEach((row,i) => { ctx.beginPath(); ctx.arc(x(i),y(row[key]),i===activeDay?4:2.4,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); });
        }
    }
    function renderTrend(rows, animate = true) {
        const days = el('monitorChartDays'); days.replaceChildren();
        let hasCanvas = false; try { hasCanvas = Boolean(el('monitorTrend').getContext('2d')); } catch (_) { /* Date controls remain available. */ }
        el('monitorTrend').hidden = !rows || !hasCanvas;
        el('monitorChartFallback').hidden = !rows || hasCanvas;
        el('monitorTrend').parentElement.classList.toggle('is-unavailable', !rows || !hasCanvas);
        if (!rows) { text('monitorChartDetail', t('需要收件日志权限')); animateNumber('metricReceived', null); animateNumber('metricFailed', null); return; }
        animateNumber('metricReceived', rows.at(-1)?.received || 0); animateNumber('metricFailed', rows.at(-1)?.failed || 0);
        rows.forEach((row,index) => { const button = document.createElement('button'); button.type='button'; button.textContent=row.day.slice(5); button.setAttribute('aria-label', `${row.day} ${t('收件')} ${row.received} ${t('失败')} ${row.failed}`); button.addEventListener('click', () => selectedDay(index)); button.addEventListener('focus', () => selectedDay(index)); days.append(button); });
        if (activeDay < 0 || activeDay >= rows.length) activeDay=rows.length-1;
        selectedDay(activeDay);
        if (chartFrame !== null) cancelAnimationFrame(chartFrame);
        if (!animate || reduced.matches || document.hidden) { chartProgress=1; drawChart(1); return; }
        const start=performance.now();
        const tick=now => { const p=Math.min(1,(now-start)/700); chartProgress=1-Math.pow(1-p,3); drawChart(chartProgress); chartFrame=p<1?requestAnimationFrame(tick):null; };
        chartFrame=requestAnimationFrame(tick);
    }
    function render(data, animate = true) {
        snapshot = data;
        renderHealth(data); renderResources(data); renderPoller(data.poller); renderFailures(data.recent_failures); renderTrend(data.trend, animate);
        text('monitorUpdated', `${t('最近更新')} ${data.updated_at} · ${t('北京时间')}`);
    }
    function schedule() { clearTimeout(timer); if (!document.hidden && !suspended) timer=setTimeout(refresh,30000); }
    async function refresh() {
        if (request || document.hidden || suspended) return;
        const controller=new AbortController(); request=controller;
        const timeout=setTimeout(() => controller.abort(),15000);
        el('monitorRefresh').disabled=true; el('monitorRefresh').classList.add('is-loading');
        try {
            const response=await fetch('/admin/api/dashboard',{signal:controller.signal,cache:'no-store'});
            if (!response.ok) throw new Error(response.status===401?t('会话已过期，请重新登录'):t('监测数据暂时不可用，请稍后重试'));
            const data=await response.json(); if (!data.success) throw new Error(t(data.message || '监测数据暂时不可用，请稍后重试'));
            const changed=JSON.stringify(snapshot?.trend)!==JSON.stringify(data.trend);
            render(data,changed); el('monitorError').hidden=true; el('monitorSyncDot').dataset.state='ready';
        } catch (error) {
            if (suspended || document.hidden) return;
            text('monitorError', `${t('更新失败')} · ${error.name==='AbortError'?t('请求超时'):error.message}${snapshot?' · '+t('保留上次数据'):''}`);
            el('monitorError').hidden=false; el('monitorSyncDot').dataset.state='error';
        } finally { clearTimeout(timeout); if(request===controller)request=null; el('monitorRefresh').disabled=false; el('monitorRefresh').classList.remove('is-loading'); schedule(); }
    }
    function init() {
        if(initialized || !el('monitorScene'))return; initialized=true;
        scene=window.AdminMotion?.mountScene(el('monitorScene'));
        el('monitorRefresh').addEventListener('click',refresh);
        chartObserver=new ResizeObserver(()=>drawChart(chartProgress)); chartObserver.observe(el('monitorTrend'));
        el('monitorTrend').addEventListener('pointermove',event=>{if(!snapshot?.trend)return;const rect=el('monitorTrend').getBoundingClientRect();selectedDay(Math.max(0,Math.min(6,Math.round((event.clientX-rect.left-38)/(rect.width-52)*6))));});
        document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.hidden){request?.abort();settleAnimations();}else refresh();});
        window.addEventListener('pagehide',()=>{suspended=true;clearTimeout(timer);request?.abort();settleAnimations();});
        window.addEventListener('pageshow',()=>{suspended=false;refresh();});
        reduced.addEventListener('change',()=>{settleAnimations();drawChart(1);});
        window.addEventListener('app-language-change',()=>{if(snapshot)render(snapshot,false);});
        window.addEventListener('app-color-theme-change',()=>{if(snapshot)render(snapshot,false);});
        refresh();
    }
    window.MailDashboard={init,refresh,goMailbox,get scene(){return scene;}};
})();
