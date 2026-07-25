// ===== Reja: asosiy ilova (o'quvchi / ota-ona / muassasa) =====

let state = {
  view: 'loading',
  authMode: 'login',
  authRole: 'talaba',
  theme: 'light',
  user: null,
  tab: 'bosh',
  data: { schedule: [], plans: [], reminders: [] },
  parentData: { children: [], requests: [], unreadByEmail: {} },
  adminData: { announcements: [] },
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
  if(sessionMem){
    const acc = await sGet('account:'+sanitizeKey(sessionMem));
    if(acc){ await loginAs(acc); return; }
  }
  state.view = 'auth';
  render();
}

async function loginAs(acc){
  state.user = acc;
  state.theme = acc.theme || 'light';
  sessionMem = acc.email;
  if(acc.role === 'talaba'){
    const [sc, pl, rm, reqs] = await Promise.all([
      sGet('schedule:'+sanitizeKey(acc.email)),
      sGet('plans:'+sanitizeKey(acc.email)),
      sGet('reminders:'+sanitizeKey(acc.email)),
      sGet('link_requests:'+sanitizeKey(acc.email))
    ]);
    state.data.schedule = sc || [];
    state.data.plans = pl || [];
    state.data.reminders = rm || [];
    state.parentData.requests = (reqs||[]).filter(r=>r.status==='pending');
    state.parentData.linkedParents = await sGet('links_child:'+sanitizeKey(acc.email)) || [];
    await computeUnread(state.parentData.linkedParents, 'child');
  } else if(acc.role === 'ota_ona'){
    await loadParentChildren();
    await computeUnread(state.parentData.children.map(c=>c.email), 'parent');
  } else if(acc.role === 'admin'){
    const key = 'announcements:'+sanitizeKey(acc.muassasaNomi||acc.email);
    state.adminData.announcements = await sGet(key) || [];
  }
  state.view = 'app';
  state.tab = defaultTab();
  render();
  startEngine();
}

function defaultTab(){
  if(state.user.role==='ota_ona') return 'p_bosh';
  if(state.user.role==='admin') return 'a_elonlar';
  return 'bosh';
}

async function computeUnread(partnerEmails, myRole){
  const lastRead = state.user.lastRead || {};
  const counts = {};
  for(const partnerEmail of partnerEmails){
    const tKey = threadKey(state.user.email, partnerEmail);
    const thread = await sGet(tKey) || [];
    const since = lastRead[tKey] || 0;
    counts[partnerEmail] = thread.filter(m=> m.from !== myRole && m.ts > since).length;
  }
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
  const childEmails = await sGet('links_parent:'+parentKey) || [];
  const children = [];
  for(const em of childEmails){
    const acc = await sGet('account:'+sanitizeKey(em));
    if(!acc) continue;
    const [sc, pl, rm] = await Promise.all([
      sGet('schedule:'+sanitizeKey(em)),
      sGet('plans:'+sanitizeKey(em)),
      sGet('reminders:'+sanitizeKey(em))
    ]);
    children.push({ email: em, acc, schedule: sc||[], plans: pl||[], reminders: rm||[] });
  }
  state.parentData.children = children;
}

async function saveAll(){
  const e = sanitizeKey(state.user.email);
  await Promise.all([
    sSet('schedule:'+e, state.data.schedule),
    sSet('plans:'+e, state.data.plans),
    sSet('reminders:'+e, state.data.reminders)
  ]);
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
  if(!ism || !email || parol.length < 4){ errBox.textContent = "Ism, email va kamida 4 belgili parolni to'ldiring."; return; }
  const key = 'account:'+sanitizeKey(email);
  const exists = await sGet(key);
  if(exists){ errBox.textContent = "Bu email allaqachon ro'yxatdan o'tgan. Kirish qiling."; return; }

  let acc = { ism, email, parol: b64(parol), role, reminderMode: 'bir_marta', createdAt: Date.now() };
  if(role === 'talaba'){
    acc.muassasa = f.muassasa.value;
    acc.muassasaNomi = f.muassasaNomi.value.trim();
    acc.sinf = f.sinf.value.trim();
  } else if(role === 'admin'){
    acc.muassasa = f.muassasaAdmin.value;
    acc.muassasaNomi = f.muassasaNomiAdmin.value.trim();
    if(!acc.muassasaNomi){ errBox.textContent = "Muassasa nomini kiriting."; return; }
  }
  await sSet(key, acc);
  await loginAs(acc);
}

async function handleLogin(e){
  e.preventDefault();
  const f = e.target;
  const email = f.email.value.trim().toLowerCase();
  const parol = f.parol.value;
  const errBox = document.getElementById('auth-err');
  const acc = await sGet('account:'+sanitizeKey(email));
  if(!acc || acc.parol !== b64(parol)){ errBox.textContent = "Email yoki parol noto'g'ri."; return; }
  await loginAs(acc);
}

async function handleGoogleCredential(payload){
  const email = (payload.email||'').trim().toLowerCase();
  const acc = await sGet('account:'+sanitizeKey(email));
  const errBox = document.getElementById('auth-err');
  if(!acc){
    if(errBox) errBox.textContent = "Bu email bilan hisob topilmadi. Avval pastda oddiy tarzda ro'yxatdan o'ting (xuddi shu email bilan).";
    return;
  }
  await loginAs(acc);
}

function logout(){
  sessionMem = null;
  if(engineTimer) clearInterval(engineTimer);
  state.user = null;
  state.view = 'auth';
  state.authMode = 'login';
  state.parentData = { children: [], requests: [], unreadByEmail: {} };
  state.adminData = { announcements: [] };
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
  if(!fan || !boshlanish || !kunlar.length){ document.getElementById('modal-err').textContent = "Fan, vaqt va kamida bitta kunni tanlang."; return; }
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
  if(!nom || !sana){ document.getElementById('modal-err').textContent = "Nom va sanani kiriting."; return; }
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
  if(!matn || !sana || !vaqt){ document.getElementById('modal-err').textContent = "Matn, sana va vaqtni kiriting."; return; }
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
  if(!childEmail){ errBox.textContent = "Farzandingizning emailini kiriting."; return; }
  const childAcc = await sGet('account:'+sanitizeKey(childEmail));
  if(!childAcc || childAcc.role !== 'talaba'){ errBox.textContent = "Bu email bilan o'quvchi/talaba hisobi topilmadi."; return; }
  const reqKey = 'link_requests:'+sanitizeKey(childEmail);
  const reqs = await sGet(reqKey) || [];
  if(reqs.some(r=> r.parentEmail===state.user.email && r.status==='pending')){ errBox.textContent = "So'rov allaqachon yuborilgan, javobni kuting."; return; }
  const parentKey = sanitizeKey(state.user.email);
  const already = await sGet('links_parent:'+parentKey) || [];
  if(already.includes(childEmail)){ errBox.textContent = "Bu farzand allaqachon bog'langan."; return; }
  reqs.push({ id: uid(), parentEmail: state.user.email, parentName: state.user.ism, status:'pending', createdAt: Date.now() });
  await sSet(reqKey, reqs);
  closeModal();
  showToast("So'rov yuborildi. Farzandingiz tasdiqlashini kuting.");
}

async function respondLinkRequest(reqId, accept){
  const selfKey = sanitizeKey(state.user.email);
  const reqKey = 'link_requests:'+selfKey;
  const reqs = await sGet(reqKey) || [];
  const req = reqs.find(r=>r.id===reqId);
  if(!req) return;
  req.status = accept ? 'accepted' : 'declined';
  await sSet(reqKey, reqs);
  if(accept){
    const linkedChild = await sGet('links_child:'+selfKey) || [];
    if(!linkedChild.includes(req.parentEmail)) linkedChild.push(req.parentEmail);
    await sSet('links_child:'+selfKey, linkedChild);
    state.parentData.linkedParents = linkedChild;

    const parentKey = sanitizeKey(req.parentEmail);
    const linkedByParent = await sGet('links_parent:'+parentKey) || [];
    if(!linkedByParent.includes(state.user.email)) linkedByParent.push(state.user.email);
    await sSet('links_parent:'+parentKey, linkedByParent);
  }
  state.parentData.requests = reqs.filter(r=>r.status==='pending');
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
  if(!nom || !sana){ errBox.textContent = "Nom va sanani kiriting."; return; }
  const key = 'plans:'+sanitizeKey(childEmail);
  const plans = await sGet(key) || [];
  if(editId){
    const p = plans.find(x=>x.id===editId);
    if(p) Object.assign(p, { turi, nom, sana, izoh });
  } else {
    plans.push({ id: uid(), turi, nom, sana, izoh, ota_onadan: true, kimdan: state.user.ism, kimdanEmail: state.user.email });
  }
  plans.sort((a,b)=>a.sana.localeCompare(b.sana));
  await sSet(key, plans);
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
  if(!matn || !sana || !vaqt){ errBox.textContent = "Matn, sana va vaqtni kiriting."; return; }
  const key = 'reminders:'+sanitizeKey(childEmail);
  const rems = await sGet(key) || [];
  if(editId){
    const r = rems.find(x=>x.id===editId);
    if(r) Object.assign(r, { matn, sana, vaqt, takrorlanish });
  } else {
    rems.push({ id: uid(), matn, sana, vaqt, takrorlanish, ota_onadan: true, kimdan: state.user.ism, kimdanEmail: state.user.email });
  }
  rems.sort((a,b)=>(a.sana+a.vaqt).localeCompare(b.sana+b.vaqt));
  await sSet(key, rems);
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
  await sSet(tKey, thread);
  state.modal.thread = thread;
  f.reset();
  render();
  setTimeout(()=>{ const cl = document.querySelector('.chat-list'); if(cl) cl.scrollTop = cl.scrollHeight; }, 30);
}

async function postAnnouncement(e){
  e.preventDefault();
  const f = e.target;
  const matn = f.matn.value.trim();
  const errBox = document.getElementById('modal-err');
  if(!matn){ errBox.textContent = "E'lon matnini kiriting."; return; }
  const key = 'announcements:'+sanitizeKey(state.user.muassasaNomi);
  const editId = state.modal.editId;
  let list = await sGet(key) || [];
  if(editId){
    const a = list.find(x=>x.id===editId);
    if(a) a.matn = matn;
  } else {
    list.unshift({ id: uid(), matn, sana: todayISO(), adminName: state.user.ism });
  }
  await sSet(key, list);
  state.adminData.announcements = list;
  closeModal();
  showToast(editId ? "E'lon yangilandi." : "E'lon joylandi.");
}

async function delAnnouncement(id){
  const key = 'announcements:'+sanitizeKey(state.user.muassasaNomi);
  state.adminData.announcements = state.adminData.announcements.filter(a=>a.id!==id);
  await sSet(key, state.adminData.announcements);
  render();
}

function render(){
  applyTheme();
  const app = document.getElementById('app');
  if(state.view === 'loading'){ app.innerHTML = ''; return; }
  if(state.view === 'auth'){ app.innerHTML = renderAuth(); attachAuthHandlers(); return; }
  app.innerHTML = renderApp();
  attachAppHandlers();
}

function renderAuth(){
  const isLogin = state.authMode === 'login';
  const role = state.authRole;
  return `
  <div style="padding:40px 22px 30px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div class="brand" style="font-size:26px;margin-bottom:2px;">Re<em>ja</em></div>
      <button class="theme-toggle" id="themeToggleBtn" title="Kun/tun rejimi">${svgIcon(state.theme==='dark'?'sun':'moon')}</button>
    </div>
    <p style="margin-bottom:24px;">Dars jadvali, rejalar, eslatmalar — va oila bilan bog'lanish, bir joyda.</p>
    <div class="sheet sheet-ruled">
      <div class="eyebrow">${isLogin? 'Kirish' : "Ro'yxatdan o'tish"}</div>
      ${isLogin ? `<div id="googleSigninContainer" style="margin-bottom:14px;display:flex;justify-content:center;"></div>
      <div style="text-align:center;color:var(--ink-soft);font-size:11.5px;margin:-6px 0 14px;">— yoki email bilan —</div>` : ''}
      ${isLogin ? `
      <form id="loginForm">
        <label>Email</label>
        <input type="email" name="email" placeholder="ism@misol.uz" required>
        <label>Parol</label>
        <input type="password" name="parol" placeholder="Parolingiz" required>
        <div id="auth-err" class="err"></div>
        <button class="btn-primary" type="submit">Kirish</button>
      </form>
      <button class="btn-ghost" id="toRegister" style="margin-top:12px;">Hisobingiz yo'qmi? Ro'yxatdan o'ting</button>
      ` : `
      <label style="margin-top:0;">Kim sifatida ro'yxatdan o'tasiz?</label>
      <div class="segrow">
        <button type="button" class="seg role-btn ${role==='talaba'?'on':''}" data-role="talaba">O'quvchi / talaba</button>
        <button type="button" class="seg role-btn ${role==='ota_ona'?'on':''}" data-role="ota_ona">Ota-ona</button>
        <button type="button" class="seg role-btn ${role==='admin'?'on':''}" data-role="admin">Muassasa</button>
      </div>
      <form id="registerForm">
        <label>Ism va familiya</label>
        <input type="text" name="ism" placeholder="Ism Familiya" required>
        <label>Email</label>
        <input type="email" name="email" placeholder="ism@misol.uz" required>
        <label>Parol</label>
        <input type="password" name="parol" placeholder="Kamida 4 ta belgi" required>
        ${role==='talaba' ? `
        <label>Ta'lim muassasasi turi</label>
        <select name="muassasa">
          <option value="maktab">Maktab</option>
          <option value="litsey">Akademik litsey</option>
          <option value="kasb-hunar">Kasb-hunar maktabi</option>
          <option value="universitet">Universitet / institut</option>
        </select>
        <label>Muassasa nomi (ixtiyoriy)</label>
        <input type="text" name="muassasaNomi" placeholder="Masalan: 21-maktab">
        <label>Sinf / kurs (ixtiyoriy)</label>
        <input type="text" name="sinf" placeholder="Masalan: 9-sinf yoki 2-kurs">
        ` : ''}
        ${role==='admin' ? `
        <label>Muassasa turi</label>
        <select name="muassasaAdmin">
          <option value="maktab">Maktab</option>
          <option value="litsey">Akademik litsey</option>
          <option value="kasb-hunar">Kasb-hunar maktabi</option>
          <option value="universitet">Universitet / institut</option>
        </select>
        <label>Muassasa nomi</label>
        <input type="text" name="muassasaNomiAdmin" placeholder="Masalan: 21-maktab" required>
        <div class="note" style="margin-top:8px;">O'quvchilaringiz ro'yxatdan o'tishda xuddi shu nomni kiritishi kerak — shundagina e'lonlaringizni ko'rishadi.</div>
        ` : ''}
        <div id="auth-err" class="err"></div>
        <button class="btn-primary" type="submit">Ro'yxatdan o'tish</button>
      </form>
      <button class="btn-ghost" id="toLogin" style="margin-top:12px;">Hisobingiz bormi? Kiring</button>
      `}
      <div class="note">Bu — dastlabki versiya (prototip). Ma'lumotlar oddiy bulutli xotirada saqlanadi, bank darajasidagi shifrlash emas — shuning uchun juda maxfiy parol ishlatmang.</div>
    </div>
  </div>`;
}

function attachAuthHandlers(){
  const lf = document.getElementById('loginForm');
  const rf = document.getElementById('registerForm');
  if(lf) lf.addEventListener('submit', handleLogin);
  if(rf) rf.addEventListener('submit', handleRegister);
  const tr = document.getElementById('toRegister');
  const tl = document.getElementById('toLogin');
  if(tr) tr.addEventListener('click', ()=>{ state.authMode='register'; render(); });
  if(tl) tl.addEventListener('click', ()=>{ state.authMode='login'; render(); });
  document.querySelectorAll('.role-btn').forEach(b=> b.addEventListener('click', ()=> setAuthRole(b.dataset.role)));
  const ttb = document.getElementById('themeToggleBtn');
  if(ttb) ttb.addEventListener('click', toggleTheme);
  if(state.authMode === 'login' && document.getElementById('googleSigninContainer')){
    renderGoogleButton('googleSigninContainer', handleGoogleCredential);
  }
}

function renderApp(){
  return `
  ${state.toast ? `<div class="toast"><span>${escapeHtml(state.toast)}</span></div>` : ''}
  <div class="topbar">
    <div class="brand">Re<em>ja</em></div>
    <div class="topbar-right">
      <button class="theme-toggle" id="themeToggleBtn" title="Kun/tun rejimi">${svgIcon(state.theme==='dark'?'sun':'moon')}</button>
      <button class="userchip" id="userchipBtn">${escapeHtml(state.user.ism.split(' ')[0])} ⌄</button>
    </div>
  </div>
  ${renderTabContent()}
  ${state.modal ? renderModal() : ''}
  ${renderFab()}
  ${renderTabs()}
  `;
}

function renderFab(){
  if(state.user.role==='talaba' && ['jadval','rejalar','eslatma'].includes(state.tab)){
    return `<button class="fab" id="fabBtn" aria-label="Qo'shish">+</button>`;
  }
  if(state.user.role==='admin' && state.tab==='a_elonlar'){
    return `<button class="fab" id="fabBtn" aria-label="E'lon qo'shish">+</button>`;
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
      <button class="tab ${state.tab==='bosh'?'active':''}" data-tab="bosh">${svgIcon('home')}<span>Bosh sahifa</span></button>
      <button class="tab ${state.tab==='jadval'?'active':''}" data-tab="jadval">${svgIcon('cal')}<span>Jadval</span></button>
      <button class="tab ${state.tab==='rejalar'?'active':''}" data-tab="rejalar">${svgIcon('plan')}<span>Rejalar</span></button>
      <button class="tab ${state.tab==='eslatma'?'active':''}" data-tab="eslatma">${svgIcon('bell')}<span>Eslatmalar</span></button>
      <button class="tab ${state.tab==='profil'?'active':''}" data-tab="profil">${hasDot?'<span class="dot"></span>':''}${svgIcon('user')}<span>Profil</span></button>
    </div>`;
  }
  if(state.user.role==='ota_ona'){
    const unreadTotal = Object.values(state.parentData.unreadByEmail||{}).reduce((a,b)=>a+b,0);
    return `
    <div class="tabs">
      <button class="tab ${state.tab==='p_bosh'?'active':''}" data-tab="p_bosh">${svgIcon('home')}<span>Bosh sahifa</span></button>
      <button class="tab ${state.tab==='p_farzandlar'?'active':''}" data-tab="p_farzandlar">${unreadTotal?'<span class="dot"></span>':''}${svgIcon('users')}<span>Farzandlar</span></button>
      <button class="tab ${state.tab==='profil'?'active':''}" data-tab="profil">${svgIcon('user')}<span>Profil</span></button>
    </div>`;
  }
  if(state.user.role==='admin'){
    return `
    <div class="tabs">
      <button class="tab ${state.tab==='a_elonlar'?'active':''}" data-tab="a_elonlar">${svgIcon('speaker')}<span>E'lonlar</span></button>
      <button class="tab ${state.tab==='profil'?'active':''}" data-tab="profil">${svgIcon('user')}<span>Profil</span></button>
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
  if(r==='admin'){
    if(state.tab==='a_elonlar') return renderAdminAnnouncements();
    if(state.tab==='profil') return renderProfile();
  }
  return '';
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
  ${renderStudentAnnouncements()}
  <div class="sheet">
    <div class="eyebrow">Eslatma rejimi</div>
    <p style="margin-bottom:8px;">${state.user.reminderMode==='har_dars' ? 'Har darsdan 5 daqiqa oldin eslatiladi.' : "Kuniga bir marta, ertalab bugungi darslar haqida eslatiladi."}</p>
    <button class="btn-small" id="goProfileBtn">Sozlamalarni o'zgartirish →</button>
  </div>
  `;
}

function renderStudentAnnouncements(){
  if(!state.user.muassasaNomi) return '';
  const list = state.data._announcements || [];
  if(!list.length) return '';
  return `
  <div class="sheet sheet-plum">
    <div class="eyebrow">${escapeHtml(state.user.muassasaNomi)} — e'lonlar</div>
    ${list.slice(0,4).map(a=>`<div class="plan-item"><div class="item-title">${escapeHtml(a.matn)}</div><div class="item-meta">${fmtDate(a.sana)} · ${escapeHtml(a.adminName)}</div></div>`).join('')}
  </div>`;
}

function renderSchedule(){
  const grouped = KUN_FULL.map((name,i)=> ({ name, i, lessons: state.data.schedule.filter(l=>l.kunlar.includes(i)).sort((a,b)=>a.boshlanish.localeCompare(b.boshlanish)) }));
  return `
  <div class="sheet">
    <div class="eyebrow">Haftalik dars jadvali</div>
    ${grouped.map(g=> g.lessons.length ? `
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
    ` : '').join('') || `<div class="empty">${svgIcon('cal')}<div>Hali dars qo'shilmagan. Pastdagi + tugmasi orqali qo'shing.</div></div>`}
  </div>`;
}

function renderPlans(){
  return `
  <div class="sheet">
    <div class="eyebrow">Kunlik / oylik / yillik rejalar</div>
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
    <div class="eyebrow">Eslatmalar</div>
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
      <label style="margin-top:16px;">Brauzer bildirishnomasi</label>
      <button class="btn-small" id="notifPermBtn">${(window.Notification && Notification.permission==='granted') ? 'Yoqilgan ✓' : 'Ruxsat berish'}</button>
    </div>
    <button class="btn-small btn-danger" id="logoutBtn" style="margin:0 16px;width:calc(100% - 32px);">Chiqish</button>
    `;
  }
  if(u.role==='ota_ona'){
    return `
    <div class="sheet">
      <div class="eyebrow">Profil</div>
      <h3 style="margin-bottom:2px;">${escapeHtml(u.ism)}</h3>
      <p>${escapeHtml(u.email)} · Ota-ona hisobi</p>
    </div>
    <div class="sheet">
      <div class="eyebrow">Farzand qo'shish</div>
      <p>Farzandingiz avval o'zi ro'yxatdan o'tgan bo'lishi kerak. Uning emailini kiritib so'rov yuboring, u tasdiqlagach bog'lanasiz.</p>
      <button class="btn-small btn-plum" id="addChildBtn2">Farzand qo'shish</button>
    </div>
    <button class="btn-small btn-danger" id="logoutBtn" style="margin:0 16px;width:calc(100% - 32px);">Chiqish</button>
    `;
  }
  if(u.role==='admin'){
    return `
    <div class="sheet">
      <div class="eyebrow">Profil</div>
      <h3 style="margin-bottom:2px;">${escapeHtml(u.ism)}</h3>
      <p style="margin-bottom:2px;">${escapeHtml(u.email)}</p>
      <p>${MUASSASA_LABEL[u.muassasa]||''} · ${escapeHtml(u.muassasaNomi)}</p>
      <div class="note">O'quvchilar ro'yxatdan o'tishda "${escapeHtml(u.muassasaNomi)}" nomini kiritishsa, sizning e'lonlaringizni ko'radi.</div>
    </div>
    <button class="btn-small btn-danger" id="logoutBtn" style="margin:0 16px;width:calc(100% - 32px);">Chiqish</button>
    `;
  }
  return '';
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
          <div class="item-title">${escapeHtml(c.acc.ism)}</div>
        </div>
        ${lessons.length ? `<div class="item-meta">Bugun ${lessons.length} ta dars: ${lessons.map(l=>l.boshlanish+' '+l.fan).join(', ')}</div>` : `<div class="item-meta">Bugun dars kiritilmagan.</div>`}
      </div>`;
    }).join('') : `<div class="empty">${svgIcon('users')}<div>Hali farzand bog'lanmagan. Profil orqali qo'shing.</div></div>`}
  </div>
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
          <div class="item-meta">${MUASSASA_LABEL[c.acc.muassasa]||''} ${c.acc.sinf?'· '+escapeHtml(c.acc.sinf):''}</div>
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
              </div>` : `<span class="badge">${escapeHtml(c.acc.ism.split(' ')[0])}dan</span>`}
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
              </div>` : `<span class="badge">${escapeHtml(c.acc.ism.split(' ')[0])}dan</span>`}
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

function renderAdminAnnouncements(){
  const list = state.adminData.announcements || [];
  return `
  <div class="sheet sheet-plum">
    <div class="eyebrow">${escapeHtml(state.user.muassasaNomi)} — e'lonlar</div>
    ${list.length ? list.map(a=>`
      <div class="plan-item">
        <div class="item-top">
          <div><div class="item-title">${escapeHtml(a.matn)}</div><div class="item-meta">${fmtDate(a.sana)}</div></div>
          <div style="display:flex;gap:4px;">
            <button class="del" data-edit-announcement="${a.id}" title="Tahrirlash">✎</button>
            <button class="del" data-del-announcement="${a.id}">✕</button>
          </div>
        </div>
      </div>
    `).join('') : `<div class="empty">${svgIcon('speaker')}<div>Hali e'lon joylanmagan. Pastdagi + tugmasi orqali qo'shing.</div></div>`}
  </div>`;
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
        <label>Fan nomi</label>
        <input type="text" name="fan" placeholder="Masalan: Matematika" value="${l?escapeHtml(l.fan):''}" required>
        <div class="row2">
          <div><label>Boshlanish</label><input type="time" name="boshlanish" value="${l?l.boshlanish:''}" required></div>
          <div><label>Tugash</label><input type="time" name="tugash" value="${l&&l.tugash?l.tugash:''}"></div>
        </div>
        <label>Xona / auditoriya (ixtiyoriy)</label>
        <input type="text" name="xona" placeholder="Masalan: 204-xona" value="${l&&l.xona?escapeHtml(l.xona):''}">
        <label>Hafta kunlari</label>
        <div class="chipset">
          ${KUN.map((k,i)=>`<span class="chip dow-chip ${l&&l.kunlar.includes(i)?'on':''}" data-i="${i}">${k}</span>`).join('')}
        </div>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary" type="submit">${editing?'Yangilash':'Saqlash'}</button>
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
        <label>Turi</label>
        <select name="turi">
          ${opt('kunlik','Kunlik')}${opt('haftalik','Haftalik')}${opt('oylik','Oylik')}${opt('yillik','Yillik')}
        </select>
        <label>Reja nomi</label>
        <input type="text" name="nom" placeholder="Masalan: Nazorat ishiga tayyorgarlik" value="${p?escapeHtml(p.nom):''}" required>
        <label>Sana</label>
        <input type="date" name="sana" value="${p?p.sana:''}" required>
        <label>Izoh (ixtiyoriy)</label>
        <textarea name="izoh" rows="2" placeholder="Qo'shimcha tafsilotlar">${p&&p.izoh?escapeHtml(p.izoh):''}</textarea>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary" type="submit">${editing?'Yangilash':'Saqlash'}</button>
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
        <label>Nima haqida eslatilsin</label>
        <input type="text" name="matn" placeholder="Masalan: Kitobni qaytarish" value="${r?escapeHtml(r.matn):''}" required>
        <div class="row2">
          <div><label>Sana</label><input type="date" name="sana" value="${r?r.sana:''}" required></div>
          <div><label>Vaqt</label><input type="time" name="vaqt" value="${r?r.vaqt:''}" required></div>
        </div>
        <label>Takrorlanish</label>
        <select name="takrorlanish">
          ${opt('bir_marta','Bir marta')}${opt('kunlik','Har kuni')}${opt('haftalik','Har hafta')}${opt('oylik','Har oy')}${opt('yillik','Har yili')}
        </select>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary" type="submit">${editing?'Yangilash':'Saqlash'}</button>
      </form>
    </div>
  </div>`;
  }
  if(k==='addChild') return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>Farzand qo'shish</h3><button class="close-x" id="modalClose">✕</button></div>
      <form id="addChildForm">
        <label>Farzandingizning emaili</label>
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
        <label>Turi</label>
        <select name="turi">
          ${opt('kunlik','Kunlik')}${opt('haftalik','Haftalik')}${opt('oylik','Oylik')}${opt('yillik','Yillik')}
        </select>
        <label>Reja nomi</label>
        <input type="text" name="nom" placeholder="Masalan: Repetitorga borish" value="${p?escapeHtml(p.nom):''}" required>
        <label>Sana</label>
        <input type="date" name="sana" value="${p?p.sana:''}" required>
        <label>Izoh (ixtiyoriy)</label>
        <textarea name="izoh" rows="2">${p&&p.izoh?escapeHtml(p.izoh):''}</textarea>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary btn-plum" type="submit">${editing?'Yangilash':'Saqlash'}</button>
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
        <label>Nima haqida eslatilsin</label>
        <input type="text" name="matn" placeholder="Masalan: Sport mashg'ulotiga borish" value="${r?escapeHtml(r.matn):''}" required>
        <div class="row2">
          <div><label>Sana</label><input type="date" name="sana" value="${r?r.sana:''}" required></div>
          <div><label>Vaqt</label><input type="time" name="vaqt" value="${r?r.vaqt:''}" required></div>
        </div>
        <label>Takrorlanish</label>
        <select name="takrorlanish">
          ${opt('bir_marta','Bir marta')}${opt('kunlik','Har kuni')}${opt('haftalik','Har hafta')}${opt('oylik','Har oy')}${opt('yillik','Har yili')}
        </select>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary btn-plum" type="submit">${editing?'Yangilash':'Saqlash'}</button>
      </form>
    </div>
  </div>`;
  }
  if(k==='announcement'){
    const editing = !!state.modal.editId;
    const a = editing ? state.adminData.announcements.find(x=>x.id===state.modal.editId) : null;
    return `
  <div class="modal-wrap" id="modalWrap">
    <div class="modal">
      <div class="modal-head"><h3>${editing?"E'lonni tahrirlash":"E'lon joylash"}</h3><button class="close-x" id="modalClose">✕</button></div>
      <form id="announcementForm">
        <label>Matn</label>
        <textarea name="matn" rows="4" placeholder="Barcha o'quvchilarga xabar..." required>${a?escapeHtml(a.matn):''}</textarea>
        <div id="modal-err" class="err"></div>
        <button class="btn-primary" type="submit">${editing?'Yangilash':'Joylash'}</button>
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
  document.querySelectorAll('.tab').forEach(t=> t.addEventListener('click', ()=> switchTab(t.dataset.tab)));
  const fab = document.getElementById('fabBtn');
  if(fab) fab.addEventListener('click', ()=>{
    if(state.user.role==='talaba'){
      const map = { jadval:'lesson', rejalar:'plan', eslatma:'reminder' };
      openModal(map[state.tab] || 'reminder');
    } else if(state.user.role==='admin'){
      openModal('announcement');
    } else if(state.user.role==='ota_ona'){
      openModal('addChild');
    }
  });
  const uc = document.getElementById('userchipBtn');
  if(uc) uc.addEventListener('click', ()=> switchTab('profil'));
  const ttb = document.getElementById('themeToggleBtn');
  if(ttb) ttb.addEventListener('click', toggleTheme);
  const gp = document.getElementById('goProfileBtn');
  if(gp) gp.addEventListener('click', ()=> switchTab('profil'));
  const gc = document.getElementById('goChildrenBtn');
  if(gc) gc.addEventListener('click', ()=> switchTab('p_farzandlar'));
  const lb = document.getElementById('logoutBtn');
  if(lb) lb.addEventListener('click', logout);
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
  document.querySelectorAll('[data-del-announcement]').forEach(b=> b.addEventListener('click', ()=> delAnnouncement(b.dataset.delAnnouncement)));
  document.querySelectorAll('[data-edit-lesson]').forEach(b=> b.addEventListener('click', ()=> openModal('lesson', { editId: b.dataset.editLesson })));
  document.querySelectorAll('[data-edit-plan]').forEach(b=> b.addEventListener('click', ()=> openModal('plan', { editId: b.dataset.editPlan })));
  document.querySelectorAll('[data-edit-reminder]').forEach(b=> b.addEventListener('click', ()=> openModal('reminder', { editId: b.dataset.editReminder })));
  document.querySelectorAll('[data-edit-announcement]').forEach(b=> b.addEventListener('click', ()=> openModal('announcement', { editId: b.dataset.editAnnouncement })));
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
  const acf = document.getElementById('addChildForm');
  if(acf) acf.addEventListener('submit', sendLinkRequest);
  const ppf = document.getElementById('parentPlanForm');
  if(ppf) ppf.addEventListener('submit', parentAddPlan);
  const prf = document.getElementById('parentReminderForm');
  if(prf) prf.addEventListener('submit', parentAddReminder);
  const anf = document.getElementById('announcementForm');
  if(anf) anf.addEventListener('submit', postAnnouncement);
  const cf = document.getElementById('chatForm');
  if(cf) cf.addEventListener('submit', sendChat);
  const cl = document.querySelector('.chat-list');
  if(cl) cl.scrollTop = cl.scrollHeight;
}

async function loadStudentAnnouncements(){
  if(state.user && state.user.role==='talaba' && state.user.muassasaNomi){
    const key = 'announcements:'+sanitizeKey(state.user.muassasaNomi);
    state.data._announcements = await sGet(key) || [];
    render();
  }
}

boot().then(()=>{ if(state.user && state.user.role==='talaba') loadStudentAnnouncements(); });

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  });
}

