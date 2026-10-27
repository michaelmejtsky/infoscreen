/** Cloudflare Worker: CORS-Gateway zu Apps Script + standardkonformer Web Push.
 * Benötigt Secrets GAS_WEBAPP_URL, GAS_BRIDGE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
 * Secrets NIE in GitHub oder Browsercode schreiben.
 */
const ORIGIN='https://michaelmejtsky.github.io';
const enc=new TextEncoder();
const bytes=(s)=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-String(s).length%4)%4)),c=>c.charCodeAt(0));
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const concat=(...items)=>{const all=items.map(x=>x instanceof Uint8Array?x:new Uint8Array(x)),out=new Uint8Array(all.reduce((n,x)=>n+x.length,0));let p=0;for(const x of all){out.set(x,p);p+=x.length}return out};
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}})}
async function gas(env,payload){if(!env.GAS_WEBAPP_URL||!env.GAS_BRIDGE_KEY)throw Error('Gateway noch nicht konfiguriert.');const form=new URLSearchParams({ovd_app_v1:'1',gw:env.GAS_BRIDGE_KEY,payload:JSON.stringify(payload)});const response=await fetch(env.GAS_WEBAPP_URL,{method:'POST',body:form,headers:{'Content-Type':'application/x-www-form-urlencoded; charset=utf-8'},redirect:'follow'});if(!response.ok)throw Error('Apps Script nicht erreichbar: '+response.status);const text=await response.text();let result;try{result=JSON.parse(text)}catch{throw Error('Apps Script hat keine JSON-Antwort geliefert. Deployment und doPost prüfen.')}return result}
async function hmac(key,data){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,data))}
async function expand(prk,info,len){const out=await hmac(prk,concat(info,new Uint8Array([1])));return out.slice(0,len)}
async function encryptedPush(subscription,message){
 const clientPub=bytes(subscription.keys.p256dh),auth=bytes(subscription.keys.auth);
 if(clientPub.length!==65||auth.length<16)throw Error('Ungültige Web-Push-Schlüssel');
 const clientKey=await crypto.subtle.importKey('raw',clientPub,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const eph=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const serverPub=new Uint8Array(await crypto.subtle.exportKey('raw',eph.publicKey));
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:clientKey},eph.privateKey,256));
 const prk=await hmac(auth,shared),ikm=await expand(prk,concat(enc.encode('WebPush: info\0'),clientPub,serverPub),32);
 const salt=crypto.getRandomValues(new Uint8Array(16)),prk2=await hmac(salt,ikm);
 const cek=await expand(prk2,enc.encode('Content-Encoding: aes128gcm\0'),16),nonce=await expand(prk2,enc.encode('Content-Encoding: nonce\0'),12);
 const key=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['encrypt']);
 const plain=concat(enc.encode(JSON.stringify(message)),new Uint8Array([2]));
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,tagLength:128},key,plain));
 const header=concat(salt,new Uint8Array([0,0,16,0,serverPub.length]),serverPub);return concat(header,cipher);
}
async function vapidHeader(env,endpoint){
 const pub=bytes(env.VAPID_PUBLIC_KEY),priv=bytes(env.VAPID_PRIVATE_KEY);
 if(pub.length!==65||priv.length!==32)throw Error('VAPID-Schlüssel ungültig');
 const jwk={kty:'EC',crv:'P-256',x:b64(pub.slice(1,33)),y:b64(pub.slice(33,65)),d:b64(priv),ext:false,key_ops:['sign']};
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const header=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const payload=b64(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:env.VAPID_SUBJECT||'https://michaelmejtsky.github.io/infoscreen/ovd/'})));
 const input=header+'.'+payload;const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(input)));
 return 'vapid t='+input+'.'+b64(sig)+', k='+env.VAPID_PUBLIC_KEY;
}
async function sendPush(env,sub,payload){const endpoint=new URL(sub.endpoint);if(endpoint.protocol!=='https:')throw Error('Unsicherer Push-Endpunkt');const ciphertext=await encryptedPush(sub,payload);const auth=await vapidHeader(env,sub.endpoint);return fetch(sub.endpoint,{method:'POST',headers:{'Authorization':auth,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','TTL':'86400','Urgency':'normal'},body:ciphertext});}
async function runPushQueue(env){if(!env.VAPID_PRIVATE_KEY||!env.VAPID_PUBLIC_KEY)return;const res=await gas(env,{action:'pendingPush'});if(!res.ok)throw Error(res.error||'Push-Liste nicht verfügbar');for(const job of (res.data?.jobs||[])){
  let ok=0;for(const sub of job.subscriptions||[]){try{const response=await sendPush(env,sub,{title:job.title,body:job.body,url:job.url,tag:job.key});if(response.ok)ok++;else console.log('OVD Push Status',response.status)}catch(err){console.log('OVD Push Fehler',String(err))}}
  try{await gas(env,{action:'ackPush',row:job.row,key:job.key,delivered:ok>0,noSubscriptions:!job.subscriptions?.length})}catch(err){console.log('OVD Push Quittierung',String(err))}
}}
export default{
 async fetch(request,env){const url=new URL(request.url);if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(url.pathname==='/health')return json({ok:true,service:'OVD-Zentrale API'});
 if(url.pathname!=='/api'||request.method!=='POST')return json({ok:false,error:'Nicht gefunden'},404);
 const origin=request.headers.get('Origin');if(origin&&origin!==ORIGIN)return json({ok:false,error:'Nicht erlaubt'},403);
 try{if(Number(request.headers.get('Content-Length')||0)>12000)return json({ok:false,error:'Anfrage zu groß'},413);const payload=await request.json();if(!payload||typeof payload.action!=='string')return json({ok:false,error:'Ungültiger Aufruf'},400);if(payload.action==='pendingPush'||payload.action==='ackPush')return json({ok:false,error:'Nicht erlaubt'},403);
 if(payload.action==='config')return json({ok:true,data:{vapidPublicKey:env.VAPID_PUBLIC_KEY||''}});
 const response=await gas(env,payload);return json(response,response.ok?200:400);
 }catch(err){console.log('OVD API',String(err));return json({ok:false,error:'Serververbindung fehlgeschlagen. Bitte später erneut versuchen.'},503)}
 },
 async scheduled(event,env,ctx){ctx.waitUntil(runPushQueue(env).catch(e=>console.log('OVD Cron',String(e))))}
};