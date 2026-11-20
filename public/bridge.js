'use strict';
// Read-only embedding wrapper. All actual BAZ actions execute in the existing
// Apps Script HTMLService iframe with its own access control and Google Sheets.
const ORIGINAL = "https://script.google.com/macros/s/AKfycbzXEPgwDEjn6iX5Vf73-kyX3g7D0pQtiygkP4xT6wQ7FZb0kplB_6JnCWO0a68zmAkL/exec";
const query = new URLSearchParams(location.search);
const requestedMode = String(query.get('mode')||'auto').toLowerCase();
const mode = ['desktop','mobile'].includes(requestedMode) ? requestedMode :
  (matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop');
const frame = document.getElementById('baz-original');
const loading = document.getElementById('loading');
const fallback = document.getElementById('fallback');
const direct = document.getElementById('direct');
const loadingDirect = document.getElementById('loading-direct');
const fallbackDirect = document.getElementById('fallback-direct');
const target = new URL(ORIGINAL);
if (mode === 'mobile') target.searchParams.set('page','mobileapp');
const originalUrl = target.toString();
for (const link of [direct,loadingDirect,fallbackDirect]) link.href = originalUrl;
let finished = false;
let timeoutId;
function showOriginal() {
  finished = false;
  loading.hidden = false;
  fallback.hidden = true;
  frame.src = originalUrl;
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    if (!finished) { loading.hidden = true; fallback.hidden = false; }
  }, 25000);
}
frame.addEventListener('load', () => {
  // onload verifies navigation, not that Google access or individual actions work.
  finished = true;
  loading.hidden = true;
  fallback.hidden = true;
  clearTimeout(timeoutId);
});
document.getElementById('retry').addEventListener('click',showOriginal);
const toggle = document.getElementById('tools-toggle');
const tools = document.getElementById('tools');
toggle.addEventListener('click',()=>{tools.hidden=!tools.hidden;toggle.setAttribute('aria-expanded',String(!tools.hidden));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){tools.hidden=true;toggle.setAttribute('aria-expanded','false');}});
if (query.get('help')==='1') {tools.hidden=false;toggle.setAttribute('aria-expanded','true');}
showOriginal();