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
function isoDate(ts) {
  try { return new Date(ts).toISOString().slice(0, 10); } catch (e) { return new Date().toISOString().slice(0, 10); }
}

async function handleSitemap() {
  const posts = await loadPosts();
  const urls = [
    { loc: 'https://tiendapoke.com/', lastmod: new Date().toISOString().slice(0, 10), priority: '1.0' },
    { loc: 'https://tiendapoke.com/blog.html', lastmod: new Date().toISOString().slice(0, 10), priority: '0.8' },
    ...posts.map(p => ({
      loc: 'https://tiendapoke.com/blog.html?post=' + encodeURIComponent(p.id),
      lastmod: isoDate(p.createdAt),
      priority: '0.6'
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/sitemap.xml') return handleSitemap();
    if (url.pathname === '/blog.html') return handleBlogHtml(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
