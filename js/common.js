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
const _storage = firebase.storage ? firebase.storage() : null;

async function uploadImage(path, file){
  if(!_storage) throw new Error("Firebase Storage sozlanmagan.");
  const MAX_BYTES = 4 * 1024 * 1024;
  if(file.size > MAX_BYTES) throw new Error("Rasm hajmi 4MB dan oshmasin.");
  const ref = _storage.ref().child(path);
  await ref.put(file);
  return await ref.getDownloadURL();
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

// ===== Firebase Authentication yordamchilari =====
async function fbRegister(email, parol){
  return _auth.createUserWithEmailAndPassword(email, parol);
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
    'auth/network-request-failed': "Internet aloqasi bilan muammo.",
    'auth/provider-already-linked': "Bu hisobga parol allaqachon o'rnatilgan.",
    'auth/credential-already-in-use': "Bu parol boshqa hisobga bog'langan.",
    'auth/requires-recent-login': "Xavfsizlik uchun qayta kirib, so'ng qayta urining."
  };
  return map[code] || ("Xatolik: " + (err && err.message ? err.message : "noma'lum"));
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
    lbl_muassasa_turi_talaba: "Ta'lim muassasasi turi", lbl_muassasa_turi: "Muassasa turi"
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
    lbl_muassasa_turi_talaba: "Тип учебного заведения", lbl_muassasa_turi: "Тип учреждения"
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
    lbl_muassasa_turi_talaba: "Type of educational institution", lbl_muassasa_turi: "Institution type"
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
