import {dialog,type BrowserWindow,type IpcMainInvokeEvent} from 'electron';
import {mkdir,readFile,writeFile,rename,stat,access} from 'node:fs/promises';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {z} from 'zod';
import type {openStore,Item} from './database';
import {ServiceHistory,parseService,snapshotService,preflight,referencedAssets,usageCSV,type ServiceFile} from './service-plan';
import {packService,unpackService} from './service-package';
import {TransitionSchema} from './themes';
import {AssetOptions} from './media';

type Context={store:ReturnType<typeof openStore>;win:BrowserWindow;workspaceRoot:string;mediaRoot:string;outputStatus:()=>{armed:boolean;displayFound:boolean};missingFonts:()=>Promise<string[]>;assetFile:(id:string)=>{path:string;mime:string};settings:()=>ServiceFile['settings'];snapshotItems?:()=>Item[];onLoad?:(service:ServiceFile)=>void|Promise<void>;onError?:(message:string)=>void};
const ItemPatch=z.object({title:z.string().trim().min(1).max(200).optional(),notes:z.string().max(100000).optional(),colorTag:z.string().regex(/^#[a-f0-9]{6}$/i).optional(),duration:z.number().min(0).max(86400).optional(),autoAdvance:z.boolean().optional(),loop:z.boolean().optional(),themeId:z.string().max(100).optional(),backgroundId:z.string().uuid().optional(),transition:TransitionSchema.optional(),placeholder:z.boolean().optional()}).strict();
const atomic=async(file:string,value:unknown)=>{const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2),'utf8');await rename(temporary,file);};
export function serviceHandlers(context:Context){
 const {store,win,workspaceRoot,mediaRoot}=context,history=new ServiceHistory(),recovery=path.join(workspaceRoot,'service-recovery.wsservice'),marker=path.join(workspaceRoot,'session-active.json');
 const unclean=existsSync(marker);writeFileSync(marker,JSON.stringify({startedAt:new Date().toISOString()}));
 let name=String(store.getPreference('service-name')||'Untitled service'),filePath:string|null=null,savedFingerprint='',closed=false,saving:Promise<void>|null=null;
 const current=()=>snapshotService(context.snapshotItems?.()||store.listItems(),name,context.settings());
 const fingerprint=()=>JSON.stringify({items:store.listItems(),name,settings:context.settings()});
 type Recent={id:string;path:string;name:string;openedAt:string};
 const recents=():Recent[]=>{const value=store.getPreference('recent-services');return Array.isArray(value)?value as Recent[]:[];};
 const remember=(file:string)=>{const next=[{id:randomUUID(),path:file,name,openedAt:new Date().toISOString()},...recents().filter(r=>r.path!==file)].slice(0,15);store.setPreference('recent-services',next);};
 const templates=()=>{const value=store.getPreference('service-templates');return Array.isArray(value)?value as {id:string;name:string;service:ServiceFile}[]:[];};
 const initial=()=>({name,filePath,dirty:fingerprint()!==savedFingerprint,locallySaved:true,recovered:unclean,recoveryAvailable:existsSync(recovery),recent:recents().map(({path:_,...r})=>r),templates:templates().map(({service:_,...t})=>t),...history.status()});
 const autosave=async()=>{if(closed)return;if(saving)return saving;saving=(async()=>{await mkdir(workspaceRoot,{recursive:true});await atomic(recovery,current());})().finally(()=>{saving=null;});return saving;};
 const timer=setInterval(()=>{void autosave().catch(error=>context.onError?.('Recovery save failed: '+String(error)));},30000);
 const replace=async(service:ServiceFile)=>{store.replaceItems(service.items as Item[]);name=service.name;store.setPreference('service-name',name);await context.onLoad?.(service);};
 const confirmReplace=async(message:string)=>!store.listItems().length||(await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Replace running order'],defaultId:0,cancelId:0,message,detail:'Save a service file first to keep this order. Library content and the audience live snapshot stay as they are.'})).response===1;
 const save=async(packageMedia=false)=>{
  const result=await dialog.showSaveDialog(win,{title:packageMedia?'Package service with media':'Save service',defaultPath:packageMedia?name+'.wspackage':(filePath&&/\.(?:wsservice|json)$/i.test(filePath)?filePath:name+'.wsservice'),filters:[{name:packageMedia?'Service package':'Worship Studio service',extensions:[packageMedia?'wspackage':'wsservice']}]});
  if(result.canceled||!result.filePath)return 'Service save canceled.';
  const service=current();if(packageMedia)await writeFile(result.filePath,await packService(service,store.assets(),mediaRoot));else await atomic(result.filePath,service);
  filePath=result.filePath;savedFingerprint=fingerprint();remember(filePath);return packageMedia?'Service packaged with its referenced media.':'Service saved.';
 };
 const open=async(file?:string)=>{
  if(!file){const result=await dialog.showOpenDialog(win,{title:'Open service',properties:['openFile'],filters:[{name:'Worship Studio service or package',extensions:['wsservice','wspackage','json']}]});if(result.canceled)return 'Open service canceled.';file=result.filePaths[0];}
  const info=await stat(file);if(info.size>1_000_000_000)throw new Error('Service package exceeds 1 GB.');
  if(!await confirmReplace('Open this service and replace the running order?'))return 'Open service canceled.';
  let service:ServiceFile;
  if(path.extname(file).toLowerCase()==='.wspackage'){
   const result=await unpackService(await readFile(file),mediaRoot);service=result.service;
   for(const asset of result.assets){const existing=store.asset(asset.id);if(existing&&existing.name!==asset.name)throw new Error('A packaged asset ID conflicts with this workspace.');if(!existing)store.saveAsset({...asset,options:AssetOptions.parse(asset.options||{})});}
  }else{if(info.size>30_000_000)throw new Error('Service file exceeds 30 MB.');service=parseService(JSON.parse(await readFile(file,'utf8')));}
  await replace(service);filePath=file;savedFingerprint=fingerprint();remember(file);await autosave();return 'Service opened. Current audience content was kept.';
 };
 return {initial,capture:(before:Item[])=>history.capture(before,store.listItems()),autosave,save,open,
  async close(){closed=true;clearInterval(timer);if(saving)await saving;try{unlinkSync(marker);}catch{/* Already removed. */}},
  handlers:{'service:action':async(_event:IpcMainInvokeEvent,value:unknown):Promise<unknown>=>{
   const {action,payload}=z.object({action:z.enum(['initial','name','save','package','open','recent','new','undo','redo','item','preflight','usage-export','template-save','template-open','template-sunday','recover','autosave']),payload:z.unknown().default({})}).strict().parse(value);
   if(action==='initial')return initial();
   if(action==='save')return save();if(action==='package')return save(true);if(action==='open')return open();
   if(action==='name'){name=z.object({name:z.string().trim().min(1).max(200)}).strict().parse(payload).name;store.setPreference('service-name',name);return initial();}
   if(action==='recent'){const {id}=z.object({id:z.string().uuid()}).strict().parse(payload),recent=recents().find(r=>r.id===id);if(!recent)throw new Error('Recent service was not found.');return open(recent.path);}
   if(action==='new'){if(!await confirmReplace('Start a new service?'))return 'New service canceled.';store.newService();name='Untitled service';filePath=null;store.setPreference('service-name',name);return 'New service started.';}
   if(action==='undo'){store.replaceItems(history.undo(store.listItems()));return 'Service change undone.';}if(action==='redo'){store.replaceItems(history.redo(store.listItems()));return 'Service change redone.';}
   if(action==='item'){const {id,patch}=z.object({id:z.string().uuid(),patch:ItemPatch}).strict().parse(payload);store.updateItem(id,patch);return 'Service item updated. Send a slide live to publish its changes.';}
   if(action==='preflight'){
    const source=context.snapshotItems?.()||store.listItems(),refs=referencedAssets(source),missing:string[]=[];for(const id of refs)try{context.assetFile(id);}catch{missing.push(id);}
    return {issues:preflight(source,{...context.outputStatus(),missingAssetIds:missing,missingFonts:await context.missingFonts()})};
   }
   if(action==='usage-export'){const result=await dialog.showSaveDialog(win,{defaultPath:'worship-usage.csv',filters:[{name:'Usage CSV',extensions:['csv']}]});if(result.canceled||!result.filePath)return 'Usage export canceled.';await writeFile(result.filePath,usageCSV(store.usageHistory()),'utf8');return 'Usage report exported. This is a local record, not official CCLI integration.';}
   if(action==='template-save'){const {name:templateName}=z.object({name:z.string().trim().min(1).max(200)}).strict().parse(payload);store.setPreference('service-templates',[...templates(),{id:randomUUID(),name:templateName,service:current()}].slice(-100));return 'Service template saved.';}
   if(action==='template-open'){const {id}=z.object({id:z.string().uuid()}).strict().parse(payload),template=templates().find(t=>t.id===id);if(!template)throw new Error('Template not found.');if(!await confirmReplace('Use this service template?'))return 'Template canceled.';const service=parseService(template.service);service.items=service.items.map((item,position)=>({...item,id:randomUUID(),position}));await replace(service);filePath=null;return 'Service template loaded.';}
   if(action==='template-sunday'){if(!await confirmReplace('Start with the Sunday morning template?'))return 'Template canceled.';store.newService();for(const title of ['Welcome','Opening song','Prayer','Worship song','Scripture reading','Message','Closing song'])store.addSlides(title,['Replace this placeholder with your service content.'],{kind:'note',placeholder:true});name='Sunday morning';store.setPreference('service-name',name);return 'Sunday morning template loaded. Replace the placeholders before going live.';}
   if(action==='recover'){if(!existsSync(recovery))throw new Error('No recovery snapshot is available.');if(!await confirmReplace('Restore the last recovery snapshot?'))return 'Recovery canceled.';const info=await stat(recovery);if(info.size>30_000_000)throw new Error('Recovery file exceeds 30 MB.');await replace(parseService(JSON.parse(await readFile(recovery,'utf8'))));filePath=null;return 'Recovery snapshot restored.';}
   await autosave();return 'Recovery snapshot saved.';
  }}
 };
}
