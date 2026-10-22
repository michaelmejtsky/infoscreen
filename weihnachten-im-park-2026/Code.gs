/**
 * WEIHNACHTEN IM PARK 2026 – Käsehütte
 * Backend: Google Apps Script, Frontend: GitHub Pages
 * Setup: Funktion setupWIP() EINMAL ausführen.
 * Webapp: "Ausführen als: Ich", "Zugriff: Jeder".
 * Administrator-Schlüssel wird ausschließlich in den Skripteigenschaften gespeichert.
 */
const WIP_SPREADSHEET_ID = '1-wyGW6BNzV9eq2Xks07e1bieB4dfVa16sSebLN0jE5Q';
const WIP_DAYS = ['2026-12-04', '2026-12-05', '2026-12-06'];
const WIP_HEADERS = {
  'Anmeldungen': ['ID','Bearbeitungscode','Name','Telefon','Notiz','ImPlanAnzeigen','VerfuegbarkeitJSON','Erstellt','Aktualisiert'],
  'Einteilungen': ['ID','HelferID','Datum','Von','Bis','Bereich','Hinweis','Veroeffentlicht','Aktualisiert']
};

function setupWIP() {
  const ss = SpreadsheetApp.openById(WIP_SPREADSHEET_ID);
  ss.setSpreadsheetTimeZone('Europe/Vienna');
  Object.keys(WIP_HEADERS).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      const sheets = ss.getSheets();
      if (name === 'Anmeldungen' && sheets.length === 1 && sheets[0].getLastRow() === 0) {
        sheet = sheets[0]; sheet.setName(name);
      } else sheet = ss.insertSheet(name);
    }
    const headers = WIP_HEADERS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1,1,1,headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1,1,1,headers.length).setBackground('#e8efe8').setFontWeight('bold');
      sheet.autoResizeColumns(1,headers.length);
    } else {
      const existing = sheet.getRange(1,1,1,headers.length).getValues()[0].map(String);
      if (JSON.stringify(existing) !== JSON.stringify(headers)) throw Error(name + ': Tabellenkopf passt nicht. Keine Änderung durchgeführt.');
    }
    // IDs, Dates and times must remain literal strings (not auto-converted to Date).
    if (name === 'Einteilungen') sheet.getRange(2,1,Math.max(1,sheet.getMaxRows()-1),7).setNumberFormat('@');
    if (name === 'Anmeldungen') {sheet.getRange(2,1,Math.max(1,sheet.getMaxRows()-1),5).setNumberFormat('@');sheet.getRange(2,7,Math.max(1,sheet.getMaxRows()-1),1).setNumberFormat('@');}
  });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WIP_ADMIN_KEY')) {
    const key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g,'');
    props.setProperty('WIP_ADMIN_KEY',key);
    console.log('WICHTIG – Admin-Schlüssel EINMALIG kopieren: ' + key);
  } else {
    console.log('Admin-Schlüssel existiert bereits und bleibt unverändert. Abruf: Skripteigenschaften.');
  }
  console.log('WIP 2026 bereit. Spreadsheet: ' + ss.getUrl());
}

function doGet() { return ContentService.createTextOutput('WIP 2026 Backend bereit.'); }

function doPost(e) {
  let rid = '';
  let result;
  try {
    rid = String(e && e.parameter && e.parameter.rid || '').slice(0,90);
    const action = String(e && e.parameter && e.parameter.action || '');
    const payload = JSON.parse(String(e && e.parameter && e.parameter.payload || '{}'));
    result = wipRequest_(action,payload);
  } catch (err) { result = {ok:false,error:String(err && err.message || err)}; }
  const data = JSON.stringify({wip2026:true,rid:rid,result:result}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const html = '<!doctype html><html><body><script>try{window.top.postMessage(' + data + ',"*")}catch(e){};try{window.parent.postMessage(' + data + ',"*")}catch(e){}</script></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function wipRequest_(action,p) {
  if (action === 'public') return {ok:true,plan:wipPublic_()};
  if (action === 'mine') {
    const person = wipFindPerson_(wipString_(p.id,80));
    if (!person || person.code !== wipString_(p.code,100)) throw Error('Persönlicher Zugang ungültig.');
    return {ok:true,person:wipPublicPerson_(person),shifts:wipReadShifts_().filter(s=>s.personId===person.id && s.published)};
  }
  if (action === 'adminList') {
    wipAdmin_(p);
    return {ok:true,people:wipPeople_().map(wipAdminPerson_),shifts:wipReadShifts_()};
  }
  if (action === 'signup') return wipLocked_(function(){return wipSignup_(p)});
  if (action === 'saveShift') return wipLocked_(function(){wipAdmin_(p);return wipSaveShift_(p)});
  if (action === 'deleteShift') return wipLocked_(function(){wipAdmin_(p);return wipDeleteShift_(p)});
  if (action === 'publish') return wipLocked_(function(){wipAdmin_(p);return wipPublish_(true)});
  if (action === 'unpublish') return wipLocked_(function(){wipAdmin_(p);return wipPublish_(false)});
  throw Error('Unbekannte Aktion.');
}

function wipLocked_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function wipSheet_(name) {
  const s = SpreadsheetApp.openById(WIP_SPREADSHEET_ID).getSheetByName(name);
  if (!s) throw Error('Datenbank fehlt. Zuerst setupWIP() ausführen.');
  return s;
}
function wipRows_(name) {
  const sh=wipSheet_(name);
  const n=sh.getLastRow();
  return n<2?[]:sh.getRange(2,1,n-1,WIP_HEADERS[name].length).getValues().map((v,i)=>({row:i+2,v:v}));
}
function wipString_(v,max) { return String(v==null?'':v).trim().slice(0,max).replace(/[\u0000-\u001f]/g,' '); }
function wipTime_(v) {
  const t = wipString_(v,5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw Error('Uhrzeit ungültig.');
  return t;
}
function wipDate_(v) {
  const d = wipString_(v,10);
  if (WIP_DAYS.indexOf(d)<0) throw Error('Datum nicht im Veranstaltungszeitraum.');
  return d;
}
function wipAdmin_(p) {
  const actual=PropertiesService.getScriptProperties().getProperty('WIP_ADMIN_KEY');
  if (!actual) throw Error('Admin-Schlüssel noch nicht erstellt. setupWIP() ausführen.');
  if (wipString_(p.adminKey,150)!==actual) throw Error('Admin-Schlüssel falsch.');
}
function wipPeople_() {
  return wipRows_('Anmeldungen').map(r=>({
    row:r.row,id:String(r.v[0]),code:String(r.v[1]),name:String(r.v[2]),
    phone:String(r.v[3]),note:String(r.v[4]),publicName:r.v[5]===true||String(r.v[5])==='true',
    availability:wipParse_(r.v[6],[]),updated:String(r.v[8])
  }));
}
function wipParse_(value,fallback){try{return JSON.parse(String(value))}catch(e){return fallback}}
function wipFindPerson_(id){return wipPeople_().find(p=>p.id===id);}
function wipPublicPerson_(p){return {id:p.id,name:p.name,phone:p.phone,note:p.note,publicName:p.publicName,availability:p.availability};}
function wipAdminPerson_(p){return {id:p.id,name:p.name,phone:p.phone,note:p.note,publicName:p.publicName,availability:p.availability,updated:p.updated};}

function wipSignup_(p) {
  const name=wipString_(p.name,90),phone=wipString_(p.phone,60),note=wipString_(p.note,700);
  if (name.length<2) throw Error('Bitte einen Namen eingeben.');
  if (!Array.isArray(p.availability) || !p.availability.length || p.availability.length>18) throw Error('Bitte mindestens eine mögliche Schicht angeben (max. 18).');
  const slots=p.availability.map(x=> {
    const date=wipDate_(x.date),from=wipTime_(x.from),to=wipTime_(x.to);
    if (from>=to) throw Error('Die Endzeit muss nach der Startzeit liegen.');
    return {date:date,from:from,to:to};
  });
  let id=wipString_(p.id,80),code=wipString_(p.code,100);
  const existing=id?wipFindPerson_(id):null;
  if (id && (!existing || existing.code!==code)) throw Error('Deine gespeicherte Anmeldung konnte nicht geprüft werden.');
  const sh=wipSheet_('Anmeldungen'),now=new Date();
  if (existing) {
    sh.getRange(existing.row,3,1,7).setValues([[name,phone,note,p.publicName===true,JSON.stringify(slots),new Date(sh.getRange(existing.row,8).getValue()),now]]);
  } else {
    id=Utilities.getUuid(); code=Utilities.getUuid()+Utilities.getUuid();
    sh.appendRow([id,code,name,phone,note,p.publicName===true,JSON.stringify(slots),now,now]);
  }
  return {ok:true,id:id,code:code,message:existing?'Deine Verfügbarkeit wurde aktualisiert.':'Danke! Deine Verfügbarkeit wurde gespeichert.'};
}
function wipReadShifts_() {
  return wipRows_('Einteilungen').map(r=>({
    row:r.row,id:String(r.v[0]),personId:String(r.v[1]),date:String(r.v[2]),
    from:String(r.v[3]),to:String(r.v[4]),role:String(r.v[5]),note:String(r.v[6]),
    published:r.v[7]===true||String(r.v[7])==='true'
  }));
}
function wipPublic_() {
  const people=wipPeople_();
  const names={};
  people.forEach(p=>{names[p.id]=p.publicName?p.name.split(/\s+/)[0]:'Helfer:in'});
  return wipReadShifts_().filter(x=>x.published).map(x=>({
    date:x.date,from:x.from,to:x.to,role:x.role,name:names[x.personId]||'Helfer:in'
  })).sort((a,b)=>a.date.localeCompare(b.date)||a.from.localeCompare(b.from)||a.role.localeCompare(b.role));
}
function wipSaveShift_(p) {
  const person=wipFindPerson_(wipString_(p.personId,80));
  if (!person) throw Error('Helfer nicht gefunden.');
  const date=wipDate_(p.date),from=wipTime_(p.from),to=wipTime_(p.to);
  if (from>=to) throw Error('Endzeit muss nach der Startzeit liegen.');
  const id=wipString_(p.shiftId,80),role=wipString_(p.role,60)||'Käsehütte',note=wipString_(p.note,300);
  const all=wipReadShifts_(),prev=id?all.find(x=>x.id===id):null;
  if (id&&!prev) throw Error('Einteilung nicht gefunden.');
  if (all.some(x=>x.personId===person.id&&x.date===date&&x.id!==id&&from<x.to&&to>x.from)) throw Error('Diese Person hat in dem Zeitraum bereits eine Einteilung.');
  const values=[id||Utilities.getUuid(),person.id,date,from,to,role,note,false,new Date()];
  const sheet=wipSheet_('Einteilungen');
  if (prev) sheet.getRange(prev.row,1,1,values.length).setValues([values]);
  else sheet.appendRow(values);
  return {ok:true,message:'Einteilung als Entwurf gespeichert. Zum Fixieren veröffentlichen.'};
}
function wipDeleteShift_(p) {
  const shift=wipReadShifts_().find(x=>x.id===wipString_(p.shiftId,80));
  if (!shift) throw Error('Einteilung nicht gefunden.');
  wipSheet_('Einteilungen').deleteRow(shift.row);
  return {ok:true,message:'Einteilung gelöscht.'};
}
function wipPublish_(state) {
  const sh=wipSheet_('Einteilungen'),n=sh.getLastRow()-1;
  if (n<1) throw Error('Es gibt noch keine Einteilungen.');
  sh.getRange(2,8,n,1).setValues(Array.from({length:n},()=>[state]));
  return {ok:true,message:state?'Alle Einteilungen wurden fix veröffentlicht.':'Alle Einteilungen sind wieder Entwürfe.'};
}
