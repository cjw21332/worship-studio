import {dialog,type BrowserWindow} from 'electron';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {z} from 'zod';
import {type openStore} from './database';
import {parseSongFile,previewSongImport,exportSongs} from './songs';
import {createSongFiles,songLocks,setWorkspaceLocation} from './workspace';
import {exportOpenLyrics} from './openlyrics';
import JSZip from 'jszip';
export function songHandlers(store:ReturnType<typeof openStore>,win:BrowserWindow,root:string,userData:string){
 const pending=new Map<string,{songs:ReturnType<typeof parseSongFile>;createdAt:number}>(),locks=songLocks(root),files=createSongFiles(root,store,locks);
 const persist=()=>files.persist(),sync=()=>files.sync(),withLocks=locks.withLocks;
 return {locks,files,persist,sync,withLocks,close(){pending.clear();files.close();locks.close();},handlers:{
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
   const {action,payload}=z.object({action:z.enum(['rename','merge','delete','history','export','optimize']),payload:z.any()}).parse(v);
   if(action==='history')return store.usageHistory();
   if(action==='optimize')return store.optimizeSongs();
   if(action==='rename'){const x=z.object({changes:z.array(z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(200)})).min(1).max(10000)}).parse(payload);withLocks(x.changes.map(s=>s.id),()=>{store.bulkRenameSongs(x.changes);persist();});return 'Songs renamed.';}
   if(action==='merge'){const x=z.object({keepId:z.string().uuid(),removeIds:z.array(z.string().uuid()).min(1).max(10000)}).parse(payload);withLocks([x.keepId,...x.removeIds],()=>{files.markDeleted(x.removeIds);store.mergeSongs(x.keepId,x.removeIds);persist();});return 'Songs merged. Existing service snapshots kept.';}
   const x=z.object({ids:z.array(z.string().uuid()).min(1).max(10000),format:z.enum(['json','text','fields','openlyrics']).default('json')}).parse(payload);
   if(action==='delete'){withLocks(x.ids,()=>{files.markDeleted(x.ids);store.deleteSongs(x.ids);persist();});return 'Selected songs deleted.';}
   const songs=store.listSongs().filter(s=>x.ids.includes(s.id));if(songs.length!==new Set(x.ids).size)throw new Error('Song selection changed. Refresh and try again.');
   const filename=x.format==='json'?'songs.json':x.format==='openlyrics'?(songs.length===1?'song.xml':'songs-openlyrics.zip'):'songs.txt';
   const result=await dialog.showSaveDialog(win,{defaultPath:filename});if(result.canceled||!result.filePath)return 'Song export canceled.';
   if(x.format==='openlyrics'){
    const rendered=songs.map(exportOpenLyrics),warnings=rendered.flatMap(r=>r.warnings);
    if(songs.length===1)await writeFile(result.filePath,rendered[0].xml,'utf8');else{const zip=new JSZip();songs.forEach((song,index)=>zip.file(`${String(index+1).padStart(4,'0')}-${song.title.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,100)}.xml`,rendered[index].xml));await writeFile(result.filePath,await zip.generateAsync({type:'nodebuffer'}));}
    return {exported:songs.length,warnings};
   }
   await writeFile(result.filePath,exportSongs(songs,x.format),'utf8');return 'Selected songs exported.';
  },
  'workspace:choose':async()=>{
   const result=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory'],title:'Choose a workspace folder (used after restarting)'});
   if(result.canceled)return 'Workspace change canceled.';
   setWorkspaceLocation(userData,result.filePaths[0]);return 'Workspace folder saved. Restart Worship Studio to use it. Current data stays in this folder.';
  }
 }};
}
