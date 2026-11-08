import {mkdirSync,readFileSync,writeFileSync,openSync,closeSync,unlinkSync,existsSync,renameSync,readdirSync,lstatSync,fsyncSync,rmdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {hostname} from 'node:os';
import {z} from 'zod';
import {normalizeSong,type Song,type SongContent} from './songs';
import type {openStore} from './database';

export function workspaceLocation(userData:string){
 try{const config=z.object({path:z.string().min(1).max(32767)}).parse(JSON.parse(readFileSync(path.join(userData,'workspace-location.json'),'utf8')));return path.isAbsolute(config.path)?path.resolve(config.path):userData;}catch{return userData;}
}
export function setWorkspaceLocation(userData:string,directory:string){
 if(!path.isAbsolute(directory))throw new Error('Choose an absolute workspace folder.');
 mkdirSync(directory,{recursive:true});mkdirSync(userData,{recursive:true});
 atomicJSON(path.join(userData,'workspace-location.json'),{path:path.resolve(directory)});
}
function atomicJSON(file:string,value:unknown){
 const temporary=file+'.'+randomUUID()+'.tmp';let fd:number|undefined;
 try{fd=openSync(temporary,'wx');writeFileSync(fd,JSON.stringify(value,null,2),'utf8');fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temporary,file);}
 finally{if(fd!==undefined)closeSync(fd);if(existsSync(temporary))unlinkSync(temporary);}
}
const UUID=z.string().uuid();
const Owner=z.object({pid:z.number().int().positive(),host:z.string().min(1).max(255),nonce:z.string().uuid()});
export function songLocks(directory:string){
 const root=path.join(directory,'locks');mkdirSync(root,{recursive:true});
 const owned=new Map<string,string>();
 const lockPath=(id:string)=>path.join(root,UUID.parse(id).toLowerCase()+'.lock');
 const ownerAt=(id:string)=>{try{return Owner.parse(JSON.parse(readFileSync(lockPath(id),'utf8')));}catch{return null;}};
 const verify=(id:string)=>{const nonce=owned.get(id);return !!nonce&&ownerAt(id)?.nonce===nonce;};
 const release=(id:string)=>{if(verify(id))unlinkSync(lockPath(id));owned.delete(id);};
 const create=(id:string)=>{const nonce=randomUUID(),fd=openSync(lockPath(id),'wx');try{writeFileSync(fd,JSON.stringify({pid:process.pid,host:hostname(),nonce,openedAt:new Date().toISOString()}));fsyncSync(fd);owned.set(id,nonce);}finally{closeSync(fd);}};
 const acquire=(id:string)=>{
  UUID.parse(id);
  if(owned.has(id)){if(!verify(id))throw new Error('Song lock ownership changed. Close this editor and sync the workspace.');return;}
  try{create(id);return;}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  const recovery=path.join(root,UUID.parse(id).toLowerCase()+'.recovery');
  try{mkdirSync(recovery);}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new Error('Song lock recovery is already in progress. Close the other copy before trying again.');throw error;}
  try{
   const owner=ownerAt(id);let stale=false;
   if(owner?.host===hostname()){try{process.kill(owner.pid,0);}catch(error){stale=(error as NodeJS.ErrnoException).code==='ESRCH';}}
   if(!stale)throw new Error('This song is being edited by another copy. Close its editor before trying again.');
   unlinkSync(lockPath(id));create(id);
  }finally{rmdirSync(recovery);}
 };
 const withLocks=<T>(ids:string[],operation:()=>T):T=>{
  const acquired:string[]=[];
  const cleanup=()=>{for(const id of acquired.reverse())release(id);};
  try{
   for(const id of [...new Set(ids)].sort()){const already=owned.has(id);acquire(id);if(!already)acquired.push(id);}
   const result=operation();
   if(result&&typeof result==='object'&&'then' in result)return Promise.resolve(result).finally(cleanup) as T;
   cleanup();return result;
  }catch(error){cleanup();throw error;}
 };
 return {acquire,release,withLocks,owns:(id:string)=>verify(id),isLocked:(id:string)=>existsSync(lockPath(id)),close(){for(const id of [...owned.keys()])release(id);}};
}
export type SyncReport={imported:number;written:number;deleted:number;conflicts:string[];errors:string[]};
const blankReport=():SyncReport=>({imported:0,written:0,deleted:0,conflicts:[],errors:[]});
const canonical=(song:Song|({id:string}&SongContent))=>{const normalized=normalizeSong(song);return {id:UUID.parse(song.id).toLowerCase(),...normalized};};
type CanonicalSong=ReturnType<typeof canonical>;
const fingerprint=(song:CanonicalSong)=>createHash('sha256').update(JSON.stringify(song)).digest('hex');
// Import/migration timestamps are bookkeeping, not competing lyric edits.
const sameContent=(a:CanonicalSong,b:CanonicalSong)=>{
 const {createdAt:ac,updatedAt:au,...left}=a;
 const {createdAt:bc,updatedAt:bu,...right}=b;
 return JSON.stringify(left)===JSON.stringify(right);
};
const Tombstone=z.object({id:UUID,deletedAt:z.string().datetime({offset:true}),baseHash:z.string().regex(/^[a-f0-9]{64}$/)});
type Tombstone=z.infer<typeof Tombstone>;
const MAX_FILE_BYTES=5_000_000;
function readJSON(file:string){
 const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Song files must be regular files.');
 if(stat.size>MAX_FILE_BYTES)throw new Error('Song file exceeds 5 MB.');return JSON.parse(readFileSync(file,'utf8'));
}
function readSong(file:string,id:string):CanonicalSong{
 const input=readJSON(file);if(UUID.parse(input.id).toLowerCase()!==id.toLowerCase())throw new Error('Song ID does not match its filename.');
 z.object({createdAt:z.string().datetime({offset:true}),updatedAt:z.string().datetime({offset:true})}).parse(input);
 return canonical(input);
}
export function createSongFiles(directory:string,store:ReturnType<typeof openStore>,locks:ReturnType<typeof songLocks>){
 const root=path.join(directory,'songs'),tombstones=path.join(root,'tombstones'),conflicts=path.join(root,'conflicts'),deleted=path.join(root,'deleted');
 for(const folder of [root,tombstones,conflicts,deleted])mkdirSync(folder,{recursive:true});
 const baseline=new Map<string,string>(),pendingDeletion=new Map<string,CanonicalSong>();let closed=false;
 const reportedConflicts=new Map<string,string>();
 const fileFor=(id:string)=>path.join(root,UUID.parse(id).toLowerCase()+'.json');
 const tombFor=(id:string)=>path.join(tombstones,UUID.parse(id).toLowerCase()+'.json');
 const readTomb=(id:string)=>{const file=tombFor(id);if(!existsSync(file))return undefined;const value=Tombstone.parse(readJSON(file));if(value.id.toLowerCase()!==id.toLowerCase())throw new Error('Deletion marker ID does not match its filename.');return value;};
 const preserve=(song:CanonicalSong,kind:'local'|'remote')=>{const file=path.join(conflicts,song.id+'-'+fingerprint(song).slice(0,16)+'-'+kind+'.json');if(!existsSync(file))atomicJSON(file,song);};
  // Check if two songs have the same core content (ignoring timestamps)
  const sameContent=(a:CanonicalSong,b:CanonicalSong)=>{
    const {createdAt:ac,updatedAt:au,...left}=a;
    const {createdAt:bc,updatedAt:bu,...right}=b;
    return JSON.stringify(left)===JSON.stringify(right);
  };
  // Attempt to intelligently merge local and remote song edits.
  // Returns [mergedSong, hasConflict] where hasConflict=true means a true conflict was detected
  // (same field edited differently), and we should keep the local version.
  const tryMergeSongs=(local:CanonicalSong,remote:CanonicalSong):[CanonicalSong,boolean]=>{
    // If content is the same, no merge needed
    if(sameContent(local,remote))return[local,false];
    // Start with a shallow copy of local
    const merged:Record<string,unknown>={...local};
    let hasConflict=false;
    // Merge field by field, preferring local for true conflicts
    const mergeField=<K extends keyof CanonicalSong>(field:K)=>{
      const localVal=local[field];
      const remoteVal=remote[field];
      // If only remote has the field, take it (remote addition)
      if(localVal===undefined&&remoteVal!==undefined){merged[field]=remoteVal;return;}
      // If both have the field and values are the same, no conflict
      if(localVal===remoteVal){return;}
      // If both have different values, it's a true conflict - keep local
      if(localVal!==remoteVal){
        hasConflict=true; // Keep local version (already set as base)
        return;
      }
    };
    // Fields that are safe to merge (non-critical metadata)
    const safeToMerge:Array<keyof CanonicalSong>=['publisher','ccliNumber','key','tags','language','notes','tempo'];
    const mergeFields:Array<keyof CanonicalSong>=[...safeToMerge,'author','copyright'];
    for(const field of mergeFields){
      mergeField(field);
    }
    // For lyrics and title, true conflict - keep local
    for(const field of ['lyrics','title'] as Array<keyof CanonicalSong>){
      mergeField(field);
    }
    // For sections and arrangement, try to merge if they don't overlap
    if(!hasConflict){
      const localSections=local.sections||[];
      const remoteSections=remote.sections||[];
      const localArrangement=local.arrangement||[];
      const remoteArrangement=remote.arrangement||[];
      // Merge sections - add remote sections that local doesn't have
      const localSectionIds=new Set(localSections.map(s=>s.id));
      for(const rs of remoteSections){
        if(!localSectionIds.has(rs.id)){merged.sections= [...localSections,rs];}
      }
      // Merge arrangement - combine both, deduplicate
      if(merged.arrangement){
        const combined=new Set([...(merged.arrangement as string[]),...remoteArrangement]);
        merged.arrangement=Array.from(combined).filter(id=>localSectionIds.has(id)||remoteSections.some(s=>s.id===id));
      }else{
        merged.arrangement=remoteArrangement;
      }
    }
    // Build the merged song, preserving local updatedAt
    const result:CanonicalSong={
      id:local.id,
      title:merged.title as string,
      lyrics:merged.lyrics as string,
      author:merged.author as string,
      copyright:merged.copyright as string,
      authors:merged.authors as string[],
      publisher:merged.publisher as string,
      ccliNumber:merged.ccliNumber as string,
      key:merged.key as string,
      tempo:merged.tempo as number,
      tags:merged.tags as string[],
      language:merged.language as string,
      sections:merged.sections as CanonicalSong['sections'],
      arrangement:merged.arrangement as string[],
      notes:merged.notes as string,
      backgroundId:merged.backgroundId as string|undefined,
      themeId:merged.themeId as string|undefined,
      linesPerSlide:(merged.linesPerSlide as number|undefined) as 2|3|4|6|undefined,
      createdAt:local.createdAt,
      updatedAt:hasConflict?local.updatedAt:new Date().toISOString()
    };
    return[result,hasConflict];
  };
  const conflict=(report:SyncReport,local:CanonicalSong,remote?:CanonicalSong)=>{
   const signature=fingerprint(local)+':'+(remote?fingerprint(remote):'missing');
   if(reportedConflicts.get(local.id)===signature)return;
   // Only preserve to conflicts directory if truly necessary (last resort)
   preserve(local,'local');if(remote)preserve(remote,'remote');
   const message=local.id+': local and synced edits differ; both versions are saved in songs/conflicts.';
   if(!report.conflicts.includes(message))report.conflicts.push(message);
   reportedConflicts.set(local.id,signature);
  };

 const archive=(song:CanonicalSong)=>{
  const current=fileFor(song.id);if(!existsSync(current))return;
  if(fingerprint(readSong(current,song.id))!==fingerprint(song))throw new Error('Song changed while syncing. Try syncing again.');
  const destination=path.join(deleted,song.id+'-'+fingerprint(song).slice(0,16)+'.json');
  if(!existsSync(destination))atomicJSON(destination,song);
  unlinkSync(current);
 };
 const maps=()=>new Map(store.listSongs().map(song=>{const record=canonical(song);return [record.id,record] as const;}));
 const canSync=(id:string)=>!locks.owns(id)&&!locks.isLocked(id);
 const persist=(onlyDeletions=false,ids?:ReadonlySet<string>):SyncReport=>{
  const report=blankReport();if(closed)return report;const local=maps();
  for(const [id,snapshot] of pendingDeletion){
   if(local.has(id)){pendingDeletion.delete(id);continue;}
   try{locks.withLocks([id],()=>{const file=fileFor(id);if(existsSync(file)){const remote=readSong(file,id);if(fingerprint(remote)!==fingerprint(snapshot)){conflict(report,snapshot,remote);return;}}
    atomicJSON(tombFor(id),{id,baseHash:fingerprint(snapshot),deletedAt:new Date().toISOString()});archive(snapshot);baseline.delete(id);pendingDeletion.delete(id);report.deleted++;});
   }catch(error){report.errors.push(id+': '+String(error));}
  }
  if(onlyDeletions)return report;
  for(const [id,song] of local){
   if(ids&&!ids.has(id))continue;
   try{
    const file=fileFor(id),remote=existsSync(file)?readSong(file,id):undefined,hash=fingerprint(song),remoteHash=remote?fingerprint(remote):undefined;
    if(remote&&(remoteHash===hash||sameContent(song,remote))){baseline.set(id,remoteHash!);reportedConflicts.delete(id);continue;}
    const tomb=readTomb(id);if(tomb&&tomb.deletedAt>=song.updatedAt){conflict(report,song,remote);continue;}
    if(remote&&remoteHash!==baseline.get(id)){
      const [merged, hasConflict]=tryMergeSongs(song,remote);
      if(hasConflict){conflict(report,song,remote);continue;}
      // Merge succeeded - write merged version
      locks.withLocks([id],()=>{const current=existsSync(file)?readSong(file,id):undefined;if((current?fingerprint(current):undefined)!==remoteHash)throw new Error('Synced file changed before saving. Sync and try again.');atomicJSON(file,merged);baseline.set(id,fingerprint(merged));report.written++;});
      continue;
    }
    locks.withLocks([id],()=>{const current=existsSync(file)?readSong(file,id):undefined;if((current?fingerprint(current):undefined)!==remoteHash)throw new Error('Synced file changed before saving. Sync and try again.');atomicJSON(file,song);baseline.set(id,hash);report.written++;});
   }catch(error){report.errors.push(id+': '+String(error));}
  }
  return report;
 };
 const sync=():SyncReport=>{
  const report=blankReport();if(closed)return report;const local=maps(),disk=new Map<string,CanonicalSong>(),marks=new Map<string,Tombstone>();
  for(const name of readdirSync(root)){if(!name.endsWith('.json'))continue;try{const id=UUID.parse(name.slice(0,-5)).toLowerCase();disk.set(id,readSong(path.join(root,name),id));}catch(error){report.errors.push(name+': '+String(error));}}
  for(const name of readdirSync(tombstones)){if(!name.endsWith('.json'))continue;try{const id=UUID.parse(name.slice(0,-5)).toLowerCase(),mark=readTomb(id);if(mark)marks.set(id,mark);}catch(error){report.errors.push(name+': '+String(error));}}
  for(const [id,mark] of marks){
   const current=local.get(id),remote=disk.get(id);
   if(remote&&remote.updatedAt>mark.deletedAt)continue;
   if(!canSync(id))continue;
   if((current&&fingerprint(current)!==mark.baseHash)||(remote&&fingerprint(remote)!==mark.baseHash)){if(current)conflict(report,current,remote);else if(remote){preserve(remote,'remote');report.conflicts.push(id+': synced deletion conflicts with a newer song file; the song is preserved.');}continue;}
   try{locks.withLocks([id],()=>{if(current){store.deleteSong(id);local.delete(id);report.deleted++;}if(remote){archive(remote);disk.delete(id);}baseline.delete(id);});}catch(error){report.errors.push(id+': '+String(error));}
  }
  for(const [id,remote] of disk){
   try{
    const current=local.get(id),hash=fingerprint(remote);if(!current){if(marks.has(id)&&marks.get(id)!.deletedAt>=remote.updatedAt)continue;if(!canSync(id))continue;locks.withLocks([id],()=>store.syncSong(id,remote));baseline.set(id,hash);report.imported++;continue;}
    const localHash=fingerprint(current);if(hash===localHash||sameContent(current,remote)){baseline.set(id,hash);reportedConflicts.delete(id);continue;}if(!canSync(id))continue;
    const base=baseline.get(id);
    if((base&&localHash===base)||(!base&&remote.updatedAt>current.updatedAt)){locks.withLocks([id],()=>store.syncSong(id,remote));baseline.set(id,hash);report.imported++;}
    else if(base&&hash===base){/* The local edit will be written by persist. */}
    else {
      const [merged, hasConflict]=tryMergeSongs(current,remote);
      if(hasConflict){conflict(report,current,remote);continue;}
      // Merge succeeded - sync merged version
      locks.withLocks([id],()=>store.syncSong(id,merged));baseline.set(id,fingerprint(merged));report.imported++;
    }
   }catch(error){report.errors.push(id+': '+String(error));}
  }
  return report;
 };
 const markDeleted=(ids:string[])=>{
  const current=maps(),pending:CanonicalSong[]=[];
  for(const id of [...new Set(ids)]){UUID.parse(id);const song=current.get(id);if(!song)throw new Error('Song not found');const file=fileFor(id);if(existsSync(file)){const remote=readSong(file,id);if(fingerprint(remote)!==fingerprint(song))throw new Error('External song edits were detected. Sync the workspace before deleting this song.');}pending.push(song);}
  for(const song of pending)pendingDeletion.set(song.id,song);
 };
 return {sync,persist,markDeleted,close(){closed=true;}};
}
/** Compatibility helper for explicit exports. Runtime synchronization uses createSongFiles. */
export function mirrorSongs(directory:string,songs:Song[]){
 const root=path.join(directory,'songs');mkdirSync(root,{recursive:true});for(const song of songs){const value=canonical(song);atomicJSON(path.join(root,value.id+'.json'),value);}
}
