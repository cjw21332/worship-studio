import {appendFileSync,existsSync,mkdirSync,readFileSync,renameSync,statSync,unlinkSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {BrowserWindow} from 'electron';
import {z} from 'zod';

const safeEvent=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/i);
const safeVersion=(value:unknown)=>typeof value==='string'&&/^[a-z0-9.+_-]{1,80}$/i.test(value)?value:'unknown';
const numericKeys=new Set(['durationMs','startupMs','latencyMs','count','itemCount','songCount','assetCount','translationCount','windowCount','width','height','displayId','revision','bytes','rssBytes','heapUsedBytes','heapTotalBytes','externalBytes','privateKB','sharedKB','exitCode','code','total','completed']);
const enumValues:Record<string,Set<string>>={errorName:new Set(['Error','TypeError','RangeError','SyntaxError','ReferenceError','URIError','EvalError','ZodError','AggregateError']),role:new Set(['operator','audience','audience-secondary','stage','confidence','rehearsal']),status:new Set(['ready','failed','started','stopped','armed','disarmed','connected','disconnected','blackout','frozen']),operation:new Set(['startup','slide','import','export','output','database','remote','backup','update']),platform:new Set(['win32','darwin','linux']),level:new Set(['info','warning','error'])};
export function sanitizeDiagnostics(input:unknown):Record<string,number|string|boolean>{
 const result:Record<string,number|string|boolean>={};if(!input||typeof input!=='object'||Array.isArray(input))return result;
 for(const [key,value]of Object.entries(input)){
  if(numericKeys.has(key)&&typeof value==='number'&&Number.isFinite(value))result[key]=Math.round(value*100)/100;
  else if(enumValues[key]?.has(String(value)))result[key]=String(value);
  else if(['appVersion','electronVersion','chromeVersion','nodeVersion'].includes(key))result[key]=safeVersion(value);
  else if(['armed','blackout','freeze','connected','windowed','isPackaged','remoteEnabled'].includes(key)&&typeof value==='boolean')result[key]=value;
 }
 return result;
}
export type DiagnosticLevel='info'|'warning'|'error';
export type DiagnosticSnapshot={format:'worship-studio-diagnostics-v1';generatedAt:string;runtime:Record<string,string|number|boolean>;counters:Record<string,string|number|boolean>;outputs:Record<string,string|number|boolean>[];metrics:{name:string;count:number;minimumMs:number;maximumMs:number;averageMs:number;p95Ms:number}[];logs:Record<string,unknown>[]};
const allowedErrorNames=new Set(['Error','TypeError','RangeError','SyntaxError','ReferenceError','URIError','EvalError','ZodError','AggregateError']);
export function createDiagnostics(options:{directory:string;version:string;isPackaged?:boolean;maxBytes?:number;backups?:number;getCounters?:()=>unknown;getOutputs?:()=>unknown[]}){
 const directory=path.resolve(options.directory);
 try{mkdirSync(directory,{recursive:true});}catch{/* Diagnostics must remain usable in memory when the log directory is unwritable. */}
 const file=path.join(directory,'studio.log'),maxBytes=Math.min(5_000_000,Math.max(2048,options.maxBytes??256_000)),backups=Math.min(10,Math.max(1,options.backups??4)),metrics=new Map<string,number[]>();
 let closed=false;
 const rotate=()=>{
  if(!existsSync(file)||statSync(file).size<maxBytes)return;
  const last=file+'.'+backups;if(existsSync(last))unlinkSync(last);
  for(let index=backups-1;index>=1;index--){const current=file+'.'+index;if(existsSync(current))renameSync(current,file+'.'+(index+1));}
  renameSync(file,file+'.1');
 };
 const log=(level:DiagnosticLevel,event:string,details?:unknown)=>{
  if(closed)return;safeEvent.parse(event);z.enum(['info','warning','error']).parse(level);
  try{rotate();appendFileSync(file,JSON.stringify({at:new Date().toISOString(),level,event,...sanitizeDiagnostics(details)})+'\n','utf8');}catch{/* Logging failures must never change the audience output. */}
 };
 const error=(event:string,value:unknown,details?:unknown)=>{
  const name=value instanceof Error&&allowedErrorNames.has(value.name)?value.name:'Error';
  // Error messages/stacks can embed filenames, credentials or scripture/lyrics. Record only classification.
  log('error',event,{...sanitizeDiagnostics(details),errorName:name});
 };
 const measure=(name:string,milliseconds:number)=>{safeEvent.parse(name);if(!Number.isFinite(milliseconds)||milliseconds<0)return;const values=metrics.get(name)||[];values.push(milliseconds);if(values.length>1000)values.shift();if(metrics.has(name)||metrics.size<100)metrics.set(name,values);log('info','performance.'+name.slice(0,60),{durationMs:milliseconds});};
 const startTimer=(name:string)=>{const start=performance.now();return ()=>{const elapsed=performance.now()-start;measure(name,elapsed);return elapsed;};};
 const observeWindow=(win:BrowserWindow,role='operator')=>{
  const started=performance.now(),ready=()=>measure(role+'.load',performance.now()-started),gone=(_event:unknown,details:{exitCode:number})=>error('renderer.gone',null,{role,exitCode:details.exitCode}),unresponsive=()=>log('warning','renderer.unresponsive',{role});
  win.webContents.once('did-finish-load',ready);win.webContents.on('render-process-gone',gone);win.on('unresponsive',unresponsive);
  return ()=>{if(!win.isDestroyed()){win.webContents.removeListener('did-finish-load',ready);win.webContents.removeListener('render-process-gone',gone);win.removeListener('unresponsive',unresponsive);}};
 };
 const snapshot=():DiagnosticSnapshot=>{
  const memory=process.memoryUsage(),summary=[...metrics].map(([name,values])=>{const sorted=[...values].sort((a,b)=>a-b);return {name,count:values.length,minimumMs:Math.round(sorted[0]*100)/100,maximumMs:Math.round(sorted.at(-1)!*100)/100,averageMs:Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100,p95Ms:Math.round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]*100)/100};});
  let counters:Record<string,string|number|boolean>={},outputs:Record<string,string|number|boolean>[]=[],logs:Record<string,unknown>[]=[];
  try{counters=sanitizeDiagnostics(options.getCounters?.());}catch{/* Counts are best effort. */}
  try{outputs=(options.getOutputs?.()||[]).map(sanitizeDiagnostics);}catch{/* Output may be closing. */}
  try{logs=readFileSync(file,'utf8').trim().split('\n').slice(-100).filter(Boolean).map(line=>{const row=JSON.parse(line);return {at:typeof row.at==='string'&&/^\d{4}-\d\d-\d\dT/.test(row.at)?row.at:'',event:safeEvent.safeParse(row.event).success?row.event:'invalid',level:['info','warning','error'].includes(row.level)?row.level:'info',...sanitizeDiagnostics(row)};});}catch{/* A partial last line is safe to omit. */}
  return {format:'worship-studio-diagnostics-v1',generatedAt:new Date().toISOString(),runtime:{appVersion:safeVersion(options.version),electronVersion:safeVersion(process.versions.electron),chromeVersion:safeVersion(process.versions.chrome),nodeVersion:safeVersion(process.versions.node),platform:os.platform(),architecture:os.arch(),isPackaged:!!options.isPackaged,rssBytes:memory.rss,heapUsedBytes:memory.heapUsed},counters,outputs,metrics:summary,logs};
 };
 const report=()=>JSON.stringify(snapshot(),null,2);
 log('info','diagnostics.started',{appVersion:options.version,isPackaged:!!options.isPackaged});
 return {log,error,measure,startTimer,observeWindow,snapshot,report,exportReport:(destination:string)=>{if(!path.isAbsolute(destination))throw new Error('Choose an absolute diagnostic destination.');writeFileSync(destination,report(),'utf8');},directory,close:()=>{log('info','diagnostics.stopped');closed=true;}};
}
