import {parentPort,workerData} from 'node:worker_threads';
import {convertPresentation,transcodeVideo} from './media';
async function main(){const {operation,file,root,scriptPath}=workerData;const progress=(value:unknown)=>parentPort?.postMessage({progress:value});if(operation==='presentation')return convertPresentation(file,root,scriptPath,progress);if(operation==='transcode')return transcodeVideo(file,root,progress);throw new Error('Unsupported media worker operation.');}
main().then(result=>parentPort?.postMessage({result})).catch(error=>parentPort?.postMessage({error:error instanceof Error?error.message:String(error)}));
