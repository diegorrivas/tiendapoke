import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
  import {
    getMessaging, getToken
  } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
  import {
    getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, writeBatch
  } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
  import {
    getStorage, ref, uploadBytes, getDownloadURL
  } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
  import {
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "AIzaSyAMpknTt4Dpv76kYf_xjOiuETf2VvC5efw",
    authDomain: "tiendameowth.firebaseapp.com",
    projectId: "tiendameowth",
    storageBucket: "tiendameowth.firebasestorage.app",
    messagingSenderId: "81330531760",
    appId: "1:81330531760:web:610f920a48eaf6db3bba75",
    measurementId: "G-1Z0ZVSR6FZ"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const auth = getAuth(app);

  // ---------- notificaciones push ----------
  // La clave VAPID se genera en Firebase Console: Configuración del proyecto ->
  // Cloud Messaging -> pestaña "Web configuration" -> "Generate key pair".
  const VAPID_KEY = "PON_AQUI_TU_CLAVE_VAPID";
  window.fbEnablePush = async function(){
    if(!('serviceWorker' in navigator) || !('Notification' in window)) throw new Error('Este navegador no soporta notificaciones.');
    const permiso = await Notification.requestPermission();
    if(permiso !== 'granted') throw new Error('Permiso de notificaciones denegado.');
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if(!token) throw new Error('No se pudo generar el token de notificaciones.');
    await setDoc(doc(db, 'push_tokens', token), { token, createdAt: Date.now() });
    localStorage.setItem('push-activado', '1');
    return token;
  };
  window.fbPushActivado = function(){
    return localStorage.getItem('push-activado') === '1' && Notification.permission === 'granted';
  };

  // ---------- inicio de sesión del administrador ----------
  // El panel solo puede escribir/borrar si hay una sesión iniciada. Las reglas
  // de Firebase exigen esta sesión para cualquier cambio en la base.
  window.fbLogin = async function(email, password){
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };
  window.fbLogout = async function(){
    await signOut(auth);
  };
  // Avisa al panel cuándo hay sesión y cuándo no (al cargar y en cada cambio).
  window.fbOnAuth = function(callback){
    onAuthStateChanged(auth, user => callback(user || null));
  };
  window.fbCurrentUser = function(){
    return auth.currentUser || null;
  };

  // Cada "clave" (products, banner-slides, admin-pin, sheet-url) se guarda
  // como un documento dentro de la coleccion "catalogo".
  const COL = 'catalogo';

  // Puente: imita la API window.storage que ya usa el catalogo,
  // pero por debajo lee/escribe en Firestore.
  window.storage = {
    async get(key){
      try{
        const snap = await getDoc(doc(db, COL, key));
        if(snap.exists()){
          const data = snap.data();
          return { key, value: data.value };
        }
        return null;
      }catch(e){
        console.error('Firestore get error', e);
        return null;
      }
    },
    async set(key, value){
      try{
        await setDoc(doc(db, COL, key), { value });
        return { key, value };
      }catch(e){
        console.error('Firestore set error', e);
        throw e;
      }
    },
    async delete(key){
      return { key, deleted: true };
    }
  };

  // Reduce tamaño de la foto antes de subirla: máx 1600px de lado y calidad 0.82.
  // Así las fotos nuevas pesan una fracción de lo que pesa la foto original del celular.
  async function comprimirImagen(file){
    if(!file.type || !file.type.startsWith('image/') || file.type === 'image/gif') return file;
    try{
      const bitmap = await createImageBitmap(file);
      const MAX = 1600;
      let { width, height } = bitmap;
      if(width > MAX || height > MAX){
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
      if(!blob || blob.size >= file.size) return file; // si no mejora, nos quedamos con la original
      return new File([blob], (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    }catch(e){
      return file; // si algo falla (formato raro, navegador viejo), subimos la original
    }
  }

  // Subida de imagenes a Firebase Storage -> devuelve el link publico.
  window.fbUploadImage = async function(file){
    file = await comprimirImagen(file);
    const stamp = Date.now() + '_' + Math.random().toString(36).slice(2,8);
    const safeName = (file.name || 'foto').replace(/[^\w.\-]/g, '_');
    const r = ref(storage, 'productos/' + stamp + '_' + safeName);
    // Caché larga: las fotos no cambian una vez subidas, así el navegador del
    // visitante las reutiliza en vez de volver a descargarlas cada visita.
    const metadata = { cacheControl: 'public, max-age=31536000, immutable' };
    await uploadBytes(r, file, metadata);
    return await getDownloadURL(r);
  };

  // ---------- productos: un documento por producto (colección "productos"), no un solo bloque ----------
  const PRODUCTS_COL = 'productos';

  window.fbLoadAllProducts = async function(){
    try{
      const snap = await getDocs(collection(db, PRODUCTS_COL));
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    }catch(e){
      console.error('Error cargando productos', e);
      return null; // null = fallo real de conexión, distinto de [] = catálogo vacío de verdad
    }
  };

  window.fbSaveProduct = async function(product){
    await setDoc(doc(db, PRODUCTS_COL, String(product.id)), product);
  };

  window.fbDeleteProduct = async function(id){
    await deleteDoc(doc(db, PRODUCTS_COL, String(id)));
  };

  // Guarda/borra muchos productos a la vez, en bloques de 450
  // (Firestore permite máximo 500 operaciones por lote).

  // ---------- catálogo publicado (para la tienda) ----------
  // Leer 500 productos uno por uno costaría 500 lecturas por visita y agotaría
  // la cuota gratuita. Aquí guardamos el catálogo completo en unos pocos
  // documentos: la tienda lee 3 o 4 en vez de cientos.
  const CATALOGO_COL = 'catalogo';
  const POR_PARTE = 120;

  window.fbPublishCatalog = async function(productList){
    const partes = [];
    for(let i = 0; i < productList.length; i += POR_PARTE){
      partes.push(productList.slice(i, i + POR_PARTE));
    }
    const version = Date.now();
    const batch = writeBatch(db);
    partes.forEach((items, i)=>{
      batch.set(doc(db, CATALOGO_COL, 'parte_' + i), { items, version });
    });
    batch.set(doc(db, CATALOGO_COL, 'meta'), { partes: partes.length, version, total: productList.length });
    await batch.commit();

    // borra sobrantes de publicaciones anteriores más largas
    for(let i = partes.length; i < partes.length + 6; i++){
      try{ await deleteDoc(doc(db, CATALOGO_COL, 'parte_' + i)); }catch(e){ /* no existía */ }
    }
    return version;
  };

  window.fbLoadCatalog = async function(){
    try{
      const metaSnap = await getDoc(doc(db, CATALOGO_COL, 'meta'));
      if(!metaSnap.exists()) return null;         // aún no se ha publicado nunca
      const meta = metaSnap.data();
      const lecturas = [];
      for(let i = 0; i < meta.partes; i++){
        lecturas.push(getDoc(doc(db, CATALOGO_COL, 'parte_' + i)));
      }
      const partes = await Promise.all(lecturas);
      const lista = [];
      partes.forEach(sn => { if(sn.exists()) lista.push(...(sn.data().items || [])); });
      return { productos: lista, version: meta.version };
    }catch(e){
      console.error('Error cargando catálogo publicado', e);
      return null;
    }
  };

  window.fbSaveProductsBatch = async function(productList){
    const chunkSize = 450;
    for(let i = 0; i < productList.length; i += chunkSize){
      const chunk = productList.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(p => batch.set(doc(db, PRODUCTS_COL, String(p.id)), p));
      await batch.commit();
    }
  };
  window.fbDeleteProductsBatch = async function(ids){
    const chunkSize = 450;
    for(let i = 0; i < ids.length; i += chunkSize){
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(id => batch.delete(doc(db, PRODUCTS_COL, String(id))));
      await batch.commit();
    }
  };

  window.__firebaseReady = true;
  window.dispatchEvent(new Event('firebase-ready'));

  // ---------- blog: un documento por post (colección "blog_posts") ----------
  const BLOG_COL = 'blog_posts';
  window.fbLoadBlogPosts = async function(){
    const snap = await getDocs(collection(db, BLOG_COL));
    const list = [];
    snap.forEach(d => list.push(d.data()));
    return list;
  };
  window.fbSaveBlogPost = async function(post){
    await setDoc(doc(db, BLOG_COL, String(post.id)), post);
  };
  window.fbDeleteBlogPost = async function(id){
    await deleteDoc(doc(db, BLOG_COL, String(id)));
  };
