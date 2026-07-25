// ===== Reja: Admin panel (faqat tizim egasi uchun) =====
// Bu fayl index.html'dan butunlay ajratilgan. Oddiy foydalanuvchilar bu sahifani
// bilishi yoki ko'rishi shart emas — havolasini faqat o'zingiz bilasiz.

// OWNER_EMAIL common.js'da e'lon qilingan
// Zaxira kirish kodi (Google Sign-In sozlanmagan bo'lsa ishlatiladi):
const SUPERADMIN_CODE = 'REJA-EGASI-2026';

let state = {
  view: 'gate',       // 'gate' | 'app'
  theme: 'light',
  user: null,          // { ism, email }
  tab: 'sa_umumiy',
  adminData: { allUsers: [], talabalar: [], otaOnalar: [], adminlar: [], muassasalar: [] },
  toast: null
};

function showToast(msg){
  state.toast = msg;
  render();
  setTimeout(()=>{ state.toast=null; render(); }, 3600);
}

async function handleGoogleCredential(payload){
  const email = (payload.email||'').trim().toLowerCase();
  const errBox = document.getElementById('gate-err');
  if(email !== OWNER_EMAIL){
    if(errBox) errBox.textContent = "Bu Google hisobi tizim egasi sifatida tanilmagan.";
    return;
  }
  state.user = { ism: payload.name || 'Tizim egasi', email };
  state.view = 'app';
  state.tab = 'sa_umumiy';
  await loadSuperAdminData();
  render();
}

async function handlePasscodeSubmit(e){
  e.preventDefault();
  const code = e.target.code.value.trim();
  const errBox = document.getElementById('gate-err');
  if(code !== SUPERADMIN_CODE){ errBox.textContent = "Kod noto'g'ri. Katta-kichik harflar va chiziqchalarga (-) e'tibor bering."; return; }
  state.user = { ism: 'Tizim egasi', email: OWNER_EMAIL };
  state.view = 'app';
  state.tab = 'sa_umumiy';
  await loadSuperAdminData();
  render();
}

function logout(){
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
  const muassasalar = [];
  const seenKeys = new Set();
  talabalar.forEach(u=>{
    if(!u.muassasaNomi) return;
    const k = institutionKey(u);
    if(seenKeys.has(k)) return;
    seenKeys.add(k);
    muassasalar.push({ key: k, viloyat: u.viloyat||'', tuman: u.tuman||'', muassasaNomi: u.muassasaNomi });
  });
  state.adminData = { allUsers: users, talabalar, otaOnalar, adminlar, muassasalar };
}

async function superDeleteUser(email){
  const ek = sanitizeKey(email);
  const acc = (state.adminData.allUsers||[]).find(u=>u.email===email);
  if(!acc) return;
  const keysToDelete = ['account:'+ek];
  if(acc.role==='talaba'){
    keysToDelete.push('schedule:'+ek, 'plans:'+ek, 'reminders:'+ek, 'link_requests:'+ek, 'links_child:'+ek);
  } else if(acc.role==='ota_ona'){
    keysToDelete.push('links_parent:'+ek);
  } else if(acc.role==='admin'){
    keysToDelete.push('announcements:'+institutionKey(acc));
  }
  for(const k of keysToDelete){
    try{ await window.storage.delete(k, true); }catch(err){}
  }
  await loadSuperAdminData();
  render();
  showToast("Hisob o'chirildi.");
}

function switchTab(t){ state.tab = t; render(); }

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
    <p style="margin:10px 0 24px;">Bu sahifa faqat tizim egasi uchun. Kirish uchun Google hisobingizni tasdiqlang yoki maxfiy kodni kiriting.</p>
    <div class="sheet sheet-plum">
      <div class="eyebrow">Google orqali kirish</div>
      <div id="googleSigninContainer" style="display:flex;justify-content:center;margin:6px 0 4px;"></div>
      <div style="text-align:center;color:var(--ink-soft);font-size:11.5px;margin:10px 0;">— yoki —</div>
      <form id="passcodeForm">
        <label>Maxfiy kod</label>
        <input type="text" name="code" placeholder="Kodni kiriting" required autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="font-family:'JetBrains Mono',monospace;letter-spacing:0.5px;">
        <div id="gate-err" class="err"></div>
        <button class="btn-primary btn-plum" type="submit">Kirish</button>
      </form>
      <div class="note">Google orqali kirish faqat oldindan sozlangan bitta Google hisobi (tizim egasi) uchun ishlaydi. Kod HTML manbasida ko'rinadi — bu qulaylik uchun, real xavfsizlik emas.</div>
    </div>
  </div>`;
}

function attachGateHandlers(){
  const pf = document.getElementById('passcodeForm');
  if(pf) pf.addEventListener('submit', handlePasscodeSubmit);
  const ttb = document.getElementById('themeToggleBtn');
  if(ttb) ttb.addEventListener('click', toggleTheme);
  if(document.getElementById('googleSigninContainer')){
    renderGoogleButton('googleSigninContainer', handleGoogleCredential);
  }
}

function renderDashboard(){
  return `
  ${state.toast ? `<div class="toast"><span>${escapeHtml(state.toast)}</span></div>` : ''}
  <div class="topbar">
    <div class="brand">Reja <span style="font-size:12px;font-weight:600;color:var(--ink-soft);vertical-align:middle;">· admin</span></div>
    <div class="topbar-right">
      <button class="theme-toggle" id="themeToggleBtn" title="Kun/tun rejimi">${svgIcon(state.theme==='dark'?'sun':'moon')}</button>
      <button class="userchip" id="logoutBtn">${escapeHtml(state.user.ism.split(' ')[0])} · Chiqish</button>
    </div>
  </div>
  ${state.tab==='sa_umumiy' ? renderSAOverview() : ''}
  ${state.tab==='sa_users' ? renderSAUsers() : ''}
  ${state.tab==='sa_muassasa' ? renderSAInstitutions() : ''}
  <div class="tabs">
    <button class="tab ${state.tab==='sa_umumiy'?'active':''}" data-tab="sa_umumiy">${svgIcon('home')}<span>Umumiy</span></button>
    <button class="tab ${state.tab==='sa_users'?'active':''}" data-tab="sa_users">${svgIcon('users')}<span>Foydalanuvchilar</span></button>
    <button class="tab ${state.tab==='sa_muassasa'?'active':''}" data-tab="sa_muassasa">${svgIcon('speaker')}<span>Muassasalar</span></button>
  </div>
  `;
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
        <button class="btn-small btn-danger" data-sa-del="${escapeHtml(u.email)}">O'chirish</button>
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
}

render();
