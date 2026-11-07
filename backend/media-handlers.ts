import {dialog,nativeImage,type BrowserWindow} from 'electron';
import {watch,existsSync,lstatSync,realpathSync,type FSWatcher} from 'node:fs';
import {mkdir,writeFile,readdir,lstat,readFile,access,unlink} from 'node:fs/promises';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
import {unpackedResource} from './native-path';
import {z} from 'zod';
import type {openStore,Item} from './database';
import type {Slide,VideoSlide,Alert} from './presentation';
import {AssetOptions,MediaDocument,MediaPage,normalizeDocument,importManagedMedia,managedAssetPath,mediaMime,imageExtensions,videoExtensions,countdownEnd,findMediaTool,type MediaAsset,type MediaProgress,type ConvertedDeck} from './media';

export type MediaRuntime={getLive:()=>Slide|null;videoControl:(patch:Partial<VideoSlide>)=>unknown|Promise<unknown>;alert:(value:Alert|null)=>unknown|Promise<unknown>};
export type MediaLibraryData={assets:MediaAsset[];documents:(MediaDocument&{id:string})[];watching:string|null;progress:MediaProgress|null;liveVideo?:{itemId?:string;title:string;video:VideoSlide};backgroundTargets?:{items:{id:string;title:string}[];songs:{id:string;title:string;sections:{id:string;label:string}[]}[]}};
export function mediaHandlers(store:ReturnType<typeof openStore>,win:BrowserWindow,mediaRoot:string,onProgress?:(value:MediaProgress)=>void,runtime?:MediaRuntime){
 let watcher:FSWatcher|undefined,watchDirectory:string|null=null,closed=false,progress:MediaProgress|null=null;
 const workers=new Set<Worker>(),knownFiles=new Map<string,string>(),watchTasks=new Set<string>();let watchTimer:ReturnType<typeof setTimeout>|undefined;
 const report=(value:MediaProgress)=>{progress=value;onProgress?.(value);if(!win.isDestroyed())win.webContents.send('media:progress',value);};
 const assetFile=(id:string,thumbnail=false)=>{
  const asset=store.asset(z.string().uuid().parse(id));if(!asset)throw new Error('Media record not found.');const file=managedAssetPath(mediaRoot,thumbnail&&asset.thumbnail?asset.thumbnail:asset.name);
  let info;try{info=lstatSync(file);}catch{throw new Error('The media file is missing. Reimport it from the original file.');}if(!info.isFile()||info.isSymbolicLink())throw new Error('Media must be a regular managed file.');
  const actual=realpathSync(file),root=realpathSync(mediaRoot);if(path.dirname(actual)!==root)throw new Error('Media file leaves the managed folder.');return {path:file,mime:mediaMime(file)};
 };
 const thumbnail=async(asset:MediaAsset)=>{
  if(asset.kind!=='image')return asset;
  const decoded=nativeImage.createFromPath(managedAssetPath(mediaRoot,asset.name));if(decoded.isEmpty())throw new Error('This image could not be decoded. Export it as PNG or JPEG and import again.');
  const size=decoded.getSize(),ratio=Math.min(1,320/Math.max(size.width,size.height)),small=decoded.resize({width:Math.max(1,Math.round(size.width*ratio)),height:Math.max(1,Math.round(size.height*ratio)),quality:'good'}),name=asset.id+'.thumb.png';await writeFile(managedAssetPath(mediaRoot,name),small.toPNG());return {...asset,thumbnail:name};
 };
 const importFile=async(file:string,kind:'image'|'video')=>{if(closed)throw new Error('Media import stopped because the app closed.');const imported=await importManagedMedia(file,mediaRoot,kind);try{const asset=await thumbnail(imported);if(closed)throw new Error('Media import stopped because the app closed.');store.saveAsset(asset);return asset;}catch(error){await Promise.allSettled([unlink(managedAssetPath(mediaRoot,imported.name)),unlink(managedAssetPath(mediaRoot,imported.id+'.thumb.png'))]);throw error;}};
 const work=<T>(operation:'presentation'|'transcode',file:string):Promise<T>=>new Promise((resolve,reject)=>{
  if(workers.size){reject(new Error('Wait for the current presentation import or video conversion to finish.'));return;}
  const workerPath=path.join(__dirname,'media-worker.cjs');if(!existsSync(workerPath)){reject(new Error('Build Worship Studio before importing presentations or converting video.'));return;}
  const worker=new Worker(unpackedResource(workerPath),{workerData:{operation,file,root:mediaRoot,scriptPath:unpackedResource(path.join(__dirname,'export-powerpoint.ps1'))}});workers.add(worker);let settled=false;
  const finish=(error?:Error,result?:T)=>{if(settled)return;settled=true;workers.delete(worker);void worker.terminate();error?reject(error):resolve(result!);};
  worker.on('message',value=>{if(value.progress)report(value.progress);else if(value.error)finish(new Error(String(value.error)));else if(Object.hasOwn(value,'result'))finish(undefined,value.result);});worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!settled)finish(new Error(closed?'Media import stopped because the app closed.':'Media worker stopped unexpectedly ('+code+').'));});
 });
 const list=():MediaLibraryData=>{const live=runtime?.getLive();return {assets:store.assets().filter(asset=>!(asset as typeof asset & {hiddenFromLibrary?:boolean}).hiddenFromLibrary),documents:store.documents(),watching:watchDirectory,progress,liveVideo:live?.video?{itemId:live.itemId,title:live.title,video:live.video}:undefined,backgroundTargets:{items:store.listItems().map(({id,title})=>({id,title})),songs:store.listSongs().map(({id,title,sections})=>({id,title,sections:sections.map(({id,label})=>({id,label}))}))}};};
 const documentFor=(id:string)=>{const document=store.documents().find(d=>d.id===id);if(!document)throw new Error('Slide set or note was not found.');return document;};
 const validatePageAssets=(pages:MediaPage[])=>{for(const page of pages){if(page.imageId){if(store.asset(page.imageId)?.kind!=='image')throw new Error('An image slide refers to an unavailable image.');assetFile(page.imageId);}if(page.videoId){if(store.asset(page.videoId)?.kind!=='video')throw new Error('A video slide refers to an unavailable video.');assetFile(page.videoId);}for(const [key,url] of Object.entries({image:page.style?.backgroundImage,video:page.style?.backgroundVideo})){if(!url)continue;const id=new URL(url).pathname.slice(1);if(store.asset(id)?.kind!==key)throw new Error('A background refers to unavailable '+key+' media.');assetFile(id);}}};
 const addDocument=(document:MediaDocument&{id:string})=>{validatePageAssets(document.pages);return store.addSlides(document.title,document.pages.map(p=>p.videoId?'video:'+p.videoId:p.imageId&&!p.text?'asset:'+p.imageId:p.text||'Countdown'),{kind:document.kind,mediaDocumentId:document.id,mediaPages:document.pages,autoAdvance:document.autoAdvance,loop:document.loop,durations:document.pages.map(p=>p.duration),notes:document.pages[0]?.notes||'',warning:document.warning,...(document.kind==='alert'?{alert:{text:document.pages.map(p=>p.text).join('\n'),scrolling:document.loop,seconds:document.pages[0]?.duration||0}}:{})});};
 const addAsset=(id:string)=>{const asset=store.asset(id);if(!asset)throw new Error('Media file not found.');assetFile(id);const page=MediaPage.parse({text:'',...(asset.kind==='image'?{imageId:id}:{videoId:id,video:asset.options.video}),duration:asset.options.duration,style:{fit:asset.options.fit}});return store.addSlides(asset.title,[(asset.kind==='image'?'asset:':'video:')+asset.id],{kind:asset.kind,mediaPages:[page],durations:[page.duration]});};
 const importPresentation=async(file:string)=>{
  const deck=await work<ConvertedDeck>('presentation',file);const existing=store.documents().find(d=>d.sourceChecksum===deck.checksum);if(existing)return {message:'This presentation is already in your library. Its cached slides are ready.',documentId:existing.id,warning:existing.warning};
  const pageCount=deck.mode==='images'?deck.pages.length:deck.pages.reduce((n,page)=>n+(page.text.trim()?1:0)+page.images.length+(!page.text.trim()&&!page.images.length?1:0),0);if(pageCount>1000)throw new Error('The simplified presentation would create more than 1,000 slides. Split the deck or export exact PNG slides.');
  const pages:MediaPage[]=[];
  for(const [index,page] of deck.pages.entries()){report({operation:'presentation',completed:index,total:deck.pages.length,message:'Caching slide '+(index+1)+' of '+deck.pages.length+'…'});const assets:MediaAsset[]=[];for(const image of page.images)assets.push(await importFile(image,'image'));
   if(deck.mode==='images'){pages.push(MediaPage.parse({text:'',imageId:assets[0]?.id,notes:page.notes}));continue;}
   // The simplified fallback deliberately avoids pretending to reconstruct PowerPoint layout.
   if(page.text.trim())pages.push(MediaPage.parse({text:page.text,notes:page.notes}));
   for(const asset of assets)pages.push(MediaPage.parse({text:'',imageId:asset.id,notes:page.notes}));
   if(!page.text.trim()&&!assets.length)pages.push(MediaPage.parse({text:'Slide '+(index+1),notes:page.notes}));
  }
  const document=normalizeDocument({title:path.basename(file),kind:'presentation',pages,warning:deck.warning,sourceChecksum:deck.checksum});const id=store.saveDocument(document);report({operation:'presentation',completed:pages.length,total:pages.length,message:'Presentation imported.'});return {message:'Presentation imported: '+pages.length+' slides.',documentId:id,warning:deck.warning};
 };
 const stopWatching=()=>{watcher?.close();watcher=undefined;watchDirectory=null;knownFiles.clear();if(watchTimer)clearTimeout(watchTimer);};
 const scanFolder=async()=>{const directory=watchDirectory;if(!directory||closed)return;for(const entry of await readdir(directory,{withFileTypes:true})){if(!entry.isFile()||!imageExtensions.includes(path.extname(entry.name).slice(1).toLowerCase()))continue;const file=path.join(directory,entry.name);if(watchTasks.has(file))continue;const info=await lstat(file);if(info.isSymbolicLink()||!info.isFile())continue;const key=info.size+':'+info.mtimeMs;if(knownFiles.get(file)===key)continue;watchTasks.add(file);try{await importFile(file,'image');knownFiles.set(file,key);report({operation:'watch',completed:1,total:1,message:'Imported '+entry.name+' from watched folder.'});}catch(error){report({operation:'watch',completed:0,total:1,message:'Could not import '+entry.name+': '+String(error)});}finally{watchTasks.delete(file);}}};
 const backgroundFor=(item:Item,index:number):NonNullable<Slide['style']>=>{
  const section=item.sectionIds?.[index],ids=[store.mediaBackground('service','default'),item.sourceId?store.mediaBackground('song',item.sourceId):undefined,section&&item.sourceId?store.mediaBackground('section',item.sourceId+':'+section):undefined,store.mediaBackground('item',item.id)].filter(Boolean) as string[],id=ids.at(-1);if(!id)return {};const asset=store.asset(id);if(!asset)return {};assetFile(id);return asset.kind==='image'?{backgroundImage:'studio-media://asset/'+id,backgroundVideo:undefined}:{backgroundImage:undefined,backgroundVideo:'studio-media://asset/'+id};
 };
 const resolveSlide=async(item:Item,index:number):Promise<Partial<Slide>>=>{
  const page=item.mediaPages?.[index],style=backgroundFor(item,index);if(!page)return Object.keys(style).length?{style}:{};
  const result:Partial<Slide>={text:page.text,notes:page.notes||item.notes,style:{...style,...page.style},transition:page.transition};
  if(page.imageId){assetFile(page.imageId);if(page.text.trim())result.style={...result.style,backgroundImage:'studio-media://asset/'+page.imageId};else result.image='studio-media://asset/'+page.imageId;}
  if(page.videoId){assetFile(page.videoId);const asset=store.asset(page.videoId)!;result.video={src:'studio-media://asset/'+page.videoId,...(page.video||asset.options.video),playing:true,position:page.video?.start||asset.options.video?.start||0,startedAt:Date.now()};}
  if(page.countdown)result.countdown={endsAt:countdownEnd(page.countdown),message:page.countdown.message,format:page.countdown.format};
  return result;
 };
 const handle=async(_event:Electron.IpcMainInvokeEvent,input:unknown)=>{
  if(closed)throw new Error('The media workspace is closed.');const {action,payload}=z.object({action:z.enum(['list','import','drop','asset-update','asset-add','asset-remove','document-save','document-add','document-delete','slideshow','watch-start','watch-stop','capabilities','transcode','background-assignment','video-control','alert-show','alert-clear']),payload:z.unknown().default({})}).strict().parse(input);
  if(action==='list')return list();
  if(action==='capabilities'){const [ffmpeg,soffice,pdftoppm]=await Promise.all([findMediaTool('ffmpeg'),findMediaTool('soffice'),findMediaTool('pdftoppm')]);return {ffmpeg:!!ffmpeg,libreOffice:!!soffice,pdfRenderer:!!pdftoppm};}
  if(action==='drop'){
   const {paths}=z.object({paths:z.array(z.string().min(1).max(32768)).min(1).max(500)}).strict().parse(payload);let added=0;const failures:string[]=[];
   for(const file of paths){try{
    if(!path.isAbsolute(file))throw new Error('Choose a file from this computer.');
    const extension=path.extname(file).slice(1).toLowerCase();
    if(['ppt','pptx'].includes(extension)){const result=await importPresentation(file);addDocument(documentFor(result.documentId));}
    else if(imageExtensions.includes(extension)||videoExtensions.includes(extension)){const asset=await importFile(file,imageExtensions.includes(extension)?'image':'video');addAsset(asset.id);}
    else throw new Error('Drop an image, video or PowerPoint file. Use Open for service files and Import songs for lyrics.');
    added++;
   }catch(error){failures.push(path.basename(file)+': '+(error instanceof Error?error.message:String(error)));}}
   if(!added)throw new Error(failures.join('\n'));return {message:'Added '+added+' files to the service.',warning:failures.length?failures.join('\n'):undefined};
  }
  if(action==='import'){
   const {kind}=z.object({kind:z.enum(['image','video','powerpoint'])}).parse(payload),result=await dialog.showOpenDialog(win,{properties:kind==='powerpoint'?['openFile']:['openFile','multiSelections'],filters:[{name:kind==='image'?'Images':kind==='video'?'Video':'PowerPoint',extensions:kind==='image'?imageExtensions:kind==='video'?videoExtensions:['ppt','pptx']}]});
   if(result.canceled)return 'Media import canceled.';if(result.filePaths.length>500)throw new Error('Import at most 500 files at a time.');if(kind==='powerpoint')return importPresentation(result.filePaths[0]);let imported=0;const failures:string[]=[];
   for(const file of result.filePaths){try{report({operation:'import',completed:imported,total:result.filePaths.length,message:'Importing '+path.basename(file)+'…'});await importFile(file,kind);imported++;}catch(error){failures.push(path.basename(file)+': '+String(error));}}report({operation:'import',completed:imported,total:result.filePaths.length,message:'Imported '+imported+' files.'});return {message:'Imported '+imported+' '+(kind==='image'?'images':'videos')+'.',warning:failures.length?failures.join('\n'):undefined};
  }
  if(action==='asset-update'){const value=z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(200).optional(),options:AssetOptions}).parse(payload);store.updateAsset(value.id,{...(value.title?{title:value.title}:{}),options:value.options});return 'Media options saved. Existing service snapshots stay as they are.';}
  if(action==='asset-remove'){store.removeAssetFromLibrary(z.object({id:z.string().uuid()}).strict().parse(payload).id);return 'Removed from library. Existing services and media files are kept.';}
  if(action==='asset-add'){addAsset(z.object({id:z.string().uuid()}).parse(payload).id);return 'Media added to service.';}
  if(action==='document-save'){const document=normalizeDocument(payload);validatePageAssets(document.pages);const id=store.saveDocument(document);return {message:'Saved '+document.title+'.',documentId:id};}
  if(action==='document-add'){addDocument(documentFor(z.object({id:z.string().uuid()}).parse(payload).id));return 'Item added to service.';}
  if(action==='document-delete'){store.deleteDocument(z.object({id:z.string().uuid()}).parse(payload).id);return 'Library item deleted. Existing service snapshots are kept.';}
  if(action==='slideshow'){const value=z.object({title:z.string().trim().min(1).max(200),ids:z.array(z.string().uuid()).min(1).max(1000),duration:z.number().min(1).max(86400),loop:z.boolean().default(true),fit:z.enum(['contain','cover','fill']).default('contain')}).parse(payload);const document=normalizeDocument({title:value.title,kind:'slideshow',loop:value.loop,autoAdvance:true,pages:value.ids.map(id=>({imageId:id,text:'',duration:value.duration,style:{fit:value.fit}}))});validatePageAssets(document.pages);const id=store.saveDocument(document);return {message:'Slideshow saved. Add it to the service when ready.',documentId:id};}
  if(action==='watch-start'){const choice=await dialog.showOpenDialog(win,{properties:['openDirectory'],title:'Watch a folder for images (off after restart)'});if(choice.canceled)return 'Folder watching canceled.';stopWatching();watchDirectory=choice.filePaths[0];watcher=watch(watchDirectory,()=>{if(watchTimer)clearTimeout(watchTimer);watchTimer=setTimeout(()=>void scanFolder().catch(e=>report({operation:'watch',completed:0,total:1,message:String(e)})),600);});watcher.on('error',error=>{report({operation:'watch',completed:0,total:1,message:'Folder watch stopped: '+error.message});stopWatching();});await scanFolder();return 'Folder watching enabled for this session.';}
  if(action==='watch-stop'){stopWatching();return 'Folder watching stopped.';}
  if(action==='transcode'){const {id}=z.object({id:z.string().uuid()}).parse(payload),asset=store.asset(id);if(!asset||asset.kind!=='video')throw new Error('Choose a video from the media library.');const output=await work<string>('transcode',assetFile(id).path),converted=await importFile(output,'video');store.updateAsset(converted.id,{title:asset.title+' (H.264)'});return 'Converted video imported as a new file. The original is kept.';}
  if(action==='background-assignment'){const value=z.object({scope:z.enum(['service','item','song','section']),key:z.string().min(1).max(300).default('default'),assetId:z.string().uuid().nullable()}).parse(payload);if(value.assetId)assetFile(value.assetId);store.setMediaBackground(value.scope,value.key,value.assetId);return 'Background saved. It applies the next time you send a slide live.';}
  if(action==='video-control'){if(!runtime)throw new Error('Live video controls are unavailable.');if(!runtime.getLive()?.video)throw new Error('Send a video live first.');const patch=z.object({playing:z.boolean().optional(),position:z.number().finite().min(0).max(86400).optional(),volume:z.number().min(0).max(1).optional(),muted:z.boolean().optional(),brightness:z.number().min(0).max(2).optional(),contrast:z.number().min(0).max(2).optional()}).strict().parse(payload);await runtime.videoControl(patch);return 'Live video updated.';}
  if(action==='alert-show'){if(!runtime)throw new Error('Live alerts are unavailable.');const value=z.object({text:z.string().trim().min(1).max(2000),scrolling:z.boolean().default(false),seconds:z.number().min(0).max(86400).default(0)}).parse(payload);await runtime.alert({id:'operator-alert',text:value.text,scrolling:value.scrolling,...(value.seconds?{expiresAt:Date.now()+value.seconds*1000}:{})});return 'Alert shown on live output.';}
  if(action==='alert-clear'){if(!runtime)throw new Error('Live alerts are unavailable.');await runtime.alert(null);return 'Live alerts cleared.';}
 };
 return {handlers:{'media:tools':handle},resolveSlide,backgroundFor,assetFile,close(){closed=true;stopWatching();for(const worker of workers)void worker.terminate();workers.clear();}};
}
