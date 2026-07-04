export async function onRequest(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    let cleanUrl = targetUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const headers = new Headers();
    // Copy select request headers to sound like a normal browser
    const userAgent = request.headers.get('user-agent');
    if (userAgent) {
      headers.set('User-Agent', userAgent);
    }
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');

    const res = await fetch(cleanUrl, {
      headers,
      redirect: 'follow'
    });

    const contentType = res.headers.get('content-type') || '';
    
    // Only inject base tag and script into HTML content
    if (contentType.includes('text/html')) {
      let html = await res.text();
      const baseTag = `<base href="${cleanUrl}">`;
      const injectScript = `
<script>
  (function() {
    // Intercept link clicks in iframe
    document.addEventListener('click', function(e) {
      var a = e.target.closest('a');
      if (a && a.href) {
        var href = a.href.trim();
        if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(a.href);
      }
    }, true);

    // Intercept form submissions in iframe
    document.addEventListener('submit', function(e) {
      var form = e.target;
      var method = (form.method || 'get').toLowerCase();
      if (method === 'get' && form.action) {
        e.preventDefault();
        e.stopPropagation();
        var url = new URL(form.action);
        var formData = new FormData(form);
        for (var pair of formData.entries()) {
          url.searchParams.set(pair[0], pair[1]);
        }
        window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(url.toString());
      }
    }, true);
  })();
</script>
`;
      // Inject base tag and script at the beginning of head
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}${injectScript}`);
      } else if (html.includes('<HEAD>')) {
        html = html.replace('<HEAD>', `<HEAD>${baseTag}${injectScript}`);
      } else {
        html = baseTag + injectScript + html;
      }

      // Create new mutable response
      const newRes = new Response(html, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers)
      });

      // Strip security headers
      newRes.headers.delete('x-frame-options');
      newRes.headers.delete('content-security-policy');
      newRes.headers.delete('frame-options');
      newRes.headers.delete('csp');
      // Ensure cross-origin sharing is allowed
      newRes.headers.set('Access-Control-Allow-Origin', '*');
      newRes.headers.set('Content-Type', 'text/html; charset=utf-8');

      return newRes;
    } else {
      // Non-HTML content (images, JS, etc.)
      const newRes = new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers)
      });
      newRes.headers.delete('x-frame-options');
      newRes.headers.delete('content-security-policy');
      newRes.headers.delete('frame-options');
      newRes.headers.delete('csp');
      newRes.headers.set('Access-Control-Allow-Origin', '*');
      return newRes;
    }
  } catch (err) {
    return new Response('Proxy Error: ' + err.message, { status: 500 });
  }
}
