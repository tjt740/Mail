(function () {
    'use strict';

    function createDocument(html) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');

        // Mail is a separate, untrusted document. Keep its presentation, not its code.
        doc.querySelectorAll('script, iframe, object, embed, form, base, meta[http-equiv], meta[name="viewport" i]').forEach(node => node.remove());
        doc.querySelectorAll('*').forEach(node => {
            Array.from(node.attributes).forEach(attribute => {
                if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
            });
        });
        doc.querySelectorAll('a, area').forEach(link => {
            const href = (link.getAttribute('href') || '').replace(/[\s\u0000-\u001f]+/g, '');
            if (href && !/^(https?:|mailto:|tel:|#)/i.test(href)) link.removeAttribute('href');
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

        const policy = doc.createElement('meta');
        policy.httpEquiv = 'Content-Security-Policy';
        policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; font-src https: http: data:; base-uri 'none'; form-action 'none'";
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
                max-width: 100% !important;
                overflow-wrap: anywhere;
            }
            /* Preserve authored table/button widths; only constrain oversized content. */
            table { box-sizing: border-box; }
            body > table { table-layout: fixed; }
            pre { white-space: pre-wrap; overflow-wrap: anywhere; }
            @media (max-width: 560px) { body { padding: 8px !important; } }
        `;
        doc.head.appendChild(style);
        return `<!doctype html>${doc.documentElement.outerHTML}`;
    }

    function createFrame(html, { title = '邮件正文', className = 'mail-content-frame' } = {}) {
        const frame = document.createElement('iframe');
        frame.className = className;
        frame.title = title;
        frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        frame.srcdoc = createDocument(html);
        return frame;
    }

    window.MailContent = { createFrame };
})();
