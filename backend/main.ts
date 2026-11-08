import {app,BrowserWindow,ipcMain,screen,dialog,protocol,session,net,clipboard} from 'electron';
import {writeFile,mkdir} from 'node:fs/promises';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {openStore,type Item} from './database';
import {initialPresentation,preview,takeLive,blackout,toggleOutput,toggleFreeze,updatePresentation,clampStageLayout,canAutoAdvance,type Presentation,type Slide} from './presentation';
import {workspaceLocation} from './workspace';
import {songHandlers} from './song-handlers';
import {bibleHandlers} from './bible-handlers';
import {createOutputs,type OutputRole} from './outputs';
import {mediaHandlers} from './media-handlers';
import {activateMediaSlide,nextTimedMediaSlide,patchVideoPlayback} from './media';
import {themeHandlers} from './theme-handlers';
import {serviceHandlers} from './service-handlers';
import {createRemote} from './remote';
import {extrasHandlers} from './extras-handlers';
import {deriveCaptureStyle} from './settings-model';
import {visiblePresentation,type SlideStyle} from './presentation';
import {createDiagnostics} from './diagnostics';
import {createUpdates} from './update';
import {WorkspaceSettingsSchema} from './settings-model';
import {unpackedResource} from './native-path';
import {randomUUID} from 'node:crypto';
class OutputChangeCanceled extends Error {}

// Keep the existing development workspace when launching the named Windows build.
// Explicit disposable/test workspaces and user-supplied paths still take priority.
if(!app.commandLine.hasSwitch('user-data-dir')){const directory=path.join(app.getPath('appData'),'worship-studio');mkdirSync(directory,{recursive:true});app.setPath('userData',directory);}
protocol.registerSchemesAsPrivileged([{scheme:'studio-media',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
let state:Presentation=initialPresentation();
const startup=performance.now();
let diagnostics:ReturnType<typeof createDiagnostics>|undefined;
process.on('uncaughtExceptionMonitor',error=>diagnostics?.error('main.uncaught',error));
process.on('unhandledRejection',error=>diagnostics?.error('main.rejection',error));
app.whenReady().then(async()=>{
 const workspaceRoot=workspaceLocation(app.getPath('userData'));
 await mkdir(workspaceRoot,{recursive:true});
 const store=openStore(path.join(workspaceRoot,'workspace.db'));
 const startingLibrary=unpackedResource(path.join(__dirname,'resources','starting-library.db'));
 if(existsSync(startingLibrary))store.seedStartingLibrary(startingLibrary);
 diagnostics=createDiagnostics({directory:path.join(workspaceRoot,'logs'),version:app.getVersion(),isPackaged:app.isPackaged,getCounters:()=>({songCount:store.listSongs().length,itemCount:store.listItems().length,assetCount:store.assets().length,blackout:state.blackout,freeze:state.freeze}),getOutputs:()=>outputs.list().outputs});
 const mediaRoot=path.join(workspaceRoot,'media'),resourcesRoot=path.join(__dirname,'resources');
 const bundledBibles=unpackedResource(path.join(resourcesRoot,'bundled-bibles.db'));
 if(existsSync(bundledBibles))store.seedBundledBibles(bundledBibles);
 const restoreBiblePreferences=(preferences:ReturnType<typeof store.bible.preferences>)=>{
  const installed=store.bible.translations(),available=preferences.translationIds.filter(id=>installed.some(t=>t.id===id));
  store.bible.setPreferences({...preferences,translationIds:available.length||!preferences.translationIds.length?available:installed.slice(0,1).map(t=>t.id)});
  if(available.length!==preferences.translationIds.length)activity('Some saved Bible translations are not installed here. Passage snapshots are kept; future lookups use an available edition.');
 };
 const win=new BrowserWindow({width:1440,height:900,minWidth:1024,minHeight:640,backgroundColor:'#eef2f5',title:'Worship Studio',icon:path.join(__dirname,'icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.setMenuBarVisibility(false);
 diagnostics.observeWindow(win,'operator');
 win.webContents.on('render-process-gone',()=>{if(!win.isDestroyed())win.webContents.reload();});
 const updates=createUpdates({userData:workspaceRoot,isPackaged:app.isPackaged,version:app.getVersion()});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
 const activity=(message:string,kind:'info'|'error'='info')=>{diagnostics?.log(kind,'workspace.activity');if(!win.isDestroyed())win.webContents.send('workspace:activity',{kind,message});};
 if(!existsSync(bundledBibles)&&!existsSync(startingLibrary))win.webContents.once('did-finish-load',()=>activity('Bundled Bible translations are missing from this installation. Import a translation using File → Import → Bible translation in Full mode.','error'));
 let outputLocked=false,captureStyle:SlideStyle={};
 const requireOutputChange=async(reason:string)=>{
  if(!outputLocked)return;
  const result=await dialog.showMessageBox(win,{type:'warning',buttons:['Keep output locked','Confirm change'],defaultId:0,cancelId:0,message:'Output is locked',detail:reason});
  if(result.response!==1)throw new OutputChangeCanceled('Change canceled. Output remains locked.');
 };
 let choices:Parameters<typeof createOutputs>[0]['choices'];
 try{choices=WorkspaceSettingsSchema.parse({outputs:JSON.parse(readFileSync(path.join(workspaceRoot,'output-displays.json'),'utf8'))}).outputs;}catch{/* First run uses deliberate assignment. */}
 const outputs=createOutputs({operator:win,getState:()=>state,choices,onWindow:(window,role)=>diagnostics?.observeWindow(window,role),onChoices:value=>writeFileSync(path.join(workspaceRoot,'output-displays.json'),JSON.stringify(value)),onEvent:event=>{
  diagnostics?.log(event.kind==='error'?'error':event.kind==='warning'?'warning':'info','output.changed',{role:event.role,displayId:event.displayId});
  if(event.requiresBlackout){state=blackout(state);if(!win.isDestroyed())win.webContents.send('presentation:state',state);}
  activity(event.message,event.kind==='error'?'error':'info');
 }});
 const render=async()=>{outputs.publish();if(!win.isDestroyed())win.webContents.send('presentation:state',state);};
 const themes=themeHandlers({workspaceRoot,win,getState:()=>state,setState:s=>{state=s;},render,canChange:async()=>{await requireOutputChange('Change the theme while output controls are locked.');return true;},resolveContext:slide=>({itemId:slide.itemId,kind:store.listItems().find(i=>i.id===slide.itemId)?.kind||(slide.bible?'bible':'text')})});
 const mediaOps=mediaHandlers(store,win,mediaRoot,value=>activity(value.message),{
  getLive:()=>state.live,
  videoControl:async patch=>{if(!state.live?.video)throw new Error('Send a video live first.');state=updatePresentation(state,{live:{...state.live,video:patchVideoPlayback(state.live.video,patch)}});await render();},
  alert:async alert=>{state=updatePresentation(state,{alerts:alert?[alert]:[]});await render();}
 });
 const serveMedia=async(request:Request)=>{
  try{
   const url=new URL(request.url);if(url.hostname!=='asset'||!/^\/[a-f0-9-]{36}$/i.test(url.pathname))return new Response('Unavailable media',{status:404});
   const asset=mediaOps.assetFile(z.string().uuid().parse(url.pathname.slice(1)),url.searchParams.has('thumbnail'));
   const headers:Record<string,string>={};const range=request.headers.get('range');if(range)headers.Range=range;
   const response=await net.fetch(pathToFileURL(asset.path).href,{headers});
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers:{...Object.fromEntries(response.headers.entries()),'content-type':asset.mime,'x-content-type-options':'nosniff','cache-control':'private, max-age=3600'}});
  }catch{return new Response('Media unavailable. Reimport the source file.',{status:404});}
 };
 session.defaultSession.protocol.handle('studio-media',serveMedia);
 session.fromPartition('worship-output').protocol.handle('studio-media',serveMedia);
 const resolveSlide=async(itemId:string,index:number):Promise<Slide>=>{
  const item=store.listItems().find(i=>i.id===itemId);
  if(!item||index<0||index>=item.slides.length)throw new Error('This service slide is no longer available.');
  const base:Slide={title:item.title,text:item.slides[index],itemId,index,stageText:item.stageSlides?.[index],notes:item.notes,bible:item.biblePages?.[index]};
  if(!item.mediaPages&&base.text.startsWith('asset:')){
   const id=z.string().uuid().parse(base.text.slice(6));mediaOps.assetFile(id);base.image='studio-media://asset/'+id;
  }
  const media=await mediaOps.resolveSlide(item,index),theme=themes.resolveStyle({itemId,kind:item.kind});
  const customTheme=typeof item.themeId==='string'?themes.getConfig().themes.find(t=>t.id===item.themeId):undefined;
  const importedStyle=Array.isArray(item.slideStyles)?item.slideStyles[index] as import('./presentation').SlideStyle:undefined;
  const importedTransition=Array.isArray(item.slideTransitions)?item.slideTransitions[index] as import('./presentation').Transition:undefined;
  const background=typeof item.backgroundId==='string'?store.asset(item.backgroundId):undefined;
  if(background)mediaOps.assetFile(background.id);
  return {...base,...media,style:{...theme.style,...customTheme?.style,...importedStyle,...base.style,...media.style,...captureStyle,...(background?background.kind==='image'?{backgroundImage:'studio-media://asset/'+background.id}:{backgroundVideo:'studio-media://asset/'+background.id}:{})},transition:media.transition??item.transition as import('./presentation').Transition??importedTransition??customTheme?.transition??theme.transition};

 };
 let advanceTimer:ReturnType<typeof setTimeout>|undefined,advanceDue=0,remainingAdvance:number|undefined;
 const scheduleAdvance=(resume=false)=>{
  if(advanceTimer)clearTimeout(advanceTimer);advanceTimer=undefined;
  if(state.freeze||state.blackout||state.clear||state.logo)return;
  const item=store.listItems().find(i=>i.id===state.live?.itemId);if(!item||!state.live)return;
  const next=nextTimedMediaSlide(item,state.live.index||0);if(!next)return;
  const delay=resume&&remainingAdvance!==undefined?remainingAdvance:next.delay;remainingAdvance=undefined;advanceDue=Date.now()+delay;
  const liveIndex=state.live.index??0;
  advanceTimer=setTimeout(()=>{void (async()=>{if(!canAutoAdvance(state,item.id,liveIndex))return;const revision=state.revision;const slide=await resolveSlide(item.id,next.index);if(!canAutoAdvance(state,item.id,liveIndex,revision))return;state=preview(state,slide);await sendLive();})().catch(error=>activity('Auto-advance stopped: '+String(error),'error'));},delay);
 };
 const setNext=async()=>{
  const live=state.live;if(!live?.itemId){state=updatePresentation(state,{next:null});return;}
  const items=store.listItems(),at=items.findIndex(i=>i.id===live.itemId),item=items[at];
  let next:Slide|null=null;
  if(item&&(live.index??0)+1<item.slides.length)next=await resolveSlide(item.id,(live.index??0)+1);
  else if(items[at+1])next=await resolveSlide(items[at+1].id,0);
  state=updatePresentation(state,{next});
 };
 const sendLive=async()=>{
  const active=outputs.list().outputs.filter(o=>o.armed&&!o.windowed);
  const operator=screen.getDisplayMatching(win.getBounds()).id;
  if(active.some(o=>o.displayId===operator)){outputs.disarm();throw new Error('Operator window moved onto an output screen. Reassign output.');}
  const pendingItem=store.listItems().find(i=>i.id===state.preview?.itemId);
  if(pendingItem?.kind==='alert'){
   const alert=z.object({text:z.string().min(1).max(2000),scrolling:z.boolean(),seconds:z.number().min(0).max(86400)}).parse(pendingItem.alert);
   state=updatePresentation(state,{alerts:[{id:pendingItem.id,text:alert.text,scrolling:alert.scrolling,...(alert.seconds?{expiresAt:Date.now()+alert.seconds*1000}:{})}]});await render();return state;
  }
  const previous=state.live?.itemId;state=takeLive(state);
  if(state.live)state=updatePresentation(state,{live:activateMediaSlide(state.live,pendingItem,state.live.index||0)});

  if(!state.freeze&&state.live?.itemId!==previous){
   const item=store.listItems().find(i=>i.id===state.live?.itemId);
   if(item)store.recordItemUsage(item,serviceOps.initial().name);
  }
  await setNext();scheduleAdvance();await render();return state;
 };
 const songOps=songHandlers(store,win,workspaceRoot,app.getPath('userData'));
 const reportSync=(report:ReturnType<typeof songOps.sync>)=>{for(const message of [...report.conflicts,...report.errors])activity('Song sync: '+message,'error');};
 // Open from SQLite first; portable file mirrors must not delay the first window.
 let mirrorsReady=false,mirrorTimer:ReturnType<typeof setTimeout>|undefined;
 const mirrorQueue=()=>store.listSongs().map(song=>song.id);
 const mirrorBatch=()=>{
  if(win.isDestroyed())return;
  if(!songOps.isOptimizing())try{
   if(!mirrorsReady){reportSync(songOps.sync());mirrorsReady=true;}
   reportSync(songOps.persist(new Set(mirrorQueue().splice(0,10))));
  }catch(error){activity('Song sync: '+String(error),'error');}
  if(mirrorQueue().length)mirrorTimer=setTimeout(mirrorBatch,100);
 };
 const syncTimer=setInterval(()=>{if(!mirrorsReady||mirrorQueue().length||songOps.isOptimizing())return;try{reportSync(songOps.sync());}catch(error){activity('Song sync: '+String(error),'error');}},5000);
 const serviceOps=serviceHandlers({
  store,win,workspaceRoot,mediaRoot,
  outputStatus:()=>{const status=outputs.list(),audience=status.outputs.find(o=>o.role==='audience');return {armed:!!audience?.armed,displayFound:audience?.displayId===null?status.displays.some(d=>!d.operator):!!audience?.connected};},
  missingFonts:async()=>{const result=await themes.handlers['themes:action']({} as Electron.IpcMainInvokeEvent,{action:'font-check',payload:{families:themes.getConfig().themes.map(t=>t.style.fontFamily||'Segoe UI')}}) as {missing:string[]};return result.missing;},
  assetFile:mediaOps.assetFile,
  settings:()=>({themes:themes.getConfig(),bible:store.bible.preferences()}),
  snapshotItems:()=>store.listItems().map(item=>({...item,slideStyles:item.slides.map((_,index)=>({...themes.resolveStyle({itemId:item.id,kind:item.kind}).style,...(typeof item.themeId==='string'?themes.getConfig().themes.find(t=>t.id===item.themeId)?.style:{}),...(Array.isArray(item.slideStyles)?item.slideStyles[index] as import('./presentation').SlideStyle:{}),...mediaOps.backgroundFor(item,index),...item.mediaPages?.[index]?.style})),slideTransitions:item.slides.map((_,index)=>item.mediaPages?.[index]?.transition??themes.resolveStyle({itemId:item.id,kind:item.kind}).transition)})),
  onLoad:service=>{if(service.settings.themes)themes.restoreConfig(service.settings.themes);if(service.settings.bible)restoreBiblePreferences(service.settings.bible);},
  onError:message=>activity(message,'error')
 });
 let remoteQueue:Promise<unknown>=Promise.resolve();
 const remote=createRemote({
  getState:()=>{const visible=visiblePresentation(state);return {title:visible.live?.title||'',text:visible.live?.text||'',blackout:visible.blackout,logo:visible.logo,index:visible.live?.index||0,items:store.listItems().map(i=>({id:i.id,title:i.title,slideCount:i.slides.length}))};},
  command:command=>{
   const execute=async()=>{
    if(command.action==='blackout'||command.action==='logo'){state=toggleOutput(state,command.action);await render();return;}
    if(command.action==='live'){await sendLive();return;}
    const items=store.listItems();let item:Item|undefined=items.find(i=>i.id===(state.live?.itemId||state.preview?.itemId))||items[0],index=state.live?.index||0;
    if(command.action==='goto'){item=items.find(i=>i.id===command.itemId);index=command.index;}
    else{const direction=command.action==='next'?1:-1;index+=direction;if(item&&index>=item.slides.length){item=items[items.findIndex(i=>i.id===item!.id)+1];index=0;}else if(item&&index<0){item=items[items.findIndex(i=>i.id===item!.id)-1];index=item?item.slides.length-1:0;}}
    if(!item)throw new Error('No more service items in this direction.');state=preview(state,await resolveSlide(item.id,index));await sendLive();
   };
   const next=remoteQueue.then(execute);remoteQueue=next.catch(()=>{});return next;
  },
  onLog:message=>activity(message)
 });
 const extras=extrasHandlers({workspaceRoot,win,remote,canChange:async reason=>{await requireOutputChange(reason);return true;},
 getWorkspaceSettings:()=>({themes:themes.getConfig(),bible:store.bible.preferences(),outputs:outputs.choices()}),
 restoreWorkspaceSettings:settings=>{if(settings.themes)themes.restoreConfig(settings.themes);if(settings.bible)restoreBiblePreferences(settings.bible);if(settings.outputs)outputs.restoreChoices(settings.outputs);},
 onSettings:async next=>{
  captureStyle=deriveCaptureStyle(next);
  // Preferences affect the next explicit take/Apply. Restoring settings must not
  // restyle or recolor an audience frame during a service.
  if(!win.isDestroyed())win.webContents.send('settings:state',next);
 }});
 captureStyle=deriveCaptureStyle(extras.getSettings());
 state=updatePresentation(state,{theme:{...themes.resolveStyle({}).style,...captureStyle}});
 const roles=z.enum(['audience','audience-secondary','stage','rehearsal','confidence']);
 const handlers:Record<string,(_event:Electron.IpcMainInvokeEvent,value:unknown)=>unknown>={
  ...songOps.handlers,
  ...mediaOps.handlers,
  ...themes.handlers,
  ...serviceOps.handlers,
  ...extras.handlers,
  'updates:action':(_event,value)=>updates.handle(value),
  'diagnostics:action':async(_event,value)=>{
   const input=z.object({action:z.enum(['report','copy','export','renderer-error']),payload:z.unknown().optional()}).strict().parse(value);
   if(input.action==='renderer-error'){const payload=z.object({name:z.enum(['Error','TypeError','RangeError','SyntaxError','ReferenceError']),code:z.literal('renderer-error')}).strict().parse(input.payload);diagnostics?.log('error','renderer.boundary',{role:'operator',errorName:payload.name});return;}
   z.object({}).strict().parse(input.payload??{});
   if(input.action==='report')return diagnostics!.snapshot();
   if(input.action==='copy'){clipboard.writeText(diagnostics!.report());return {message:'Diagnostic information copied. Content, paths and credentials are excluded.'};}
   const result=await dialog.showSaveDialog(win,{defaultPath:'worship-studio-diagnostics.json',filters:[{name:'Diagnostics',extensions:['json']}]});if(result.canceled||!result.filePath)return {canceled:true};diagnostics!.exportReport(result.filePath);return {message:'Diagnostic information exported.'};
  },
  ...bibleHandlers({store,win,resourcesRoot,getState:()=>state,setState:s=>{state=s;},render,workerPath:unpackedResource(path.join(__dirname,'bible-worker.cjs')),prepareSlide:slide=>{const theme=themes.resolveStyle({kind:'bible'});return {...slide,style:{...theme.style,...captureStyle},transition:theme.transition};},onLive:page=>store.recordItemUsage({id:randomUUID(),position:0,kind:'bible',title:page.reference,slides:[page.columns.map(c=>c.text).join('\n')],biblePages:[page]},serviceOps.initial().name)}),
  'workspace:copy-path':(_event,value)=>{z.object({}).strict().parse(value??{});clipboard.writeText(workspaceRoot);return true;},
  'workspace:info':()=>({path:workspaceRoot,version:app.getVersion()}),
  'service:new':(_event)=>serviceOps.handlers['service:action'](_event,{action:'new',payload:{}}),
  'outputs:action':async(_event,value)=>{
   const input=z.object({action:z.enum(['list','arm','disarm','identify','pattern','lock','stage']),payload:z.unknown().optional()}).strict().parse(value);
   if(input.action==='list')return {...outputs.list(),locked:outputLocked};
   if(input.action==='identify'){await outputs.identify();return;}
   if(input.action==='lock'){
    const {locked}=z.object({locked:z.boolean()}).strict().parse(input.payload);
    if(!locked)await requireOutputChange('Unlock output controls for display, theme and resolution changes.');
    outputLocked=locked;return {locked};
   }
   if(input.action==='arm'){
    const payload=z.object({role:roles,displayId:z.number().int().optional(),split:z.enum(['full','left','right']).optional(),windowed:z.boolean().optional()}).strict().parse(input.payload);
    await requireOutputChange('Change the display used for '+payload.role+'.');await outputs.arm(payload);await render();return outputs.list();
   }
   if(input.action==='disarm'){
    const payload=z.object({role:roles.optional()}).strict().parse(input.payload??{});
    // Emergency disarming remains available while locked.
    outputs.disarm(payload.role);await render();return outputs.list();
   }
   if(input.action==='pattern'){
    const payload=z.object({displayId:z.number().int(),kind:z.enum(['grid','bars','resolution']),seconds:z.number().min(.5).max(10).optional()}).strict().parse(input.payload);
    await requireOutputChange('Show a test pattern on the selected physical display.');await outputs.testPattern(payload);return;
   }
   const payload=z.object({message:z.string().max(1000),showChords:z.boolean(),layout:z.array(z.object({id:z.enum(['current','next','notes','clock','countdown','message']),x:z.number(),y:z.number(),width:z.number(),height:z.number(),fontSize:z.number()})).max(6)}).strict().parse(input.payload);
   state=updatePresentation(state,{stage:{...payload,layout:clampStageLayout(payload.layout)}});await render();return state;
  },
  'displays:list':()=>outputs.list(),
  'displays:identify':()=>outputs.identify(),
  'displays:arm':async(_e,value)=>{await requireOutputChange('Arm the audience display.');await outputs.arm({role:'audience',displayId:z.number().int().parse(value)});await render();},
  'displays:disarm':()=>outputs.disarm('audience'),
  'media:list':()=>store.assets(),
  'media:add':(_e,value)=>{const id=z.string().uuid().parse(value),asset=store.asset(id);if(!asset)throw new Error('Image not found.');store.addSlides(asset.title,['asset:'+id]);},
  'media:import':async(_e,value)=>{
   const kind=z.enum(['image','powerpoint']).parse(value);
   const result=await mediaOps.handlers['media:tools'](_e,{action:'import',payload:{kind}});
   return typeof result==='object'&&result&&'message'in result?String(result.message)+('warning'in result&&result.warning?' '+String(result.warning):''):result;
  },
  'files:transfer':async(_event,value)=>{
   const action=z.enum(['save-service','open-service','export-songs','import-songs','import-bible']).parse(value);
   if(action==='save-service')return serviceOps.save();
   if(action==='open-service')return serviceOps.open();
   if(action==='import-bible')throw new Error('Use the Bible import wizard to preview the translation and confirm its licence.');
   if(action==='import-songs')throw new Error('Use the song import preview to review duplicates before saving.');
   const result=await dialog.showSaveDialog(win,{defaultPath:'songs.json',filters:[{name:'Song backup',extensions:['json']}]});
   if(result.canceled||!result.filePath)return 'Song export canceled.';
   await writeFile(result.filePath,JSON.stringify({format:'worship-studio-songs-v2',songs:store.listSongs()},null,2),'utf8');return 'Song backup exported.';
  },
  'bible:translations':()=>store.translations(),
  'bible:search':(_e,value)=>{const q=z.object({id:z.string().uuid(),query:z.string().trim().min(1).max(200)}).parse(value);return store.searchBible(q.id,q.query);},
  'service:text':(_e,value)=>{const input=z.object({title:z.string().trim().min(1).max(200),body:z.string().trim().min(1).max(100000)}).parse(value);store.addSlides(input.title,input.body.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean),{kind:'note'});},
  'songs:list':()=>store.listSongs(),
  'songs:create':(_e,value)=>store.saveSong(value),
  'songs:update':(_e,value)=>{const input=z.object({id:z.string().uuid(),song:z.unknown()}).parse(value);songOps.withLocks([input.id],()=>store.updateSong(input.id,input.song));},
  'songs:delete':(_e,value)=>{const id=z.string().uuid().parse(value);songOps.withLocks([id],()=>{songOps.files.markDeleted([id]);store.deleteSong(id);});},
  'service:list':()=>store.listItems(),
  'service:duplicate':(_e,value)=>store.duplicateItem(z.string().uuid().parse(value)),
  'service:reorder':(_e,value)=>store.reorder(z.array(z.string().uuid()).parse(value)),
  'service:add':(_e,value)=>{const input=typeof value==='string'?{id:z.string().uuid().parse(value),maxLines:4}:z.object({id:z.string().uuid(),maxLines:z.union([z.literal(2),z.literal(3),z.literal(4),z.literal(6)])}).parse(value);store.addSong(input.id,input.maxLines);return store.listItems();},
  'service:remove':(_e,value)=>{store.removeItem(z.string().uuid().parse(value));return store.listItems();},
  'songs:quick-edit':async(_e,value)=>{
   const input=z.object({itemId:z.string().uuid(),song:z.unknown(),maxLines:z.union([z.literal(2),z.literal(3),z.literal(4),z.literal(6)])}).parse(value);
   store.updateServiceSong(input.itemId,input.song,input.maxLines);
   if(state.live?.itemId===input.itemId){const item=store.listItems().find(i=>i.id===input.itemId)!;state=updatePresentation(state,{live:await resolveSlide(item.id,Math.min(state.live.index||0,item.slides.length-1))});await setNext();await render();}
   return state;
  },
  'presentation:get':()=>state,
  'presentation:preview-font-size':async(_event,value)=>{const size=z.number().finite().min(8).max(400).parse(value);if(!state.preview)throw new Error('Choose a slide to preview first.');const current=state.preview;state=updatePresentation(state,{preview:{...current,style:{...current.style,minFontSize:Math.min(current.style?.minFontSize??20,size),maxFontSize:size}}});await render();return state;},
  'presentation:preview':async(_e,value)=>{
  const slide=z.object({title:z.string().max(200),text:z.string().max(100000),itemId:z.string().uuid().optional(),index:z.number().int().min(0).optional()}).strict().nullable().parse(value);
  if(slide===null){state=updatePresentation(state,{preview:null});return state;}
  const theme=themes.resolveStyle({kind:'text'});state=preview(state,slide.itemId?await resolveSlide(slide.itemId,slide.index??0):{...slide,style:{...theme.style,...captureStyle},transition:theme.transition});return state;
},
  'presentation:navigate':async(_event,value)=>{
   const {direction}=z.object({direction:z.union([z.literal(-1),z.literal(1)])}).strict().parse(value);
   const items=store.listItems();let item=items.find(i=>i.id===(state.live?.itemId||state.preview?.itemId))||items[0];if(!item)throw new Error('Add content to the service first.');
   let index=(state.live?.index??state.preview?.index??-1)+direction;
   if(index>=item.slides.length){item=items[items.findIndex(i=>i.id===item.id)+1];index=0;}else if(index<0){item=items[items.findIndex(i=>i.id===item.id)-1];index=item?item.slides.length-1:0;}
   if(!item)throw new Error('You reached the end of the service in this direction.');state=preview(state,await resolveSlide(item.id,index));return sendLive();
  },
  'presentation:live':()=>sendLive(),
  'presentation:blackout':async()=>{state=blackout(state);await render();return state;},
  'presentation:toggle':async(_e,value)=>{state=toggleOutput(state,z.enum(['blackout','clear','logo']).parse(value));await render();return state;},
  'presentation:freeze':async()=>{
   const previouslyShown=visiblePresentation(state).live;
   if(!state.freeze){remainingAdvance=advanceTimer?Math.max(1,advanceDue-Date.now()):undefined;if(advanceTimer)clearTimeout(advanceTimer);}
   state=toggleFreeze(state);
   if(!state.freeze){scheduleAdvance(true);if(state.live?.itemId&&state.live.itemId!==previouslyShown?.itemId){const item=store.listItems().find(i=>i.id===state.live?.itemId);if(item)store.recordItemUsage(item,serviceOps.initial().name);}else if(state.live?.bible&&!state.live.itemId&&state.live.text!==previouslyShown?.text){store.recordItemUsage({id:randomUUID(),position:0,kind:'bible',title:state.live.title,slides:[state.live.text],biblePages:[state.live.bible]},serviceOps.initial().name);}}
   await render();return state;
  }
 };
 for(const [channel,handler] of Object.entries(handlers))ipcMain.handle(channel,async(event,value)=>{
  if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw new Error('Unauthorized sender.');
  if(songOps.isOptimizing()&&(channel.startsWith('songs:')||channel==='workspace:choose'))throw new Error('Wait for library optimization to finish.');
  const action=value&&typeof value==='object'&&'action'in value?String(value.action):'';
  const changesService=['service:new','service:duplicate','service:reorder','service:add','service:remove','service:text','media:add','media:import','songs:quick-edit'].includes(channel)
   ||channel==='service:action'&&['new','item','open','recent','template-open','template-sunday','recover'].includes(action)
   ||channel==='media:tools'&&['drop','asset-add','document-add'].includes(action)
   ||channel==='bible:action'&&action==='add'||channel==='files:transfer'&&value==='open-service';
  const before=changesService?store.listItems():null,started=performance.now();
  let result:unknown;
  try{result=await handler(event,value);}catch(error){if(error instanceof OutputChangeCanceled)return {message:error.message};diagnostics?.error('ipc.failed',error);throw error;}
  if(before)serviceOps.capture(before);
  if(['songs:create','songs:update','songs:delete'].includes(channel))reportSync(songOps.persist());
  if(['presentation:live','presentation:navigate'].includes(channel))diagnostics?.measure('slide.ipc',performance.now()-started);
  return result;
 });
 if(!app.isPackaged&&process.env.VITE_DEV_SERVER_URL)await win.loadURL(process.env.VITE_DEV_SERVER_URL);
 else await win.loadFile(path.join(__dirname,'../dist/index.html'));
 diagnostics.measure('startup',performance.now()-startup);
 mirrorTimer=setTimeout(mirrorBatch,1500);
 win.on('close',event=>{if(songOps.isOptimizing()){event.preventDefault();activity('Wait for library optimization to finish before closing.','error');}});
 win.on('closed',()=>{void (async()=>{clearInterval(syncTimer);if(mirrorTimer)clearTimeout(mirrorTimer);songOps.close();if(advanceTimer)clearTimeout(advanceTimer);mediaOps.close();outputs.close();await extras.close();await serviceOps.close();store.close();diagnostics?.close();app.quit();})().catch(error=>{diagnostics?.error('shutdown.failed',error);app.quit();});});
}).catch(error=>{diagnostics?.error('startup.failed',error);console.error('Worship Studio startup failed:',error instanceof Error?error.name:'Error');dialog.showErrorBox('Worship Studio could not start','The workspace could not be opened. Check that its folder is available and writable, then restart. Your saved files have been kept.');app.quit();});
