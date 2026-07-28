// ===== Reja: umumiy (shared) yordamchi funksiyalar =====
// index.html va admin.html ikkalasi ham shu faylni ishlatadi.

const KUN = ['Dush','Sesh','Chor','Pay','Juma','Shan','Yak'];

const KUN_FULL = ['Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba'];

const MOY = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

const MUASSASA_LABEL = { maktab:'Maktab', litsey:'Akademik litsey', 'kasb-hunar':'Kasb-hunar maktabi', universitet:'Universitet / institut' };

function sanitizeKey(s){ return s.toLowerCase().trim().replace(/[\/\\'"\s]/g, '_'); }

function b64(s){ try{ return btoa(unescape(encodeURIComponent(s))); }catch(e){ return s; } }

function todayISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

function nowHM(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }

function dowIndex(dateStr){ const d=new Date(dateStr+'T00:00:00'); const j=d.getDay(); return j===0?6:j-1; }

function fmtDate(dateStr){ const d=new Date(dateStr+'T00:00:00'); return d.getDate()+' '+MOY[d.getMonth()]; }

function fmtDateTime(ts){ const d=new Date(ts); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }

function uid(){ return 'id'+Date.now()+Math.random().toString(36).slice(2,7); }

function initials(name){ return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase(); }

function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s==null?'':s; return d.innerHTML; }

function threadKey(a,b){ return 'thread:' + [sanitizeKey(a), sanitizeKey(b)].sort().join('__'); }

function applyTheme(){ document.body.setAttribute('data-theme', state.theme); }
async function toggleTheme(){
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  if(state.user && state.user.email){
    const key = 'account:'+sanitizeKey(state.user.email);
    const existing = await sGet(key) || {};
    const merged = Object.assign({}, existing, { theme: state.theme });
    await sSet(key, merged);
  }
  render();
}

async function sGet(key){ try{ const r = await window.storage.get(key, true); return r ? r.value : null; }catch(e){ return null; } }

async function sSet(key, val){ try{ return await window.storage.set(key, val, true); }catch(e){ console.error(e); return null; } }

function svgIcon(name){
  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-8z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16l-4-3-3 3-3-3-4 3V4z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M2 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5"/><circle cx="18" cy="9" r="2.4"/><path d="M15.5 14.2c2 .2 4 1.6 4.8 4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v11H8l-4 4V5z"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10v4h4l6 4V6L7 10H3z"/><path d="M17 9a4 4 0 010 6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/></svg>',
    grade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M9 9l2 2 4-4"/><path d="M8 15h8"/></svg>'
  };
  return icons[name]||'';
}


// ===== Firebase: ilovaning haqiqiy backend'i =====
const firebaseConfig = {
  apiKey: "AIzaSyAKphkVF5p-RUmeVXnpfZexXxyrmOFsU20",
  authDomain: "reja-224b0.firebaseapp.com",
  projectId: "reja-224b0",
  storageBucket: "reja-224b0.firebasestorage.app",
  messagingSenderId: "126743815442",
  appId: "1:126743815442:web:3596eb71a04d2ef7d4ffcb",
  measurementId: "G-14Q1QW4LBT"
};
firebase.initializeApp(firebaseConfig);
const _auth = firebase.auth();
const _db = firebase.firestore();
// Firebase Storage endi ishlatilmaydi — rasm yuklash Firestore ichida
// (base64 sifatida) amalga oshadi, pastga qarang.

// ESLATMA: ilgari bu yerda rasm Firebase STORAGE'ga yuklanardi
// (uploadImage → _storage.ref().put(file)). Lekin 2026-yildan boshlab
// Firebase Storage'dan foydalanish uchun loyiha albatta pullik (Blaze)
// rejada bo'lishi shart bo'lib qoldi. Buning o'rniga, endi rasm brauzerning
// o'zida kichraytirilib/siqilib, oddiy matn (base64) ko'rinishida to'g'ridan
// to'g'ri Firestore hujjatining ichiga saqlanadi — bu butunlay BEPUL va
// Storage'ga umuman ehtiyoj qoldirmaydi, va (localStorage'dan farqli
// o'laroq) barcha qurilmalarda ko'rinadi, chunki ma'lumot Firestore'da,
// faqat bitta qurilmada emas.
//
// CHEKLOV: Firestore'da bitta hujjat 1 MB dan oshmasligi kerak, va bu
// ilovada barcha e'lonlar bitta hujjatda saqlanadi — shuning uchun rasm
// avtomatik kichraytiriladi (eng katta tomoni 900px) va siqiladi (JPEG,
// sifat ~65%), bu odatda 50-150 KB atrofida chiqadi.
function resizeImageToDataURL(file, maxDim, quality){
  return new Promise((resolve, reject)=>{
    if(!file.type || !file.type.startsWith('image/')){
      reject(new Error('Faqat rasm fayllarini yuklash mumkin.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = ()=> reject(new Error('Faylni o\'qib bo\'lmadi.'));
    reader.onload = (e)=>{
      const img = new Image();
      img.onerror = ()=> reject(new Error('Rasmni ochib bo\'lmadi.'));
      img.onload = ()=>{
        let { width, height } = img;
        if(width > height && width > maxDim){ height = Math.round(height * maxDim / width); width = maxDim; }
        else if(height > maxDim){ width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file){
  const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024;
  if(file.size > MAX_ORIGINAL_BYTES) throw new Error("Rasm hajmi 8MB dan oshmasin.");
  const dataUrl = await resizeImageToDataURL(file, 900, 0.65);
  const MAX_ENCODED_BYTES = 700 * 1024; // Firestore hujjat hajmi (1MB)ga sig'ishi uchun zaxira bilan
  if(dataUrl.length > MAX_ENCODED_BYTES){
    throw new Error("Rasm siqilgandan keyin ham katta chiqdi. Iltimos, boshqa (kichikroq/kam detalli) rasm tanlang.");
  }
  return dataUrl;
}

// window.storage'ni Firestore bilan ta'minlaymiz — app.js/admin.js hech narsani
// o'zgartirmasdan, xuddi avvalgidek window.storage.get/set/delete/list chaqiradi,
// lekin ma'lumot endi Claude vaqtinchalik xotirasida emas, haqiqiy Firestore bazasida saqlanadi.
window.storage = {
  async get(key, shared){
    try{
      const snap = await _db.collection('kv').doc(key).get();
      if(!snap.exists) return null;
      return { key, value: snap.data().value, shared: !!shared };
    }catch(e){ console.error('storage.get', e); return null; }
  },
  async set(key, value, shared){
    try{
      await _db.collection('kv').doc(key).set({ key, value, shared: !!shared, updatedAt: Date.now() });
      return { key, value, shared: !!shared };
    }catch(e){ console.error('storage.set', e); return null; }
  },
  async delete(key, shared){
    try{
      await _db.collection('kv').doc(key).delete();
      return { key, deleted: true, shared: !!shared };
    }catch(e){ console.error('storage.delete', e); return null; }
  },
  async list(prefix, shared){
    try{
      // MUHIM: avval bu yerda butun 'kv' kolleksiyasi (_db.collection('kv').get())
      // to'liq yuklab olinar, keyin faqat prefiksga mos kelganlari filtrlanardi.
      // Bu ham sekin (kolleksiya kattalashgani sayin qimmatlashadi), ham xavfli edi:
      // Firestore xavfsizlik qoidalari endi hujjatga bog'liq (egasiga qarab) bo'lgani
      // uchun, prefiksisiz to'liq skanerlash so'rovi qoidalar tomonidan rad etiladi.
      // O'rniga faqat kerakli prefiks oralig'ini so'raymiz — bu ham tezroq,
      // ham qoidalar bilan mos ("range query on documentId").
      let q = _db.collection('kv');
      if(prefix){
        q = q.orderBy(firebase.firestore.FieldPath.documentId())
             .startAt(prefix)
             .endAt(prefix + '\uf8ff');
      }
      const snap = await q.get();
      const keys = [];
      snap.forEach(doc=>{ keys.push(doc.id); });
      return { keys, prefix, shared: !!shared };
    }catch(e){ console.error('storage.list', e); return null; }
  }
};

// =====================================================================
// Ota-ona bog'lanish so'rovlari — endi HAQIQIY subcollection'da
// (linkRequests/<studentKey>/requests/<parentKey>), avvalgidek bitta
// katta massiv-hujjatda emas. Har bir so'rov o'z hujjatiga ega bo'lgani
// uchun, Firestore xavfsizlik qoidalari aniq egalikni tekshira oladi.
// =====================================================================
function linkReqCollection(studentKey){
  return _db.collection('linkRequests').doc(studentKey).collection('requests');
}

// Talaba ro'yxatdan o'tganda o'zini "mavjud" deb belgilaydi — bu orqali
// ota-onalar hali bog'lanmagan bo'lsa ham, shu email bilan talaba
// borligini (shaxsiy ma'lumotlarsiz) tekshira oladi.
async function studentDirAdd(studentKey){
  try{ await _db.collection('studentDirectory').doc(studentKey).set({ exists: true }); }
  catch(e){ console.error('studentDirAdd', e); }
}
async function studentDirRemove(studentKey){
  try{ await _db.collection('studentDirectory').doc(studentKey).delete(); }
  catch(e){ console.error('studentDirRemove', e); }
}
async function studentDirExists(studentKey){
  try{ const doc = await _db.collection('studentDirectory').doc(studentKey).get(); return doc.exists; }
  catch(e){ console.error('studentDirExists', e); return false; }
}

async function lrListForStudent(studentKey){
  try{
    const snap = await linkReqCollection(studentKey).get();
    return snap.docs.map(d=> Object.assign({ id: d.id }, d.data()));
  }catch(e){ console.error('lrListForStudent', e); return []; }
}

async function lrGet(studentKey, parentKey){
  try{
    const doc = await linkReqCollection(studentKey).doc(parentKey).get();
    return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
  }catch(e){ console.error('lrGet', e); return null; }
}

// Yangi so'rov yaratadi (yoki avval rad etilgan so'rovni qayta faollashtiradi).
async function lrSendOrRetry(studentKey, parentKey, parentEmail, parentName){
  await linkReqCollection(studentKey).doc(parentKey).set({
    parentEmail: parentEmail.toLowerCase(),
    parentName: parentName || '',
    studentEmail: studentKey,
    status: 'pending',
    createdAt: Date.now()
  });
}

async function lrRespond(studentKey, parentKey, accept){
  await linkReqCollection(studentKey).doc(parentKey).update({
    status: accept ? 'accepted' : 'declined',
    respondedAt: Date.now()
  });
}

// Hisob o'chirilganda unga tegishli barcha so'rov hujjatlarini tozalash uchun.
async function lrDeleteAllForStudent(studentKey){
  try{
    const snap = await linkReqCollection(studentKey).get();
    const batch = _db.batch();
    snap.docs.forEach(d=> batch.delete(d.ref));
    await batch.commit();
  }catch(e){ console.error('lrDeleteAllForStudent', e); }
}

async function lrDeleteAllForParent(parentEmail){
  try{
    const snap = await _db.collectionGroup('requests').where('parentEmail','==', parentEmail.toLowerCase()).get();
    const batch = _db.batch();
    snap.docs.forEach(d=> batch.delete(d.ref));
    await batch.commit();
  }catch(e){ console.error('lrDeleteAllForParent', e); }
}

// Ota-ona o'ziga bog'langan (status==accepted) barcha farzandlarni topadi.
// ESLATMA: bu collectionGroup so'rov birinchi marta ishga tushganda
// Firebase konsolida (yoki xatolik xabarida chiqqan havola orqali)
// "parentEmail + status" uchun kompozit indeks yaratishni so'rashi mumkin —
// shunchaki taklif qilingan havolani bosish kifoya.
async function lrListForParent(parentEmail){
  try{
    const snap = await _db.collectionGroup('requests')
      .where('parentEmail','==', parentEmail.toLowerCase())
      .where('status','==','accepted')
      .get();
    return snap.docs.map(d=> Object.assign({ id: d.id }, d.data()));
  }catch(e){ console.error('lrListForParent', e); return []; }
}

// =====================================================================
// parentChildren/<parentKey>/list/<studentKey> — ota-onaga bog'langan
// farzandlar RO'YXATI.
//
// ESLATMA: bu, avvalgi versiyada ishlatilgan collectionGroup('requests')
// so'rovi o'rniga qo'shildi. Sabab: Firestore xavfsizlik qoidalari LIST
// so'rovlari uchun shartni "isbotlab" bera olishi kerak; oddiy maydon
// tengligi (parentEmail==...) ba'zan bunga yetarli bo'lmay, "Missing or
// insufficient permissions" xatoligiga olib kelishi mumkin edi. Bu yerda
// esa har bir ota-ona FAQAT o'zining pastki to'plamini so'raydi — bu har
// doim 100% aniq va xavfsiz tekshiriladi.
//
// Yozuvni FAQAT talaba o'zi (status'ni 'accepted'ga o'zgartirgan paytda)
// qiladi — va buni faqat linkRequests hujjatida haqiqatan ham
// status=='accepted' bo'lsa qila oladi (firestore.rules'da tekshiriladi).
// =====================================================================
async function pcAdd(parentKey, studentKey, studentEmail){
  try{
    await _db.collection('parentChildren').doc(parentKey).collection('list').doc(studentKey)
      .set({ studentEmail: studentEmail.toLowerCase(), linkedAt: Date.now() });
  }catch(e){ console.error('pcAdd', e); }
}
async function pcListForParent(parentKey){
  try{
    const snap = await _db.collection('parentChildren').doc(parentKey).collection('list').get();
    return snap.docs.map(d=> d.data().studentEmail);
  }catch(e){ console.error('pcListForParent', e); return []; }
}
async function pcDeleteAllForParent(parentKey){
  try{
    const snap = await _db.collection('parentChildren').doc(parentKey).collection('list').get();
    const batch = _db.batch();
    snap.docs.forEach(d=> batch.delete(d.ref));
    await batch.commit();
  }catch(e){ console.error('pcDeleteAllForParent', e); }
}

// =====================================================================
// E'lonlar — endi har biri alohida hujjat
// (announcements/<institutionKey>/posts/<postId>), avvalgidek bitta
// katta massiv-hujjatda emas. Bu ham xavfsizlikni (har bir e'lonni
// faqat o'z muallifi o'zgartira oladi), ham Firestore'ning 1MB/hujjat
// chegarasi bilan bog'liq xavfni yo'qotadi.
// =====================================================================
function announcementsCollection(institutionKey){
  return _db.collection('announcements').doc(institutionKey).collection('posts');
}

async function annList(institutionKey){
  try{
    const snap = await announcementsCollection(institutionKey).orderBy('createdAt','desc').get();
    return snap.docs.map(d=> Object.assign({ id: d.id }, d.data()));
  }catch(e){ console.error('annList', e); return []; }
}

async function annCreate(institutionKey, data){
  const id = uid();
  await announcementsCollection(institutionKey).doc(id).set(Object.assign({}, data, { createdAt: Date.now() }));
  return id;
}

async function annUpdate(institutionKey, id, patch){
  await announcementsCollection(institutionKey).doc(id).update(patch);
}

async function annDelete(institutionKey, id){
  await announcementsCollection(institutionKey).doc(id).delete();
}

// Muassasa admini hisobi o'chirilganda uning barcha e'lonlarini tozalash uchun.
async function annDeleteAll(institutionKey){
  try{
    const snap = await announcementsCollection(institutionKey).get();
    const batch = _db.batch();
    snap.docs.forEach(d=> batch.delete(d.ref));
    await batch.commit();
  }catch(e){ console.error('annDeleteAll', e); }
}

// ===== Firebase Authentication yordamchilari =====
async function fbRegister(email, parol){
  return _auth.createUserWithEmailAndPassword(email, parol);
}

// Email tasdiqlash xati yuborish (Firebase Auth ichida bepul, tayyor funksiya).
async function fbSendVerification(){
  if(_auth.currentUser){
    return _auth.currentUser.sendEmailVerification();
  }
}

async function fbLogin(email, parol){
  return _auth.signInWithEmailAndPassword(email, parol);
}
async function fbGoogleSignIn(){
  const provider = new firebase.auth.GoogleAuthProvider();
  return _auth.signInWithPopup(provider);
}
async function fbSendPasswordReset(email){
  return _auth.sendPasswordResetEmail(email);
}
async function fbLinkPassword(email, parol){
  const cred = firebase.auth.EmailAuthProvider.credential(email, parol);
  return _auth.currentUser.linkWithCredential(cred);
}
function fbErrorToUzbek(err){
  const code = (err && err.code) || '';
  const map = {
    'auth/email-already-in-use': "Bu email allaqachon ro'yxatdan o'tgan. Kirish qiling.",
    'auth/invalid-email': "Email manzili noto'g'ri.",
    'auth/weak-password': "Parol juda oddiy — kamida 6 ta belgi bo'lsin.",
    'auth/user-not-found': "Bunday hisob topilmadi.",
    'auth/wrong-password': "Email yoki parol noto'g'ri.",
    'auth/invalid-credential': "Email yoki parol noto'g'ri.",
    'auth/too-many-requests': "Juda ko'p urinish. Biroz kutib qayta urinib ko'ring.",
    'auth/popup-closed-by-user': "Google oynasi yopib yuborildi.",
    'auth/network-request-failed': "Internet aloqasi bilan muammo. Ulanishni tekshirib, qayta urinib ko'ring.",
    'auth/provider-already-linked': "Bu hisobga parol allaqachon o'rnatilgan.",
    'auth/credential-already-in-use': "Bu parol boshqa hisobga bog'langan.",
    'auth/requires-recent-login': "Xavfsizlik uchun qayta kirib, so'ng qayta urining.",
    // Firestore'dan keladigan xatoliklar (masalan window.storage yoki
    // linkRequests/announcements funksiyalari orqali) uchun ham tushunarli
    // xabarlar:
    'permission-denied': "Bu amalni bajarishga ruxsatingiz yo'q.",
    'unavailable': "Server vaqtincha javob bermayapti. Birozdan keyin qayta urinib ko'ring.",
    'resource-exhausted': "Tizim hozir band. Birozdan keyin qayta urinib ko'ring.",
    'cancelled': "Amal bekor qilindi.",
    'deadline-exceeded': "So'rov vaqti tugadi. Internet aloqasini tekshiring."
  };
  if(map[code]) return map[code];
  // Noma'lum xatolik — foydalanuvchiga texnik matn (masalan "FirebaseError:
  // Missing or insufficient permissions") ko'rsatmasdan, umumiy va
  // tushunarli xabar beramiz; texnik tafsilotni esa konsolga va
  // (agar mumkin bo'lsa) xatoliklar jurnaliga yozamiz.
  try{ console.error('Firebase xatoligi:', err); }catch(e){}
  try{ if(typeof logClientError === 'function') logClientError((err&&err.message)||'Nomalum xatolik', err); }catch(e){}
  return "Kutilmagan xatolik yuz berdi. Iltimos, qayta urinib ko'ring.";
}


const OWNER_EMAIL = 'idrizmedia@gmail.com';

// ===== O'zbekiston hududlari: viloyat -> tuman/shahar ro'yxati =====
const HUDUDLAR = {
  "Toshkent shahri": ["Bektemir tumani","Mirzo Ulug'bek tumani","Mirobod tumani","Olmazor tumani","Sirg'ali tumani","Uchtepa tumani","Chilonzor tumani","Shayxontohur tumani","Yunusobod tumani","Yakkasaroy tumani","Yashnobod tumani","Yangihayot tumani"],
  "Toshkent viloyati": ["Nurafshon shahri","Angren shahri","Bekobod shahri","Olmaliq shahri","Ohangaron shahri","Chirchiq shahri","Yangiyo'l shahri","Bekobod tumani","Bo'ka tumani","Bo'stonliq tumani","Zangiota tumani","Qibray tumani","Quyichirchiq tumani","Oqqo'rg'on tumani","Ohangaron tumani","Parkent tumani","Piskent tumani","Toshkent tumani","O'rtachirchiq tumani","Chinoz tumani","Yuqorichirchiq tumani","Yangiyo'l tumani"],
  "Andijon viloyati": ["Andijon shahri","Xonabod shahri","Andijon tumani","Asaka tumani","Baliqchi tumani","Bo'z tumani","Buloqboshi tumani","Jalaquduq tumani","Izboskan tumani","Qo'rg'ontepa tumani","Marhamat tumani","Oltinko'l tumani","Paxtaobod tumani","Ulug'nor tumani","Xo'jaobod tumani","Shahrixon tumani"],
  "Buxoro viloyati": ["Buxoro shahri","Kogon shahri","Buxoro tumani","Vobkent tumani","Jondor tumani","Kogon tumani","Olot tumani","Peshku tumani","Romitan tumani","Shofirkon tumani","Qorovulbozor tumani","Qorako'l tumani","G'ijduvon tumani"],
  "Jizzax viloyati": ["Jizzax shahri","Arnasoy tumani","Baxmal tumani","Do'stlik tumani","Zarbdor tumani","Zafarobod tumani","Zomin tumani","Mirzacho'l tumani","Paxtakor tumani","Forish tumani","Sharof Rashidov tumani","G'allaorol tumani","Yangiobod tumani"],
  "Qashqadaryo viloyati": ["Qarshi shahri","Shahrisabz shahri","Dehqonobod tumani","Kasbi tumani","Kitob tumani","Koson tumani","Mirishkor tumani","Muborak tumani","Nishon tumani","Chiroqchi tumani","Shahrisabz tumani","Yakkabog' tumani","Qamashi tumani","Qarshi tumani","G'uzor tumani"],
  "Navoiy viloyati": ["Navoiy shahri","Zarafshon shahri","Karmana tumani","Konimex tumani","Navbahor tumani","Nurota tumani","Tomdi tumani","Uchquduq tumani","Xatirchi tumani","Qiziltepa tumani"],
  "Namangan viloyati": ["Namangan shahri","Kosonsoy tumani","Mingbuloq tumani","Namangan tumani","Norin tumani","Pop tumani","To'raqo'rg'on tumani","Uychi tumani","Uchqo'rg'on tumani","Chortoq tumani","Chust tumani","Yangiqo'rg'on tumani"],
  "Samarqand viloyati": ["Samarqand shahri","Kattaqo'rg'on shahri","Bulung'ur tumani","Jomboy tumani","Ishtixon tumani","Kattaqo'rg'on tumani","Narpay tumani","Nurobod tumani","Oqdaryo tumani","Payariq tumani","Pastdarg'om tumani","Paxtachi tumani","Samarqand tumani","Toyloq tumani","Urgut tumani","Qo'shrabot tumani"],
  "Surxondaryo viloyati": ["Termiz shahri","Angor tumani","Boysun tumani","Denov tumani","Jarqo'rg'on tumani","Muzrobod tumani","Oltinsoy tumani","Sariosiyo tumani","Termiz tumani","Uzun tumani","Sherobod tumani","Sho'rchi tumani","Qiziriq tumani","Qumqo'rg'on tumani","Bandixon tumani"],
  "Sirdaryo viloyati": ["Guliston shahri","Yangiyer shahri","Shirin shahri","Boyovut tumani","Guliston tumani","Mirzaobod tumani","Oqoltin tumani","Sardoba tumani","Sayxunobod tumani","Sirdaryo tumani","Xovos tumani"],
  "Farg'ona viloyati": ["Farg'ona shahri","Marg'ilon shahri","Quvasoy shahri","Qo'qon shahri","Beshariq tumani","Bog'dod tumani","Buvayda tumani","Dang'ara tumani","Yozyovon tumani","Quva tumani","Qo'shtepa tumani","Oltiariq tumani","Rishton tumani","So'x tumani","Toshloq tumani","O'zbekiston tumani","Uchko'prik tumani","Farg'ona tumani","Furqat tumani"],
  "Xorazm viloyati": ["Urganch shahri","Xiva shahri","Bog'ot tumani","Gurlan tumani","Urganch tumani","Xiva tumani","Xonqa tumani","Hazorasp tumani","Shovot tumani","Yangiariq tumani","Yangibozor tumani","Qo'shko'pir tumani","Tuproqqal'a tumani"],
  "Qoraqalpog'iston Respublikasi": ["Nukus shahri","Amudaryo tumani","Beruniy tumani","Kegeyli tumani","Qonliko'l tumani","Qorao'zak tumani","Qo'ng'irot tumani","Mo'ynoq tumani","Nukus tumani","Taxiatosh tumani","Taxtako'pir tumani","To'rtko'l tumani","Xo'jayli tumani","Chimboy tumani","Sho'manoy tumani","Ellikqal'a tumani"]
};

// ===== PWA o'rnatish tugmasi (Chrome/Edge/Android) =====
let _deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  _deferredInstallPrompt = e;
  _showInstallFab();
});
window.addEventListener('appinstalled', ()=>{
  _deferredInstallPrompt = null;
  _hideInstallFab();
});

function _showInstallFab(){
  if(document.getElementById('installFab')) return;
  const btn = document.createElement('button');
  btn.id = 'installFab';
  btn.innerHTML = '⬇ O\u02bbrnatish';
  btn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:200;background:var(--btn-primary-bg,#16233B);color:var(--btn-primary-text,#fff);border:none;border-radius:20px;padding:9px 16px;font-family:"Manrope",sans-serif;font-weight:700;font-size:12.5px;box-shadow:0 6px 20px rgba(0,0,0,0.18);cursor:pointer;';
  btn.addEventListener('click', async ()=>{
    if(!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    await _deferredInstallPrompt.userChoice;
    _deferredInstallPrompt = null;
    _hideInstallFab();
  });
  document.body.appendChild(btn);
}
function _hideInstallFab(){
  const btn = document.getElementById('installFab');
  if(btn) btn.remove();
}

function institutionKey(acc){
  return sanitizeKey((acc.viloyat||'')+'|'+(acc.tuman||'')+'|'+(acc.muassasaNomi||''));
}

// ===== Til tanlash (asosiy navigatsiya va tugmalar uchun) =====
const I18N = {
  uz: {
    tagline: "Dars jadvali, rejalar, eslatmalar — va oila bilan bog'lanish, bir joyda.",
    tab_bosh: "Bosh sahifa", tab_jadval: "Jadval", tab_rejalar: "Rejalar", tab_eslatma: "Eslatmalar",
    tab_baholar: "Baholar", tab_profil: "Profil", tab_farzandlar: "Farzandlar", tab_elonlar: "E'lonlar",
    tab_umumiy: "Umumiy", tab_users: "Foydalanuvchilar", tab_muassasa: "Muassasalar",
    kirish: "Kirish", royxatdan_otish: "Ro'yxatdan o'tish", chiqish: "Chiqish",
    saqlash: "Saqlash", bekor_qilish: "Bekor qilish", yangilash: "Yangilash", tahrirlash: "Tahrirlash",
    parolni_unutdingiz: "Parolni unutdingizmi?", google_orqali: "Google orqali kirish",
    err_ism_email_parol: "Ism, email va kamida 6 belgili parolni to'ldiring.",
    err_ismni_kiriting: "Ismni kiriting.",
    err_viloyat_tuman: "Viloyat va tuman/shaharni tanlang.",
    err_barcha_maydon: "Barcha maydonlarni to'ldiring.",
    err_muassasa_sinf: "Muassasa raqami va sinf/kursni kiriting.",
    err_muassasa_nomi: "Muassasa raqami/nomini kiriting.",
    err_sinf_kursni: "Sinf/kursni kiriting.",
    err_profil_topilmadi: "Profil ma'lumotlari topilmadi. Iltimos, qo'llab-quvvatlash bilan bog'laning.",
    err_talaba_topilmadi: "Bu email bilan o'quvchi/talaba hisobi topilmadi.",
    err_farzand_email: "Farzandingizning emailini kiriting.",
    err_email_kiriting: "Emailingizni kiriting.",
    err_matn_sana_vaqt: "Matn, sana va vaqtni kiriting.",
    err_elon_matni: "E'lon matnini kiriting.",
    err_nom_sana: "Nom va sanani kiriting.",
    err_farzand_bog: "Bu farzand allaqachon bog'langan.",
    err_parol_mos_emas: "Parollar bir xil emas.",
    err_parol_kamida6: "Parol kamida 6 ta belgidan iborat bo'lsin.",
    err_sorov_yuborilgan: "So'rov allaqachon yuborilgan, javobni kuting.",
    err_fan_baho_sana: "Fan, baho va sanani kiriting.",
    err_fan_vaqt_kun: "Fan, vaqt va kamida bitta kunni tanlang.",
    err_fan_vazifa_muddat: "Fan, vazifa va muddatni kiriting.",
    ota_ona_hisobi: "Ota-ona hisobi",
    farzand_qoshish: "Farzand qo'shish",
    farzand_qoshish_izoh: "Farzandingiz avval o'zi ro'yxatdan o'tgan bo'lishi kerak. Uning emailini kiritib so'rov yuboring, u tasdiqlagach bog'lanasiz.",
    lbl_email: "Email", lbl_parol: "Parol", lbl_ism_familiya: "Ism va familiya",
    lbl_viloyat: "Viloyat", lbl_tuman: "Tuman / shahar", lbl_sinf: "Sinf / kurs",
    lbl_fan: "Fan nomi", lbl_boshlanish: "Boshlanish", lbl_tugash: "Tugash",
    lbl_xona: "Xona / auditoriya (ixtiyoriy)", lbl_hafta_kunlari: "Hafta kunlari",
    lbl_turi: "Turi", lbl_reja_nomi: "Reja nomi", lbl_sana: "Sana", lbl_izoh: "Izoh (ixtiyoriy)",
    lbl_nima_haqida: "Nima haqida eslatilsin", lbl_vaqt: "Vaqt", lbl_takrorlanish: "Takrorlanish",
    lbl_baho: "Baho", lbl_vazifa: "Vazifa", lbl_muddat: "Topshirish muddati",
    lbl_muassasa_raqami: "Muassasa raqami / nomi", lbl_matn: "Matn", lbl_rasm: "Rasm (ixtiyoriy, maks. 4MB)",
    lbl_farzand_email: "Farzandingizning emaili", lbl_yangi_parol: "Yangi parol", lbl_parol_takror: "Parolni takrorlang",
    lbl_kim_royxat: "Kim sifatida ro'yxatdan o'tasiz?", lbl_siz_kimsiz: "Siz kimsiz?",
    lbl_brauzer_bildirish: "Brauzer bildirishnomasi",
    lbl_muassasa_turi_talaba: "Ta'lim muassasasi turi", lbl_muassasa_turi: "Muassasa turi",
    korinish_royxat: "Ro'yxat", korinish_jadval: "Jadval",
    qidirish_uy_vazifa: "Fan yoki matn bo'yicha qidirish...", qidirish_elon: "E'lon matnidan qidirish...",
    pdf_hisobot: "PDF hisobot", hech_narsa_topilmadi: "Hech narsa topilmadi.",
    email_tasdiqlanmagan: "Email manzilingiz hali tasdiqlanmagan. Pochtangizga yuborilgan havolani bosing.",
    qayta_yuborish: "Qayta yuborish", yopish: "Yopish", otkazib_yuborish: "O'tkazib yuborish",
    keyingisi: "Keyingisi →", boshladik: "Boshladik! ✓",
    onboard_talaba: [
      { emoji: '👋', title: "Xush kelibsiz!", body: "Reja — dars jadvalingizni, rejalaringizni, uy vazifalaringizni va baholaringizni bir joyda saqlashga yordam beradi." },
      { emoji: '📅', title: "Dars jadvalini kiriting", body: "\"Jadval\" bo'limida pastdagi + tugmasi orqali darslaringizni qo'shing — ilova darsdan oldin eslatib turadi." },
      { emoji: '📚', title: "Uy vazifa va baholar", body: "\"Baholar\" bo'limida uy vazifalaringizni va baholaringizni kuzatib boring, muddatlar haqida eslatma olasiz." },
      { emoji: '👨‍👩‍👧', title: "Ota-onangiz bilan bog'laning", body: "Ota-onangiz sizning email manzilingiz orqali so'rov yuborishi mumkin — \"Profil\" bo'limida so'rovlarni ko'rasiz va tasdiqlaysiz." }
    ],
    onboard_ota_ona: [
      { emoji: '👋', title: "Xush kelibsiz!", body: "Reja orqali farzandingizning dars jadvali, uy vazifalari va baholarini kuzatib borishingiz, unga reja va eslatma qo'shishingiz mumkin." },
      { emoji: '🔗', title: "Farzandingizni bog'lang", body: "\"Farzandlar\" bo'limida farzandingizning email manzilini kiritib, bog'lanish so'rovini yuboring. Farzandingiz tasdiqlagach, ma'lumotlari ko'rinadi." },
      { emoji: '📊', title: "Kuzatib boring", body: "Bosh sahifada har bir farzandingiz uchun haftalik hisobotni va PDF hisobotni ko'rishingiz mumkin." }
    ],
    onboard_admin: [
      { emoji: '👋', title: "Xush kelibsiz!", body: "Muassasa admin sifatida siz o'quvchilaringizga e'lonlar joylashingiz mumkin bo'ladi." },
      { emoji: '⏳', title: "Tasdiqlashni kuting", body: "Hisobingiz hozircha tekshiruvda. Tizim egasi tasdiqlagach, e'lon joylash imkoniyati ochiladi." },
      { emoji: '📢', title: "E'lon joylang", body: "Tasdiqlangach, \"E'lonlar\" bo'limida yangi e'lon yozib, rasm biriktirib joylashingiz mumkin — muassasangizdagi barcha o'quvchilar ko'radi." }
    ]
  },
  ru: {
    tagline: "Расписание уроков, планы, напоминания — и связь с семьёй, в одном месте.",
    tab_bosh: "Главная", tab_jadval: "Расписание", tab_rejalar: "Планы", tab_eslatma: "Напоминания",
    tab_baholar: "Оценки", tab_profil: "Профиль", tab_farzandlar: "Дети", tab_elonlar: "Объявления",
    tab_umumiy: "Обзор", tab_users: "Пользователи", tab_muassasa: "Учреждения",
    kirish: "Войти", royxatdan_otish: "Регистрация", chiqish: "Выйти",
    saqlash: "Сохранить", bekor_qilish: "Отмена", yangilash: "Обновить", tahrirlash: "Изменить",
    parolni_unutdingiz: "Забыли пароль?", google_orqali: "Войти через Google",
    err_ism_email_parol: "Заполните имя, email и пароль (минимум 6 символов).",
    err_ismni_kiriting: "Введите имя.",
    err_viloyat_tuman: "Выберите область и район/город.",
    err_barcha_maydon: "Заполните все поля.",
    err_muassasa_sinf: "Укажите номер учреждения и класс/курс.",
    err_muassasa_nomi: "Укажите номер/название учреждения.",
    err_sinf_kursni: "Укажите класс/курс.",
    err_profil_topilmadi: "Данные профиля не найдены. Обратитесь в поддержку.",
    err_talaba_topilmadi: "Учётная запись ученика с таким email не найдена.",
    err_farzand_email: "Введите email вашего ребёнка.",
    err_email_kiriting: "Введите ваш email.",
    err_matn_sana_vaqt: "Заполните текст, дату и время.",
    err_elon_matni: "Введите текст объявления.",
    err_nom_sana: "Заполните название и дату.",
    err_farzand_bog: "Этот ребёнок уже привязан.",
    err_parol_mos_emas: "Пароли не совпадают.",
    err_parol_kamida6: "Пароль должен содержать минимум 6 символов.",
    err_sorov_yuborilgan: "Запрос уже отправлен, ожидайте ответа.",
    err_fan_baho_sana: "Заполните предмет, оценку и дату.",
    err_fan_vaqt_kun: "Заполните предмет, время и хотя бы один день.",
    err_fan_vazifa_muddat: "Заполните предмет, задание и срок.",
    ota_ona_hisobi: "Аккаунт родителя",
    farzand_qoshish: "Добавить ребёнка",
    farzand_qoshish_izoh: "Ваш ребёнок должен сначала сам зарегистрироваться. Введите его email, чтобы отправить запрос — после подтверждения вы будете связаны.",
    lbl_email: "Email", lbl_parol: "Пароль", lbl_ism_familiya: "Имя и фамилия",
    lbl_viloyat: "Область", lbl_tuman: "Район / город", lbl_sinf: "Класс / курс",
    lbl_fan: "Название предмета", lbl_boshlanish: "Начало", lbl_tugash: "Конец",
    lbl_xona: "Кабинет / аудитория (необязательно)", lbl_hafta_kunlari: "Дни недели",
    lbl_turi: "Тип", lbl_reja_nomi: "Название плана", lbl_sana: "Дата", lbl_izoh: "Комментарий (необязательно)",
    lbl_nima_haqida: "О чём напомнить", lbl_vaqt: "Время", lbl_takrorlanish: "Повторение",
    lbl_baho: "Оценка", lbl_vazifa: "Задание", lbl_muddat: "Срок сдачи",
    lbl_muassasa_raqami: "Номер / название учреждения", lbl_matn: "Текст", lbl_rasm: "Изображение (необязательно, макс. 4МБ)",
    lbl_farzand_email: "Email вашего ребёнка", lbl_yangi_parol: "Новый пароль", lbl_parol_takror: "Повторите пароль",
    lbl_kim_royxat: "Кем вы регистрируетесь?", lbl_siz_kimsiz: "Кто вы?",
    lbl_brauzer_bildirish: "Уведомления браузера",
    lbl_muassasa_turi_talaba: "Тип учебного заведения", lbl_muassasa_turi: "Тип учреждения",
    korinish_royxat: "Список", korinish_jadval: "Таблица",
    qidirish_uy_vazifa: "Поиск по предмету или тексту...", qidirish_elon: "Поиск по тексту объявления...",
    pdf_hisobot: "PDF отчёт", hech_narsa_topilmadi: "Ничего не найдено.",
    email_tasdiqlanmagan: "Ваш email ещё не подтверждён. Перейдите по ссылке, отправленной на почту.",
    qayta_yuborish: "Отправить снова", yopish: "Закрыть", otkazib_yuborish: "Пропустить",
    keyingisi: "Далее →", boshladik: "Начнём! ✓",
    onboard_talaba: [
      { emoji: '👋', title: "Добро пожаловать!", body: "Reja помогает хранить расписание уроков, планы, домашние задания и оценки в одном месте." },
      { emoji: '📅', title: "Внесите расписание", body: "В разделе «Расписание» нажмите + внизу, чтобы добавить уроки — приложение напомнит перед началом." },
      { emoji: '📚', title: "Домашние задания и оценки", body: "В разделе «Оценки» отслеживайте домашние задания и оценки, получайте напоминания о сроках." },
      { emoji: '👨‍👩‍👧', title: "Свяжитесь с родителями", body: "Родители могут отправить запрос по вашему email — вы увидите и подтвердите его в разделе «Профиль»." }
    ],
    onboard_ota_ona: [
      { emoji: '👋', title: "Добро пожаловать!", body: "С Reja вы можете следить за расписанием, домашними заданиями и оценками ребёнка, добавлять планы и напоминания." },
      { emoji: '🔗', title: "Привяжите ребёнка", body: "В разделе «Дети» введите email ребёнка и отправьте запрос на привязку. После подтверждения появятся его данные." },
      { emoji: '📊', title: "Следите за прогрессом", body: "На главной странице доступен недельный отчёт и PDF-отчёт по каждому ребёнку." }
    ],
    onboard_admin: [
      { emoji: '👋', title: "Добро пожаловать!", body: "Как администратор учреждения вы сможете публиковать объявления для учащихся." },
      { emoji: '⏳', title: "Ожидайте подтверждения", body: "Ваш аккаунт сейчас на проверке. После подтверждения владельцем системы откроется публикация объявлений." },
      { emoji: '📢', title: "Публикуйте объявления", body: "После подтверждения в разделе «Объявления» вы сможете писать посты с фото — их увидят все учащиеся вашего учреждения." }
    ]
  },
  en: {
    tagline: "Class schedule, plans, reminders — and staying connected with family, all in one place.",
    tab_bosh: "Home", tab_jadval: "Schedule", tab_rejalar: "Plans", tab_eslatma: "Reminders",
    tab_baholar: "Grades", tab_profil: "Profile", tab_farzandlar: "Children", tab_elonlar: "Announcements",
    tab_umumiy: "Overview", tab_users: "Users", tab_muassasa: "Institutions",
    kirish: "Log in", royxatdan_otish: "Sign up", chiqish: "Log out",
    saqlash: "Save", bekor_qilish: "Cancel", yangilash: "Refresh", tahrirlash: "Edit",
    parolni_unutdingiz: "Forgot password?", google_orqali: "Sign in with Google",
    err_ism_email_parol: "Fill in name, email, and a password of at least 6 characters.",
    err_ismni_kiriting: "Enter your name.",
    err_viloyat_tuman: "Select region and district/city.",
    err_barcha_maydon: "Fill in all fields.",
    err_muassasa_sinf: "Enter institution number and class/course.",
    err_muassasa_nomi: "Enter institution number/name.",
    err_sinf_kursni: "Enter class/course.",
    err_profil_topilmadi: "Profile data not found. Please contact support.",
    err_talaba_topilmadi: "No student account found with this email.",
    err_farzand_email: "Enter your child's email.",
    err_email_kiriting: "Enter your email.",
    err_matn_sana_vaqt: "Fill in text, date, and time.",
    err_elon_matni: "Enter the announcement text.",
    err_nom_sana: "Fill in name and date.",
    err_farzand_bog: "This child is already linked.",
    err_parol_mos_emas: "Passwords don't match.",
    err_parol_kamida6: "Password must be at least 6 characters.",
    err_sorov_yuborilgan: "Request already sent, awaiting response.",
    err_fan_baho_sana: "Fill in subject, grade, and date.",
    err_fan_vaqt_kun: "Fill in subject, time, and at least one day.",
    err_fan_vazifa_muddat: "Fill in subject, task, and due date.",
    ota_ona_hisobi: "Parent account",
    farzand_qoshish: "Add child",
    farzand_qoshish_izoh: "Your child must register first. Enter their email to send a request — once they confirm, you'll be linked.",
    lbl_email: "Email", lbl_parol: "Password", lbl_ism_familiya: "Full name",
    lbl_viloyat: "Region", lbl_tuman: "District / city", lbl_sinf: "Class / course",
    lbl_fan: "Subject name", lbl_boshlanish: "Start", lbl_tugash: "End",
    lbl_xona: "Room (optional)", lbl_hafta_kunlari: "Days of the week",
    lbl_turi: "Type", lbl_reja_nomi: "Plan name", lbl_sana: "Date", lbl_izoh: "Note (optional)",
    lbl_nima_haqida: "What's this reminder about", lbl_vaqt: "Time", lbl_takrorlanish: "Repeat",
    lbl_baho: "Grade", lbl_vazifa: "Task", lbl_muddat: "Due date",
    lbl_muassasa_raqami: "Institution number / name", lbl_matn: "Text", lbl_rasm: "Image (optional, max 4MB)",
    lbl_farzand_email: "Your child's email", lbl_yangi_parol: "New password", lbl_parol_takror: "Repeat password",
    lbl_kim_royxat: "Who are you registering as?", lbl_siz_kimsiz: "Who are you?",
    lbl_brauzer_bildirish: "Browser notifications",
    lbl_muassasa_turi_talaba: "Type of educational institution", lbl_muassasa_turi: "Institution type",
    korinish_royxat: "List", korinish_jadval: "Grid",
    qidirish_uy_vazifa: "Search by subject or text...", qidirish_elon: "Search announcement text...",
    pdf_hisobot: "PDF report", hech_narsa_topilmadi: "Nothing found.",
    email_tasdiqlanmagan: "Your email hasn't been verified yet. Click the link sent to your inbox.",
    qayta_yuborish: "Resend", yopish: "Dismiss", otkazib_yuborish: "Skip",
    keyingisi: "Next →", boshladik: "Let's go! ✓",
    onboard_talaba: [
      { emoji: '👋', title: "Welcome!", body: "Reja helps you keep your class schedule, plans, homework, and grades all in one place." },
      { emoji: '📅', title: "Add your schedule", body: "In the \"Schedule\" tab, tap + at the bottom to add classes — the app will remind you before each one." },
      { emoji: '📚', title: "Homework and grades", body: "In the \"Grades\" tab, track your homework and grades, and get reminders about deadlines." },
      { emoji: '👨‍👩‍👧', title: "Connect with your parent", body: "Your parent can send a request using your email — you'll see and approve it in the \"Profile\" tab." }
    ],
    onboard_ota_ona: [
      { emoji: '👋', title: "Welcome!", body: "With Reja you can follow your child's schedule, homework, and grades, and add plans and reminders for them." },
      { emoji: '🔗', title: "Link your child", body: "In the \"Children\" tab, enter your child's email and send a link request. Once they confirm, their info will appear." },
      { emoji: '📊', title: "Keep track", body: "On the home tab you'll find a weekly report and a PDF report for each child." }
    ],
    onboard_admin: [
      { emoji: '👋', title: "Welcome!", body: "As an institution admin, you'll be able to post announcements for your students." },
      { emoji: '⏳', title: "Wait for approval", body: "Your account is currently under review. Once the system owner approves it, posting will be unlocked." },
      { emoji: '📢', title: "Post announcements", body: "Once approved, write posts with photos in the \"Announcements\" tab — all students at your institution will see them." }
    ]
  }
};
function t(key){
  const lang = (typeof state !== 'undefined' && state.lang) ? state.lang : 'uz';
  return (I18N[lang] && I18N[lang][key]) || I18N.uz[key] || key;
}
function cycleLang(){
  const order = ['uz','ru','en'];
  const i = order.indexOf(state.lang || 'uz');
  state.lang = order[(i+1) % order.length];
  if(state.user && state.user.email){
    sSet('account:'+sanitizeKey(state.user.email), Object.assign({}, state.user, { lang: state.lang })).catch(()=>{});
  }
  render();
}

function t_muassasaNote(nomi){
  const map = {
    uz: `O'quvchilar ro'yxatdan o'tishda "${nomi}" nomini kiritishsa, sizning e'lonlaringizni ko'radi.`,
    ru: `Если ученики при регистрации укажут "${nomi}", они увидят ваши объявления.`,
    en: `If students enter "${nomi}" when registering, they'll see your announcements.`
  };
  const lang = (typeof state !== 'undefined' && state.lang) ? state.lang : 'uz';
  return map[lang] || map.uz;
}

// =====================================================================
// Xatoliklarni kuzatish — pullik uchinchi tomon xizmati (masalan Sentry)
// o'rniga, oddiy va bepul yechim: brauzerda yuz bergan JS xatoliklari
// avtomatik ravishda Firestore'ning "errorLogs" kolleksiyasiga yoziladi.
// Buni faqat tizim egasi (superadmin) admin panelning "Xatoliklar"
// bo'limida ko'radi.
// =====================================================================
let _lastLoggedError = '';
function logClientError(message, extra){
  try{
    const msg = String(message || 'Noma\'lum xatolik').slice(0, 500);
    // Ketma-ket bir xil xatolikni qayta-qayta yozmaslik uchun oddiy himoya
    // (masalan bitta buzilgan tsikl soniyasiga 100 marta bir xil xatolik
    // chiqarishi mumkin — bularning hammasini yozish bepul kvotani
    // keraksiz sarflaydi).
    if(msg === _lastLoggedError) return;
    _lastLoggedError = msg;
    _db.collection('errorLogs').add({
      message: msg,
      stack: (extra && extra.stack) ? String(extra.stack).slice(0, 2000) : '',
      url: (typeof window !== 'undefined' && window.location) ? window.location.href : '',
      userEmail: (typeof state !== 'undefined' && state.user && state.user.email) ||
                 (_auth.currentUser && _auth.currentUser.email) || null,
      userAgent: (typeof navigator !== 'undefined') ? navigator.userAgent : '',
      ts: Date.now()
    }).catch(()=>{});
  }catch(e){ /* xatolikni yozishning o'zi xatolik bersa, indamaymiz */ }
}

if(typeof window !== 'undefined'){
  window.addEventListener('error', (e)=>{
    logClientError(e.message, e.error);
  });
  window.addEventListener('unhandledrejection', (e)=>{
    const reason = e.reason;
    const msg = (reason && reason.message) ? reason.message : String(reason);
    logClientError('unhandledrejection: ' + msg, reason);
  });
}
