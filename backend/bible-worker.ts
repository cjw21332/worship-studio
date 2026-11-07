import {parentPort,workerData} from 'node:worker_threads';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {previewBibleImport,parseBibleImport} from './bible';
import type {BibleWorkerRequest,BibleWorkerResult} from './bible-handlers';
export async function parseBibleFile(request:BibleWorkerRequest):Promise<BibleWorkerResult>{
 if((await stat(request.file)).size>30_000_000)throw new Error('Bible file exceeds 30 MB. Choose a smaller file.');
 const source=await readFile(request.file);if(source.byteLength>30_000_000)throw new Error('Bible file exceeds 30 MB.');
 const digest=createHash('sha256').update(source).digest('hex');if(request.expectedDigest&&digest!==request.expectedDigest)throw new Error('The Bible file changed after preview. Choose it again before importing.');
 const text=source.toString('utf8');
 if(request.mode==='commit')return {digest,document:parseBibleImport(text,request.options)};
 const {verses:_,format:__,...preview}=previewBibleImport(text,request.options);return {digest,preview};
}
if(parentPort&&workerData){void parseBibleFile(workerData as BibleWorkerRequest).then(result=>parentPort!.postMessage({ok:true,result}),error=>parentPort!.postMessage({ok:false,error:error instanceof Error?error.message:String(error)}));}
