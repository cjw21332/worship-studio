import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
export const UpdateSettings=z.object({enabled:z.boolean(),channel:z.enum(['stable','beta']),feedUrl:z.string().max(2000).refine(value=>{if(!value)return true;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash;}catch{return false;}},'Use an HTTPS update feed without embedded credentials.')}).strict();
export type UpdateSettings=z.infer<typeof UpdateSettings>;
export type UpdateStatus={state:'disabled'|'unconfigured'|'development'|'idle'|'checking'|'available'|'current'|'downloading'|'downloaded'|'error';version?:string;progress?:number;message:string;settings:UpdateSettings};
/** Native consumers (PowerShell, SQLite and Worker) need physical paths outside ASAR. */
export {unpackedResource} from './native-path';
export function createUpdates(options:{userData:string;isPackaged:boolean;version:string;onStatus?:(status:UpdateStatus)=>void}){
 const file=path.join(options.userData,'updates.json');let settings:UpdateSettings={enabled:false,channel:'stable',feedUrl:''},updater:typeof import('electron-updater').autoUpdater|undefined;
 if(existsSync(file))try{settings=UpdateSettings.parse(JSON.parse(readFileSync(file,'utf8')));}catch{/* Keep the invalid file intact until the user saves settings. */}
 let current:UpdateStatus={state:!settings.enabled?'disabled':!settings.feedUrl?'unconfigured':!options.isPackaged?'development':'idle',message:'Updates are checked only when requested.',settings};
 const status=()=>structuredClone({...current,settings});
 const publish=(patch:Partial<UpdateStatus>)=>{current={...current,...patch,settings};const value=status();options.onStatus?.(value);return value;};
 const configure=(input:unknown)=>{
  const next=UpdateSettings.parse(input);mkdirSync(options.userData,{recursive:true});const temporary=file+'.'+randomUUID()+'.tmp';writeFileSync(temporary,JSON.stringify(next,null,2),'utf8');renameSync(temporary,file);settings=next;updater=undefined;
  return publish({state:!next.enabled?'disabled':!next.feedUrl?'unconfigured':!options.isPackaged?'development':'idle',version:undefined,progress:undefined,message:!next.enabled?'Update checks are disabled.':!next.feedUrl?'Configure a published HTTPS update feed before checking.':'Update channel saved. Check for updates when ready.'});
 };
 const configured=()=>{if(!settings.enabled)return publish({state:'disabled',message:'Update checks are disabled.'});if(!settings.feedUrl)return publish({state:'unconfigured',message:'No update feed is configured. A release publisher must provide the HTTPS feed.'});if(!options.isPackaged)return publish({state:'development',message:'Update checks run only in an installed packaged build.'});return null;};
 const getUpdater=async()=>{
  if(updater)return updater;const module=await import('electron-updater');updater=module.autoUpdater;updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=settings.channel==='beta';updater.channel=settings.channel==='stable'?'latest':'beta';updater.setFeedURL({provider:'generic',url:settings.feedUrl,channel:updater.channel});
  updater.on('download-progress',progress=>publish({state:'downloading',progress:Math.max(0,Math.min(100,progress.percent)),message:'Downloading the requested update.'}));
  updater.on('update-downloaded',info=>publish({state:'downloaded',version:info.version,progress:100,message:'Update downloaded. Install and restart when the service is finished.'}));
  updater.on('error',()=>publish({state:'error',message:'The update could not be completed. Check the release feed and connection, then try again.'}));return updater;
 };
 const check=async()=>{
  const unavailable=configured();if(unavailable)return unavailable;if(current.state==='checking'||current.state==='downloading')return status();
  publish({state:'checking',message:'Checking the selected release channel.',progress:undefined});
  try{const result=await (await getUpdater()).checkForUpdates();const available=!!result?.isUpdateAvailable;return publish({state:available?'available':'current',version:result?.updateInfo?.version||options.version,message:available?'An update is available. Download it when convenient.':'No newer release is available on this channel.'});}
  catch{return publish({state:'error',message:'Update check failed. Verify the configured HTTPS feed and connection.'});}
 };
 const download=async()=>{const unavailable=configured();if(unavailable)return unavailable;if(current.state!=='available')throw new Error('Check for an available update before downloading.');publish({state:'downloading',progress:0,message:'Downloading the requested update.'});try{await (await getUpdater()).downloadUpdate();return status();}catch{return publish({state:'error',message:'The update download failed. Check the connection and release files.'});}};
 return {status,configure,check,download,install:(confirmed:boolean)=>{if(!confirmed)throw new Error('Confirm that the service is finished before restarting to install an update.');if(current.state!=='downloaded'||!updater)throw new Error('Download an update before installing it.');updater.quitAndInstall(false,true);},handle:async(value:unknown)=>{const input=z.object({action:z.enum(['status','configure','check','download','install']),payload:z.unknown().optional()}).strict().parse(value);if(input.action==='status')return status();if(input.action==='configure')return configure(input.payload);if(input.action==='check')return check();if(input.action==='download')return download();const {confirmed}=z.object({confirmed:z.literal(true)}).strict().parse(input.payload);if(current.state!=='downloaded'||!updater)throw new Error('Download an update before installing it.');updater.quitAndInstall(false,true);return {confirmed};}};
}
