// Worker de tiendapoke.com: sirve los archivos estáticos tal cual, pero
// intercepta /blog.html (para bots/IAs) y /sitemap.xml para renderizarlos
// dinámicamente con el contenido real de las notas del blog.
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|gptbot|chatgpt-user|ccbot|claudebot|claude-web|anthropic-ai|perplexitybot|google-extended|applebot|ia_archiver|semrushbot|ahrefsbot|mj12bot|duckduckbot|yandexbot|baiduspider|bingbot|googlebot/i;
const CAT_LABEL = { guias: 'Guías', historias: 'Historias', noticias: 'Noticias' };

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(ts) {
  try { return new Date(ts).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch (e) { return ''; }
}
function fsValue(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  return null;
}
function parseFsDoc(doc) {
  const out = {};
  const fields = doc.fields || {};
  for (const k in fields) out[k] = fsValue(fields[k]);
  return out;
}
async function loadPosts() {
  try {
    const res = await fetch('https://firestore.googleapis.com/v1/projects/tiendameowth/databases/(default)/documents/blog_posts?pageSize=300');
    const data = await res.json();
    return (data.documents || []).map(parseFsDoc);
  } catch (e) { return []; }
}
async function loadProducts() {
  try {
    const base = 'https://firestore.googleapis.com/v1/projects/tiendameowth/databases/(default)/documents/catalogo';
    const metaRes = await fetch(base + '/meta');
    if (!metaRes.ok) return [];
    const meta = parseFsDoc(await metaRes.json());
    const partes = meta.partes || 0;
    const out = [];
    for (let i = 0; i < partes; i++) {
      const r = await fetch(base + '/parte_' + i);
      if (!r.ok) continue;
      const doc = await r.json();
      const fields = doc.fields || {};
      const items = fields.items && fields.items.arrayValue && fields.items.arrayValue.values || [];
      items.forEach(v => out.push(parseFsMapValue(v)));
    }
    return out;
  } catch (e) { return []; }
}
function parseFsMapValue(v) {
  if (!v || !v.mapValue) return {};
  const out = {};
  const fields = v.mapValue.fields || {};
  for (const k in fields) {
    const f = fields[k];
    if (f.arrayValue) out[k] = (f.arrayValue.values || []).map(x => parseFsMapValue(x) && Object.keys(parseFsMapValue(x)).length ? parseFsMapValue(x) : fsValue(x));
    else out[k] = fsValue(f);
  }
  return out;
}
function isoDate(ts) {
  try { return new Date(ts).toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); }
}

async function handleSitemap() {
  const posts = await loadPosts();
  const products = await loadProducts();
  const urls = [
    { loc: 'https://tiendapoke.com/', lastmod: new Date().toISOString().slice(0, 10), priority: '1.0' },
    { loc: 'https://tiendapoke.com/blog.html', lastmod: new Date().toISOString().slice(0, 10), priority: '0.8' },
    ...posts.map(p => ({
      loc: 'https://tiendapoke.com/blog.html?post=' + encodeURIComponent(p.id),
      lastmod: isoDate(p.createdAt),
      priority: '0.6'
    })),
    ...products.filter(p => p.status !== 'vendido').map(p => ({
      loc: 'https://tiendapoke.com/?producto=' + encodeURIComponent(p.id),
      lastmod: isoDate(p.createdAt || Date.now()),
      priority: '0.5'
    }))
  ];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => '  <url>\n    <loc>' + u.loc + '</loc>\n    <lastmod>' + u.lastmod + '</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>' + u.priority + '</priority>\n  </url>').join('\n')
    + '\n</urlset>\n';
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}

async function handleBlogHtml(request, env, url) {
  const assetRes = await env.ASSETS.fetch(request);
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_RE.test(ua)) return assetRes;

  const postId = url.searchParams.get('post');
  const posts = (await loadPosts()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const post = postId ? posts.find(p => p.id === postId) : null;

  let title, desc, canonical, ogType, ogImage, jsonLd, breadcrumbLd, seoHtml;
  if (post) {
    desc = post.excerpt || (post.body || '').slice(0, 155);
    title = post.title + ' · La Tienda de Meowth';
    canonical = 'https://tiendapoke.com/blog.html?post=' + encodeURIComponent(post.id);
    ogType = 'article';
    ogImage = post.image || 'https://tiendapoke.com/logo.png';
    jsonLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: post.title, description: desc,
      image: post.image ? [post.image] : undefined,
      datePublished: new Date(post.createdAt || Date.now()).toISOString(),
      dateModified: new Date(post.updatedAt || post.createdAt || Date.now()).toISOString(),
      url: canonical, mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      articleSection: CAT_LABEL[post.category] || 'Noticias',
      author: { '@type': 'Organization', name: 'La Tienda de Meowth', url: 'https://tiendapoke.com/' },
      publisher: {
        '@type': 'Organization', name: 'La Tienda de Meowth',
        logo: { '@type': 'ImageObject', url: 'https://tiendapoke.com/logo.png' }
      }
    });
    const paragraphs = (post.body || '').split(/\n+/).map(par => {
      const t = par.trim();
      if (!t) return '';
      const m = t.match(/^\{\{img:([^|}]+)(?:\|([^}]*))?\}\}$/);
      if (m) {
        const cap = (m[2] || '').trim();
        return '<figure><img src="' + esc(m[1].trim()) + '" alt="' + esc(cap || post.title || '') + '">' + (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') + '</figure>';
      }
      return '<p>' + esc(t) + '</p>';
    }).join('\n');
    breadcrumbLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://tiendapoke.com/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://tiendapoke.com/blog.html' },
        { '@type': 'ListItem', position: 3, name: post.title, item: canonical }
      ]
    });
    seoHtml = '<article>'
      + '<p><a href="/blog.html">← Todas las notas</a></p>'
      + '<p>' + esc(CAT_LABEL[post.category] || 'Noticias') + ' · ' + esc(fmtDate(post.createdAt)) + '</p>'
      + '<h1>' + esc(post.title) + '</h1>'
      + (post.image ? '<img src="' + esc(post.image) + '" alt="' + esc(post.title) + '">' : '')
      + paragraphs
      + '</article>';
  } else {
    title = 'Noticias y blog · La Tienda de Meowth';
    desc = 'Guías para coleccionistas, historias detrás de cámara y noticias de La Tienda de Meowth.';
    canonical = 'https://tiendapoke.com/blog.html';
    ogType = 'website';
    ogImage = 'https://tiendapoke.com/logo.png';
    jsonLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Blog', name: title, url: canonical,
      blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: 'https://tiendapoke.com/blog.html?post=' + encodeURIComponent(p.id) }))
    });
    breadcrumbLd = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://tiendapoke.com/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://tiendapoke.com/blog.html' }
      ]
    });
    seoHtml = '<section><h1>Noticias y blog</h1><ul>' + posts.map(p =>
      '<li><a href="/blog.html?post=' + encodeURIComponent(p.id) + '">' + esc(p.title) + '</a>'
      + '<p>' + esc(p.excerpt || '') + '</p>'
      + '<p>' + esc(CAT_LABEL[p.category] || 'Noticias') + ' · ' + esc(fmtDate(p.createdAt)) + '</p></li>'
    ).join('') + '</ul></section>';
  }

  class TextSetter { constructor(text) { this.text = text; } element(el) { el.setInnerContent(this.text); } }
  class AttrSetter { constructor(attr, val) { this.attr = attr; this.val = val; } element(el) { el.setAttribute(this.attr, this.val); } }
  class JsonLdSetter { constructor(json) { this.json = json; } element(el) { el.setInnerContent(this.json); } }
  class BodyAppender { constructor(html) { this.html = html; } element(el) { el.prepend(this.html, { html: true }); } }

  return new HTMLRewriter()
    .on('title', new TextSetter(title))
    .on('#metaDesc', new AttrSetter('content', desc))
    .on('#metaCanonical', new AttrSetter('href', canonical))
    .on('#metaOgUrl', new AttrSetter('content', canonical))
    .on('#metaOgType', new AttrSetter('content', ogType))
    .on('#metaOgTitle', new AttrSetter('content', title))
    .on('#metaOgDesc', new AttrSetter('content', desc))
    .on('#metaOgImage', new AttrSetter('content', ogImage))
    .on('#metaTwTitle', new AttrSetter('content', title))
    .on('#metaTwDesc', new AttrSetter('content', desc))
    .on('#blogJsonLd', new JsonLdSetter(jsonLd))
    .on('#blogBreadcrumbLd', new JsonLdSetter(breadcrumbLd))
    .on('body', new BodyAppender(seoHtml))
    .transform(assetRes);
}

function imgSrc(im) { return (im && typeof im === 'object') ? (im.src || '') : (im || ''); }

async function handleIndexHtml(request, env, url) {
  const assetRes = await env.ASSETS.fetch(request);
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_RE.test(ua)) return assetRes;

  const productId = url.searchParams.get('producto');
  if (!productId) return assetRes;

  const products = await loadProducts();
  const p = products.find(x => String(x.id) === productId);
  if (!p) return assetRes;

  const desc = (p.desc || ('Disponible en La Tienda de Meowth: ' + p.name + '.')).slice(0, 160);
  const title = p.name + ' · La Tienda de Meowth';
  const canonical = 'https://tiendapoke.com/?producto=' + encodeURIComponent(p.id);
  const img = (Array.isArray(p.images) && p.images.length) ? imgSrc(p.images[0]) : 'https://tiendapoke.com/logo.png';
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, description: desc, image: img, url: canonical,
    offers: {
      '@type': 'Offer', priceCurrency: 'PEN', price: p.price,
      availability: p.status === 'vendido' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock'
    }
  });
  const seoHtml = '<section>'
    + '<p><a href="/">← Todo el catálogo</a></p>'
    + '<h1>' + esc(p.name) + '</h1>'
    + (img ? '<img src="' + esc(img) + '" alt="' + esc(p.name) + '">' : '')
    + '<p>' + esc(desc) + '</p>'
    + '<p>S/ ' + esc(String(p.price)) + '</p>'
    + '</section>';

  class TextSetter { constructor(text) { this.text = text; } element(el) { el.setInnerContent(this.text); } }
  class AttrSetter { constructor(attr, val) { this.attr = attr; this.val = val; } element(el) { el.setAttribute(this.attr, this.val); } }
  class JsonLdSetter { constructor(json) { this.json = json; } element(el) { el.setInnerContent(this.json); } }
  class BodyAppender { constructor(html) { this.html = html; } element(el) { el.prepend(this.html, { html: true }); } }

  return new HTMLRewriter()
    .on('title', new TextSetter(title))
    .on('#metaDesc', new AttrSetter('content', desc))
    .on('#metaCanonical', new AttrSetter('href', canonical))
    .on('#metaOgUrl', new AttrSetter('content', canonical))
    .on('#metaOgType', new AttrSetter('content', 'product'))
    .on('#metaOgTitle', new AttrSetter('content', title))
    .on('#metaOgDesc', new AttrSetter('content', desc))
    .on('#metaOgImage', new AttrSetter('content', img))
    .on('#metaTwTitle', new AttrSetter('content', title))
    .on('#metaTwDesc', new AttrSetter('content', desc))
    .on('#productJsonLd', new JsonLdSetter(jsonLd))
    .on('body', new BodyAppender(seoHtml))
    .transform(assetRes);
}

function jsonRes(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}
function base64url(bytes) {
  let str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToBinary(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}
// Genera un access token de Google a partir de la cuenta de servicio de Firebase
// (guardada como secreto FCM_SERVICE_ACCOUNT en Cloudflare) para poder enviar
// notificaciones push y leer los tokens guardados, sin depender de las reglas públicas.
async function getGoogleAccessToken(env) {
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = base64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now
  })));
  const unsigned = header + '.' + claim;
  const key = await crypto.subtle.importKey('pkcs8', pemToBinary(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const jwt = unsigned + '.' + base64url(sig);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt)
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo autenticar con Google: ' + JSON.stringify(data));
  return data.access_token;
}
async function loadPushTokens(accessToken) {
  const res = await fetch('https://firestore.googleapis.com/v1/projects/tiendameowth/databases/(default)/documents/push_tokens?pageSize=1000', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.documents || []).map(d => d.fields && d.fields.token && d.fields.token.stringValue).filter(Boolean);
}
async function handleSendNotification(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return jsonRes({ error: 'JSON inválido' }, 400); }
  const { pin, title, message, link, onlyToken } = body || {};
  if (!title || !message) return jsonRes({ error: 'Falta título o mensaje' }, 400);
  // El mensaje de bienvenida lo dispara el propio visitante al activar, a su
  // único token nuevo — no requiere el PIN de administrador.
  if (!onlyToken) {
    const pinRes = await fetch('https://firestore.googleapis.com/v1/projects/tiendameowth/databases/(default)/documents/catalogo/admin-pin');
    const pinDoc = pinRes.ok ? await pinRes.json() : null;
    const realPin = pinDoc && pinDoc.fields && pinDoc.fields.value ? fsValue(pinDoc.fields.value) : atob('NzQ2MlRN');
    if (!pin || String(pin).toUpperCase() !== String(realPin || 'MEOWTH').toUpperCase()) return jsonRes({ error: 'PIN inválido' }, 401);
  }
  try {
    const accessToken = await getGoogleAccessToken(env);
    const tokens = onlyToken ? [onlyToken] : await loadPushTokens(accessToken);
    let sent = 0, failed = 0;
    for (const token of tokens) {
      const r = await fetch('https://fcm.googleapis.com/v1/projects/tiendameowth/messages:send', {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body: message },
            webpush: { notification: { icon: 'https://tiendapoke.com/icon-192.png' }, fcm_options: { link: link || 'https://tiendapoke.com/' } }
          }
        })
      });
      if (r.ok) sent++; else failed++;
    }
    return jsonRes({ sent, failed, total: tokens.length });
  } catch (e) {
    return jsonRes({ error: String(e.message || e) }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/sitemap.xml') return handleSitemap();
    if (url.pathname === '/blog.html') return handleBlogHtml(request, env, url);
    if (url.pathname === '/' || url.pathname === '/index.html') return handleIndexHtml(request, env, url);
    if (url.pathname === '/api/send-notification' && request.method === 'POST') return handleSendNotification(request, env);
    return env.ASSETS.fetch(request);
  }
};
