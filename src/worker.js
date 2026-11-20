/* BAZ 4.0 Cloudflare API + UI gateway: demo defaults to read-only.
 * PILOT ONLY. Protect with Cloudflare Access before connecting real data.
 * Credentials belong in Cloudflare Secrets, never in public JS.
 */
const encoder = new TextEncoder();
const corsless = {"cache-control":"no-store", "x-content-type-options":"nosniff"};
const json = (value, status=200) => new Response(JSON.stringify(value), {status,headers:{...corsless,"content-type":"application/json; charset=utf-8"}});
function err(status, message) {return json({ok:false,error:message},status)}
const includesEmail = (list,email) => String(list||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email);
function decodeBase64Url(s){
 const normalized=s.replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(normalized+'='.repeat((4-normalized.length%4)%4)),c=>c.charCodeAt(0));
}
async function accessIdentity(request,env){
 const jwt=request.headers.get("cf-access-jwt-assertion")||"";
 const domain=String(env.ACCESS_TEAM_DOMAIN||"").trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
 const aud=String(env.ACCESS_AUD||"");
 if(!domain || !aud || !jwt) throw new Error("Cloudflare Access nicht konfiguriert");
 const p=jwt.split("."); if(p.length!==3) throw new Error("Anmeldung ungültig");
 let header,payload;
 try {
   header=JSON.parse(new TextDecoder().decode(decodeBase64Url(p[0])));
   payload=JSON.parse(new TextDecoder().decode(decodeBase64Url(p[1])));
 }catch{throw new Error("Token fehlerhaft")}
 if(header.alg!=="RS256"||!header.kid)throw new Error("Ungültiger Signaturalgorithmus");
 const jwks=await fetch(`https://${domain}/cdn-cgi/access/certs`,{cf:{cacheTtl:120,cacheEverything:true}});
 if(!jwks.ok)throw new Error("Access-Schlüssel nicht abrufbar");
 const {keys=[]}=await jwks.json();
 const jwk=keys.find(k=>k.kid===header.kid&&k.kty==="RSA");if(!jwk)throw new Error("Unbekannter Access-Schlüssel");
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decodeBase64Url(p[2]),encoder.encode(p[0]+"."+p[1]));
 if(!valid)throw new Error("Ungültige Signatur");
 const now=Math.floor(Date.now()/1000);
 if(typeof payload.exp!=="number"||payload.exp<=now||(typeof payload.nbf==="number"&&payload.nbf>now))throw new Error("Token abgelaufen");
 if(payload.iss!==`https://${domain}`)throw new Error("Falscher Aussteller");
 if(!(Array.isArray(payload.aud)&&payload.aud.includes(aud)))throw new Error("Falsche Anwendung");
 const email=String(payload.email||"").toLowerCase();
 if(!email|| !includesEmail(env.ALLOWED_USERS,email))throw new Error("Benutzer nicht freigegeben");
 const role=includesEmail(env.ADMIN_USERS,email)?"admin":includesEmail(env.EDITOR_USERS,email)?"editor":"viewer";
 return {email,role};
}
const demoModules=[
 ["werkstatt","Werkstatt"],["haustechnik","Haustechnik"],["verleihliste","Verleihliste"],
 ["erinnerungen","Erinnerungen"],["zdl-maengel","Zivildiener – Mängel"],["ovd-personen","OVD-Personal"],
 ["ovd-dienste","OVD-Dienste"],["dienstbuch","Dienstbuch"],["nachrichten","Nachrichten"],
 ["tagesliste-objekte","Tagesliste Objekte"],["tagesliste-fahrzeuge","Tagesliste Fahrzeuge"],
 ["tagesliste-feuer","Tagesliste Feuer"]];
async function handleApi(request,env,url){
 if(env.BAZ4_DEMO!=="false"){
   if(request.method!=="GET")return err(403,"Demo: alle Schreibvorgänge gesperrt");
   if(url.pathname==="/api/v1/me")return json({user:"demo@beispiel.invalid",role:"viewer",demo:true});
   if(url.pathname==="/api/v1/health")return json({ok:true,mode:"demo",readOnly:true});
   if(url.pathname==="/api/v1/modules")return json({modules:demoModules.map(([id,title])=>({id,title,available:true,writeEnabled:false}))});
   if(url.pathname.startsWith("/api/v1/modules/"))return json({module:url.pathname.split("/").pop(),source:"DEMO",readOnly:true,rows:[{ID:"TEST-001",Status:"BEISPIEL",Beschreibung:"Nur Demoansicht – keine Echtinformationen"}]});
   if(url.pathname==="/api/v1/docs")return json({docs:[]});
   if(url.pathname==="/api/v1/db2")return json({sections:[{id:"dienstbuch",title:"DB2_Dienstbuch",editable:true},{id:"nachrichten",title:"DB2_Nachrichten",editable:true},{id:"wissen",title:"DB2_Wissen",editable:true}]});
   if(/^\/api\/v1\/db2\/[a-z-]+$/.test(url.pathname))return json({section:url.pathname.split("/").pop(),title:"Nur Demo",columns:["ID","Text","Status"],editable:false,writable:[],entries:[]});
   if(url.pathname==="/api/v1/links")return json({links:[]});
   return err(404,"Demo-Endpunkt nicht vorhanden");
 }
 let identity;
 try{identity=await accessIdentity(request,env)}catch(e){return err(403,e.message)}
 if(url.pathname==="/api/v1/me")return json({user:identity.email,role:identity.role,demo:false});
 if(request.method!=="GET"&&identity.role==="viewer")return err(403,"Keine Schreibberechtigung");
 if(!env.API_ORIGIN||!env.BAZ4_INTERNAL_TOKEN||!env.ACCESS_SERVICE_TOKEN_ID||!env.ACCESS_SERVICE_TOKEN_SECRET)
   return err(503,"Serverzugang nicht vollständig konfiguriert");
 if(!["GET","POST","PUT"].includes(request.method))return err(405,"Methode gesperrt");
 const path=url.pathname.slice(4);
 if(!/^\/v1\/(?:health|modules(?:\/[a-z0-9-]+)?|docs(?:\/[a-f0-9]{32}(?:\/(?:download|versions|restore\/\d+))?)?|db2(?:\/[a-z-]+(?:\/[a-f0-9]{32})?)?|links(?:\/[a-f0-9]{24}(?:\/(?:status|files|download|replace))?)?)$/.test(path))
   return err(404,"Unbekannte API-Funktion");
 const base=String(env.API_ORIGIN).replace(/\/$/,"");
 if(!base.startsWith("https://"))return err(503,"API_ORIGIN muss HTTPS verwenden");
 const upstream=new URL(base+path);
 if(path.includes("/links/") && (path.endsWith("/download")||path.endsWith("/files"))) {const targetFile=url.searchParams.get("file"); if(targetFile)upstream.searchParams.set("file",targetFile)}
 const headers=new Headers();
 for(const name of ["content-type","accept"]) {let value=request.headers.get(name);if(value)headers.set(name,value)}
 headers.set("X-BAZ-Internal-Token",env.BAZ4_INTERNAL_TOKEN);
 headers.set("X-BAZ-User",identity.email);
 headers.set("X-BAZ-Role",identity.role);
 headers.set("CF-Access-Client-Id",env.ACCESS_SERVICE_TOKEN_ID);
 headers.set("CF-Access-Client-Secret",env.ACCESS_SERVICE_TOKEN_SECRET);
 try {
   const response=await fetch(upstream.href,{method:request.method,headers,body:request.method==="GET"?undefined:request.body,redirect:"manual"});
   if(response.status>=300&&response.status<400)return err(502,"Unerwartete Weiterleitung am Server");
   let outbound=new Headers(corsless);
   for(const name of ["content-type","content-disposition"])if(response.headers.has(name))outbound.set(name,response.headers.get(name));
   return new Response(response.body,{status:response.status,headers:outbound});
 }catch{return err(503,"BAZ-Server derzeit nicht erreichbar")}
}
export default {
 async fetch(request,env){
   const u=new URL(request.url);
   if(u.pathname.startsWith("/api/"))return handleApi(request,env,u);
   if(request.method!=="GET"&&request.method!=="HEAD")return err(405,"Methode gesperrt");
   if(u.pathname==="/"||u.pathname.startsWith("/app/")){
     const copy=new URL(request.url); copy.pathname="/index.html";
     return env.ASSETS.fetch(new Request(copy,request));
   }
   return env.ASSETS.fetch(request);
 }
};