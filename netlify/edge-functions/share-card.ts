// Link previews (X, Telegram, WhatsApp, Discord…): crawlers don't run JavaScript, so this edge function
// puts each collection's title, stats and card image into the HTML of /collection, /launchpad and /item pages.
import type { Context } from 'https://edge.netlify.com';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export default async (request: Request, context: Context) => {
  const res = await context.next();
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/(?:collection|launchpad|item)\/([a-z0-9-]{1,80}|0x[0-9a-fA-F]{40})(?:\/(\d{1,80}))?\/?$/);
  const api = (Netlify.env.get('VITE_API_URL') || '').replace(/\/$/, '');
  if (!m || !api || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  try {
    const r = await fetch(`${api}/api/share/collection/${m[1]}`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return res;
    const meta = (await r.json()) as { title: string; description: string; image: string };
    const title = m[2] ? `#${m[2].length > 12 ? `${m[2].slice(0, 4)}…${m[2].slice(-4)}` : m[2]} · ${meta.title}` : meta.title;
    const tags = [
      `<meta name="description" content="${esc(meta.description)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="STABLE" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
      `<meta property="og:url" content="${esc(url.origin + url.pathname)}" />`,
      `<meta property="og:image" content="${esc(meta.image)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      `<meta name="twitter:description" content="${esc(meta.description)}" />`,
      `<meta name="twitter:image" content="${esc(meta.image)}" />`,
    ].join('\n    ');
    let html = await res.text();
    html = html.replace(/\s*<meta (?:property="og:[^"]+"|name="twitter:[^"]+"|name="description")[^>]*>/g, '');
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`).replace('</head>', `    ${tags}\n  </head>`);
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
    return new Response(html, { status: res.status, headers });
  } catch {
    return res;
  }
};

export const config = { path: ['/collection/*', '/launchpad/*', '/item/*'] };
