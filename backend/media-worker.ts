import {parentPort,workerData} from 'node:worker_threads';
import {convertPresentation,transcodeVideo} from './media';

const PROGRESS_BATCH_MS = 500;
let lastProgressTime = 0;

export function main(workerData: {operation:string;file:string;root:string;scriptPath:string}):Promise<unknown>{
 const {operation,file,root,scriptPath}=workerData;
 let settled=false;
 const progress=(value:unknown)=>{
  const now=Date.now();
  if(now-lastProgressTime<PROGRESS_BATCH_MS){return;}lastProgressTime=now;
  void parentPort?.postMessage({progress:value});
 };

 return new Promise((resolve,reject)=>{
  try{
   const mainAsync=async()=>{
    if(operation==='presentation')return convertPresentation(file,root,scriptPath,progress);
    if(operation==='transcode')return transcodeVideo(file,root,progress);
    throw new Error('Unsupported media worker operation.');
   };
   mainAsync().then(result=>{
    if(!settled){settled=true;resolve(result);}
   }).catch(error=>{
    if(!settled){settled=true;reject(error);}
   });
  }catch(error){
   if(!settled){settled=true;reject(error);}
  }
 });
}