import {parentPort,workerData} from 'node:worker_threads';
import path from 'node:path';
import {openStore} from './database';
import {createSongFiles,songLocks} from './workspace';

const PROGRESS_BATCH_MS = 500;
let lastProgressTime = 0;

const {root,action,expectedCopies}=workerData as {root:string;action:'preview'|'optimize';expectedCopies?:number};

const progress=(stage:string)=>{
 const now=Date.now();
 if(now-lastProgressTime<PROGRESS_BATCH_MS)return;
 lastProgressTime=now;
 parentPort?.postMessage({type:'progress',stage});
};

try{
 progress('scan');
 const store=openStore(path.join(root,'workspace.db'));
 const locks=songLocks(root),files=createSongFiles(root,store,locks);
 let value:unknown;
 try{
  const groups=store.duplicateSongGroups(),duplicates=groups.flatMap(group=>group.slice(1));
  if(action==='preview')value={duplicateCopies:duplicates.length,groups:groups.length};
  else{
   if(duplicates.length!==expectedCopies)throw new Error('The song library changed. Review the duplicate count again.');
   const result=locks.withLocks(groups.flat(),()=>{
    let removed=0;
    const compact=store.optimizeSongs(()=>{
     if(duplicates.length){files.markDeleted(duplicates);removed=store.consolidateDuplicateSongs(groups);}
     progress('files');
     const report=files.persist(true);
     if(report.errors.length||report.conflicts.length)throw new Error('Songs were consolidated, but some song files could not be synchronized. '+[...report.errors,...report.conflicts].join(' '));
    },progress);
    return {bytesSaved:compact.bytesSaved,duplicatesRemoved:removed,songsRemaining:store.listSongs().length};
   });
   progress('complete');value=result;
  }
 }finally{files.close();locks.close();store.close();}
 parentPort?.postMessage({type:'result',value});
}catch(error){parentPort?.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});}