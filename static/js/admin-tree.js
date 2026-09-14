(function (global) {
    'use strict';
    const WIDTH = 248, HEIGHT = 124, GAP = 32, ROW = 180;
    const LEVELS = { 1: '一级管理员', 2: '二级管理员', 3: '三级管理员' };
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    // Rank by administrator level, including level 3 accounts created directly by level 1.
    function layout(accounts, collapsed = new Set()) {
        const all = new Map(accounts.map(account => [String(account.id), { ...account, children: [] }]));
        const roots = [];
        all.forEach(node => {
            const parent = all.get(String(node.parent_admin_id));
            if (parent && parent.admin_level < node.admin_level) parent.children.push(node);
            else roots.push(node);
        });
        const sort = nodes => nodes.sort((a, b) => a.admin_level - b.admin_level || Number(a.id) - Number(b.id));
        const measure = node => {
            sort(node.children);
            node.shownChildren = collapsed.has(String(node.id)) ? [] : node.children;
            node.width = Math.max(WIDTH, node.shownChildren.reduce((sum, child) => sum + measure(child) + GAP, -GAP));
            return node.width;
        };
        sort(roots).forEach(measure);
        const nodes = [], edges = [];
        const firstLevel = Math.min(...roots.map(node => node.admin_level));
        const place = (node, left) => {
            node.x = left + (node.width - WIDTH) / 2;
            node.y = (node.admin_level - firstLevel) * ROW;
            nodes.push(node);
            let next = left;
            node.shownChildren.forEach(child => {
                place(child, next);
                edges.push({ parent: node, child });
                next += child.width + GAP;
            });
        };
        let left = 0;
        roots.forEach(node => { place(node, left); left += node.width + GAP; });
        return { nodes, edges, width: Math.max(0, left - GAP), height: Math.max(0, ...nodes.map(node => node.y + HEIGHT)) };
    }

    function create(host, actions = {}) {
        const t = text => global.AppI18n?.t(text) || text;
        const el = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text !== undefined) node.textContent = text;
            return node;
        };
        const button = (label, callback, className = '') => {
            const node = el('button', className, label);
            node.type = 'button'; node.addEventListener('click', callback);
            return node;
        };
        host.classList.add('admin-hierarchy');
        host.setAttribute('data-i18n-ignore', '');
        host.replaceChildren();
        const toolbar = el('div', 'admin-tree-toolbar');
        const heading = el('div', 'admin-tree-heading');
        const title = el('h3');
        const count = el('span', 'admin-tree-count');
        heading.append(title, count);
        const controls = el('div', 'admin-tree-controls');
        const zoomOut = button('−', () => zoom(.8, true));
        const zoomValue = el('output', 'admin-tree-zoom');
        const zoomIn = button('+', () => zoom(1.25, true));
        const fitButton = button('', () => fit(true, true));
        controls.append(zoomOut, zoomValue, zoomIn, fitButton);
        toolbar.append(heading, controls);
        const legend = el('div', 'admin-tree-legend');
        const viewport = el('div', 'admin-tree-viewport');
        viewport.tabIndex = 0; viewport.setAttribute('role', 'region');
        const scene = el('div', 'admin-tree-scene');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('admin-tree-edges');
        const nodeLayer = el('div', 'admin-tree-nodes');
        nodeLayer.setAttribute('role', 'list');
        const empty = el('div', 'admin-tree-empty');
        scene.append(svg, nodeLayer); viewport.append(scene, empty);
        const hint = el('p', 'admin-tree-hint');
        const details = el('div', 'admin-tree-details');
        const live = el('p', 'admin-tree-sr'); live.setAttribute('role', 'status');
        host.append(toolbar, legend, viewport, hint, details, live);
        let accounts = [], currentId = '', selectedId = '', initialized = false;
        let graph = layout([]), scale = 1, x = 0, y = 0, autoFit = true, overview = false, frame = 0;
        let knownIds = new Set();
        const collapsed = new Set(), cards = new Map(), paths = new Map();
        const reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
        function transform(animate = false) {
            scene.classList.toggle('is-animating', animate && !reducedMotion.matches);
            scene.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
            zoomValue.textContent = `${Math.round(scale * 100)}%`;
            zoomOut.disabled = scale <= .15; zoomIn.disabled = scale >= 2;
        }
        function fit(animate = false, all = overview) {
            autoFit = true;
            overview = all;
            const w = viewport.clientWidth, h = viewport.clientHeight;
            if (!w || !h || !graph.nodes.length) return;
            // Keep labels readable on small screens; the explicit fit button shows the entire tree.
            scale = clamp(Math.min((w - 64) / graph.width, (h - 64) / graph.height, 1), all ? .15 : .65, 1);
            x = (w - graph.width * scale) / 2; y = (h - graph.height * scale) / 2;
            const selected = graph.nodes.find(node => String(node.id) === selectedId);
            if (!all && selected && graph.width * scale > w - 64) {
                x = clamp(w / 2 - (selected.x + WIDTH / 2) * scale, w - graph.width * scale - 32, 32);
            }
            transform(animate);
        }
        function zoom(factor, animate = false, px = viewport.clientWidth / 2, py = viewport.clientHeight / 2) {
            autoFit = false;
            const next = clamp(scale * factor, .15, 2), ratio = next / scale;
            x = px - (px - x) * ratio; y = py - (py - y) * ratio; scale = next;
            transform(animate);
        }
        function center(id, animate = true) {
            const node = graph.nodes.find(item => String(item.id) === id);
            if (!node || !viewport.clientWidth) return;
            autoFit = false;
            scale = Math.max(scale, .7);
            x = viewport.clientWidth / 2 - (node.x + WIDTH / 2) * scale;
            y = viewport.clientHeight / 2 - (node.y + HEIGHT / 2) * scale;
            transform(animate);
        }
        function select(id) {
            selectedId = id; updateSelection(); renderDetails();
        }
        function reveal(id) {
            const seen = new Set();
            let node = accounts.find(item => String(item.id) === id);
            while (node && !seen.has(String(node.id))) {
                seen.add(String(node.id)); collapsed.delete(String(node.id));
                node = accounts.find(item => String(item.id) === String(node.parent_admin_id));
            }
        }
        function updateSelection() {
            const lineage = new Set(); let node = accounts.find(item => String(item.id) === selectedId);
            while (node && !lineage.has(String(node.id))) {
                lineage.add(String(node.id)); node = accounts.find(item => String(item.id) === String(node.parent_admin_id));
            }
            cards.forEach((card, id) => {
                card.classList.toggle('is-selected', id === selectedId);
                card.querySelector('.admin-tree-node-main').setAttribute('aria-pressed', String(id === selectedId));
            });
            paths.forEach((path, id) => path.classList.toggle('is-selected', lineage.has(id)));
        }
        function renderDetails() {
            details.replaceChildren();
            const account = accounts.find(item => String(item.id) === selectedId);
            details.hidden = !account;
            if (!account) return;
            const identity = el('div', 'admin-tree-identity');
            identity.append(el('strong', '', account.username), el('span', '', t(LEVELS[account.admin_level])));
            const metadata = el('dl', 'admin-tree-metadata');
            const field = (label, value) => {
                const pair = el('div'); pair.append(el('dt', '', t(label)), el('dd', '', value)); metadata.append(pair);
            };
            field('ID', String(account.id));
            const parent = accounts.find(item => String(item.id) === String(account.parent_admin_id));
            field('归属上级', parent?.username || account.parent_username || '—');
            if (!account.context_only) field('创建时间', actions.formatDate?.(account.created_at) || account.created_at || '—');
            const operations = el('div', 'admin-tree-actions');
            if (account.can_manage && !account.context_only) {
                operations.append(button(t('功能授权'), () => actions.permissions?.(account), 'btn btn-primary btn-small'));
                operations.append(button(t('重置密码'), () => actions.reset?.(account), 'btn btn-small'));
                if (!account.has_children) operations.append(button(t('删除'), () => actions.remove?.(account), 'btn btn-small admin-tree-delete'));
            } else {
                operations.append(el('span', 'admin-tree-readonly', t(account.context_only ? '仅展示上级关系' : String(account.id) === currentId ? '当前账号' : account.is_builtin_admin ? '内置管理员' : '不可管理')));
            }
            details.append(identity, metadata, operations);
        }
        function render(newIds = new Set()) {
            graph = layout(accounts, collapsed);
            const visible = new Set(graph.nodes.map(node => String(node.id)));
            cards.forEach((card, id) => { if (!visible.has(id)) { card.remove(); cards.delete(id); } });
            const edgeIds = new Set(graph.edges.map(edge => String(edge.child.id)));
            paths.forEach((path, id) => { if (!edgeIds.has(id)) { path.remove(); paths.delete(id); } });
            scene.style.width = `${graph.width}px`; scene.style.height = `${graph.height}px`;
            svg.setAttribute('width', graph.width); svg.setAttribute('height', graph.height);
            graph.edges.forEach(({ parent, child }) => {
                const id = String(child.id);
                let path = paths.get(id);
                if (!path) { path = document.createElementNS(svg.namespaceURI, 'path'); svg.append(path); paths.set(id, path); }
                const sx = parent.x + WIDTH / 2, sy = parent.y + HEIGHT, tx = child.x + WIDTH / 2, ty = child.y;
                const bend = sy + (ROW - HEIGHT) / 2;
                const d = `M ${sx} ${sy} C ${sx} ${bend}, ${tx} ${bend}, ${tx} ${ty}`;
                path.setAttribute('d', d); path.style.d = `path("${d}")`;
                path.dataset.parentId = String(parent.id); path.dataset.childId = id;
            });
            graph.nodes.forEach(node => {
                const id = String(node.id);
                let card = cards.get(id);
                if (!card) {
                    card = el('div', 'admin-tree-node'); card.setAttribute('role', 'listitem'); card.dataset.adminId = id;
                    const main = button('', () => select(id), 'admin-tree-node-main');
                    main.addEventListener('focus', () => {
                        const bounds = card.getBoundingClientRect(), view = viewport.getBoundingClientRect();
                        if (bounds.left < view.left || bounds.right > view.right || bounds.top < view.top || bounds.bottom > view.bottom) center(id);
                    });
                    card.append(main, el('div', 'admin-tree-node-footer'));
                    nodeLayer.append(card); cards.set(id, card);
                    if (newIds.has(id)) card.classList.add('is-new');
                }
                card.dataset.level = String(node.admin_level);
                card.classList.toggle('is-context', Boolean(node.context_only));
                card.style.left = `${node.x}px`; card.style.top = `${node.y}px`;
                const main = card.firstElementChild;
                const badge = el('span', 'admin-tree-rank', `L${node.admin_level}`);
                const text = el('span', 'admin-tree-node-text');
                const name = el('strong', '', node.username); name.title = node.username;
                text.append(name, el('span', 'admin-tree-level', t(LEVELS[node.admin_level])));
                main.replaceChildren(badge, text);
                main.setAttribute('aria-label', `${node.username} · ${t(LEVELS[node.admin_level])}`);
                const footer = card.lastElementChild;
                const status = id === currentId ? '当前账号' : node.context_only ? '归属上级' : node.is_builtin_admin ? '内置管理员' : '子级管理员';
                footer.replaceChildren(el('span', 'admin-tree-node-status', t(status)));
                if (node.children.length) {
                    const isCollapsed = collapsed.has(id);
                    const toggle = button(`${isCollapsed ? '+' : '−'} ${node.children.length}`, () => {
                        if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
                        render(); fit(true);
                        if (!cards.has(selectedId)) select(id);
                        cards.get(id)?.querySelector('.admin-tree-toggle')?.focus({ preventScroll: true });
                    }, 'admin-tree-toggle');
                    toggle.setAttribute('aria-expanded', String(!isCollapsed));
                    toggle.setAttribute('aria-label', `${t(isCollapsed ? '展开下级' : '收起下级')} · ${node.username} (${node.children.length})`);
                    footer.append(toggle);
                }
            });
            title.textContent = t('管理员层级树');
            count.textContent = `${accounts.filter(node => !node.context_only).length} ${t('个可见账号')}`;
            legend.replaceChildren(...[1, 2, 3].map(level => {
                const item = el('span', '', t(LEVELS[level])); item.dataset.level = String(level); return item;
            }));
            zoomOut.title = t('缩小'); zoomOut.setAttribute('aria-label', t('缩小'));
            zoomIn.title = t('放大'); zoomIn.setAttribute('aria-label', t('放大'));
            fitButton.textContent = t('适应画布');
            viewport.setAttribute('aria-label', t('管理员层级树'));
            hint.textContent = t('拖动画布 · 双指或 Ctrl + 滚轮缩放 · 点击节点查看详情');
            empty.textContent = t('暂无管理员'); empty.hidden = accounts.length > 0;
            updateSelection(); renderDetails();
        }
        function setData(users, ancestors, actorId, options = {}) {
            const ids = new Set(users.map(node => String(node.id)));
            accounts = [...ancestors.filter(node => !ids.has(String(node.id))).map(node => ({ ...node, context_only: true, can_manage: false })), ...users];
            currentId = String(actorId);
            const nextIds = new Set(accounts.map(node => String(node.id)));
            const newIds = initialized ? new Set([...ids].filter(id => !knownIds.has(id))) : new Set();
            const focusId = options.focusId ? String(options.focusId) : [...newIds][0];
            if (focusId && nextIds.has(focusId)) { selectedId = focusId; reveal(focusId); }
            if (!nextIds.has(selectedId)) selectedId = nextIds.has(currentId) ? currentId : String(accounts[0]?.id || '');
            const changed = knownIds.size !== nextIds.size || [...nextIds].some(id => !knownIds.has(id));
            knownIds = nextIds; initialized = true;
            render(newIds);
            if (changed) fit(true);
            if (focusId) {
                center(focusId);
                live.textContent = `${t('已更新层级树')} · ${accounts.find(node => String(node.id) === focusId)?.username || ''}`;
            }
        }
        // Capture only a real drag, so clicking a node keeps native button/keyboard behavior.
        const pointers = new Map(); let drag = null, suppressClick = false;
        viewport.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.size === 1) { drag = { x: event.clientX, y: event.clientY, moved: false }; suppressClick = false; }
            if (pointers.size === 2) suppressClick = true;
        });
        viewport.addEventListener('pointermove', event => {
            const previous = pointers.get(event.pointerId);
            if (!previous || !drag) return;
            const before = [...pointers.values()];
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (!drag.moved && pointers.size === 1 && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
            drag.moved = true; suppressClick = true; autoFit = false;
            viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging');
            if (pointers.size === 2) {
                const after = [...pointers.values()];
                const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
                const rect = viewport.getBoundingClientRect();
                const cx = (before[0].x + before[1].x) / 2, cy = (before[0].y + before[1].y) / 2;
                zoom(distance(after) / Math.max(1, distance(before)), false, cx - rect.left, cy - rect.top);
                x += (after[0].x + after[1].x) / 2 - cx; y += (after[0].y + after[1].y) / 2 - cy;
            } else { x += event.clientX - previous.x; y += event.clientY - previous.y; }
            transform();
        });
        const release = event => {
            pointers.delete(event.pointerId);
            if (!pointers.size) { drag = null; viewport.classList.remove('is-dragging'); }
            if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
        };
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => viewport.addEventListener(type, release));
        viewport.addEventListener('pointerleave', event => { if (!viewport.hasPointerCapture(event.pointerId)) release(event); });
        viewport.addEventListener('click', event => {
            if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
        }, true);
        viewport.addEventListener('wheel', event => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            const rect = viewport.getBoundingClientRect();
            zoom(Math.exp(-clamp(event.deltaY, -100, 100) * .005), false, event.clientX - rect.left, event.clientY - rect.top);
        }, { passive: false });
        viewport.addEventListener('keydown', event => {
            if (event.target !== viewport) return;
            if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
            if (event.key === '+' || event.key === '=') zoom(1.25, true);
            else if (event.key === '-') zoom(.8, true);
            else if (event.key === '0') fit(true);
            else if (event.key.startsWith('Arrow')) {
                autoFit = false;
                x += event.key === 'ArrowLeft' ? 48 : event.key === 'ArrowRight' ? -48 : 0;
                y += event.key === 'ArrowUp' ? 48 : event.key === 'ArrowDown' ? -48 : 0;
                transform();
            }
        });
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => { if (autoFit) fit(); else center(selectedId, false); });
        });
        observer.observe(viewport);
        const languageChange = () => render();
        global.addEventListener('app-language-change', languageChange);
        render();
        return { setData, fit, destroy() {
            observer.disconnect(); cancelAnimationFrame(frame);
            global.removeEventListener('app-language-change', languageChange); host.replaceChildren();
        } };
    }
    global.AdminHierarchy = { create, layout };
    if (typeof module !== 'undefined') module.exports = { layout };
})(typeof window === 'undefined' ? globalThis : window);
