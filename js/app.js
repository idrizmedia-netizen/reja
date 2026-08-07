// ===== Reja: asosiy ilova (o'quvchi / ota-ona) =====

let state = {
  view: 'loading',
  authMode: 'login',
  authRole: 'talaba',
  theme: 'light',
  lang: 'uz',
  user: null,
  tab: 'bosh',
  data: { schedule: [], plans: [], reminders: [] },
  parentData: { children: [], requests: [], unreadByEmail: {} },
  toast: null,
  modal: null,
  firedKeys: new Set()
};

let sessionMem = null;

let engineTimer = null;

function addCycle(dateStr, cycle){
  const d = new Date(dateStr+'T00:00:00');
  if(cycle==='kunlik') d.setDate(d.getDate()+1);
  else if(cycle==='haftalik') d.setDate(d.getDate()+7);
  else if(cycle==='oylik') d.setMonth(d.getMonth()+1);
  else if(cycle==='yillik') d.setFullYear(d.getFullYear()+1);
  else return dateStr;
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function subtractMinutes(hm, mins){
  const [h,m] = hm.split(':').map(Number);
  const d = new Date(2000,0,1,h,m-mins);
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

async function boot(){
  _auth.onAuthStateChanged(async (fbUser)=>{
    if(fbUser && fbUser.email){
      const email = fbUser.email.trim().toLowerCase();
      if(email === OWNER_EMAIL){ window.location.href = 'admin.html'; return; }
      const acc = await sGet('account:'+sanitizeKey(email));
      if(acc){ await loginAs(acc); return; }
    }
    if(state.view !== 'app'){
      state.view = 'auth';
      render();
    }
  });
}

async function loginAs(acc){
  if(!acc.ism) acc.ism = acc.email;
  state.user = acc;
  state.theme = acc.theme || 'light';
  state.lang = acc.lang || 'uz';
  sessionMem = acc.email;
  if(acc.role === 'talaba'){
    // ESLATMA: "studentDirectory" xususiyati qo'shilishidan OLDIN ro'yxatdan
    // o'tgan talabalarda bu belgi yo'q edi (faqat ro'yxatdan o'tish paytida
    // yaratilardi). Shuning uchun har safar kirishda bu yozuvni "bor"
    // ekanini qayta ta'minlaymiz — zararsiz va tez, ota-onalar endi bunday
    // eski hisoblarni ham topa oladi.
    studentDirAdd(sanitizeKey(acc.email)).catch(()=>{});
    const [sc, pl, rm] = await Promise.all([
      sGet('schedule:'+sanitizeKey(acc.email)),
      sGet('plans:'+sanitizeKey(acc.email)),
      sGet('reminders:'+sanitizeKey(acc.email))
    ]);
    state.data.schedule = sc || [];
    state.data.plans = pl || [];
    state.data.reminders = rm || [];
    const allReqs = await lrListForStudent(sanitizeKey(acc.email));
    state.parentData.requests = allReqs.filter(r=>r.status==='pending');
    state.parentData.linkedParents = allReqs.filter(r=>r.status==='accepted').map(r=>r.parentEmail);
    await computeUnread(state.parentData.linkedParents, 'child');
  } else if(acc.role === 'ota_ona'){
    await loadParentChildren();
    await computeUnread(state.parentData.children.map(c=>c.email), 'parent');
  }
  state.view = 'app';
  state.tab = defaultTab();
  if(acc.onboarded !== true){ state.showOnboarding = true; state.onboardStep = 0; }
  render();
  startEngine();
}

function defaultTab(){
  if(state.user.role==='ota_ona') return 'p_bosh';
  return 'bosh';
}

async function computeUnread(partnerEmails, myRole){
  const lastRead = state.user.lastRead || {};
  const counts = {};
  await Promise.all(partnerEmails.map(async (partnerEmail)=>{
    const tKey = threadKey(state.user.email, partnerEmail);
    const thread = await sGet(tKey) || [];
    const since = lastRead[tKey] || 0;
    counts[partnerEmail] = thread.filter(m=> m.from !== myRole && m.ts > since).length;
  }));
  state.parentData.unreadByEmail = counts;
}

async function markThreadRead(partnerEmail){
  const tKey = threadKey(state.user.email, partnerEmail);
  if(!state.user.lastRead) state.user.lastRead = {};
  state.user.lastRead[tKey] = Date.now();
  state.parentData.unreadByEmail[partnerEmail] = 0;
  await sSet('account:'+sanitizeKey(state.user.email), state.user);
}

async function loadParentChildren(){
  const parentKey = sanitizeKey(state.user.email);
  const childEmails = await pcListForParent(parentKey);
  const results = await Promise.all(childEmails.map(async (em)=>{
    const acc = await sGet('account:'+sanitizeKey(em));
    if(!acc) return null;
    const [sc, pl, rm] = await Promise.all([
      sGet('schedule:'+sanitizeKey(em)),
      sGet('plans:'+sanitizeKey(em)),
      sGet('reminders:'+sanitizeKey(em))
    ]);
    return { email: em, acc, schedule: sc||[], plans: pl||[], reminders: rm||[] };
  }));
  state.parentData.children = results.filter(Boolean);
}

async function saveAll(){
  const e = sanitizeKey(state.user.email);
  const results = await Promise.all([
    sSet('schedule:'+e, state.data.schedule),
    sSet('plans:'+e, state.data.plans),
    sSet('reminders:'+e, state.data.reminders)
  ]);
  // sSet xatolikda "null" qaytaradi (chetga chiqarmaydi) — shuning uchun
  // avval bu yerda muvaffaqiyatsizlik butunlay sezilmasdan qolardi va
  // foydalanuvchi "saqlandi" deb o'ylab, aslida ma'lumot saqlanmagan
  // bo'lishi mumkin edi. Endi kamida ogohlantiramiz.
  if(results.some(r=> r === null)){
    showToast("Saqlashda xatolik yuz berdi. Internetni tekshirib, qayta urinib ko'ring.");
  }
}

function showToast(msg){
  state.toast = msg;
  render();
  setTimeout(()=>{ state.toast=null; render(); }, 3800);
}

function startEngine(){
  if(engineTimer) clearInterval(engineTimer);
  if(state.user.role !== 'talaba') return;
  checkEngine();
  engineTimer = setInterval(checkEngine, 30000);
}

function checkEngine(){
  if(!state.user || state.user.role!=='talaba') return;
  const today = todayISO();
  const hm = nowHM();
  const mode = state.user.reminderMode || 'bir_marta';

  state.data.reminders.forEach(r=>{
    if(r.sana === today && r.vaqt <= hm){
      const key = 'rem_'+r.id+'_'+r.sana;
      if(!state.firedKeys.has(key)){
        state.firedKeys.add(key);
        fireNotif('Eslatma', r.matn);
        if(r.takrorlanish && r.takrorlanish !== 'bir_marta'){
          r.sana = addCycle(r.sana, r.takrorlanish);
          saveAll();
        }
      }
    }
  });

  if(mode === 'har_dars'){
    const di = dowIndex(today);
    state.data.schedule.filter(l=> l.kunlar.includes(di)).forEach(l=>{
      const key = 'les_'+l.id+'_'+today;
      const target = subtractMinutes(l.boshlanish, 5);
      if(hm >= target && hm <= l.boshlanish && !state.firedKeys.has(key)){
        state.firedKeys.add(key);
        fireNotif('Dars boshlanmoqda', l.fan + ' — ' + l.boshlanish + (l.xona? ' · '+l.xona : ''));
      }
    });
  } else {
    const key = 'daily_'+today;
    if(hm >= '07:00' && !state.firedKeys.has(key)){
      const di = dowIndex(today);
      const list = state.data.schedule.filter(l=>l.kunlar.includes(di));
      if(list.length){
        state.firedKeys.add(key);
        fireNotif('Bugungi darslar', list.map(l=>l.boshlanish+' '+l.fan).join(', '));
      }
    }
  }
}

function fireNotif(title, body){
  showToast(title+': '+body);
  try{
    if(window.Notification && Notification.permission === 'granted'){
      new Notification(title, { body });
    }
  }catch(e){}
}

function setAuthRole(role){ state.authRole = role; render(); }

async function handleRegister(e){
  e.preventDefault();
  const f = e.target;
  const ism = f.ism.value.trim();
  const email = f.email.value.trim().toLowerCase();
  const parol = f.parol.value;
  const role = state.authRole;
  const errBox = document.getElementById('auth-err');
  if(!ism || !email || parol.length < 6){ errBox.textContent = t('err_ism_email_parol'); return; }

  let acc = { ism, email, role, authProvider: 'password', reminderMode: 'bir_marta', createdAt: Date.now() };
  if(role === 'talaba'){
    const viloyat = f.viloyat.value;
    const tuman = f.tuman.value;
    if(!viloyat || !tuman){ errBox.textContent = t('err_viloyat_tuman'); return; }
    acc.viloyat = viloyat;
    acc.tuman = tuman;
    acc.muassasa = f.muassasa.value;
    acc.muassasaNomi = f.muassasaNomi.value.trim();
    acc.sinf = f.sinf.value.trim();
    if(!acc.muassasaNomi || !acc.sinf){ errBox.textContent = t('err_muassasa_sinf'); return; }
  }
  try{
    await fbRegister(email, parol);
    await fbSendVerification();
  }catch(err){
    errBox.textContent = fbErrorToUzbek(err);
    return;
  }
  await sSet('account:'+sanitizeKey(email), acc);
  if(role === 'talaba') await studentDirAdd(sanitizeKey(email));
  await loginAs(acc);
}

async function handleEditProfileSubmit(e){
  e.preventDefault();
  const f = e.target;
  const errBox = document.getElementById('modal-err');
  const u = state.user;
  const ism = f.ism.value.trim();
  if(!ism){ errBox.textContent = t('err_ismni_kiriting'); return; }
  u.ism = ism;
  if(u.role==='talaba'){
    const viloyat = f.viloyat.value;
    const tuman = f.tuman.value;
    const muassasa = f.muassasa.value;
    const muassasaNomi = f.muassasaNomi.value.trim();
    if(!viloyat || !tuman || !muassasaNomi){ errBox.textContent = t('err_barcha_maydon'); return; }
    u.viloyat = viloyat;
    u.tuman = tuman;
    u.muassasa = muassasa;
    u.muassasaNomi = muassasaNomi;
    {
      const sinf = f.sinf.value.trim();
      if(!sinf){ errBox.textContent = t('err_sinf_kursni'); return; }
      u.sinf = sinf;
    }
  }
  await sSet('account:'+sanitizeKey(u.email), u);
  closeModal();
  showToast("Profil yangilandi.");
  render();
}

async function handleSetPasswordSubmit(e){
  e.preventDefault();
  const f = e.target;
  const errBox = document.getElementById('modal-err');
  const parol = f.parol.value;
  const parol2 = f.parol2.value;
  if(parol.length < 6){ errBox.textContent = t('err_parol_kamida6'); return; }
  if(parol !== parol2){ errBox.textContent = t('err_parol_mos_emas'); return; }
  try{
    await fbLinkPassword(state.user.email, parol);
  }catch(err){
    errBox.textContent = fbErrorToUzbek(err);
    return;
  }
  state.user.authProvider = 'google+password';
  await sSet('account:'+sanitizeKey(state.user.email), state.user);
  closeModal();
  showToast("Parol o'rnatildi. Endi email va parol bilan ham kira olasiz.");
}

async function handleLogin(e){
  e.preventDefault();
  const f = e.target;
  const email = f.email.value.trim().toLowerCase();
  const parol = f.parol.value;
  const errBox = document.getElementById('auth-err');
  if(email === OWNER_EMAIL){ window.location.href = 'admin.html'; return; }
  try{
    await fbLogin(email, parol);
  }catch(err){
    errBox.textContent = fbErrorToUzbek(err);
    return;
  }
  const acc = await sGet('account:'+sanitizeKey(email));
  if(!acc){ errBox.textContent = t('err_profil_topilmadi'); return; }
  await loginAs(acc);
}

async function handleForgotPassword(e){
  e.preventDefault();
  const f = e.target;
  const email = f.femail.value.trim().toLowerCase();
  const errBox = document.getElementById('auth-err');
  if(!email){ errBox.textContent = t('err_email_kiriting'); return; }
  try{
    await fbSendPasswordReset(email);
    state.authMode = 'login';
    render();
    showToast("Parolni tiklash havolasi " + email + " manziliga yuborildi.");
  }catch(err){
    errBox.textContent = fbErrorToUzbek(err);
  }
}

async function handleGoogleSignInClick(){
  const errBox = document.getElementById('auth-err');
  try{
    const result = await fbGoogleSignIn();
    const email = (result.user.email||'').trim().toLowerCase();
    if(email === OWNER_EMAIL){ window.location.href = 'admin.html'; return; }
    const acc = await sGet('account:'+sanitizeKey(email));
    if(acc){ await loginAs(acc); return; }
    state.pendingGoogle = { ism: result.user.displayName || email.split('@')[0], email };
    state.authMode = 'google_complete';
    state.authRole = 'talaba';
    render();
  }catch(err){
    if(errBox) errBox.textContent = fbErrorToUzbek(err);
  }
}

async function handleGoogleCompleteSubmit(e){
  e.preventDefault();
  const f = e.target;
  const role = state.authRole;
  const pg = state.pendingGoogle;
  const errBox = document.getElementById('auth-err');
  const key = 'account:'+sanitizeKey(pg.email);
  let acc = { ism: pg.ism, email: pg.email, authProvider: 'google', role, reminderMode: 'bir_marta', createdAt: Date.now() };
  if(role === 'talaba'){
    const viloyat = f.g_viloyat.value;
    const tuman = f.g_tuman.value;
    if(!viloyat || !tuman){ errBox.textContent = t('err_viloyat_tuman'); return; }
    acc.viloyat = viloyat;
    acc.tuman = tuman;
    acc.muassasa = f.muassasa.value;
    acc.muassasaNomi = f.muassasaNomi.value.trim();
    acc.sinf = f.sinf.value.trim();
    if(!acc.muassasaNomi || !acc.sinf){ errBox.textContent = t('err_muassasa_sinf'); return; }
  }
  await sSet(key, acc);
  if(role === 'talaba') await studentDirAdd(sanitizeKey(pg.email));
  state.pendingGoogle = null;
  await loginAs(acc);
}

function logout(){
  _auth.signOut().catch(()=>{});
  sessionMem = null;
  if(engineTimer) clearInterval(engineTimer);
  state.user = null;
  state.view = 'auth';
  state.authMode = 'login';
  state.parentData = { children: [], requests: [], unreadByEmail: {} };
  render();
}

function switchTab(t){ state.tab = t; state.modal = null; render(); }

function openModal(kind, extra){ state.modal = Object.assign({ kind }, extra||{}); render(); }

function closeModal(){ state.modal = null; render(); }

function toggleDowChip(el){ el.classList.toggle('on'); }

async function addLesson(e){
  e.preventDefault();
  const f = e.target;
  const fan = f.fan.value.trim();
  const boshlanish = f.boshlanish.value;
  const tugash = f.tugash.value;
  const xona = f.xona.value.trim();
  const kunlar = Array.from(f.querySelectorAll('.dow-chip.on')).map(c=>Number(c.dataset.i));
  if(!fan || !boshlanish || !kunlar.length){ document.getElementById('modal-err').textContent = t('err_fan_vaqt_kun'); return; }
  const editId = state.modal.editId;
  if(editId){
    const l = state.data.schedule.find(x=>x.id===editId);
    if(l){ Object.assign(l, { fan, boshlanish, tugash, xona, kunlar }); }
  } else {
    state.data.schedule.push({ id: uid(), fan, boshlanish, tugash, xona, kunlar });
  }
  state.data.schedule.sort((a,b)=> a.boshlanish.localeCompare(b.boshlanish));
  await saveAll();
  closeModal();
  showToast(editId ? "Dars yangilandi." : "Dars jadvalga qo'shildi.");
}

async function delLesson(id){
  state.data.schedule = state.data.schedule.filter(l=>l.id!==id);
  await saveAll(); render();
}

async function addPlan(e){
  e.preventDefault();
  const f = e.target;
  const turi = f.turi.value;
  const nom = f.nom.value.trim();
  const sana = f.sana.value;
  const izoh = f.izoh.value.trim();
  if(!nom || !sana){ document.getElementById('modal-err').textContent = t('err_nom_sana'); return; }
  const editId = state.modal.editId;
  if(editId){
    const p = state.data.plans.find(x=>x.id===editId);
    if(p){ Object.assign(p, { turi, nom, sana, izoh }); }
  } else {
    state.data.plans.push({ id: uid(), turi, nom, sana, izoh });
  }
  state.data.plans.sort((a,b)=> a.sana.localeCompare(b.sana));
  await saveAll();
  closeModal();
  showToast(editId ? "Reja yangilandi." : "Reja qo'shildi.");
}

async function delPlan(id){
  state.data.plans = state.data.plans.filter(p=>p.id!==id);
  await saveAll(); render();
}

async function addReminder(e){
  e.preventDefault();
  const f = e.target;
  const matn = f.matn.value.trim();
  const sana = f.sana.value;
  const vaqt = f.vaqt.value;
  const takrorlanish = f.takrorlanish.value;
  if(!matn || !sana || !vaqt){ document.getElementById('modal-err').textContent = t('err_matn_sana_vaqt'); return; }
  const editId = state.modal.editId;
  if(editId){
    const r = state.data.reminders.find(x=>x.id===editId);
    if(r){ Object.assign(r, { matn, sana, vaqt, takrorlanish }); }
  } else {
    state.data.reminders.push({ id: uid(), matn, sana, vaqt, takrorlanish });
  }
  state.data.reminders.sort((a,b)=> (a.sana+a.vaqt).localeCompare(b.sana+b.vaqt));
  await saveAll();
  closeModal();
  showToast(editId ? "Eslatma yangilandi." : "Eslatma qo'yildi.");
}

async function delReminder(id){
  state.data.reminders = state.data.reminders.filter(r=>r.id!==id);
  await saveAll(); render();
}

function downloadCSV(filename, rows){
  const csv = rows.map(r=> r.map(cell=>{
    const s = String(cell==null?'':cell).replace(/"/g,'""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportCSV(kind){
  if(kind==='jadval'){
    const rows = [['Fan','Boshlanish','Tugash','Xona','Kunlar']];
    state.data.schedule.forEach(l=> rows.push([l.fan, l.boshlanish, l.tugash||'', l.xona||'', l.kunlar.map(i=>KUN_FULL[i]).join(' ')]));
    downloadCSV('dars-jadvali.csv', rows);
  } else if(kind==='rejalar'){
    const rows = [['Turi','Nomi','Sana','Izoh']];
    state.data.plans.forEach(p=> rows.push([p.turi, p.nom, p.sana, p.izoh||'']));
    downloadCSV('rejalar.csv', rows);
  } else if(kind==='eslatma'){
    const rows = [['Matn','Sana','Vaqt','Takrorlanish']];
    state.data.reminders.forEach(r=> rows.push([r.matn, r.sana, r.vaqt, r.takrorlanish]));
    downloadCSV('eslatmalar.csv', rows);
  }
  showToast("Fayl yuklab olindi.");
}

// Ota-ona uchun farzand bo'yicha PDF hisobot — jsPDF orqali to'liq
// brauzerning o'zida generatsiya qilinadi, hech qanday server kerak emas.
function exportChildPDF(childEmail){
  const child = (state.parentData.children||[]).find(c=>c.email===childEmail);
  if(!child || typeof window.jspdf === 'undefined'){ showToast("Hisobot yaratib bo'lmadi."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const r = computeWeeklyReport(child);
  let y = 18;
  doc.setFontSize(16);
  doc.text('Reja — o\'quvchi hisoboti', 14, y); y += 8;
  doc.setFontSize(11);
  doc.text(`O'quvchi: ${child.acc.ism} (${child.email})`, 14, y); y += 6;
  if(child.acc.muassasaNomi || child.acc.sinf){
    doc.text(`O'quv joyi: ${child.acc.muassasaNomi||''}${child.acc.sinf?' · '+child.acc.sinf:''}`, 14, y); y += 6;
  }
  doc.text(`Sana: ${fmtDate(todayISO())}`, 14, y); y += 10;

  doc.setFontSize(13);
  doc.text("So'nggi 7 kunlik xulosa", 14, y); y += 7;
  doc.setFontSize(10.5);
  doc.text(`Yaqin rejalar: ${r.upcomingPlans}`, 14, y); y += 6;
  doc.text(`Yaqin eslatmalar: ${r.upcomingReminders}`, 14, y); y += 10;

  doc.setFontSize(13);
  doc.text('Rejalar', 14, y); y += 7;
  doc.setFontSize(10);
  if((child.plans||[]).length){
    child.plans.slice().sort((a,b)=>a.sana.localeCompare(b.sana)).forEach(p=>{
      if(y > 275){ doc.addPage(); y = 18; }
      doc.text(`${fmtDate(p.sana)} — ${p.nom}${p.izoh?' ('+p.izoh+')':''}`, 14, y); y += 6;
    });
  } else { doc.text('Hali reja kiritilmagan.', 14, y); y += 6; }
  y += 6;

  if(y > 260){ doc.addPage(); y = 18; }
  doc.setFontSize(13);
  doc.text('Eslatmalar', 14, y); y += 7;
  doc.setFontSize(10);
  if((child.reminders||[]).length){
    child.reminders.slice().sort((a,b)=>(a.sana+a.vaqt).localeCompare(b.sana+b.vaqt)).forEach(rm=>{
      if(y > 275){ doc.addPage(); y = 18; }
      doc.text(`${fmtDate(rm.sana)} ${rm.vaqt||''} — ${rm.matn}`, 14, y); y += 6;
    });
  } else { doc.text('Hali eslatma kiritilmagan.', 14, y); y += 6; }

  doc.save(`${(child.acc.ism||'oquvchi').replace(/\s+/g,'_')}-hisobot.pdf`);
  showToast('PDF hisobot yuklab olindi.');
}

async function setReminderMode(mode){
  state.user.reminderMode = mode;
  await sSet('account:'+sanitizeKey(state.user.email), state.user);
  render();
  showToast(mode==='har_dars' ? "Har darsdan 5 daqiqa oldin eslatiladi." : "Kuniga bir marta, ertalab eslatiladi.");
}

function requestNotifPerm(){
  if(window.Notification && Notification.permission !== 'granted'){
    Notification.requestPermission().then(()=>render());
  }
}

async function sendLinkRequest(e){
  e.preventDefault();
  const f = e.target;
  const childEmail = f.childEmail.value.trim().toLowerCase();
  const errBox = document.getElementById('modal-err');
  if(!childEmail){ errBox.textContent = t('err_farzand_email'); return; }
  const studentKey = sanitizeKey(childEmail);
  const exists = await studentDirExists(studentKey);
  if(!exists){ errBox.textContent = t('err_talaba_topilmadi'); return; }
  const parentKey = sanitizeKey(state.user.email);
  const existing = await lrGet(studentKey, parentKey);
  if(existing && existing.status === 'accepted'){ errBox.textContent = t('err_farzand_bog'); return; }
  if(existing && existing.status === 'pending'){ errBox.textContent = t('err_sorov_yuborilgan'); return; }
  try{
    await lrSendOrRetry(studentKey, parentKey, state.user.email, state.user.ism);
  }catch(err){
    errBox.textContent = fbErrorToUzbek(err);
    return;
  }
  closeModal();
  showToast("So'rov yuborildi. Farzandingiz tasdiqlashini kuting.");
}

async function respondLinkRequest(parentKey, accept){
  const selfKey = sanitizeKey(state.user.email);
  try{
    await lrRespond(selfKey, parentKey, accept);
    if(accept) await pcAdd(parentKey, selfKey, state.user.email);
  }catch(err){
    showToast("Xatolik yuz berdi, qayta urinib ko'ring.");
    return;
  }
  const allReqs = await lrListForStudent(selfKey);
  state.parentData.requests = allReqs.filter(r=>r.status==='pending');
  state.parentData.linkedParents = allReqs.filter(r=>r.status==='accepted').map(r=>r.parentEmail);
  render();
  showToast(accept ? "Bog'landingiz." : "So'rov rad etildi.");
}

async function parentAddPlan(e){
  e.preventDefault();
  const f = e.target;
  const childEmail = state.modal.childEmail;
  const editId = state.modal.editId;
  const nom = f.nom.value.trim();
  const sana = f.sana.value;
  const turi = f.turi.value;
  const izoh = f.izoh.value.trim();
  const errBox = document.getElementById('modal-err');
  if(!nom || !sana){ errBox.textContent = t('err_nom_sana'); return; }
  const key = 'plans:'+sanitizeKey(childEmail);
  const plans = await sGet(key) || [];
  if(editId){
    const p = plans.find(x=>x.id===editId);
    if(p) Object.assign(p, { turi, nom, sana, izoh });
  } else {
    plans.push({ id: uid(), turi, nom, sana, izoh, ota_onadan: true, kimdan: state.user.ism, kimdanEmail: state.user.email });
  }
  plans.sort((a,b)=>a.sana.localeCompare(b.sana));
  const saved = await sSet(key, plans);
  if(!saved){ errBox.textContent = "Saqlashda xatolik yuz berdi. Qayta urinib ko'ring."; return; }
  const child = state.parentData.children.find(c=>c.email===childEmail);
  if(child) child.plans = plans;
  if(!editId){
    const tKey = threadKey(state.user.email, childEmail);
    const thread = await sGet(tKey) || [];
    thread.push({ id: uid(), from:'parent', matn: "Yangi reja qo'shdim: "+nom, ts: Date.now() });
    await sSet(tKey, thread);
  }
  closeModal();
  showToast(editId ? "Reja yangilandi." : "Farzandingiz uchun reja qo'shildi.");
}

async function parentDeletePlan(childEmail, planId){
  const key = 'plans:'+sanitizeKey(childEmail);
  const plans = (await sGet(key) || []).filter(p=>p.id!==planId);
  await sSet(key, plans);
  const child = state.parentData.children.find(c=>c.email===childEmail);
  if(child) child.plans = plans;
  render();
}

async function parentAddReminder(e){
  e.preventDefault();
  const f = e.target;
  const childEmail = state.modal.childEmail;
  const editId = state.modal.editId;
  const matn = f.matn.value.trim();
  const sana = f.sana.value;
  const vaqt = f.vaqt.value;
  const takrorlanish = f.takrorlanish.value;
  const errBox = document.getElementById('modal-err');
  if(!matn || !sana || !vaqt){ errBox.textContent = t('err_matn_sana_vaqt'); return; }
  const key = 'reminders:'+sanitizeKey(childEmail);
  const rems = await sGet(key) || [];
  if(editId){
    const r = rems.find(x=>x.id===editId);
    if(r) Object.assign(r, { matn, sana, vaqt, takrorlanish });
  } else {
    rems.push({ id: uid(), matn, sana, vaqt, takrorlanish, ota_onadan: true, kimdan: state.user.ism, kimdanEmail: state.user.email });
  }
  rems.sort((a,b)=>(a.sana+a.vaqt).localeCompare(b.sana+b.vaqt));
  const saved = await sSet(key, rems);
  if(!saved){ errBox.textContent = "Saqlashda xatolik yuz berdi. Qayta urinib ko'ring."; return; }
  const child = state.parentData.children.find(c=>c.email===childEmail);
  if(child) child.reminders = rems;
  if(!editId){
    const tKey = threadKey(state.user.email, childEmail);
    const thread = await sGet(tKey) || [];
    thread.push({ id: uid(), from:'parent', matn: "Yangi eslatma qo'ydim: "+matn, ts: Date.now() });
    await sSet(tKey, thread);
  }
  closeModal();
  showToast(editId ? "Eslatma yangilandi." : "Farzandingiz uchun eslatma qo'yildi.");
}

async function parentDeleteReminder(childEmail, remId){
  const key = 'reminders:'+sanitizeKey(childEmail);
  const rems = (await sGet(key) || []).filter(r=>r.id!==remId);
  await sSet(key, rems);
  const child = state.parentData.children.find(c=>c.email===childEmail);
  if(child) child.reminders = rems;
  render();
}

async function openChat(partnerEmail, partnerName, myRole){
  const tKey = threadKey(state.user.email, partnerEmail);
  const thread = await sGet(tKey) || [];
  await markThreadRead(partnerEmail);
  openModal('chat', { partnerEmail, partnerName, myRole, thread, tKey });
}

async function sendChat(e){
  e.preventDefault();
  const f = e.target;
  const matn = f.matn.value.trim();
  if(!matn) return;
  const tKey = state.modal.tKey;
  const thread = await sGet(tKey) || [];
  thread.push({ id: uid(), from: state.modal.myRole, matn, ts: Date.now() });
  const saved = await sSet(tKey, thread);
  if(!saved){ showToast("Xabar yuborilmadi. Qayta urinib ko'ring."); return; }
  state.modal.thread = thread;
  f.reset();
  render();
  setTimeout(()=>{ const cl = document.querySelector('.chat-list'); if(cl) cl.scrollTop = cl.scrollHeight; }, 30);
}

function renderSkeleton(){
  const bar = (w)=>`<div class="skel-bar" style="width:${w}"></div>`;
  return `
  <div class="topbar"><div class="brand">Re<em>ja</em></div></div>
  <div style="padding:16px;">
    <div class="sheet">
      ${bar('40%')}
      ${bar('90%')}
      ${bar('70%')}
    </div>
    <div class="sheet">
      ${bar('30%')}
      ${bar('85%')}
      ${bar('60%')}
      ${bar('75%')}
    </div>
  </div>
  <style>
    .skel-bar{height:14px;border-radius:7px;margin-bottom:10px;background:linear-gradient(90deg, var(--line) 25%, rgba(255,255,255,0.35) 37%, var(--line) 63%);background-size:400% 100%;animation:skelShine 1.4s ease-in-out infinite;}
    @keyframes skelShine{0%{background-position:100% 50%;}100%{background-position:0 50%;}}
  </style>`;
}

function render(){
  applyTheme();
  const app = document.getElementById('app');
  if(state.view === 'loading'){ app.innerHTML = renderSkeleton(); return; }
  if(state.view === 'auth'){ app.innerHTML = renderAuth(); attachAuthHandlers(); return; }
  app.innerHTML = renderApp();
  attachAppHandlers();
}

function viloyatOptionsHtml(selected){
  return '<option value="">— Viloyatni tanlang —</option>' + Object.keys(HUDUDLAR).map(v=>
    `<option value="${v}" ${selected===v?'selected':''}>${v}</option>`
  ).join('');
}

const MUASSASA_HINTS = {
  'maktab': { ph: "Masalan: 28-maktab", hint: "Format: <raqam>-maktab. Masalan: 28-maktab, 145-maktab." },
  'litsey': { ph: "Masalan: 3-akademik litsey", hint: "Format: <raqam>-akademik litsey yoki aniq nomi. Masalan: 3-akademik litsey, «Ijod» IT-litseyi." },
  'kasb-hunar': { ph: "Masalan: 5-kasb-hunar maktabi", hint: "Format: <raqam>-kasb-hunar maktabi yoki to'liq nomi. Masalan: 5-kasb-hunar maktabi, Toshkent temir yo'l kolleji." },
  'universitet': { ph: "Masalan: TATU yoki Milliy universitet", hint: "To'liq nomi yoki keng tarqalgan qisqartmasini yozing. Masalan: TATU, TDIU, Milliy universitet." }
};

function institutionFieldsHtml(role, prefix){
  if(role !== 'talaba') return '';
  const label = t('lbl_muassasa_turi_talaba');
  const selName = 'muassasa';
  const nomiName = 'muassasaNomi';
  const h = MUASSASA_HINTS.maktab;
  return `
    <label>${t('lbl_viloyat')}</label>
    <select name="${prefix}viloyat" class="viloyat-select" required>
      ${viloyatOptionsHtml('')}
    </select>
    <label>${t('lbl_tuman')}</label>
    <select name="${prefix}tuman" class="tuman-select" required>
      <option value="">— Avval viloyatni tanlang —</option>
    </select>
    <label>${label}</label>
    <select name="${selName}" class="muassasa-turi-select" required>
      <option value="maktab">Maktab</option>
      <option value="litsey">Akademik litsey</option>
      <option value="kasb-hunar">Kasb-hunar maktabi</option>
      <option value="universitet">Universitet / institut</option>
    </select>
    <label>${t('lbl_muassasa_raqami')}</label>
    <input type="text" name="${nomiName}" class="muassasa-nomi-input" placeholder="${h.ph}" required>
    <div class="note muassasa-hint" style="margin-top:-8px;">${h.hint}</div>
    <label>${t('lbl_sinf')}</label>
    <input type="text" name="sinf" placeholder="Masalan: 9-sinf yoki 2-kurs" required>
  `;
}

function renderAuth(){
  const isLogin = state.authMode === 'login';
  const isGoogleComplete = state.authMode === 'google_complete';
  const isForgot = state.authMode === 'forgot';
  const role = state.authRole;
  const pg = state.pendingGoogle || {};
  return `
  <div style="padding:40px 22px 30px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div class="brand" style="font-size:26px;margin-bottom:2px;">Re<em>ja</em></div>
      <button class="theme-toggle" id="themeToggleBtn" title="Kun/tun rejimi">${svgIcon(state.theme==='dark'?'sun':'moon')}</button>
      <button class="theme-toggle" id="langToggleBtn" title="Til / Язык / Language" style="width:auto;padding:0 10px;font-size:11px;font-weight:700;">${(state.lang||'uz').toUpperCase()}</button>
    </div>
    <p style="margin-bottom:24px;">${t('tagline')}</p>
    ${isGoogleComplete ? `
    <div class="sheet sheet-plum">
      <div class="eyebrow">Ro'yxatni yakunlang</div>
      <p>Google hisobingiz tasdiqlandi (<strong>${escapeHtml(pg.email)}</strong>). Davom etish uchun quyidagi maydonlarni to'ldiring.</p>
      <label style="margin-top:0;">${t('lbl_siz_kimsiz')}</label>
      <div class="segrow">
        <button type="button" class="seg role-btn ${role==='talaba'?'on':''}" data-role="talaba">O'quvchi / talaba</button>
        <button type="button" class="seg role-btn ${role==='ota_ona'?'on':''}" data-role="ota_ona">Ota-ona</button>
      </div>
      <form id="googleCompleteForm">
        ${institutionFieldsHtml(role, 'g_')}
        <div id="auth-err" class="err"></div>
        <button class="btn-primary btn-plum" type="submit">Yakunlash va kirish</button>
      </form>
      <button class="btn-ghost" id="cancelGoogleComplete" style="margin-top:12px;">← ${t('bekor_qilish')}</button>
    </div>
    ` : isForgot ? `
    <div class="sheet sheet-ruled">
      <div class="eyebrow">Parolni tiklash</div>
      <p>Ro'yxatdan o'tgan emailingizni kiriting — parolni tiklash havolasini yuboramiz.</p>
      <form id="forgotForm">
        <label>${t('lbl_email')}</label>
        <input type="email" name="femail" placeholder="ism@misol.uz" required>
        <div id="auth-err" class="err"></div>
        <button class="btn-primary" type="submit">Havola yuborish</button>
      </form>
      <button class="btn-ghost" id="cancelForgot" style="margin-top:12px;">← Kirish sahifasiga qaytish</button>
    </div>
    ` : `
    <div class="sheet sheet-ruled">
      <div class="eyebrow">${isLogin? t('kirish') : t('royxatdan_otish')}</div>
      ${isLogin ? `
      <button type="button" id="googleSigninBtn" class="btn-primary" style="background:#fff;color:#3c4043;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;gap:10px;margin-top:0;">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 16 3 9.1 7.6 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 36.3 27 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9 40.4 15.9 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.8l6.6 5.4C41.6 36 45 30.5 45 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
        ${t('google_orqali')}
      </button>
      <div style="text-align:center;color:var(--ink-soft);font-size:11.5px;margin:14px 0;">— yoki email bilan —</div>` : ''}
      ${isLogin ? `
      <form id="loginForm">
        <label>${t('lbl_email')}</label>
        <input type="email" name="email" placeholder="ism@misol.uz" required>
        <label>${t('lbl_parol')}</label>
        <input type="password" name="parol" placeholder="Parolingiz" required>
        <div id="auth-err" class="err"></div>
        <button class="btn-primary" type="submit">${t('kirish')}</button>
      </form>
      <button class="btn-ghost" id="toForgot" style="margin-top:10px;">${t('parolni_unutdingiz')}</button>
      <button class="btn-ghost" id="toRegister" style="margin-top:2px;display:block;">Hisobingiz yo'qmi? Ro'yxatdan o'ting</button>
      ` : `
      <label style="margin-top:0;">${t('lbl_kim_royxat')}</label>
      <div class="segrow">
        <button type="button" class="seg role-btn ${role==='talaba'?'on':''}" data-role="talaba">O'quvchi / talaba</button>
        <button type="button" class="seg role-btn ${role==='ota_ona'?'on':''}" data-role="ota_ona">Ota-ona</button>
      </div>
      <form id="registerForm">
        <label>${t('lbl_ism_familiya')}</label>
        <input type="text" name="ism" placeholder="Ism Familiya" required>
        <label>${t('lbl_email')}</label>
        <input type="email" name="email" placeholder="ism@misol.uz" required>
        <label>${t('lbl_parol')}</label>
        <input type="password" name="parol" placeholder="Kamida 6 ta belgi" required minlength="6">
        ${institutionFieldsHtml(role, '')}
        <div id="auth-err" class="err"></div>
        <button class="btn-primary" type="submit">${t('royxatdan_otish')}</button>
      </form>
      <button class="btn-ghost" id="toLogin" style="margin-top:12px;">Hisobingiz bormi? Kiring</button>
      `}
      <div class="note">Kirish va ro'yxatdan o'tish Firebase Authentication orqali xavfsiz tarzda amalga oshiriladi.</div>
    </div>
    `}
  </div>`;
}

function attachAuthHandlers(){
  const lf = document.getElementById('loginForm');
  const rf = document.getElementById('registerForm');
  const gcf = document.getElementById('googleCompleteForm');
  const ff = document.getElementById('forgotForm');
  if(lf) lf.addEventListener('submit', handleLogin);
  if(rf) rf.addEventListener('submit', handleRegister);
  if(gcf) gcf.addEventListener('submit', handleGoogleCompleteSubmit);
  if(ff) ff.addEventListener('submit', handleForgotPassword);
  const gsb = document.getElementById('googleSigninBtn');
  if(gsb) gsb.addEventListener('click', handleGoogleSignInClick);
  const tr = document.getElementById('toRegister');
  const tl = document.getElementById('toLogin');
  if(tr) tr.addEventListener('click', ()=>{ state.authMode='register'; render(); });
  if(tl) tl.addEventListener('click', ()=>{ state.authMode='login'; render(); });
  const tf = document.getElementById('toForgot');
  if(tf) tf.addEventListener('click', ()=>{ state.authMode='forgot'; render(); });
  const cf = document.getElementById('cancelForgot');
  if(cf) cf.addEventListener('click', ()=>{ state.authMode='login'; render(); });
  const cgc = document.getElementById('cancelGoogleComplete');
  if(cgc) cgc.addEventListener('click', ()=>{ state.authMode='login'; state.pendingGoogle=null; render(); });
  document.querySelectorAll('.role-btn').forEach(b=> b.addEventListener('click', ()=> setAuthRole(b.dataset.role)));
  document.querySelectorAll('.viloyat-select').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const tumanSel = sel.parentElement.querySelector('.tuman-select') || sel.closest('form').querySelector('.tuman-select');
      const list = HUDUDLAR[sel.value] || [];
      tumanSel.innerHTML = '<option value="">— Tanlang —</option>' + list.map(t=>`<option value="${t}">${t}</option>`).join('');
    });
  });
  document.querySelectorAll('.muassasa-turi-select').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const form = sel.closest('form');
      const nomiInput = form.querySelector('.muassasa-nomi-input');
      const hintDiv = form.querySelector('.muassasa-hint');
      const h = MUASSASA_HINTS[sel.value] || MUASSASA_HINTS.maktab;
      if(nomiInput) nomiInput.placeholder = h.ph;
      if(hintDiv) hintDiv.textContent = h.hint;
    });
  });
  const ttb = document.getElementById('themeToggleBtn');
  if(ttb) ttb.addEventListener('click', toggleTheme);
  const ltb = document.getElementById('langToggleBtn');
  if(ltb) ltb.addEventListener('click', cycleLang);
}

function renderApp(){
  return `
  ${state.toast ? `<div class="toast"><span>${escapeHtml(state.toast)}</span></div>` : ''}
  <div class="topbar">
    <div class="brand">Re<em>ja</em></div>
    <div class="topbar-right">
      <button class="theme-toggle" id="themeToggleBtn" title="Kun/tun rejimi">${svgIcon(state.theme==='dark'?'sun':'moon')}</button>
      <button class="theme-toggle" id="langToggleBtn" title="Til / Язык / Language" style="width:auto;padding:0 10px;font-size:11px;font-weight:700;">${(state.lang||'uz').toUpperCase()}</button>
      <button class="userchip" id="userchipBtn">${escapeHtml((state.user.ism||state.user.email||'').split(' ')[0])} ⌄</button>
    </div>
  </div>
  ${(!state.verifyBannerDismissed && _auth.currentUser && _auth.currentUser.emailVerified===false && state.user.authProvider==='password') ? `
  <div class="sheet" style="background:var(--accent-soft);border-left:4px solid var(--accent);margin:0 0 10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <div style="flex:1;min-width:200px;">✉️ ${t('email_tasdiqlanmagan')}</div>
    <button class="btn-small" id="resendVerifyBtn">${t('qayta_yuborish')}</button>
    <button class="btn-small" id="dismissVerifyBtn" style="background:transparent;">${t('yopish')}</button>
  </div>` : ''}
  ${renderTabContent()}
  ${state.modal ? renderModal() : ''}
  ${state.showOnboarding ? renderOnboarding() : ''}
  ${renderFab()}
  ${renderTabs()}
  `;
}

function renderOnboarding(){
  const key = 'onboard_' + (state.user.role || 'talaba');
  const steps = t(key);
  if(!Array.isArray(steps) || !steps.length) return '';
  const i = Math.min(state.onboardStep||0, steps.length-1);
  const s = steps[i];
  const isLast = i === steps.length-1;
  return `
  <div class="modal-wrap" id="onboardOverlay">
    <div class="modal" style="max-width:360px;text-align:center;border-radius:20px;">
      <div style="font-size:40px;margin-bottom:8px;">${s.emoji}</div>
      <div class="item-title" style="font-size:18px;margin-bottom:8px;">${escapeHtml(s.title)}</div>
      <div class="item-meta" style="font-size:13.5px;line-height:1.5;margin-bottom:18px;">${escapeHtml(s.body)}</div>
      <div style="display:flex;justify-content:center;gap:5px;margin-bottom:16px;">
        ${steps.map((_,idx)=>`<div style="width:${idx===i?18:6}px;height:6px;border-radius:3px;background:${idx===i?'var(--accent)':'var(--line)'};transition:width .2s;"></div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;">
        ${!isLast ? `<button class="btn-small" id="onboardSkipBtn" style="background:transparent;">${t('otkazib_yuborish')}</button>
        <button class="btn-small btn-plum" id="onboardNextBtn">${t('keyingisi')}</button>` :
        `<button class="btn-small btn-plum" id="onboardFinishBtn" style="min-width:140px;">${t('boshladik')}</button>`}
      </div>
    </div>
  </div>`;
}

async function finishOnboarding(){
  state.showOnboarding = false;
  state.user.onboarded = true;
  render();
  try{ await sSet('account:'+sanitizeKey(state.user.email), state.user); }catch(e){}
}

function renderFab(){
  if(state.user.role==='talaba' && ['jadval','rejalar','eslatma'].includes(state.tab)){
    return `<button class="fab" id="fabBtn" aria-label="Qo'shish">+</button>`;
  }
  if(state.user.role==='ota_ona' && state.tab==='p_farzandlar'){
    return `<button class="fab" id="fabBtn" aria-label="Farzand qo'shish">+</button>`;
  }
  return '';
}

function renderTabs(){
  if(state.user.role==='talaba'){
    const reqCount = (state.parentData.requests||[]).length;
    const unreadTotal = Object.values(state.parentData.unreadByEmail||{}).reduce((a,b)=>a+b,0);
    const hasDot = reqCount || unreadTotal;
    return `
    <div class="tabs">
      <button class="tab ${state.tab==='bosh'?'active':''}" data-tab="bosh">${svgIcon('home')}<span>${t('tab_bosh')}</span></button>
      <button class="tab ${state.tab==='jadval'?'active':''}" data-tab="jadval">${svgIcon('cal')}<span>${t('tab_jadval')}</span></button>
      <button class="tab ${state.tab==='rejalar'?'active':''}" data-tab="rejalar">${svgIcon('plan')}<span>${t('tab_rejalar')}</span></button>
      <button class="tab ${state.tab==='eslatma'?'active':''}" data-tab="eslatma">${svgIcon('bell')}<span>${t('tab_eslatma')}</span></button>
      <button class="tab ${state.tab==='profil'?'active':''}" data-tab="profil">${hasDot?'<span class="dot"></span>':''}${svgIcon('user')}<span>${t('tab_profil')}</span></button>
    </div>`;
  }
  if(state.user.role==='ota_ona'){
    const unreadTotal = Object.values(state.parentData.unreadByEmail||{}).reduce((a,b)=>a+b,0);
    return `
    <div class="tabs">
      <button class="tab ${state.tab==='p_bosh'?'active':''}" data-tab="p_bosh">${svgIcon('home')}<span>${t('tab_bosh')}</span></button>
      <button class="tab ${state.tab==='p_farzandlar'?'active':''}" data-tab="p_farzandlar">${unreadTotal?'<span class="dot"></span>':''}${svgIcon('users')}<span>${t('tab_farzandlar')}</span></button>
      <button class="tab ${state.tab==='profil'?'active':''}" data-tab="profil">${svgIcon('user')}<span>${t('tab_profil')}</span></button>
    </div>`;
  }
  return '';
}

function renderTabContent(){
  const r = state.user.role;
  if(r==='talaba'){
    if(state.tab==='bosh') return renderHome();
    if(state.tab==='jadval') return renderSchedule();
    if(state.tab==='rejalar') return renderPlans();
    if(state.tab==='eslatma') return renderReminders();
    if(state.tab==='profil') return renderProfile();
  }
  if(r==='ota_ona'){
    if(state.tab==='p_bosh') return renderParentHome();
    if(state.tab==='p_farzandlar') return renderParentChildren();
    if(state.tab==='profil') return renderProfile();
  }
  return `
  <div class="sheet">
    <div class="eyebrow">Muammo yuz berdi</div>
    <p>Hisobingiz ma'lumotlarida nomuvofiqlik topildi (rol aniqlanmadi). Iltimos, chiqib qayta kiring. Muammo davom etsa, tizim egasi bilan bog'laning.</p>
    <button class="btn-small btn-danger" id="fallbackLogoutBtn">${t('chiqish')}</button>
  </div>`;
}

function renderHome(){
  const today = todayISO();
  const di = dowIndex(today);
  const lessons = state.data.schedule.filter(l=>l.kunlar.includes(di)).sort((a,b)=>a.boshlanish.localeCompare(b.boshlanish));
  const todaysPlans = state.data.plans.filter(p=>p.sana===today);
  const todaysRems = state.data.reminders.filter(r=>r.sana===today);
  return `
  <div class="sheet sheet-ruled">
    <div class="datehead">
      <div class="big">${fmtDate(today)}</div>
      <div class="dow">${KUN_FULL[di]}</div>
    </div>
    ${lessons.length ? lessons.map(l=>`
      <div class="lesson">
        <div class="time">${l.boshlanish}</div>
        <div class="body">
          <div class="fan">${escapeHtml(l.fan)}</div>
          <div class="meta">${l.tugash? l.boshlanish+'–'+l.tugash+' ':''}${l.xona? '· '+escapeHtml(l.xona):''}</div>
        </div>
      </div>
    `).join('') : `<div class="empty">${svgIcon('cal')}<div>Bugun darslar kiritilmagan.</div></div>`}
  </div>
  ${(todaysPlans.length || todaysRems.length) ? `
  <div class="sheet">
    <div class="eyebrow">Bugungi rejalar va eslatmalar</div>
    ${todaysPlans.map(p=>`<div class="plan-item"><div class="item-top"><div class="item-title">${escapeHtml(p.nom)}</div><span class="badge ${p.ota_onadan?'parent':''}">${p.ota_onadan?'ota-onadan':p.turi}</span></div>${p.izoh?`<div class="item-meta">${escapeHtml(p.izoh)}</div>`:''}</div>`).join('')}
    ${todaysRems.map(r=>`<div class="rem-item"><div class="item-top"><div class="item-title">${escapeHtml(r.matn)}</div><span class="badge ${r.ota_onadan?'parent':(r.takrorlanish!=='bir_marta'?'rep':'')}">${r.ota_onadan?'ota-onadan':r.vaqt}</span></div></div>`).join('')}
  </div>` : ''}
  <div class="sheet">
    <div class="eyebrow">Eslatma rejimi</div>
    <p style="margin-bottom:8px;">${state.user.reminderMode==='har_dars' ? 'Har darsdan 5 daqiqa oldin eslatiladi.' : "Kuniga bir marta, ertalab bugungi darslar haqida eslatiladi."}</p>
    <button class="btn-small" id="goProfileBtn">Sozlamalarni o'zgartirish →</button>
  </div>
  `;
}

function renderSchedule(){
  const grouped = KUN_FULL.map((name,i)=> ({ name, i, lessons: state.data.schedule.filter(l=>l.kunlar.includes(i)).sort((a,b)=>a.boshlanish.localeCompare(b.boshlanish)) }));
  const view = state.scheduleView || 'list';
  return `
  <div class="sheet">
    <div class="item-top" style="margin-bottom:2px;">
      <div class="eyebrow" style="margin-bottom:0;">Haftalik dars jadvali</div>
      <div style="display:flex;gap:6px;">
        <button class="btn-small ${view==='list'?'btn-plum':''}" data-schedule-view="list">☰ ${t('korinish_royxat')}</button>
        <button class="btn-small ${view==='grid'?'btn-plum':''}" data-schedule-view="grid">▦ ${t('korinish_jadval')}</button>
        <button class="btn-small" data-export="jadval">⬇ CSV</button>
      </div>
    </div>
    ${view==='grid' ? renderScheduleGrid(grouped) : renderScheduleList(grouped)}
  </div>`;
}

function renderScheduleList(grouped){
  return `${grouped.map(g=> g.lessons.length ? `
      <div style="margin-bottom:14px;">
        <div style="font-weight:600;font-size:13.5px;color:var(--accent-deep);margin-bottom:4px;">${g.name}</div>
        ${g.lessons.map(l=>`
          <div class="lesson">
            <div class="time">${l.boshlanish}</div>
            <div class="body"><div class="fan">${escapeHtml(l.fan)}</div><div class="meta">${l.tugash?l.boshlanish+'–'+l.tugash+' ':''}${l.xona?'· '+escapeHtml(l.xona):''}</div></div>
            <button class="del" data-edit-lesson="${l.id}" title="Tahrirlash">✎</button>
            <button class="del" data-del-lesson="${l.id}">✕</button>
          </div>
        `).join('')}
      </div>
    ` : '').join('') || `<div class="empty">${svgIcon('cal')}<div>Hali dars qo'shilmagan. Pastdagi + tugmasi orqali qo'shing.</div></div>`}`;
}

function renderScheduleGrid(grouped){
  const total = grouped.reduce((a,g)=>a+g.lessons.length,0);
  if(!total) return `<div class="empty">${svgIcon('cal')}<div>Hali dars qo'shilmagan. Pastdagi + tugmasi orqali qo'shing.</div></div>`;
  return `
  <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;overflow-x:auto;">
    ${grouped.map(g=>`
      <div style="min-width:110px;">
        <div style="font-weight:700;font-size:11px;text-align:center;color:var(--accent-deep);margin-bottom:6px;">${g.name.slice(0,3)}</div>
        ${g.lessons.map(l=>`
          <div data-edit-lesson="${l.id}" style="cursor:pointer;background:var(--paper-card);border:1px solid var(--line);border-radius:8px;padding:6px;margin-bottom:6px;font-size:11px;">
            <div style="font-weight:700;">${l.boshlanish}</div>
            <div style="font-weight:600;">${escapeHtml(l.fan)}</div>
            ${l.xona?`<div style="opacity:0.7;">${escapeHtml(l.xona)}</div>`:''}
          </div>
        `).join('') || '<div style="opacity:0.35;font-size:11px;text-align:center;">—</div>'}
      </div>
    `).join('')}
  </div>`;
}

function renderPlans(){
  return `
  <div class="sheet">
    <div class="item-top" style="margin-bottom:2px;"><div class="eyebrow" style="margin-bottom:0;">Kunlik / oylik / yillik rejalar</div><button class="btn-small" data-export="rejalar">⬇ CSV</button></div>
    ${state.data.plans.length ? state.data.plans.map(p=>`
      <div class="plan-item">
        <div class="item-top">
          <div><div class="item-title">${escapeHtml(p.nom)}</div><div class="item-meta">${fmtDate(p.sana)} ${p.izoh?'· '+escapeHtml(p.izoh):''} ${p.ota_onadan?('· '+escapeHtml(p.kimdan)+" qo'shdi"):''}</div></div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="badge ${p.ota_onadan?'parent':''}">${p.ota_onadan?'ota-onadan':p.turi}</span>
            <button class="del" data-edit-plan="${p.id}" title="Tahrirlash">✎</button>
            <button class="del" data-del-plan="${p.id}">✕</button>
          </div>
        </div>
      </div>
    `).join('') : `<div class="empty">${svgIcon('plan')}<div>Hali reja qo'shilmagan.</div></div>`}
  </div>`;
}

function renderReminders(){
  return `
  <div class="sheet">
    <div class="item-top" style="margin-bottom:2px;"><div class="eyebrow" style="margin-bottom:0;">Eslatmalar</div><button class="btn-small" data-export="eslatma">⬇ CSV</button></div>
    ${state.data.reminders.length ? state.data.reminders.map(r=>`
      <div class="rem-item">
        <div class="item-top">
          <div><div class="item-title">${escapeHtml(r.matn)}</div><div class="item-meta">${fmtDate(r.sana)}, ${r.vaqt} ${r.ota_onadan?('· '+escapeHtml(r.kimdan)+" qo'ydi"):''}</div></div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="badge ${r.ota_onadan?'parent':(r.takrorlanish!=='bir_marta'?'rep':'')}">${r.ota_onadan?'ota-onadan':r.takrorlanish.replace('_',' ')}</span>
            <button class="del" data-edit-reminder="${r.id}" title="Tahrirlash">✎</button>
            <button class="del" data-del-reminder="${r.id}">✕</button>
          </div>
        </div>
      </div>
    `).join('') : `<div class="empty">${svgIcon('bell')}<div>Hali eslatma qo'yilmagan.</div></div>`}
  </div>`;
}

function renderProfile(){
  const u = state.user;
  if(u.role==='talaba'){
    const reqs = state.parentData.requests || [];
    const parents = state.parentData.linkedParents || [];
    return `
    <div class="sheet">
      <div class="eyebrow">Profil</div>
      <h3 style="margin-bottom:2px;">${escapeHtml(u.ism)}</h3>
      <p style="margin-bottom:2px;">${escapeHtml(u.email)}</p>
      <p>${MUASSASA_LABEL[u.muassasa]||''} ${u.sinf? '· '+escapeHtml(u.sinf) : ''} ${u.muassasaNomi?'· '+escapeHtml(u.muassasaNomi):''}</p>
      ${u.viloyat ? `<p style="margin-top:-10px;">${escapeHtml(u.viloyat)}${u.tuman?', '+escapeHtml(u.tuman):''}</p>` : ''}
      <button class="btn-small" id="editProfileBtn">✎ Profilni tahrirlash</button>
      ${u.authProvider==='google' ? `<button class="btn-small btn-plum" id="setPasswordBtn" style="margin-left:6px;">🔑 Parol o'rnatish</button>` : ''}
    </div>
    ${reqs.length ? `
    <div class="sheet sheet-plum">
      <div class="eyebrow">Ota-ona so'rovlari</div>
      ${reqs.map(r=>`
        <div class="req-item">
          <div class="item-title">${escapeHtml(r.parentName)}</div>
          <div class="item-meta" style="margin-bottom:8px;">${escapeHtml(r.parentEmail)} bog'lanishni so'ramoqda</div>
          <div style="display:flex;gap:8px;">
            <button class="btn-small btn-plum" data-accept-req="${r.id}">Qabul qilish</button>
            <button class="btn-small btn-danger" data-decline-req="${r.id}">Rad etish</button>
          </div>
        </div>
      `).join('')}
    </div>` : ''}
    <div class="sheet sheet-plum">
      <div class="eyebrow">Bog'langan ota-onalar</div>
      ${parents.length ? parents.map(p=>{
        const unread = (state.parentData.unreadByEmail||{})[p] || 0;
        return `
        <div class="child-item">
          <div class="child-row">
            <div class="avatar">${initials(p)}</div>
            <div style="flex:1;"><div class="item-title">${escapeHtml(p)}</div></div>
            <button class="btn-small" data-chat-parent="${escapeHtml(p)}">${svgIcon('chat')} Xabar${unread?` <span class="badge unread">${unread}</span>`:''}</button>
          </div>
        </div>
      `;}).join('') : `<div class="empty">Hali hech kim bog'lanmagan.</div>`}
    </div>
    <div class="sheet">
      <div class="eyebrow">Eslatma tartibi</div>
      <p>Darslar haqida qanday eslatilsin?</p>
      <div class="segrow">
        <button class="seg ${u.reminderMode==='bir_marta'?'on':''}" id="modeBirMarta">Kuniga bir marta</button>
        <button class="seg ${u.reminderMode==='har_dars'?'on':''}" id="modeHarDars">Har dars oldidan</button>
      </div>
      <label style="margin-top:16px;">${t('lbl_brauzer_bildirish')}</label>
      <button class="btn-small" id="notifPermBtn">${(window.Notification && Notification.permission==='granted') ? 'Yoqilgan ✓' : 'Ruxsat berish'}</button>
    </div>
    <button class="btn-small btn-danger" id="logoutBtn" style="margin:0 16px;width:calc(100% - 32px);">${t('chiqish')}</button>
    `;
  }
  if(u.role==='ota_ona'){
    return `
    <div class="sheet">
      <div class="eyebrow">Profil</div>
      <h3 style="margin-bottom:2px;">${escapeHtml(u.ism)}</h3>
      <p>${escapeHtml(u.email)} · ${t('ota_ona_hisobi')}</p>
      <button class="btn-small" id="editProfileBtn">✎ Profilni tahrirlash</button>
      ${u.authProvider==='google' ? `<button class="btn-small btn-plum" id="setPasswordBtn" style="margin-left:6px;">🔑 Parol o'rnatish</button>` : ''}
    </div>
    <div class="sheet">
      <div class="eyebrow">${t('farzand_qoshish')}</div>
      <p>${t('farzand_qoshish_izoh')}</p>
      <button class="btn-small btn-plum" id="addChildBtn2">Farzand qo'shish</button>
    </div>
    <button class="btn-small btn-danger" id="logoutBtn" style="margin:0 16px;width:calc(100% - 32px);">${t('chiqish')}</button>
    `;
  }
  return '';
}

function computeWeeklyReport(child){
  const today = todayISO();
  const upcomingPlans = (child.plans||[]).filter(p=> p.sana >= today).length;
  const upcomingReminders = (child.reminders||[]).filter(r=> r.sana >= today).length;
  return { upcomingPlans, upcomingReminders };
}

function renderParentHome(){
  const children = state.parentData.children || [];
  const today = todayISO();
  const di = dowIndex(today);
  return `
  <div class="sheet sheet-plum">
    <div class="eyebrow">Bugun, ${fmtDate(today)}</div>
    ${children.length ? children.map(c=>{
      const lessons = c.schedule.filter(l=>l.kunlar.includes(di)).sort((a,b)=>a.boshlanish.localeCompare(b.boshlanish));
      return `
      <div class="child-item">
        <div class="child-row" style="margin-bottom:6px;">
          <div class="avatar">${initials(c.acc.ism)}</div>
          <div>
            <div class="item-title">${escapeHtml(c.acc.ism)}</div>
            <div class="item-meta">${escapeHtml(c.acc.muassasaNomi||'')}${c.acc.sinf?' · '+escapeHtml(c.acc.sinf):''}</div>
          </div>
        </div>
        ${lessons.length ? `<div class="item-meta">Bugun ${lessons.length} ta dars: ${lessons.map(l=>l.boshlanish+' '+l.fan).join(', ')}</div>` : `<div class="item-meta">Bugun dars kiritilmagan.</div>`}
        <button class="btn-small" data-pdf-report="${escapeHtml(c.email)}" style="margin-top:8px;">⬇ ${t('pdf_hisobot')}</button>
      </div>`;
    }).join('') : `<div class="empty">${svgIcon('users')}<div>Hali farzand bog'lanmagan. Profil orqali qo'shing.</div></div>`}
  </div>
  ${children.length ? `
  <div class="sheet">
    <div class="eyebrow">Yaqinlashib kelayotgan</div>
    ${children.map(c=>{
      const r = computeWeeklyReport(c);
      return `
      <div class="plan-item">
        <div class="item-title" style="margin-bottom:6px;">${escapeHtml(c.acc.ism)}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;">
          <div><div style="font-family:'Fraunces',serif;font-size:18px;font-weight:600;">${r.upcomingPlans}</div><div class="item-meta">Yaqin reja</div></div>
          <div><div style="font-family:'Fraunces',serif;font-size:18px;font-weight:600;">${r.upcomingReminders}</div><div class="item-meta">Yaqin eslatma</div></div>
        </div>
      </div>`;
    }).join('')}
  </div>` : ''}
  ${children.length ? `<div class="sheet"><div class="eyebrow">Tezkor</div><button class="btn-small" id="goChildrenBtn">Farzandlarni boshqarish →</button></div>` : ''}
  `;
}

function renderParentChildren(){
  const children = state.parentData.children || [];
  if(!children.length) return `<div class="sheet"><div class="empty">${svgIcon('users')}<div>Hali farzand bog'lanmagan. Pastdagi + tugmasi orqali qo'shing.</div></div></div>`;
  return children.map(c=>{
    const upcomingPlans = c.plans.filter(p=>p.sana>=todayISO()).slice(0,4);
    const upcomingRems = c.reminders.filter(r=>r.sana>=todayISO()).slice(0,4);
    const unread = (state.parentData.unreadByEmail||{})[c.email] || 0;
    return `
    <div class="sheet">
      <div class="child-row" style="margin-bottom:10px;">
        <div class="avatar">${initials(c.acc.ism)}</div>
        <div style="flex:1;">
          <div class="item-title">${escapeHtml(c.acc.ism)}</div>
          <div class="item-meta">${MUASSASA_LABEL[c.acc.muassasa]||''}${c.acc.muassasaNomi?' · '+escapeHtml(c.acc.muassasaNomi):''}${c.acc.sinf?' · '+escapeHtml(c.acc.sinf):''}</div>
          ${(c.acc.viloyat || c.acc.tuman) ? `<div class="item-meta">${escapeHtml(c.acc.viloyat||'')}${c.acc.tuman?', '+escapeHtml(c.acc.tuman):''}</div>` : ''}
        </div>
        <button class="btn-small" data-chat-child="${escapeHtml(c.email)}|${escapeHtml(c.acc.ism)}">${svgIcon('chat')}${unread?` <span class="badge unread">${unread}</span>`:''}</button>
      </div>
      <div class="eyebrow">Yaqin rejalar va eslatmalar</div>
      ${(upcomingPlans.length||upcomingRems.length) ? `
        ${upcomingPlans.map(p=>`
          <div class="plan-item">
            <div class="item-top">
              <div><div class="item-title">${escapeHtml(p.nom)}</div><div class="item-meta">${fmtDate(p.sana)}</div></div>
              ${p.kimdanEmail===state.user.email ? `
              <div style="display:flex;gap:4px;">
                <button class="del" data-parent-edit-plan="${escapeHtml(c.email)}|${p.id}" title="Tahrirlash">✎</button>
                <button class="del" data-parent-del-plan="${escapeHtml(c.email)}|${p.id}">✕</button>
              </div>` : `<span class="badge">${escapeHtml((c.acc.ism||c.acc.email||'').split(' ')[0])}dan</span>`}
            </div>
          </div>`).join('')}
        ${upcomingRems.map(r=>`
          <div class="rem-item">
            <div class="item-top">
              <div><div class="item-title">${escapeHtml(r.matn)}</div><div class="item-meta">${fmtDate(r.sana)}, ${r.vaqt}</div></div>
              ${r.kimdanEmail===state.user.email ? `
              <div style="display:flex;gap:4px;">
                <button class="del" data-parent-edit-reminder="${escapeHtml(c.email)}|${r.id}" title="Tahrirlash">✎</button>
                <button class="del" data-parent-del-reminder="${escapeHtml(c.email)}|${r.id}">✕</button>
              </div>` : `<span class="badge">${escapeHtml((c.acc.ism||c.acc.email||'').split(' ')[0])}dan</span>`}
            </div>
          </div>`).join('')}
      ` : `<div class="empty" style="padding:10px;">Hozircha yaqin reja yoki eslatma yo'q.</div>`}
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn-small btn-plum" data-parent-add-plan="${escapeHtml(c.email)}">+ Reja</button>
        <button class="btn-small btn-plum" data-parent-add-reminder="${escapeHtml(c.email)}">+ Eslatma</button>
      </div>
    </div>`;
  }).join('');
}

function renderModal(){
  const k = state.modal.kind;
  if(k==='lesson'){
    const editing = !!state.modal.editId;
    const l = editing ? state.data.schedule.find(x=>x.id===state.modal.editId) : null;
    return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>${editing? "Darsni tahrirlash" : "Dars qo'shish"}</h3><button class="close-x" id="modalClose">✕</button></div>
      <form id="lessonForm">
        <label>${t('lbl_fan')}</label>
        <input type="text" name="fan" placeholder="Masalan: Matematika" value="${l?escapeHtml(l.fan):''}" required>
        <div class="row2">
          <div><label>${t('lbl_boshlanish')}</label><input type="time" name="boshlanish" value="${l?l.boshlanish:''}" required></div>
          <div><label>${t('lbl_tugash')}</label><input type="time" name="tugash" value="${l&&l.tugash?l.tugash:''}"></div>
        </div>
        <label>${t('lbl_xona')}</label>
        <input type="text" name="xona" placeholder="Masalan: 204-xona" value="${l&&l.xona?escapeHtml(l.xona):''}">
        <label>${t('lbl_hafta_kunlari')}</label>
        <div class="chipset">
          ${KUN.map((k,i)=>`<span class="chip dow-chip ${l&&l.kunlar.includes(i)?'on':''}" data-i="${i}">${k}</span>`).join('')}
        </div>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary" type="submit">${editing?t('yangilash'):t('saqlash')}</button>
      </form>
    </div>
  </div>`;
  }
  if(k==='plan'){
    const editing = !!state.modal.editId;
    const p = editing ? state.data.plans.find(x=>x.id===state.modal.editId) : null;
    const opt = (v,label)=> `<option value="${v}" ${p&&p.turi===v?'selected':''}>${label}</option>`;
    return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"Rejani tahrirlash":"Reja qo'shish"}</h3><button class="close-x" id="modalClose">✕</button></div>
      <form id="planForm">
        <label>${t('lbl_turi')}</label>
        <select name="turi">
          ${opt('kunlik','Kunlik')}${opt('haftalik','Haftalik')}${opt('oylik','Oylik')}${opt('yillik','Yillik')}
        </select>
        <label>${t('lbl_reja_nomi')}</label>
        <input type="text" name="nom" placeholder="Masalan: Nazorat ishiga tayyorgarlik" value="${p?escapeHtml(p.nom):''}" required>
        <label>${t('lbl_sana')}</label>
        <input type="date" name="sana" value="${p?p.sana:''}" required>
        <label>${t('lbl_izoh')}</label>
        <textarea name="izoh" rows="2" placeholder="Qo'shimcha tafsilotlar">${p&&p.izoh?escapeHtml(p.izoh):''}</textarea>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary" type="submit">${editing?t('yangilash'):t('saqlash')}</button>
      </form>
    </div>
  </div>`;
  }
  if(k==='reminder'){
    const editing = !!state.modal.editId;
    const r = editing ? state.data.reminders.find(x=>x.id===state.modal.editId) : null;
    const opt = (v,label)=> `<option value="${v}" ${r&&r.takrorlanish===v?'selected':''}>${label}</option>`;
    return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"Eslatmani tahrirlash":"Eslatma qo'yish"}</h3><button class="close-x" id="modalClose">✕</button></div>
      <form id="reminderForm">
        <label>${t('lbl_nima_haqida')}</label>
        <input type="text" name="matn" placeholder="Masalan: Kitobni qaytarish" value="${r?escapeHtml(r.matn):''}" required>
        <div class="row2">
          <div><label>${t('lbl_sana')}</label><input type="date" name="sana" value="${r?r.sana:''}" required></div>
          <div><label>${t('lbl_vaqt')}</label><input type="time" name="vaqt" value="${r?r.vaqt:''}" required></div>
        </div>
        <label>${t('lbl_takrorlanish')}</label>
        <select name="takrorlanish">
          ${opt('bir_marta','Bir marta')}${opt('kunlik','Har kuni')}${opt('haftalik','Har hafta')}${opt('oylik','Har oy')}${opt('yillik','Har yili')}
        </select>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary" type="submit">${editing?t('yangilash'):t('saqlash')}</button>
      </form>
    </div>
  </div>`;
  }
  if(k==='editProfile'){
    const u = state.user;
    const opt = (v,label)=> `<option value="${v}" ${u.muassasa===v?'selected':''}>${label}</option>`;
    return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>Profilni tahrirlash</h3><button class="close-x" id="modalClose">✕</button></div>
      <form id="editProfileForm">
        <label>${t('lbl_ism_familiya')}</label>
        <input type="text" name="ism" value="${escapeHtml(u.ism)}" required>
        ${u.role==='talaba' ? `
        <label>${t('lbl_viloyat')}</label>
        <select name="viloyat" class="viloyat-select" required>
          ${viloyatOptionsHtml(u.viloyat||'')}
        </select>
        <label>${t('lbl_tuman')}</label>
        <select name="tuman" class="tuman-select" required>
          <option value="">— Tanlang —</option>
          ${(HUDUDLAR[u.viloyat]||[]).map(t=>`<option value="${t}" ${u.tuman===t?'selected':''}>${t}</option>`).join('')}
        </select>
        <label>${t('lbl_muassasa_turi_talaba')}</label>
        <select name="muassasa" class="muassasa-turi-select" required>
          ${opt('maktab','Maktab')}${opt('litsey','Akademik litsey')}${opt('kasb-hunar','Kasb-hunar maktabi')}${opt('universitet','Universitet / institut')}
        </select>
        <label>${t('lbl_muassasa_raqami')}</label>
        <input type="text" name="muassasaNomi" class="muassasa-nomi-input" value="${escapeHtml(u.muassasaNomi||'')}" required>
        <label>${t('lbl_sinf')}</label>
        <input type="text" name="sinf" value="${escapeHtml(u.sinf||'')}" required>
        ` : ''}
        <div id="modal-err" class="err"></div>
        <button class="btn-primary" type="submit">${t('saqlash')}</button>
      </form>
    </div>
  </div>`;
  }
  if(k==='setPassword'){
    return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>Parol o'rnatish</h3><button class="close-x" id="modalClose">✕</button></div>
      <p>Hozir Google orqali kirasiz. Bu yerda parol o'rnatsangiz, keyinchalik email va parol bilan ham kira olasiz.</p>
      <form id="setPasswordForm">
        <label>${t('lbl_yangi_parol')}</label>
        <input type="password" name="parol" placeholder="Kamida 6 ta belgi" required>
        <label>${t('lbl_parol_takror')}</label>
        <input type="password" name="parol2" placeholder="Parolni qayta yozing" required>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary btn-plum" type="submit">${t('saqlash')}</button>
      </form>
    </div>
  </div>`;
  }
  if(k==='addChild') return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>Farzand qo'shish</h3><button class="close-x" id="modalClose">✕</button></div>
      <form id="addChildForm">
        <label>${t('lbl_farzand_email')}</label>
        <input type="email" name="childEmail" placeholder="farzand@misol.uz" required>
        <div class="note">Farzandingiz shu ilovada allaqachon ro'yxatdan o'tgan bo'lishi kerak. So'rov yuboriladi va u tasdiqlagach bog'lanasiz.</div>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary" type="submit">So'rov yuborish</button>
      </form>
    </div>
  </div>`;
  if(k==='parentPlan'){
    const editing = !!state.modal.editId;
    const child = state.parentData.children.find(c=>c.email===state.modal.childEmail);
    const p = editing && child ? child.plans.find(x=>x.id===state.modal.editId) : null;
    const opt = (v,label)=> `<option value="${v}" ${p&&p.turi===v?'selected':''}>${label}</option>`;
    return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"Rejani tahrirlash":"Farzand uchun reja"}</h3><button class="close-x" id="modalClose">✕</button></div>
      <form id="parentPlanForm">
        <label>${t('lbl_turi')}</label>
        <select name="turi">
          ${opt('kunlik','Kunlik')}${opt('haftalik','Haftalik')}${opt('oylik','Oylik')}${opt('yillik','Yillik')}
        </select>
        <label>${t('lbl_reja_nomi')}</label>
        <input type="text" name="nom" placeholder="Masalan: Repetitorga borish" value="${p?escapeHtml(p.nom):''}" required>
        <label>${t('lbl_sana')}</label>
        <input type="date" name="sana" value="${p?p.sana:''}" required>
        <label>${t('lbl_izoh')}</label>
        <textarea name="izoh" rows="2">${p&&p.izoh?escapeHtml(p.izoh):''}</textarea>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary btn-plum" type="submit">${editing?t('yangilash'):t('saqlash')}</button>
      </form>
    </div>
  </div>`;
  }
  if(k==='parentReminder'){
    const editing = !!state.modal.editId;
    const child = state.parentData.children.find(c=>c.email===state.modal.childEmail);
    const r = editing && child ? child.reminders.find(x=>x.id===state.modal.editId) : null;
    const opt = (v,label)=> `<option value="${v}" ${r&&r.takrorlanish===v?'selected':''}>${label}</option>`;
    return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"Eslatmani tahrirlash":"Farzand uchun eslatma"}</h3><button class="close-x" id="modalClose">✕</button></div>
      <form id="parentReminderForm">
        <label>${t('lbl_nima_haqida')}</label>
        <input type="text" name="matn" placeholder="Masalan: Sport mashg'ulotiga borish" value="${r?escapeHtml(r.matn):''}" required>
        <div class="row2">
          <div><label>${t('lbl_sana')}</label><input type="date" name="sana" value="${r?r.sana:''}" required></div>
          <div><label>${t('lbl_vaqt')}</label><input type="time" name="vaqt" value="${r?r.vaqt:''}" required></div>
        </div>
        <label>${t('lbl_takrorlanish')}</label>
        <select name="takrorlanish">
          ${opt('bir_marta','Bir marta')}${opt('kunlik','Har kuni')}${opt('haftalik','Har hafta')}${opt('oylik','Har oy')}${opt('yillik','Har yili')}
        </select>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary btn-plum" type="submit">${editing?t('yangilash'):t('saqlash')}</button>
      </form>
    </div>
  </div>`;
  }
  if(k==='chat'){
    const thread = state.modal.thread || [];
    return `
    <div class="modal-wrap" id="modalWrap">
      <div class="modal">
        <div class="modal-head"><h3>${escapeHtml(state.modal.partnerName)}</h3><button class="close-x" id="modalClose">✕</button></div>
        <div class="chat-list">
          ${thread.length ? thread.map(m=>{
            const mine = m.from === state.modal.myRole;
            return `<div class="chat-bubble ${mine?'chat-mine':'chat-theirs'}">${escapeHtml(m.matn)}<span class="chat-time">${fmtDateTime(m.ts)}</span></div>`;
          }).join('') : `<div class="empty">Hali xabar yo'q. Birinchi bo'lib yozing.</div>`}
        </div>
        <form id="chatForm" class="chat-input-row">
          <input type="text" name="matn" placeholder="Xabar yozing..." autocomplete="off">
          <button type="submit" class="btn-accent">Yuborish</button>
        </form>
      </div>
    </div>`;
  }
  return '';
}

function attachAppHandlers(){
  const rvb = document.getElementById('resendVerifyBtn');
  if(rvb) rvb.addEventListener('click', async ()=>{
    rvb.disabled = true;
    try{
      await fbSendVerification();
      showToast("Tasdiqlash xati qayta yuborildi.");
    }catch(err){
      showToast("Xatolik: birozdan keyin qayta urinib ko'ring.");
    }
    rvb.disabled = false;
  });
  const dvb = document.getElementById('dismissVerifyBtn');
  if(dvb) dvb.addEventListener('click', ()=>{ state.verifyBannerDismissed = true; render(); });
  document.querySelectorAll('.tab').forEach(t=> t.addEventListener('click', ()=> switchTab(t.dataset.tab)));
  const fab = document.getElementById('fabBtn');
  if(fab) fab.addEventListener('click', ()=>{
    if(state.user.role==='talaba'){
      const map = { jadval:'lesson', rejalar:'plan', eslatma:'reminder' };
      openModal(map[state.tab] || 'reminder');
    } else if(state.user.role==='ota_ona'){
      openModal('addChild');
    }
  });
  const uc = document.getElementById('userchipBtn');
  if(uc) uc.addEventListener('click', ()=> switchTab('profil'));
  const ttb = document.getElementById('themeToggleBtn');
  if(ttb) ttb.addEventListener('click', toggleTheme);
  const ltb = document.getElementById('langToggleBtn');
  if(ltb) ltb.addEventListener('click', cycleLang);
  const gp = document.getElementById('goProfileBtn');
  if(gp) gp.addEventListener('click', ()=> switchTab('profil'));
  const gc = document.getElementById('goChildrenBtn');
  if(gc) gc.addEventListener('click', ()=> switchTab('p_farzandlar'));
  document.querySelectorAll('[data-pdf-report]').forEach(b=> b.addEventListener('click', ()=> exportChildPDF(b.dataset.pdfReport)));
  const lb = document.getElementById('logoutBtn');
  if(lb) lb.addEventListener('click', logout);
  const flb = document.getElementById('fallbackLogoutBtn');
  if(flb) flb.addEventListener('click', logout);
  const epb = document.getElementById('editProfileBtn');
  if(epb) epb.addEventListener('click', ()=> openModal('editProfile'));
  const spb = document.getElementById('setPasswordBtn');
  if(spb) spb.addEventListener('click', ()=> openModal('setPassword'));
  const mb = document.getElementById('modeBirMarta');
  if(mb) mb.addEventListener('click', ()=> setReminderMode('bir_marta'));
  const mh = document.getElementById('modeHarDars');
  if(mh) mh.addEventListener('click', ()=> setReminderMode('har_dars'));
  const npb = document.getElementById('notifPermBtn');
  if(npb) npb.addEventListener('click', requestNotifPerm);
  const acb2 = document.getElementById('addChildBtn2');
  if(acb2) acb2.addEventListener('click', ()=> openModal('addChild'));

  document.querySelectorAll('[data-del-lesson]').forEach(b=> b.addEventListener('click', ()=> delLesson(b.dataset.delLesson)));
  document.querySelectorAll('[data-del-plan]').forEach(b=> b.addEventListener('click', ()=> delPlan(b.dataset.delPlan)));
  document.querySelectorAll('[data-del-reminder]').forEach(b=> b.addEventListener('click', ()=> delReminder(b.dataset.delReminder)));
  document.querySelectorAll('[data-export]').forEach(b=> b.addEventListener('click', ()=> exportCSV(b.dataset.export)));
  document.querySelectorAll('[data-edit-lesson]').forEach(b=> b.addEventListener('click', ()=> openModal('lesson', { editId: b.dataset.editLesson })));
  document.querySelectorAll('[data-schedule-view]').forEach(b=> b.addEventListener('click', ()=>{ state.scheduleView = b.dataset.scheduleView; render(); }));
  const annSearch = document.getElementById('annSearchInput');
  if(annSearch){
    annSearch.addEventListener('input', ()=>{
      state.annFilter = annSearch.value;
      const pos = annSearch.selectionStart;
      render();
      const again = document.getElementById('annSearchInput');
      if(again){ again.focus(); again.setSelectionRange(pos, pos); }
    });
  }
  const onb = document.getElementById('onboardNextBtn');
  if(onb) onb.addEventListener('click', ()=>{ state.onboardStep = (state.onboardStep||0) + 1; render(); });
  const osk = document.getElementById('onboardSkipBtn');
  if(osk) osk.addEventListener('click', finishOnboarding);
  const ofb = document.getElementById('onboardFinishBtn');
  if(ofb) ofb.addEventListener('click', finishOnboarding);
  document.querySelectorAll('[data-edit-plan]').forEach(b=> b.addEventListener('click', ()=> openModal('plan', { editId: b.dataset.editPlan })));
  document.querySelectorAll('[data-edit-reminder]').forEach(b=> b.addEventListener('click', ()=> openModal('reminder', { editId: b.dataset.editReminder })));
  document.querySelectorAll('[data-accept-req]').forEach(b=> b.addEventListener('click', ()=> respondLinkRequest(b.dataset.acceptReq, true)));
  document.querySelectorAll('[data-decline-req]').forEach(b=> b.addEventListener('click', ()=> respondLinkRequest(b.dataset.declineReq, false)));
  document.querySelectorAll('[data-chat-parent]').forEach(b=> b.addEventListener('click', ()=> openChat(b.dataset.chatParent, b.dataset.chatParent, 'child')));
  document.querySelectorAll('[data-chat-child]').forEach(b=> b.addEventListener('click', ()=>{
    const [email,name] = b.dataset.chatChild.split('|');
    openChat(email, name, 'parent');
  }));
  document.querySelectorAll('[data-parent-add-plan]').forEach(b=> b.addEventListener('click', ()=> openModal('parentPlan', { childEmail: b.dataset.parentAddPlan })));
  document.querySelectorAll('[data-parent-add-reminder]').forEach(b=> b.addEventListener('click', ()=> openModal('parentReminder', { childEmail: b.dataset.parentAddReminder })));
  document.querySelectorAll('[data-parent-edit-plan]').forEach(b=> b.addEventListener('click', ()=>{
    const [childEmail, id] = b.dataset.parentEditPlan.split('|');
    openModal('parentPlan', { childEmail, editId: id });
  }));
  document.querySelectorAll('[data-parent-del-plan]').forEach(b=> b.addEventListener('click', ()=>{
    const [childEmail, id] = b.dataset.parentDelPlan.split('|');
    parentDeletePlan(childEmail, id);
  }));
  document.querySelectorAll('[data-parent-edit-reminder]').forEach(b=> b.addEventListener('click', ()=>{
    const [childEmail, id] = b.dataset.parentEditReminder.split('|');
    openModal('parentReminder', { childEmail, editId: id });
  }));
  document.querySelectorAll('[data-parent-del-reminder]').forEach(b=> b.addEventListener('click', ()=>{
    const [childEmail, id] = b.dataset.parentDelReminder.split('|');
    parentDeleteReminder(childEmail, id);
  }));

  const mc = document.getElementById('modalClose');
  if(mc) mc.addEventListener('click', closeModal);
  const mw = document.getElementById('modalWrap');
  if(mw) mw.addEventListener('click', (e)=>{ if(e.target.id==='modalWrap') closeModal(); });

  document.querySelectorAll('.dow-chip').forEach(c=> c.addEventListener('click', ()=> toggleDowChip(c)));

  const lf = document.getElementById('lessonForm');
  if(lf) lf.addEventListener('submit', addLesson);
  const pf = document.getElementById('planForm');
  if(pf) pf.addEventListener('submit', addPlan);
  const rf = document.getElementById('reminderForm');
  if(rf) rf.addEventListener('submit', addReminder);
  const epf = document.getElementById('editProfileForm');
  if(epf) epf.addEventListener('submit', handleEditProfileSubmit);
  const spf = document.getElementById('setPasswordForm');
  if(spf) spf.addEventListener('submit', handleSetPasswordSubmit);
  document.querySelectorAll('.viloyat-select').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const tumanSel = sel.closest('form').querySelector('.tuman-select');
      const list = HUDUDLAR[sel.value] || [];
      tumanSel.innerHTML = '<option value="">— Tanlang —</option>' + list.map(t=>`<option value="${t}">${t}</option>`).join('');
    });
  });
  document.querySelectorAll('.muassasa-turi-select').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const form = sel.closest('form');
      const nomiInput = form.querySelector('.muassasa-nomi-input');
      const h = MUASSASA_HINTS[sel.value] || MUASSASA_HINTS.maktab;
      if(nomiInput) nomiInput.placeholder = h.ph;
    });
  });
  const acf = document.getElementById('addChildForm');
  if(acf) acf.addEventListener('submit', sendLinkRequest);
  const ppf = document.getElementById('parentPlanForm');
  if(ppf) ppf.addEventListener('submit', parentAddPlan);
  const prf = document.getElementById('parentReminderForm');
  if(prf) prf.addEventListener('submit', parentAddReminder);
  const cf = document.getElementById('chatForm');
  if(cf) cf.addEventListener('submit', sendChat);
  const cl = document.querySelector('.chat-list');
  if(cl) cl.scrollTop = cl.scrollHeight;
}

boot();

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js').then((reg)=>{
      // Sahifa ochilganda har doim yangi versiya bor-yo'qligini tekshiradi.
      reg.update().catch(()=>{});
    }).catch(()=>{});
  });

  // MUHIM: yangi Service Worker faollashganda (masalan biz kodni
  // yangilaganimizda), sahifani AVTOMATIK ravishda BIR MARTA qayta
  // yuklaydi. Shu tufayli foydalanuvchi endi "DevTools > Unregister"
  // orqali qo'lda tozalashi shart emas — yangilanish o'zi ishlaydi.
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });
}
