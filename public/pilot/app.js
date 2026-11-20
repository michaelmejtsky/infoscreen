'use strict';
const state={me:null,modules:[],docs:[],view:'overview',search:''};
const $=s=>document.querySelector(s);
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const E=(s,cls='')=>`<div class="empty ${cls}">${esc(s)}</div>`;
async function api(path,opts={}){
 const r=await fetch(`/api/v1/${path}`,{credentials:'same-origin',cache:'no-store',...opts});
 if(!r.ok){let message=`HTTP ${r.status}`;try{let j=await r.json();message=j.error||j.detail||message}catch{}throw new Error(message)}
 return r;
}
async function data(path,opts={}){return(await api(path,opts)).json()}
function showBanner(msg,err=true){let b=$('#banner');b.textContent=msg;b.classList.toggle('error',err);b.classList.remove('hidden');}
function clearBanner(){$('#banner').classList.add('hidden')}
function setStatus(text,ok=false){$('#status').textContent=text;document.querySelector('.dot').classList.toggle('ok',ok)}
function navigate(view){state.view=view;state.search='';document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('selected',b.dataset.screen===view));
 $('#page-title').textContent=view==='overview'?'Übersicht':view==='documents'?'Dokumente & Archiv':state.modules.find(x=>x.id===view)?.title||'BAZ';
 clearBanner();render().catch(e=>{showBanner(e.message);$('#content').innerHTML=E('Daten konnten nicht geladen werden')});
}
async function init(){
 document.addEventListener('click',e=>{let nav=e.target.closest('[data-screen]');if(nav)navigate(nav.dataset.screen)});
 $('#close-dialog').addEventListener('click',()=>$('#upload-dialog').close());$('#cancel-upload').addEventListener('click',()=>$('#upload-dialog').close());
 $('#upload-form').addEventListener('submit',saveDocument);
 try{
   state.me=await data('me');
   $('#username').textContent=state.me.user;$('#role').textContent=state.me.role.toUpperCase();
   state.modules=(await data('modules')).modules;
   $('#module-nav').innerHTML=state.modules.map(x=>`<button class="nav-item" data-screen="${esc(x.id)}">▤ <span>${esc(x.title)}</span></button>`).join('');
   if(state.me.demo)showBanner('DEMO-MODUS: Keine echten Daten und alle Schreibvorgänge sind deaktiviert.',false);
   setStatus(state.me.demo?'Demo – nur Lesemodus':'Authentifiziert',true);await render();
 }catch(e){setStatus('Verbindung fehlgeschlagen');showBanner('Anmeldung/Datenzugriff nicht möglich: '+e.message);$('#content').innerHTML=E('Kein Zugriff. Bitte Anmeldung oder Backend prüfen.')}
}
async function render(){
 if(state.view==='overview')return renderOverview();
 if(state.view==='documents')return renderDocs();
 return renderModule(state.view);
}
function renderOverview(){
 $('#content').innerHTML=`<div class="cards"><div class="card"><div class="label">Module im Bestand</div><span class="big">${state.modules.length}</span><span class="sub">Derzeit lesend angebunden</span></div><div class="card"><div class="label">Zugriffsrolle</div><span class="big">${esc(state.me?.role||'–')}</span><span class="sub">Serverseitig geprüft</span></div><div class="card"><div class="label">Systemstatus</div><span class="big">${state.me?.demo?'DEMO':'PILOT'}</span><span class="sub">Keine Produktivumschaltung</span></div></div><div class="panel"><h2>BAZ 4.0 · Dokumentenzentrale</h2><p class="muted">Module können bereits im einheitlichen BAZ-Design gelesen werden. Die neue Dokumentenverwaltung unterstützt Dateiupload, Versionierung und Wiederherstellung, sobald der interne Server und die Test-Datenbank freigeschaltet sind.</p><p class="notice">Wichtige Dienst-, Kalender-, OVD-, Alarm- und E-Mail-Prozesse bleiben während des Piloten ausschließlich in der bisherigen Anwendung aktiv.</p></div>`;
}
async function renderModule(view){
 let c=$('#content');c.innerHTML='<div class="panel">Daten werden geladen …</div>';
 const m=state.modules.find(x=>x.id===view);
 if(!m?.available){c.innerHTML=`<div class="panel">${E('Dieses Modul wurde in der Testdatenbank nicht gefunden.')}</div>`;return;}
 let res=await data('modules/'+encodeURIComponent(view));
 let rows=res.rows||[];let keys=[...new Set(rows.slice(0,150).flatMap(x=>Object.keys(x)))].slice(0,22);
 c.innerHTML=`<div class="panel"><div class="toolbar"><div><h2>${esc(m.title)}</h2><span class="muted">${esc(res.source)} · ${rows.length} Einträge · nur Lesezugriff</span></div><input id="search" placeholder="Einträge durchsuchen …" aria-label="Einträge durchsuchen"/></div><div class="table-wrap" id="table"></div></div>`;
 const draw=()=>{let q=($('#search').value||'').toLowerCase();let visible=rows.filter(row=>Object.values(row).some(x=>String(x??'').toLowerCase().includes(q))).slice(0,300);
   $('#table').innerHTML=rows.length?`<table class="data-table"><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${visible.map(row=>`<tr>${keys.map(k=>`<td class="wrap">${esc(row[k]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table>${visible.length===300?'<p class="muted">Anzeige auf 300 Einträge begrenzt – Suche eingrenzen.</p>':''}`:E('Keine Einträge vorhanden');};
 $('#search').addEventListener('input',draw);draw();
}
async function renderDocs(){
 let c=$('#content');c.innerHTML='<div class="panel">Dokumente werden geladen …</div>';
 state.docs=(await data('docs')).docs||[];
 const canEdit=!state.me.demo&&['admin','editor'].includes(state.me.role);
 c.innerHTML=`<div class="panel"><div class="toolbar"><div><h2>Dokumentregister</h2><p class="muted">${state.docs.length} Dokumente · Änderungen archiviert</p></div><div class="actions"><input id="doc-search" placeholder="Dokumente suchen …" aria-label="Dokumente durchsuchen"/>${canEdit?'<button class="primary" id="new-doc">+ Neues Dokument</button>':''}</div></div><div class="table-wrap" id="doc-table"></div></div>`;
 if(canEdit)$('#new-doc').addEventListener('click',()=>openUpload(null));
 const draw=()=>{
  let q=$('#doc-search').value.toLowerCase(),items=state.docs.filter(d=>[d.Titel,d.Kategorie,d.Dateiname].some(s=>String(s||'').toLowerCase().includes(q)));
  $('#doc-table').innerHTML=items.length?`<table class="data-table"><thead><tr><th>Dokument</th><th>Kategorie</th><th>Version</th><th>Aktualisiert</th><th>Aktionen</th></tr></thead><tbody>${items.map(d=>`<tr><td class="wrap"><strong>${esc(d.Titel)}</strong><br><span class="muted">${esc(d.Dateiname)}</span></td><td>${esc(d.Kategorie)}</td><td><span class="pill">v${esc(d.Version)}</span></td><td>${esc(d.Aktualisiert)}</td><td><div class="doc-actions"><button class="secondary mini" data-doc="${esc(d.ID)}" data-action="download">Öffnen</button><button class="secondary mini" data-doc="${esc(d.ID)}" data-action="versions">Archiv</button>${canEdit?`<button class="primary mini" data-doc="${esc(d.ID)}" data-action="replace">Ersetzen</button>`:''}</div></td></tr>`).join('')}</tbody></table>`:E('Keine Dokumente gefunden');
 };
 $('#doc-search').addEventListener('input',draw);$('#doc-table').addEventListener('click',onDocAction);draw();
}
function openUpload(doc){
 if(state.me.demo||!['admin','editor'].includes(state.me.role))return;
 $('#upload-form').reset();$('#document_id').value=doc?.ID||'';$('#expected_version').value=doc?.Version||'';
 $('#doc-title').value=doc?.Titel||'';$('#doc-category').value=doc?.Kategorie||'Allgemein';
 $('#upload-title').textContent=doc?'Neue Dokumentversion':'Neues Dokument';$('#upload-dialog').showModal();
}
async function saveDocument(e){
 e.preventDefault();let btn=$('#submit-upload');btn.disabled=true;btn.textContent='Speichern …';
 try{let body=new FormData($('#upload-form'));let res=await data('docs',{method:'POST',body});$('#upload-dialog').close();await renderDocs();showBanner(`Gespeichert: Dokumentversion ${res.version}.`,false)}
 catch(err){showBanner('Speichern fehlgeschlagen: '+err.message)}finally{btn.disabled=false;btn.textContent='Speichern'}
}
async function onDocAction(e){
 let b=e.target.closest('[data-doc]');if(!b)return;
 const d=state.docs.find(x=>x.ID===b.dataset.doc);if(!d)return;
 try{
  if(b.dataset.action==='replace')return openUpload(d);
  if(b.dataset.action==='download'){
    let res=await api(`docs/${d.ID}/download`),blob=await res.blob();let href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=d.Dateiname||'Dokument';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),15000);return;
  }
  if(b.dataset.action==='versions'){
    let versions=(await data(`docs/${d.ID}/versions`)).versions||[];
    const isAdmin=!state.me.demo&&state.me.role==='admin';
    const content=versions.length?versions.map(x=>`<div class="archive-row"><div><strong>Version ${esc(x.Version)}</strong> <span class="muted">${esc(x.Zeitpunkt||'')} · ${esc(x.Benutzer||'')}</span></div>${isAdmin?`<button class="secondary mini" data-restore="${esc(x.Version)}">Wiederherstellen</button>`:''}</div>`).join(''):E('Noch keine älteren Versionen');
    const main=$('#content');let old=main.querySelector('.archive-panel');if(old)old.remove();
    let container=document.createElement('div');container.className='panel archive-panel';
    container.innerHTML=`<div class="toolbar"><h2>Versionen: ${esc(d.Titel)}</h2><button class="secondary mini" id="close-archive">Schließen</button></div><p class="muted">Aktuelle Dokumentversion: ${esc(d.Version)}. Wiederherstellung erzeugt eine neue Version; die bisherige bleibt archiviert.</p>${content}`;
    main.prepend(container);container.querySelector('#close-archive').addEventListener('click',()=>container.remove());
    if(isAdmin)container.querySelectorAll('[data-restore]').forEach(btn=>btn.addEventListener('click',async()=>{
      if(!confirm(`Alte Version ${btn.dataset.restore} von ${d.Titel} als neue aktuelle Version wiederherstellen?`))return;
      btn.disabled=true;
      try{
        const form=new FormData();form.set('expected_version',d.Version);
        await data(`docs/${d.ID}/restore/${btn.dataset.restore}`,{method:'POST',body:form});
        await renderDocs();showBanner('Dokument wiederhergestellt. Die vorherige Version bleibt archiviert.',false);
      }catch(err){btn.disabled=false;showBanner('Wiederherstellung fehlgeschlagen: '+err.message)}
    }));
  }
 }catch(err){showBanner(err.message)}
}
init();

// BAZ 4.0 – reale Dienstbuch-V2-Fachregister in einer freigegebenen Testkopie.
state.db2Sections=[];state.db2Current=null;state.links=[];
function canWrite(){return !state.me?.demo && ['admin','editor'].includes(state.me?.role)}
async function renderDb2Index(){
 const c=$('#content');c.innerHTML='<div class="panel">Dienstbuch wird geladen …</div>';
 state.db2Sections=(await data('db2')).sections||[];
 c.innerHTML=`<div class="panel"><h2>Dienstbuch – Bereiche</h2><p class="muted">Die Tabellen wurden anhand des originalen DienstbuchSetup.gs festgelegt. Änderungen sind nur in einer gesonderten Testkopie freigeschaltet.</p><div class="section-list">${state.db2Sections.map(x=>`<button class="section-link" data-db2="${esc(x.id)}"><span>${esc(x.title.replace('DB2_','').replaceAll('_',' '))}</span><small>${x.editable?'Einträge verwalten':'Lesebereich'}</small></button>`).join('')}</div></div>`;
 c.querySelectorAll('[data-db2]').forEach(b=>b.addEventListener('click',()=>navigate('db2/'+b.dataset.db2)));
}
async function renderDb2Section(slug){
 const c=$('#content');c.innerHTML='<div class="panel">Dienstbuch-Einträge werden geladen …</div>';
 const info=await data('db2/'+encodeURIComponent(slug));state.db2Current=info;
 const writable=info.editable&&canWrite();
 c.innerHTML=`<div class="panel"><div class="toolbar"><div><h2>${esc(info.title)}</h2><p class="muted">${info.entries.length} Datensätze · ${info.editable?'fachlich schreibbar':'nur lesend'} · Änderungen werden auf Konflikte geprüft</p></div><div class="actions"><input id="db2-search" placeholder="Dienstbucheinträge suchen …"/>${writable?'<button class="primary" id="db2-new">+ Neuer Eintrag</button>':''}</div></div><div class="table-wrap" id="db2-table"></div></div>`;
 if(writable)$('#db2-new').addEventListener('click',()=>openDb2(null));
 const draw=()=>{
   const q=$('#db2-search').value.toLowerCase();const rows=info.entries.filter(e=>Object.values(e.values).some(v=>String(v??'').toLowerCase().includes(q))).slice(0,350);
   $('#db2-table').innerHTML=`<table class="data-table"><thead><tr>${info.columns.map(col=>`<th>${esc(col)}</th>`).join('')}${writable?'<th>Aktion</th>':''}</tr></thead><tbody>${rows.map(entry=>`<tr>${info.columns.map(col=>`<td class="wrap">${esc(entry.values[col]||'')}</td>`).join('')}${writable?`<td><button class="secondary mini" data-edit="${esc(entry.values.ID)}">Bearbeiten</button></td>`:''}</tr>`).join('')}</tbody></table>${rows.length===0?E('Keine Einträge gefunden'):''}`;
   if(writable)$('#db2-table').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openDb2(info.entries.find(e=>e.values.ID===b.dataset.edit))));
 };
 $('#db2-search').addEventListener('input',draw);draw();
}
function openDb2(entry){
 const info=state.db2Current;if(!info?.editable||!canWrite())return;
 const dlg=$('#db2-dialog');dlg.dataset.id=entry?.values?.ID||'';dlg.dataset.etag=entry?.etag||'';
 $('#db2-title').textContent=entry?'Dienstbuch-Eintrag bearbeiten':'Neuen Dienstbuch-Eintrag anlegen';
 $('#db2-fields').innerHTML=info.writable.map(h=>{
    let value=entry?.values[h]||''; const large=/Text|Bemerk|Grund|Inhalt|Ausbildungsthemen|Handlung|Zusatzinfo|Nachricht/i.test(h);
    return `<label>${esc(h)}${large?`<textarea data-db2-field="${esc(h)}" maxlength="4000" rows="3">${esc(value)}</textarea>`:`<input data-db2-field="${esc(h)}" maxlength="4000" value="${esc(value)}"/>`}</label>`;
 }).join('');dlg.showModal();
}
async function saveDb2(event){
 event.preventDefault();const info=state.db2Current;const dlg=$('#db2-dialog');const btn=$('#db2-submit');
 let values={};dlg.querySelectorAll('[data-db2-field]').forEach(input=>values[input.dataset.db2Field]=input.value);
 const id=dlg.dataset.id;btn.disabled=true;
 try{
  const path='db2/'+encodeURIComponent(info.section)+(id?'/'+encodeURIComponent(id):'');
  await data(path,{method:id?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify({values,expected_etag:dlg.dataset.etag})});
  dlg.close();await renderDb2Section(info.section);showBanner('Eintrag gespeichert. Excel-Abgleich weiterhin ausstehend.',false);
 }catch(e){showBanner('Nicht gespeichert: '+e.message)}finally{btn.disabled=false}
}
async function renderLinks(){
 const c=$('#content');c.innerHTML='<div class="panel">Serververknüpfungen werden geladen …</div>';
 state.links=(await data('links')).links||[];
 c.innerHTML=`<div class="panel"><div class="toolbar"><div><h2>Serverdokumente & Excel-Verknüpfungen</h2><p class="muted">${state.links.length} importierte Quellen · UNC-Dateien nur über freigegebenen Windows-Server lesbar</p></div><input id="link-search" placeholder="Dokument, Ordner, Begriff …"/></div><div class="table-wrap" id="link-table"></div><div id="link-detail" class="legacy-detail"></div></div>`;
 const draw=()=>{let q=$('#link-search').value.toLowerCase(),items=state.links.filter(x=>[x.title,x.sheet,x.kind].some(s=>String(s||'').toLowerCase().includes(q))).slice(0,300);
 $('#link-table').innerHTML=`<table class="data-table"><thead><tr><th>Dokument / Verknüpfung</th><th>Excel-Bereich</th><th>Typ</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td class="wrap">${esc(x.title)}</td><td>${esc(x.sheet)}</td><td><span class="pill">${esc(x.kind)}</span></td><td>${x.externalUrl?`<a class="secondary mini linklike" href="${esc(x.externalUrl)}" rel="noopener noreferrer" target="_blank">Öffnen</a>`:`<button class="secondary mini" data-link="${esc(x.id)}">Prüfen/Öffnen</button>`}</td></tr>`).join('')}</tbody></table>${items.length===0?E('Keine Treffer'):''}`;
 $('#link-table').querySelectorAll('[data-link]').forEach(b=>b.addEventListener('click',()=>showLink(b.dataset.link)));
 };$('#link-search').addEventListener('input',draw);draw();
}
async function showLink(id){
 let l=state.links.find(x=>x.id===id),box=$('#link-detail');box.innerHTML='<div class="notice">Zugriff wird geprüft …</div>';
 try{let res=await data(`links/${id}/status`);if(!res.available){box.innerHTML=`<div class="notice">${esc(l?.title||'Verknüpfung')}: ${esc(res.reason||'Derzeit nicht verfügbar')}. Die Originaldatei wird nicht verändert.</div>`;return}
 if(res.kind==='file'){
   const canReplace=!!res.writeEnabled&&!state.me.demo&&state.me.role==='admin'&&!!res.sha256;
   box.innerHTML=`<div class="notice"><strong>${esc(res.name)}</strong> – ${(res.bytes/1024).toFixed(1)} KB <a href="/api/v1/links/${encodeURIComponent(id)}/download" target="_blank" rel="noopener">Dokument öffnen/herunterladen</a>${canReplace?'<button class="secondary mini" id="legacy-edit">Neue Dateiversion hochladen</button><input type="file" id="legacy-file" hidden>':''}</div>`;
   if(canReplace){
     const inp=box.querySelector('#legacy-file');box.querySelector('#legacy-edit').addEventListener('click',()=>inp.click());
     inp.addEventListener('change',async()=>{
       if(!inp.files.length)return;
       if(inp.files[0].name.toLowerCase()!==res.name.toLowerCase()){
         showBanner('Dateiname muss exakt mit dem bestehenden Dokument übereinstimmen.');return;
       }
       if(!confirm('Vorhandene Serverdatei versioniert ersetzen? Die bisherige Datei wird vorher gesichert.'))return;
       const form=new FormData();form.set('file',inp.files[0]);form.set('expected_sha256',res.sha256);
       try{await data('links/'+id+'/replace',{method:'POST',body:form});showBanner('Neue Version am Testserver gespeichert. Alte Datei archiviert.',false);await showLink(id)}
       catch(err){showBanner('Serverdatei nicht verändert: '+err.message)}
     });
   }
   return;
 }
 if(res.kind==='directory'){
  let files=(await data(`links/${id}/files`)).files||[];
  box.innerHTML=`<h3>${esc(l.title)} – Ordnerinhalt</h3><div class="link-list">${files.map(f=>`<a href="/api/v1/links/${encodeURIComponent(id)}/download?file=${encodeURIComponent(f.name)}" target="_blank" rel="noopener noreferrer">📄 ${esc(f.name)}</a>`).join('')}</div>${files.length===0?E('Keine direkt abrufbaren Dateien'):''}`;
 }
 }catch(err){box.innerHTML=`<div class="notice">${esc(err.message)}</div>`}
}
// Der bestehende öffentliche Infoscreen wird nur auf ausdrücklichen Klick geladen.
// Die produktiven Daten-, OVD- und Statusendpunkte bleiben unverändert.
const LIVE_INFOSCREEN_URL = 'https://michaelmejtsky.github.io/infoscreen/';
const LIVE_INFOSCREEN_ROOMS = Object.freeze(['ls1','ls2','ls3']);
function renderInfoscreenLive(){
 const target=$('#content');
 target.innerHTML=`<div class="panel infoscreen-panel">
  <div class="toolbar"><div><h2>Infoscreen – bestehende Live-Anzeige</h2>
   <p class="muted">Originalprojekt: <strong>michaelmejtsky/infoscreen</strong>. Der laufende Infoscreen und seine Ausfallanzeige bleiben unverändert.</p></div>
   <span class="pill">Nur Ansicht · Pilot</span></div>
  <div class="infoscreen-tools"><label for="infoscreen-room">Raum</label>
   <select id="infoscreen-room" aria-label="Anzeigeraum"><option value="ls1">LS1</option><option value="ls2">LS2</option><option value="ls3">LS3</option></select>
   <button class="primary" id="infoscreen-preview" type="button">Vorschau laden</button>
   <a id="infoscreen-open" class="secondary infoscreen-open" href="${LIVE_INFOSCREEN_URL}?room=ls1" target="_blank" rel="noopener noreferrer">Im neuen Tab öffnen</a>
  </div>
  <div id="infoscreen-host" class="infoscreen-host"><p class="muted">Die Vorschau lädt erst nach einem Klick. Dadurch entstehen beim normalen Öffnen der BAZ keine zusätzlichen Apps-Script-Anfragen.</p></div>
  <p class="muted">Hinweis: Die Anzeige wird weiterhin von der vorhandenen Apps-Script-Web-App versorgt. Eine vollständige Cloudflare-Migration ist damit noch nicht abgeschlossen.</p>
 </div>`;
 const room=target.querySelector('#infoscreen-room');
 const link=target.querySelector('#infoscreen-open');
 const host=target.querySelector('#infoscreen-host');
 let running=false;
 const buildUrl=()=>{
   const selected=LIVE_INFOSCREEN_ROOMS.includes(room.value)?room.value:'ls1';
   return LIVE_INFOSCREEN_URL+'?room='+encodeURIComponent(selected);
 };
 const update=()=>{
   const url=buildUrl();link.href=url;
   if(running)host.querySelector('iframe').src=url;
 };
 room.addEventListener('change',update);
 target.querySelector('#infoscreen-preview').addEventListener('click',()=>{
   if(running){host.querySelector('iframe').src=buildUrl();return;}
   const frame=document.createElement('iframe');
   frame.className='infoscreen-frame';frame.title='Infoscreen Live – Vorschau';
   frame.setAttribute('loading','lazy');frame.setAttribute('referrerpolicy','no-referrer');
   frame.src=buildUrl();host.replaceChildren(frame);running=true;
 });
}

// Neue Navigation ohne Eingriff in den bereits geprüften alten Modulleseweg.
const originalNavigate=navigate;
navigate=function(view){
 if(view==='infoscreen-live'){
  state.view=view;document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('selected',b.dataset.screen===view));
  $('#page-title').textContent='Infoscreen Live';
  clearBanner();renderInfoscreenLive();return;
 }
 if(view==='db2'||view.startsWith('db2/')||view==='links'){
  state.view=view;document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('selected',b.dataset.screen===view));
  $('#page-title').textContent=view==='links'?'Serverdokumente':view==='db2'?'Dienstbuch':view.split('/').pop().replaceAll('-',' ');
  clearBanner();const task=view==='links'?renderLinks():view==='db2'?renderDb2Index():renderDb2Section(view.slice(4));
  task.catch(e=>{showBanner(e.message);$('#content').innerHTML=E('Daten konnten nicht geladen werden')});return;
 }
 originalNavigate(view);
};
$('#db2-close').addEventListener('click',()=>$('#db2-dialog').close());
$('#db2-cancel').addEventListener('click',()=>$('#db2-dialog').close());
$('#db2-form').addEventListener('submit',saveDb2);
