// ===== Reja: Admin panel (faqat tizim egasi uchun) =====
// Bu fayl index.html'dan butunlay ajratilgan. Oddiy foydalanuvchilar bu sahifani
// bilishi yoki ko'rishi shart emas — havolasini faqat o'zingiz bilasiz.

// OWNER_EMAIL common.js'da e'lon qilingan.
//
// ESLATMA: bu yerda ilgari "SUPERADMIN_CODE" degan qattiq yozilgan maxfiy
// kod bo'lgan va u parolsiz kirish imkonini berardi. Bu ochiq (public)
// GitHub repo'sida yotgan oddiy JS fayl bo'lgani uchun, o'sha kodni HAR
// KIM ko'rishi mumkin edi — demak u umuman "maxfiy" emas edi.
// Haqiqiy xavfsizlik faqat serverda (Firestore Security Rules'da)
// tekshirilishi kerak, shuning uchun bu yerda yagona kirish usuli sifatida
// faqat Google Sign-In (OWNER_EMAIL bilan) qoldirildi.

let state = {
  view: 'gate',       // 'gate' | 'app'
  theme: 'light',
  lang: 'uz',
  user: null,          // { ism, email }
  tab: 'sa_umumiy',
  adminData: { allUsers: [], talabalar: [], otaOnalar: [], adminlar: [], muassasalar: [], pendingAdmins: [], errorLogs: [], errorLogsLoaded: false },
  toast: null
};

function showToast(msg){
  state.toast = msg;
  render();
  setTimeout(()=>{ state.toast=null; render(); }, 3600);
}

async function handleGoogleSignInClick(){
  const errBox = document.getElementById('gate-err');
  try{
    const result = await fbGoogleSignIn();
    const email = (result.user.email||'').trim().toLowerCase();
    if(email !== OWNER_EMAIL){
      if(errBox) errBox.textContent = "Bu Google hisobi tizim egasi sifatida tanilmagan.";
      await _auth.signOut();
      return;
    }
    state.user = { ism: result.user.displayName || 'Tizim egasi', email };
    state.view = 'app';
    state.tab = 'sa_umumiy';
    await loadSuperAdminData();
    render();
  }catch(err){
    if(errBox) errBox.textContent = fbErrorToUzbek(err);
  }
}

function logout(){
  _auth.signOut().catch(()=>{});
  state.user = null;
  state.view = 'gate';
  render();
}

async function loadSuperAdminData(){
  const listRes = await window.storage.list('account:', true).catch(()=>null);
  const keys = listRes ? listRes.keys : [];
  const users = [];
  for(const k of keys){
    const acc = await sGet(k);
    if(acc) users.push(acc);
  }
  const talabalar = users.filter(u=>u.role==='talaba');
  const otaOnalar = users.filter(u=>u.role==='ota_ona');
  const adminlar = users.filter(u=>u.role==='admin');
  const pendingAdmins = adminlar.filter(u=>!u.approved);
  const muassasalar = [];
  const seenKeys = new Set();
  // ESLATMA: avval bu yerda faqat "talabalar" ro'yxati aylantirilardi, shuning
  // uchun agar muassasada hali birorta ham talaba ro'yxatdan o'tmagan bo'lsa
  // (lekin muassasa admini allaqachon bor bo'lsa), o'sha muassasa "Muassasalar"
  // bo'limida umuman ko'rinmasdi. Endi adminlar ham hisobga olinadi.
  [...talabalar, ...adminlar].forEach(u=>{
    if(!u.muassasaNomi) return;
    const k = institutionKey(u);
    if(seenKeys.has(k)) return;
    seenKeys.add(k);
    muassasalar.push({ key: k, viloyat: u.viloyat||'', tuman: u.tuman||'', muassasaNomi: u.muassasaNomi });
  });
  state.adminData = { allUsers: users, talabalar, otaOnalar, adminlar, muassasalar, pendingAdmins };
}

async function superDeleteUser(email){
  const ek = sanitizeKey(email);
  const acc = (state.adminData.allUsers||[]).find(u=>u.email===email);
  if(!acc) return;
  const keysToDelete = ['account:'+ek];
  if(acc.role==='talaba'){
    keysToDelete.push('schedule:'+ek, 'plans:'+ek, 'reminders:'+ek, 'grades:'+ek, 'homework:'+ek);
    await lrDeleteAllForStudent(ek);
    await studentDirRemove(ek);
  } else if(acc.role==='ota_ona'){
    await lrDeleteAllForParent(email);
    await pcDeleteAllForParent(ek);
  } else if(acc.role==='admin'){
    if(acc.muassasaNomi) await annDeleteAll(institutionKey(acc));
  }
  for(const k of keysToDelete){
    try{ await window.storage.delete(k, true); }catch(err){}
  }
  await loadSuperAdminData();
  render();
  showToast("Hisob o'chirildi.");
}

async function approveInstitution(email){
  const key = 'account:'+sanitizeKey(email);
  const acc = await sGet(key);
  if(!acc) return;
  acc.approved = true;
  await sSet(key, acc);
  await loadSuperAdminData();
  render();
  showToast(escapeHtml(acc.muassasaNomi||acc.ism)+" tasdiqlandi.");
}

async function rejectInstitution(email){
  if(!confirm("Bu muassasa so'rovini rad etib, hisobni butunlay o'chirmoqchimisiz?")) return;
  await superDeleteUser(email);
}

function switchTab(t){
  state.tab = t;
  if(t==='sa_errors' && !state.adminData.errorLogsLoaded){
    loadErrorLogs().then(render);
  } else {
    render();
  }
}

// Foydalanuvchilar tomonida yuz bergan JS xatoliklari (window.addEventListener
// orqali common.js'da avtomatik yozib boriladi) — bu yerda faqat o'qib
// ko'rsatamiz, hech qanday pullik uchinchi tomon xizmati (Sentry va h.k.)
// kerak emas, hammasi Firestore ichida, bepul.
async function loadErrorLogs(){
  try{
    const snap = await _db.collection('errorLogs').orderBy('ts','desc').limit(50).get();
    state.adminData.errorLogs = snap.docs.map(d=>Object.assign({id:d.id}, d.data()));
  }catch(e){ state.adminData.errorLogs = []; }
  state.adminData.errorLogsLoaded = true;
}

function render(){
  applyTheme();
  const app = document.getElementById('app');
  if(state.view === 'gate'){ app.innerHTML = renderGate(); attachGateHandlers(); return; }
  app.innerHTML = renderDashboard();
  attachDashboardHandlers();
}

function renderGate(){
  return `
  <div style="padding:40px 22px 30px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div class="brand" style="font-size:24px;">Reja <span style="font-size:12px;font-weight:600;color:var(--ink-soft);vertical-align:middle;">· admin</span></div>
      <button class="theme-toggle" id="themeToggleBtn" title="Kun/tun rejimi">${svgIcon(state.theme==='dark'?'sun':'moon')}</button>
    </div>
    <p style="margin:10px 0 24px;">Bu sahifa faqat tizim egasi uchun. Kirish uchun Google hisobingizni tasdiqlang.</p>
    <div class="sheet sheet-plum">
      <div class="eyebrow">Google orqali kirish</div>
      <button type="button" id="googleSigninBtn" class="btn-primary" style="background:#fff;color:#3c4043;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;gap:10px;margin-top:6px;">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 16 3 9.1 7.6 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 36.3 27 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9 40.4 15.9 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.8l6.6 5.4C41.6 36 45 30.5 45 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
        Google orqali kirish
      </button>
      <div id="gate-err" class="err"></div>
      <div class="note">Bu tugma faqat oldindan sozlangan bitta Google hisobi (tizim egasi) uchun ishlaydi. Boshqa hisoblar bilan urinish rad etiladi.</div>
    </div>
  </div>`;
}

function attachGateHandlers(){
  const ttb = document.getElementById('themeToggleBtn');
  if(ttb) ttb.addEventListener('click', toggleTheme);
  const gsb = document.getElementById('googleSigninBtn');
  if(gsb) gsb.addEventListener('click', handleGoogleSignInClick);
}

function renderDashboard(){
  return `
  ${state.toast ? `<div class="toast"><span>${escapeHtml(state.toast)}</span></div>` : ''}
  <div class="topbar">
    <div class="brand">Reja <span style="font-size:12px;font-weight:600;color:var(--ink-soft);vertical-align:middle;">· admin</span></div>
    <div class="topbar-right">
      <button class="theme-toggle" id="themeToggleBtn" title="Kun/tun rejimi">${svgIcon(state.theme==='dark'?'sun':'moon')}</button>
      <button class="userchip" id="logoutBtn">${escapeHtml((state.user.ism||state.user.email||'').split(' ')[0])} · Chiqish</button>
    </div>
  </div>
  ${state.tab==='sa_umumiy' ? renderSAOverview() : ''}
  ${state.tab==='sa_requests' ? renderSARequests() : ''}
  ${state.tab==='sa_users' ? renderSAUsers() : ''}
  ${state.tab==='sa_muassasa' ? renderSAInstitutions() : ''}
  ${state.tab==='sa_errors' ? renderSAErrors() : ''}
  <div class="tabs">
    <button class="tab ${state.tab==='sa_umumiy'?'active':''}" data-tab="sa_umumiy">${svgIcon('home')}<span>${t('tab_umumiy')}</span></button>
    <button class="tab ${state.tab==='sa_requests'?'active':''}" data-tab="sa_requests">${(state.adminData.pendingAdmins||[]).length?'<span class="dot"></span>':''}${svgIcon('speaker')}<span>So'rovlar</span></button>
    <button class="tab ${state.tab==='sa_users'?'active':''}" data-tab="sa_users">${svgIcon('users')}<span>${t('tab_users')}</span></button>
    <button class="tab ${state.tab==='sa_muassasa'?'active':''}" data-tab="sa_muassasa">${svgIcon('speaker')}<span>${t('tab_muassasa')}</span></button>
    <button class="tab ${state.tab==='sa_errors'?'active':''}" data-tab="sa_errors">${svgIcon('speaker')}<span>Xatoliklar</span></button>
  </div>
  `;
}

function renderSAErrors(){
  const logs = state.adminData.errorLogs || [];
  return `
  <div class="sheet sheet-plum">
    <div class="eyebrow">Foydalanuvchilarda yuz bergan xatoliklar (so'nggi ${logs.length})</div>
    ${logs.length ? logs.map(l=>`
      <div class="req-item">
        <div class="item-title" style="color:#c0392b;">${escapeHtml(l.message||'')}</div>
        <div class="item-meta">${l.userEmail?escapeHtml(l.userEmail)+' · ':''}${l.ts?new Date(l.ts).toLocaleString('uz-UZ'):''}</div>
        <div class="item-meta" style="word-break:break-all;">${escapeHtml(l.url||'')}</div>
      </div>
    `).join('') : `<div class="empty">${svgIcon('speaker')}<div>Hozircha xatolik qayd etilmagan.</div></div>`}
    <button class="btn-small" id="refreshErrorsBtn" style="margin-top:10px;">↻ Yangilash</button>
  </div>`;
}

function renderSARequests(){
  const pending = state.adminData.pendingAdmins || [];
  return `
  <div class="sheet sheet-plum">
    <div class="eyebrow">Tasdiqlash kutayotgan muassasalar (${pending.length})</div>
    ${pending.length ? pending.map(u=>`
      <div class="req-item">
        <div class="item-title">${escapeHtml(u.ism)}</div>
        <div class="item-meta" style="margin-bottom:8px;">${escapeHtml(u.email)} · ${escapeHtml(MUASSASA_LABEL[u.muassasa]||u.muassasa)} · ${escapeHtml(u.muassasaNomi)}</div>
        <div class="item-meta" style="margin-bottom:10px;">${escapeHtml(u.viloyat||'')}${u.tuman?', '+escapeHtml(u.tuman):''}</div>
        <div style="display:flex;gap:8px;">
          <button class="btn-small btn-plum" data-approve-inst="${escapeHtml(u.email)}">✓ Tasdiqlash</button>
          <button class="btn-small btn-danger" data-reject-inst="${escapeHtml(u.email)}">✕ Rad etish</button>
        </div>
      </div>
    `).join('') : `<div class="empty">${svgIcon('speaker')}<div>Hozircha kutayotgan so'rov yo'q.</div></div>`}
  </div>`;
}

function renderSAOverview(){
  const d = state.adminData;
  const stat = (n,label)=> `<div style="flex:1;text-align:center;"><div style="font-family:'Fraunces',serif;font-size:26px;font-weight:600;">${n}</div><div class="item-meta">${label}</div></div>`;
  return `
  <div class="sheet sheet-plum">
    <div class="eyebrow">Platforma bo'yicha umumiy holat</div>
    <div style="display:flex;padding:6px 0 4px;">
      ${stat((d.talabalar||[]).length, "O'quvchi/talaba")}
      ${stat((d.otaOnalar||[]).length, "Ota-ona")}
      ${stat((d.adminlar||[]).length, "Muassasa admin")}
      ${stat((d.muassasalar||[]).length, "Muassasa")}
    </div>
  </div>
  <div class="sheet">
    <div class="eyebrow">So'nggi ro'yxatdan o'tganlar</div>
    ${(d.allUsers||[]).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8).map(u=>`
      <div class="plan-item">
        <div class="item-top">
          <div><div class="item-title">${escapeHtml(u.ism)}</div><div class="item-meta">${escapeHtml(u.email)}</div></div>
          <span class="badge ${u.role==='talaba'?'':(u.role==='ota_ona'?'parent':'rep')}">${u.role==='talaba'?"talaba":u.role==='ota_ona'?'ota-ona':'muassasa'}</span>
        </div>
      </div>
    `).join('') || `<div class="empty">Hali hech kim ro'yxatdan o'tmagan.</div>`}
  </div>
  <div class="sheet">
    <button class="btn-small" id="saRefreshBtn">↻ Yangilash</button>
  </div>
  `;
}

function renderSAUsers(){
  const d = state.adminData;
  const section = (list)=> list.length ? list.map(u=>`
    <div class="plan-item">
      <div class="item-top">
        <div><div class="item-title">${escapeHtml(u.ism)}</div><div class="item-meta">${escapeHtml(u.email)} ${u.muassasaNomi?'· '+escapeHtml(u.muassasaNomi):''} ${u.sinf?'· '+escapeHtml(u.sinf):''}</div></div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${u.role==='admin' ? `<span class="badge ${u.approved?'':'rep'}">${u.approved?'tasdiqlangan':'kutilmoqda'}</span>` : ''}
          <button class="btn-small btn-danger" data-sa-del="${escapeHtml(u.email)}">O'chirish</button>
        </div>
      </div>
    </div>
  `).join('') : `<div class="empty">Yo'q.</div>`;
  return `
  <div class="sheet">
    <div class="eyebrow">O'quvchi / talabalar (${(d.talabalar||[]).length})</div>
    ${section(d.talabalar||[])}
  </div>
  <div class="sheet sheet-plum">
    <div class="eyebrow">Ota-onalar (${(d.otaOnalar||[]).length})</div>
    ${section(d.otaOnalar||[])}
  </div>
  <div class="sheet">
    <div class="eyebrow">Muassasa adminlari (${(d.adminlar||[]).length})</div>
    ${section(d.adminlar||[])}
  </div>
  `;
}

function renderSAInstitutions(){
  const d = state.adminData;
  const muassasalar = d.muassasalar || [];
  return `
  <div class="sheet">
    <div class="eyebrow">Ro'yxatdagi muassasalar (${muassasalar.length})</div>
    ${muassasalar.length ? muassasalar.map(m=>{
      const count = (d.talabalar||[]).filter(u=>institutionKey(u)===m.key).length;
      const hasAdmin = (d.adminlar||[]).some(a=>institutionKey(a)===m.key);
      return `
      <div class="plan-item">
        <div class="item-top">
          <div><div class="item-title">${escapeHtml(m.muassasaNomi)}</div><div class="item-meta">${escapeHtml(m.viloyat)}, ${escapeHtml(m.tuman)} · ${count} ta o'quvchi</div></div>
          <span class="badge ${hasAdmin?'':'rep'}">${hasAdmin?'admin bor':"admin yo'q"}</span>
        </div>
      </div>`;
    }).join('') : `<div class="empty">Hali muassasa nomi kiritilmagan.</div>`}
  </div>
  `;
}

function attachDashboardHandlers(){
  document.querySelectorAll('.tab').forEach(t=> t.addEventListener('click', ()=> switchTab(t.dataset.tab)));
  const ttb = document.getElementById('themeToggleBtn');
  if(ttb) ttb.addEventListener('click', toggleTheme);
  const lb = document.getElementById('logoutBtn');
  if(lb) lb.addEventListener('click', logout);
  const saRefresh = document.getElementById('saRefreshBtn');
  if(saRefresh) saRefresh.addEventListener('click', async ()=>{ await loadSuperAdminData(); render(); });
  document.querySelectorAll('[data-sa-del]').forEach(b=> b.addEventListener('click', ()=>{
    const email = b.dataset.saDel;
    if(confirm("Rostdan ham "+email+" hisobini butunlay o'chirmoqchimisiz? Bu amalni orqaga qaytarib bo'lmaydi.")){
      superDeleteUser(email);
    }
  }));
  document.querySelectorAll('[data-approve-inst]').forEach(b=> b.addEventListener('click', ()=> approveInstitution(b.dataset.approveInst)));
  document.querySelectorAll('[data-reject-inst]').forEach(b=> b.addEventListener('click', ()=> rejectInstitution(b.dataset.rejectInst)));
  const reb = document.getElementById('refreshErrorsBtn');
  if(reb) reb.addEventListener('click', async ()=>{ await loadErrorLogs(); render(); });
}

render();
