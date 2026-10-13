(function () {
    'use strict';

    function imageSource(image) {
        if (!image || !/^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml|x-icon)$/i.test(image.mime_type || '')) return '';
        if (typeof image.content === 'string' && /^[a-z0-9+/=\s]+$/i.test(image.content)) {
            return `data:${image.mime_type};base64,${image.content.replace(/\s/g, '')}`;
        }
        return /^https?:\/\//i.test(image.url || '') ? image.url : '';
    }

    function contentId(value) {
        try { return decodeURIComponent(String(value || '').replace(/^cid:/i, '')).trim().replace(/^<|>$/g, ''); }
        catch (_) { return ''; }
    }

    // This is the only script allowed inside an auto-sized, opaque-origin mail frame.
    function measureContent(id) {
        let pending = false;
        let previous = 0;
        function schedule() {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                const height = Math.ceil(Math.max(document.body.scrollHeight, document.body.offsetHeight));
                if (height !== previous) {
                    previous = height;
                    parent.postMessage({ type: 'mail-content-height', id, height }, '*');
                }
            });
        }
        new ResizeObserver(schedule).observe(document.body);
        document.addEventListener('load', schedule, true);
        document.addEventListener('error', schedule, true);
        window.addEventListener('resize', schedule);
        document.fonts?.ready.then(schedule);
        schedule();
    }

    function createDocument(html, { nonce, images, renderedInlineImages }) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');

        // Mail is a separate, untrusted document. Keep its presentation, not its code.
        doc.querySelectorAll('script, iframe, object, embed, form, base, meta[http-equiv], meta[name="viewport" i]').forEach(node => node.remove());
        doc.querySelectorAll('*').forEach(node => {
            Array.from(node.attributes).forEach(attribute => {
                if (/^on/i.test(attribute.name) || attribute.name === 'nonce') node.removeAttribute(attribute.name);
            });
        });

        const inlineImages = new Map();
        images.forEach(image => {
            const id = contentId(image?.content_id || image?.contentId || image?.cid);
            const source = imageSource(image);
            if (id && source) inlineImages.set(id, { image, source });
        });
        function resolveImage(url) {
            if (!/^cid:/i.test(url)) return url;
            const match = inlineImages.get(contentId(url));
            if (!match) return '';
            renderedInlineImages.add(match.image);
            return match.source;
        }
        const resolveCssImages = value => value.replace(/url\(\s*(['"]?)(cid:[^)'"\s]+)\1\s*\)/gi,
            (_, quote, url) => `url("${resolveImage(url).replace(/["\\\n\r]/g, '')}")`);
        doc.querySelectorAll('img').forEach(img => {
            if (img.hasAttribute('src')) img.setAttribute('src', resolveImage(img.getAttribute('src')));
            // CID sources in srcset otherwise override the resolved src.
            if (/cid:/i.test(img.getAttribute('srcset') || '')) img.removeAttribute('srcset');
            img.loading = 'eager';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
        });
        doc.querySelectorAll('[background]').forEach(node => node.setAttribute('background', resolveImage(node.getAttribute('background'))));
        doc.querySelectorAll('[style]').forEach(node => node.setAttribute('style', resolveCssImages(node.getAttribute('style'))));
        doc.querySelectorAll('style').forEach(node => { node.textContent = resolveCssImages(node.textContent); });
        doc.querySelectorAll('a, area').forEach(link => {
            const href = (link.getAttribute('href') || '').replace(/[\s\u0000-\u001f]+/g, '');
            if (href && !/^(https?:|mailto:|tel:|#)/i.test(href)) link.removeAttribute('href');
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

        const policy = doc.createElement('meta');
        policy.httpEquiv = 'Content-Security-Policy';
        policy.content = `default-src 'none'; script-src ${nonce ? `'nonce-${nonce}'` : "'none'"}; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; font-src https: http: data:; base-uri 'none'; form-action 'none'`;
        doc.head.prepend(policy);

        const viewport = doc.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1';
        doc.head.appendChild(viewport);

        const style = doc.createElement('style');
        style.textContent = `
            :root { color-scheme: light; }
            html, body {
                box-sizing: border-box !important;
                width: 100% !important;
                min-width: 0 !important;
                max-width: 100% !important;
                margin: 0 !important;
                overflow-wrap: anywhere;
            }
            html { padding: 0 !important; overflow-x: auto; }
            body { padding: 12px !important; }
            img, video, svg, canvas { max-width: 100% !important; height: auto !important; }
            table, td, th, div {
                min-width: 0 !important;
                max-width: 100%;
                overflow-wrap: anywhere;
            }
            /* Preserve authored table/button widths; only constrain oversized content. */
            table { box-sizing: border-box; }
            body > table { table-layout: fixed; }
            pre { white-space: pre-wrap; overflow-wrap: anywhere; }
            @media (max-width: 560px) { body { padding: 8px !important; } }
        `;
        doc.head.appendChild(style);
        if (nonce) {
            // Mail-authored viewport heights must not create a resize feedback loop.
            for (const node of [doc.documentElement, doc.body]) {
                for (const [name, value] of Object.entries({ height: 'auto', 'min-height': '0', 'max-height': 'none', 'overflow-y': 'visible' })) {
                    node.style.setProperty(name, value, 'important');
                }
            }
            doc.body.style.setProperty('display', 'flow-root', 'important');
            const bridge = doc.createElement('script');
            bridge.setAttribute('nonce', nonce);
            bridge.textContent = `(${measureContent.toString()})(${JSON.stringify(nonce)});`;
            doc.body.appendChild(bridge);
        }
        return `<!doctype html>${doc.documentElement.outerHTML}`;
    }

    function createFrame(html, { title = '邮件正文', className = 'mail-content-frame', autoResize = false, images = [], attachments = [] } = {}) {
        const frame = document.createElement('iframe');
        frame.className = className;
        frame.title = title;
        frame.setAttribute('sandbox', `allow-popups allow-popups-to-escape-sandbox${autoResize ? ' allow-scripts' : ''}`);
        frame.setAttribute('referrerpolicy', 'no-referrer');
        const nonce = autoResize ? Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('') : '';
        if (nonce) frame.dataset.mailContentId = nonce;
        frame.renderedInlineImages = new Set();
        frame.srcdoc = createDocument(html, { nonce, images: [...images, ...attachments], renderedInlineImages: frame.renderedInlineImages });
        return frame;
    }

    window.addEventListener('message', event => {
        const data = event.data;
        if (data?.type !== 'mail-content-height' || !Number.isFinite(data.height) || data.height <= 0) return;
        for (const frame of document.querySelectorAll('iframe[data-mail-content-id]')) {
            if (event.source === frame.contentWindow && data.id === frame.dataset.mailContentId) {
                frame.style.height = `${Math.min(1000000, Math.max(120, Math.ceil(data.height)))}px`;
                break;
            }
        }
    });
    function createResources({ images = [], attachments = [], renderedInlineImages = new Set() } = {}) {
        const resources = document.createElement('div');
        resources.className = 'mail-resources';
        function section(label) {
            const group = document.createElement('section');
            const heading = document.createElement('h5');
            heading.textContent = window.AppI18n?.t(label) || label;
            group.appendChild(heading);
            resources.appendChild(group);
            return group;
        }
        const visibleImages = images.filter(image => !renderedInlineImages.has(image) && imageSource(image));
        if (visibleImages.length) {
            const group = section('图片');
            visibleImages.forEach(image => {
                const figure = document.createElement('figure');
                const img = document.createElement('img');
                img.src = imageSource(image);
                img.alt = image.filename || 'image';
                img.referrerPolicy = 'no-referrer';
                const caption = document.createElement('figcaption');
                caption.textContent = image.filename || '';
                caption.translate = false;
                figure.append(img, caption);
                group.appendChild(figure);
            });
        }
        if (attachments.length) {
            const group = section('附件');
            attachments.forEach(attachment => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'mail-attachment-download';
                button.textContent = `${window.AppI18n?.t('下载') || '下载'} · ${attachment.filename || 'attachment'}`;
                button.translate = false;
                const hasContent = typeof attachment.content === 'string' && /^[a-z0-9+/=\s]*$/i.test(attachment.content);
                const url = /^https?:\/\//i.test(attachment.url || '') ? attachment.url : '';
                button.disabled = !hasContent && !url;
                button.addEventListener('click', () => {
                    const link = document.createElement('a');
                    let blobUrl;
                    try {
                        if (hasContent) {
                            const bytes = Uint8Array.from(atob(attachment.content.replace(/\s/g, '')), char => char.charCodeAt(0));
                            blobUrl = URL.createObjectURL(new Blob([bytes], { type: attachment.mime_type || 'application/octet-stream' }));
                        }
                        link.href = blobUrl || url;
                        link.download = attachment.filename || 'attachment';
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        document.body.appendChild(link);
                        link.click();
                    } finally {
                        link.remove();
                        if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                    }
                });
                group.appendChild(button);
            });
        }
        return resources;
    }

    window.MailContent = { createFrame, imageSource, createResources };
})();
