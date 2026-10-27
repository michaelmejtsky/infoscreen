'use strict';
const $=id=>document.getElementById(id);
const state={api:String(window.OVD_API_URL||'').trim().replace(/\/+$/,''),token:localStorage.getItem('ovd_session')||'',data:null,filter:'mine',pending:null,installPrompt:null,busy:false};
const escapeHTML=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(msg){const x=$('toast');x.textContent=msg;x.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>x.classList.remove('show'),4500)}
function fmt(d,opts){const val=String(d||'');const dt=val.length===10?new Date(val+'T12:00:00'):new Date(val);if(isNaN(+dt))return val||'–';return new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',...opts}).format(dt)}
const dateText=d=>fmt(d,{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
const timeText=d=>fmt(d,{hour:'2-digit',minute:'2-digit'});
function status(ok,msg){$('conn-indicator').classList.toggle('ok',ok);$('conn-label').textContent=msg||'App'}
async function call(action,values={}){
 if(!state.api)throw Error('OVD-Serververbindung noch nicht eingerichtet.');
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),25000);
 try{
  const r=await fetch(state.api+'/api',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:ctl.signal,body:JSON.stringify({action,token:state.token,...values})});
  let json;try{json=await r.json()}catch{throw Error('Antwort vom OVD-Server ist ungültig.')}
  if(!r.ok||!json.ok){if(json.code==='AUTH')signOut(false);throw Error(json.error||'Die Anfrage ist fehlgeschlagen.')}
  status(true,'Verbunden');return json.data;
 }catch(e){status(false,'Verbindung prüfen');if(e.name==='AbortError')throw Error('Der OVD-Server antwortet zu langsam.');throw e}finally{clearTimeout(timeout)}
}
function section(name){['setup','auth','app'].forEach(id=>$(id).hidden=id!==name);$('nav').hidden=name!=='app'}
function signOut(message=true){state.token='';state.data=null;localStorage.removeItem('ovd_session');section('auth');if(message)notify('Erfolgreich abgemeldet.')}
function bootstrap(){if(!state.api){section('app');$('connection-notice').hidden=false;$('current-ovd').textContent='Noch nicht verbunden';$('next-time').textContent='Live-Dienste nach Serverfreigabe verfügbar';$('profile-name').textContent='OVD-App';$('push-button').disabled=true;$('logout').hidden=true;showView('home');empty($('home-duties'),'Die Dienste werden nach der Serverfreigabe automatisch geladen.');empty($('duties-list'),'Die Dienstübersicht ist noch nicht verbunden.');empty($('swaps-list'),'Tauschanfragen sind noch nicht verbunden.');status(false,'Einrichtung ausständig');return;} $('connection-notice').hidden=true;$('push-button').disabled=false;$('logout').hidden=false;if(!state.token)return section('auth');section('app');showView(['home','duties','swaps','profile'].includes(location.hash.slice(1))?location.hash.slice(1):'home');refresh()}
async function refresh(){if(!state.token||state.busy)return;state.busy=true;try{state.data=await call('snapshot');render()}catch(e){notify(e.message)}finally{state.busy=false}}
function showView(view){
 ['home','duties','swaps','profile'].forEach(x=>$(x+'-panel').hidden=x!==view);
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===view));
 history.replaceState({},'',location.pathname+'#'+view);
 if(view==='profile')refreshPushState();
}
function empty(host,content){host.textContent='';const x=document.createElement('div');x.className='empty';x.textContent=content;host.append(x)}
function render(){
 const data=state.data;if(!data)return;
 const me=data.me||{};$('greeting').textContent=me.first||'OVD';$('current-ovd').textContent=data.current||'Derzeit nicht eingetragen';$('profile-name').textContent=me.name||'OVD';
 $('avatar').textContent=(me.first||'O').slice(0,1)+(me.last||'V').slice(0,1);
 const mine=(data.duties||[]).filter(x=>x.mine&&new Date(x.end)>new Date()).sort((a,b)=>a.start.localeCompare(b.start));
 const next=mine[0];$('next-day').textContent=next?dateText(next.date):'–';$('next-time').textContent=next?timeText(next.start)+'–'+timeText(next.end)+' Uhr':'Kein Dienst geplant';
 const incoming=(data.swaps||[]).filter(x=>x.incoming&&x.status==='PENDING').length;
 $('pending-count').textContent=String(incoming);$('nav-badge').hidden=!incoming;
 drawDuties($('home-duties'),mine.slice(0,4),true);
 drawDuties($('duties-list'),(data.duties||[]).filter(x=>state.filter==='all'||x.mine),false);
 drawSwaps(data.swaps||[]);
}
function drawDuties(host,items,short){
 host.replaceChildren();if(!items.length)return empty(host,short?'Aktuell sind keine eigenen OVD-Dienste eingetragen.':'Für diese Auswahl gibt es keine Dienste.');
 items.slice(0,short?4:200).forEach(d=>{
  const el=document.createElement('article');el.className='duty';
  el.innerHTML='<div class="datebox"><b>'+escapeHTML(fmt(d.date,{day:'2-digit'}))+'</b><small>'+escapeHTML(fmt(d.date,{month:'short'}))+'</small></div>'+
  '<div class="duty-text"><strong>'+escapeHTML(d.name)+'</strong><p>'+escapeHTML(timeText(d.start)+' – '+timeText(d.end))+' Uhr</p>'+
  (d.split?'<em>Geteilter Dienst</em>':'')+(d.swapping?'<br><span class="badge waiting">Tauschanfrage offen</span>':'')+'</div>';
  if(d.mine&&!d.swapping&&!d.uncertain&&new Date(d.start).getTime()>Date.now()){
   const b=document.createElement('button');b.type='button';b.className='btn outline';b.textContent='Tauschen';b.onclick=()=>openSwap(d);el.append(b)
  }host.append(el);
 });
}
function drawSwaps(items){
 const host=$('swaps-list');host.replaceChildren();
 if(!items.length)return empty(host,'Keine Tauschanfragen vorhanden.');
 items.slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).forEach(x=>{
  const names=escapeHTML(x.from)+' → '+escapeHTML(x.to);
  const label=x.status==='PENDING'?'Wartet auf Bestätigung':x.status==='ACCEPTED'?'Übernommen':x.status==='DECLINED'?'Abgelehnt':x.status==='CANCELLED'?'Zurückgezogen':x.status==='PROCESSING'?'Wird übertragen':'Bitte prüfen';
  const el=document.createElement('article');el.className='swap';
  el.innerHTML='<h3>'+escapeHTML(dateText(x.date))+'</h3> <span class="badge '+(x.status==='PENDING'?'waiting':x.status==='DECLINED'?'declined':'')+'">'+escapeHTML(label)+'</span>'+
   '<p class="muted">'+names+'</p><div class="small muted">'+escapeHTML(timeText(x.start)+' – '+timeText(x.end))+' Uhr · '+(x.incoming?'An dich gerichtet':'Von dir angefragt')+'</div>';
  if(x.status==='PENDING'){
   const bar=document.createElement('div');bar.className='swap-actions';
   if(x.incoming){bar.append(makeButton('Dienst übernehmen','primary',()=>respond(x.id,'accept')),makeButton('Ablehnen','ghost',()=>respond(x.id,'decline')))}
   else{bar.append(makeButton('Zurückziehen','ghost',()=>respond(x.id,'cancel')))}
   el.append(bar);
  }host.append(el);
 });
}
function makeButton(label,cl,handler){const b=document.createElement('button');b.type='button';b.className='btn '+cl;b.textContent=label;b.onclick=handler;return b}
function openSwap(d){
 state.pending=d.id;$('swap-info').textContent=dateText(d.date)+' · '+timeText(d.start)+'–'+timeText(d.end)+' Uhr';
 const sel=$('target-person');sel.replaceChildren();sel.add(new Option('OVD auswählen …',''));
 (state.data?.people||[]).filter(p=>p.id!==state.data.me.id).forEach(p=>sel.add(new Option(p.name,p.id)));
 $('swap-dialog').showModal();
}
async function respond(id,decision){
 if(decision==='accept'&&!confirm('Den OVD-Dienst verbindlich übernehmen?'))return;
 try{await call('swapRespond',{id,decision});notify(decision==='accept'?'OVD-Dienst erfolgreich übernommen.':decision==='decline'?'Anfrage abgelehnt.':'Anfrage zurückgezogen.');await refresh()}catch(e){notify(e.message)}
}
function fromBase64Url(s){const t=s.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(t+'='.repeat((4-t.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function enablePush(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return notify('Push-Benachrichtigungen werden auf diesem Gerät nicht unterstützt.');
 try{
  const config=await call('config');if(!config?.vapidPublicKey)throw Error('Der Push-Dienst ist am Server noch nicht aktiviert.');
  const reg=await navigator.serviceWorker.ready;
  const perm=await Notification.requestPermission();if(perm!=='granted')throw Error('Benachrichtigungen wurden nicht freigegeben.');
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:fromBase64Url(config.vapidPublicKey)});
  await call('pushSubscribe',{subscription:sub.toJSON()});notify('Push auf diesem Gerät aktiviert.');refreshPushState()
 }catch(e){notify(e.message)}
}
async function refreshPushState(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window)){$('push-state').textContent='Auf diesem Gerät nicht verfügbar.';return}
 const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
 $('push-state').textContent=sub&&Notification.permission==='granted'?'Benachrichtigungen sind aktiviert.':'Benachrichtigungen sind nicht aktiviert.';
 $('push-button').textContent=sub?'Aktualisieren':'Aktivieren';
}
function install(){if(state.installPrompt){state.installPrompt.prompt();state.installPrompt.userChoice.finally(()=>state.installPrompt=null)}else notify('Android: Browsermenü → App installieren. iPhone: Safari → Teilen → Zum Home-Bildschirm.')}
$('login-form').onsubmit=async e=>{
 e.preventDefault();const number=$('number').value.trim();if(!/^\d{3}$/.test(number))return notify('Bitte eine dreistellige Standesbuchnummer eingeben.');
 try{await call('loginStart',{number});$('login-form').hidden=true;$('verify-form').hidden=false;$('login-help').textContent='Sofern du als aktiver OVD eingetragen bist, erhältst du einen sechsstelligen Code per E-Mail.';$('otp').focus()}catch(err){notify(err.message)}
};
$('back-login').onclick=()=>{$('login-form').hidden=false;$('verify-form').hidden=true};
$('verify-form').onsubmit=async e=>{
 e.preventDefault();try{
 const r=await call('loginVerify',{number:$('number').value.trim(),code:$('otp').value.trim()});
 state.token=r.token;localStorage.setItem('ovd_session',r.token);$('otp').value='';section('app');showView('home');await refresh()
 }catch(err){notify(err.message)}
};
$('swap-form').onsubmit=async e=>{
 e.preventDefault();if(e.submitter?.value!=='send'){$('swap-dialog').close();return}
 const toId=$('target-person').value;if(!toId)return notify('Bitte einen OVD auswählen.');
 try{await call('swapCreate',{dutyId:state.pending,toId});$('swap-dialog').close();notify('Tauschanfrage versendet.');await refresh()}catch(err){notify(err.message)}
};
$('filter-mine').onclick=()=>{state.filter='mine';$('filter-mine').classList.add('selected');$('filter-all').classList.remove('selected');render()};
$('filter-all').onclick=()=>{state.filter='all';$('filter-all').classList.add('selected');$('filter-mine').classList.remove('selected');render()};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll('[data-reload]').forEach(b=>b.onclick=refresh);
$('logout').onclick=async()=>{try{await call('logout')}catch{}signOut()};
$('push-button').onclick=enablePush;['install-button','install-public','install-auth','install-header'].forEach(id=>{const b=$(id);if(b)b.onclick=install});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e});
window.addEventListener('online',()=>{if(state.token)refresh()});
window.addEventListener('offline',()=>status(false,'Offline'));
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(['home','duties','swaps','profile'].includes(v)&&state.token)showView(v)});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
bootstrap();if(state.token)setInterval(()=>{if(!document.hidden)refresh()},60000);
