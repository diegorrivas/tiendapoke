(function(){
  const STORAGE_KEY = 'products';
  const PIN_KEY = 'admin-pin';
  // Valor por defecto codificado (no aparece en texto plano)
  const DEFAULT_PIN = atob('NzQ2MlRN');
  const WHATSAPP_NUMBER = '51989197844';
  const MAX_IMAGES = 6;
  const FRAME_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>';
  const waCtaIconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5-.17 0-.37-.03-.57-.03-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12 2a10 10 0 0 0-8.6 15.06L2 22l5.06-1.33A10 10 0 1 0 12 2z"/></svg>';

  let products = [];
  let isAdmin = false;
  let currentFilter = 'all';
  let activeCategories = new Set();
  let precioMin = null;   // filtro de precio: desde
  let precioMax = null;   // filtro de precio: hasta
  let showOnlyMix = false;
  let inquiryList = [];
  const INQUIRY_KEY = 'inquiry-list';
  try{
    const rawInquiry = localStorage.getItem(INQUIRY_KEY);
    if(rawInquiry) inquiryList = JSON.parse(rawInquiry);
  }catch(e){}
  function saveInquiryListStorage(){
    try{ localStorage.setItem(INQUIRY_KEY, JSON.stringify(inquiryList)); }catch(e){}
  }
  let currentSort = 'recientes';
  let searchTerm = '';
  let editingId = null;
  let editingState = 'disponible';
  let editingCategory = 'otros';
  let pinMode = 'enter'; // 'enter' or 'setup-check'
  let pendingImages = [];
  let lightboxImages = [];
  let lightboxIndex = 0;
  let bannerSlides = [];
  let bannerIndex = 0;
  let bannerTimer = null;
  let editingSlideId = null;
  let slidePendingImage = null;
  let slidePendingImageMobile = null;

  const grid = document.getElementById('grid');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptySub = document.getElementById('emptySub');
  const emptyActions = document.getElementById('emptyActions');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const emptyWaBtn = document.getElementById('emptyWaBtn');
  const resultCount = document.getElementById('resultCount');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  function animateCount(el, target, suffix){
    const from = Number(el.dataset.count) || 0;
    el.dataset.count = target;
    if(Math.abs(target - from) <= 1 || target > 500){ el.textContent = target + suffix; return; }
    const dur = 320, t0 = performance.now();
    function step(t){
      const p = Math.min(1, (t - t0) / dur);
      const val = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      el.textContent = val + suffix;
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  (function(){
    const filtersEl = document.querySelector('.filters-sticky');
    if(!filtersEl) return;
    window.addEventListener('scroll', ()=>{
      filtersEl.classList.toggle('is-stuck', filtersEl.getBoundingClientRect().top <= 0);
    }, {passive:true});
  })();

  loadMoreBtn.addEventListener('click', ()=>{
    loadMoreBtn.classList.add('loading');
    setTimeout(renderNextPage, 150);
  });

  // Auto-cargar al acercarse al final (scroll infinito suave)
  window.addEventListener('scroll', ()=>{
    if(loadMoreWrap.style.display === 'none') return;
    const rect = loadMoreWrap.getBoundingClientRect();
    if(rect.top < window.innerHeight + 300) renderNextPage();
  }, {passive:true});
  const mixToggle = document.getElementById('mixToggle');
  mixToggle.addEventListener('click', ()=>{
    showOnlyMix = !showOnlyMix;
    mixToggle.classList.toggle('active', showOnlyMix);
    render();
  });

  // ---------- lista de consulta (varios productos a la vez) ----------
  const inquiryListBtn = document.getElementById('inquiryListBtn');
  const inquiryCount = document.getElementById('inquiryCount');
  const inquiryOverlay = document.getElementById('inquiryOverlay');
  const inquiryClose = document.getElementById('inquiryClose');
  const inquiryItemsEl = document.getElementById('inquiryItems');
  const inquiryEmptyEl = document.getElementById('inquiryEmpty');
  const inquiryFooterEl = document.getElementById('inquiryFooter');
  const inquirySubtotalEl = document.getElementById('inquirySubtotal');
  const inquirySendBtn = document.getElementById('inquirySendBtn');

  const cartFab = document.getElementById('cartFab');
  const cartFabCount = document.getElementById('cartFabCount');
  function updateInquiryBadge(){
    const n = inquiryList.reduce((sum,it)=> sum + (it.qty||1), 0);
    if(inquiryCount){ inquiryCount.textContent = n; inquiryCount.classList.toggle('show', n > 0); }
    if(cartFabCount) cartFabCount.textContent = n;
    if(cartFab) cartFab.classList.toggle('show', n > 0);
  }
  updateInquiryBadge();
  if(cartFab) cartFab.addEventListener('click', openInquiryModal);

  function addToInquiryList(productId, qty, variant){
    qty = Math.max(1, Math.min(99, qty || 1));
    const vId = variant ? variant.id : null;
    const existing = inquiryList.find(it=> it.id === productId && (it.variantId||null) === vId);
    if(existing){
      const p = products.find(x=>x.id===productId);
      if(p && p.allowQuantity) existing.qty = Math.min(99, (existing.qty||1) + qty);
      else{ showToast('Ese producto ya está en tu lista'); return; }
    } else {
      inquiryList.push(variant
        ? { id: productId, qty: qty, variantId: variant.id, variantName: variant.name, variantPrice: variant.price }
        : { id: productId, qty: qty });
    }
    saveInquiryListStorage();
    updateInquiryBadge();
    showToast('Agregado a tu lista de consulta');
    if(cartFab){ cartFab.classList.remove('cart-fab-bump'); void cartFab.offsetWidth; cartFab.classList.add('cart-fab-bump'); }
  }

  function removeFromInquiryList(productId, variantId){
    inquiryList = inquiryList.filter(it=> !(it.id === productId && (it.variantId||null) === (variantId||null)));
    saveInquiryListStorage();
    updateInquiryBadge();
    renderInquiryModal();
    showToast('Quitado de tu lista');
    actualizarBotonesAgregar(productId);
  }

  const CART_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 8H6.2"/><circle cx="9.5" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
  // Refleja en TODAS las tarjetas visibles del mismo producto (puede repetirse en
  // "Recién llegados" y en el catálogo) si está o no en el carrito, con animación.
  function actualizarBotonesAgregar(productId){
    const enCarrito = inquiryList.some(it=> it.id === productId);
    document.querySelectorAll('.card[data-pid="' + productId + '"] .card-add-icon').forEach(btn=>{
      btn.classList.remove('bump-add', 'bump-remove');
      void btn.offsetWidth;
      btn.classList.toggle('added', enCarrito);
      btn.innerHTML = enCarrito ? CHECK_SVG : CART_SVG;
      btn.title = enCarrito ? 'Quitar del carrito' : 'Agregar al carrito';
      btn.setAttribute('aria-label', btn.title);
      btn.classList.add(enCarrito ? 'bump-add' : 'bump-remove');
    });
  }

  function updateInquiryQty(productId, newQty, variantId){
    const item = inquiryList.find(it=> it.id === productId && (it.variantId||null) === (variantId||null));
    if(!item) return;
    item.qty = Math.max(1, Math.min(99, newQty));
    saveInquiryListStorage();
    updateInquiryBadge();
    renderInquiryModal();
  }

  function renderInquiryModal(){
    inquiryItemsEl.innerHTML = '';
    const validItems = inquiryList.map(it=> ({ it, p: products.find(x=>x.id===it.id) })).filter(x=> x.p);
    // limpia del carrito productos que ya no existen (borrados por el admin, por ejemplo)
    if(validItems.length !== inquiryList.length){
      inquiryList = validItems.map(x=>x.it);
      saveInquiryListStorage();
      updateInquiryBadge();
    }

    const isEmpty = validItems.length === 0;
    inquiryEmptyEl.style.display = isEmpty ? 'flex' : 'none';
    inquiryFooterEl.style.display = isEmpty ? 'none' : 'flex';
    if(isEmpty) return;

    let subtotal = 0;
    validItems.forEach(({it, p})=>{
      const variant = it.variantId ? (p.variants||[]).find(v=>v.id===it.variantId) : null;
      const qty = variant ? 1 : (it.qty || 1);
      const unitPrice = variant ? variant.price : p.price;
      subtotal += unitPrice * qty;

      const row = document.createElement('div');
      row.className = 'inquiry-item';

      const wrap = document.createElement('div');
      wrap.className = 'inquiry-item-wrap';
      const delBg = document.createElement('div');
      delBg.className = 'inquiry-item-delbg';
      const basuraUrl = siteContent.iconos && siteContent.iconos.basura;
      delBg.innerHTML = basuraUrl
        ? '<img src="' + imgSrc(basuraUrl) + '" alt="Eliminar" style="width:22px;height:22px;object-fit:contain;">'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6"/></svg>';
      wrap.appendChild(delBg);

      const img = document.createElement('img');
      img.className = 'inquiry-item-img';
      const firstImg = (p.images && p.images[0]) ? imgSrc(p.images[0]) : (p.image || '');
      img.src = firstImg;
      img.alt = p.name;
      row.appendChild(img);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'inquiry-item-body';
      const nameEl = document.createElement('div');
      nameEl.className = 'inquiry-item-name';
      nameEl.textContent = variant ? (variant.name + ' — ' + p.name) : p.name;
      const priceEl = document.createElement('div');
      priceEl.className = 'inquiry-item-price';
      priceEl.textContent = qty > 1 ? (money(unitPrice) + ' × ' + qty + '  =  ' + money(unitPrice * qty)) : money(unitPrice);
      const removeEl = document.createElement('button');
      removeEl.type = 'button';
      removeEl.className = 'inquiry-item-remove-btn';
      removeEl.setAttribute('aria-label', 'Quitar');
      removeEl.title = 'Quitar';
      removeEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M9 3.5h6a1 1 0 0 1 1 1V5h3.25a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1 0-1.5H8v-.5a1 1 0 0 1 1-1z"/><path d="M6 7.5l.9 12.15A2 2 0 0 0 8.9 21.5h6.2a2 2 0 0 0 2-1.85L18 7.5"/><path d="M10 11v6.5M14 11v6.5"/></svg>';
      removeEl.addEventListener('click', ()=> removeFromInquiryList(p.id, it.variantId));
      bodyEl.appendChild(nameEl);
      bodyEl.appendChild(priceEl);
      row.appendChild(bodyEl);

      if(p.allowQuantity && !variant){
        const qtyEl = document.createElement('div');
        qtyEl.className = 'inquiry-qty';
        const minus = document.createElement('button');
        minus.type = 'button'; minus.textContent = '−';
        minus.addEventListener('click', ()=> updateInquiryQty(p.id, qty - 1));
        const num = document.createElement('span');
        num.className = 'inquiry-qty-num';
        num.textContent = qty;
        const plus = document.createElement('button');
        plus.type = 'button'; plus.textContent = '+';
        plus.addEventListener('click', ()=> updateInquiryQty(p.id, qty + 1));
        qtyEl.appendChild(minus); qtyEl.appendChild(num); qtyEl.appendChild(plus);
        row.appendChild(qtyEl);
      } else {
        const fixedEl = document.createElement('div');
        fixedEl.className = 'inquiry-qty-fixed';
        fixedEl.textContent = '×1';
        row.appendChild(fixedEl);
      }

      row.appendChild(removeEl);
      wrap.appendChild(row);
      inquiryItemsEl.appendChild(wrap);
      attachSwipeRemove(row, p.id, it.variantId);
    });

    inquirySubtotalEl.textContent = money(subtotal);
    inquirySendBtn.href = buildInquiryWhatsAppLink(validItems);
    const titleEl = document.getElementById('inquiryTitle');
    if(titleEl) titleEl.textContent = 'Tu lista' + (validItems.length ? ' (' + validItems.length + ')' : '');
  }

  function attachSwipeRemove(row, id, variantId){
    let startX = 0, dx = 0, dragging = false;
    const THRESH = 80;
    function start(x){ dragging = true; dx = 0; startX = x; row.style.transition = 'none'; }
    function move(x){
      if(!dragging) return;
      dx = Math.min(0, x - startX);
      row.style.transform = 'translateX(' + dx + 'px)';
    }
    function end(){
      if(!dragging) return;
      dragging = false;
      row.style.transition = '';
      if(Math.abs(dx) > THRESH){
        row.style.transform = 'translateX(-110%)';
        row.style.opacity = '0';
        setTimeout(()=> removeFromInquiryList(id, variantId), 180);
      } else {
        row.style.transform = '';
      }
    }
    row.addEventListener('touchstart', (e)=> start(e.touches[0].clientX), {passive:true});
    row.addEventListener('touchmove', (e)=> move(e.touches[0].clientX), {passive:true});
    row.addEventListener('touchend', end);
  }

  function buildInquiryWhatsAppLink(validItems){
    const base = location.href.split('#')[0];
    let msg = '¡Hola! Quisiera consultar por estos productos:\n\n';
    let subtotal = 0;
    validItems.forEach(({it, p}, i)=>{
      const variant = it.variantId ? (p.variants||[]).find(v=>v.id===it.variantId) : null;
      const qty = variant ? 1 : (it.qty || 1);
      const unitPrice = variant ? variant.price : p.price;
      const label = variant ? (variant.name + ' — ' + p.name) : p.name;
      subtotal += unitPrice * qty;
      msg += (i+1) + '. ' + label + (qty > 1 ? ' (x' + qty + ')' : '') + ' — ' + money(unitPrice) + '\n';
      msg += '   ' + base + '#producto=' + encodeURIComponent(p.id) + '\n';
    });
    msg += '\nSubtotal referencial: ' + money(subtotal);
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  function openInquiryModal(){
    renderInquiryModal();
    inquiryOverlay.classList.add('show');
  }
  function closeInquiryModal(){
    inquiryOverlay.classList.remove('show');
  }
  if(inquiryListBtn) inquiryListBtn.addEventListener('click', openInquiryModal);
  inquiryClose.addEventListener('click', closeInquiryModal);
  inquiryOverlay.addEventListener('click', (e)=>{ if(e.target === inquiryOverlay) closeInquiryModal(); });
  const inquirySeguirBtn = document.getElementById('inquirySeguirBtn');
  const inquiryEmptyBrowseBtn = document.getElementById('inquiryEmptyBrowseBtn');
  if(inquirySeguirBtn) inquirySeguirBtn.addEventListener('click', closeInquiryModal);
  if(inquiryEmptyBrowseBtn) inquiryEmptyBrowseBtn.addEventListener('click', ()=>{
    closeInquiryModal();
    abrirCatalogoCompleto();
  });
  const adminToggle = document.getElementById('adminToggle');
  const adminLabel = document.getElementById('adminLabel');
  const addBtn = document.getElementById('addBtn');
  const lotBtn = document.getElementById('lotBtn');
  const searchInput = document.getElementById('heroSearchInput');
  const filterChips = document.getElementById('filterChips');
  const chipThumb = document.getElementById('chipThumb');
  function moveChipThumb(){
    if(!chipThumb) return;
    const active = filterChips.querySelector('.chip.active');
    if(!active){ chipThumb.style.width = '0'; return; }
    chipThumb.style.width = active.offsetWidth + 'px';
    chipThumb.style.transform = 'translateX(' + active.offsetLeft + 'px)';
  }
  window.addEventListener('resize', moveChipThumb);
  setTimeout(moveChipThumb, 0);
  const categoryChips = document.getElementById('categoryChips');
  (function(){
    const dotsWrap = document.getElementById('categoryScrollDots');
    if(!dotsWrap || !categoryChips) return;
    const dots = dotsWrap.querySelectorAll('span');
    function update(){
      const max = categoryChips.scrollWidth - categoryChips.clientWidth;
      dotsWrap.classList.toggle('show', max > 8);
      if(max <= 8) return;
      const ratio = categoryChips.scrollLeft / max;
      const idx = Math.min(dots.length - 1, Math.floor(ratio * dots.length));
      dots.forEach((d,i)=> d.classList.toggle('active', i === idx));
    }
    categoryChips.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update);
    setTimeout(update, 300);

    // Botones de deslizamiento a los lados: aparecen mientras se hace scroll, se ocultan al detenerse.
    const catPrev = document.getElementById('catScrollPrev');
    const catNext = document.getElementById('catScrollNext');
    let hideNavTimer = null;
    function updateNavArrows(){
      if(!catPrev || !catNext) return;
      const max = categoryChips.scrollWidth - categoryChips.clientWidth;
      if(max <= 8){ catPrev.classList.remove('show'); catNext.classList.remove('show'); return; }
      catPrev.classList.toggle('show', categoryChips.scrollLeft > 6);
      catNext.classList.toggle('show', categoryChips.scrollLeft < max - 6);
      clearTimeout(hideNavTimer);
      hideNavTimer = setTimeout(()=>{ catPrev.classList.remove('show'); catNext.classList.remove('show'); }, 900);
    }
    categoryChips.addEventListener('scroll', updateNavArrows, {passive:true});
    if(catPrev) catPrev.addEventListener('click', ()=> categoryChips.scrollBy({left:-160, behavior:'smooth'}));
    if(catNext) catNext.addEventListener('click', ()=> categoryChips.scrollBy({left:160, behavior:'smooth'}));
  })();  const themeToggle = document.getElementById('themeToggle');
  const sortBtn = document.getElementById('sortBtn');
  const sortMenu = document.getElementById('sortMenu');
  function moveSortThumb(menu){
    if(!menu) return;
    const thumb = menu.querySelector('.sort-thumb');
    const active = menu.querySelector('.sort-option.active');
    if(!thumb || !active) return;
    thumb.style.height = active.offsetHeight + 'px';
    thumb.style.transform = 'translateY(' + active.offsetTop + 'px)';
  }
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const sheetBtn = document.getElementById('sheetBtn');
  const sheetOverlay = document.getElementById('sheetOverlay');
  const sheetUrlInput = document.getElementById('sheetUrlInput');
  const sheetCancel = document.getElementById('sheetCancel');
  const sheetSyncBtn = document.getElementById('sheetSyncBtn');

  const banner = document.getElementById('banner');
  const bannerTrack = document.getElementById('bannerTrack');
  const bannerDots = document.getElementById('bannerDots');
  const bannerCaption = document.getElementById('bannerCaption');
  const bannerBar = document.getElementById('bannerBar');
  const bannerPrev = document.getElementById('bannerPrev');
  const bannerNext = document.getElementById('bannerNext');
  const bannerBtn = document.getElementById('bannerBtn');
  const textsBtn = document.getElementById('textsBtn');
  const textsOverlay = document.getElementById('textsOverlay');
  const textsCancel = document.getElementById('textsCancel');
  const textsSave = document.getElementById('textsSave');

  const bannerListOverlay = document.getElementById('bannerListOverlay');
  const bannerListClose = document.getElementById('bannerListClose');
  const addSlideBtn = document.getElementById('addSlideBtn');
  const slideList = document.getElementById('slideList');

  const slideOverlay = document.getElementById('slideOverlay');
  const slideModalTitle = document.getElementById('slideModalTitle');
  const slideImageInput = document.getElementById('slideImageInput');
  const slideImageInputMobile = document.getElementById('slideImageInputMobile');
  const slideUploadHintMobile = document.getElementById('slideUploadHintMobile');
  const slideThumbStripMobile = document.getElementById('slideThumbStripMobile');
  const slideThumbStrip = document.getElementById('slideThumbStrip');
  const slideUploadHint = document.getElementById('slideUploadHint');
  const slideTagInput = document.getElementById('slideTagInput');
  const slideTitleInput = document.getElementById('slideTitleInput');
  const slideSubInput = document.getElementById('slideSubInput');
  const slideCancel = document.getElementById('slideCancel');
  const slideSave = document.getElementById('slideSave');
  const slideDeleteRow = document.getElementById('slideDeleteRow');
  const slideDeleteBtn = document.getElementById('slideDeleteBtn');

  const productOverlay = document.getElementById('productOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const nameInput = document.getElementById('nameInput');
  const priceInput = document.getElementById('priceInput');
  const oldPriceInput = document.getElementById('oldPriceInput');
  const reservaInput = document.getElementById('reservaInput');
  const descInput = document.getElementById('descInput');
  const notesInput = document.getElementById('notesInput');
  const tagsInput = document.getElementById('tagsInput');
  const relatedChosenEl = document.getElementById('relatedChosen');
  const relatedSearchEl = document.getElementById('relatedSearch');
  const relatedResultsEl = document.getElementById('relatedResults');
  let pendingRelated = [];

  function renderRelatedChosen(){
    if(!relatedChosenEl) return;
    relatedChosenEl.innerHTML = '';
    pendingRelated.forEach(id=>{
      const prod = products.find(x => x.id === id);
      if(!prod) return;
      const chip = document.createElement('span');
      chip.className = 'rel-chip';
      const txt = document.createElement('span');
      txt.textContent = prod.name;
      const del = document.createElement('button');
      del.type = 'button'; del.innerHTML = '&times;'; del.title = 'Quitar';
      del.addEventListener('click', ()=>{
        pendingRelated = pendingRelated.filter(x => x !== id);
        renderRelatedChosen();
      });
      chip.appendChild(txt); chip.appendChild(del);
      relatedChosenEl.appendChild(chip);
    });
  }

  function renderRelatedResults(term){
    if(!relatedResultsEl) return;
    relatedResultsEl.innerHTML = '';
    const t = (term || '').trim();
    if(!t){ relatedResultsEl.classList.remove('show'); return; }
    const encontrados = products
      .filter(x => x.id !== editingId && !pendingRelated.includes(x.id) && fuzzyMatch(t, x.name || ''))
      .slice(0, 8);
    if(!encontrados.length){
      const vacio = document.createElement('div');
      vacio.className = 'rel-empty';
      vacio.textContent = 'No se encontraron productos con ese nombre.';
      relatedResultsEl.appendChild(vacio);
    }
    encontrados.forEach(prod=>{
      const it = document.createElement('button');
      it.type = 'button'; it.className = 'rel-item';
      const imgs = (prod.images && prod.images.length) ? prod.images : [];
      if(imgs.length){
        const im = document.createElement('img');
        im.src = imgSrc(imgs[0]); im.alt = '';
        it.appendChild(im);
      }
      const n = document.createElement('span');
      n.className = 'n'; n.textContent = prod.name;
      it.appendChild(n);
      it.addEventListener('click', ()=>{
        if(pendingRelated.length >= 8){ showToast('Máximo 8 recomendados'); return; }
        pendingRelated.push(prod.id);
        relatedSearchEl.value = '';
        relatedResultsEl.classList.remove('show');
        renderRelatedChosen();
      });
      relatedResultsEl.appendChild(it);
    });
    relatedResultsEl.classList.add('show');
  }

  if(relatedSearchEl) relatedSearchEl.addEventListener('input', ()=> renderRelatedResults(relatedSearchEl.value));
  const expectedDateField = document.getElementById('expectedDateField');
  const expectedDateInput = document.getElementById('expectedDateInput');
  const youtubeInput = document.getElementById('youtubeInput');
  const allowQuantityInput = document.getElementById('allowQuantityInput');
  const shinyInput = document.getElementById('shinyInput');
  const imageInput = document.getElementById('imageInput');
  const imageLinkInput = document.getElementById('imageLinkInput');
  const imageLinkBtn = document.getElementById('imageLinkBtn');
  const thumbStrip = document.getElementById('thumbStrip');
  const uploadHint = document.getElementById('uploadHint');
  const stateSelect = document.getElementById('stateSelect');
  const categorySelect = document.getElementById('categorySelect');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const deleteRow = document.getElementById('deleteRow');
  const deleteBtn = document.getElementById('deleteBtn');
  const pinOverlay = document.getElementById('pinOverlay');
  const pinDots = document.getElementById('pinDots').querySelectorAll('input');
  const pinCancel = document.getElementById('pinCancel');
  const pinConfirm = document.getElementById('pinConfirm');
  const pinError = document.getElementById('pinError');
  const pinTitle = document.getElementById('pinTitle');
  const pinSub = document.getElementById('pinSub');

  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  const lightboxOverlay = document.getElementById('lightboxOverlay');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCounter = document.getElementById('lightboxCounter');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const waFab = document.getElementById('waFab');

  // ---------- herramienta de encuadre (arrastrar foto) ----------
  const cropOverlay = document.getElementById('cropOverlay');
  const cropFrame = document.getElementById('cropFrame');
  const cropImg = document.getElementById('cropImg');
  const cropTitle = document.getElementById('cropTitle');
  const cropClose = document.getElementById('cropClose');
  const cropCenterBtn = document.getElementById('cropCenterBtn');
  const cropCancelBtn = document.getElementById('cropCancelBtn');
  const cropSaveBtn = document.getElementById('cropSaveBtn');

  let cropPosX = 50, cropPosY = 50;
  let cropOverflowX = 0, cropOverflowY = 0;
  let cropDragging = false;
  let cropStartX = 0, cropStartY = 0, cropStartPosX = 50, cropStartPosY = 50;
  let cropOnSave = null;

  function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

  // ---------- recorte libre ----------
  const cropModes = document.getElementById('cropModes');
  const cropFrameWrap = document.getElementById('cropFrameWrap');
  const cropStageWrap = document.getElementById('cropStageWrap');
  const cropStage = document.getElementById('cropStage');
  const cropFreeImg = document.getElementById('cropFreeImg');
  const cropBox = document.getElementById('cropBox');
  const cropRatios = document.getElementById('cropRatios');
  const cropHint = document.getElementById('cropHint');

  let cropMode = 'encuadre';       // 'encuadre' | 'recorte'
  let cropOnCropped = null;        // callback al terminar el recorte
  let cropObjectUrl = null;        // foto descargada en memoria (se libera al cerrar)
  let cropRatio = null;            // null = libre
  let box = {x:0, y:0, w:0, h:0};  // caja de recorte, en píxeles de pantalla
  let boxDrag = null;              // {tipo, startX, startY, inicio}

  cropFreeImg.addEventListener('load', ()=>{ if(cropMode === 'recorte') initCropBox(); });

  function setCropMode(modo){
    cropMode = modo;
    const esRecorte = modo === 'recorte';
    cropFrameWrap.style.display = esRecorte ? 'none' : '';
    cropStageWrap.style.display = esRecorte ? '' : 'none';
    cropHint.textContent = esRecorte
      ? 'Arrastra las esquinas para elegir qué parte de la foto quieres conservar.'
      : 'Arrastra la foto hasta que se vea como quieres.';
    cropSaveBtn.textContent = esRecorte ? 'Recortar y guardar' : 'Guardar encuadre';
    cropCenterBtn.style.display = esRecorte ? 'none' : '';
    if(cropModes) cropModes.querySelectorAll('.crop-mode-btn').forEach(b=>
      b.classList.toggle('active', b.dataset.mode === modo));
    if(esRecorte) requestAnimationFrame(initCropBox);
  }

  // Rectángulo que ocupa la imagen dentro del escenario (por si tiene bandas).
  function imgRect(){
    const s = cropStage.getBoundingClientRect();
    const i = cropFreeImg.getBoundingClientRect();
    return { left:i.left - s.left, top:i.top - s.top, width:i.width, height:i.height };
  }

  function initCropBox(){
    const r = imgRect();
    if(!r.width || !r.height) return;
    let w = r.width * 0.8, h = r.height * 0.8;
    if(cropRatio){
      if(w / h > cropRatio) w = h * cropRatio; else h = w / cropRatio;
    }
    box = { x: r.left + (r.width - w)/2, y: r.top + (r.height - h)/2, w, h };
    drawBox();
  }

  function drawBox(){
    cropBox.style.left = box.x + 'px';
    cropBox.style.top = box.y + 'px';
    cropBox.style.width = box.w + 'px';
    cropBox.style.height = box.h + 'px';
  }

  function boxPointerDown(e, tipo){
    e.preventDefault(); e.stopPropagation();
    const pt = e.touches ? e.touches[0] : e;
    boxDrag = { tipo, startX: pt.clientX, startY: pt.clientY, inicio: Object.assign({}, box) };
  }

  function boxPointerMove(e){
    if(!boxDrag) return;
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - boxDrag.startX, dy = pt.clientY - boxDrag.startY;
    const r = imgRect(), ini = boxDrag.inicio, min = 30;

    if(boxDrag.tipo === 'move'){
      box.x = clamp(ini.x + dx, r.left, r.left + r.width - ini.w);
      box.y = clamp(ini.y + dy, r.top, r.top + r.height - ini.h);
    } else {
      let x1 = ini.x, y1 = ini.y, x2 = ini.x + ini.w, y2 = ini.y + ini.h;
      if(boxDrag.tipo.includes('w')) x1 = clamp(ini.x + dx, r.left, x2 - min);
      if(boxDrag.tipo.includes('e')) x2 = clamp(ini.x + ini.w + dx, x1 + min, r.left + r.width);
      if(boxDrag.tipo.includes('n')) y1 = clamp(ini.y + dy, r.top, y2 - min);
      if(boxDrag.tipo.includes('s')) y2 = clamp(ini.y + ini.h + dy, y1 + min, r.top + r.height);
      let w = x2 - x1, h = y2 - y1;
      if(cropRatio){
        // mantener proporción sin salirse de la foto
        if(w / h > cropRatio) w = h * cropRatio; else h = w / cropRatio;
        if(boxDrag.tipo.includes('w')) x1 = x2 - w;
        if(boxDrag.tipo.includes('n')) y1 = y2 - h;
        w = Math.min(w, r.left + r.width - x1);
        h = Math.min(h, r.top + r.height - y1);
      }
      box = { x:x1, y:y1, w, h };
    }
    drawBox();
  }
  function boxPointerUp(){ boxDrag = null; }

  cropBox.addEventListener('mousedown', (e)=> boxPointerDown(e, 'move'));
  cropBox.addEventListener('touchstart', (e)=> boxPointerDown(e, 'move'), {passive:false});
  cropBox.querySelectorAll('.crop-h').forEach(h=>{
    h.addEventListener('mousedown', (e)=> boxPointerDown(e, h.dataset.h));
    h.addEventListener('touchstart', (e)=> boxPointerDown(e, h.dataset.h), {passive:false});
  });
  window.addEventListener('mousemove', boxPointerMove);
  window.addEventListener('touchmove', boxPointerMove, {passive:false});
  window.addEventListener('mouseup', boxPointerUp);
  window.addEventListener('touchend', boxPointerUp);

  if(cropRatios) cropRatios.addEventListener('click', (e)=>{
    const b = e.target.closest('.crop-ratio-btn');
    if(!b) return;
    cropRatio = b.dataset.r === 'free' ? null : Number(b.dataset.r);
    cropRatios.querySelectorAll('.crop-ratio-btn').forEach(x=> x.classList.toggle('active', x === b));
    initCropBox();
  });

  if(cropModes) cropModes.addEventListener('click', (e)=>{
    const b = e.target.closest('.crop-mode-btn');
    if(b) setCropMode(b.dataset.mode);
  });

  // Genera la foto recortada y la sube; devuelve el nuevo link.
  async function aplicarRecorte(){
    const r = imgRect();
    const escala = cropFreeImg.naturalWidth / r.width;
    const sx = Math.max(0, (box.x - r.left) * escala);
    const sy = Math.max(0, (box.y - r.top) * escala);
    const sw = Math.min(cropFreeImg.naturalWidth - sx, box.w * escala);
    const sh = Math.min(cropFreeImg.naturalHeight - sy, box.h * escala);
    if(sw < 10 || sh < 10) throw new Error('area-muy-pequena');

    const MAX = 1400;
    let dw = sw, dh = sh;
    if(Math.max(dw, dh) > MAX){
      const f = MAX / Math.max(dw, dh);
      dw = Math.round(dw * f); dh = Math.round(dh * f);
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(dw); canvas.height = Math.round(dh);
    canvas.getContext('2d').drawImage(cropFreeImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const blob = await exportarCanvas(canvas, 0.85);
    blob.name = 'recorte' + (blob.type === 'image/webp' ? '.webp' : '.jpg');
    return await window.fbUploadImage(blob);
  }

  // Abre el modal de encuadre para una foto.
  // ratio: proporción del marco (ej. "1/1" para producto, "5/2" para banner de escritorio).
  function openCropTool({src, pos, ratio, title, onSave, onCropped}){
    cropTitle.textContent = title || 'Encuadrar foto';
    cropFrame.style.aspectRatio = ratio || '1/1';
    const parts = (pos || '50% 50%').replace(/%/g,'').trim().split(/\s+/).map(Number);
    cropPosX = isNaN(parts[0]) ? 50 : parts[0];
    cropPosY = isNaN(parts[1]) ? 50 : parts[1];
    cropOnSave = onSave;
    cropOnCropped = onCropped || null;
    // El recorte solo se ofrece si quien abre la herramienta sabe qué hacer con la foto nueva.
    if(cropModes) cropModes.style.display = cropOnCropped ? 'flex' : 'none';
    cropRatio = null;
    if(cropRatios) cropRatios.querySelectorAll('.crop-ratio-btn').forEach((b,i)=> b.classList.toggle('active', i===0));
    setCropMode('encuadre');
    cropImg.style.width = '';
    cropImg.style.height = '';
    cropImg.onerror = ()=>{ showToast('No se pudo cargar la foto para editar.'); closeCropTool(); };
    cropImg.onload = ()=> cropLayout();
    cropOverlay.classList.add('show');

    // La foto se descarga UNA sola vez y se reutiliza en los dos modos.
    // Cargarla dos veces (una normal y otra con permisos de lectura) hace que
    // el navegador se confunda y no muestre ninguna.
    prepararFotoCrop(src).then(({url, puedeRecortar})=>{
      cropObjectUrl = (url !== src) ? url : null;
      if(!puedeRecortar){
        // Foto de link externo sin permiso de lectura: se puede encuadrar,
        // pero no recortar. Antes desaparecía la pestaña de golpe (confuso);
        // ahora avisamos y sugerimos la solución.
        cropOnCropped = null;
        if(cropModes) cropModes.style.display = 'none';
        setCropMode('encuadre');
        showToast('Esta foto es de un enlace externo y no se puede recortar. Descárgala y súbela desde tu dispositivo.');
      }
      cropFreeImg.src = url;
      cropImg.src = url;
      if(cropImg.complete && cropImg.naturalWidth) requestAnimationFrame(cropLayout);
    });
  }

  // Intenta traer la foto como archivo local para poder recortarla.
  // Si el servidor no lo permite, devuelve el link original (solo encuadre).
  async function prepararFotoCrop(src){
    // Las fotos recién elegidas del dispositivo ya vienen en el navegador
    // (data: o blob:). No hay que descargarlas ni pedir permiso: se recortan directo.
    if(src.startsWith('data:') || src.startsWith('blob:')){
      return { url: src, puedeRecortar: true };
    }
    try{
      const res = await fetch(src, { mode: 'cors', cache: 'reload' });
      if(!res.ok) throw new Error('respuesta ' + res.status);
      const blob = await res.blob();
      return { url: URL.createObjectURL(blob), puedeRecortar: true };
    }catch(e){
      return { url: src, puedeRecortar: false };
    }
  }

  function cropLayout(){
    const frameRect = cropFrame.getBoundingClientRect();
    const natW = cropImg.naturalWidth, natH = cropImg.naturalHeight;
    if(!natW || !natH || !frameRect.width || !frameRect.height) return;
    const scale = Math.max(frameRect.width / natW, frameRect.height / natH);
    const scaledW = natW * scale, scaledH = natH * scale;
    cropOverflowX = Math.max(0, scaledW - frameRect.width);
    cropOverflowY = Math.max(0, scaledH - frameRect.height);
    cropImg.style.width = scaledW + 'px';
    cropImg.style.height = scaledH + 'px';
    updateCropImgTransform();
  }

  function updateCropImgTransform(){
    const offX = -(cropOverflowX * (cropPosX/100));
    const offY = -(cropOverflowY * (cropPosY/100));
    cropImg.style.transform = 'translate(' + offX + 'px,' + offY + 'px)';
  }

  function cropPointerDown(x, y){
    if(!cropOverflowX && !cropOverflowY) return;
    cropDragging = true;
    cropStartX = x; cropStartY = y;
    cropStartPosX = cropPosX; cropStartPosY = cropPosY;
    cropFrame.classList.add('dragging');
  }
  function cropPointerMove(x, y){
    if(!cropDragging) return;
    const dx = x - cropStartX, dy = y - cropStartY;
    cropPosX = cropOverflowX ? clamp(cropStartPosX - (dx/cropOverflowX*100), 0, 100) : 50;
    cropPosY = cropOverflowY ? clamp(cropStartPosY - (dy/cropOverflowY*100), 0, 100) : 50;
    updateCropImgTransform();
  }
  function cropPointerUp(){
    cropDragging = false;
    cropFrame.classList.remove('dragging');
  }

  cropFrame.addEventListener('mousedown', (e)=>{ e.preventDefault(); cropPointerDown(e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e)=> cropPointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', cropPointerUp);
  cropFrame.addEventListener('touchstart', (e)=>{ const t = e.touches[0]; cropPointerDown(t.clientX, t.clientY); }, {passive:true});
  cropFrame.addEventListener('touchmove', (e)=>{ const t = e.touches[0]; cropPointerMove(t.clientX, t.clientY); }, {passive:true});
  cropFrame.addEventListener('touchend', cropPointerUp);

  function closeCropTool(){
    cropOverlay.classList.remove('show');
    cropImg.onload = null;
    cropImg.onerror = null;
    cropOnSave = null;
    cropOnCropped = null;
    // liberar la foto que quedó en memoria
    if(cropObjectUrl){ URL.revokeObjectURL(cropObjectUrl); cropObjectUrl = null; }
    cropImg.removeAttribute('src');
    cropFreeImg.removeAttribute('src');
  }
  cropCenterBtn.addEventListener('click', ()=>{ cropPosX = 50; cropPosY = 50; updateCropImgTransform(); });
  cropCancelBtn.addEventListener('click', closeCropTool);
  cropClose.addEventListener('click', closeCropTool);
  cropOverlay.addEventListener('click', (e)=>{ if(e.target === cropOverlay) closeCropTool(); });
  cropSaveBtn.addEventListener('click', async ()=>{
    if(cropMode === 'recorte' && cropOnCropped){
      const antes = cropSaveBtn.textContent;
      cropSaveBtn.disabled = true; cropSaveBtn.textContent = 'Recortando...';
      try{
        const url = await aplicarRecorte();
        cropOnCropped(url);
        showToast('Foto recortada ✓');
        closeCropTool();
      }catch(err){
        showToast(err && err.message === 'area-muy-pequena'
          ? 'El área elegida es muy pequeña'
          : 'No se pudo recortar esta foto. Prueba volviendo a subirla.');
      }finally{
        cropSaveBtn.disabled = false; cropSaveBtn.textContent = antes;
      }
      return;
    }
    if(cropOnSave) cropOnSave(cropPosX.toFixed(1) + '% ' + cropPosY.toFixed(1) + '%');
    closeCropTool();
  });

  const qvOverlay = document.getElementById('qvOverlay');
  const qvClose = document.getElementById('qvClose');
  const qvMedia = document.getElementById('qvMedia');
  const qvTrack = document.getElementById('qvTrack');
  const qvPrev = document.getElementById('qvPrev');
  const qvNext = document.getElementById('qvNext');
  const qvDots = document.getElementById('qvDots');
  const qvBody = document.getElementById('qvBody');
  const qvFooter = document.getElementById('qvFooter');

  waFab.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('¡Hola! Escribo desde el catálogo de La Tienda de Meowth.');

  function waLinkFor(p){
    const onSale = p.oldPrice && p.oldPrice > p.price;
    let msg;
    if(p.status === 'vendido'){
      msg = `¡Hola! Vi que "${p.name}" ya se vendió. ¿Sería posible conseguirlo nuevamente?`;
    } else if(p.status === 'preventa'){
      msg = `¡Hola! Vi que "${p.name}" está en preventa. ¿Cómo hago para reservar el mío?`;
    } else if(onSale){
      msg = `¡Hola! Vi que "${p.name}" está en oferta a ${money(p.price)} (antes ${money(p.oldPrice)}). ¿Sigue disponible?`;
    } else {
      msg = `¡Hola! Me interesa este producto del catálogo: "${p.name}" (${money(p.price)}). ¿Sigue disponible?`;
    }
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg);
  }

  function openLightbox(images, startIndex){
    if(!images || !images.length) return;
    lightboxImages = images;
    lightboxIndex = startIndex || 0;
    updateLightbox();
    lightboxOverlay.classList.add('show');
  }

  function updateLightbox(){
    lightboxImg.classList.remove('zoomed');
    lightboxImg.classList.add('lb-entering');
    lightboxImg.src = imgSrc(lightboxImages[lightboxIndex]);
    requestAnimationFrame(()=> requestAnimationFrame(()=> lightboxImg.classList.remove('lb-entering')));
    const multi = lightboxImages.length > 1;
    lightboxPrev.style.display = multi ? 'flex' : 'none';
    lightboxNext.style.display = multi ? 'flex' : 'none';
    lightboxCounter.style.display = multi ? 'block' : 'none';
    lightboxCounter.textContent = (lightboxIndex+1) + ' / ' + lightboxImages.length;
  }

  function closeLightbox(){
    lightboxOverlay.classList.remove('show');
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxImg.addEventListener('click', ()=> lightboxImg.classList.toggle('zoomed'));
  lightboxOverlay.addEventListener('click', (e)=>{ if(e.target === lightboxOverlay) closeLightbox(); });
  lightboxPrev.addEventListener('click', ()=>{ lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length; updateLightbox(); });
  lightboxNext.addEventListener('click', ()=>{ lightboxIndex = (lightboxIndex + 1) % lightboxImages.length; updateLightbox(); });
  document.addEventListener('keydown', (e)=>{
    if(!lightboxOverlay.classList.contains('show')) return;
    if(e.key === 'Escape') closeLightbox();
    if(e.key === 'ArrowLeft') lightboxPrev.click();
    if(e.key === 'ArrowRight') lightboxNext.click();
  });

  let qvImages = [];
  let qvIndex = 0;

  function qvUpdateTrack(){
    qvTrack.style.transform = 'translateX(-' + (qvIndex * 100) + '%)';
    qvDots.querySelectorAll('span').forEach((d,i)=> d.classList.toggle('active', i===qvIndex));
    const counter = document.getElementById('qvCounter');
    if(counter) counter.textContent = (qvIndex+1) + ' / ' + qvImages.length;
  }
  function qvGoTo(i){
    qvIndex = (i + qvImages.length) % qvImages.length;
    qvUpdateTrack();
  }

  // Deslizar fotos en la ficha (dedo o mouse)
  (function(){
    let sx = 0, dx = 0, drag = false;
    function start(x){ if(qvImages.length < 2) return; drag = true; dx = 0; sx = x; qvTrack.style.transition = 'none'; }
    function move(x){ if(!drag) return; dx = x - sx; qvTrack.style.transform = 'translateX(calc(-' + (qvIndex*100) + '% + ' + dx + 'px))'; }
    function end(){
      if(!drag) return; drag = false;
      qvTrack.style.transition = '';
      const threshold = qvTrack.offsetWidth * 0.18;
      if(dx <= -threshold) qvGoTo(qvIndex + 1);
      else if(dx >= threshold) qvGoTo(qvIndex - 1);
      else qvUpdateTrack();
    }
    qvTrack.addEventListener('touchstart', (e)=> start(e.touches[0].clientX), {passive:true});
    qvTrack.addEventListener('touchmove', (e)=> move(e.touches[0].clientX), {passive:true});
    qvTrack.addEventListener('touchend', end);
    qvTrack.addEventListener('mousedown', (e)=>{ e.preventDefault(); start(e.clientX); });
    window.addEventListener('mousemove', (e)=>{ if(drag) move(e.clientX); });
    window.addEventListener('mouseup', end);
  })();

  function openQuickView(p){
    updateSeoForProduct(p);
    history.replaceState(null, '', location.pathname + '?producto=' + encodeURIComponent(p.id));
    const qvScrollEl = document.querySelector('.qv-scroll');
    if(qvScrollEl) qvScrollEl.scrollTop = 0;
    qvImages = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
    qvIndex = 0;
    qvTrack.innerHTML = '';
    qvDots.innerHTML = '';

    if(qvImages.length){
      qvImages.forEach((im, i)=>{
        const img = document.createElement('img');
        img.src = imgSrc(im);
        img.style.objectPosition = imgPos(im);
        img.alt = p.name;
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', ()=> openLightbox(qvImages, i));
        qvTrack.appendChild(img);
      });
      qvImages.forEach((_,i)=>{
        const d = document.createElement('span');
        if(i===0) d.classList.add('active');
        d.addEventListener('click', ()=> qvGoTo(i));
        qvDots.appendChild(d);
      });
    } else {
      const ph = document.createElement('div');
      ph.className = 'card-img placeholder';
      ph.style.width = '100%'; ph.style.height = '100%';
      ph.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.7"/><path d="M21 15l-5-5L5 21"/></svg>';
      qvTrack.appendChild(ph);
    }
    qvUpdateTrack();
    qvPrev.style.display = qvImages.length > 1 ? 'flex' : 'none';
    qvNext.style.display = qvImages.length > 1 ? 'flex' : 'none';
    qvDots.style.display = qvImages.length > 1 ? 'flex' : 'none';
    if(qvImages.length > 1 && !localStorage.getItem('sawSwipeHint')){
      const hint = document.createElement('div');
      hint.className = 'qv-swipe-hint';
      hint.textContent = 'Desliza para ver más fotos';
      qvMedia.appendChild(hint);
      setTimeout(()=>{ hint.remove(); localStorage.setItem('sawSwipeHint', '1'); }, 2200);
    }
    const counterEl = document.getElementById('qvCounter');
    if(counterEl) counterEl.style.display = qvImages.length > 1 ? 'block' : 'none';

    qvBody.innerHTML = '';
    const tags = document.createElement('div');
    tags.className = 'qv-tags';
    const statusTag = document.createElement('span');
    statusTag.className = 'badge inline ' + p.status;
    statusTag.textContent = stateLabel(p.status);
    tags.appendChild(statusTag);
    const catTag = document.createElement('span');
    catTag.className = 'badge-category inline';
    catTag.textContent = categoryLabel(p.category);
    tags.appendChild(catTag);
    if(Date.now() - p.createdAt < 7*24*60*60*1000){
      const nt = document.createElement('span');
      nt.className = 'badge inline';
      nt.style.background = 'var(--gold)'; nt.style.color = 'var(--ink)';
      nt.textContent = 'Nuevo';
      tags.appendChild(nt);
    }
    qvBody.appendChild(tags);

    const name = document.createElement('div');
    name.className = 'qv-name';
    name.textContent = p.name;
    qvBody.appendChild(name);

    if(p.desc){
      const desc = document.createElement('div');
      desc.className = 'qv-desc';
      desc.textContent = p.desc;
      qvBody.appendChild(desc);
    }

    // Banda de reserva destacada (solo para preventas).
    // El monto es editable por producto (p.reserva); si no hay, usa 50 por defecto.
    if(p.status === 'preventa'){
      const montoRsv = (p.reserva != null && p.reserva !== '') ? p.reserva : 50;
      const rsv = document.createElement('div');
      rsv.className = 'qv-reserva';
      rsv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        '<span><b>Resérvalo con ' + money(montoRsv) + '</b> y paga el resto cuando llegue tu producto.</span>';
      qvBody.appendChild(rsv);
    }

    const ytId = extractYouTubeId(p.youtubeUrl);
    if(ytId){
      const videoWrap = document.createElement('div');
      videoWrap.className = 'qv-video';
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'qv-video-thumb';
      thumb.setAttribute('aria-label', 'Reproducir video');
      thumb.style.backgroundImage = "url('https://img.youtube.com/vi/" + ytId + "/hqdefault.jpg')";
      thumb.innerHTML = '<span class="qv-video-play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg></span>';
      thumb.addEventListener('click', ()=>{
        const iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube.com/embed/' + ytId + '?autoplay=1';
        iframe.className = 'qv-video-iframe';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.title = 'Video de ' + p.name;
        videoWrap.innerHTML = '';
        videoWrap.appendChild(iframe);
      });
      videoWrap.appendChild(thumb);
      qvBody.appendChild(videoWrap);
    }

    qvFooter.innerHTML = '';
    const hasVariants = Array.isArray(p.variants) && p.variants.length;
    const qvSelectedVariantIds = new Set();
    let wantsFullLot = false;
    let renderLotWrap = null;
    if(hasVariants){
      const firstAvail = p.variants.find(v=>!v.sold);
      if(firstAvail) qvSelectedVariantIds.add(firstAvail.id);
    }
    function getSelectedVariants(){
      return hasVariants ? p.variants.filter(v=> qvSelectedVariantIds.has(v.id)) : [];
    }
    if(hasVariants){
      const varHint = document.createElement('div');
      varHint.className = 'variant-select-hint';
      varHint.textContent = 'Elige una o varias piezas:';
      qvBody.appendChild(varHint);
      const varList = document.createElement('div');
      varList.className = 'variant-select-list';
      function renderVarList(){
        varList.innerHTML = '';
        p.variants.forEach(v=>{
          const checked = qvSelectedVariantIds.has(v.id);
          const row = document.createElement('div');
          row.className = 'variant-select-row' + (v.sold ? ' sold' : '') + (checked ? ' selected' : '');
          row.innerHTML = '<div class="variant-select-check">' + (checked ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>' : '') + '</div>' +
            '<div class="variant-select-info"><div class="variant-select-name">' + v.name + '</div>' +
            (v.note ? '<div class="variant-select-note">' + v.note + '</div>' : '') + '</div>' +
            '<div class="variant-select-price">' + money(v.price) + '</div>';
          if(!v.sold) row.addEventListener('click', ()=>{
            wantsFullLot = false;
            if(qvSelectedVariantIds.has(v.id)) qvSelectedVariantIds.delete(v.id);
            else qvSelectedVariantIds.add(v.id);
            renderVarList(); if(renderLotWrap) renderLotWrap(); updateVariantFooter();
          });
          if(isAdmin){
            const soldBtn = document.createElement('button');
            soldBtn.type = 'button';
            soldBtn.className = 'variant-sold-toggle' + (v.sold ? ' active' : '');
            soldBtn.title = v.sold ? 'Marcar como disponible' : 'Marcar como vendida';
            soldBtn.textContent = v.sold ? 'Vendida ✓' : 'Marcar vendida';
            soldBtn.addEventListener('click', async (e)=>{
              e.stopPropagation();
              v.sold = !v.sold;
              if(v.sold) qvSelectedVariantIds.delete(v.id);
              renderVarList(); updateVariantFooter(); render(true);
              try{ await window.fbSaveProduct(p); publicarCatalogo(); }catch(err){ showToast('No se pudo guardar.'); }
            });
            row.appendChild(soldBtn);
          }
          varList.appendChild(row);
        });
      }
      renderVarList();
      qvBody.appendChild(varList);
      if(p.lotPrice){
        const lotWrap = document.createElement('div');
        lotWrap.className = 'qv-lot-price';
        lotWrap.tabIndex = 0;
        lotWrap.setAttribute('role', 'button');
        renderLotWrap = function(){
          lotWrap.classList.toggle('selected', wantsFullLot);
          lotWrap.innerHTML = '<div class="qv-lot-check">' + (wantsFullLot ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>' : '') + '</div>' +
            '<span><b>Llévate el lote completo por ' + money(p.lotPrice) + '</b> en vez de comprar cada pieza por separado.</span>';
        }
        renderLotWrap();
        lotWrap.addEventListener('click', ()=>{
          wantsFullLot = !wantsFullLot;
          if(wantsFullLot) qvSelectedVariantIds.clear();
          renderVarList(); renderLotWrap(); updateVariantFooter();
        });
        qvBody.appendChild(lotWrap);
      }
    }

    // Productos relacionados: "Completa tu colección".
    // Primero los que el dueño eligió a mano; el resto se completa solo,
    // priorizando coincidencias de palabras del título y luego la misma categoría.
    // Se muestra DESPUÉS de la lista de figuras/variantes en productos "mix".
    const related = (function(){
      const TOPE = 10;
      const disponibles = products.filter(x => x.id !== p.id && x.status !== 'vendido');
      const elegidos = (Array.isArray(p.related) ? p.related : [])
        .map(id => disponibles.find(x => x.id === id))
        .filter(Boolean);

      const yaEsta = new Set(elegidos.map(x => x.id));
      if(elegidos.length >= TOPE) return elegidos.slice(0, TOPE);

      // Palabras significativas del título (ignora artículos y palabras muy cortas).
      const IGNORAR = new Set(['de','del','la','el','los','las','un','una','con','para','por','y','en','set','edicion','edición']);
      const palabras = (txt)=> normSearch(txt).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !IGNORAR.has(w));
      const propias = palabras(p.name || '');
      const cat = p.category || 'otros';

      const puntaje = (x)=>{
        const suyas = palabras(x.name || '');
        const comunes = propias.filter(w => suyas.includes(w)).length;
        return comunes * 10 + ((x.category || 'otros') === cat ? 3 : 0);
      };

      const automaticos = disponibles
        .filter(x => !yaEsta.has(x.id))
        .map(x => ({ x, s: puntaje(x) }))
        .filter(o => o.s > 0)
        .sort((a, b) => b.s - a.s)
        .map(o => o.x);

      return elegidos.concat(automaticos).slice(0, TOPE);
    })();
    if(related.length){
      const relWrap = document.createElement('div');
      relWrap.className = 'qv-related';
      const relTitle = document.createElement('div');
      relTitle.className = 'qv-related-title';
      relTitle.textContent = 'Completa tu colección';
      relWrap.appendChild(relTitle);
      const relRow = document.createElement('div');
      relRow.className = 'qv-related-row';
      related.forEach(rp => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'qv-related-item';
        const thumb = document.createElement('div');
        thumb.className = 'qv-related-thumb';
        const imgs = (rp.images && rp.images.length) ? rp.images : (rp.image ? [rp.image] : []);
        if(imgs.length){
          const im = document.createElement('img');
          im.src = imgSrc(imgs[0]);
          im.style.objectPosition = imgPos(imgs[0]);
          im.alt = rp.name;
          thumb.appendChild(im);
        } else {
          thumb.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--cream-dim)"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.7"/><path d="M21 15l-5-5L5 21"/></svg>';
        }
        const nm = document.createElement('div');
        nm.className = 'qv-related-name';
        nm.textContent = rp.name;
        const pr = document.createElement('div');
        pr.className = 'qv-related-price';
        pr.textContent = money(rp.price);
        item.appendChild(thumb); item.appendChild(nm); item.appendChild(pr);
        item.addEventListener('click', ()=> openQuickView(rp));
        relRow.appendChild(item);
      });
      relWrap.appendChild(relRow);
      qvBody.appendChild(relWrap);
    }
    const priceWrap = document.createElement('div');
    priceWrap.className = 'qv-price';
    function updateVariantFooter(){
      if(!hasVariants) return;
      const sel = getSelectedVariants();
      if(wantsFullLot){
        nowS.textContent = money(p.lotPrice) + ' · lote completo';
        wa.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(
          '¡Hola! Quiero el lote completo "' + p.name + '" por ' + money(p.lotPrice) + '. ¿Sigue disponible?');
      } else if(!sel.length){
        const priceSource = p.variants.filter(v=>!v.sold).length ? p.variants.filter(v=>!v.sold) : p.variants;
        nowS.textContent = 'Desde ' + money(Math.min(...priceSource.map(v=>v.price)));
        wa.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(
          '¡Hola! Me interesa el lote "' + p.name + '". ¿Qué piezas tienes disponibles?');
      } else if(sel.length === 1){
        nowS.textContent = money(sel[0].price);
        wa.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(
          '¡Hola! Me interesa "' + sel[0].name + '" del lote "' + p.name + '" (' + money(sel[0].price) + '). ¿Sigue disponible?');
      } else {
        const total = sel.reduce((s,v)=> s + v.price, 0);
        nowS.textContent = money(total) + ' · ' + sel.length + ' piezas';
        const lista = sel.map(v=> v.name + ' (' + money(v.price) + ')').join(', ');
        wa.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(
          '¡Hola! Me interesan estas piezas del lote "' + p.name + '": ' + lista + '. ¿Siguen disponibles?');
      }
    }
    const hasDiscount = p.oldPrice && p.oldPrice > p.price;
    if(hasDiscount){
      const oldS = document.createElement('span');
      oldS.className = 'old';
      oldS.textContent = money(p.oldPrice);
      priceWrap.appendChild(oldS);
    }
    const nowS = document.createElement('span');
    nowS.className = 'now' + (hasDiscount ? ' sale' : '');
    nowS.textContent = money(p.price);
    if(p.status === 'vendido'){ nowS.style.textDecoration = 'line-through'; nowS.style.color = 'var(--cream-dim)'; }
    priceWrap.appendChild(nowS);
    qvFooter.appendChild(priceWrap);

    const isSold = p.status === 'vendido';

    // Carrito y WhatsApp al MISMO nivel (ambos importan igual). Compartir compacto al lado.
    const actions = document.createElement('div');
    actions.className = 'qv-cta-row';

    if(!isSold && !hasVariants){
      let qvQty = 1;
      if(p.allowQuantity){
        const qtyStepper = document.createElement('div');
        qtyStepper.className = 'qv-qty-stepper';
        const minus = document.createElement('button');
        minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Menos');
        const num = document.createElement('span');
        num.className = 'qv-qty-num'; num.textContent = qvQty;
        const plus = document.createElement('button');
        plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Más');
        minus.addEventListener('click', ()=>{ qvQty = Math.max(1, qvQty - 1); num.textContent = qvQty; });
        plus.addEventListener('click', ()=>{ qvQty = Math.min(99, qvQty + 1); num.textContent = qvQty; });
        qtyStepper.appendChild(minus); qtyStepper.appendChild(num); qtyStepper.appendChild(plus);
        actions.appendChild(qtyStepper);
      }
      const cartBtn = document.createElement('button');
      cartBtn.type = 'button';
      cartBtn.className = 'qv-cta-cart';
      cartBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 8H6.2"/><circle cx="9.5" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none"/></svg><span>Agregar</span>';
      cartBtn.addEventListener('click', ()=>{
        addToInquiryList(p.id, qvQty);
        cartBtn.classList.remove('cart-btn-bump'); void cartBtn.offsetWidth; cartBtn.classList.add('cart-btn-bump');
      });
      actions.appendChild(cartBtn);
    } else if(!isSold && hasVariants){
      const cartBtn = document.createElement('button');
      cartBtn.type = 'button';
      cartBtn.className = 'qv-cta-cart';
      cartBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 8H6.2"/><circle cx="9.5" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none"/></svg><span>Agregar</span>';
      cartBtn.addEventListener('click', ()=>{
        if(wantsFullLot){
          addToInquiryList(p.id, 1, { id: 'lote-completo', name: 'Lote completo', price: p.lotPrice });
          cartBtn.classList.remove('cart-btn-bump'); void cartBtn.offsetWidth; cartBtn.classList.add('cart-btn-bump');
          return;
        }
        const sel = getSelectedVariants();
        if(!sel.length){ showToast('Selecciona al menos una pieza'); return; }
        sel.forEach(v=> addToInquiryList(p.id, 1, { id: v.id, name: v.name, price: v.price }));
        cartBtn.classList.remove('cart-btn-bump'); void cartBtn.offsetWidth; cartBtn.classList.add('cart-btn-bump');
      });
      actions.appendChild(cartBtn);
    }

    const wa = document.createElement('a');
    wa.className = 'qv-cta-wa';
    wa.href = waLinkFor(p);
    wa.target = '_blank'; wa.rel = 'noopener';
    wa.title = isSold ? '¿Lo consigues de nuevo?' : 'Escribir por WhatsApp';
    wa.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L4 20l1.2-4.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.5 10.3c.2 2.2 2 4 4.2 4.2" stroke-linecap="round"/></svg><span>WhatsApp</span>';
    actions.appendChild(wa);
    updateVariantFooter();

    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'qv-share-btn';
    shareBtn.title = 'Compartir este producto';
    shareBtn.setAttribute('aria-label', 'Compartir este producto');
    shareBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
    shareBtn.addEventListener('click', ()=> shareProduct(p));
    actions.appendChild(shareBtn);

    qvFooter.appendChild(actions);

    qvOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function fallbackCopy(str){
    try{
      const ta = document.createElement('textarea');
      ta.value = str;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }catch(e){ return false; }
  }

  // Copia el nombre + link del producto al portapapeles. Se usa al escribir por
  // Instagram, donde no se puede enviar un mensaje pre-armado como en WhatsApp.
  // Convierte "pikachu, kanto" en ['pikachu','kanto'] (sin vacíos ni duplicados).
  function parseTags(txt){
    return Array.from(new Set(
      (txt || '').split(',').map(t => t.trim()).filter(Boolean)
    ));
  }

  function copyProductLink(p){
    const url = location.pathname + '?producto=' + encodeURIComponent(p.id);
    const txt = p.name + ' — ' + money(p.price) + '\n' + url;
    const aviso = ()=> showToast('Link copiado ✓ pégalo en tu mensaje');
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(aviso, ()=>{ if(fallbackCopy(txt)) aviso(); });
      return;
    }
    if(fallbackCopy(txt)) aviso();
  }

  function shareProduct(p){
    const priceTxt = (p.oldPrice && p.oldPrice > p.price)
      ? `${money(p.price)} (antes ${money(p.oldPrice)})`
      : money(p.price);
    const url = location.pathname + '?producto=' + encodeURIComponent(p.id);
    const text = `${p.name} — ${priceTxt}\nMíralo en el catálogo de La Tienda de Meowth 🐱`;
    const full = text + '\n' + url;

    if(navigator.share){
      navigator.share({title: p.name, text, url})
        .catch(()=>{ /* el usuario canceló, no hacer nada */ });
      return;
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(full).then(
        ()=> showToast('Copiado ✓ ya puedes pegarlo donde quieras'),
        ()=> { if(fallbackCopy(full)) showToast('Copiado ✓ ya puedes pegarlo donde quieras'); else showToast('Copia manual: ' + p.name); }
      );
      return;
    }
    if(fallbackCopy(full)) showToast('Copiado ✓ ya puedes pegarlo donde quieras');
    else showToast('No se pudo compartir en este navegador');
  }

  const DEFAULT_META = {
    title: 'La Tienda de Meowth · Catálogo de Pokémon Center Japón en Perú',
    desc: 'Primera tienda especializada en Pokémon del Perú desde 2007. Figuras, peluches y TCG 100% originales, importados de Japón.',
    ogTitle: 'La Tienda de Meowth · Catálogo',
    ogDesc: 'La primera tienda especializada en Pokémon del Perú desde 2007, de coleccionista para coleccionistas.',
    image: 'https://tiendapoke.com/logo.png',
    url: 'https://tiendapoke.com/'
  };
  function setMetaAttr(id, attr, value){
    const el = document.getElementById(id);
    if(el) el.setAttribute(attr, value);
  }
  function updateSeoForProduct(p){
    const ld = document.getElementById('productJsonLd');
    if(!p){
      document.title = DEFAULT_META.title;
      setMetaAttr('metaDesc','content',DEFAULT_META.desc);
      setMetaAttr('metaCanonical','href',DEFAULT_META.url);
      setMetaAttr('metaOgUrl','content',DEFAULT_META.url);
      setMetaAttr('metaOgType','content','website');
      setMetaAttr('metaOgTitle','content',DEFAULT_META.ogTitle);
      setMetaAttr('metaOgDesc','content',DEFAULT_META.ogDesc);
      setMetaAttr('metaOgImage','content',DEFAULT_META.image);
      setMetaAttr('metaTwTitle','content',DEFAULT_META.ogTitle);
      setMetaAttr('metaTwDesc','content',DEFAULT_META.ogDesc);
      if(ld) ld.textContent = '';
      return;
    }
    const title = p.name + ' · La Tienda de Meowth';
    const desc = (p.desc || ('Disponible en La Tienda de Meowth: ' + p.name + '.')).slice(0,160);
    const url = 'https://tiendapoke.com/?producto=' + encodeURIComponent(p.id);
    const img = (p.images && p.images.length) ? imgSrc(p.images[0]) : DEFAULT_META.image;
    document.title = title;
    setMetaAttr('metaDesc','content',desc);
    setMetaAttr('metaCanonical','href',url);
    setMetaAttr('metaOgUrl','content',url);
    setMetaAttr('metaOgType','content','product');
    setMetaAttr('metaOgTitle','content',title);
    setMetaAttr('metaOgDesc','content',desc);
    setMetaAttr('metaOgImage','content',img);
    setMetaAttr('metaTwTitle','content',title);
    setMetaAttr('metaTwDesc','content',desc);
    if(ld){
      ld.textContent = JSON.stringify({
        '@context':'https://schema.org', '@type':'Product',
        name: p.name, description: desc, image: img, url,
        offers: {
          '@type':'Offer', priceCurrency:'PEN', price: p.price,
          availability: p.status === 'vendido' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock'
        }
      });
    }
  }

  function closeQuickView(){
    qvOverlay.classList.remove('show');
    document.body.style.overflow = '';
    updateSeoForProduct(null);
    history.replaceState(null, '', location.pathname);
  }
  qvClose.addEventListener('click', closeQuickView);

  // Deslizar hacia abajo desde el "handle" para cerrar la ficha (gesto nativo en celular).
  (function(){
    const handle = document.querySelector('.qv-handle');
    if(!handle) return;
    let startY = 0, dy = 0, dragging = false;
    const qvSheet = document.getElementById('qvSheet');
    if(!qvSheet) return;
    function start(y){ dragging = true; startY = y; dy = 0; qvSheet.style.transition = 'none'; }
    function move(y){
      if(!dragging) return;
      dy = Math.max(0, y - startY);
      qvSheet.style.transform = 'translateY(' + dy + 'px)';
    }
    function end(){
      if(!dragging) return;
      dragging = false;
      qvSheet.style.transition = '';
      if(dy > 90){ qvSheet.style.transform = ''; closeQuickView(); }
      else qvSheet.style.transform = '';
    }
    handle.addEventListener('touchstart', (e)=> start(e.touches[0].clientY), {passive:true});
    handle.addEventListener('touchmove', (e)=> move(e.touches[0].clientY), {passive:true});
    handle.addEventListener('touchend', end);
  })();
  qvOverlay.addEventListener('click', (e)=>{ if(e.target === qvOverlay) closeQuickView(); });
  qvPrev.addEventListener('click', ()=> qvGoTo(qvIndex - 1));
  qvNext.addEventListener('click', ()=> qvGoTo(qvIndex + 1));
  document.addEventListener('keydown', (e)=>{
    if(!qvOverlay.classList.contains('show')) return;
    if(e.key === 'Escape') closeQuickView();
    if(e.key === 'ArrowLeft') qvGoTo(qvIndex - 1);
    if(e.key === 'ArrowRight') qvGoTo(qvIndex + 1);
  });

  function showToast(msg){
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toast.classList.remove('show'), 2400);
  }

  // ---------- storage helpers ----------
  function sampleProducts(){
    const now = Date.now();
    return [
      {
        id: 'p_sample_1', name: 'Pikachu Poké Plush 20cm',
        price: 129.00,
        desc: 'Ejemplo — Peluche oficial Pokémon Center Japón, edición Poké Plush. Reemplaza esta tarjeta con tu producto real.',
        status: 'disponible', category: 'peluches', images: [], createdAt: now - 4000
      },
      {
        id: 'p_sample_2', name: 'Set de pines Eevee Evoluciones',
        price: 189.00,
        desc: 'Ejemplo — Set exclusivo importado de Japón, edición limitada. Reemplaza esta tarjeta con tu producto real.',
        status: 'preventa', category: 'otros', images: [], createdAt: now - 3000
      },
      {
        id: 'p_sample_3', name: 'Figura Charizard Ho-Oh Premium',
        price: 349.00,
        desc: 'Ejemplo — Pieza de colección, rarezas Pokémon Center. Reemplaza esta tarjeta con tu producto real.',
        status: 'disponible', category: 'figuras', images: [], createdAt: now - 2000
      },
      {
        id: 'p_sample_4', name: 'Peluche Meowth Fit Collection',
        price: 99.00,
        desc: 'Ejemplo — Última unidad, ya tiene dueño. Reemplaza esta tarjeta con tu producto real.',
        status: 'vendido', category: 'peluches', images: [], createdAt: now - 1000
      }
    ];
  }

  const CACHE_KEY = 'catalogo-cache-v1';
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min: evita repetir la lectura del catálogo publicado en cada visita

  function renderGridSkeletons(){
    if(!grid) return;
    grid.innerHTML = '';
    for(let i=0;i<8;i++){
      const sk = document.createElement('div');
      sk.className = 'card card-skeleton';
      sk.innerHTML = '<div class="card-skeleton-img"></div><div class="card-skeleton-line" style="width:75%"></div><div class="card-skeleton-line" style="width:40%"></div>';
      grid.appendChild(sk);
    }
  }

  async function loadProducts(retriesLeft){
    if(retriesLeft === undefined) retriesLeft = 2;
    // --- 1) Camino rápido para el cliente: catálogo publicado ---
    // Son 3 o 4 lecturas en vez de una por producto. Si el caché local es
    // reciente (menos de CACHE_TTL_MS), ni siquiera se consulta Firebase:
    // se usa la copia guardada tal cual, ahorrando esas lecturas.
    if(!isAdmin){
      let mostroCache = false;
      try{
        const guardadoPrevio = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if(guardadoPrevio && guardadoPrevio.productos && guardadoPrevio.productos.length){
          // Muestra la caché al instante aunque esté vencida (evita la pantalla vacía);
          // si está vencida seguimos abajo a refrescarla en silencio contra Firebase.
          products = guardadoPrevio.productos;
          if(loadingState) loadingState.style.display = 'none';
          render();
          abrirProductoCompartido();
          mostroCache = true;
          if(guardadoPrevio.cachedAt && (Date.now() - guardadoPrevio.cachedAt < CACHE_TTL_MS)) return;
        }
      }catch(e){ /* caché corrupto o inaccesible: seguimos por el camino normal */ }
      if(!mostroCache) renderGridSkeletons();
      try{
        const publicado = await window.fbLoadCatalog();
        if(publicado && publicado.productos.length){
          let lista = publicado.productos;
          try{
            const guardado = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if(guardado && guardado.version === publicado.version) lista = guardado.productos;
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ...publicado, productos: lista, cachedAt: Date.now() }));
          }catch(e){ /* sin espacio o modo privado: seguimos sin caché */ }

          products = lista;
          if(loadingState) loadingState.style.display = 'none';
          render();
          abrirProductoCompartido();
          return;
        }
      }catch(e){
        // Arranque en frío: justo tras "firebase-ready" a veces la primera
        // lectura falla. Reintenta en silencio antes de caer al camino lento.
        if(retriesLeft > 0){
          await new Promise(r=> setTimeout(r, 900));
          return loadProducts(retriesLeft - 1);
        }
      }
    }

    // --- 2) Camino completo: producto por producto (admin o primera vez) ---
    let fromNewCollection = await window.fbLoadAllProducts();
    if(fromNewCollection === null && retriesLeft > 0){
      await new Promise(r=> setTimeout(r, 900));
      return loadProducts(retriesLeft - 1);
    }

    if(fromNewCollection === null){
      // Fallo real de conexión: probamos con el formato viejo como último recurso,
      // para no dejar la tienda vacía si algo falla con la colección nueva.
      try{
        const res = await window.storage.get(STORAGE_KEY, true);
        products = res ? JSON.parse(res.value) : [];
      }catch(e){
        products = [];
      }
    } else if(fromNewCollection.length > 0){
      // Ya migrado antes: uso la colección nueva tal cual.
      products = fromNewCollection;
    } else {
      // Colección nueva vacía: puede ser una tienda nueva, o una tienda con
      // datos todavía en el formato viejo (un solo documento) que hay que migrar.
      let legacyProducts = [];
      try{
        const res = await window.storage.get(STORAGE_KEY, true);
        legacyProducts = res ? JSON.parse(res.value) : [];
      }catch(e){
        legacyProducts = [];
      }

      if(legacyProducts.length > 0){
        // Migración de una sola vez: copiamos cada producto a su propio documento.
        try{
          await window.fbSaveProductsBatch(legacyProducts);
        }catch(e){
          console.error('Error migrando productos al formato nuevo', e);
        }
        products = legacyProducts;
      } else {
        let seeded = false;
        try{
          const flag = await window.storage.get('seeded', true);
          seeded = !!flag;
        }catch(e){ seeded = false; }
        if(!seeded){
          products = sampleProducts();
          try{
            await window.fbSaveProductsBatch(products);
            await window.storage.set('seeded', 'true', true);
          }catch(e){ console.error('Error creando productos de muestra', e); }
        } else {
          products = [];
        }
      }
    }

    if(loadingState) loadingState.style.display = 'none';
    render();

    abrirProductoCompartido();
  }

  // Si alguien abrió un link compartido de un producto, se lo mostramos directo.
  function abrirProductoCompartido(){
    const q = new URLSearchParams(location.search).get('producto');
    const hashMatch = location.hash.match(/^#producto=(.+)$/);
    const sharedId = q ? decodeURIComponent(q) : (hashMatch ? decodeURIComponent(hashMatch[1]) : null);
    if(!sharedId) return;
    const sharedProduct = products.find(p=> p.id === sharedId);
    if(sharedProduct) openQuickView(sharedProduct);
    else history.replaceState(null, '', location.pathname);
  }

  // Al entrar al panel se leen los productos desde su fuente real (uno por uno)
  // y se republica el catálogo, para trabajar siempre sobre lo más reciente.
  async function recargarComoAdmin(){
    try{
      const lista = await window.fbLoadAllProducts();
      if(Array.isArray(lista) && lista.length){
        products = lista;
        render();
        publicarCatalogo();
      }
    }catch(e){ console.error('No se pudo recargar como admin', e); }
  }

  // Republica el catálogo que ve la tienda. Se llama tras cualquier cambio del admin.
  let publicarTimer = null;
  function publicarCatalogo(){
    clearTimeout(publicarTimer);
    publicarTimer = setTimeout(async ()=>{
      try{ await window.fbPublishCatalog(products); }
      catch(e){ console.error('No se pudo publicar el catálogo', e); }
    }, 1200);
  }

  // Guarda TODOS los productos actuales de una vez (para restaurar respaldo, por ejemplo).
  // Si se le pasa la lista de IDs que había antes, borra los que ya no están.
  async function saveProducts(previousIds){
    try{
      await window.fbSaveProductsBatch(products);
      publicarCatalogo();
      if(previousIds){
        const currentIds = new Set(products.map(p=>p.id));
        const removed = previousIds.filter(id=> !currentIds.has(id));
        if(removed.length) await window.fbDeleteProductsBatch(removed);
      }
    }catch(e){
      showToast('No se pudo guardar. Intenta de nuevo.');
    }
  }

  const BANNER_KEY = 'banner-slides';

  async function loadBannerSlides(){
    try{
      const res = await window.storage.get(BANNER_KEY, true);
      bannerSlides = res ? JSON.parse(res.value) : [];
    }catch(e){
      bannerSlides = [];
    }
    renderBanner();
  }

  async function saveBannerSlides(){
    try{
      await window.storage.set(BANNER_KEY, JSON.stringify(bannerSlides), true);
    }catch(e){
      showToast('No se pudo guardar el banner. Intenta de nuevo.');
    }
  }

  // ---------- textos editables: Quiénes somos / Cómo comprar ----------
  const CONTENT_KEY = 'site-content';
  const DEFAULT_SITE_CONTENT = {
    quienes: {
      foto: null,
      parrafos: [
        'La Tienda de Meowth nació en 2007 como la primera tienda especializada en Pokémon del Perú, de un coleccionista para otros coleccionistas: cada figura, peluche y carta que ves aquí fue escogida y revisada personalmente antes de llegar a ti. Todo 100% original, importado de Japón y del resto del mundo.',
        'Compartimos esta emoción: elegir algo, esperar a que llegue y por fin tenerlo. Sé que no es solo "una figura nueva": es el resultado de tu esfuerzo. Es tu felicidad, y la cuido como si fuera la mía.',
        'Por eso mi meta es simple: que estés contento en cada compra. Más de 18 años lo respaldan, y siempre estaré agradecido por la confianza que me das.'
      ],
      stats: [
        { num: '18+', label: 'Años de trayectoria' },
        { num: '20 mil+', label: 'Coleccionistas en nuestra comunidad' }
      ]
    },
    comprar: {
      tituloSeccion: '¡Compra fácil en 1, 2, 3!',
      pasos: [
        { titulo: 'Elige tu producto', desc: 'Explora el catálogo y encuentra la figura, peluche o carta que buscas; si no la ves, podemos conseguirla o si necesitas ayuda para elegir, te asesoramos.' },
        { titulo: 'Escríbeme y coordinamos todo', desc: 'Contáctame por mis redes o WhatsApp. Confirmamos disponibilidad y coordinamos el envío a tu medida.' },
        { titulo: 'Recibe tu pedido y disfrútalo', desc: 'Envío a nivel nacional, entrega en moto o recojo presencial en almacén o ciertos puntos.' }
      ],
      pagos: [
        { eyebrow: 'Pensado para coleccionistas', titulo: 'Mi meta es *tu felicidad*.', desc: 'Sé lo que es querer una pieza y no poder llevarla en ese momento. Por eso te ofrezco una experiencia que solo busca tu satisfacción.', image: null, icon: 'gema', badges: [] }
      ]
    },
    categoryIcons: { quienes: null, comprar: null, figuras: null, peluches: null, tcg: null, gaming: null, accesorios: null, hogar: null, otros: null },
    sounds: { quienes: null, comprar: null },
    resenas: [],
    seo: {
      titulo: 'La Tienda de Meowth · Catálogo de Pokémon Center Japón en Perú',
      descripcion: 'Primera tienda especializada en Pokémon del Perú desde 2007. Figuras, peluches y TCG 100% originales, importados de Japón.'
    },
    titles: {
      novedades: '¡Nuevos ingresos!',
      ofertas: '¡Ofertas por tiempo limitado!',
      preventas: '¡Preventas!',
      catalogo: 'Catálogo',
      resenas: 'Lo que dicen nuestros coleccionistas',
      quienes: 'Quién soy'
    },
    /* Mosaicos de categoría (Novedades / Ofertas / Preventas).
       modo 'auto' arma la imagen con las últimas 4 fotos; 'banner' usa una imagen propia. */
    mosaicos: {
      novedades: { activo: true,  modo: 'auto', banner: null, eyebrow: 'Recién llegados',      titulo: 'Novedades' },
      ofertas:   { activo: true,  modo: 'auto', banner: null, eyebrow: 'Por tiempo limitado',  titulo: 'Ofertas' },
      preventas: { activo: true,  modo: 'auto', banner: null, eyebrow: 'Asegura el tuyo',       titulo: 'Preventas' },
      mix:       { activo: true,  modo: 'auto', banner: null, eyebrow: 'Completa tu cole',      titulo: 'Sueltos' }
    },
    mosaicoOrden: ['novedades','ofertas','preventas','mix'],
    /* Fotos del viaje a Japón en "Quiénes somos". Cada una: { url, pie }. */
    japon: [],
    /* Textos del pie de página. */
    footer: {
      titulo: '¡Únete a la comunidad!',
      subtitulo: 'Síguenos para nuevos ingresos, preventas, ofertas y más.'
    },
    /* Cinta deslizante de confianza, arriba del header. */
    ticker: [
      'Envíos a todo el Perú',
      'Productos 100% originales',
      'Reserva pagando una parte',
      'Asesoría personalizada'
    ],
    /* Logos por modo. null = usar /logo.png por defecto. */
    logos: { claro: null, oscuro: null },
    /* Íconos del botón día/noche. null = usar el sol/luna por defecto. */
    iconos: { sol: null, luna: null, basura: null }
  };
  function cloneDefaultContent(){
    return JSON.parse(JSON.stringify(DEFAULT_SITE_CONTENT));
  }
  let siteContent = cloneDefaultContent();

  const SITE_CONTENT_CACHE_KEY = 'site-content-cache-v1';
  async function loadSiteContent(retriesLeft){
    if(retriesLeft === undefined) retriesLeft = 2;
    try{
      const guardado = JSON.parse(localStorage.getItem(SITE_CONTENT_CACHE_KEY) || 'null');
      if(!isAdmin && guardado && guardado.cachedAt && (Date.now() - guardado.cachedAt < CACHE_TTL_MS)){
        siteContent = Object.assign(cloneDefaultContent(), guardado.value);
        renderSiteContent();
        return;
      }
    }catch(e){ /* seguimos por el camino normal */ }
    try{
      const res = await window.storage.get(CONTENT_KEY, true);
      if(res && res.value){
        const loaded = JSON.parse(res.value);
        // combina con los valores por defecto por si falta algún campo nuevo
        siteContent = Object.assign(cloneDefaultContent(), loaded);
        try{ localStorage.setItem(SITE_CONTENT_CACHE_KEY, JSON.stringify({ value: loaded, cachedAt: Date.now() })); }catch(e){}
      }
    }catch(e){
      if(retriesLeft > 0){
        await new Promise(r=> setTimeout(r, 900));
        return loadSiteContent(retriesLeft - 1);
      }
      siteContent = cloneDefaultContent();
    }
    renderSiteContent();
  }


  // ---- edición de mosaicos en el panel ----
  const mosBannerPend = { novedades:'_keep', ofertas:'_keep', preventas:'_keep' };
  // '_keep' = no tocar; null = quitar; string = nueva url

  function leerMosaico(clave, idActivo, idEyebrow, idTitulo){
    const actual = (siteContent.mosaicos && siteContent.mosaicos[clave]) || {};
    let banner = actual.banner || null;
    let modo = actual.modo || 'auto';
    if(mosBannerPend[clave] === null){ banner = null; modo = 'auto'; }
    else if(mosBannerPend[clave] !== '_keep'){ banner = mosBannerPend[clave]; modo = 'banner'; }
    return {
      activo: document.getElementById(idActivo).checked,
      modo: modo,
      banner: banner,
      eyebrow: (document.getElementById(idEyebrow).value || '').trim(),
      titulo: (document.getElementById(idTitulo).value || '').trim()
    };
  }

  // subir imagen propia de un mosaico
  function conectarMosFile(clave, idFile, idClear){
    const file = document.getElementById(idFile);
    const clear = document.getElementById(idClear);
    if(file){
      file.addEventListener('change', async (e)=>{
        const f = e.target.files && e.target.files[0];
        if(!f) return;
        showToast('Subiendo imagen...');
        try{
          const url = await window.fbUploadImage(f);
          mosBannerPend[clave] = url;
          if(clear) clear.hidden = false;
          showToast('Imagen lista. Guarda para aplicar.');
        }catch(err){ showToast('No se pudo subir la imagen.'); }
        e.target.value = '';
      });
    }
    if(clear){
      clear.addEventListener('click', ()=>{
        mosBannerPend[clave] = null;
        clear.hidden = true;
        showToast('Volverá al mosaico automático al guardar.');
      });
    }
  }
  conectarMosFile('novedades', 'mosNovFile', 'mosNovClear');
  conectarMosFile('ofertas',   'mosOfeFile', 'mosOfeClear');
  conectarMosFile('preventas', 'mosPreFile', 'mosPreClear');
  conectarMosFile('mix', 'mosMixFile', 'mosMixClear');

  const MOS_LABELS = { novedades:'Novedades', ofertas:'Ofertas', preventas:'Preventas', mix:'Mix sueltos' };
  let mosOrdenPend = ['novedades','ofertas','preventas','mix'];
  function renderMosOrdenList(){
    const list = document.getElementById('mosOrdenList');
    if(!list) return;
    list.innerHTML = '';
    mosOrdenPend.forEach((clave, i)=>{
      const row = document.createElement('div');
      row.className = 'mos-orden-row';
      const label = document.createElement('span');
      label.textContent = (i+1) + '. ' + MOS_LABELS[clave];
      const btns = document.createElement('div');
      btns.className = 'mos-orden-btns';
      const up = document.createElement('button');
      up.type = 'button'; up.innerHTML = '↑'; up.disabled = i === 0;
      up.addEventListener('click', ()=>{
        [mosOrdenPend[i-1], mosOrdenPend[i]] = [mosOrdenPend[i], mosOrdenPend[i-1]];
        renderMosOrdenList();
      });
      const down = document.createElement('button');
      down.type = 'button'; down.innerHTML = '↓'; down.disabled = i === mosOrdenPend.length - 1;
      down.addEventListener('click', ()=>{
        [mosOrdenPend[i+1], mosOrdenPend[i]] = [mosOrdenPend[i], mosOrdenPend[i+1]];
        renderMosOrdenList();
      });
      btns.appendChild(up); btns.appendChild(down);
      row.appendChild(label); row.appendChild(btns);
      list.appendChild(row);
    });
  }


  // ---- editor de fotos de Japón (Quiénes somos) ----
  let japonPend = [];  // lista de trabajo mientras el panel está abierto

  function pintarJaponEditor(){
    const cont = document.getElementById('japonEditor');
    if(!cont) return;
    cont.innerHTML = '';
    japonPend.forEach((f, i)=>{
      const row = document.createElement('div');
      row.className = 'japon-edit-row';
      const thumb = document.createElement('div');
      thumb.className = 'japon-edit-thumb';
      thumb.style.backgroundImage = 'url(' + imgSrc(f.url) + ')';
      row.appendChild(thumb);
      const pie = document.createElement('input');
      pie.type = 'text'; pie.placeholder = 'Pie de foto (opcional)';
      pie.value = f.pie || '';
      pie.addEventListener('input', ()=>{ japonPend[i].pie = pie.value; });
      row.appendChild(pie);
      const controles = document.createElement('div');
      controles.className = 'japon-edit-btns';
      const up = document.createElement('button'); up.type='button'; up.textContent='↑'; up.title='Subir';
      up.addEventListener('click', ()=>{ if(i>0){ const t=japonPend[i-1]; japonPend[i-1]=japonPend[i]; japonPend[i]=t; pintarJaponEditor(); } });
      const down = document.createElement('button'); down.type='button'; down.textContent='↓'; down.title='Bajar';
      down.addEventListener('click', ()=>{ if(i<japonPend.length-1){ const t=japonPend[i+1]; japonPend[i+1]=japonPend[i]; japonPend[i]=t; pintarJaponEditor(); } });
      const del = document.createElement('button'); del.type='button'; del.textContent='✕'; del.title='Quitar'; del.className='japon-del';
      del.addEventListener('click', ()=>{ japonPend.splice(i,1); pintarJaponEditor(); });
      controles.appendChild(up); controles.appendChild(down); controles.appendChild(del);
      row.appendChild(controles);
      cont.appendChild(row);
    });
  }

  (function conectarJaponEditor(){
    const file = document.getElementById('japonFile');
    const urlInput = document.getElementById('japonUrl');
    const urlBtn = document.getElementById('japonUrlBtn');
    if(file){
      file.addEventListener('change', async (e)=>{
        const f = e.target.files && e.target.files[0];
        if(!f) return;
        showToast('Subiendo foto...');
        try{
          const blob = await resizeImageToBlob(f, 1400);
          const url = await window.fbUploadImage(blob);
          japonPend.push({ url: url, pie: '' });
          pintarJaponEditor();
          showToast('Foto lista. Guarda para aplicar.');
        }catch(err){ showToast('No se pudo subir la foto.'); }
        e.target.value = '';
      });
    }
    if(urlBtn){
      urlBtn.addEventListener('click', ()=>{
        const u = (urlInput.value || '').trim();
        if(!/^https?:\/\//i.test(u)){ showToast('El link debe empezar con http:// o https://'); return; }
        japonPend.push({ url: u, pie: '' });
        urlInput.value = '';
        pintarJaponEditor();
      });
    }
  })();


  // ---- editor de íconos día/noche ----
  let iconoPend = { sol: '_keep', luna: '_keep', basura: '_keep' };

  function pintarIconoPrev(){
    const setPrev = (modo, prevId, clearId)=>{
      const prev = document.getElementById(prevId);
      const clear = document.getElementById(clearId);
      let url;
      if(iconoPend[modo] === '_keep') url = (siteContent.iconos && siteContent.iconos[modo]) || '';
      else url = iconoPend[modo] || '';
      if(prev) prev.style.backgroundImage = url ? ('url(' + imgSrc(url) + ')') : 'none';
      if(clear) clear.hidden = !url;
    };
    setPrev('luna', 'iconLunaPrev', 'iconLunaClear');
    setPrev('sol', 'iconSolPrev', 'iconSolClear');
    setPrev('basura', 'iconBasuraPrev', 'iconBasuraClear');
  }

  (function conectarIconoEditor(){
    const conectar = (modo, fileId, clearId)=>{
      const file = document.getElementById(fileId);
      const clear = document.getElementById(clearId);
      if(file){
        file.addEventListener('change', async (e)=>{
          const f = e.target.files && e.target.files[0];
          if(!f) return;
          showToast('Subiendo ícono...');
          try{
            const url = await window.fbUploadImage(f);
            iconoPend[modo] = url;
            pintarIconoPrev();
            showToast('Ícono listo. Guarda para aplicar.');
          }catch(err){ showToast('No se pudo subir el ícono.'); }
          e.target.value = '';
        });
      }
      if(clear){
        clear.addEventListener('click', ()=>{ iconoPend[modo] = null; pintarIconoPrev(); showToast('Volverá al ícono por defecto al guardar.'); });
      }
    };
    conectar('luna', 'iconLunaFile', 'iconLunaClear');
    conectar('sol', 'iconSolFile', 'iconSolClear');
    conectar('basura', 'iconBasuraFile', 'iconBasuraClear');
  })();

  function leerIconos(){
    const actual = siteContent.iconos || { sol:null, luna:null, basura:null };
    const resolver = (modo)=>{
      if(iconoPend[modo] === '_keep') return actual[modo] || null;
      return iconoPend[modo];
    };
    return { sol: resolver('sol'), luna: resolver('luna'), basura: resolver('basura') };
  }

  let quienesFotoPend = '_keep';
  function pintarQuienesFotoPrev(){
    const prev = document.getElementById('quienesFotoPrev');
    const clear = document.getElementById('quienesFotoClear');
    let url;
    if(quienesFotoPend === '_keep') url = (siteContent.quienes && siteContent.quienes.foto) || '';
    else url = quienesFotoPend || '';
    if(prev) prev.style.backgroundImage = url ? ('url(' + imgSrc(url) + ')') : 'none';
    if(clear) clear.hidden = !url;
  }
  (function conectarQuienesFoto(){
    const file = document.getElementById('quienesFotoFile');
    const clear = document.getElementById('quienesFotoClear');
    if(file){
      file.addEventListener('change', async (e)=>{
        const f = e.target.files && e.target.files[0];
        if(!f) return;
        showToast('Subiendo foto...');
        try{
          const blob = await resizeImageToBlob(f, 1000);
          const url = await window.fbUploadImage(blob);
          quienesFotoPend = url;
          pintarQuienesFotoPrev();
          showToast('Foto lista. Guarda para aplicar.');
        }catch(err){ showToast('No se pudo subir la foto.'); }
        e.target.value = '';
      });
    }
    if(clear){
      clear.addEventListener('click', ()=>{ quienesFotoPend = null; pintarQuienesFotoPrev(); showToast('Se quitará al guardar.'); });
    }
  })();
  function leerQuienesFoto(){
    if(quienesFotoPend === '_keep') return (siteContent.quienes && siteContent.quienes.foto) || null;
    return quienesFotoPend;
  }

  // ---- editor de logos por modo ----
  let logoPend = { claro: '_keep', oscuro: '_keep' }; // '_keep' | null | url

  function pintarLogoPrev(){
    const setPrev = (modo, prevId, clearId)=>{
      const prev = document.getElementById(prevId);
      const clear = document.getElementById(clearId);
      let url;
      if(logoPend[modo] === '_keep') url = (siteContent.logos && siteContent.logos[modo]) || '';
      else url = logoPend[modo] || '';
      if(prev) prev.style.backgroundImage = url ? ('url(' + imgSrc(url) + ')') : 'none';
      if(clear) clear.hidden = !url;
    };
    setPrev('oscuro', 'logoOscuroPrev', 'logoOscuroClear');
    setPrev('claro', 'logoClaroPrev', 'logoClaroClear');
  }

  (function conectarLogoEditor(){
    const conectar = (modo, fileId, clearId)=>{
      const file = document.getElementById(fileId);
      const clear = document.getElementById(clearId);
      if(file){
        file.addEventListener('change', async (e)=>{
          const f = e.target.files && e.target.files[0];
          if(!f) return;
          showToast('Subiendo logo...');
          try{
            const url = await window.fbUploadImage(f);
            logoPend[modo] = url;
            pintarLogoPrev();
            showToast('Logo listo. Guarda para aplicar.');
          }catch(err){ showToast('No se pudo subir el logo.'); }
          e.target.value = '';
        });
      }
      if(clear){
        clear.addEventListener('click', ()=>{ logoPend[modo] = null; pintarLogoPrev(); showToast('Volverá al logo por defecto al guardar.'); });
      }
    };
    conectar('oscuro', 'logoOscuroFile', 'logoOscuroClear');
    conectar('claro', 'logoClaroFile', 'logoClaroClear');
  })();

  function leerLogos(){
    const actual = siteContent.logos || { claro:null, oscuro:null };
    const resolver = (modo)=>{
      if(logoPend[modo] === '_keep') return actual[modo] || null;
      return logoPend[modo]; // null o url
    };
    return { claro: resolver('claro'), oscuro: resolver('oscuro') };
  }

  async function saveSiteContent(){
    try{
      await window.storage.set(CONTENT_KEY, JSON.stringify(siteContent), true);
    }catch(e){
      showToast('No se pudo guardar el texto. Intenta de nuevo.');
    }
  }

  // Aplica los íconos propios del botón día/noche (o los SVG por defecto).
  function aplicarIconosTema(){
    const ic = siteContent.iconos || {};
    const sunImg = document.getElementById('iconSunImg');
    const moonImg = document.getElementById('iconMoonImg');
    const sunSvg = themeToggle && themeToggle.querySelector('.icon-sun');
    const moonSvg = themeToggle && themeToggle.querySelector('.icon-moon');
    // sol (modo claro)
    if(ic.sol && sunImg){ sunImg.src = imgSrc(ic.sol); sunImg.dataset.propio = '1'; if(sunSvg) sunSvg.dataset.oculto = '1'; }
    else if(sunImg){ sunImg.dataset.propio = ''; sunImg.hidden = true; if(sunSvg) sunSvg.dataset.oculto = ''; }
    // luna (modo oscuro)
    if(ic.luna && moonImg){ moonImg.src = imgSrc(ic.luna); moonImg.dataset.propio = '1'; if(moonSvg) moonSvg.dataset.oculto = '1'; }
    else if(moonImg){ moonImg.dataset.propio = ''; moonImg.hidden = true; if(moonSvg) moonSvg.dataset.oculto = ''; }
    // re-aplicar visibilidad según el tema actual
    const tema = document.documentElement.getAttribute('data-theme') || 'dark';
    actualizarVisibilidadIconos(tema === 'dark');
  }

  // Muestra el ícono correcto (imagen propia o SVG) según el modo, con una
  // transición de giro + desvanecido en vez de un cambio brusco.
  function actualizarVisibilidadIconos(isDark){
    const sunImg = document.getElementById('iconSunImg');
    const moonImg = document.getElementById('iconMoonImg');
    const sunSvg = themeToggle && themeToggle.querySelector('.icon-sun');
    const moonSvg = themeToggle && themeToggle.querySelector('.icon-moon');

    [sunImg, moonImg, sunSvg, moonSvg].forEach(el=>{
      if(!el) return;
      el.hidden = false;
      el.classList.remove('icon-visible');
    });

    if(isDark){
      if(moonImg && moonImg.dataset.propio) moonImg.classList.add('icon-visible');
      else if(moonSvg) moonSvg.classList.add('icon-visible');
    } else {
      if(sunImg && sunImg.dataset.propio) sunImg.classList.add('icon-visible');
      else if(sunSvg) sunSvg.classList.add('icon-visible');
    }
  }

  // Aplica el logo correcto según el modo (claro/oscuro), en header y barra compacta.
  function aplicarLogo(){
    const tema = document.documentElement.getAttribute('data-theme') || 'dark';
    const logos = siteContent.logos || {};
    const propio = tema === 'light' ? logos.claro : logos.oscuro;
    const src = propio ? imgSrc(propio) : ('logo-mark.png?v=20260729');
    ['logoHeader','logoCompacto'].forEach(id=>{
      const img = document.getElementById(id);
      if(img) img.src = src;
    });
  }

  // Aplica los textos editables del pie de página.
  // En el subtítulo, lo que va entre *asteriscos* se muestra en negrita dorada.
  function aplicarFooter(){
    const f = siteContent.footer || {};
    const nombre = document.getElementById('footerName');
    const tag = document.getElementById('footerTag');
    if(nombre && f.titulo) nombre.textContent = f.titulo;
    if(tag && f.subtitulo){
      const escapado = f.subtitulo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      tag.innerHTML = escapado.replace(/\*([^*]+)\*/g, '<b>$1</b>');
    }
  }

  function renderJaponTira(){
    const tira = document.getElementById('japonTira');
    if(!tira) return;
    const wrap = tira.closest('.japon-tira-wrap');
    const fotos = Array.isArray(siteContent.japon) ? siteContent.japon : [];
    tira.innerHTML = '';
    if(!fotos.length){ if(wrap) wrap.hidden = true; else tira.hidden = true; return; }
    if(wrap) wrap.hidden = false; else tira.hidden = false;
    fotos.forEach(f=>{
      const url = (f && (f.url || f.src)) || '';
      if(!url) return;
      const item = document.createElement('figure');
      item.className = 'japon-foto';
      const im = document.createElement('div');
      im.className = 'japon-img';
      im.style.backgroundImage = 'url(' + imgSrc(url) + ')';
      item.appendChild(im);
      if(f.pie){
        const cap = document.createElement('figcaption');
        cap.textContent = f.pie;
        item.appendChild(cap);
      }
      tira.appendChild(item);
    });
    setupJaponTiraNav(tira, fotos.length);
  }

  function setupJaponTiraNav(tira, count){
    const wrap = tira.closest('.japon-tira-wrap');
    if(!wrap) return;
    const prevBtn = wrap.querySelector('.tira-nav.prev');
    const nextBtn = wrap.querySelector('.tira-nav.next');
    const fill = wrap.querySelector('.tira-progress .fill');
    function update(){
      const max = tira.scrollWidth - tira.clientWidth;
      const ratio = max > 0 ? tira.scrollLeft / max : 0;
      if(fill) fill.style.width = Math.max(8, ratio * 100) + '%';
      if(prevBtn) prevBtn.style.display = tira.scrollLeft > 4 ? 'flex' : 'none';
      if(nextBtn) nextBtn.style.display = (max > 4 && tira.scrollLeft < max - 4) ? 'flex' : 'none';
    }
    tira.addEventListener('scroll', update, {passive:true});
    if(prevBtn) prevBtn.onclick = ()=> tira.scrollBy({left:-320, behavior:'smooth'});
    if(nextBtn) nextBtn.onclick = ()=> tira.scrollBy({left:320, behavior:'smooth'});
    setTimeout(update, 50);
  }

  function renderSiteContent(){
    aplicarLogo();
    aplicarIconosTema();
    aplicarFooter();
    aplicarTicker();
    const quienesPanel = document.getElementById('quienesSectionBody');
    if(quienesPanel){
      quienesPanel.innerHTML = '';
      const fotoUrl = siteContent.quienes.foto;
      const layout = document.createElement('div');
      layout.className = 'quienes-layout' + (fotoUrl ? '' : ' sin-foto');
      if(fotoUrl){
        const fotoWrap = document.createElement('div');
        fotoWrap.className = 'quienes-foto';
        const img = document.createElement('img');
        img.src = imgSrc(fotoUrl);
        img.alt = 'Foto de La Tienda de Meowth';
        fotoWrap.appendChild(img);
        layout.appendChild(fotoWrap);
      }
      const textCol = document.createElement('div');
      textCol.className = 'quienes-texto';
      siteContent.quienes.parrafos.forEach((txt, i)=>{
        const p = document.createElement('p');
        p.className = 'info-lead' + (i === 0 ? ' quienes-lead' : '');
        p.textContent = txt;
        textCol.appendChild(p);
      });
      layout.appendChild(textCol);
      quienesPanel.appendChild(layout);

      const tiraWrap = document.createElement('div');
      tiraWrap.className = 'japon-tira-wrap';
      tiraWrap.hidden = true;
      const tira = document.createElement('div');
      tira.className = 'japon-tira';
      tira.id = 'japonTira';
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button'; prevBtn.className = 'tira-nav prev'; prevBtn.setAttribute('aria-label','Anterior');
      prevBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg>';
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button'; nextBtn.className = 'tira-nav next'; nextBtn.setAttribute('aria-label','Siguiente');
      nextBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>';
      const progress = document.createElement('div');
      progress.className = 'tira-progress';
      progress.innerHTML = '<div class="fill"></div>';
      tiraWrap.appendChild(prevBtn);
      tiraWrap.appendChild(nextBtn);
      tiraWrap.appendChild(tira);
      tiraWrap.appendChild(progress);
      quienesPanel.appendChild(tiraWrap);

      const statsWrap = document.createElement('div');
      statsWrap.className = 'info-stats';
      siteContent.quienes.stats.forEach(s=>{
        const stat = document.createElement('div');
        stat.className = 'info-stat';
        const num = document.createElement('span');
        num.className = 'info-stat-num';
        num.textContent = s.num;
        const label = document.createElement('span');
        label.className = 'info-stat-label';
        label.textContent = s.label;
        stat.appendChild(num); stat.appendChild(label);
        statsWrap.appendChild(stat);
      });
      quienesPanel.appendChild(statsWrap);

      renderJaponTira();
    }

    const comprarTituloEl = document.getElementById('comprarSectionTitleText');
    if(comprarTituloEl) comprarTituloEl.textContent = siteContent.comprar.tituloSeccion || '¡Compra fácil en 1, 2, 3!';

    // Título y descripción que ve Google (editables desde el panel)
    const seo = siteContent.seo || {};
    if(seo.titulo && seo.titulo.trim()) document.title = seo.titulo.trim();
    if(seo.descripcion && seo.descripcion.trim()){
      const meta = document.querySelector('meta[name="description"]');
      if(meta) meta.setAttribute('content', seo.descripcion.trim());
    }

    const T = siteContent.titles || {};
    const setSectionTitle = (id, val, def)=>{ const el = document.getElementById(id); if(el) el.textContent = (val && val.trim()) ? val : def; };
    setSectionTitle('tituloNovedades', T.novedades, '¡Nuevos ingresos!');
    setSectionTitle('tituloOfertas', T.ofertas, '¡Ofertas por tiempo limitado!');
    setSectionTitle('tituloPreventas', T.preventas, '¡Preventas!');
    setSectionTitle('tituloCatalogo', T.catalogo, 'Catálogo');
    setSectionTitle('tituloResenas', T.resenas, 'Lo que dicen nuestros coleccionistas');
    setSectionTitle('tituloQuienes', T.quienes, 'Quién soy');

    const comprarPanel = document.getElementById('comprarSectionBody');
    if(comprarPanel){
      comprarPanel.innerHTML = '';
      const stepsGrid = document.createElement('div');
      stepsGrid.className = 'steps-grid';
      // Métodos de pago que se muestran como chips dentro del Paso 2.
      // Si algún día cambia el recargo o quieres agregar/quitar un método, edita esta lista.
      const metodosPago = [
        { nombre: 'Yape / Plin', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.4"/><path d="M6.5 6.5h11M6.5 17.5h11"/><path d="M9.5 12 11.2 13.7 14.7 10.2"/></svg>' },
        { nombre: 'Transferencia', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6"/><path d="M4.5 10v8M9 10v8M15 10v8M19.5 10v8"/><path d="M3 19.5h18"/><path d="M3 10h18"/></svg>' },
        { nombre: 'Tarjeta de crédito', nota: '+5%', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.6" y="5.6" width="18.8" height="12.8" rx="2"/><path d="M2.6 9.4h18.8"/><path d="M6 14.4h4"/></svg>' }
      ];
      // Opciones de recepción del pedido, mostradas como chips en el Paso 3.
      const opcionesEnvio = [
        { nombre: 'Envíos a todo el Perú', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-9Z"/></svg>' },
        { nombre: 'Recojo presencial', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.2 7 8l3.2 2 1.8-1.6 1.8 1.6L21 8"/><path d="M6.8 9.6l3.6 4.2a1.5 1.5 0 0 0 2.3-1.9l-3-3.5"/><path d="M13.3 7.7l2.3 2.7a1.5 1.5 0 0 1-2.1 2.1"/></svg>' },
        { nombre: 'Delivery', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="2.6"/><circle cx="18.3" cy="17.5" r="2.6"/><path d="M8.1 17.5h6.9M5.5 17.5 8 12h4l2 3h3.3"/><path d="M10.8 12l2-3h3.2"/></svg>' }
      ];
      // Íconos por paso: Pokédex (elegir) / viñeta de chat (coordinar) / carita feliz (recibir).
      const stepIcons = [
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5H6A3.5 3.5 0 0 0 2.5 6v12A3.5 3.5 0 0 0 6 21.5h2"/><path d="M8 2.5h10A3.5 3.5 0 0 1 21.5 6v12a3.5 3.5 0 0 1-3.5 3.5H8"/><path d="M8 2.5v19"/><circle cx="5.2" cy="9.2" r="2.6"/><circle cx="5.2" cy="14.2" r="1"/><circle cx="5.2" cy="17.6" r="1"/><rect x="11.5" y="6" width="7" height="5" rx="1"/></svg>',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M7.6 13.6c1 2 2.6 3 4.4 3s3.4-1 4.4-3"/><circle cx="8.6" cy="9.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.4" cy="9.6" r="1.15" fill="currentColor" stroke="none"/></svg>'
      ];
      siteContent.comprar.pasos.forEach((paso, i)=>{
        const card = document.createElement('div');
        card.className = 'step-card';
        const head = document.createElement('div');
        head.className = 'step-head';
        const iconTile = document.createElement('div');
        iconTile.className = 'step-icon';
        iconTile.innerHTML = (stepIcons[i] || '') + '<span class="step-num">' + String(i+1) + '</span>';
        const h3 = document.createElement('h3');
        h3.textContent = paso.titulo;
        head.appendChild(iconTile); head.appendChild(h3);
        const p = document.createElement('p');
        p.textContent = paso.desc;
        card.appendChild(head); card.appendChild(p);
        // El Paso 1 muestra los botones "Ver catálogo" / "Escríbeme" dentro de la tarjeta, centrados.
        if(i === 0){
          const comprarCta = document.createElement('div');
          comprarCta.className = 'comprar-cta-row';
          const verCatalogoBtn = document.createElement('button');
          verCatalogoBtn.type = 'button';
          verCatalogoBtn.className = 'btn-primary comprar-cta-catalogo';
          verCatalogoBtn.textContent = 'Ver catálogo';
          verCatalogoBtn.addEventListener('click', ()=>{
            abrirCatalogoCompleto();
            render();
            scrollToCatalog();
          });
          const waCtaLink = document.createElement('a');
          waCtaLink.className = 'comprar-cta-wa';
          waCtaLink.href = waFab.href;
          waCtaLink.target = '_blank'; waCtaLink.rel = 'noopener';
          waCtaLink.innerHTML = waCtaIconSvg + '<span>Escríbeme</span>';
          comprarCta.appendChild(verCatalogoBtn);
          comprarCta.appendChild(waCtaLink);
          card.appendChild(comprarCta);
        }
        // El Paso 2 muestra además los métodos de pago como chips.
        if(i === 1){
          const payBlock = document.createElement('div');
          payBlock.className = 'pay-block';
          const payLabel = document.createElement('span');
          payLabel.className = 'pay-label';
          payLabel.textContent = 'Cómo pagas';
          const payRow = document.createElement('div');
          payRow.className = 'pay-row';
          metodosPago.forEach(m=>{
            const chip = document.createElement('span');
            chip.className = 'pay-chip';
            chip.innerHTML = m.icon || '';
            const txt = document.createElement('span');
            txt.textContent = m.nombre;
            chip.appendChild(txt);
            if(m.nota){
              const nota = document.createElement('span');
              nota.className = 'pay-note';
              nota.textContent = m.nota;
              chip.appendChild(nota);
            }
            payRow.appendChild(chip);
          });
          payBlock.appendChild(payLabel);
          payBlock.appendChild(payRow);
          card.appendChild(payBlock);
        }
        // El Paso 3 muestra las formas de recibir el pedido como chips.
        if(i === 2){
          const shipBlock = document.createElement('div');
          shipBlock.className = 'ship-block';
          const shipLabel = document.createElement('span');
          shipLabel.className = 'ship-label';
          shipLabel.textContent = 'Cómo lo recibes';
          const shipRow = document.createElement('div');
          shipRow.className = 'ship-row';
          opcionesEnvio.forEach(o=>{
            const chip = document.createElement('span');
            chip.className = 'ship-chip';
            chip.innerHTML = o.icon || '';
            const txt = document.createElement('span');
            txt.textContent = o.nombre;
            chip.appendChild(txt);
            shipRow.appendChild(chip);
          });
          shipBlock.appendChild(shipLabel);
          shipBlock.appendChild(shipRow);
          card.appendChild(shipBlock);
        }
        stepsGrid.appendChild(card);
      });
      comprarPanel.appendChild(stepsGrid);

      // Bloque "Resérvalo": mostramos solo el primer elemento de pagos.
      // El antiguo segundo bloque ("Paga como prefieras") ya no se muestra; esa
      // información vive ahora en los chips del Paso 2. Aunque en la base de datos
      // sigan guardados dos pagos, aquí solo usamos el primero.
      const reserva = (siteContent.comprar.pagos && siteContent.comprar.pagos[0]) || null;
      const reservaHeroBody = document.getElementById('reservaHeroBody');
      const reservaHero = document.getElementById('reservaHero');
      if(reservaHeroBody) reservaHeroBody.innerHTML = '';
      if(reservaHero) reservaHero.style.display = reserva ? '' : 'none';
      if(reserva && reservaHeroBody){
        const banner = document.createElement('div');
        banner.className = 'reserva-banner';
        if(reserva.image){
          // Compatibilidad: si hay una imagen guardada, reemplaza el bloque visualmente.
          banner.classList.add('reserva-imgmode');
          const img = document.createElement('img');
          img.src = reserva.image;
          img.alt = (reserva.titulo || '') + (reserva.desc ? ('. ' + reserva.desc) : '');
          banner.appendChild(img);
          const srText = document.createElement('span');
          srText.className = 'sr-only';
          srText.textContent = (reserva.titulo || '') + (reserva.desc ? ('. ' + reserva.desc) : '');
          banner.appendChild(srText);
        } else {
          // Capas decorativas (foil, resplandor, destellos, símbolo) — contenido estático y seguro.
          const sparkSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z"/></svg>';
          let sparksHtml = '';
          for(let s=1; s<=9; s++){ sparksHtml += '<span class="reserva-spark s'+s+'">'+sparkSvg+'</span>'; }
          const fxOld = reservaHero && reservaHero.querySelector('.reserva-fx');
          if(fxOld) fxOld.remove();
          const fx = document.createElement('div');
          fx.className = 'reserva-fx';
          fx.innerHTML =
            '<div class="reserva-holo"></div>' +
            '<div class="reserva-glow"></div>' +
            '<div class="reserva-sparks">' + sparksHtml + '</div>';
          if(reservaHero) reservaHero.insertBefore(fx, reservaHero.firstChild);
          const mainWrap = document.createElement('div');
          mainWrap.className = 'reserva-main';
          const textWrap = document.createElement('div');
          textWrap.className = 'reserva-text';
          const eyebrowTxt = (reserva.eyebrow && reserva.eyebrow.trim()) ? reserva.eyebrow : 'Pensado para coleccionistas';
          if(eyebrowTxt){
            const eyebrow = document.createElement('span');
            eyebrow.className = 'reserva-eyebrow';
            eyebrow.textContent = eyebrowTxt;
            textWrap.appendChild(eyebrow);
          }
          const h3 = document.createElement('h3');
          const tituloTxt = reserva.titulo || 'Mi meta es *tu felicidad*.';
          // Se resalta en dorado: lo que va entre *asteriscos*, o el remate entre ¡...!.
          // El asterisco tiene prioridad; permite resaltar sin salto de línea.
          const aster = tituloTxt.match(/\*([^*]+)\*/);
          const remate = tituloTxt.match(/¡[^!]*!/);
          if(aster){
            const antes = tituloTxt.slice(0, aster.index);
            const despues = tituloTxt.slice(aster.index + aster[0].length);
            if(antes) h3.appendChild(document.createTextNode(antes));
            const em = document.createElement('span');
            em.className = 'reserva-remate';
            em.textContent = aster[1];
            h3.appendChild(em);
            if(despues) h3.appendChild(document.createTextNode(despues));
          } else if(remate){
            const antes = tituloTxt.slice(0, remate.index).trim();
            if(antes){
              h3.appendChild(document.createTextNode(antes));
              h3.appendChild(document.createElement('br'));
            }
            const em = document.createElement('span');
            em.className = 'reserva-remate';
            em.textContent = remate[0];
            h3.appendChild(em);
            const despues = tituloTxt.slice(remate.index + remate[0].length).trim();
            if(despues) h3.appendChild(document.createTextNode(' ' + despues));
          } else {
            h3.textContent = tituloTxt;
          }
          const p = document.createElement('p');
          p.textContent = reserva.desc || '';
          textWrap.appendChild(h3);
          textWrap.appendChild(p);
          mainWrap.appendChild(textWrap);
          banner.appendChild(mainWrap);

          // Tres beneficios del servicio (reserva · almacén · envío).
          // Cada uno con su ícono y una palabra clave resaltada en dorado.
          const beneficios = [
            { ico: 'tag',   partes: ['Lo quieres, ¡', 'SEPÁRALO', ' y no lo pierdas!'] },
            { ico: 'home',  partes: ['Almacén ', 'GRATIS', ''] },
            { ico: 'box',   partes: ['Acumula y ', 'AHORRA', ' en envío'] }
          ];
          const iconos = {
            tag:  '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
            home: '<path d="M3 9l9-6 9 6v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21V12h6v9"/>',
            box:  '<rect x="3" y="8" width="13" height="10" rx="1"/><path d="M16 11h3l2 3v4h-5z"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>'
          };
          const benWrap = document.createElement('div');
          benWrap.className = 'reserva-benes';
          beneficios.forEach(b => {
            const el = document.createElement('div');
            el.className = 'reserva-bene';
            const ic = document.createElement('div');
            ic.className = 'reserva-bene-ico';
            ic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + iconos[b.ico] + '</svg>';
            const tx = document.createElement('div');
            tx.className = 'reserva-bene-tt';
            tx.appendChild(document.createTextNode(b.partes[0]));
            const fuerte = document.createElement('span');
            fuerte.className = 'reserva-bene-hl';
            fuerte.textContent = b.partes[1];
            tx.appendChild(fuerte);
            if(b.partes[2]) tx.appendChild(document.createTextNode(b.partes[2]));
            el.appendChild(ic);
            el.appendChild(tx);
            benWrap.appendChild(el);
          });
          banner.appendChild(benWrap);
        }
        reservaHeroBody.appendChild(banner);
      }
    }

    renderResenas();
    renderCategoryIcons();
  }

  function renderResenas(){
    const section = document.getElementById('resenasSection');
    const row = document.getElementById('resenasRow');
    if(!section || !row) return;
    const list = Array.isArray(siteContent.resenas)
      ? siteContent.resenas.filter(r => r && ((r.texto && r.texto.trim()) || (r.nombre && r.nombre.trim())))
      : [];
    row.innerHTML = '';
    if(!list.length){ section.style.display = 'none'; return; }
    section.style.display = '';
    list.forEach(r => {
      const card = document.createElement('div');
      card.className = 'resena-card';
      const stars = document.createElement('div');
      stars.className = 'resena-stars';
      const n = Math.max(0, Math.min(5, parseInt(r.estrellas, 10) || 5));
      let starsHtml = '';
      for(let s = 1; s <= 5; s++){
        starsHtml += '<svg class="' + (s <= n ? 'resena-star-on' : 'resena-star-off') + '" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 18.6 5.9 21.4l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>';
      }
      stars.innerHTML = starsHtml;
      const text = document.createElement('p');
      text.className = 'resena-text';
      text.textContent = '\u201C' + (r.texto || '') + '\u201D';
      const who = document.createElement('div');
      who.className = 'resena-who';
      const av = document.createElement('div');
      av.className = 'resena-avatar';
      av.textContent = ((r.nombre || '?').trim().charAt(0) || '?').toUpperCase();
      const info = document.createElement('div');
      const nm = document.createElement('div');
      nm.className = 'resena-name';
      nm.textContent = r.nombre || '';
      info.appendChild(nm);
      if(r.producto && r.producto.trim()){
        const pr = document.createElement('div');
        pr.className = 'resena-prod';
        pr.textContent = r.producto;
        info.appendChild(pr);
      }
      who.appendChild(av); who.appendChild(info);
      card.appendChild(stars); card.appendChild(text); card.appendChild(who);
      row.appendChild(card);
    });
  }
  // Guarda el diseño original de cada ícono de categoría una sola vez, apenas carga la página,
  // para poder "restaurarlo" más adelante aunque ya se haya reemplazado por uno personalizado.
  const originalCategoryIcons = {};
  document.querySelectorAll('.chip-icon-slot').forEach(slot=>{
    originalCategoryIcons[slot.dataset.iconCat] = slot.innerHTML;
  });

  // Reemplaza el ícono de una categoría por la imagen que el admin haya subido,
  // o lo deja/restaura al diseño original si no hay ninguna personalizada.
  function renderCategoryIcons(){
    document.querySelectorAll('.chip-icon-slot').forEach(slot=>{
      const cat = slot.dataset.iconCat;
      const customUrl = siteContent.categoryIcons && siteContent.categoryIcons[cat];
      if(customUrl){
        slot.innerHTML = '';
        const img = document.createElement('img');
        img.src = customUrl;
        img.alt = cat;
        slot.appendChild(img);
      } else if(originalCategoryIcons[cat]){
        slot.innerHTML = originalCategoryIcons[cat];
      }
    });
  }

  const CATEGORY_LABELS = { quienes: 'Quiénes somos', comprar: 'Cómo comprar', figuras: 'Figuras', peluches: 'Peluches', tcg: 'TCG', gaming: 'Gaming', accesorios: 'Accesorios', hogar: 'Hogar', otros: 'Otros' };
  let pendingCategoryIcons = {};
  let pendingResenas = [];

  function buildResenasEditor(){
    const cont = document.getElementById('resenasEditor');
    if(!cont) return;
    cont.innerHTML = '';
    pendingResenas.forEach((r, idx)=>{
      const box = document.createElement('div');
      box.className = 'resena-edit-row';
      const mkField = (labelText, type, key, value)=>{
        const f = document.createElement('div'); f.className = 'field';
        const l = document.createElement('label'); l.textContent = labelText; f.appendChild(l);
        const inp = (type === 'textarea') ? document.createElement('textarea') : document.createElement('input');
        if(type === 'textarea'){ inp.rows = 2; }
        else { inp.type = type; }
        if(type === 'number'){ inp.min = '1'; inp.max = '5'; }
        inp.value = (value == null) ? '' : value;
        inp.addEventListener('input', ()=>{ pendingResenas[idx][key] = inp.value; });
        f.appendChild(inp); return f;
      };
      box.appendChild(mkField('Nombre', 'text', 'nombre', r.nombre));
      box.appendChild(mkField('Estrellas (1 a 5)', 'number', 'estrellas', r.estrellas == null ? 5 : r.estrellas));
      box.appendChild(mkField('Producto (opcional)', 'text', 'producto', r.producto));
      box.appendChild(mkField('Opinión', 'textarea', 'texto', r.texto));
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'btn-ghost'; del.textContent = 'Eliminar reseña';
      del.addEventListener('click', ()=>{ pendingResenas.splice(idx, 1); buildResenasEditor(); });
      box.appendChild(del);
      cont.appendChild(box);
    });
  }
  (function(){
    const addBtn = document.getElementById('addResenaBtn');
    if(addBtn) addBtn.addEventListener('click', ()=>{
      pendingResenas.push({ nombre:'', estrellas:5, producto:'', texto:'' });
      buildResenasEditor();
    });
  })();


  function buildIconEditorGrid(){
    const grid = document.getElementById('iconEditorGrid');
    grid.innerHTML = '';
    Object.keys(CATEGORY_LABELS).forEach(cat=>{
      const card = document.createElement('div');
      card.className = 'icon-edit-card';

      const preview = document.createElement('div');
      preview.className = 'icon-edit-preview';
      preview.innerHTML = pendingCategoryIcons[cat] ? '' : (originalCategoryIcons[cat] || '');
      if(pendingCategoryIcons[cat]){
        const img = document.createElement('img');
        img.src = pendingCategoryIcons[cat];
        preview.appendChild(img);
      }

      const label = document.createElement('div');
      label.className = 'icon-edit-label';
      label.textContent = CATEGORY_LABELS[cat];

      const actions = document.createElement('div');
      actions.className = 'icon-edit-actions';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      const uploadBtn = document.createElement('button');
      uploadBtn.type = 'button';
      uploadBtn.textContent = 'Subir ícono';
      uploadBtn.addEventListener('click', ()=> fileInput.click());

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'icon-remove-btn';
      removeBtn.textContent = 'Restaurar original';
      removeBtn.style.display = pendingCategoryIcons[cat] ? 'block' : 'none';
      removeBtn.addEventListener('click', ()=>{
        pendingCategoryIcons[cat] = null;
        buildIconEditorGrid();
      });

      fileInput.addEventListener('change', async ()=>{
        const file = fileInput.files[0];
        if(!file) return;
        uploadBtn.textContent = 'Subiendo...';
        uploadBtn.disabled = true;
        try{
          const blob = await resizeImageToBlob(file, 200);
          const url = await window.fbUploadImage(blob);
          pendingCategoryIcons[cat] = url;
          buildIconEditorGrid();
        }catch(e){
          showToast('No se pudo subir el ícono. Intenta de nuevo.');
          uploadBtn.textContent = 'Subir ícono';
          uploadBtn.disabled = false;
        }
      });

      actions.appendChild(uploadBtn);
      actions.appendChild(removeBtn);
      actions.appendChild(fileInput);
      card.appendChild(preview);
      card.appendChild(label);
      card.appendChild(actions);
      grid.appendChild(card);
    });
  }

  const SOUND_LABELS = { quienes: 'Quiénes somos', comprar: 'Cómo comprar' };
  let pendingSounds = {};

  function buildSoundEditorGrid(){
    const grid = document.getElementById('soundEditorGrid');
    grid.innerHTML = '';
    Object.keys(SOUND_LABELS).forEach(key=>{
      const card = document.createElement('div');
      card.className = 'icon-edit-card';

      const label = document.createElement('div');
      label.className = 'icon-edit-label';
      label.textContent = SOUND_LABELS[key];

      const player = document.createElement('audio');
      player.controls = true;
      player.style.width = '100%';
      player.style.height = '30px';
      if(pendingSounds[key]) player.src = pendingSounds[key];
      else player.style.display = 'none';

      const actions = document.createElement('div');
      actions.className = 'icon-edit-actions';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'audio/*';
      fileInput.style.display = 'none';

      const uploadBtn = document.createElement('button');
      uploadBtn.type = 'button';
      uploadBtn.textContent = pendingSounds[key] ? 'Cambiar sonido' : 'Subir sonido';
      uploadBtn.addEventListener('click', ()=> fileInput.click());

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'icon-remove-btn';
      removeBtn.textContent = 'Quitar sonido';
      removeBtn.style.display = pendingSounds[key] ? 'block' : 'none';
      removeBtn.addEventListener('click', ()=>{
        pendingSounds[key] = null;
        buildSoundEditorGrid();
      });

      fileInput.addEventListener('change', async ()=>{
        const file = fileInput.files[0];
        if(!file) return;
        uploadBtn.textContent = 'Subiendo...';
        uploadBtn.disabled = true;
        try{
          const url = await window.fbUploadImage(file);
          pendingSounds[key] = url;
          buildSoundEditorGrid();
        }catch(e){
          showToast('No se pudo subir el sonido. Intenta de nuevo.');
          uploadBtn.textContent = 'Subir sonido';
          uploadBtn.disabled = false;
        }
      });

      actions.appendChild(uploadBtn);
      actions.appendChild(removeBtn);
      actions.appendChild(fileInput);
      card.appendChild(label);
      card.appendChild(player);
      card.appendChild(actions);
      grid.appendChild(card);
    });
  }

  function openTextsForm(){
    const q = siteContent.quienes, c = siteContent.comprar;
    document.getElementById('txtQuienesP1').value = q.parrafos[0] || '';
    document.getElementById('txtQuienesP2').value = q.parrafos[1] || '';
    document.getElementById('txtQuienesP3').value = q.parrafos[2] || '';
    document.getElementById('txtStat1Num').value = q.stats[0]?.num || '';
    document.getElementById('txtStat1Label').value = q.stats[0]?.label || '';
    document.getElementById('txtStat2Num').value = q.stats[1]?.num || '';
    document.getElementById('txtStat2Label').value = q.stats[1]?.label || '';
    document.getElementById('txtComprarTitulo').value = c.tituloSeccion || '';
    const seoAct = siteContent.seo || {};
    document.getElementById('txtSeoTitulo').value = seoAct.titulo || '';
    document.getElementById('txtSeoDesc').value = seoAct.descripcion || '';

    const TT = siteContent.titles || {};
    document.getElementById('txtTituloNovedades').value = TT.novedades || '';
    document.getElementById('txtTituloOfertas').value = TT.ofertas || '';
    document.getElementById('txtTituloPreventas').value = TT.preventas || '';
    document.getElementById('txtTituloCatalogo').value = TT.catalogo || '';
    document.getElementById('txtTituloResenas').value = TT.resenas || '';
    document.getElementById('txtTituloQuienes').value = TT.quienes || '';

    // Textos del footer
    const F = siteContent.footer || {};
    const fn = document.getElementById('txtFooterName');
    const ft = document.getElementById('txtFooterTag');
    if(fn) fn.value = F.titulo || '';
    if(ft) ft.value = F.subtitulo || '';

    // Cinta de confianza
    const TK = siteContent.ticker || [];
    ['txtTicker1','txtTicker2','txtTicker3','txtTicker4'].forEach((id,i)=>{
      const el = document.getElementById(id);
      if(el) el.value = TK[i] || '';
    });

    // Mosaicos de portada
    const MOS = siteContent.mosaicos || {};
    const setMos = (clave, ids)=>{
      const m = MOS[clave] || {};
      document.getElementById(ids.activo).checked = m.activo !== false;
      document.getElementById(ids.eyebrow).value = m.eyebrow || '';
      document.getElementById(ids.titulo).value = m.titulo || '';
      const clr = document.getElementById(ids.clear);
      if(clr) clr.hidden = !(m.modo === 'banner' && m.banner);
    };
    setMos('novedades', {activo:'mosNovActivo', eyebrow:'mosNovEyebrow', titulo:'mosNovTitulo', clear:'mosNovClear'});
    setMos('ofertas',   {activo:'mosOfeActivo', eyebrow:'mosOfeEyebrow', titulo:'mosOfeTitulo', clear:'mosOfeClear'});
    setMos('preventas', {activo:'mosPreActivo', eyebrow:'mosPreEyebrow', titulo:'mosPreTitulo', clear:'mosPreClear'});
    setMos('mix', {activo:'mosMixActivo', eyebrow:'mosMixEyebrow', titulo:'mosMixTitulo', clear:'mosMixClear'});

    const ordenValido = ['novedades','ofertas','preventas','mix'];
    const ordenGuardado = Array.isArray(siteContent.mosaicoOrden) ? siteContent.mosaicoOrden.filter(c=> ordenValido.includes(c)) : [];
    mosOrdenPend = ordenGuardado.concat(ordenValido.filter(c=> !ordenGuardado.includes(c)));
    renderMosOrdenList();

    // fotos de Japón: copia de trabajo
    japonPend = (Array.isArray(siteContent.japon) ? siteContent.japon : []).map(f=> ({ url: f.url || f.src || '', pie: f.pie || '' }));
    pintarJaponEditor();
    // logos: reiniciar estado y pintar preview
    logoPend = { claro: '_keep', oscuro: '_keep' };
    pintarLogoPrev();
    quienesFotoPend = '_keep';
    pintarQuienesFotoPrev();
    // íconos día/noche
    iconoPend = { sol: '_keep', luna: '_keep', basura: '_keep' };
    pintarIconoPrev();

    document.getElementById('txtPaso1Titulo').value = c.pasos[0]?.titulo || '';
    document.getElementById('txtPaso1Desc').value = c.pasos[0]?.desc || '';
    document.getElementById('txtPaso2Titulo').value = c.pasos[1]?.titulo || '';
    document.getElementById('txtPaso2Desc').value = c.pasos[1]?.desc || '';
    document.getElementById('txtPaso3Titulo').value = c.pasos[2]?.titulo || '';
    document.getElementById('txtPaso3Desc').value = c.pasos[2]?.desc || '';
    document.getElementById('txtPago1Eyebrow').value = c.pagos[0]?.eyebrow || '';
    document.getElementById('txtPago1Titulo').value = c.pagos[0]?.titulo || '';
    document.getElementById('txtPago1Desc').value = c.pagos[0]?.desc || '';
    const rb = (c.pagos[0] && Array.isArray(c.pagos[0].badges)) ? c.pagos[0].badges : [];
    document.getElementById('txtReservaBadge1K').value = rb[0]?.k || '';
    document.getElementById('txtReservaBadge1V').value = rb[0]?.v || '';
    document.getElementById('txtReservaBadge2K').value = rb[1]?.k || '';
    document.getElementById('txtReservaBadge2V').value = rb[1]?.v || '';
    pendingResenas = (siteContent.resenas || []).map(r => Object.assign({}, r));
    buildResenasEditor();
    pendingCategoryIcons = Object.assign({}, siteContent.categoryIcons);
    buildIconEditorGrid();
    pendingSounds = Object.assign({}, siteContent.sounds);
    buildSoundEditorGrid();
    textsOverlay.classList.add('show');
    armarAcordeonTextos();
    setTimeout(()=> textsGuard.snapshot(), 50);
  }
  // Convierte las secciones del editor de textos en acordeón plegable.
  // Agrupa cada .form-section-title con todo su contenido hasta el siguiente título.
  let acordeonListo = false;
  function armarAcordeonTextos(){
    if(acordeonListo) return;
    const scroll = document.querySelector('.modal-textos .textos-scroll');
    if(!scroll) return;
    const titulos = Array.from(scroll.querySelectorAll('.form-section-title'));
    titulos.forEach((titulo, idx)=>{
      // recolectar los elementos hermanos hasta el próximo título
      const contenido = document.createElement('div');
      contenido.className = 'acordeon-body';
      let n = titulo.nextElementSibling;
      while(n && !n.classList.contains('form-section-title')){
        const sig = n.nextElementSibling;
        contenido.appendChild(n);
        n = sig;
      }
      // convertir el título en cabecera clicable
      titulo.classList.add('acordeon-head');
      const flecha = document.createElement('span');
      flecha.className = 'acordeon-flecha';
      flecha.textContent = '›';
      titulo.appendChild(flecha);
      titulo.insertAdjacentElement('afterend', contenido);
      // primera sección abierta, el resto cerrado
      if(idx === 0){ titulo.classList.add('abierto'); }
      else { contenido.style.display = 'none'; }
      titulo.addEventListener('click', ()=>{
        const abierto = titulo.classList.toggle('abierto');
        contenido.style.display = abierto ? '' : 'none';
      });
    });
    acordeonListo = true;
  }

  function closeTextsForm(force){
    confirmDiscard(textsGuard, force, ()=> textsOverlay.classList.remove('show'));
  }
  textsBtn.addEventListener('click', openTextsForm);
  const textsGuard = makeDirtyGuard(()=> Array.from(textsOverlay.querySelectorAll('input,textarea')).map(el=>el.value));
  textsCancel.addEventListener('click', ()=> closeTextsForm());
  textsOverlay.addEventListener('click', (e)=>{ if(e.target === textsOverlay) closeTextsForm(); });
  textsSave.addEventListener('click', async ()=>{
    const val = id => document.getElementById(id).value.trim();
    siteContent = {
      quienes: {
        foto: leerQuienesFoto(),
        parrafos: [val('txtQuienesP1'), val('txtQuienesP2'), val('txtQuienesP3')].filter(Boolean),
        stats: [
          { num: val('txtStat1Num'), label: val('txtStat1Label') },
          { num: val('txtStat2Num'), label: val('txtStat2Label') }
        ]
      },
      comprar: {
        tituloSeccion: val('txtComprarTitulo'),
        pasos: [
          { titulo: val('txtPaso1Titulo'), desc: val('txtPaso1Desc') },
          { titulo: val('txtPaso2Titulo'), desc: val('txtPaso2Desc') },
          { titulo: val('txtPaso3Titulo'), desc: val('txtPaso3Desc') }
        ],
        pagos: [
          { eyebrow: val('txtPago1Eyebrow'), titulo: val('txtPago1Titulo'), desc: val('txtPago1Desc'), image: (siteContent.comprar.pagos[0] && siteContent.comprar.pagos[0].image) || null, badges: [
            { k: val('txtReservaBadge1K'), v: val('txtReservaBadge1V') },
            { k: val('txtReservaBadge2K'), v: val('txtReservaBadge2V') }
          ] }
        ]
      },
      categoryIcons: Object.assign({}, pendingCategoryIcons),
      sounds: Object.assign({}, pendingSounds),
      resenas: pendingResenas
        .filter(r => (r.texto && r.texto.trim()) || (r.nombre && r.nombre.trim()))
        .map(r => ({
          nombre: (r.nombre || '').trim(),
          estrellas: Math.max(1, Math.min(5, parseInt(r.estrellas, 10) || 5)),
          producto: (r.producto || '').trim(),
          texto: (r.texto || '').trim()
        })),
      seo: {
        titulo: val('txtSeoTitulo'),
        descripcion: val('txtSeoDesc')
      },
      titles: {
        novedades: val('txtTituloNovedades'),
        ofertas: val('txtTituloOfertas'),
        preventas: val('txtTituloPreventas'),
        catalogo: val('txtTituloCatalogo'),
        resenas: val('txtTituloResenas'),
        quienes: val('txtTituloQuienes')
      },
      mosaicos: {
        novedades: leerMosaico('novedades', 'mosNovActivo', 'mosNovEyebrow', 'mosNovTitulo'),
        ofertas:   leerMosaico('ofertas',   'mosOfeActivo', 'mosOfeEyebrow', 'mosOfeTitulo'),
        preventas: leerMosaico('preventas', 'mosPreActivo', 'mosPreEyebrow', 'mosPreTitulo'),
        mix: leerMosaico('mix', 'mosMixActivo', 'mosMixEyebrow', 'mosMixTitulo')
      },
      mosaicoOrden: mosOrdenPend.slice(),
      japon: japonPend.filter(f=> f.url).map(f=> ({ url: f.url, pie: (f.pie||'').trim() })),
      logos: leerLogos(),
      iconos: leerIconos(),
      footer: {
        titulo: (document.getElementById('txtFooterName').value || '').trim(),
        subtitulo: (document.getElementById('txtFooterTag').value || '').trim()
      },
      ticker: ['txtTicker1','txtTicker2','txtTicker3','txtTicker4'].map(id=> (document.getElementById(id).value || '').trim())
    };
    renderSiteContent();
    renderNewArrivals(); renderOfertas(); renderPreventas();
    mosBannerPend.novedades = '_keep'; mosBannerPend.ofertas = '_keep'; mosBannerPend.preventas = '_keep';
    logoPend = { claro: '_keep', oscuro: '_keep' };
    iconoPend = { sol: '_keep', luna: '_keep', basura: '_keep' };
    aplicarLogo();
    aplicarIconosTema();
    closeTextsForm(true);
    await saveSiteContent();
    showToast('Textos guardados');
  });

  function renderBanner(){
    clearInterval(bannerTimer);
    bannerTrack.innerHTML = '';
    bannerDots.innerHTML = '';

    if(!bannerSlides.length){
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    if(bannerIndex >= bannerSlides.length) bannerIndex = 0;

    bannerSlides.forEach((s, i)=>{
      const slide = document.createElement('div');
      slide.className = 'banner-slide' + (s.link ? ' clickable' : '');
      if(s.imageMobile){
        // Dos versiones: el navegador elige según el ancho de pantalla.
        const pic = document.createElement('picture');
        const src = document.createElement('source');
        src.media = '(max-width: 640px)';
        src.srcset = imgSrc(s.imageMobile);
        const img = document.createElement('img');
        img.className = 'banner-img';
        img.src = imgSrc(s.image);
        if(i === 0){ img.fetchPriority = 'high'; } else { img.loading = 'lazy'; }
        img.style.setProperty('--banner-pos-desktop', imgPos(s.image));
        img.style.setProperty('--banner-pos-mobile', imgPos(s.imageMobile));
        img.alt = s.title || '';
        pic.appendChild(src);
        pic.appendChild(img);
        slide.appendChild(pic);
      } else {
        const img = document.createElement('img');
        img.className = 'banner-img';
        img.src = imgSrc(s.image);
        if(i === 0){ img.fetchPriority = 'high'; } else { img.loading = 'lazy'; }
        img.style.setProperty('--banner-pos-desktop', imgPos(s.image));
        img.style.setProperty('--banner-pos-mobile', imgPos(s.image));
        img.alt = s.title || '';
        slide.appendChild(img);
      }
      if(s.link){
        slide.addEventListener('click', ()=> window.open(s.link, '_blank', 'noopener'));
      }
      bannerTrack.appendChild(slide);

      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'banner-dot' + (i === bannerIndex ? ' active' : '');
      dot.setAttribute('aria-label', 'Ir al slide ' + (i+1));
      dot.innerHTML = '<span class="banner-dot-track"><span class="banner-dot-fill"></span></span>';
      dot.addEventListener('click', ()=> goToBannerSlide(i));
      bannerDots.appendChild(dot);
    });

    updateBannerPosition();
    bannerPrev.style.display = bannerSlides.length > 1 ? 'flex' : 'none';
    bannerNext.style.display = bannerSlides.length > 1 ? 'flex' : 'none';
    bannerDots.style.display = bannerSlides.length > 1 ? 'flex' : 'none';

    if(bannerSlides.length > 1) startBannerAutoplay();
    mostrarSwipeHintBanner();
  }

  // Pequeño gesto de una sola vez: sugiere que el banner se puede deslizar
  // (los flechas quedan ocultas en celular, así que este es el único indicio).
  function mostrarSwipeHintBanner(){
    if(bannerSlides.length < 2) return;
    try{ if(localStorage.getItem('banner-swipe-hint-shown')) return; }catch(e){}
    const viewport = document.querySelector('.banner-viewport');
    if(!viewport || window.innerWidth > 640) return;
    viewport.classList.add('hint');
    setTimeout(()=> viewport.classList.remove('hint'), 1600);
    try{ localStorage.setItem('banner-swipe-hint-shown', '1'); }catch(e){}
  }

  function updateBannerCaption(){
    const s = bannerSlides[bannerIndex];
    bannerCaption.innerHTML = '';
    if(!s) return;
    if(s.tag){
      const tag = document.createElement('span');
      tag.className = 'banner-tag';
      tag.textContent = s.tag;
      bannerCaption.appendChild(tag);
    }
    if(s.title || s.subtitle){
      const texts = document.createElement('div');
      texts.className = 'banner-texts';
      if(s.title){
        const t = document.createElement('div');
        t.className = 'banner-title';
        t.textContent = s.title;
        texts.appendChild(t);
      }
      if(s.subtitle){
        const sub = document.createElement('div');
        sub.className = 'banner-subtitle';
        sub.textContent = s.subtitle;
        texts.appendChild(sub);
      }
      bannerCaption.appendChild(texts);
    }
  }

  function updateBannerPosition(){
    bannerTrack.style.transform = 'translateX(-' + (bannerIndex * 100) + '%)';
    bannerDots.querySelectorAll('.banner-dot').forEach((d,i)=> d.classList.toggle('active', i===bannerIndex));
    updateBannerCaption();
    const s = bannerSlides[bannerIndex];
    const hasCaption = !!(s && (s.tag || s.title || s.subtitle));
    const hasControls = bannerSlides.length > 1;
    // Sin texto: puntitos flotando sobre la imagen (sin barra oscura).
    // Con texto: barra normal debajo.
    if(hasCaption){
      bannerBar.style.display = 'flex';
      banner.classList.remove('dots-overlay');
    } else if(hasControls){
      bannerBar.style.display = 'flex';
      banner.classList.add('dots-overlay');
    } else {
      bannerBar.style.display = 'none';
      banner.classList.remove('dots-overlay');
    }
  }

  function goToBannerSlide(i){
    bannerIndex = (i + bannerSlides.length) % bannerSlides.length;
    updateBannerPosition();
    startBannerAutoplay();
  }

  function startBannerAutoplay(){
    clearInterval(bannerTimer);
    bannerDots.classList.remove('pausado');
    if(bannerSlides.length < 2) return;
    bannerTimer = setInterval(()=> goToBannerSlide(bannerIndex + 1), 5000);
  }
  function pauseBannerAutoplay(){
    clearInterval(bannerTimer);
    bannerDots.classList.add('pausado');
  }

  bannerPrev.addEventListener('click', ()=> goToBannerSlide(bannerIndex - 1));
  bannerNext.addEventListener('click', ()=> goToBannerSlide(bannerIndex + 1));
  banner.addEventListener('mouseenter', ()=> pauseBannerAutoplay());
  banner.addEventListener('mouseleave', ()=> startBannerAutoplay());
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) pauseBannerAutoplay(); else startBannerAutoplay();
  });

  // ---- Deslizar (swipe con dedo o arrastre con mouse) ----
  let dragStartX = 0, dragDeltaX = 0, dragging = false, dragMoved = false;

  function dragStart(clientX){
    if(bannerSlides.length < 2) return;
    dragging = true; dragMoved = false;
    dragStartX = clientX; dragDeltaX = 0;
    pauseBannerAutoplay();
    bannerTrack.classList.add('dragging');
  }
  function dragMove(clientX){
    if(!dragging) return;
    dragDeltaX = clientX - dragStartX;
    if(Math.abs(dragDeltaX) > 6) dragMoved = true;
    const pct = (dragDeltaX / bannerTrack.offsetWidth) * 100;
    bannerTrack.style.transform = 'translateX(' + (-bannerIndex * 100 + pct) + '%)';
  }
  function dragEnd(){
    if(!dragging) return;
    dragging = false;
    bannerTrack.classList.remove('dragging');
    const threshold = bannerTrack.offsetWidth * 0.18; // 18% del ancho para cambiar
    if(dragDeltaX <= -threshold){ goToBannerSlide(bannerIndex + 1); }
    else if(dragDeltaX >= threshold){ goToBannerSlide(bannerIndex - 1); }
    else { updateBannerPosition(); startBannerAutoplay(); }
  }

  // Táctil
  bannerTrack.addEventListener('touchstart', (e)=> dragStart(e.touches[0].clientX), {passive:true});
  bannerTrack.addEventListener('touchmove', (e)=> dragMove(e.touches[0].clientX), {passive:true});
  bannerTrack.addEventListener('touchend', dragEnd);
  // Mouse (arrastre en escritorio)
  bannerTrack.addEventListener('mousedown', (e)=>{ e.preventDefault(); dragStart(e.clientX); });
  window.addEventListener('mousemove', (e)=>{ if(dragging) dragMove(e.clientX); });
  window.addEventListener('mouseup', dragEnd);
  // Evitar que un arrastre dispare el clic del enlace del slide
  bannerTrack.addEventListener('click', (e)=>{ if(dragMoved){ e.preventDefault(); e.stopPropagation(); } }, true);

  function renderSlideList(){
    slideList.innerHTML = '';
    if(!bannerSlides.length){
      const empty = document.createElement('div');
      empty.className = 'slide-empty';
      empty.textContent = 'Todavía no tienes slides. Agrega el primero.';
      slideList.appendChild(empty);
      return;
    }
    bannerSlides.forEach(s=>{
      const row = document.createElement('div');
      row.className = 'slide-row';
      const img = document.createElement('img');
      img.src = imgSrc(s.image);
      img.style.objectPosition = imgPos(s.image);
      row.appendChild(img);
      const info = document.createElement('div');
      info.className = 'slide-info';
      const title = document.createElement('div');
      title.className = 'slide-title';
      title.textContent = s.title || '(sin título)';
      info.appendChild(title);
      if(s.subtitle){
        const sub = document.createElement('div');
        sub.className = 'slide-sub';
        sub.textContent = s.subtitle;
        info.appendChild(sub);
      }
      row.appendChild(info);
      const editB = document.createElement('button');
      editB.className = 'icon-btn';
      editB.title = 'Editar';
      editB.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
      editB.addEventListener('click', ()=> openSlideEdit(s));
      row.appendChild(editB);
      slideList.appendChild(row);
    });
  }

  function resetSlideForm(){
    editingSlideId = null;
    slidePendingImage = null;
    slidePendingImageMobile = null;
    slideTagInput.value = '';
    slideTitleInput.value = '';
    slideSubInput.value = '';
    slideThumbStrip.innerHTML = '';
    slideThumbStripMobile.innerHTML = '';
    slideUploadHint.textContent = 'Toca para subir la foto de escritorio';
    slideUploadHintMobile.textContent = 'Toca para subir la foto de celular';
    slideImageInput.value = '';
    slideImageInputMobile.value = '';
    slideDeleteRow.style.display = 'none';
    validateSlideForm();
  }

  function validateSlideForm(){
    slideSave.disabled = !slidePendingImage;
  }

  function renderSlideThumb(){
    slideThumbStrip.innerHTML = '';
    if(!slidePendingImage) return;
    const t = document.createElement('div');
    t.className = 'thumb';
    const img = document.createElement('img');
    img.src = imgSrc(slidePendingImage);
    img.style.objectPosition = imgPos(slidePendingImage);
    t.appendChild(img);
    const frameBtn = document.createElement('button');
    frameBtn.type = 'button';
    frameBtn.className = 'frame-btn';
    frameBtn.title = 'Encuadrar foto';
    frameBtn.innerHTML = FRAME_ICON;
    frameBtn.addEventListener('click', ()=>{
      openCropTool({
        src: imgSrc(slidePendingImage), pos: imgPos(slidePendingImage), ratio: '5/2',
        title: 'Encuadrar foto de escritorio',
        onSave: (newPos)=>{ slidePendingImage.pos = newPos; renderSlideThumb(); }
      });
    });
    t.appendChild(frameBtn);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.innerHTML = '&times;';
    rm.addEventListener('click', ()=>{
      slidePendingImage = null;
      renderSlideThumb();
      validateSlideForm();
    });
    t.appendChild(rm);
    slideThumbStrip.appendChild(t);
  }

  function renderSlideThumbMobile(){
    slideThumbStripMobile.innerHTML = '';
    if(!slidePendingImageMobile) return;
    const t = document.createElement('div');
    t.className = 'thumb';
    const img = document.createElement('img');
    img.src = imgSrc(slidePendingImageMobile);
    img.style.objectPosition = imgPos(slidePendingImageMobile);
    t.appendChild(img);
    const frameBtn = document.createElement('button');
    frameBtn.type = 'button';
    frameBtn.className = 'frame-btn';
    frameBtn.title = 'Encuadrar foto';
    frameBtn.innerHTML = FRAME_ICON;
    frameBtn.addEventListener('click', ()=>{
      openCropTool({
        src: imgSrc(slidePendingImageMobile), pos: imgPos(slidePendingImageMobile), ratio: '1/1',
        title: 'Encuadrar foto de celular',
        onSave: (newPos)=>{ slidePendingImageMobile.pos = newPos; renderSlideThumbMobile(); }
      });
    });
    t.appendChild(frameBtn);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.innerHTML = '&times;';
    rm.addEventListener('click', ()=>{
      slidePendingImageMobile = null;
      renderSlideThumbMobile();
    });
    t.appendChild(rm);
    slideThumbStripMobile.appendChild(t);
  }

  slideImageInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    slideUploadHint.textContent = 'Subiendo foto a la nube...';
    try{
      const blob = await resizeImageToBlob(file);
      slidePendingImage = { src: await window.fbUploadImage(blob), pos: '50% 50%' };
      renderSlideThumb();
      slideUploadHint.textContent = 'Toca para cambiar la foto';
    }catch(err){
      console.error(err);
      slideUploadHint.textContent = 'No se pudo subir, intenta otra foto.';
    }
    slideImageInput.value = '';
    validateSlideForm();
  });

  slideImageInputMobile.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    slideUploadHintMobile.textContent = 'Subiendo foto a la nube...';
    try{
      const blob = await resizeImageToBlob(file);
      slidePendingImageMobile = { src: await window.fbUploadImage(blob), pos: '50% 50%' };
      renderSlideThumbMobile();
      slideUploadHintMobile.textContent = 'Toca para cambiar la foto';
    }catch(err){
      console.error(err);
      slideUploadHintMobile.textContent = 'No se pudo subir, intenta otra foto.';
    }
    slideImageInputMobile.value = '';
  });

  function openSlideAdd(){
    resetSlideForm();
    slideModalTitle.textContent = 'Agregar slide';
    slideOverlay.classList.add('show');
    setTimeout(()=> slideGuard.snapshot(), 50);
  }

  function openSlideEdit(s){
    resetSlideForm();
    editingSlideId = s.id;
    slidePendingImage = normalizeImg(s.image);
    slidePendingImageMobile = s.imageMobile ? normalizeImg(s.imageMobile) : null;
    slideTagInput.value = s.tag || '';
    slideTitleInput.value = s.title || '';
    slideSubInput.value = s.subtitle || '';
    renderSlideThumb();
    renderSlideThumbMobile();
    slideModalTitle.textContent = 'Editar slide';
    slideDeleteRow.style.display = 'block';
    validateSlideForm();
    slideOverlay.classList.add('show');
    setTimeout(()=> slideGuard.snapshot(), 50);
  }

  bannerBtn.addEventListener('click', ()=>{
    renderSlideList();
    bannerListOverlay.classList.add('show');
  });
  bannerListClose.addEventListener('click', ()=> bannerListOverlay.classList.remove('show'));
  bannerListOverlay.addEventListener('click', (e)=>{ if(e.target===bannerListOverlay) bannerListOverlay.classList.remove('show'); });
  addSlideBtn.addEventListener('click', ()=>{
    bannerListOverlay.classList.remove('show');
    openSlideAdd();
  });

  const slideGuard = makeDirtyGuard(()=> [slideTagInput.value, slideTitleInput.value, slideSubInput.value, slidePendingImage, slidePendingImageMobile]);
  function closeSlideForm(force){
    confirmDiscard(slideGuard, force, ()=> slideOverlay.classList.remove('show'));
  }
  slideCancel.addEventListener('click', ()=> closeSlideForm());
  slideOverlay.addEventListener('click', (e)=>{ if(e.target===slideOverlay) closeSlideForm(); });

  slideSave.addEventListener('click', async ()=>{
    if(!slidePendingImage) return;
    if(editingSlideId){
      const s = bannerSlides.find(x=>x.id===editingSlideId);
      s.image = slidePendingImage; s.imageMobile = slidePendingImageMobile || null;
      s.tag = slideTagInput.value.trim();
      s.title = slideTitleInput.value.trim(); s.subtitle = slideSubInput.value.trim();
      showToast('Slide actualizado');
    } else {
      bannerSlides.push({
        id: 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
        image: slidePendingImage, imageMobile: slidePendingImageMobile || null,
        tag: slideTagInput.value.trim(),
        title: slideTitleInput.value.trim(), subtitle: slideSubInput.value.trim()
      });
      showToast('Slide agregado');
    }
    closeSlideForm(true);
    await saveBannerSlides();
    renderBanner();
  });

  slideDeleteBtn.addEventListener('click', async ()=>{
    if(!editingSlideId) return;
    if(!confirm('¿Eliminar este slide del banner?')) return;
    bannerSlides = bannerSlides.filter(s=>s.id!==editingSlideId);
    closeSlideForm(true);
    await saveBannerSlides();
    renderBanner();
    showToast('Slide eliminado');
  });

  async function getPin(){
    // Si la consulta a la nube tarda demasiado (conexión lenta o bloqueada),
    // no dejamos el botón colgado sin respuesta: seguimos con el PIN de fábrica.
    const consulta = (async ()=>{
      const res = await window.storage.get(PIN_KEY, true);
      return res ? res.value : DEFAULT_PIN;
    })();
    const limite = new Promise(resolve => setTimeout(()=> resolve(DEFAULT_PIN), 5000));
    try{
      return await Promise.race([consulta, limite]);
    }catch(e){
      return DEFAULT_PIN;
    }
  }

  async function setPin(v){
    try{ await window.storage.set(PIN_KEY, v, true); }catch(e){}
  }

  // ---------- rendering ----------
  // Las fotos se guardan como {src, pos} (pos = punto de encuadre, ej. "50% 30%").
  // Estas funciones también aceptan fotos antiguas guardadas como texto simple (solo el link),
  // para que el catálogo existente siga funcionando sin tener que re-subir nada.
  function imgSrc(im){ return (im && typeof im === 'object') ? (im.src || '') : (im || ''); }
  function imgPos(im){ return (im && typeof im === 'object' && im.pos) ? im.pos : '50% 50%'; }
  function normalizeImg(im){
    if(!im) return null;
    return (typeof im === 'object') ? { src: im.src || '', pos: im.pos || '50% 50%' } : { src: im, pos: '50% 50%' };
  }

  // Acepta cualquier formato de link de YouTube (watch, youtu.be, embed, shorts, con o sin parámetros extra)
  // y devuelve solo el ID del video, o null si no lo reconoce.
  function extractYouTubeId(url){
    if(!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function money(v){
    const n = Number(v);
    // Los precios nunca llevan centavos (siempre son montos enteros).
    return 'S/\u00A0' + (Number.isInteger(n) ? n : Math.round(n));
  }

  // Versión con la moneda y los centavos (si los hay) en superíndice, para las
  // tarjetas de producto. Si el precio es un entero no se agrega nada de más.
  function moneyHtml(v){
    const n = Number(v);
    const whole = Math.floor(n);
    const cents = Math.round((n - whole) * 100);
    let html = '<span class="price-currency">S/</span>' + whole;
    if(cents > 0) html += '<sup class="price-cents">' + String(cents).padStart(2,'0') + '</sup>';
    return html;
  }

  function stateLabel(s){
    return {disponible:'Disponible', preventa:'Preventa', vendido:'Vendido'}[s] || s;
  }

  function categoryLabel(c){
    return {figuras:'Figuras', peluches:'Peluches', tcg:'TCG', gaming:'Gaming', accesorios:'Accesorios', hogar:'Hogar', otros:'Otros'}[c] || 'Otros';
  }

  function sortProducts(list){
    const arr = list.slice();
    if(currentSort === 'precio-asc') arr.sort((a,b)=> a.price - b.price);
    else if(currentSort === 'precio-desc') arr.sort((a,b)=> b.price - a.price);
    else if(currentSort === 'ofertas'){
      const disc = p => (p.oldPrice && p.oldPrice > p.price) ? (1 - p.price / p.oldPrice) : -1;
      arr.sort((a,b)=>{
        const d = disc(b) - disc(a);
        return d !== 0 ? d : (b.createdAt - a.createdAt);
      });
    }
    else arr.sort((a,b)=> b.createdAt - a.createdAt);
    // Los productos vendidos siempre van al final, sin importar el orden elegido arriba
    // (el sort de JS es estable, así que no altera el orden dentro de cada grupo).
    arr.sort((a,b)=> (a.status==='vendido'?1:0) - (b.status==='vendido'?1:0));
    return arr;
  }

  // Normaliza texto para búsqueda: minúsculas y sin tildes.
  function normSearch(s){
    return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  // Distancia de edición (para tolerar errores de tipeo).
  function editDistance(a, b){
    const m = a.length, n = b.length;
    if(!m) return n; if(!n) return m;
    let prev = Array.from({length:n+1}, (_,i)=>i);
    for(let i=1;i<=m;i++){
      let cur = [i];
      for(let j=1;j<=n;j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost);
      }
      prev = cur;
    }
    return prev[n];
  }
  // ¿El término de búsqueda coincide con el texto, tolerando tildes y typos?
  function fuzzyMatch(term, text){
    const t = normSearch(term).trim();
    if(!t) return true;
    const nt = normSearch(text);
    if(nt.includes(t)) return true; // coincidencia directa (rápida)
    const words = nt.split(/[^a-z0-9]+/).filter(Boolean);
    const tokens = t.split(/\s+/).filter(Boolean);
    return tokens.every(tok=>{
      if(nt.includes(tok)) return true;
      if(tok.length <= 3) return false; // términos muy cortos: sin tolerancia a errores, evita falsos positivos
      const maxDist = tok.length <= 5 ? 1 : (tok.length <= 8 ? 1 : 2);
      return words.some(w=>{
        if(w.includes(tok)) return true;
        if(Math.abs(w.length - tok.length) > maxDist) {
          // aún permite typo contra el arranque de una palabra más larga
          if(w.length > tok.length) return editDistance(tok, w.slice(0, tok.length)) <= maxDist;
          return false;
        }
        return editDistance(tok, w) <= maxDist;
      });
    });
  }
  // Rango de precio activo -> ¿el precio cae dentro?

  function render(keepPosition){
    const term = searchTerm.trim().toLowerCase();
    const filtered = sortProducts(products.filter(p=>{
      if(currentFilter === 'all'){
        if(p.status === 'vendido' && !term) return false;
      } else if(p.status !== currentFilter){
        return false;
      }
      if(showOnlyMix && !(Array.isArray(p.variants) && p.variants.length)) return false;
      if(activeCategories.size > 0 && !activeCategories.has(p.category || 'otros')) return false;
      const _precio = Number(p.price) || 0;
      if(precioMin !== null && _precio < precioMin) return false;
      if(precioMax !== null && _precio > precioMax) return false;
      if(window._soloOfertas && !(p.oldPrice && p.oldPrice > p.price)) return false;
      const variantNames = Array.isArray(p.variants) ? p.variants.map(v=> v.name || '').join(' ') : '';
      if(term && !fuzzyMatch(searchTerm, (p.name || '') + ' ' + (p.desc || '') + ' ' + (p.category || '') + ' ' + variantNames + ' ' + (Array.isArray(p.tags) ? p.tags.join(' ') : (p.tags || '')))) return false;
      return true;
    }));

    // Si venimos de guardar/eliminar un producto (no de cambiar un filtro),
    // recordamos cuántas tarjetas y en qué punto de scroll estaba el admin,
    // para no devolverlo al inicio de la lista.
    const prevShownCount = shownCount;
    const prevScrollY = keepPosition ? window.scrollY : 0;

    grid.innerHTML = '';
    const hasActiveFilters = currentFilter !== 'all' || activeCategories.size > 0 || precioMin !== null || precioMax !== null || term !== '' || showOnlyMix;
    const clearInline = document.getElementById('clearFiltersInline');
    if(clearInline) clearInline.hidden = !hasActiveFilters;

    if(filtered.length === 0){
      emptyState.style.display = 'block';
      resultCount.style.display = 'none';
      const emptyIcon = document.getElementById('emptyIconImg');
      if(products.length === 0){
        emptyTitle.textContent = 'La vitrina está vacía';
        emptySub.textContent = isAdmin ? 'Toca "Agregar producto" para subir el primero.' : 'Vuelve pronto, estamos preparando el catálogo.';
        emptyActions.style.display = 'none';
      } else {
        emptyTitle.textContent = 'Sin resultados';
        emptySub.textContent = 'No encontramos nada con esos filtros. ¿Buscas algo puntual?';
        emptyActions.style.display = 'flex';
        emptyWaBtn.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(
          term ? `¡Hola! Estoy buscando "${searchTerm.trim()}" en el catálogo. ¿Lo tienen o lo pueden conseguir?`
               : '¡Hola! Estoy buscando un producto en específico. ¿Me pueden ayudar?');
      }
    } else {
      emptyState.style.display = 'none';
      const n = filtered.length;
      if(term === ''){
        resultCount.style.display = 'none';
      } else {
        resultCount.style.display = 'block';
        const label = hasActiveFilters
          ? (n === 1 ? ' producto encontrado' : ' productos encontrados')
          : (n === 1 ? ' producto' : ' productos');
        animateCount(resultCount, n, label);
      }
    }

    filteredCache = filtered;
    shownCount = 0;
    if(keepPosition && prevShownCount > 0){
      const target = Math.min(prevShownCount, filteredCache.length);
      while(shownCount < target) renderNextPage();
    } else {
      renderNextPage();
    }

    updateProductsJsonLd();
    renderCatalogTeaser();
    renderOfertas();
    renderNewArrivals();
    renderPreventas();

    if(keepPosition){
      requestAnimationFrame(()=> window.scrollTo(0, prevScrollY));
    }
  }

  const PAGE_SIZE = 24;
  let filteredCache = [];
  let shownCount = 0;

  function renderCatalogTeaser(){
    const row = document.getElementById('catalogTeaserRow');
    const section = document.getElementById('catalogTeaserSection');
    const fullView = document.getElementById('catalogFullView');
    if(!row || !section) return;
    // Si el catálogo completo ya está abierto, la muestra no hace falta.
    if(fullView && fullView.style.display !== 'none'){
      section.style.display = 'none';
      return;
    }
    const sample = products.filter(p=> p.status !== 'vendido').slice(0, 8);
    row.innerHTML = '';
    if(sample.length === 0){
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    sample.forEach(p=> row.appendChild(buildCard(p)));

    const verTodos = document.createElement('button');
    verTodos.type = 'button';
    verTodos.className = 'ver-todos-card';
    verTodos.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg><span>Ver todo el catálogo</span>';
    verTodos.addEventListener('click', openFullCatalog);
    row.appendChild(verTodos);
  }

  // Enlaces "Ver todo" de los encabezados de sección.
  document.querySelectorAll('[data-vertodo]').forEach(b=>{
    b.addEventListener('click', ()=> openFullCatalog());
  });

  function openFullCatalog(){
    abrirCatalogoCompleto();
    render();
    const target = document.querySelector('#catalogFullView .catalogo-title');
    if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
  }

  // Abre la vista completa del catálogo sin desplazar la pantalla.
  // La usa la búsqueda: mostrar resultados sin saltar en cada letra.
  function abrirCatalogoCompleto(){
    const teaser = document.getElementById('catalogTeaserSection');
    const fullView = document.getElementById('catalogFullView');
    if(teaser) teaser.style.display = 'none';
    if(fullView && fullView.style.display === 'none'){ fullView.style.display = 'block'; moveChipThumb(); }
  }

  // Cierra el catálogo completo y vuelve al adelanto. Se usa al navegar a otras
  // secciones (Cómo comprar, Nosotros), que quedan debajo del catálogo desplegado.
  function cerrarCatalogoCompleto(){
    const fullView = document.getElementById('catalogFullView');
    // Si no estaba abierto, no hay nada que cerrar (evita reordenar de más).
    if(!fullView || fullView.style.display === 'none') return;
    fullView.style.display = 'none';
    const teaser = document.getElementById('catalogTeaserSection');
    if(teaser) teaser.style.display = 'block';
    renderCatalogTeaser();
  }

  // Los tres mosaicos van juntos en una fila (#destacadosGrid). Estas tres
  // funciones se mantienen por compatibilidad, pero todas llaman al render unificado.
  function renderOfertas(){ renderDestacados(); }

  function productosDe(clave){
    if(clave === 'novedades'){
      return products.filter(p=> p.status !== 'vendido')
        .slice().sort((a,b)=> b.createdAt - a.createdAt).slice(0, 10);
    }
    if(clave === 'ofertas'){
      return products.filter(p=> p.status !== 'vendido' && p.oldPrice && p.oldPrice > p.price)
        .slice().sort((a,b)=> ((b.oldPrice-b.price)/b.oldPrice) - ((a.oldPrice-a.price)/a.oldPrice)).slice(0, 8);
    }
    if(clave === 'preventas'){
      return products.filter(p=> p.status === 'preventa')
        .slice().sort((a,b)=> b.createdAt - a.createdAt).slice(0, 10);
    }
    if(clave === 'mix'){
      return products.filter(p=> Array.isArray(p.variants) && p.variants.length)
        .slice().sort((a,b)=> b.createdAt - a.createdAt).slice(0, 10);
    }
    return [];
  }

  function renderDestacados(){
    const grid = document.getElementById('destacadosGrid');
    const section = document.getElementById('destacadosPortada');
    if(!grid || !section) return;
    grid.innerHTML = '';
    const ordenValido = ['novedades','ofertas','preventas','mix'];
    const ordenGuardado = (Array.isArray(siteContent.mosaicoOrden) ? siteContent.mosaicoOrden.filter(c=> ordenValido.includes(c)) : []);
    const orden = ordenGuardado.concat(ordenValido.filter(c=> !ordenGuardado.includes(c)));
    let mostrados = 0;
    orden.forEach(clave=>{
      const cfg = (siteContent.mosaicos && siteContent.mosaicos[clave]) || {};
      if(cfg.activo === false) return;
      const prods = productosDe(clave);
      // si no hay banner propio y no hay productos, no mostramos ese mosaico
      const tieneBanner = cfg.modo === 'banner' && cfg.banner;
      if(!tieneBanner && prods.length === 0) return;
      grid.appendChild(construirMosaico(clave, prods, ()=> irACatalogoConFiltro(clave)));
      mostrados++;
    });
    section.style.display = mostrados > 0 ? 'block' : 'none';
    grid.className = 'destacados-grid n' + mostrados;
    // las secciones viejas quedan ocultas (sus IDs siguen existiendo para la navegación)
    ['newArrivalsSection','ofertasSection','preventasSection'].forEach(id=>{
      const sec = document.getElementById(id);
      if(sec) sec.style.display = 'none';
    });
  }


  // ---------- mosaicos de categoría (Novedades / Ofertas / Preventas) ----------
  // Construye una tarjeta grande (Estilo 2: una foto protagonista + 3 pequeñas)
  // que lleva al catálogo con el filtro de esa categoría activo.
  function primeraFoto(p){
    // imgSrc extrae el enlace real (las fotos se guardan como {src, pos}).
    if(Array.isArray(p.images) && p.images.length) return imgSrc(p.images[0]);
    if(p.image) return imgSrc(p.image);
    return null;
  }

  const MOSAICO_DEFAULTS = {
    novedades: { eyebrow:'Recién llegados', titulo:'Novedades' },
    ofertas:   { eyebrow:'Por tiempo limitado', titulo:'Ofertas' },
    preventas: { eyebrow:'Asegura el tuyo', titulo:'Preventas' },
    mix:       { eyebrow:'Completa tu cole', titulo:'Sueltos' }
  };
  function construirMosaico(clave, productos, onClick){
    const cfg = (siteContent.mosaicos && siteContent.mosaicos[clave]) || {};
    const def = MOSAICO_DEFAULTS[clave] || {};
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mosaico mosaico-' + clave;
    card.addEventListener('click', onClick);

    // fondo: banner propio si el admin lo puso, o mosaico automático
    if(cfg.modo === 'banner' && cfg.banner){
      const bg = document.createElement('div');
      bg.className = 'mosaico-bg';
      bg.style.backgroundImage = 'url(' + cfg.banner + ')';
      card.appendChild(bg);
    } else {
      const fotos = productos.map(primeraFoto).filter(Boolean).slice(0, 4);
      if(fotos.length){
        const main = document.createElement('div');
        main.className = 'mosaico-main';
        card.appendChild(main);
        // Muestra fondo animado hasta que la foto principal cargue (evita el gris).
        card.classList.add('mosaico-cargando');
        const pre = new Image();
        pre.onload = ()=>{
          main.style.backgroundImage = 'url(' + fotos[0] + ')';
          card.classList.remove('mosaico-cargando');
        };
        pre.onerror = ()=> card.classList.remove('mosaico-cargando');
        pre.src = fotos[0];
        if(fotos.length > 1){
          const mini = document.createElement('div');
          mini.className = 'mosaico-mini';
          fotos.slice(1, 4).forEach(f=>{
            const d = document.createElement('div');
            d.style.backgroundImage = 'url(' + f + ')';
            mini.appendChild(d);
          });
          card.appendChild(mini);
        }
      } else {
        // sin fotos: fondo de color liso (no se rompe)
        card.classList.add('mosaico-vacio');
      }
    }

    const velo = document.createElement('div');
    velo.className = 'mosaico-velo';
    card.appendChild(velo);

    const ct = document.createElement('div');
    ct.className = 'mosaico-ct';
    ct.innerHTML = '<div class="mosaico-eb">' + (cfg.eyebrow || def.eyebrow || '') + '</div>' +
                   '<div class="mosaico-tt">' + (cfg.titulo || def.titulo || '') + '</div>' +
                   '<span class="mosaico-go">Ver todo ›</span>';
    card.appendChild(ct);
    return card;
  }



  // Abre el catálogo completo aplicando un filtro concreto (para los mosaicos).
  // El banner de "Ofertas" no tiene chip visible que lo represente; si queda activo
  // y el usuario busca algo, hay que soltarlo para no limitar la búsqueda a esas ofertas.
  // Los chips "Preventa" y "Sueltos" sí son visibles, así que la búsqueda los respeta.
  function limpiarFiltrosDeBanner(){
    if(window._soloOfertas) window._soloOfertas = false;
  }

  // Al escribir una búsqueda, el chip de estado (Disponible/Preventa/Vendido) se
  // desactiva y vuelve a "Todos" — pero el usuario puede volver a aplicar un chip
  // después, y ese filtro se combina normalmente con el término buscado.
  function resetChipDeEstadoPorBusqueda(){
    if(currentFilter === 'all') return;
    currentFilter = 'all';
    filterChips.querySelectorAll('.chip').forEach(c=> c.classList.toggle('active', c.dataset.filter === 'all'));
    moveChipThumb();
  }

  function irACatalogoConFiltro(tipo){
    // limpia filtros previos
    currentFilter = 'all';
    activeCategories.clear();
    precioMin = null; precioMax = null;
    window._soloOfertas = false;
    searchTerm = '';
    showOnlyMix = false;
    mixToggle.classList.remove('active');
    if(tipo === 'ofertas'){
      // ofertas = productos con precio anterior (descuento). Se marca por orden especial.
      currentFilter = 'all';
      window._soloOfertas = true;
    } else if(tipo === 'mix'){
      currentFilter = 'all';
      showOnlyMix = true;
      mixToggle.classList.add('active');
    } else {
      window._soloOfertas = false;
      if(tipo === 'preventas') currentFilter = 'preventa';
      else currentFilter = 'all'; // novedades = todo, ya viene ordenado por reciente
    }
    // reflejar en los chips de filtro
    const fc = document.getElementById('filterChips');
    if(fc) fc.querySelectorAll('.chip').forEach(c=> c.classList.toggle('active', c.dataset.filter === currentFilter));
    moveChipThumb();
    abrirCatalogoCompleto();
    render();
    const target = document.querySelector('#catalogFullView .catalogo-title');
    if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function renderNewArrivals(){ renderDestacados(); }
  function renderPreventas(){ renderDestacados(); }

  function renderNextPage(){
    const slice = filteredCache.slice(shownCount, shownCount + PAGE_SIZE);
    slice.forEach((p,i)=>{
      const card = buildCard(p);
      card.classList.add('card-enter');
      card.style.animationDelay = Math.min(i, 10) * 35 + 'ms';
      grid.appendChild(card);
    });
    shownCount += slice.length;
    updateLoadMore();
  }

  function updateLoadMore(){
    const lmText = loadMoreBtn.querySelector('.lm-text');
    if(shownCount < filteredCache.length){
      loadMoreWrap.style.display = 'flex';
      if(lmText) lmText.textContent = 'Ver más (' + (filteredCache.length - shownCount) + ' restantes)';
    } else {
      loadMoreWrap.style.display = 'none';
    }
    loadMoreBtn.classList.remove('loading');
  }

  function buildCard(p){
      const card = document.createElement('div');
      card.className = 'card ' + p.status + (p.shiny ? ' shiny' : '') + ((Array.isArray(p.variants) && p.variants.length) ? ' card-lot' : '');
      card.dataset.pid = p.id;
      card.addEventListener('mousemove', (e)=>{
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX-r.left)+'px');
        card.style.setProperty('--my', (e.clientY-r.top)+'px');
      });
      card.addEventListener('click', (e)=>{
        if(e.target.closest('.card-nav, .wa-btn, .icon-btn, .mini-btn, .zoom-hint, .card-dots, .card-zoom-btn')) return;
        if(isAdmin && modoSeleccion){ alternarSeleccion(p.id, card); return; }
        openQuickView(p);
      });

      const shine = document.createElement('div');
      shine.className = 'card-shine';
      card.appendChild(shine);

      const images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
      const media = document.createElement('div');
      media.className = 'card-media';

      if(p.status !== 'disponible'){
        const badge = document.createElement('div');
        badge.className = 'badge ' + p.status;
        badge.textContent = stateLabel(p.status);
        media.appendChild(badge);
      }

      const NEW_MS = 7*24*60*60*1000;
      if(Date.now() - p.createdAt < NEW_MS){
        const newBadge = document.createElement('div');
        newBadge.className = 'badge-new';
        newBadge.textContent = 'Nuevo';
        media.appendChild(newBadge);
      }

      if(Array.isArray(p.variants) && p.variants.length && images.length){
        const zoomBtn = document.createElement('button');
        zoomBtn.type = 'button';
        zoomBtn.className = 'card-zoom-btn';
        zoomBtn.title = 'Ver foto en grande';
        zoomBtn.setAttribute('aria-label', 'Ver foto en grande');
        zoomBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" stroke-linecap="round"/></svg>';
        zoomBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openLightbox(images, 0); });
        media.appendChild(zoomBtn);
      }

      const hasDiscount = p.oldPrice && p.oldPrice > p.price;
      if(hasDiscount){
        const discountBadge = document.createElement('div');
        discountBadge.className = 'badge-discount';
        discountBadge.textContent = '-' + Math.round((1 - p.price / p.oldPrice) * 100) + '%';
        media.appendChild(discountBadge);
      }

      // Estrellita (SVG) reutilizada por preventa y shiny.
      const SPARK_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z"/></svg>';
      if(p.status === 'preventa'){
        media.insertAdjacentHTML('beforeend',
          '<span class="pv-spark a">'+SPARK_SVG+'</span><span class="pv-spark b">'+SPARK_SVG+'</span>');
      }
      if(p.shiny){
        media.insertAdjacentHTML('beforeend',
          '<span class="badge-shiny">'+SPARK_SVG+' TOP</span>' +
          '<span class="sh-spark a">'+SPARK_SVG+'</span>' +
          '<span class="sh-spark b">'+SPARK_SVG+'</span>' +
          '<span class="sh-spark c">'+SPARK_SVG+'</span>');
      }


      if(images.length){
        let idx = 0;
        const track = document.createElement('div');
        track.className = 'card-track';
        // Solo se descarga la PRIMERA foto. Las demás esperan a que el cliente
        // navegue el carrusel: un producto con 6 fotos ya no pesa 6 fotos de entrada.
        images.forEach((im, i)=>{
          const img = document.createElement('img');
          img.loading = 'lazy';
          img.decoding = 'async';
          img.style.objectPosition = imgPos(im);
          img.alt = p.name;
          if(i === 0){ img.src = imgSrc(im); }
          else { img.dataset.src = imgSrc(im); }
          img.addEventListener('load', ()=> img.classList.add('cargada'));
          img.addEventListener('error', ()=>{ img.classList.add('img-broken'); img.classList.add('cargada'); });
          track.appendChild(img);
        });
        // Muestra el fondo animado hasta que la primera foto esté lista.
        media.classList.add('cargando-foto');
        const primera = track.querySelector('img');
        if(primera){
          const listo = ()=> media.classList.remove('cargando-foto');
          if(primera.complete && primera.naturalWidth) listo();
          else { primera.addEventListener('load', listo); primera.addEventListener('error', listo); }
        }
        media.appendChild(track);

        if(images.length > 1){
          const prev = document.createElement('button');
          prev.className = 'card-nav prev'; prev.type = 'button';
          prev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 6l-6 6 6 6"/></svg>';
          const next = document.createElement('button');
          next.className = 'card-nav next'; next.type = 'button';
          next.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg>';
          const dots = document.createElement('div');
          dots.className = 'card-dots';
          images.forEach((_,i)=>{
            const d = document.createElement('span');
            if(i===0) d.classList.add('active');
            dots.appendChild(d);
          });
          function cargarFoto(i){
            const im = track.children[i];
            if(im && im.dataset && im.dataset.src){
              im.src = im.dataset.src;
              delete im.dataset.src;
            }
          }
          function goTo(i){
            idx = (i + images.length) % images.length;
            cargarFoto(idx);
            cargarFoto((idx + 1) % images.length); // adelanta la siguiente
            track.style.transform = 'translateX(-' + (idx*100) + '%)';
            dots.querySelectorAll('span').forEach((d,di)=> d.classList.toggle('active', di===idx));
          }
          prev.addEventListener('click', (e)=>{ e.stopPropagation(); goTo(idx-1); });
          next.addEventListener('click', (e)=>{ e.stopPropagation(); goTo(idx+1); });
          media.appendChild(prev);
          media.appendChild(next);
          media.appendChild(dots);
        }
      } else {
        const ph = document.createElement('div');
        ph.className = 'card-img placeholder';
        ph.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.7"/><path d="M21 15l-5-5L5 21"/></svg>';
        media.appendChild(ph);
      }
      card.appendChild(media);

      const body = document.createElement('div');
      body.className = 'card-body';

      const name = document.createElement('p');
      name.className = 'card-name';
      name.textContent = p.name;
      body.appendChild(name);

      if(p.status === 'preventa' && p.expectedDate){
        const eta = document.createElement('p');
        eta.className = 'card-eta';
        eta.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4" stroke-linecap="round"/></svg>';
        eta.appendChild(document.createTextNode('Llega ' + p.expectedDate));
        body.appendChild(eta);
      }

      let priceEl;
      if(Array.isArray(p.variants) && p.variants.length){
        const tag = document.createElement('div');
        tag.className = 'variant-tag';
        const disponibles = p.variants.filter(v=>!v.sold);
        tag.textContent = disponibles.length + ' figuras disponibles';
        body.appendChild(tag);
        priceEl = document.createElement('div');
        priceEl.className = 'card-price';
        const priceSource = disponibles.length ? disponibles : p.variants;
        const minP = Math.min(...priceSource.map(v=>v.price));
        priceEl.innerHTML = '<span class="price-from">Desde</span>' + money(minP);
      } else if(hasDiscount && p.status !== 'vendido'){
        priceEl = document.createElement('div');
        priceEl.className = 'price-group';
        const oldP = document.createElement('span');
        oldP.className = 'price-old';
        oldP.textContent = money(p.oldPrice);
        const saleP = document.createElement('span');
        saleP.className = 'price-sale';
        saleP.textContent = money(p.price);
        priceEl.appendChild(oldP);
        priceEl.appendChild(saleP);
      } else {
        priceEl = document.createElement('div');
        priceEl.className = 'card-price' + (p.status==='vendido' ? ' vendido-price' : '');
        priceEl.textContent = money(p.price);
      }

      if(Array.isArray(p.variants) && p.variants.length){
        body.appendChild(priceEl);
        const variosBtn = document.createElement('button');
        variosBtn.type = 'button';
        variosBtn.className = 'card-add-btn card-variants-btn';
        variosBtn.setAttribute('aria-label', 'Ver varios modelos');
        variosBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span>Varios modelos</span>';
        variosBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          openQuickView(p);
        });
        body.appendChild(variosBtn);
      } else {
        const priceRow = document.createElement('div');
        priceRow.className = 'card-price-row';
        priceRow.appendChild(priceEl);
        if(p.status !== 'vendido'){
          const enCarrito = inquiryList.some(it=> it.id === p.id);
          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'card-add-icon' + (enCarrito ? ' added' : '');
          addBtn.title = enCarrito ? 'Quitar del carrito' : 'Agregar al carrito';
          addBtn.setAttribute('aria-label', addBtn.title);
          addBtn.innerHTML = enCarrito ? CHECK_SVG : CART_SVG;
          addBtn.addEventListener('click', (e)=>{
            e.stopPropagation();
            const yaEstaba = inquiryList.some(it=> it.id === p.id);
            if(yaEstaba) removeFromInquiryList(p.id);
            else{ addToInquiryList(p.id); actualizarBotonesAgregar(p.id); }
          });
          priceRow.appendChild(addBtn);
        }
        body.appendChild(priceRow);
      }

      if(isAdmin && modoSeleccion){
        card.classList.add('seleccionable');
        if(seleccionados.has(p.id)) card.classList.add('elegido');
        const marca = document.createElement('div');
        marca.className = 'sel-marca';
        marca.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 12l5 5L20 6"/></svg>';
        media.appendChild(marca);
      }

      if(isAdmin){
        const row = document.createElement('div');
        row.className = 'card-admin';
        ['disponible','preventa','vendido'].forEach(s=>{
          const b = document.createElement('button');
          b.className = 'mini-btn state-'+s + (p.status===s ? ' active' : '');
          b.textContent = ({disponible:'Disp.',preventa:'Prevta.',vendido:'Vend.'})[s];
          b.addEventListener('click', ()=> changeStatus(p.id, s));
          row.appendChild(b);
        });
        const dupB = document.createElement('button');
        dupB.className = 'icon-btn';
        dupB.title = 'Duplicar producto';
        dupB.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        dupB.addEventListener('click', (e)=>{ e.stopPropagation(); duplicarProducto(p); });
        row.appendChild(dupB);

        const editB = document.createElement('button');
        editB.className = 'icon-btn' + (p.notes ? ' has-notes' : '');
        editB.title = p.notes ? ('Editar · Nota: ' + p.notes.slice(0, 60)) : 'Editar';
        editB.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
        editB.addEventListener('click', ()=> (Array.isArray(p.variants) && p.variants.length) ? openLotEdit(p) : openEdit(p));
        row.appendChild(editB);
        body.appendChild(row);
      }

      card.appendChild(body);
      return card;
  }

  function updateProductsJsonLd(){
    const el = document.getElementById('productsJsonLd');
    if(!el) return;
    const items = products.slice(0, 60).map((p, i)=>({
      '@type': 'ListItem',
      'position': i + 1,
      'item': {
        '@type': 'Product',
        'name': p.name,
        'description': p.desc || undefined,
        'category': categoryLabel(p.category),
        'offers': {
          '@type': 'Offer',
          'priceCurrency': 'PEN',
          'price': p.price,
          'availability': p.status === 'disponible'
            ? 'https://schema.org/InStock'
            : (p.status === 'preventa' ? 'https://schema.org/PreOrder' : (p.status === 'vendido' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock'))
        }
      }
    }));
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'itemListElement': items
    });
  }

  async function changeStatus(id, status){
    const p = products.find(x=>x.id===id);
    if(!p) return;
    p.status = status;
    render(true);
    try{ await window.fbSaveProduct(p); publicarCatalogo(); }catch(e){ showToast('No se pudo guardar. Intenta de nuevo.'); }
    showToast('Marcado como ' + stateLabel(status).toLowerCase());
  }

  // ---------- image handling ----------
  function resizeImage(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = (e)=>{
        const img = new Image();
        img.onload = ()=>{
          const maxDim = 900;
          let w = img.width, h = img.height;
          if(w > h && w > maxDim){ h = h*(maxDim/w); w = maxDim; }
          else if(h > maxDim){ w = w*(maxDim/h); h = maxDim; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Igual que resizeImage pero devuelve un Blob (archivo) para subir a Storage.
  // Exporta el canvas al formato más liviano que soporte el navegador.
  // WebP pesa ~30% menos que JPEG con la misma calidad; si no está disponible,
  // se usa JPEG de toda la vida.
  function exportarCanvas(canvas, calidad){
    return new Promise((resolve, reject)=>{
      canvas.toBlob(
        (blob)=>{
          if(blob && blob.type === 'image/webp'){ resolve(blob); return; }
          canvas.toBlob(
            (jpg)=> jpg ? resolve(jpg) : reject(new Error('No se pudo procesar la imagen')),
            'image/jpeg', calidad
          );
        },
        'image/webp', calidad
      );
    });
  }

  function resizeImageToBlob(file, maxDim){
    maxDim = maxDim || 1200;
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = (e)=>{
        const img = new Image();
        img.onload = ()=>{
          let w = img.width, h = img.height;
          if(w > h && w > maxDim){ h = h*(maxDim/w); w = maxDim; }
          else if(h > maxDim){ w = w*(maxDim/h); h = maxDim; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          exportarCanvas(canvas, 0.82).then(blob=>{
            const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
            blob.name = (file.name || 'foto').replace(/\.[^.]+$/, '') + ext;
            resolve(blob);
          }, reject);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderThumbStrip(){
    thumbStrip.innerHTML = '';
    pendingImages.forEach((im, idx)=>{
      const t = document.createElement('div');
      t.className = 'thumb';
      const img = document.createElement('img');
      img.src = imgSrc(im);
      img.style.objectPosition = imgPos(im);
      t.appendChild(img);
      const frameBtn = document.createElement('button');
      frameBtn.type = 'button';
      frameBtn.className = 'frame-btn';
      frameBtn.title = 'Encuadrar o recortar foto';
      frameBtn.innerHTML = FRAME_ICON;
      frameBtn.addEventListener('click', ()=>{
        openCropTool({
          src: imgSrc(im), pos: imgPos(im), ratio: '1/1',
          title: 'Editar foto de producto',
          onSave: (newPos)=>{ pendingImages[idx].pos = newPos; renderThumbStrip(); },
          onCropped: (newUrl)=>{
            pendingImages[idx] = { src: newUrl, pos: '50% 50%' };
            renderThumbStrip();
          }
        });
      });
      t.appendChild(frameBtn);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.innerHTML = '&times;';
      rm.title = 'Quitar foto';
      rm.addEventListener('click', ()=>{
        pendingImages.splice(idx,1);
        renderThumbStrip();
        updateUploadHint();
      });
      t.appendChild(rm);
      thumbStrip.appendChild(t);
    });
  }

  function updateUploadHint(){
    uploadHint.textContent = pendingImages.length
      ? pendingImages.length + ' foto(s) agregada(s) · toca para añadir más'
      : 'Toca para subir una o más fotos';
  }

  imageInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    if(!files.length) return;
    const room = MAX_IMAGES - pendingImages.length;
    if(room <= 0){
      showToast('Máximo ' + MAX_IMAGES + ' fotos por producto');
      imageInput.value = '';
      return;
    }
    const toProcess = files.slice(0, room);
    if(files.length > room) showToast('Solo se agregaron ' + room + ' foto(s), llegaste al máximo de ' + MAX_IMAGES);

    // Subida EN PARALELO: todas las fotos a la vez, con contador de progreso.
    // Se conserva el ORDEN en que se eligieron (la 1ª es la foto principal).
    let listas = 0;
    const total = toProcess.length;
    uploadHint.textContent = 'Subiendo ' + total + ' foto' + (total>1?'s':'') + '...';
    const baseIdx = pendingImages.length;
    const slots = new Array(total).fill(null);

    const tareas = toProcess.map(async (file, i)=>{
      try{
        const resizedBlob = await resizeImageToBlob(file);
        const url = await window.fbUploadImage(resizedBlob);
        slots[i] = { src: url, pos: '50% 50%' };
        listas++;
        uploadHint.textContent = 'Subiendo ' + listas + ' de ' + total + '...';
      }catch(err){
        console.error(err);
        return { error: true };
      }
    });

    const resultados = await Promise.all(tareas);
    // insertar respetando el orden original, saltando las que fallaron
    slots.forEach(s=>{ if(s) pendingImages.push(s); });
    renderThumbStrip();

    const fallidas = resultados.filter(r=> r && r.error).length;
    if(fallidas > 0) showToast('No se pudieron subir ' + fallidas + ' foto(s). Intenta de nuevo con esas.');
    else if(total > 1) showToast(total + ' fotos subidas');

    updateUploadHint();
    imageInput.value = '';
    validateForm();
  });

  imageLinkBtn.addEventListener('click', ()=>{
    const url = imageLinkInput.value.trim();
    if(!url) return;
    if(!/^https?:\/\//i.test(url)){
      showToast('El link debe empezar con http:// o https://');
      return;
    }
    if(pendingImages.length >= MAX_IMAGES){
      showToast('Máximo ' + MAX_IMAGES + ' fotos por producto');
      return;
    }
    pendingImages.push({ src: url, pos: '50% 50%' });
    imageLinkInput.value = '';
    renderThumbStrip();
    updateUploadHint();
    validateForm();
  });

  // ---------- modal (add/edit) ----------
  function resetForm(){
    editingId = null;
    editingState = 'disponible';
    editingCategory = 'otros';
    pendingImages = [];
    nameInput.value = '';
    priceInput.value = '';
    oldPriceInput.value = '';
    if(reservaInput) reservaInput.value = '';
    descInput.value = '';
    notesInput.value = '';
    tagsInput.value = '';
    pendingRelated = [];
    renderRelatedChosen();
    if(relatedSearchEl) relatedSearchEl.value = '';
    if(relatedResultsEl) relatedResultsEl.classList.remove('show');
    expectedDateInput.value = '';
    youtubeInput.value = '';
    allowQuantityInput.checked = false;
    shinyInput.checked = false;
    updateUploadHint();
    imageInput.value = '';
    updateStateButtons();
    updateCategoryButtons();
    deleteRow.style.display = 'none';
  }

  function updateStateButtons(){
    stateSelect.querySelectorAll('button').forEach(b=>{
      b.classList.toggle('sel', b.dataset.state === editingState);
    });
    expectedDateField.style.display = editingState === 'preventa' ? 'block' : 'none';
    const reservaField = document.getElementById('reservaField');
    if(reservaField) reservaField.style.display = editingState === 'preventa' ? 'block' : 'none';
  }

  function updateCategoryButtons(){
    categorySelect.querySelectorAll('button').forEach(b=>{
      b.classList.toggle('sel', b.dataset.category === editingCategory);
    });
  }

  stateSelect.addEventListener('click', (e)=>{
    const b = e.target.closest('button');
    if(!b) return;
    editingState = b.dataset.state;
    updateStateButtons();
  });

  categorySelect.addEventListener('click', (e)=>{
    const b = e.target.closest('button');
    if(!b) return;
    editingCategory = b.dataset.category;
    updateCategoryButtons();
  });

  function validateForm(){
    saveBtn.disabled = !(nameInput.value.trim() && priceInput.value !== '' && Number(priceInput.value) > 0);
  }
  nameInput.addEventListener('input', validateForm);
  priceInput.addEventListener('input', validateForm);

  function openAdd(){
    resetForm();
    modalTitle.textContent = 'Agregar producto';
    productOverlay.classList.add('show');
    setTimeout(()=>{ nameInput.focus(); snapshotProductForm(); }, 50);
  }

  function openEdit(p){
    resetForm();
    editingId = p.id;
    editingState = p.status;
    editingCategory = p.category || 'otros';
    pendingImages = ((p.images && p.images.length) ? p.images : (p.image ? [p.image] : [])).map(normalizeImg);
    nameInput.value = p.name;
    priceInput.value = p.price;
    oldPriceInput.value = p.oldPrice || '';
    if(reservaInput) reservaInput.value = (p.reserva != null ? p.reserva : '');
    descInput.value = p.desc || '';
    notesInput.value = p.notes || '';
    tagsInput.value = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
    pendingRelated = Array.isArray(p.related) ? p.related.slice() : [];
    renderRelatedChosen();
    if(relatedSearchEl) relatedSearchEl.value = '';
    renderThumbStrip();
    if(relatedResultsEl) relatedResultsEl.classList.remove('show');
    expectedDateInput.value = p.expectedDate || '';
    youtubeInput.value = p.youtubeUrl || '';
    allowQuantityInput.checked = !!p.allowQuantity;
    shinyInput.checked = !!p.shiny;
    updateUploadHint();
    updateStateButtons();
    updateCategoryButtons();
    modalTitle.textContent = 'Editar producto';
    deleteRow.style.display = 'block';
    validateForm();
    productOverlay.classList.add('show');
    setTimeout(snapshotProductForm, 50);
  }

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

  let productFormSnapshot = '';
  function currentProductFormSnapshot(){
    return JSON.stringify({
      images: pendingImages, name: nameInput.value, price: priceInput.value, oldPrice: oldPriceInput.value,
      reserva: reservaInput ? reservaInput.value : '', desc: descInput.value, notes: notesInput.value,
      tags: tagsInput.value, related: pendingRelated, expectedDate: expectedDateInput.value,
      youtube: youtubeInput.value, allowQty: allowQuantityInput.checked, shiny: shinyInput.checked,
      state: editingState, category: editingCategory
    });
  }
  function snapshotProductForm(){ productFormSnapshot = currentProductFormSnapshot(); }
  function productFormIsDirty(){ return productFormSnapshot !== '' && productFormSnapshot !== currentProductFormSnapshot(); }

  function closeModal(force){
    if(!force && productFormIsDirty()){
      if(!confirm('Tienes cambios sin guardar en este producto. ¿Salir y descartarlos?')) return;
    }
    productFormSnapshot = '';
    productOverlay.classList.remove('show');
  }

  addBtn.addEventListener('click', openAdd);
  cancelBtn.addEventListener('click', ()=> closeModal());
  productOverlay.addEventListener('click', (e)=>{ if(e.target === productOverlay) closeModal(); });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && productOverlay.classList.contains('show')) closeModal();
  });

  saveBtn.addEventListener('click', async ()=>{
    const name = nameInput.value.trim();
    const price = Number(priceInput.value);
    const oldPriceRaw = oldPriceInput.value.trim();
    const oldPrice = oldPriceRaw === '' ? null : Number(oldPriceRaw);
    const reservaRaw = reservaInput ? reservaInput.value.trim() : '';
    const reserva = reservaRaw === '' ? null : Number(reservaRaw);
    const expectedDate = editingState === 'preventa' ? expectedDateInput.value.trim() : '';
    const youtubeRaw = youtubeInput.value.trim();
    // Avisos claros: en vez de no hacer nada, le decimos al usuario qué falta.
    if(!name){
      showToast('Ponle un nombre al producto antes de guardar.');
      nameInput.focus();
      return;
    }
    if(isNaN(price) || price <= 0){
      showToast('Escribe un precio válido (mayor a 0).');
      priceInput.focus();
      return;
    }
    if(oldPriceRaw !== '' && (isNaN(oldPrice) || oldPrice <= price)){
      showToast('El precio anterior debe ser mayor al precio actual, o déjalo vacío.');
      oldPriceInput.focus();
      return;
    }
    if(reservaRaw !== '' && (isNaN(reserva) || reserva <= 0)){
      showToast('El monto de reserva debe ser un número mayor a 0, o déjalo vacío.');
      reservaInput.focus();
      return;
    }
    if(youtubeRaw && !extractYouTubeId(youtubeRaw)){
      showToast('Ese link de YouTube no se reconoce. Revísalo e intenta de nuevo.');
      youtubeInput.focus();
      return;
    }

    let savedProduct;
    if(editingId){
      const p = products.find(x=>x.id===editingId);
      p.name = name; p.price = price; p.desc = descInput.value.trim();
      p.status = editingState; p.images = pendingImages.slice();
      p.category = editingCategory;
      p.oldPrice = (oldPrice && oldPrice > price) ? oldPrice : null;
      p.reserva = (reserva != null && !isNaN(reserva)) ? reserva : null;
      p.notes = notesInput.value.trim();
      p.expectedDate = expectedDate || null;
      p.youtubeUrl = youtubeRaw || null;
      p.allowQuantity = allowQuantityInput.checked;
      p.shiny = shinyInput.checked;
      p.tags = parseTags(tagsInput.value);
      p.related = pendingRelated.slice();
      delete p.image;
      savedProduct = p;
      showToast('Producto actualizado');
    } else {
      const newProduct = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
        name, price, desc: descInput.value.trim(),
        status: editingState, images: pendingImages.slice(),
        category: editingCategory,
        oldPrice: (oldPrice && oldPrice > price) ? oldPrice : null,
        reserva: (reserva != null && !isNaN(reserva)) ? reserva : null,
        notes: notesInput.value.trim(),
        expectedDate: expectedDate || null,
        youtubeUrl: youtubeRaw || null,
        allowQuantity: allowQuantityInput.checked,
        shiny: shinyInput.checked,
        tags: parseTags(tagsInput.value),
        related: pendingRelated.slice(),
        createdAt: Date.now()
      };
      products.push(newProduct);
      savedProduct = newProduct;
      showToast('Producto agregado a la vitrina');
    }
    closeModal(true);
    render(true);
    try{ await window.fbSaveProduct(savedProduct); publicarCatalogo(); }catch(e){ showToast('No se pudo guardar. Intenta de nuevo.'); }
  });

  deleteBtn.addEventListener('click', async ()=>{
    if(!editingId) return;
    if(!confirm('¿Eliminar este producto del catálogo?')) return;
    const idToDelete = editingId;
    products = products.filter(p=>p.id !== idToDelete);
    closeModal(true);
    render(true);
    try{ await window.fbDeleteProduct(idToDelete); publicarCatalogo(); }catch(e){ showToast('No se pudo eliminar. Intenta de nuevo.'); }
    showToast('Producto eliminado');
  });

  // ================= modal "Agregar varios productos" (lote) =================
  const lotOverlay = document.getElementById('lotOverlay');
  const lotUploadBox = document.getElementById('lotUploadBox');
  const lotUploadHint = document.getElementById('lotUploadHint');
  const lotImageInput = document.getElementById('lotImageInput');
  const lotThumbStrip = document.getElementById('lotThumbStrip');
  const lotImageLinkInput = document.getElementById('lotImageLinkInput');
  const lotImageLinkBtn = document.getElementById('lotImageLinkBtn');
  const lotNameInput = document.getElementById('lotNameInput');
  const lotDescInput = document.getElementById('lotDescInput');
  const lotVariantList = document.getElementById('lotVariantList');
  const lotAddVariantBtn = document.getElementById('lotAddVariantBtn');
  const lotCategorySelect = document.getElementById('lotCategorySelect');
  const lotFormError = document.getElementById('lotFormError');
  const lotCancelBtn = document.getElementById('lotCancelBtn');
  const lotSaveBtn = document.getElementById('lotSaveBtn');
  const lotModalTitle = document.getElementById('lotModalTitle');
  const lotDeleteRow = document.getElementById('lotDeleteRow');
  const lotDeleteBtn = document.getElementById('lotDeleteBtn');
  const lotFullPriceInput = document.getElementById('lotFullPriceInput');
  let editingLotId = null;

  let pendingLotImages = [];
  let lotVariantRows = []; // {id, nameEl, noteEl, priceEl}
  let lotCategory = 'figuras';

  function lotUpdateUploadHint(){
    lotUploadHint.textContent = pendingLotImages.length
      ? pendingLotImages.length + ' foto(s) agregada(s) · toca para añadir más'
      : 'Toca para subir una o más fotos';
  }
  function lotRenderThumbStrip(){
    lotThumbStrip.innerHTML = '';
    pendingLotImages.forEach((im, idx)=>{
      const t = document.createElement('div');
      t.className = 'thumb';
      const img = document.createElement('img');
      img.src = imgSrc(im); img.style.objectPosition = imgPos(im);
      t.appendChild(img);
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'thumb-remove'; rm.innerHTML = '✕';
      rm.title = 'Quitar foto';
      rm.addEventListener('click', ()=>{ pendingLotImages.splice(idx,1); lotRenderThumbStrip(); lotUpdateUploadHint(); });
      t.appendChild(rm);
      lotThumbStrip.appendChild(t);
    });
  }
  lotUploadBox.addEventListener('click', (e)=>{ if(e.target === lotUploadBox || e.target === lotUploadHint) lotImageInput.click(); });
  lotImageInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    if(!files.length) return;
    const room = MAX_IMAGES - pendingLotImages.length;
    if(room <= 0){ showToast('Máximo ' + MAX_IMAGES + ' fotos'); lotImageInput.value=''; return; }
    const toProcess = files.slice(0, room);
    const total = toProcess.length;
    lotUploadHint.textContent = 'Subiendo ' + total + ' foto' + (total>1?'s':'') + '...';
    const slots = new Array(total).fill(null);
    let listas = 0;
    const tareas = toProcess.map(async (file, i)=>{
      try{
        const resizedBlob = await resizeImageToBlob(file);
        const url = await window.fbUploadImage(resizedBlob);
        slots[i] = { src: url, pos: '50% 50%' };
        listas++;
        lotUploadHint.textContent = 'Subiendo ' + listas + ' de ' + total + '...';
      }catch(err){ console.error(err); }
    });
    await Promise.all(tareas);
    slots.forEach(s=>{ if(s) pendingLotImages.push(s); });
    lotRenderThumbStrip();
    lotUpdateUploadHint();
    lotImageInput.value = '';
    lotValidate();
  });

  function lotVariantRow(data){
    data = data || { name:'', note:'', price:'' };
    const row = document.createElement('div');
    row.className = 'variant-editor-row';
    const info = document.createElement('div');
    const nameInp = document.createElement('input');
    nameInp.type = 'text'; nameInp.placeholder = 'Nombre de la pieza'; nameInp.value = data.name;
    const noteInp = document.createElement('input');
    noteInp.type = 'text'; noteInp.placeholder = 'Nota (opcional): estado, edición...'; noteInp.value = data.note;
    info.appendChild(nameInp); info.appendChild(noteInp);
    const priceWrap = document.createElement('div');
    priceWrap.className = 'variant-editor-price';
    const span = document.createElement('span'); span.textContent = 'S/';
    const priceInp = document.createElement('input');
    priceInp.type = 'number'; priceInp.min = '0'; priceInp.step = '0.01'; priceInp.placeholder = '0.00'; priceInp.value = data.price;
    priceWrap.appendChild(span); priceWrap.appendChild(priceInp);
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button'; rmBtn.className = 'variant-remove-btn'; rmBtn.innerHTML = '✕';
    rmBtn.addEventListener('click', ()=>{
      if(lotVariantRows.length <= 1){ showToast('Debe quedar al menos una pieza'); return; }
      row.remove();
      lotVariantRows = lotVariantRows.filter(r=>r.row !== row);
      lotValidate();
    });
    [nameInp, noteInp, priceInp].forEach(inp=> inp.addEventListener('input', lotValidate));
    row.appendChild(info); row.appendChild(priceWrap); row.appendChild(rmBtn);
    if(data.sold){
      const soldTag = document.createElement('span');
      soldTag.className = 'variant-sold-toggle active';
      soldTag.style.gridColumn = '1 / -1';
      soldTag.style.textAlign = 'center';
      soldTag.textContent = 'Vendida (cámbialo desde la ficha del producto)';
      row.appendChild(soldTag);
    }
    lotVariantList.appendChild(row);
    lotVariantRows.push({ row, nameInp, noteInp, priceInp, sold: !!data.sold });
  }
  lotAddVariantBtn.addEventListener('click', ()=> lotVariantRow());
  lotImageLinkBtn.addEventListener('click', ()=>{
    const url = lotImageLinkInput.value.trim();
    if(!url) return;
    if(pendingLotImages.length >= MAX_IMAGES){ showToast('Máximo ' + MAX_IMAGES + ' fotos'); return; }
    pendingLotImages.push({ src: url, pos: '50% 50%' });
    lotImageLinkInput.value = '';
    lotRenderThumbStrip(); lotUpdateUploadHint(); lotValidate();
  });

  lotCategorySelect.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      lotCategory = btn.dataset.category;
      lotCategorySelect.querySelectorAll('button').forEach(b=> b.classList.toggle('sel', b===btn));
    });
  });

  function lotValidate(){
    const errs = [];
    if(!lotNameInput.value.trim()) errs.push('Ponle un nombre al lote.');
    if(!pendingLotImages.length) errs.push('Sube al menos una foto de portada.');
    const validVariants = lotVariantRows.filter(r=> r.nameInp.value.trim() && Number(r.priceInp.value) > 0);
    if(!validVariants.length) errs.push('Agrega al menos una pieza con nombre y precio.');
    lotSaveBtn.disabled = errs.length > 0;
    lotFormError.style.display = 'none';
    return errs;
  }

  function lotResetForm(){
    editingLotId = null;
    pendingLotImages = [];
    lotVariantRows = [];
    lotVariantList.innerHTML = '';
    lotNameInput.value = ''; lotDescInput.value = ''; lotFullPriceInput.value = '';
    lotCategory = 'figuras';
    lotCategorySelect.querySelectorAll('button').forEach(b=> b.classList.toggle('sel', b.dataset.category==='figuras'));
    lotRenderThumbStrip(); lotUpdateUploadHint();
    lotVariantRow(); lotVariantRow();
    lotDeleteRow.style.display = 'none';
    lotModalTitle.textContent = 'Agregar varios productos';
    lotValidate();
  }

  const lotGuard = makeDirtyGuard(()=> ({
    images: pendingLotImages, name: lotNameInput.value, desc: lotDescInput.value, category: lotCategory,
    fullPrice: lotFullPriceInput.value,
    variants: lotVariantRows.map(r=>[r.nameInp.value, r.noteInp.value, r.priceInp.value])
  }));

  function openLotAdd(){
    lotResetForm();
    lotOverlay.classList.add('show');
    setTimeout(()=>{ lotNameInput.focus(); lotGuard.snapshot(); }, 50);
  }
  function openLotEdit(p){
    lotResetForm();
    editingLotId = p.id;
    pendingLotImages = (p.images || []).map(normalizeImg);
    lotNameInput.value = p.name;
    lotDescInput.value = p.desc || '';
    lotFullPriceInput.value = (p.lotPrice != null && p.lotPrice !== '') ? p.lotPrice : '';
    lotCategory = p.category || 'figuras';
    lotCategorySelect.querySelectorAll('button').forEach(b=> b.classList.toggle('sel', b.dataset.category===lotCategory));
    lotVariantList.innerHTML = '';
    lotVariantRows = [];
    (p.variants || []).forEach(v=> lotVariantRow({ name: v.name, note: v.note || '', price: v.price, sold: v.sold }));
    lotRenderThumbStrip(); lotUpdateUploadHint();
    lotDeleteRow.style.display = 'block';
    lotModalTitle.textContent = 'Editar lote';
    lotValidate();
    lotOverlay.classList.add('show');
    setTimeout(()=> lotGuard.snapshot(), 50);
  }
  function closeLotModal(force){
    confirmDiscard(lotGuard, force, ()=> lotOverlay.classList.remove('show'));
  }
  lotBtn.addEventListener('click', openLotAdd);
  lotCancelBtn.addEventListener('click', ()=> closeLotModal());
  lotOverlay.addEventListener('click', (e)=>{ if(e.target === lotOverlay) closeLotModal(); });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && lotOverlay.classList.contains('show')) closeLotModal();
  });

  lotSaveBtn.addEventListener('click', async ()=>{
    const errs = lotValidate();
    if(errs.length){ lotFormError.textContent = errs[0]; lotFormError.style.display = 'block'; return; }
    const variants = lotVariantRows
      .filter(r=> r.nameInp.value.trim() && Number(r.priceInp.value) > 0)
      .map((r,i)=>({ id: 'v_' + Date.now() + '_' + i, name: r.nameInp.value.trim(), note: r.noteInp.value.trim(), price: Number(r.priceInp.value), sold: !!r.sold }));
    const minPrice = Math.min(...variants.map(v=>v.price));
    const lotFullPrice = Number(lotFullPriceInput.value) > 0 ? Number(lotFullPriceInput.value) : null;
    if(editingLotId){
      const p = products.find(x=>x.id===editingLotId);
      p.name = lotNameInput.value.trim();
      p.desc = lotDescInput.value.trim();
      p.price = minPrice;
      p.images = pendingLotImages.slice();
      p.category = lotCategory;
      p.variants = variants;
      p.lotPrice = lotFullPrice;
      closeLotModal(true);
      render(true);
      showToast('Lote actualizado');
      try{ await window.fbSaveProduct(p); publicarCatalogo(); }catch(e){ showToast('No se pudo guardar. Intenta de nuevo.'); }
      return;
    }
    const newProduct = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      name: lotNameInput.value.trim(),
      price: minPrice,
      desc: lotDescInput.value.trim(),
      status: 'disponible',
      images: pendingLotImages.slice(),
      category: lotCategory,
      variants,
      lotPrice: lotFullPrice,
      oldPrice: null, reserva: null, notes: '', tags: [], related: [],
      expectedDate: '', youtubeUrl: '', allowQuantity: false, shiny: false,
      createdAt: Date.now()
    };
    products.unshift(newProduct);
    closeLotModal(true);
    render(true);
    showToast('Lote agregado con ' + variants.length + ' pieza(s)');
    try{ await window.fbSaveProduct(newProduct); publicarCatalogo(); }catch(e){ showToast('No se pudo guardar. Intenta de nuevo.'); }
  });

  lotDeleteBtn.addEventListener('click', async ()=>{
    if(!editingLotId) return;
    if(!confirm('¿Eliminar este lote del catálogo?')) return;
    const idToDelete = editingLotId;
    products = products.filter(p=>p.id !== idToDelete);
    closeLotModal(true);
    render(true);
    showToast('Lote eliminado');
    try{ await window.fbDeleteProduct(idToDelete); publicarCatalogo(); }catch(e){ showToast('No se pudo eliminar. Intenta de nuevo.'); }
  });

  function scrollToCatalog(){
    const cfv = document.getElementById('catalogFullView');
    if(!cfv) return;
    const y = cfv.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  // ---------- filters/search ----------

  filterChips.addEventListener('click', (e)=>{
    const chip = e.target.closest('.chip');
    if(!chip) return;
    filterChips.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    window._soloOfertas = false;
    showOnlyMix = false;
    if(mixToggle) mixToggle.classList.remove('active');
    moveChipThumb();
    render();
  });

  function aplicarCategoria(cat){
    if(cat === 'all' || activeCategories.has(cat)){
      activeCategories.clear();
    } else {
      activeCategories.clear();
      activeCategories.add(cat);
    }
    categoryChips.querySelectorAll('.chip-light[data-category]').forEach(c=>{
      const cc = c.dataset.category;
      if(cc === 'all') c.classList.toggle('active', activeCategories.size === 0);
      else c.classList.toggle('active', activeCategories.has(cc));
    });
    const sel = document.getElementById('compactCatSelect');
    if(sel) sel.value = activeCategories.size ? [...activeCategories][0] : 'all';
    render();
  }

  categoryChips.addEventListener('click', (e)=>{
    const chip = e.target.closest('.chip-light');
    if(!chip || !chip.dataset.category) return;
    aplicarCategoria(chip.dataset.category);
  });

  const compactCatSelect = document.getElementById('compactCatSelect');
  if(compactCatSelect){
    compactCatSelect.addEventListener('change', ()=>{
      abrirCatalogoCompleto();
      aplicarCategoria(compactCatSelect.value);
      const target = document.getElementById('catalogoFullTitle');
      if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
    });
  }

  // ---------- filtro de precio: desde / hasta ----------
  const precioMinInput = document.getElementById('precioMin');
  const precioMaxInput = document.getElementById('precioMax');
  const precioLimpiar  = document.getElementById('precioLimpiar');
  const precioToggle = document.getElementById('precioToggle');
  const precioToggleLabel = document.getElementById('precioToggleLabel');
  const precioFila = document.getElementById('precioFila');
  let precioTimer = null;

  function actualizarPrecioToggle(){
    if(!precioToggle || !precioToggleLabel) return;
    const hay = precioMin !== null || precioMax !== null;
    precioToggleLabel.textContent = hay
      ? `S/ ${precioMin ?? 0} – ${precioMax ?? 'sin tope'}`
      : 'S/';
    precioToggle.classList.toggle('active', hay);
  }
  if(precioToggle && precioFila){
    precioToggle.addEventListener('click', ()=>{
      const open = precioFila.classList.toggle('show');
      precioToggle.classList.toggle('open', open);
      precioToggle.setAttribute('aria-expanded', String(open));
      if(open) precioMinInput?.focus();
    });
    document.addEventListener('click', (e)=>{
      if(!precioFila.classList.contains('show')) return;
      if(precioFila.contains(e.target) || precioToggle.contains(e.target)) return;
      precioFila.classList.remove('show');
      precioToggle.classList.remove('open');
      precioToggle.setAttribute('aria-expanded', 'false');
    });
  }

  function leerPrecios(){
    const a = parseFloat(precioMinInput.value);
    const b = parseFloat(precioMaxInput.value);
    precioMin = isNaN(a) ? null : Math.max(0, a);
    precioMax = isNaN(b) ? null : Math.max(0, b);
    // Si los escribe al revés, se corrigen solos en vez de no mostrar nada.
    if(precioMin !== null && precioMax !== null && precioMin > precioMax){
      const t = precioMin; precioMin = precioMax; precioMax = t;
    }
    if(precioLimpiar) precioLimpiar.hidden = (precioMin === null && precioMax === null);
    actualizarPrecioToggle();
  }

  function aplicarPrecio(){
    leerPrecios();
    render();
  }

  [precioMinInput, precioMaxInput].forEach(inp=>{
    if(!inp) return;
    // pequeño retardo: filtra al terminar de escribir, no en cada tecla
    inp.addEventListener('input', ()=>{
      clearTimeout(precioTimer);
      precioTimer = setTimeout(aplicarPrecio, 300);
    });
    inp.addEventListener('change', aplicarPrecio);
    inp.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ clearTimeout(precioTimer); aplicarPrecio(); inp.blur(); } });
  });

  if(precioLimpiar){
    precioLimpiar.addEventListener('click', ()=>{
      precioMinInput.value = ''; precioMaxInput.value = '';
      aplicarPrecio();
    });
  }

  sortBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    sortMenu.classList.toggle('show');
    if(sortMenu.classList.contains('show')) moveSortThumb(sortMenu);
  });
  sortMenu.addEventListener('click', (e)=>{
    const opt = e.target.closest('.sort-option');
    if(!opt) return;
    sortMenu.querySelectorAll('.sort-option').forEach(o=>o.classList.remove('active'));
    opt.classList.add('active');
    moveSortThumb(sortMenu);
    sortBtn.classList.toggle('active', opt.dataset.sort !== 'recientes');
    currentSort = opt.dataset.sort;
    sortMenu.classList.remove('show');
    render();
  });
  document.addEventListener('click', (e)=>{
    if(!sortMenu.classList.contains('show')) return;
    if(!e.target.closest('.sort-wrap')) sortMenu.classList.remove('show');
  });

  const catalogoSearchInput = document.getElementById('catalogoSearchInput');

  // Mantiene los tres buscadores (héroe, catálogo, compacto) mostrando lo mismo.
  function sincronizarBuscadores(origen){
    [searchInput, catalogoSearchInput, document.getElementById('compactSearchInput')]
      .forEach(inp=>{ if(inp && inp !== origen && inp.value !== searchTerm) inp.value = searchTerm; });
  }

  searchInput.addEventListener('input', (e)=>{
    searchTerm = e.target.value;
    if(searchTerm.trim()){ limpiarFiltrosDeBanner(); resetChipDeEstadoPorBusqueda(); }
    sincronizarBuscadores(searchInput);
    if(searchTerm.trim()) abrirCatalogoCompleto();
    render();
  });

  if(catalogoSearchInput){
    catalogoSearchInput.addEventListener('input', (e)=>{
      searchTerm = e.target.value;
      if(searchTerm.trim()){ limpiarFiltrosDeBanner(); resetChipDeEstadoPorBusqueda(); }
      sincronizarBuscadores(catalogoSearchInput);
      if(searchTerm.trim()) abrirCatalogoCompleto();
      render();
    });
    catalogoSearchInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter') confirmarBusqueda(catalogoSearchInput);
    });
    const catalogoSearchGo = document.getElementById('catalogoSearchGo');
    if(catalogoSearchGo){
      catalogoSearchInput.addEventListener('input', ()=>{ catalogoSearchGo.hidden = !catalogoSearchInput.value.trim(); });
      catalogoSearchGo.addEventListener('click', ()=> confirmarBusqueda(catalogoSearchInput));
    }
  }
  // Enter en el buscador principal: salta directo al catálogo con el resultado,
  // y en celular cierra el teclado (el input pierde el foco).
  function confirmarBusqueda(inputEl){
    abrirCatalogoCompleto();
    render();
    const cat = document.querySelector('#catalogFullView .catalogo-title') || document.querySelector('.catalogo-title');
    if(cat) cat.scrollIntoView({behavior:'smooth', block:'start'});
    if(inputEl) inputEl.blur();
  }
  searchInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') confirmarBusqueda(searchInput);
  });
  const heroSearchGo = document.getElementById('heroSearchGo');
  if(heroSearchGo){
    searchInput.addEventListener('input', ()=>{ heroSearchGo.hidden = !searchInput.value.trim(); });
    heroSearchGo.addEventListener('click', ()=> confirmarBusqueda(searchInput));
  }

  // No saltamos al enfocar: se puede escribir con calma y el salto solo pasa
  // al confirmar con Enter o el botón Buscar (confirmarBusqueda).

  // El navegador puede restaurar la página desde el caché de "atrás/adelante"
  // (bfcache) con el catálogo completo ya abierto de una búsqueda anterior.
  // Al volver a entrar así, se resetea a la vista normal (teaser + buscador vacío).
  window.addEventListener('pageshow', (e)=>{
    if(!e.persisted) return;
    cerrarCatalogoCompleto();
    searchTerm = '';
    [searchInput, catalogoSearchInput, document.getElementById('compactSearchInput')]
      .forEach(inp=>{ if(inp) inp.value = ''; });
    const go1 = document.getElementById('heroSearchGo'); if(go1) go1.hidden = true;
    const go2 = document.getElementById('catalogoSearchGo'); if(go2) go2.hidden = true;
    const go3 = document.getElementById('compactSearchGo'); if(go3) go3.hidden = true;
    render();
  });

  // ---- Barra compacta: buscador, orden y mostrar/ocultar al hacer scroll ----
  (function(){
    const compactBar = document.getElementById('compactBar');
    const compactBrand = document.getElementById('compactBrand');
    const compactSearchInput = document.getElementById('compactSearchInput');
    const compactSortBtn = document.getElementById('compactSortBtn');
    const compactSortMenu = document.getElementById('compactSortMenu');

    // Buscador compacto -> sincroniza con el principal
    compactSearchInput.addEventListener('input', (e)=>{
      searchTerm = e.target.value;
      if(searchTerm.trim()){ limpiarFiltrosDeBanner(); resetChipDeEstadoPorBusqueda(); }
      sincronizarBuscadores(compactSearchInput);
      if(searchTerm.trim()) abrirCatalogoCompleto();
      render();
    });
    compactSearchInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter') confirmarBusqueda(compactSearchInput);
    });
    const compactSearchGo = document.getElementById('compactSearchGo');
    if(compactSearchGo){
      compactSearchInput.addEventListener('input', ()=>{ compactSearchGo.hidden = !compactSearchInput.value.trim(); });
      compactSearchGo.addEventListener('click', ()=> confirmarBusqueda(compactSearchInput));
    }

    // Volver arriba al tocar el logo/nombre
    compactBrand.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));

    // Menú de orden compacto (refleja el mismo estado)
    if(compactSortBtn && compactSortMenu){
    compactSortBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      compactSortMenu.classList.toggle('show');
      if(compactSortMenu.classList.contains('show')) moveSortThumb(compactSortMenu);
    });
    compactSortMenu.addEventListener('click', (e)=>{
      const opt = e.target.closest('.sort-option');
      if(!opt) return;
      compactSortMenu.querySelectorAll('.sort-option').forEach(o=>o.classList.remove('active'));
      opt.classList.add('active');
      moveSortThumb(compactSortMenu);
      // reflejar también en el menú principal
      sortMenu.querySelectorAll('.sort-option').forEach(o=> o.classList.toggle('active', o.dataset.sort===opt.dataset.sort));
      moveSortThumb(sortMenu);
      compactSortBtn.classList.toggle('active', opt.dataset.sort !== 'recientes');
      sortBtn.classList.toggle('active', opt.dataset.sort !== 'recientes');
      currentSort = opt.dataset.sort;
      compactSortMenu.classList.remove('show');
      render();
    });
    document.addEventListener('click', (e)=>{
      if(compactSortMenu.classList.contains('show') && !e.target.closest('#compactSortBtn') && !e.target.closest('#compactSortMenu')){
        compactSortMenu.classList.remove('show');
      }
    });
    }

    // Mostrar al subir, ocultar al bajar (y nunca sobre el header superior)
    let lastY = window.scrollY;
    const HEADER_ZONE = 280; // px: el header ahora incluye el buscador, así que más abajo
    window.addEventListener('scroll', ()=>{
      const y = window.scrollY;
      const goingUp = y < lastY;
      // La barra (con el buscador) se queda visible mientras el catálogo completo
      // está abierto, para que el buscador siempre esté a mano al explorar.
      // Solo en móvil: en escritorio esta barra no se usa (la oculta el CSS).
      const esMovil = window.matchMedia('(max-width:520px)').matches;
      const catalogoAbierto = esMovil && (()=>{
        const fv = document.getElementById('catalogFullView');
        return fv && fv.style.display !== 'none';
      })();
      if(y > HEADER_ZONE && (goingUp || catalogoAbierto)){
        compactBar.classList.add('show');
      } else if(y <= HEADER_ZONE){
        compactBar.classList.remove('show');
      } else if(!goingUp && !catalogoAbierto){
        compactBar.classList.remove('show');
      }
      lastY = y;
    }, {passive:true});
  })();

  clearFiltersBtn.addEventListener('click', ()=>{
    currentFilter = 'all';
    activeCategories.clear();
    precioMin = null; precioMax = null;
    searchTerm = '';
    showOnlyMix = false;
    mixToggle.classList.remove('active');
    searchInput.value = '';
    filterChips.querySelectorAll('.chip').forEach(c=> c.classList.toggle('active', c.dataset.filter === 'all'));
    categoryChips.querySelectorAll('.chip-light[data-category]').forEach(c=> c.classList.toggle('active', c.dataset.category === 'all'));
    moveChipThumb();
    if(precioMinInput) precioMinInput.value = '';
    if(precioMaxInput) precioMaxInput.value = '';
    if(catalogoSearchInput) catalogoSearchInput.value = '';
    if(precioLimpiar) precioLimpiar.hidden = true;
    actualizarPrecioToggle();
    render();
  });
  const clearFiltersInline = document.getElementById('clearFiltersInline');
  if(clearFiltersInline) clearFiltersInline.addEventListener('click', ()=> clearFiltersBtn.click());


  // ================= herramientas de administración en lote =================
  let modoSeleccion = false;
  const seleccionados = new Set();

  const seleccionBtn  = document.getElementById('seleccionBtn');
  const loteBar       = document.getElementById('loteBar');
  const loteCount     = document.getElementById('loteCount');
  const loteEstado    = document.getElementById('loteEstado');
  const loteCategoria = document.getElementById('loteCategoria');
  const loteEliminar  = document.getElementById('loteEliminar');
  const loteCancelar  = document.getElementById('loteCancelar');

  function alternarSeleccion(id, card){
    if(seleccionados.has(id)){ seleccionados.delete(id); card.classList.remove('elegido'); }
    else { seleccionados.add(id); card.classList.add('elegido'); }
    actualizarBarraLote();
  }

  function actualizarBarraLote(){
    if(loteCount) loteCount.textContent = seleccionados.size;
    if(loteBar) loteBar.hidden = !modoSeleccion;
  }

  function salirSeleccion(){
    modoSeleccion = false;
    seleccionados.clear();
    if(seleccionBtn) seleccionBtn.classList.remove('activo');
    actualizarBarraLote();
    render();
  }

  if(seleccionBtn){
    seleccionBtn.addEventListener('click', ()=>{
      modoSeleccion = !modoSeleccion;
      seleccionados.clear();
      seleccionBtn.classList.toggle('activo', modoSeleccion);
      actualizarBarraLote();
      render();
      if(modoSeleccion) showToast('Toca los productos que quieras cambiar');
    });
  }

  document.querySelectorAll('[data-lote-todos]').forEach(b=>{
    b.addEventListener('click', ()=>{
      // selecciona todo lo que está visible con los filtros actuales
      filteredCache.forEach(p=> seleccionados.add(p.id));
      render();
      actualizarBarraLote();
    });
  });

  if(loteCancelar) loteCancelar.addEventListener('click', salirSeleccion);

  async function aplicarLote(cambio, textoOk){
    if(seleccionados.size === 0){ showToast('Primero elige al menos un producto'); return; }
    const tocados = [];
    products.forEach(p=>{
      if(seleccionados.has(p.id)){ cambio(p); tocados.push(p); }
    });
    render();
    try{
      await window.fbSaveProductsBatch(tocados);
      publicarCatalogo();
      showToast(textoOk.replace('{n}', tocados.length));
    }catch(e){
      showToast('No se pudo guardar el cambio. Intenta de nuevo.');
    }
  }

  if(loteEstado){
    loteEstado.addEventListener('change', async ()=>{
      const v = loteEstado.value;
      if(!v) return;
      await aplicarLote(p=> p.status = v, '{n} productos actualizados');
      loteEstado.value = '';
    });
  }

  if(loteCategoria){
    loteCategoria.addEventListener('change', async ()=>{
      const v = loteCategoria.value;
      if(!v) return;
      await aplicarLote(p=> p.category = v, '{n} productos actualizados');
      loteCategoria.value = '';
    });
  }

  if(loteEliminar){
    loteEliminar.addEventListener('click', async ()=>{
      if(seleccionados.size === 0){ showToast('Primero elige al menos un producto'); return; }
      const n = seleccionados.size;
      if(!confirm('Vas a eliminar ' + n + ' producto' + (n===1?'':'s') + ' del catálogo. Esta acción no se puede deshacer. ¿Continuar?')) return;
      const ids = [...seleccionados];
      products = products.filter(p=> !seleccionados.has(p.id));
      salirSeleccion();
      try{
        await window.fbDeleteProductsBatch(ids);
        publicarCatalogo();
        showToast(n + ' productos eliminados');
      }catch(e){
        showToast('No se pudieron eliminar. Recarga e intenta de nuevo.');
      }
    });
  }

  // ---------- duplicar un producto ----------
  async function duplicarProducto(original){
    const copia = JSON.parse(JSON.stringify(original));
    copia.id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    copia.name = (original.name || 'Producto') + ' (copia)';
    copia.createdAt = Date.now();
    delete copia.fav;
    products.unshift(copia);
    render();
    try{
      await window.fbSaveProduct(copia);
      publicarCatalogo();
      showToast('Producto duplicado · edítalo para ajustarlo');
      openEdit(copia);
    }catch(e){
      showToast('No se pudo duplicar. Intenta de nuevo.');
    }
  }

  // ---------- admin / pin ----------
  function openPin(mode){
    pinMode = mode;
    pinError.textContent = '';
    pinDots.forEach(i=> i.value = '');
    if(mode === 'change'){
      pinTitle.textContent = 'Cambiar PIN';
      pinSub.textContent = 'Escribe el nuevo código de 6 caracteres.';
    } else {
      pinTitle.textContent = 'Ingresar al modo tienda';
      pinSub.textContent = 'Escribe el código de 6 caracteres para editar el catálogo.';
    }
    pinOverlay.classList.add('show');
    setTimeout(()=> pinDots[0].focus(), 50);
  }

  pinDots.forEach((input, idx)=>{
    input.addEventListener('input', ()=>{
      input.value = input.value.replace(/[^0-9a-zA-Z]/g,'').toUpperCase().slice(0,1);
      if(input.value && idx < pinDots.length-1) pinDots[idx+1].focus();
    });
    input.addEventListener('keydown', (e)=>{
      if(e.key === 'Backspace' && !input.value && idx>0) pinDots[idx-1].focus();
      if(e.key === 'Enter') pinConfirm.click();
    });
  });

  pinCancel.addEventListener('click', ()=> pinOverlay.classList.remove('show'));
  pinOverlay.addEventListener('click', (e)=>{ if(e.target===pinOverlay) pinOverlay.classList.remove('show'); });

  pinConfirm.addEventListener('click', async ()=>{
    const val = Array.from(pinDots).map(i=>i.value).join('').toUpperCase();
    if(val.length !== 6){
      pinError.textContent = 'Completa los 6 caracteres.';
      return;
    }
    if(pinMode === 'change'){
      await setPin(val);
      pinOverlay.classList.remove('show');
      showToast('Código actualizado');
      return;
    }
    pinError.textContent = 'Verificando...';
    try{
      const realPin = (await getPin()).toUpperCase();
      if(val === realPin){
        isAdmin = true;
        updateAdminUI();
        recargarComoAdmin();
        pinOverlay.classList.remove('show');
        pinError.textContent = '';
        showToast('Modo tienda activado');
      } else {
        pinError.textContent = 'Código incorrecto.';
        pinDots.forEach(i=> i.value='');
        pinDots[0].focus();
      }
    }catch(err){
      console.error('PIN:', err);
      pinError.textContent = 'No se pudo verificar. Revisa tu conexión e intenta otra vez.';
    }
  });

  function updateAdminUI(){
    if(!isAdmin && modoSeleccion){ modoSeleccion = false; seleccionados.clear(); if(loteBar) loteBar.hidden = true; }
    if(seleccionBtn) seleccionBtn.classList.toggle('show', isAdmin);
    adminToggle.classList.toggle('on', isAdmin);
    adminLabel.textContent = isAdmin ? 'Modo tienda: activo' : 'Modo tienda';
    addBtn.classList.toggle('show', isAdmin);
    lotBtn.classList.toggle('show', isAdmin);
    exportBtn.classList.toggle('show', isAdmin);
    importBtn.classList.toggle('show', isAdmin);
    sheetBtn.classList.toggle('show', isAdmin);
    if(compressBtn) compressBtn.classList.toggle('show', isAdmin);
    if(notifBtn) notifBtn.classList.toggle('show', isAdmin);
    bannerBtn.classList.toggle('show', isAdmin);
    textsBtn.classList.toggle('show', isAdmin);
    if(isAdmin) resetIdleTimer(); else clearTimeout(idleTimer);
    if(isAdmin) openFullCatalog();
    render();
  }

  exportBtn.addEventListener('click', ()=>{
    const payload = {
      exportedAt: new Date().toISOString(),
      tienda: 'La Tienda de Meowth',
      products
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalogo-meowth-respaldo-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Respaldo descargado');
  });

  importBtn.addEventListener('click', ()=> importFile.click());

  importFile.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (ev)=>{
      try{
        const parsed = JSON.parse(ev.target.result);
        const list = Array.isArray(parsed) ? parsed : parsed.products;
        if(!Array.isArray(list)) throw new Error('formato inválido');
        const ok = confirm('Esto reemplazará tu catálogo actual (' + products.length + ' productos) por los ' + list.length + ' del archivo de respaldo. ¿Continuar?');
        if(!ok) return;
        const previousIds = products.map(p=>p.id);
        products = list;
        await saveProducts(previousIds);
        render();
        showToast('Catálogo restaurado desde el respaldo');
      }catch(err){
        showToast('Ese archivo no es un respaldo válido');
      }
    };
    reader.readAsText(file);
    importFile.value = '';
  });

  const SHEET_KEY = 'sheet-csv-url';

  function normHeader(h){
    return (h||'').toString().replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  }

  // Convierte valores de precio escritos de cualquier forma humana a número:
  // "S/ 150.00", "150,00", "1,200.50", "1.200,50", "S/150" -> todos correctos.
  function parseMoney(raw){
    if(raw === undefined || raw === null) return NaN;
    let s = raw.toString().trim();
    if(!s) return NaN;
    s = s.replace(/s\/\.?/gi, ''); // quita "S/" o "S/." (soles) antes de lo demás
    s = s.replace(/[^0-9.,\-]/g, ''); // quita "$", espacios, otras letras
    if(!s) return NaN;
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if(lastComma > -1 && lastDot > -1){
      // Tiene los dos separadores: el que aparece último es el decimal.
      s = (lastComma > lastDot) ? s.replace(/\./g,'').replace(',', '.') : s.replace(/,/g,'');
    } else if(lastComma > -1){
      // Solo coma: si quedan exactamente 2 dígitos después, es decimal; si no, es separador de miles.
      const decimals = s.length - lastComma - 1;
      s = (decimals === 2) ? s.replace(',', '.') : s.replace(/,/g,'');
    }
    return parseFloat(s);
  }

  function mapSheetRow(row){
    const obj = {};
    Object.keys(row).forEach(k=>{ obj[normHeader(k)] = row[k]; });
    const name = (obj['nombre']||'').toString().trim();
    // Busca la columna de precio: exacta "precio" primero, y si no existe,
    // cualquier columna que empiece con "precio" (ej. "Precio (S/)") sin ser la de "antes".
    let priceKey = (obj['precio'] !== undefined) ? 'precio'
      : Object.keys(obj).find(k=> k.indexOf('precio') === 0 && k.indexOf('antes') === -1);
    const price = priceKey ? (parseMoney(obj[priceKey]) || 0) : 0;
    const catRaw = (obj['categoria']||'otros').toString().trim().toLowerCase();
    const category = ['figuras','peluches','tcg','gaming','accesorios','hogar'].includes(catRaw) ? catRaw : 'otros';
    const stRaw = (obj['estado']||'disponible').toString().trim().toLowerCase();
    const status = ['disponible','preventa','vendido'].includes(stRaw) ? stRaw : 'disponible';
    const desc = (obj['descripcion']||'').toString().trim();
    let oldPrice = null;
    Object.keys(obj).forEach(k=>{
      if(k.indexOf('antes') !== -1){
        const v = parseMoney(obj[k]);
        if(!isNaN(v) && v > 0) oldPrice = v;
      }
    });
    const images = [];
    for(let i=1;i<=6;i++){
      const v = (obj['foto'+i+'url']||'').toString().trim();
      if(v) images.push(v);
    }
    // --- columnas nuevas (opcionales) ---
    // Solo se aplican si la columna existe en la hoja, para no borrar lo que
    // hayas cargado desde el panel.
    const buscar = (...nombres)=> nombres.find(n=> obj[n] !== undefined);

    const kTags = buscar('etiquetas','etiquetasocultas','tags');
    const tags = kTags ? (obj[kTags]||'').toString().split(',').map(t=>t.trim()).filter(Boolean) : null;

    const kShiny = buscar('shiny','esshiny');
    const shinyRaw = kShiny ? (obj[kShiny]||'').toString().trim().toLowerCase() : '';
    const shiny = kShiny ? ['si','sí','x','true','1','yes'].includes(shinyRaw) : null;

    const kFecha = buscar('fechallegada','fechadellegada','llega','fechapreventa');
    const expectedDate = kFecha ? (obj[kFecha]||'').toString().trim() : null;

    const kRec = buscar('recomendados','completatucoleccion','relacionados');
    const relatedNames = kRec ? (obj[kRec]||'').toString().split(',').map(t=>t.trim()).filter(Boolean) : null;

    // Permite CORREGIR el nombre de un producto que ya existe, en vez de crear
    // uno nuevo. Se escribe el nombre viejo aquí y el nuevo en la columna Nombre.
    const kPrev = buscar('nombreanterior','nombreantiguo','nombreviejo','nombreanterior1');
    const prevName = kPrev ? (obj[kPrev]||'').toString().trim() : '';

    return {
      name, price, category, status, desc, images,
      oldPrice: (oldPrice && oldPrice > price) ? oldPrice : null,
      tags, shiny, expectedDate, relatedNames, prevName
    };
  }

  // PapaParse solo hace falta para sincronizar con Google Sheets (uso exclusivo
  // del admin): se descarga bajo demanda, no en cada visita de un cliente.
  let papaParseCargando = null;
  function cargarPapaParse(){
    if(window.Papa) return Promise.resolve();
    if(!papaParseCargando){
      papaParseCargando = new Promise((resolve, reject)=>{
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return papaParseCargando;
  }

  async function syncFromSheet(url){
    try{
      await cargarPapaParse();
      const res = await fetch(url);
      if(!res.ok) throw new Error('fetch failed');
      const buffer = await res.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(buffer);
      const parsed = Papa.parse(text, {header:true, skipEmptyLines:true});
      let added = 0, updated = 0, renamed = 0;
      const touched = [];
      const pendientesRelacionados = [];
      const buscarPorNombre = (n)=> products.find(p=>
        p.source==='sheet' && (p.name||'').trim().toLowerCase() === n.trim().toLowerCase());
      parsed.data.forEach(row=>{
        const m = mapSheetRow(row);
        if(!m.name) return;
        let existing = buscarPorNombre(m.name);
        // No aparece con el nombre nuevo: puede ser un cambio de nombre.
        // Se busca por el nombre anterior y, si aparece, se renombra el mismo
        // producto (conserva id, fotos subidas y todo lo demás).
        if(!existing && m.prevName){
          const anterior = buscarPorNombre(m.prevName);
          if(anterior){ anterior.name = m.name; existing = anterior; renamed++; }
        }
        // Campos opcionales: si la columna no está en la hoja, se respeta lo que ya tenía.
        const aplicarExtras = (prod)=>{
          if(m.tags !== null) prod.tags = m.tags;
          if(m.shiny !== null) prod.shiny = m.shiny;
          if(m.expectedDate !== null) prod.expectedDate = m.expectedDate;
          if(m.relatedNames !== null) pendientesRelacionados.push({ prod, nombres: m.relatedNames });
        };
        if(existing){
          existing.price = m.price; existing.category = m.category;
          // Si ya lo marcaste vendido a mano, el Sheet no lo vuelve a publicar
          // (evita que se muestre como disponible de nuevo tras sincronizar).
          if(existing.status !== 'vendido' || m.status === 'vendido'){
            existing.status = m.status;
          }
          existing.desc = m.desc; existing.images = m.images; existing.oldPrice = m.oldPrice;
          aplicarExtras(existing);
          updated++;
          touched.push(existing);
        } else {
          const newProduct = {
            id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
            name: m.name, price: m.price, category: m.category, status: m.status,
            desc: m.desc, images: m.images, oldPrice: m.oldPrice, source: 'sheet', createdAt: Date.now()
          };
          aplicarExtras(newProduct);
          products.push(newProduct);
          touched.push(newProduct);
          added++;
        }
      });
      // Los recomendados vienen por NOMBRE en la hoja; aquí los convertimos al
      // identificador real, ya con todos los productos de la hoja creados.
      pendientesRelacionados.forEach(({prod, nombres})=>{
        prod.related = nombres
          .map(n => products.find(x => (x.name||'').trim().toLowerCase() === n.toLowerCase()))
          .filter(x => x && x.id !== prod.id)
          .map(x => x.id)
          .slice(0, 8);
      });

      if(touched.length){ await window.fbSaveProductsBatch(touched); publicarCatalogo(); }
      render();
      showToast('Sincronizado: ' + added + ' nuevos, ' + updated + ' actualizados'
        + (renamed ? ', ' + renamed + ' renombrados' : ''));
    }catch(e){
      showToast('No se pudo sincronizar. Revisa que el link esté publicado como CSV.');
    }
  }

  sheetBtn.addEventListener('click', async ()=>{
    let saved = '';
    try{
      const r = await window.storage.get(SHEET_KEY, true);
      saved = r ? r.value : '';
    }catch(e){ saved = ''; }
    sheetUrlInput.value = saved;
    sheetOverlay.classList.add('show');
    setTimeout(()=> sheetUrlInput.focus(), 50);
  });
  sheetCancel.addEventListener('click', ()=> sheetOverlay.classList.remove('show'));
  sheetOverlay.addEventListener('click', (e)=>{ if(e.target === sheetOverlay) sheetOverlay.classList.remove('show'); });
  const compressBtn = document.getElementById('compressBtn');
  if(compressBtn) compressBtn.addEventListener('click', async ()=>{
    if(!confirm('Esto vuelve a subir cada foto del catálogo ya comprimida. Puede tardar varios minutos y no se puede deshacer. ¿Continuar?')) return;
    compressBtn.disabled = true;
    const totalFotos = products.reduce((n,p)=> n + ((p.images||[]).length || (p.image?1:0)), 0);
    let hechas = 0, fallidas = 0;
    showToast('Comprimiendo 0/' + totalFotos + '...');
    for(const p of products){
      const imgs = Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []);
      if(!imgs.length) continue;
      const nuevas = [];
      for(const im of imgs){
        const src = imgSrc(im), pos = imgPos(im);
        try{
          const res = await fetch(src);
          const blob = await res.blob();
          if(blob.size <= 220 * 1024){ nuevas.push({ src, pos }); hechas++; continue; } // ya es liviana, no la tocamos
          const file = new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' });
          const nuevaUrl = await window.fbUploadImage(file);
          nuevas.push({ src: nuevaUrl, pos });
          hechas++;
        }catch(e){
          nuevas.push({ src, pos });
          fallidas++;
        }
        showToast('Comprimiendo ' + hechas + '/' + totalFotos + '...');
      }
      p.images = nuevas;
      try{ await window.fbSaveProduct(p); }catch(e){}
    }
    try{ await window.fbPublishCatalog(products); }catch(e){}
    localStorage.removeItem(CACHE_KEY);
    compressBtn.disabled = false;
    showToast('Listo: ' + hechas + ' fotos revisadas' + (fallidas ? ', ' + fallidas + ' con error' : '') + '.');
  });

  const pushBtn = document.getElementById('pushBtn');
  const iosPushOverlay = document.getElementById('iosPushOverlay');
  const iosPushOk = document.getElementById('iosPushOk');
  if(iosPushOk) iosPushOk.addEventListener('click', ()=> iosPushOverlay.classList.remove('show'));
  if(iosPushOverlay) iosPushOverlay.addEventListener('click', (e)=>{ if(e.target===iosPushOverlay) iosPushOverlay.classList.remove('show'); });
  if(pushBtn){
    if(window.fbPushActivado && window.fbPushActivado()) pushBtn.classList.add('active');
    pushBtn.addEventListener('click', async ()=>{
      if(window.fbPushActivado && window.fbPushActivado()){ showToast('Ya tienes las notificaciones activadas.'); return; }
      try{
        await window.fbEnablePush();
        pushBtn.classList.add('active', 'pulse');
        setTimeout(()=> pushBtn.classList.remove('pulse'), 650);
        showToast('¡Notificaciones activadas!');
      }catch(e){
        if(e.message === 'IOS_NO_INSTALADA') iosPushOverlay.classList.add('show');
        else showToast(e.message || 'No se pudo activar las notificaciones.');
      }
    });
  }

  const notifBtn = document.getElementById('notifBtn');
  const notifOverlay = document.getElementById('notifOverlay');
  const notifTitleInput = document.getElementById('notifTitleInput');
  const notifBodyInput = document.getElementById('notifBodyInput');
  const notifLinkInput = document.getElementById('notifLinkInput');
  const notifSendBtn = document.getElementById('notifSendBtn');
  const notifCancel = document.getElementById('notifCancel');
  if(notifBtn) notifBtn.addEventListener('click', ()=>{
    notifTitleInput.value = ''; notifBodyInput.value = ''; notifLinkInput.value = '';
    notifOverlay.classList.add('show');
  });
  if(notifCancel) notifCancel.addEventListener('click', ()=> notifOverlay.classList.remove('show'));
  if(notifSendBtn) notifSendBtn.addEventListener('click', async ()=>{
    const title = notifTitleInput.value.trim(), message = notifBodyInput.value.trim();
    if(!title || !message){ showToast('Escribe el título y el mensaje.'); return; }
    notifSendBtn.disabled = true;
    try{
      const pin = (await getPin()).toUpperCase();
      const res = await fetch('/api/send-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, title, message, link: notifLinkInput.value.trim() })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Error al enviar');
      showToast('Enviada a ' + data.sent + ' de ' + data.total + ' dispositivos.');
      notifOverlay.classList.remove('show');
    }catch(e){
      showToast(e.message || 'No se pudo enviar la notificación.');
    }finally{
      notifSendBtn.disabled = false;
    }
  });

  sheetSyncBtn.addEventListener('click', async ()=>{
    const url = sheetUrlInput.value.trim();
    if(!url){ showToast('Pega primero el link publicado'); return; }
    try{ await window.storage.set(SHEET_KEY, url, true); }catch(e){}
    sheetOverlay.classList.remove('show');
    showToast('Sincronizando...');
    await syncFromSheet(url);
  });


  // ================= inicio de sesión del administrador =================
  let haySesion = false;

  // Firebase avisa si hay sesión guardada (al cargar y en cada cambio).
  if(window.fbOnAuth){
    window.fbOnAuth(user => { haySesion = !!user; });
  }

  const loginOverlay = document.getElementById('loginOverlay');
  const loginEmail   = document.getElementById('loginEmail');
  const loginPass    = document.getElementById('loginPass');
  const loginError   = document.getElementById('loginError');
  const loginConfirm = document.getElementById('loginConfirm');
  const loginCancel  = document.getElementById('loginCancel');

  // Punto de entrada al panel: primero sesión, luego PIN.
  window.cerrarSesionAdmin = async function(){
    try{ if(window.fbLogout) await window.fbLogout(); }catch(e){}
    haySesion = false;
    isAdmin = false;
    updateAdminUI();
    showToast('Sesión cerrada');
  };

  function pedirAcceso(){
    if(haySesion || (window.fbCurrentUser && window.fbCurrentUser())){
      openPin('enter');
    } else {
      abrirLogin();
    }
  }

  function abrirLogin(){
    if(loginError) loginError.textContent = '';
    if(loginPass) loginPass.value = '';
    if(loginOverlay) loginOverlay.classList.add('show');
    setTimeout(()=> loginEmail && loginEmail.focus(), 50);
  }

  async function intentarLogin(){
    const email = (loginEmail.value || '').trim();
    const pass = loginPass.value || '';
    if(!email || !pass){ loginError.textContent = 'Escribe tu correo y contraseña.'; return; }
    loginError.textContent = 'Verificando...';
    loginConfirm.disabled = true;
    try{
      await window.fbLogin(email, pass);
      haySesion = true;
      loginOverlay.classList.remove('show');
      loginError.textContent = '';
      openPin('enter');   // ya con sesión, pasa al PIN
    }catch(err){
      const code = (err && err.code) || '';
      loginError.textContent = (code.includes('password') || code.includes('credential') || code.includes('user'))
        ? 'Correo o contraseña incorrectos.'
        : 'No se pudo iniciar sesión. Revisa tu conexión.';
    }finally{
      loginConfirm.disabled = false;
    }
  }

  if(loginConfirm) loginConfirm.addEventListener('click', intentarLogin);
  if(loginPass) loginPass.addEventListener('keydown', e=>{ if(e.key === 'Enter') intentarLogin(); });
  if(loginCancel) loginCancel.addEventListener('click', ()=> loginOverlay.classList.remove('show'));


  adminToggle.addEventListener('click', ()=>{
    if(isAdmin){
      isAdmin = false;
      updateAdminUI();
      showToast('Modo tienda desactivado');
    } else {
      pedirAcceso();
    }
  });

  // long-press style: double click admin label area lets shop owner change PIN once inside
  adminToggle.addEventListener('dblclick', (e)=>{
    if(isAdmin){
      e.preventDefault();
      openPin('change');
    }
  });

  // ---------- entrada privada al modo tienda ----------
  // 1) Toca el logo 5 veces seguidas (en menos de 2s) para abrir el PIN.
  const brandMark = document.getElementById('brandMark');
  let tapCount = 0, tapTimer = null;
  brandMark.addEventListener('click', ()=>{
    if(isAdmin) return;
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(()=> tapCount = 0, 2000);
    if(tapCount >= 5){
      tapCount = 0;
      clearTimeout(tapTimer);
      pedirAcceso();
    }
  });

  if(location.hash === '#p'){
    setTimeout(()=> pedirAcceso(), 300);
    history.replaceState(null, '', location.pathname + location.search);
  }

  // 3) Salir sola tras 15 min sin actividad, por si olvidas cerrar el modo tienda.
  let idleTimer = null;
  function resetIdleTimer(){
    if(!isAdmin) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(()=>{
      if(isAdmin){
        isAdmin = false;
        updateAdminUI();
        showToast('Modo tienda cerrado por inactividad');
      }
    }, 15*60*1000);
  }
  ['click','keydown','mousemove','touchstart'].forEach(ev=>{
    document.addEventListener(ev, resetIdleTimer, {passive:true});
  });

  // ---------- tema claro / oscuro ----------
  const THEME_KEY = 'theme-pref';
  function applyTheme(pref){
    document.documentElement.setAttribute('data-theme', pref);
    const isDarkNow = pref === 'dark';
    if(typeof actualizarVisibilidadIconos === 'function') actualizarVisibilidadIconos(isDarkNow);
    else {
      themeToggle.querySelector('.icon-sun').style.display = isDarkNow ? 'none' : 'block';
      themeToggle.querySelector('.icon-moon').style.display = isDarkNow ? 'block' : 'none';
    }
    themeToggle.title = isDarkNow ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if(themeColorMeta) themeColorMeta.setAttribute('content', isDarkNow ? '#1e1e1e' : '#fbfbfa');
    if(typeof aplicarLogo === 'function') aplicarLogo();
  }

  // Arranca siguiendo el dispositivo; si el usuario ya eligió antes, respeta su elección.
  let themePref;
  let temaElegidoManualmente = false;
  (function(){
    let saved = null;
    try{ saved = localStorage.getItem(THEME_KEY); }catch(e){}
    if(saved === 'light' || saved === 'dark'){
      themePref = saved;
      temaElegidoManualmente = true;
    } else {
      themePref = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme(themePref);
  })();

  // Si el usuario nunca eligió manualmente, sigue el tema del sistema en vivo
  // (por ejemplo, si el celular cambia a modo oscuro automáticamente al anochecer).
  if(window.matchMedia){
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e)=>{
      if(temaElegidoManualmente) return;
      themePref = e.matches ? 'light' : 'dark';
      applyTheme(themePref);
    });
  }

  themeToggle.addEventListener('click', ()=>{
    themePref = themePref === 'dark' ? 'light' : 'dark';
    temaElegidoManualmente = true;
    applyTheme(themePref);
    try{ localStorage.setItem(THEME_KEY, themePref); }catch(e){}
  });
  window.addEventListener('storage', (e)=>{
    if(e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')){
      themePref = e.newValue;
      temaElegidoManualmente = true;
      applyTheme(themePref);
    }
  });

  // Generar manifest para poder instalar como web app en el celular
  (function(){
    try{
      const logoImg = document.querySelector('#brandMark img');
      const iconSrc = logoImg ? logoImg.src : '';
      const bgNow = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#1e1e1e';
      const manifest = {
        name: 'La Tienda de Meowth',
        short_name: 'Meowth',
        start_url: '.',
        display: 'standalone',
        background_color: bgNow,
        theme_color: bgNow,
        icons: iconSrc ? [
          { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: iconSrc, sizes: '512x512', type: 'image/png', purpose: 'any' }
        ] : []
      };
      const blob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = url;
      document.head.appendChild(link);
      if(iconSrc){
        const apple = document.createElement('link');
        apple.rel = 'apple-touch-icon';
        apple.href = iconSrc;
        document.head.appendChild(apple);
      }
    }catch(e){ /* si falla, el sitio sigue funcionando normal */ }
  })();

  // ---------- franja de confianza deslizante (arriba del header) ----------
  function aplicarTicker(){
    const messages = (siteContent.ticker || []).filter(m=> (m || '').trim());
    if(!messages.length) return;
    const track = document.getElementById('trustTickerTrack');
    if(!track) return;
    track.innerHTML = '';
    // Se duplica la lista una vez: al animar de 0% a -50% del ancho total,
    // la segunda copia entra justo cuando la primera sale, sin salto ni espacio en blanco.
    [...messages, ...messages].forEach(msg=>{
      const el = document.createElement('div');
      el.className = 'trust-ticker-item';
      el.textContent = msg;
      track.appendChild(el);
    });
  }
  aplicarTicker();

  // Tarjetas "fantasma" mientras llegan los productos: la página se siente
  // viva de inmediato en vez de mostrar un hueco en blanco.
  function mostrarEsqueletos(){
    const hueco = ()=>{
      const d = document.createElement('div');
      d.className = 'card-esqueleto';
      d.innerHTML = '<div class="esq-foto"></div><div class="esq-linea"></div><div class="esq-linea corta"></div><div class="esq-boton"></div>';
      return d;
    };
    if(grid && !grid.children.length){
      for(let i = 0; i < 8; i++) grid.appendChild(hueco());
    }
  }

  function startApp(){
    mostrarEsqueletos();
    loadProducts();
    loadBannerSlides();
    loadSiteContent();
  }
  if(window.__firebaseReady){
    startApp();
  } else {
    window.addEventListener('firebase-ready', startApp, { once:true });
    // Respaldo: si la conexión inicial tarda (primera visita, conexión fría),
    // no dejamos la pantalla colgada: reintentamos varias veces antes de avisar.
    let watchdogTries = 0;
    const watchdog = setInterval(()=>{
      if(window.__firebaseReady){ clearInterval(watchdog); return; }
      watchdogTries++;
      if(watchdogTries >= 5){
        clearInterval(watchdog);
        if(loadingState) loadingState.style.display='none';
        showToast('La conexión está lenta. Reintentando...');
        // último intento: si Firebase de verdad no respondió, forzamos un solo reintento de carga.
        setTimeout(()=>{ if(!window.__firebaseReady) location.reload(); }, 4000);
      }
    }, 3000);
  }

  document.querySelectorAll('.footer-link-btn[data-open-tab]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var key = btn.getAttribute('data-open-tab');
      cerrarCatalogoCompleto();
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          var section = document.getElementById(key === 'quienes' ? 'quienesSection' : 'comprarSection');
          if(section) section.scrollIntoView({behavior:'smooth', block:'start'});
        });
      });
    });
  });

  // ---------- navegación del header (Conóceme / Cómo comprar / Catálogo / Comunidad) ----------
  var navConocenos = document.getElementById('navConocenos');
  var navComprar = document.getElementById('navComprar');
  var navCatalogo = document.getElementById('navCatalogo');
  var navComunidad = document.getElementById('navComunidad');
  function scrollToFooter(){
    cerrarCatalogoCompleto();
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        var section = document.querySelector('.site-footer');
        if(section) section.scrollIntoView({behavior:'smooth', block:'start'});
      });
    });
  }
  if(navCatalogo) navCatalogo.addEventListener('click', openFullCatalog);
  function scrollToFixedSection(key){
    cerrarCatalogoCompleto();
    var section = document.getElementById(key === 'quienes' ? 'quienesSection' : 'comprarSection');
    // Doble rAF: espera a que el navegador reacomode la página tras cerrar el catálogo
    // (el teaser tarda un frame extra en recuperar su alto real).
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        if(section) section.scrollIntoView({behavior:'smooth', block:'start'});
      });
    });
    var soundUrl = siteContent.sounds && siteContent.sounds[key];
    if(soundUrl){
      try{ new Audio(soundUrl).play().catch(function(){}); }catch(e){}
    }
  }
  if(navComprar) navComprar.addEventListener('click', function(){ scrollToFixedSection('comprar'); });
  if(navConocenos) navConocenos.addEventListener('click', function(){ scrollToFixedSection('quienes'); });
  if(navComunidad) navComunidad.addEventListener('click', scrollToFooter);

  // ---------- los mismos 4 botones, para móvil, debajo del header ----------
  var footerNavNosotros = document.getElementById('mobileNavNosotros');
  var footerNavComprar = document.getElementById('mobileNavComprar');
  var footerNavCatalogo = document.getElementById('mobileNavCatalogo');
  var footerNavComunidad = document.getElementById('mobileNavComunidad');
  if(footerNavCatalogo) footerNavCatalogo.addEventListener('click', openFullCatalog);
  if(footerNavComprar) footerNavComprar.addEventListener('click', function(){ scrollToFixedSection('comprar'); });
  if(footerNavNosotros) footerNavNosotros.addEventListener('click', function(){ scrollToFixedSection('quienes'); });
  if(footerNavComunidad) footerNavComunidad.addEventListener('click', scrollToFooter);
})();
