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

async function sGet(key){ try{ const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; }catch(e){ return null; } }

async function sSet(key, val){ try{ return await window.storage.set(key, JSON.stringify(val), true); }catch(e){ console.error(e); return null; } }

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
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/></svg>'
  };
  return icons[name]||'';
}


// ===== Google orqali kirish (Google Sign-In) =====
// MUHIM: bu yerga Google Cloud Console'da yaratgan haqiqiy OAuth Client ID'ni qo'ying.
// Ko'rsatma: https://console.cloud.google.com -> APIs & Services -> Credentials -> Create OAuth client ID -> Web application
// Authorized JavaScript origins qismiga saytingiz manzilini qo'shing (masalan https://username.github.io)
const GOOGLE_CLIENT_ID = '331359116271-ru7hpjlf4hnevjedp8u02v70ras5tu8d.apps.googleusercontent.com';

function decodeJwt(token){
  try{
    const payload = token.split('.')[1];
    const json = decodeURIComponent(atob(payload.replace(/-/g,'+').replace(/_/g,'/')).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  }catch(e){ return null; }
}

let _googleInited = false;
function renderGoogleButton(containerId, onCredential){
  if(!window.google || !window.google.accounts || !window.google.accounts.id) return;
  if(GOOGLE_CLIENT_ID.indexOf('YOUR_GOOGLE_CLIENT_ID') === 0) return;
  if(!_googleInited){
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp)=>{
        const payload = decodeJwt(resp.credential);
        if(payload) onCredential(payload);
      }
    });
    _googleInited = true;
  }
  const el = document.getElementById(containerId);
  if(el){
    el.innerHTML = '';
    google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: 280, locale: 'uz' });
  }
}
