import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {z} from 'zod';
import {toDataURL} from 'qrcode';
export const RemoteCommand=z.discriminatedUnion('action',[
 z.object({action:z.enum(['next','previous','blackout','logo','live'])}).strict(),
 z.object({action:z.literal('goto'),itemId:z.string().uuid(),index:z.number().int().min(0).max(999).default(0)}).strict()
]);
export type RemoteCommand=z.infer<typeof RemoteCommand>;
export type RemotePublicState={title:string;text:string;blackout:boolean;logo:boolean;index:number;items:{id:string;title:string;slideCount:number}[]};
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Worship Studio Remote</title><style>*{box-sizing:border-box}body{font:18px system-ui;background:#14252e;color:#fff;max-width:650px;margin:auto;padding:20px}button,input{font:inherit;padding:16px;border:1px solid #73928c;border-radius:8px;min-height:58px;background:#23443f;color:#fff;width:100%}button:disabled{opacity:.5}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}#preview{aspect-ratio:16/9;background:#000;display:grid;place-items:center;padding:20px;white-space:pre-wrap;text-align:center;margin:16px 0;overflow:auto}#status{min-height:30px}#items{display:grid;gap:10px;margin-top:20px}label{display:block;margin-bottom:10px}input{margin-top:10px}.hidden{display:none}:focus-visible{outline:3px solid #8fe8d8;outline-offset:3px}</style><h1>Worship Studio</h1><p id="status" role="status">Pair with the operator's PIN.</p><form id="pair"><label>Pairing PIN<input name="pin" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button>Pair phone</button></form><main id="controls" class="hidden"><h2 id="title">Current slide</h2><div id="preview"></div><div class="grid"><button data-action="previous">Previous</button><button data-action="next">Next</button><button data-action="blackout">Blackout</button><button data-action="logo">Logo</button><button data-action="live">Send preview live</button><button id="unpair">Unpair</button></div><h2>Service order</h2><div id="items"></div></main><script src="/remote.js"></script></html>`;
const script=`let token=sessionStorage.getItem('studio-token')||'',timer,lastItems='';const status=document.getElementById('status'),pair=document.getElementById('pair'),controls=document.getElementById('controls');async function api(path,body){const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw new Error(value.error||'Remote request failed');return value;}function paired(yes){pair.classList.toggle('hidden',yes);controls.classList.toggle('hidden',!yes);if(!yes){token='';sessionStorage.removeItem('studio-token');clearInterval(timer);}else{clearInterval(timer);timer=setInterval(update,500);update();}}async function update(){try{const s=await api('state');status.textContent=s.blackout?'Blackout is on':s.logo?'Logo is on':'Connected';document.getElementById('title').textContent=s.title||'Nothing live';document.getElementById('preview').textContent=s.blackout?'Black output':s.logo?'Worship Studio':s.text;const encoded=JSON.stringify(s.items);if(encoded!==lastItems){lastItems=encoded;const list=document.getElementById('items');list.replaceChildren();for(const item of s.items){const b=document.createElement('button');b.textContent=item.title+' ('+item.slideCount+' slides)';b.onclick=()=>command({action:'goto',itemId:item.id,index:0});list.append(b);}}}catch(e){status.textContent=e.message;if(/pair|expired|authorized/i.test(e.message))paired(false);}}async function command(value){try{await api('command',value);await update();}catch(e){status.textContent=e.message;}}pair.onsubmit=async e=>{e.preventDefault();try{const result=await api('pair',{pin:new FormData(pair).get('pin')});token=result.token;sessionStorage.setItem('studio-token',token);paired(true);}catch(e){status.textContent=e.message;}};for(const b of document.querySelectorAll('[data-action]'))b.onclick=()=>command({action:b.dataset.action});document.getElementById('unpair').onclick=async()=>{try{await api('unpair',{});}finally{paired(false);}};if(token)paired(true);`;
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function createRemote({getState,command,onLog,now=Date.now}:{getState:()=>RemotePublicState;command:(command:RemoteCommand)=>Promise<void>;onLog:(message:string)=>void;now?:()=>number}){
 let server:ReturnType<typeof createServer>|null=null,pin='',pinExpires=0,urls:string[]=[],port=0,cancelStart:(()=>void)|null=null;
 const sessions=new Map<string,number>(),attempts=new Map<string,{count:number;reset:number}>(),commands=new Map<string,{count:number;reset:number}>();
 const status=()=>{for(const[token,expires]of sessions)if(expires<=now()){sessions.delete(token);commands.delete(token);}return{enabled:server?.listening===true,pin,pinExpires,urls:[...urls],port,paired:sessions.size};};
 const stop=async()=>{const running=server;server=null;cancelStart?.();cancelStart=null;pin='';pinExpires=0;urls=[];port=0;sessions.clear();attempts.clear();commands.clear();if(running)await new Promise<void>(resolve=>{running.close(()=>resolve());running.closeAllConnections();});onLog('Phone remote stopped; all sessions revoked.');return status();};
 const mintPin=()=>{pin=String(randomInt(100000,1000000));pinExpires=now()+5*60_000;};
 const rotate=()=>{if(!server?.listening)throw new Error('Phone remote is disabled. Enable it before creating a pairing PIN.');mintPin();return status();};
 const body=async(req:IncomingMessage)=>{if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Use JSON requests.');let text='';for await(const chunk of req){text+=chunk.toString();if(Buffer.byteLength(text)>4096)throw new Error('Request too large.');}return JSON.parse(text||'{}') as unknown;};
 const startServer=async()=>{
  if(server)return status();mintPin();
  const hosts=new Set<string>(['127.0.0.1','localhost',...Object.values(networkInterfaces()).flatMap(list=>(list||[]).filter(n=>n.family==='IPv4').map(n=>n.address))]);
  server=createServer(async(req:IncomingMessage,res:ServerResponse)=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'");
   const json=(code:number,value:unknown)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
   try{
    const host=req.headers.host||'',valid=[...hosts].some(h=>host===h+':'+port);if(!valid){json(403,{error:'Unknown remote host.'});return;}
    const origin=req.headers.origin;if(origin&&origin!=='http://'+host){json(403,{error:'Untrusted request origin.'});return;}
    const route=req.url?.split('?')[0];
    if(req.method==='GET'&&(route==='/'||route==='/remote.js')){res.writeHead(200,{'Content-Type':route==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8'});res.end(route==='/'?page:script);return;}
    if(req.method==='POST'&&route==='/api/pair'){
     const address=req.socket.remoteAddress||'',current=now();if(attempts.size>=200)for(const [key,value]of attempts)if(value.reset<=current)attempts.delete(key);
     if(attempts.size>=200&&!attempts.has(address)){json(429,{error:'Too many pairing clients. Try again in one minute.'});return;}
     const attempt=attempts.get(address);if(attempt&&attempt.reset>current&&attempt.count>=5){json(429,{error:'Too many pairing attempts. Wait one minute.'});return;}
     attempts.set(address,{count:attempt&&attempt.reset>current?attempt.count+1:1,reset:attempt&&attempt.reset>current?attempt.reset:current+60_000});
     const input=z.object({pin:z.string().regex(/^\d{6}$/)}).strict().parse(await body(req));
     if(current>=pinExpires||!equal(input.pin,pin)){onLog('Phone pairing rejected.');json(401,{error:'PIN incorrect or expired. Ask the operator for a new PIN.'});return;}
     status();if(sessions.size>=10){json(429,{error:'Maximum paired remotes reached.'});return;}
     const token=randomBytes(32).toString('hex');sessions.set(token,current+12*60*60_000);onLog('Phone paired.');json(200,{token});return;
    }
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');const expires=sessions.get(token);if(!expires||expires<=now()){sessions.delete(token);commands.delete(token);json(401,{error:'Pair this phone again; session expired or unauthorized.'});return;}
    if(req.method==='POST'&&route==='/api/unpair'){z.object({}).strict().parse(await body(req));sessions.delete(token);commands.delete(token);onLog('Phone unpaired.');json(200,{ok:true});return;}
    if(req.method==='GET'&&route==='/api/state'){json(200,getState());return;}
    if(req.method==='POST'&&route==='/api/command'){const current=now(),recent=commands.get(token);if(recent&&recent.reset>current&&recent.count>=60){json(429,{error:'Too many remote commands. Wait ten seconds.'});return;}commands.set(token,{count:recent&&recent.reset>current?recent.count+1:1,reset:recent&&recent.reset>current?recent.reset:current+10_000});const input=RemoteCommand.parse(await body(req));await command(input);onLog('Phone action: '+input.action+(input.action==='goto'?' '+input.itemId:''));json(200,{ok:true});return;}
    json(404,{error:'Unknown remote action.'});
   }catch(error){json(400,{error:error instanceof z.ZodError?'Invalid remote request.':error instanceof Error?error.message:'Remote request failed.'});}
  });
  const candidate=server;
  candidate.requestTimeout=5000;candidate.headersTimeout=5000;candidate.maxConnections=30;
  try{await new Promise<void>((resolve,reject)=>{cancelStart=resolve;candidate.once('error',reject);candidate.listen(0,'0.0.0.0',()=>{cancelStart=null;resolve();});});}
  catch(error){if(server===candidate){server=null;pin='';pinExpires=0;urls=[];port=0;}candidate.close();throw error;}
  if(server!==candidate){candidate.close();candidate.closeAllConnections();return status();}
  const address=candidate.address();if(!address||typeof address==='string')throw new Error('Remote server failed to start.');port=address.port;urls=[...hosts].filter(h=>h!=='localhost').map(h=>'http://'+h+':'+port);
  onLog('Phone remote enabled on port '+port+'.');return status();
 };
 let starting:Promise<ReturnType<typeof status>>|null=null;
 const start=()=>{if(starting)return starting;starting=startServer().finally(()=>{starting=null;});return starting;};
 return {start,stop,status,rotate,qr:async(url:string)=>{if(!urls.includes(url))throw new Error('Choose a local remote URL.');return toDataURL(url,{width:240,margin:2});}};
}
