(function(){
  let posts = [];
  let isAdmin = false;
  let editingId = null;
  let pendingImage = null; // {src}

  const blogGrid = document.getElementById('blogGrid');
  const blogEmpty = document.getElementById('blogEmpty');
  const blogLoadError = document.getElementById('blogLoadError');
  const blogRetryBtn = document.getElementById('blogRetryBtn');
  const blogGridWrap = document.getElementById('blogGridWrap');
  const blogPostView = document.getElementById('blogPostView');
  const blogThemeToggle = document.getElementById('blogThemeToggle');
  const blogLogoImg = document.getElementById('blogLogoImg');
  const blogIconSunImg = document.getElementById('blogIconSunImg');
  const blogIconMoonImg = document.getElementById('blogIconMoonImg');
  const THEME_KEY = 'theme-pref';
  let siteLogos = null;
  let siteIconos = null;
  function imgSrc(im){ return (im && typeof im === 'object') ? (im.src || '') : (im || ''); }
  function applyBlogLogo(){
    const tema = document.documentElement.getAttribute('data-theme') || 'dark';
    const logos = siteLogos || {};
    const propio = tema === 'light' ? logos.claro : logos.oscuro;
    blogLogoImg.src = propio ? imgSrc(propio) : 'logo.png';
  }
  function applyBlogIconos(){
    const ic = siteIconos || {};
    const sunSvg = blogThemeToggle.querySelector('.icon-sun');
    const moonSvg = blogThemeToggle.querySelector('.icon-moon');
    if(ic.sol){ blogIconSunImg.src = imgSrc(ic.sol); blogIconSunImg.dataset.propio = '1'; if(sunSvg) sunSvg.dataset.oculto = '1'; }
    else{ blogIconSunImg.dataset.propio = ''; blogIconSunImg.hidden = true; if(sunSvg) sunSvg.dataset.oculto = ''; }
    if(ic.luna){ blogIconMoonImg.src = imgSrc(ic.luna); blogIconMoonImg.dataset.propio = '1'; if(moonSvg) moonSvg.dataset.oculto = '1'; }
    else{ blogIconMoonImg.dataset.propio = ''; blogIconMoonImg.hidden = true; if(moonSvg) moonSvg.dataset.oculto = ''; }
    applyBlogTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  }
  async function loadSiteLogos(){
    const CACHE_KEY = 'site-content-cache-v1';
    try{
      const guardado = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if(guardado && guardado.value){
        siteLogos = guardado.value.logos || null; siteIconos = guardado.value.iconos || null;
        applyBlogLogo(); applyBlogIconos();
      }
    }catch(e){}
    try{
      const res = await window.storage.get('site-content', true);
      if(res && res.value){
        const loaded = JSON.parse(res.value);
        siteLogos = loaded.logos || {};
        siteIconos = loaded.iconos || {};
        applyBlogLogo(); applyBlogIconos();
      }
    }catch(e){}
  }
  loadSiteLogos();
  function applyBlogTheme(pref){
    document.documentElement.setAttribute('data-theme', pref);
    const isDark = pref === 'dark';
    const sunSvg = blogThemeToggle.querySelector('.icon-sun');
    const moonSvg = blogThemeToggle.querySelector('.icon-moon');
    [blogIconSunImg, blogIconMoonImg, sunSvg, moonSvg].forEach(el=>{
      if(!el) return;
      el.hidden = false;
      el.classList.remove('icon-visible');
    });
    if(isDark){
      if(blogIconMoonImg.dataset.propio) blogIconMoonImg.classList.add('icon-visible');
      else moonSvg.classList.add('icon-visible');
    } else {
      if(blogIconSunImg.dataset.propio) blogIconSunImg.classList.add('icon-visible');
      else sunSvg.classList.add('icon-visible');
    }
    blogThemeToggle.title = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    applyBlogLogo();
  }
  applyBlogTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  blogThemeToggle.addEventListener('click', ()=>{
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyBlogTheme(next);
    try{ localStorage.setItem(THEME_KEY, next); }catch(e){}
  });
  window.addEventListener('storage', (e)=>{
    if(e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) applyBlogTheme(e.newValue);
  });
  const blogNewBtn = document.getElementById('blogNewBtn');
  const blogToggleGridBtn = document.getElementById('blogToggleGridBtn');
  const blogToggleGridLabel = document.getElementById('blogToggleGridLabel');
  const blogExportBtn = document.getElementById('blogExportBtn');
  const blogImportBtn = document.getElementById('blogImportBtn');
  const blogImportFile = document.getElementById('blogImportFile');
  const blogBrandLogo = document.getElementById('blogBrandLogo');
  const blogAdminExitBtn = document.getElementById('blogAdminExitBtn');

  const postOverlay = document.getElementById('postOverlay');
  const postModalTitle = document.getElementById('postModalTitle');
  const postUploadBox = document.getElementById('postUploadBox');
  const postUploadHint = document.getElementById('postUploadHint');
  const postImageInput = document.getElementById('postImageInput');
  const postImageLinkInput = document.getElementById('postImageLinkInput');
  const postImageLinkBtn = document.getElementById('postImageLinkBtn');
  const postCategorySelect = document.getElementById('postCategorySelect');
  const postTitleInput = document.getElementById('postTitleInput');
  const postExcerptInput = document.getElementById('postExcerptInput');
  const postBodyInput = document.getElementById('postBodyInput');
  const postFormError = document.getElementById('postFormError');
  const postInsertImgBtn = document.getElementById('postInsertImgBtn');
  const postBodyImageInput = document.getElementById('postBodyImageInput');
  const postBodyImgHint = document.getElementById('postBodyImgHint');
  const postCancelBtn = document.getElementById('postCancelBtn');
  const postSaveBtn = document.getElementById('postSaveBtn');
  const postNotifCheck = document.getElementById('postNotifCheck');
  const postNotifFields = document.getElementById('postNotifFields');
  const postNotifTitleInput = document.getElementById('postNotifTitleInput');
  const postNotifBodyInput = document.getElementById('postNotifBodyInput');
  const postDeleteRow = document.getElementById('postDeleteRow');
  const postDeleteBtn = document.getElementById('postDeleteBtn');

  const loginOverlay = document.getElementById('loginOverlay');
  const loginEmail = document.getElementById('loginEmail');
  const loginPass = document.getElementById('loginPass');
  const loginError = document.getElementById('loginError');
  const loginConfirm = document.getElementById('loginConfirm');
  const loginCancel = document.getElementById('loginCancel');

  let postCategory = 'guias';
  const CAT_LABEL = { guias:'Guías', historias:'Historias', noticias:'Noticias' };

  function resizeImageToBlob(file, maxDim){
    maxDim = maxDim || 1400;
    return new Promise((resolve, reject)=>{
      const img = new Image();
      const reader = new FileReader();
      reader.onload = ()=>{ img.src = reader.result; };
      reader.onerror = reject;
      img.onload = ()=>{
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          if(width > height){ height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob=> blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', 0.86);
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function fmtDate(ts){
    try{
      return new Date(ts).toLocaleDateString('es-PE', { day:'numeric', month:'long', year:'numeric' });
    }catch(e){ return ''; }
  }

  function renderSkeletons(){
    blogGrid.innerHTML = '';
    for(let i=0;i<6;i++){
      const sk = document.createElement('div');
      sk.className = 'blog-card blog-skeleton';
      sk.innerHTML = '<div class="blog-skeleton-img"></div><div class="blog-skeleton-line" style="width:70%"></div><div class="blog-skeleton-line" style="width:45%"></div>';
      blogGrid.appendChild(sk);
    }
  }

  function renderGrid(){
    blogGrid.innerHTML = '';
    const visibles = posts.slice().sort((a,b)=> b.createdAt - a.createdAt);
    blogEmpty.style.display = (visibles.length || blogLoadError.style.display === 'block') ? 'none' : 'block';
    visibles.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'blog-card';
      card.addEventListener('click', ()=> openPost(p.id));
      const img = document.createElement('div');
      img.className = 'blog-card-img';
      if(p.image) img.style.backgroundImage = 'url(' + p.image + ')';
      card.appendChild(img);
      const body = document.createElement('div');
      body.className = 'blog-card-body';
      body.innerHTML =
        '<div class="blog-card-cat">' + (CAT_LABEL[p.category] || 'Noticias') + '</div>' +
        '<div class="blog-card-title">' + escapeHtml(p.title) + '</div>' +
        '<div class="blog-card-excerpt">' + escapeHtml(p.excerpt || '') + '</div>' +
        '<div class="blog-card-date">' + fmtDate(p.createdAt) + '</div>';
      card.appendChild(body);
      if(isAdmin){
        const actions = document.createElement('div');
        actions.className = 'blog-card-admin-actions';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
        editBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openEdit(p); });
        actions.appendChild(editBtn);
        card.appendChild(actions);
      }
      blogGrid.appendChild(card);
    });
  }

  function escapeHtml(s){
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  const DEFAULT_TITLE = 'Noticias y blog · La Tienda de Meowth';
  const DEFAULT_DESC = 'Guías para coleccionistas, historias detrás de cámara y noticias de La Tienda de Meowth.';
  function setMeta(id, attr, value){
    const el = document.getElementById(id);
    if(el) el.setAttribute(attr, value);
  }
  function updateSeoForPost(p){
    const title = p ? (p.title + ' · La Tienda de Meowth') : DEFAULT_TITLE;
    const desc = p ? (p.excerpt || (p.body||'').slice(0,155)) : DEFAULT_DESC;
    const url = 'https://tiendapoke.com/blog.html' + (p ? '?post=' + encodeURIComponent(p.id) : '');
    document.title = title;
    setMeta('metaDesc','content',desc);
    setMeta('metaCanonical','href',url);
    setMeta('metaOgUrl','content',url);
    setMeta('metaOgType','content', p ? 'article' : 'website');
    setMeta('metaOgTitle','content',title);
    setMeta('metaOgDesc','content',desc);
    if(p && p.image) setMeta('metaOgImage','content',p.image);
    setMeta('metaTwTitle','content',title);
    setMeta('metaTwDesc','content',desc);
    const ld = document.getElementById('blogJsonLd');
    if(ld){
      ld.textContent = JSON.stringify(p ? {
        '@context':'https://schema.org', '@type':'BlogPosting',
        headline: p.title, description: desc,
        image: p.image ? [p.image] : undefined,
        datePublished: new Date(p.createdAt).toISOString(),
        dateModified: new Date(p.updatedAt || p.createdAt).toISOString(),
        url, mainEntityOfPage: { '@type':'WebPage', '@id': url },
        articleSection: CAT_LABEL[p.category] || 'Noticias',
        author: { '@type':'Organization', name:'La Tienda de Meowth', url:'https://tiendapoke.com/' },
        publisher: {
          '@type':'Organization', name:'La Tienda de Meowth',
          logo: { '@type':'ImageObject', url:'https://tiendapoke.com/logo.png' }
        }
      } : { '@context':'https://schema.org', '@type':'Blog', name: DEFAULT_TITLE, url:'https://tiendapoke.com/blog.html' }, null, 0);
    }
    const bc = document.getElementById('blogBreadcrumbLd');
    if(bc){
      const items = [
        { '@type':'ListItem', position:1, name:'Inicio', item:'https://tiendapoke.com/' },
        { '@type':'ListItem', position:2, name:'Blog', item:'https://tiendapoke.com/blog.html' }
      ];
      if(p) items.push({ '@type':'ListItem', position:3, name:p.title, item:url });
      bc.textContent = JSON.stringify({ '@context':'https://schema.org', '@type':'BreadcrumbList', itemListElement: items }, null, 0);
    }
  }

  function openPost(id){
    const p = posts.find(x=>x.id===id);
    if(!p) return;
    document.getElementById('blogPostCat').textContent = CAT_LABEL[p.category] || 'Noticias';
    document.getElementById('blogPostTitle').textContent = p.title;
    document.getElementById('blogPostDate').textContent = fmtDate(p.createdAt);
    const cover = document.getElementById('blogPostCover');
    cover.style.display = p.image ? 'block' : 'none';
    if(p.image) cover.style.backgroundImage = 'url(' + p.image + ')';
    const bodyEl = document.getElementById('blogPostBody');
    bodyEl.innerHTML = '';
    (p.body || '').split(/\n+/).forEach(par=>{
      const trimmed = par.trim();
      if(!trimmed) return;
      const imgMatch = trimmed.match(/^\{\{img:([^|}]+)(?:\|([^}]*))?\}\}$/);
      if(imgMatch){
        const url = imgMatch[1].trim();
        const caption = (imgMatch[2] || '').trim();
        if(caption){
          const fig = document.createElement('figure');
          const im = document.createElement('img');
          im.src = url; im.alt = caption;
          const cap = document.createElement('figcaption');
          cap.textContent = caption;
          fig.appendChild(im); fig.appendChild(cap);
          bodyEl.appendChild(fig);
        } else {
          const im = document.createElement('img');
          im.src = url; im.alt = p.title || '';
          bodyEl.appendChild(im);
        }
        return;
      }
      const pEl = document.createElement('p');
      pEl.textContent = trimmed;
      bodyEl.appendChild(pEl);
    });
    blogGridWrap.classList.add('hidden');
    blogPostView.classList.add('show');
    history.replaceState(null, '', location.pathname + '?post=' + encodeURIComponent(p.id));
    updateSeoForPost(p);
    window.scrollTo({top:0});
  }

  function closePost(){
    blogGridWrap.classList.remove('hidden');
    blogPostView.classList.remove('show');
    history.replaceState(null, '', location.pathname);
    updateSeoForPost(null);
  }
  document.getElementById('blogPostBack').addEventListener('click', closePost);

  document.getElementById('blogPostShareBtn').addEventListener('click', ()=>{
    const currentId = new URLSearchParams(location.search).get('post') || location.hash.replace('#','');
    const p = posts.find(x=>x.id === currentId);
    if(!p) return;
    const url = location.pathname + '?post=' + encodeURIComponent(p.id);
    const text = p.title + (p.excerpt ? ' — ' + p.excerpt : '');
    if(navigator.share){
      navigator.share({ title: p.title, text, url }).catch(()=>{});
      return;
    }
    const full = text + '\n' + url;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(full).then(()=> alert('Copiado ✓ ya puedes pegarlo donde quieras'));
    }
  });

  function samplePosts(){
    return [
      {
        id: 'post_sample_1',
        title: 'Cómo saber si tu figura de Pokémon Center es original',
        excerpt: 'Tres detalles rápidos que revisamos antes de aceptar cualquier pieza en la tienda.',
        category: 'guias',
        image: null,
        createdAt: Date.now() - 86400000 * 3,
        body: 'Cada figura de Pokémon Center Japón trae marcas de fábrica muy específicas: el sello en la base, el tipo de plástico y el acabado de pintura son las primeras señales de autenticidad.\n\nSi compras por fuera de una tienda especializada, pide siempre fotos de la base y compara el peso — las réplicas suelen ser más ligeras y el color menos saturado.\n\nEn La Tienda de Meowth cada pieza pasa por esta revisión antes de subirse al catálogo.'
      },
      {
        id: 'post_sample_2',
        title: 'Detrás de cámara: así llega un lote nuevo a la tienda',
        excerpt: 'Del pedido a Japón hasta que abres la caja en tu casa — todo el recorrido.',
        category: 'historias',
        image: null,
        createdAt: Date.now() - 86400000,
        body: 'Todo empieza semanas antes: reviso disponibilidad directo con Pokémon Center Japón y separo las piezas que sé que se van a agotar rápido.\n\nUna vez que llegan a Perú, cada figura se fotografía, se revisa el empaque y recién ahí sube al catálogo — por eso a veces ves productos marcados como "Preventa".\n\nGracias por acompañar el proceso, cada pedido ayuda a que sigamos trayendo más.'
      }
    ];
  }

  async function loadPosts(retriesLeft){
    if(retriesLeft === undefined) retriesLeft = 2;
    blogLoadError.style.display = 'none';
    const CACHE_KEY = 'blog-posts-cache-v1';
    const CACHE_TTL_MS = 5 * 60 * 1000;
    let mostroCache = false;
    try{
      const guardado = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if(!isAdmin && guardado && Array.isArray(guardado.posts) && guardado.posts.length){
        // Muestra la caché de inmediato aunque esté vencida (evita la pantalla vacía);
        // si está vencida, de todos modos seguimos abajo a refrescarla en silencio.
        posts = guardado.posts;
        renderGrid();
        mostroCache = true;
        const wanted = new URLSearchParams(location.search).get('post') || location.hash.replace('#','');
        if(wanted && posts.find(p=>p.id===wanted)) openPost(wanted);
        if(guardado.cachedAt && (Date.now() - guardado.cachedAt < CACHE_TTL_MS)) return;
      }
    }catch(e){ /* seguimos por el camino normal */ }
    if(!mostroCache) renderSkeletons();
    try{
      const list = await window.fbLoadBlogPosts();
      posts = Array.isArray(list) ? list : [];
      if(!posts.length) posts = samplePosts();
      else{ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ posts, cachedAt: Date.now() })); }catch(e){} }
    }catch(e){
      // Arranque en frío: a veces Firebase aún no está listo del todo justo
      // después de "firebase-ready". Reintenta un par de veces en silencio
      // antes de mostrarle al usuario un error.
      if(retriesLeft > 0){
        await new Promise(r=> setTimeout(r, 900));
        return loadPosts(retriesLeft - 1);
      }
      console.error('Error cargando el blog', e);
      posts = [];
      blogLoadError.style.display = 'block';
    }
    renderGrid();
    const wanted = new URLSearchParams(location.search).get('post') || location.hash.replace('#','');
    if(wanted && posts.find(p=>p.id===wanted)) openPost(wanted);
  }
  if(blogRetryBtn) blogRetryBtn.addEventListener('click', loadPosts);
  let notesHidden = false;
  blogToggleGridBtn.addEventListener('click', ()=>{
    notesHidden = !notesHidden;
    blogGrid.style.display = notesHidden ? 'none' : '';
    blogToggleGridLabel.textContent = notesHidden ? 'Mostrar notas' : 'Ocultar notas';
  });

  blogExportBtn.addEventListener('click', ()=>{
    const payload = {
      exportedAt: new Date().toISOString(),
      tienda: 'La Tienda de Meowth · Blog',
      posts
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blog-meowth-respaldo-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  blogImportBtn.addEventListener('click', ()=> blogImportFile.click());
  blogImportFile.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (ev)=>{
      try{
        const parsed = JSON.parse(ev.target.result);
        const list = Array.isArray(parsed) ? parsed : parsed.posts;
        if(!Array.isArray(list)) throw new Error('formato inválido');
        const ok = confirm('Esto reemplazará tus notas actuales (' + posts.length + ') por las ' + list.length + ' del archivo de respaldo. ¿Continuar?');
        if(!ok) return;
        const previousIds = posts.map(p=>p.id);
        posts = list;
        for(const id of previousIds){ if(!list.find(p=>p.id===id)){ try{ await window.fbDeleteBlogPost(id); }catch(err){} } }
        for(const p of list){ try{ await window.fbSaveBlogPost(p); }catch(err){} }
        try{ localStorage.removeItem('blog-posts-cache-v1'); }catch(err){}
        renderGrid();
      }catch(err){
        alert('Ese archivo no es un respaldo válido');
      }
    };
    reader.readAsText(file);
    blogImportFile.value = '';
  });

  // ---------- admin ----------
  function updateAdminUI(){
    blogAdminExitBtn.style.display = isAdmin ? 'inline' : 'none';
    blogNewBtn.classList.toggle('show', isAdmin);
    blogEditHeroBtn.classList.toggle('show', isAdmin);
    blogToggleGridBtn.classList.toggle('show', isAdmin);
    blogExportBtn.classList.toggle('show', isAdmin);
    blogImportBtn.classList.toggle('show', isAdmin);
    renderGrid();
  }
  let blogTapCount = 0, blogTapTimer = null;
  blogBrandLogo.addEventListener('click', (e)=>{
    if(isAdmin) return;
    blogTapCount++;
    clearTimeout(blogTapTimer);
    blogTapTimer = setTimeout(()=> blogTapCount = 0, 2000);
    if(blogTapCount < 5) return;
    blogTapCount = 0;
    clearTimeout(blogTapTimer);
    e.preventDefault();
    loginError.textContent = '';
    loginPass.value = '';
    loginOverlay.classList.add('show');
    setTimeout(()=> loginEmail.focus(), 50);
  });
  blogAdminExitBtn.addEventListener('click', ()=>{
    isAdmin = false;
    updateAdminUI();
  });
  async function intentarLogin(){
    const email = loginEmail.value.trim();
    const pass = loginPass.value;
    if(!email || !pass){ loginError.textContent = 'Escribe tu correo y contraseña.'; return; }
    loginError.textContent = 'Verificando...';
    loginConfirm.disabled = true;
    try{
      await window.fbLogin(email, pass);
      isAdmin = true;
      loginOverlay.classList.remove('show');
      loginError.textContent = '';
      updateAdminUI();
    }catch(e){
      loginError.textContent = 'No se pudo iniciar sesión. Revisa tu correo y contraseña.';
    }finally{
      loginConfirm.disabled = false;
    }
  }
  loginConfirm.addEventListener('click', intentarLogin);
  loginPass.addEventListener('keydown', e=>{ if(e.key==='Enter') intentarLogin(); });
  loginCancel.addEventListener('click', ()=> loginOverlay.classList.remove('show'));
  loginOverlay.addEventListener('click', (e)=>{ if(e.target===loginOverlay) loginOverlay.classList.remove('show'); });

  // ---------- form post ----------
  function updateUploadHint(){
    postUploadHint.textContent = pendingImage ? 'Foto lista · toca para cambiarla' : 'Toca para subir una foto';
  }
  postUploadBox.addEventListener('click', (e)=>{ if(e.target===postUploadBox || e.target===postUploadHint) postImageInput.click(); });

  postInsertImgBtn.addEventListener('click', ()=> postBodyImageInput.click());
  postBodyImageInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    postBodyImgHint.style.display = 'block';
    postBodyImgHint.style.color = '';
    postBodyImgHint.textContent = 'Subiendo imagen...';
    try{
      const blob = await resizeImageToBlob(file);
      const url = await window.fbUploadImage(blob);
      const tag = '{{img:' + url + '}}';
      const ta = postBodyInput;
      const start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
      const end = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(end);
      const sep = (before && !before.endsWith('\n\n')) ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
      const sepAfter = (after && !after.startsWith('\n\n')) ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
      ta.value = before + sep + tag + sepAfter + after;
      postBodyImgHint.textContent = 'Imagen insertada en el cuerpo.';
      setTimeout(()=>{ postBodyImgHint.style.display = 'none'; }, 2000);
    }catch(err){
      postBodyImgHint.style.color = 'var(--red-text)';
      postBodyImgHint.textContent = 'No se pudo subir la imagen, intenta de nuevo.';
    }
    postBodyImageInput.value = '';
  });
  postImageInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    postUploadHint.textContent = 'Subiendo...';
    try{
      const blob = await resizeImageToBlob(file);
      const url = await window.fbUploadImage(blob);
      pendingImage = url;
      updateUploadHint();
    }catch(err){ postUploadHint.textContent = 'No se pudo subir, intenta otra foto.'; }
    postImageInput.value = '';
  });
  postImageLinkBtn.addEventListener('click', ()=>{
    const url = postImageLinkInput.value.trim();
    if(!url) return;
    pendingImage = url;
    postImageLinkInput.value = '';
    updateUploadHint();
  });

  postCategorySelect.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      postCategory = btn.dataset.cat;
      postCategorySelect.querySelectorAll('button').forEach(b=> b.classList.toggle('sel', b===btn));
    });
  });

  function makeDirtyGuard(getSnapshotFn){
    let saved = '';
    return {
      snapshot(){ saved = JSON.stringify(getSnapshotFn()); },
      isDirty(){ return saved !== '' && saved !== JSON.stringify(getSnapshotFn()); },
      clear(){ saved = ''; }
    };
  }
  function confirmDiscard(guard, force, closeFn){
    if(!force && guard.isDirty()){
      if(!confirm('Tienes cambios sin guardar. \u00bfSalir y descartarlos?')) return;
    }
    guard.clear();
    closeFn();
  }
  const postGuard = makeDirtyGuard(()=> ({
    title: postTitleInput.value, excerpt: postExcerptInput.value, body: postBodyInput.value,
    category: postCategory, image: pendingImage
  }));

  function resetPostForm(){
    editingId = null;
    pendingImage = null;
    postTitleInput.value = '';
    postExcerptInput.value = '';
    postBodyInput.value = '';
    postCategory = 'guias';
    postCategorySelect.querySelectorAll('button').forEach(b=> b.classList.toggle('sel', b.dataset.cat==='guias'));
    updateUploadHint();
    postDeleteRow.style.display = 'none';
    postModalTitle.textContent = 'Nuevo post';
    postFormError.style.display = 'none';
    postNotifCheck.checked = false;
    postNotifFields.style.display = 'none';
  }
  function openNew(){
    resetPostForm();
    postOverlay.classList.add('show');
    setTimeout(()=>{ postTitleInput.focus(); postGuard.snapshot(); }, 50);
  }
  function openEdit(p){
    resetPostForm();
    editingId = p.id;
    pendingImage = p.image || null;
    postTitleInput.value = p.title;
    postExcerptInput.value = p.excerpt || '';
    postBodyInput.value = p.body || '';
    postCategory = p.category || 'guias';
    postCategorySelect.querySelectorAll('button').forEach(b=> b.classList.toggle('sel', b.dataset.cat===postCategory));
    updateUploadHint();
    postDeleteRow.style.display = 'block';
    postModalTitle.textContent = 'Editar post';
    postOverlay.classList.add('show');
    setTimeout(()=> postGuard.snapshot(), 50);
  }
  function closePostModal(force){
    confirmDiscard(postGuard, force, ()=> postOverlay.classList.remove('show'));
  }
  blogNewBtn.addEventListener('click', openNew);
  postCancelBtn.addEventListener('click', ()=> closePostModal());
  postOverlay.addEventListener('click', (e)=>{ if(e.target===postOverlay) closePostModal(); });
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Escape') return;
    if(postOverlay.classList.contains('show')) closePostModal();
    else if(heroOverlay.classList.contains('show')) confirmDiscard(heroGuard, false, ()=> heroOverlay.classList.remove('show'));
  });

  postNotifCheck.addEventListener('change', ()=>{
    postNotifFields.style.display = postNotifCheck.checked ? 'block' : 'none';
    if(postNotifCheck.checked){
      postNotifTitleInput.value = postTitleInput.value.trim() || 'Nueva nota en el blog';
      postNotifBodyInput.value = (postExcerptInput.value.trim() || 'Lee la nueva nota en el Pokéblog.').slice(0,140);
    }
  });
  async function getPin(){
    try{
      const res = await window.storage.get('admin-pin', true);
      return res ? res.value : atob('NzQ2MlRN');
    }catch(e){ return atob('NzQ2MlRN'); }
  }
  async function enviarNotifPost(post){
    try{
      const pin = (await getPin()).toUpperCase();
      await fetch('/api/send-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          title: postNotifTitleInput.value.trim() || post.title,
          message: postNotifBodyInput.value.trim() || post.excerpt || post.title,
          link: 'https://tiendapoke.com/blog.html?post=' + encodeURIComponent(post.id)
        })
      });
    }catch(e){ /* si falla el envío, el post ya se guardó igual */ }
  }

  postSaveBtn.addEventListener('click', async ()=>{
    const title = postTitleInput.value.trim();
    if(!title){ postFormError.textContent = 'Ponle un título al post.'; postFormError.style.display='block'; return; }
    if(!postBodyInput.value.trim()){ postFormError.textContent = 'Escribe el contenido del post.'; postFormError.style.display='block'; return; }
    postFormError.style.display = 'none';
    if(editingId){
      const p = posts.find(x=>x.id===editingId);
      p.title = title;
      p.excerpt = postExcerptInput.value.trim();
      p.body = postBodyInput.value;
      p.category = postCategory;
      p.image = pendingImage;
      closePostModal(true);
      renderGrid();
      try{ localStorage.removeItem('blog-posts-cache-v1'); }catch(e){}
      try{ await window.fbSaveBlogPost(p); }catch(e){}
      if(postNotifCheck.checked) enviarNotifPost(p);
      return;
    }
    const newPost = {
      id: 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      title, excerpt: postExcerptInput.value.trim(), body: postBodyInput.value,
      category: postCategory, image: pendingImage, createdAt: Date.now()
    };
    posts.unshift(newPost);
    closePostModal(true);
    renderGrid();
    try{ localStorage.removeItem('blog-posts-cache-v1'); }catch(e){}
    try{ await window.fbSaveBlogPost(newPost); }catch(e){}
    if(postNotifCheck.checked) enviarNotifPost(newPost);
  });

  postDeleteBtn.addEventListener('click', async ()=>{
    if(!editingId) return;
    if(!confirm('¿Eliminar este post?')) return;
    const id = editingId;
    posts = posts.filter(p=>p.id!==id);
    closePostModal(true);
    renderGrid();
    try{ localStorage.removeItem('blog-posts-cache-v1'); }catch(e){}
    try{ await window.fbDeleteBlogPost(id); }catch(e){}
  });

  function start(){
    if(window.fbOnAuth) window.fbOnAuth(user=>{ /* la sesión persiste; no auto-activamos admin sin acción explícita */ });
    loadPosts();
    loadHero();
  }
  // ---------- encabezado editable ----------
  const blogEditHeroBtn = document.getElementById('blogEditHeroBtn');
  const heroOverlay = document.getElementById('heroOverlay');
  const heroEyebrowInput = document.getElementById('heroEyebrowInput');
  const heroTitleInput = document.getElementById('heroTitleInput');
  const heroSubInput = document.getElementById('heroSubInput');
  const heroCancelBtn = document.getElementById('heroCancelBtn');
  const heroSaveBtn = document.getElementById('heroSaveBtn');
  const heroEyebrowEl = document.getElementById('blogHeroEyebrow');
  const heroTitleEl = document.getElementById('blogHeroTitle');
  const heroSubEl = document.getElementById('blogHeroSub');
  const HERO_DEFAULT = {
    eyebrow: 'Noticias y blog',
    titulo: 'Guías, historias y novedades para coleccionistas',
    subtitulo: 'Todo lo que compartimos fuera del catálogo: cuidado de figuras, autenticidad, y lo que pasa detrás de cámara.'
  };
  async function loadHero(){
    const CACHE_KEY = 'blog-hero-cache-v1';
    try{
      const guardado = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if(guardado){
        heroEyebrowEl.textContent = guardado.eyebrow || HERO_DEFAULT.eyebrow;
        heroTitleEl.textContent = guardado.titulo || HERO_DEFAULT.titulo;
        heroSubEl.textContent = guardado.subtitulo || HERO_DEFAULT.subtitulo;
      }
    }catch(e){}
    try{
      const saved = await window.storage.get('blog-hero');
      const h = (saved && saved.value) || HERO_DEFAULT;
      heroEyebrowEl.textContent = h.eyebrow || HERO_DEFAULT.eyebrow;
      heroTitleEl.textContent = h.titulo || HERO_DEFAULT.titulo;
      heroSubEl.textContent = h.subtitulo || HERO_DEFAULT.subtitulo;
      try{ localStorage.setItem(CACHE_KEY, JSON.stringify(h)); }catch(e){}
    }catch(e){}
  }
  blogEditHeroBtn.addEventListener('click', ()=>{
    heroEyebrowInput.value = heroEyebrowEl.textContent;
    heroTitleInput.value = heroTitleEl.textContent;
    heroSubInput.value = heroSubEl.textContent;
    heroOverlay.classList.add('show');
    setTimeout(()=> heroGuard.snapshot(), 50);
  });
  const heroGuard = makeDirtyGuard(()=> ({ eb: heroEyebrowInput.value, tt: heroTitleInput.value, sb: heroSubInput.value }));
  heroCancelBtn.addEventListener('click', ()=> confirmDiscard(heroGuard, false, ()=> heroOverlay.classList.remove('show')));
  heroOverlay.addEventListener('click', (e)=>{ if(e.target===heroOverlay) confirmDiscard(heroGuard, false, ()=> heroOverlay.classList.remove('show')); });
  heroSaveBtn.addEventListener('click', async ()=>{
    const h = {
      eyebrow: heroEyebrowInput.value.trim() || HERO_DEFAULT.eyebrow,
      titulo: heroTitleInput.value.trim() || HERO_DEFAULT.titulo,
      subtitulo: heroSubInput.value.trim() || HERO_DEFAULT.subtitulo
    };
    heroEyebrowEl.textContent = h.eyebrow;
    heroTitleEl.textContent = h.titulo;
    heroSubEl.textContent = h.subtitulo;
    heroOverlay.classList.remove('show');
    heroGuard.clear();
    try{ localStorage.setItem('blog-hero-cache-v1', JSON.stringify(h)); }catch(e){}
    try{ await window.storage.set('blog-hero', h); }catch(e){}
  });

  if(window.__firebaseReady) start();
  else window.addEventListener('firebase-ready', start, { once:true });
})();
