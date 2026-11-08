import {dialog,type BrowserWindow} from 'electron';
import {readFile,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {unpackedResource} from './native-path';
import path from 'node:path';
import {z} from 'zod';
import {type openStore} from './database';
import {parseSongFile,previewSongImport} from './songs';
import {createSongFiles,songLocks,setWorkspaceLocation} from './workspace';
export function songHandlers(store:ReturnType<typeof openStore>,win:BrowserWindow,root:string,userData:string){
 const pending=new Map<string,{songs:ReturnType<typeof parseSongFile>;createdAt:number}>(),locks=songLocks(root),files=createSongFiles(root,store,locks);
 const persist=(ids?:ReadonlySet<string>)=>files.persist(false,ids),sync=()=>files.sync(),withLocks=locks.withLocks;let optimizing=false;
 const runOptimizer=(action:'preview'|'optimize',expectedCopies?:number)=>{
  if(optimizing)throw new Error('Library optimization is already running.');optimizing=true;
  return new Promise<unknown>((resolve,reject)=>{
   let settled=false;let worker:Worker;
   try{worker=new Worker(unpackedResource(path.join(__dirname,'song-optimize-worker.cjs')),{workerData:{root,action,expectedCopies}});}catch(error){optimizing=false;reject(error);return;}
   const finish=(error?:Error,value?:unknown)=>{if(settled)return;settled=true;optimizing=false;error?reject(error):resolve(value);};
   worker.on('message',(message:{type:string;stage?:string;value?:unknown;message?:string})=>{if(message.type==='progress'&&!win.isDestroyed())win.webContents.send('songs:optimize-progress',message.stage);else if(message.type==='result')finish(undefined,message.value);else if(message.type==='error')finish(new Error(message.message||'Optimization failed.'));});
   worker.once('error',error=>finish(error));worker.once('exit',code=>{if(!settled)finish(new Error(`Optimization stopped unexpectedly (${code}).`));});
  });
 };
 return {locks,files,persist,sync,withLocks,isOptimizing:()=>optimizing,close(){pending.clear();files.close();locks.close();},handlers:{
  'songs:lock':(_e:Electron.IpcMainInvokeEvent,v:unknown)=>locks.acquire(z.string().uuid().parse(v)),
  'songs:unlock':(_e:Electron.IpcMainInvokeEvent,v:unknown)=>locks.release(z.string().uuid().parse(v)),
  'songs:import-preview':async()=>{
   const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Songs (JSON, XML, text)',extensions:['json','xml','txt']}]});if(result.canceled)return null;
   const file=result.filePaths[0];if((await stat(file)).size>30_000_000)throw new Error('Song file exceeds 30 MB.');
   const content=await readFile(file,'utf8'),ext=path.extname(file).toLowerCase();
   const format=ext==='.json'?'json':ext==='.txt'?'text':/openlyrics\.info\/namespace/i.test(content)?'openlyrics':/<(?:songbook|songs|openlp)[\s>]/i.test(content)?'openlp':'opensong';
   const candidates=parseSongFile(content,format,path.basename(file));const token=randomUUID();pending.clear();pending.set(token,{songs:candidates,createdAt:Date.now()});const warnings=format==='openlyrics'&&/<(?:instrument|beat|tag)\b|<lines\s+[^>]*repeat\s*=|<chord\s+[^>]*structure\s*=/i.test(content)?['Some formatting or chord details may not import.']:[];return {token,format,warnings,candidates:previewSongImport(candidates,store.listSongs())};
  },
  'songs:import-commit':(_e:Electron.IpcMainInvokeEvent,v:unknown)=>{
   const input=z.object({token:z.string().uuid(),indices:z.array(z.number().int().min(0)).min(1).max(10000)}).parse(v),preview=pending.get(input.token);if(!preview||Date.now()-preview.createdAt>15*60*1000){pending.delete(input.token);throw new Error('Import expired. Choose the file again.');}const candidates=preview.songs;
   const indices=[...new Set(input.indices)];if(indices.some(n=>n>=candidates.length))throw new Error('Invalid import selection.');
   store.importSongs({format:'worship-studio-songs-v1',songs:indices.map(n=>candidates[n])});pending.delete(input.token);persist();return 'Imported '+indices.length+' songs.';
  },
  'songs:tools':async(_e:Electron.IpcMainInvokeEvent,v:unknown)=>{
   const {action,payload}=z.object({action:z.enum(['delete','optimize-preview','optimize']),payload:z.any()}).parse(v);
   if(action==='optimize-preview')return runOptimizer('preview');
   if(action==='optimize'){
    const input=z.object({expectedCopies:z.number().int().min(0)}).strict().parse(payload);return runOptimizer('optimize',input.expectedCopies);
   }
   const x=z.object({ids:z.array(z.string().uuid()).min(1).max(10000)}).parse(payload);
   if(action==='delete'){withLocks(x.ids,()=>{files.markDeleted(x.ids);store.deleteSongs(x.ids);persist();});return 'Selected songs deleted.';}
  },
  'workspace:choose':async()=>{
   const result=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory'],title:'Choose a workspace folder (used after restarting)'});
   if(result.canceled)return 'Workspace change canceled.';
   setWorkspaceLocation(userData,result.filePaths[0]);return 'Workspace folder saved. Restart Worship Studio to use it. Current data stays in this folder.';
  }
 }};
}
