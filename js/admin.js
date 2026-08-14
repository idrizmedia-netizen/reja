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
  adminData: { allUsers: [], talabalar: [], otaOnalar: [], errorLogs: [], errorLogsLoaded: false, broadcasts: [], broadcastsLoaded: false, ads: [], adsLoaded: false, supportChats: [], openSupportEmail: null },
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
  const fetched = await Promise.all(keys.map(k=> sGet(k)));
  const users = fetched.filter(Boolean);
  const talabalar = users.filter(u=>u.role==='talaba');
  const otaOnalar = users.filter(u=>u.role==='ota_ona');
  const eskiHisoblar = users.filter(u=>u.role!=='talaba' && u.role!=='ota_ona');
  state.adminData = Object.assign({}, state.adminData, { allUsers: users, talabalar, otaOnalar, eskiHisoblar });
}

async function superDeleteUser(email){
  const ek = sanitizeKey(email);
  const acc = (state.adminData.allUsers||[]).find(u=>u.email===email);
  if(!acc) return;
  const keysToDelete = ['account:'+ek];
  if(acc.role==='talaba'){
    keysToDelete.push('schedule:'+ek, 'plans:'+ek, 'reminders:'+ek);
    await lrDeleteAllForStudent(ek);
    await studentDirRemove(ek);
  } else if(acc.role==='ota_ona'){
    await lrDeleteAllForParent(email);
    await pcDeleteAllForParent(ek);
  }
  for(const k of keysToDelete){
    try{ await window.storage.delete(k, true); }catch(err){}
  }
  await loadSuperAdminData();
  render();
  showToast("Hisob o'chirildi.");
}

function switchTab(t){
  state.tab = t;
  if(t==='sa_errors' && !state.adminData.errorLogsLoaded){
    loadErrorLogs().then(render);
  } else if(t==='sa_broadcast' && !state.adminData.broadcastsLoaded){
    loadBroadcasts().then(render);
  } else if(t==='sa_ads' && !state.adminData.adsLoaded){
    loadAds().then(render);
  } else if(t==='sa_support'){
    loadSupportChats().then(render);
  } else {
    render();
  }
}

async function loadSupportChats(){
  state.adminData.supportChats = await supportChatListAll();
}

async function sendSupportReply(userEmail){
  const input = document.getElementById('supportReplyInput');
  if(!input) return;
  const matn = input.value.trim();
  if(!matn) return;
  const thread = (state.adminData.supportChats.find(c=>c.userEmail===userEmail)||{}).messages || [];
  thread.push({ id: uid(), from: 'admin', matn, ts: Date.now() });
  const saved = await supportChatSend(userEmail, thread);
  if(!saved){ showToast("Xabar yuborilmadi."); return; }
  const conv = state.adminData.supportChats.find(c=>c.userEmail===userEmail);
  if(conv) conv.messages = thread;
  render();
  setTimeout(()=>{
    const cl = document.getElementById('supportThreadList');
    if(cl) cl.scrollTop = cl.scrollHeight;
  }, 30);
}

async function loadAds(){
  state.adminData.ads = await adsList();
  state.adminData.adsLoaded = true;
}

async function submitAdForm(e){
  e.preventDefault();
  const f = e.target;
  const title = f.title.value.trim();
  const linkUrl = f.linkUrl.value.trim();
  const videoUrl = f.videoUrl.value.trim();
  const startDate = f.startDate.value || null;
  const endDate = f.endDate.value || null;
  const errBox = document.getElementById('ad-err');
  const progressBox = document.getElementById('ad-progress');
  if(!title){ errBox.textContent = "Sarlavha/matnni kiriting."; return; }
  if(startDate && endDate && startDate > endDate){ errBox.textContent = "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas."; return; }
  let imageUrl = null;
  const file = f.rasm.files[0];
  if(file){
    try{
      if(progressBox) progressBox.textContent = "Rasm siqilmoqda...";
      imageUrl = await uploadImage(file);
    }catch(err){
      errBox.textContent = err.message || "Rasmni qayta ishlashda xatolik.";
      if(progressBox) progressBox.textContent = '';
      return;
    }
  }
  if(!imageUrl && !videoUrl){ errBox.textContent = "Kamida rasm yoki video havolasini kiriting."; if(progressBox) progressBox.textContent=''; return; }
  try{
    await adCreate({ title, linkUrl: linkUrl||null, videoUrl: videoUrl||null, imageUrl, startDate, endDate });
  }catch(err){
    console.error('adCreate FAILED —', (err&&err.code)||'', (err&&err.message)||err);
    errBox.textContent = "Saqlashda xatolik yuz berdi: " + ((err&&err.code)||(err&&err.message)||'nomaʼlum xato') + " (konsolni tekshiring)";
    if(progressBox) progressBox.textContent = '';
    return;
  }
  f.reset();
  if(progressBox) progressBox.textContent = '';
  await loadAds();
  render();
  showToast("Reklama joylandi.");
}

async function toggleAdActive(id, active){
  try{ await adUpdate(id, { active }); }catch(err){ showToast("Xatolik yuz berdi."); return; }
  const ad = (state.adminData.ads||[]).find(a=>a.id===id);
  if(ad) ad.active = active;
  render();
}

async function delAd(id){
  if(!confirm("Bu reklamani o'chirmoqchimisiz?")) return;
  try{ await adDelete(id); }catch(err){ showToast("O'chirishda xatolik yuz berdi."); return; }
  state.adminData.ads = (state.adminData.ads||[]).filter(a=>a.id!==id);
  render();
}

async function loadBroadcasts(){
  state.adminData.broadcasts = await broadcastList(50);
  state.adminData.broadcastsLoaded = true;
}

async function sendBroadcast(e){
  e.preventDefault();
  const f = e.target;
  const title = f.title.value.trim();
  const body = f.body.value.trim();
  const audience = f.audience.value;
  const errBox = document.getElementById('modal-err') || document.getElementById('broadcast-err');
  if(!title || !body){ if(errBox) errBox.textContent = "Sarlavha va matnni to'ldiring."; return; }
  try{
    await broadcastCreate({ title, body, audience, adminEmail: OWNER_EMAIL });
  }catch(err){
    if(errBox) errBox.textContent = "Yuborishda xatolik yuz berdi.";
    return;
  }
  f.reset();
  await loadBroadcasts();
  render();
  showToast("Bildirishnoma yuborildi.");
}

async function delBroadcast(id){
  if(!confirm("Bu bildirishnomani o'chirmoqchimisiz?")) return;
  try{ await broadcastDelete(id); }catch(err){ showToast("O'chirishda xatolik yuz berdi."); return; }
  state.adminData.broadcasts = (state.adminData.broadcasts||[]).filter(b=>b.id!==id);
  render();
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
  ${state.tab==='sa_users' ? renderSAUsers() : ''}
  ${state.tab==='sa_errors' ? renderSAErrors() : ''}
  ${state.tab==='sa_broadcast' ? renderSABroadcast() : ''}
  ${state.tab==='sa_ads' ? renderSAAds() : ''}
  ${state.tab==='sa_support' ? renderSASupport() : ''}
  <div class="tabs">
    <button class="tab ${state.tab==='sa_umumiy'?'active':''}" data-tab="sa_umumiy">${svgIcon('home')}<span>${t('tab_umumiy')}</span></button>
    <button class="tab ${state.tab==='sa_users'?'active':''}" data-tab="sa_users">${svgIcon('users')}<span>${t('tab_users')}</span></button>
    <button class="tab ${state.tab==='sa_broadcast'?'active':''}" data-tab="sa_broadcast">${svgIcon('bell')}<span>Bildirishnoma</span></button>
    <button class="tab ${state.tab==='sa_ads'?'active':''}" data-tab="sa_ads">${svgIcon('speaker')}<span>Reklama</span></button>
    <button class="tab ${state.tab==='sa_support'?'active':''}" data-tab="sa_support">${svgIcon('chat')}<span>Yordam</span></button>
    <button class="tab ${state.tab==='sa_errors'?'active':''}" data-tab="sa_errors">${svgIcon('speaker')}<span>Xatoliklar</span></button>
  </div>
  `;
}

function renderSASupport(){
  const chats = state.adminData.supportChats || [];
  const openEmail = state.adminData.openSupportEmail;
  if(openEmail){
    const conv = chats.find(c=>c.userEmail===sanitizeKey(openEmail)) || chats.find(c=>c.userEmail===openEmail);
    const thread = (conv && conv.messages) || [];
    return `
    <div class="sheet">
      <button class="btn-small" id="backToSupportListBtn" style="margin-bottom:10px;">← Ro'yxatga qaytish</button>
      <div class="eyebrow">${escapeHtml(openEmail)}</div>
      <div class="chat-list" id="supportThreadList">
        ${thread.length ? thread.map(m=>{
          const mine = m.from==='admin';
          return `<div class="chat-bubble ${mine?'chat-mine':'chat-theirs'}">${escapeHtml(m.matn)}<span class="chat-time">${new Date(m.ts).toLocaleString('uz-UZ')}</span></div>`;
        }).join('') : `<div class="empty">Hali xabar yo'q.</div>`}
      </div>
      <div class="chat-input-row">
        <input type="text" id="supportReplyInput" placeholder="Javob yozing..." autocomplete="off">
        <button class="btn-accent" id="sendSupportReplyBtn">Yuborish</button>
      </div>
    </div>`;
  }
  return `
  <div class="sheet">
    <div class="eyebrow">Yordam so'rovlari (${chats.length})</div>
    ${chats.length ? chats.map(c=>{
      const last = (c.messages||[])[c.messages.length-1];
      return `
      <div class="plan-item" data-open-support="${escapeHtml(c.userEmail)}" style="cursor:pointer;">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(c.userEmail)}</div>
            <div class="item-meta">${last?escapeHtml(last.matn.slice(0,60)):''}</div>
          </div>
          <span class="item-meta">${c.updatedAt?new Date(c.updatedAt).toLocaleDateString('uz-UZ'):''}</span>
        </div>
      </div>`;
    }).join('') : `<div class="empty">${svgIcon('chat')}<div>Hali hech kim yozmagan.</div></div>`}
  </div>`;
}

function renderSAAds(){
  const ads = state.adminData.ads || [];
  const today = todayISO();
  return `
  <div class="sheet sheet-plum">
    <div class="eyebrow">Yangi reklama joylash</div>
    <form id="adForm">
      <label>Sarlavha / qisqa matn</label>
      <input type="text" name="title" placeholder="Masalan: Yangi kurslar boshlandi!" required>
      <label>Rasm (ixtiyoriy, lekin tavsiya etiladi)</label>
      <input type="file" name="rasm" accept="image/*">
      <label>Video havolasi (ixtiyoriy — YouTube, Vimeo yoki to'g'ridan-to'g'ri .mp4 havola)</label>
      <input type="text" name="videoUrl" placeholder="https://youtube.com/watch?v=...">
      <label>Bosilganda o'tadigan havola (ixtiyoriy)</label>
      <input type="text" name="linkUrl" placeholder="https://sizning-saytingiz.uz">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <label>Boshlanish sanasi (ixtiyoriy)</label>
          <input type="date" name="startDate">
        </div>
        <div style="flex:1;">
          <label>Tugash sanasi (ixtiyoriy)</label>
          <input type="date" name="endDate">
        </div>
      </div>
      <div class="note" style="margin-top:-6px;">Sana kiritilmasa, reklama muddatsiz (siz o'chirmaguningizcha) ko'rinadi.</div>
      <div id="ad-progress" class="item-meta" style="margin-top:6px;"></div>
      <div id="ad-err" class="err"></div>
      <button class="btn-primary" type="submit" style="margin-top:10px;">Joylash</button>
    </form>
  </div>
  <div class="sheet">
    <div class="eyebrow">Joylangan reklamalar (${ads.length})</div>
    ${ads.length ? ads.map(a=>{
      const scheduleNote = (a.startDate || a.endDate)
        ? `${a.startDate||'...'} — ${a.endDate||'...'}${(a.endDate && a.endDate<today)?' (muddati tugagan)':((a.startDate && a.startDate>today)?' (hali boshlanmagan)':' (faol muddatda)')}`
        : "Muddatsiz";
      return `
      <div class="plan-item">
        ${a.imageUrl?`<img src="${a.imageUrl}" style="width:100%;border-radius:8px;margin-bottom:8px;max-height:160px;object-fit:cover;">`:''}
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(a.title||'')}</div>
            <div class="item-meta">${a.videoUrl?'🎬 Video · ':''}${a.linkUrl?'🔗 Havola bor · ':''}👁 ${a.views||0} ko'rish · 👆 ${a.clicks||0} bosish</div>
            <div class="item-meta">📅 ${scheduleNote}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:400;">
              <input type="checkbox" data-ad-active="${a.id}" ${a.active!==false?'checked':''}> Faol
            </label>
            <button class="del" data-del-ad="${a.id}">✕</button>
          </div>
        </div>
      </div>
    `;}).join('') : `<div class="empty">${svgIcon('speaker')}<div>Hali reklama joylanmagan.</div></div>`}
  </div>`;
}

function renderSABroadcast(){
  const list = state.adminData.broadcasts || [];
  const AUD_LABEL = { all: 'Hammaga', talaba: "Faqat o'quvchi/talabalarga", ota_ona: 'Faqat ota-onalarga' };
  return `
  <div class="sheet sheet-plum">
    <div class="eyebrow">Yangi bildirishnoma yuborish</div>
    <form id="broadcastForm">
      <label>Sarlavha</label>
      <input type="text" name="title" placeholder="Masalan: Ta'til haqida e'lon" required>
      <label>Matn</label>
      <textarea name="body" rows="4" placeholder="Xabar matni..." required></textarea>
      <label>Kimga yuborilsin</label>
      <select name="audience">
        <option value="all">Hammaga</option>
        <option value="talaba">Faqat o'quvchi/talabalarga</option>
        <option value="ota_ona">Faqat ota-onalarga</option>
      </select>
      <div id="broadcast-err" class="err"></div>
      <button class="btn-primary" type="submit" style="margin-top:10px;">Yuborish</button>
    </form>
  </div>
  <div class="sheet">
    <div class="eyebrow">Yuborilgan bildirishnomalar (${list.length})</div>
    ${list.length ? list.map(b=>`
      <div class="plan-item">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(b.title||'')}</div>
            <div class="item-meta">${escapeHtml(b.body||'')}</div>
            <div class="item-meta">${AUD_LABEL[b.audience]||'Hammaga'} · ${b.createdAt?new Date(b.createdAt).toLocaleString('uz-UZ'):''}</div>
          </div>
          <button class="del" data-del-broadcast="${b.id}">✕</button>
        </div>
      </div>
    `).join('') : `<div class="empty">${svgIcon('speaker')}<div>Hali bildirishnoma yuborilmagan.</div></div>`}
  </div>`;
}

function renderSAErrors(){
  const logs = state.adminData.errorLogs || [];
  return `
  <div class="sheet sheet-plum">
    <div class="eyebrow">Foydalanuvchilarda yuz bergan xatoliklar (so'nggi ${logs.length})</div>
    ${logs.length ? logs.map(l=>`
      <div class="req-item">
        <div class="item-title" style="color:var(--alert);">${escapeHtml(l.message||'')}</div>
        <div class="item-meta">${l.userEmail?escapeHtml(l.userEmail)+' · ':''}${l.ts?new Date(l.ts).toLocaleString('uz-UZ'):''}</div>
        <div class="item-meta" style="word-break:break-all;">${escapeHtml(l.url||'')}</div>
      </div>
    `).join('') : `<div class="empty">${svgIcon('speaker')}<div>Hozircha xatolik qayd etilmagan.</div></div>`}
    <button class="btn-small" id="refreshErrorsBtn" style="margin-top:10px;">↻ Yangilash</button>
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
    </div>
  </div>
  <div class="sheet">
    <div class="eyebrow">So'nggi ro'yxatdan o'tganlar</div>
    ${(d.allUsers||[]).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8).map(u=>`
      <div class="plan-item">
        <div class="item-top">
          <div><div class="item-title">${escapeHtml(u.ism)}</div><div class="item-meta">${escapeHtml(u.email)}</div></div>
          <span class="badge ${u.role==='talaba'?'':'parent'}">${u.role==='talaba'?"talaba":'ota-ona'}</span>
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
  ${(d.eskiHisoblar||[]).length ? `
  <div class="sheet">
    <div class="eyebrow">Eski/nomos hisoblar (${d.eskiHisoblar.length})</div>
    <p class="item-meta" style="margin-bottom:10px;">Bular ilova endi tushunmaydigan rolga ega hisoblar (masalan avvalgi "muassasa" roli). Xohlasangiz o'chirib tashlashingiz mumkin.</p>
    ${section(d.eskiHisoblar)}
  </div>` : ''}
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
  const reb = document.getElementById('refreshErrorsBtn');
  if(reb) reb.addEventListener('click', async ()=>{ await loadErrorLogs(); render(); });
  const bf = document.getElementById('broadcastForm');
  if(bf) bf.addEventListener('submit', sendBroadcast);
  document.querySelectorAll('[data-del-broadcast]').forEach(b=> b.addEventListener('click', ()=> delBroadcast(b.dataset.delBroadcast)));
  const adf = document.getElementById('adForm');
  if(adf) adf.addEventListener('submit', submitAdForm);
  document.querySelectorAll('[data-ad-active]').forEach(cb=> cb.addEventListener('change', ()=> toggleAdActive(cb.dataset.adActive, cb.checked)));
  document.querySelectorAll('[data-del-ad]').forEach(b=> b.addEventListener('click', ()=> delAd(b.dataset.delAd)));
  document.querySelectorAll('[data-open-support]').forEach(el=> el.addEventListener('click', ()=>{
    state.adminData.openSupportEmail = el.dataset.openSupport;
    render();
  }));
  const btsl = document.getElementById('backToSupportListBtn');
  if(btsl) btsl.addEventListener('click', ()=>{ state.adminData.openSupportEmail = null; render(); });
  const ssrb = document.getElementById('sendSupportReplyBtn');
  if(ssrb) ssrb.addEventListener('click', ()=> sendSupportReply(state.adminData.openSupportEmail));
  const sri = document.getElementById('supportReplyInput');
  if(sri) sri.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); sendSupportReply(state.adminData.openSupportEmail); } });
}

render();
