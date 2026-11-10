export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── Proxy Endpoint: Unblocks CSP & X-Frame-Options for Collaborative Browsing ──
    if (url.pathname === '/api/proxy') {
      const targetParam = url.searchParams.get('url');
      if (!targetParam) {
        return new Response('Missing "url" query parameter', {
          status: 400,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      try {
        let targetUrl = targetParam.trim();
        if (!/^https?:\/\//i.test(targetUrl)) {
          targetUrl = 'https://' + targetUrl;
        }

        const parsedTarget = new URL(targetUrl);

        // Fetch target website
        const upstreamResponse = await fetch(targetUrl, {
          method: request.method === 'POST' ? 'POST' : 'GET',
          body: request.method === 'POST' ? request.body : undefined,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': parsedTarget.origin + '/'
          },
          redirect: 'follow'
        });

        // Clone headers and remove frame-blocking restrictions
        const newHeaders = new Headers(upstreamResponse.headers);
        newHeaders.delete('x-frame-options');
        newHeaders.delete('content-security-policy');
        newHeaders.delete('content-security-policy-report-only');
        newHeaders.delete('cross-origin-opener-policy');
        newHeaders.delete('cross-origin-embedder-policy');
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', '*');

        const contentType = (upstreamResponse.headers.get('content-type') || '').toLowerCase();

        // If upstream or Cloudflare DNS returned 530 / 5xx, redirect directly to target to bypass 1016!
        if (upstreamResponse.status >= 500) {
          return Response.redirect(targetUrl, 302);
        }

        // For HTML pages: Inject <base href="..."> so images, scripts, and stylesheets load
        if (contentType.includes('text/html')) {
          let html = await upstreamResponse.text();

          // Base URL for relative assets
          const baseHref = parsedTarget.origin + (parsedTarget.pathname.endsWith('/') ? parsedTarget.pathname : parsedTarget.pathname.substring(0, parsedTarget.pathname.lastIndexOf('/') + 1));
          const baseTag = `<base href="${baseHref}">`;

          if (/<head[^>]*>/i.test(html)) {
            html = html.replace(/(<head[^>]*>)/i, `$1\n  ${baseTag}`);
          } else {
            html = baseTag + html;
          }

          return new Response(html, {
            status: 200,
            headers: newHeaders
          });
        }

        // For non-HTML assets (CSS, JS, images, media)
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: newHeaders
        });
      } catch (err) {
        return new Response(
          `<html><body style="font-family:sans-serif;padding:2rem;background:#18192e;color:#fff;text-align:center;">
            <h2>⚠️ Unable to load website through proxy</h2>
            <p style="color:#94a3b8;">${err.message}</p>
            <p style="margin-top:1.5rem;"><a href="${targetParam}" target="_blank" rel="noopener" style="color:#8b6ded;text-decoration:none;font-weight:600;">↗️ Click here to open directly in a new tab</a></p>
          </body></html>`,
          {
            status: 502,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }
    }

    // ── Default: Fallback to Cloudflare Static Assets (chat.html, css, js, etc.) ──
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
