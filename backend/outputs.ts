import * as ElectronRuntime from 'electron';
import type {BrowserWindow as WindowType,IpcMainInvokeEvent,Display} from 'electron';
import path from 'node:path';
import type {Presentation} from './presentation';

export type OutputRole='audience'|'audience-secondary'|'stage'|'rehearsal'|'confidence';
export type OutputSplit='full'|'left'|'right';
export type OutputChoice={displayId:number;split?:OutputSplit};
export type OutputEvent={kind:'info'|'warning'|'error';message:string;role?:OutputRole;displayId?:number;requiresBlackout?:boolean};
export type OutputAssignment={role:OutputRole;displayId:number;enabled:boolean;connected:boolean};
export type DisplayChange={kind:'added'|'removed'|'metrics';displayId:number};
export type DisplayAction={role:OutputRole;action:'suspend'|'reconnect'|'reposition'};
export function planDisplayChange(assignments:readonly OutputAssignment[],change:DisplayChange):DisplayAction[]{
 return assignments.filter(slot=>slot.enabled&&slot.displayId===change.displayId).flatMap<DisplayAction>(slot=>{
  if(change.kind==='removed'&&slot.connected)return [{role:slot.role,action:'suspend' as const}];
  if(change.kind==='added'&&!slot.connected)return [{role:slot.role,action:'reconnect' as const}];
  if(change.kind==='metrics'&&slot.connected)return [{role:slot.role,action:'reposition' as const}];
  return [];
 });
}
export function splitViewport(split:OutputSplit):{width:string;left:string}{
 return split==='left'?{width:'200%',left:'0%'}:split==='right'?{width:'200%',left:'-100%'}:{width:'100%',left:'0%'};
}
type Slot={
 role:OutputRole;displayId:number;split:OutputSplit;enabled:boolean;connected:boolean;window:WindowType|null;
 windowed:boolean;awaitingBlack:boolean;closing:boolean;generation:number;
};
export type OutputManagerOptions={
 operator:WindowType;getState:()=>Presentation;
 onEvent?:(event:OutputEvent)=>void;
 choices?:Partial<Record<OutputRole,OutputChoice>>;
 onChoices?:(choices:Partial<Record<OutputRole,OutputChoice>>)=>void;
 onWindow?:(window:WindowType,role:OutputRole)=>void;
 entryFile?:string;devServerURL?:string;preloadFile?:string;
};
export function createOutputs(options:OutputManagerOptions){
 // Keeping runtime access inside the factory lets Node unit tests exercise the pure
 // display planner without constructing native Electron windows.
 const runtime=(ElectronRuntime as typeof ElectronRuntime&{default?:typeof ElectronRuntime}).default??ElectronRuntime;
 const {BrowserWindow,screen,ipcMain}=runtime;
 const roles:OutputRole[]=['audience','audience-secondary','stage','rehearsal','confidence'];
 const slots=new Map<OutputRole,Slot>();
 const patterns=new Set<WindowType>();
 let revision=0,closed=false;
 const event=(value:OutputEvent)=>options.onEvent?.(value);
 const operatorId=()=>screen.getDisplayMatching(options.operator.getBounds()).id;
 const allDisplays=()=>screen.getAllDisplays();
 let savedChoices=structuredClone(options.choices??{});
 const choices=():Partial<Record<OutputRole,OutputChoice>>=>structuredClone(savedChoices);
 for(const role of roles){
  const choice=options.choices?.[role];
  if(choice)slots.set(role,{role,displayId:choice.displayId,split:choice.split??'full',enabled:false,connected:allDisplays().some(d=>d.id===choice.displayId),window:null,windowed:role==='rehearsal',awaitingBlack:true,closing:false,generation:0});
 }
 const stateSnapshot=():Presentation=>{
  const state=structuredClone(options.getState());
  revision=Math.max(revision+1,state.revision||0);
  return {...state,revision};
 };
 const slotSnapshot=(slot:Slot,snapshot:Presentation):Presentation=>{
  if(slot.awaitingBlack){
   if(snapshot.blackout)slot.awaitingBlack=false;
   return {...structuredClone(snapshot),blackout:true};
  }
  return structuredClone(snapshot);
 };
 const isOutputSender=(e:IpcMainInvokeEvent):boolean=>[...slots.values()].some(s=>s.window&&!s.window.isDestroyed()&&s.window.webContents===e.sender&&e.senderFrame===s.window.webContents.mainFrame);
 ipcMain.handle('output:get',(e)=>{
  const slot=[...slots.values()].find(s=>s.window&&!s.window.isDestroyed()&&s.window.webContents===e.sender&&e.senderFrame===s.window.webContents.mainFrame);
  if(!slot)throw new Error('Only a known output main frame can read presentation state.');
  return slotSnapshot(slot,stateSnapshot());
 });
 const publish=():Presentation=>{
  const snapshot=stateSnapshot();
  for(const slot of slots.values()){
   const win=slot.window;if(!win||win.isDestroyed()||win.webContents.isDestroyed())continue;
   win.webContents.send('output:state',slotSnapshot(slot,snapshot));
  }
  return snapshot;
 };
 const list=()=>{
  const displays=allDisplays().map((d,index)=>({id:d.id,number:index+1,label:d.label||'Display '+(index+1),width:d.size.width,height:d.size.height,primary:d.id===screen.getPrimaryDisplay().id,operator:d.id===operatorId()}));
  const outputs=roles.map(role=>{
   const slot=slots.get(role),available=slot?displays.some(d=>d.id===slot.displayId):false;
   return {role,displayId:slot?.displayId??null,split:slot?.split??'full',armed:!!slot?.window&&!slot.window.isDestroyed(),connected:available,enabled:slot?.enabled??false,suspended:!!slot?.enabled&&!slot.window,windowed:slot?.windowed??role==='rehearsal'};
  });
  return {displays,outputs,target:outputs.find(s=>s.role==='audience'&&s.armed)?.displayId??null};
 };
 const closeSlot=(slot:Slot)=>{
  const win=slot.window;slot.window=null;slot.closing=true;slot.generation++;
  if(win&&!win.isDestroyed())win.close();
  slot.closing=false;
 };
 const loadSlot=async(slot:Slot)=>{
  if(closed)return;
  const display=allDisplays().find(d=>d.id===slot.displayId);
  if(!display){slot.connected=false;return;}
  if(!slot.windowed&&display.id===operatorId()){
   slot.enabled=false;slot.connected=true;
   throw new Error('Move the operator window to another display before opening physical output here.');
  }
  closeSlot(slot);slot.connected=true;slot.awaitingBlack=true;
  const bounds=slot.windowed?{x:display.workArea.x+40,y:display.workArea.y+40,width:Math.max(320,Math.min(1000,display.workArea.width-80)),height:Math.max(200,Math.min(650,display.workArea.height-80))}:display.bounds;
  const generation=slot.generation;
  const presentation=options.getState(),transparent=slot.windowed&&(presentation.live?.style?.background??presentation.theme?.background)==='transparent'&&slot.role!=='stage'&&slot.role!=='confidence';
  const win=new BrowserWindow({
   ...bounds,title:'Worship Studio — '+slot.role,fullscreen:!slot.windowed,frame:slot.windowed&&!transparent,show:false,
   backgroundColor:transparent?'#00000000':'#000000',transparent,autoHideMenuBar:true,
   webPreferences:{preload:options.preloadFile??path.join(__dirname,'output-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,partition:'worship-output'}
  });
  slot.window=win;
  options.onWindow?.(win,slot.role);
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  win.on('closed',()=>{
   if(slot.window!==win)return;
   slot.window=null;
   if(!slot.closing&&!closed){slot.enabled=false;event({kind:'info',message:slot.role+' output closed.',role:slot.role,displayId:slot.displayId});}
  });
  win.webContents.on('render-process-gone',(_e,details)=>{
   const audience=slot.role==='audience'||slot.role==='audience-secondary';
   slot.awaitingBlack=audience;
   event({kind:'error',message:slot.role+' output renderer stopped ('+details.reason+'). Reloading this output.',role:slot.role,displayId:slot.displayId,requiresBlackout:audience});
   if(!win.isDestroyed()){win.webContents.reload();publish();}
  });
  const hash=new URLSearchParams({output:slot.role,split:slot.split}).toString();
  try{
   if(options.devServerURL){const url=new URL(options.devServerURL);url.hash=hash;await win.loadURL(url.href);}
   else await win.loadFile(options.entryFile??path.join(__dirname,'../dist/index.html'),{hash});
   if(!closed&&slot.enabled&&slot.window===win&&slot.generation===generation&&!win.isDestroyed()){win.showInactive();publish();}
  }catch(error){
   // Removal/disarm/reassignment can close a window while loadFile is pending.
   // That cancellation must not erase the enabled assignment needed to reconnect.
   if(slot.window===win&&slot.generation===generation){closeSlot(slot);slot.enabled=false;throw error;}
  }
 };
 const arm=async(input:{role:OutputRole;displayId?:number;split?:OutputSplit;windowed?:boolean})=>{
  if(closed)throw new Error('Output manager is closed.');
  if(!roles.includes(input.role))throw new Error('Unknown output role.');
  const existing=slots.get(input.role);
  const displayId=input.displayId??savedChoices[input.role]?.displayId??existing?.displayId??operatorId();
  const display=allDisplays().find(d=>d.id===displayId);if(!display)throw new Error('The chosen display is not connected.');
  const windowed=input.role==='rehearsal'||!!input.windowed;
  if(!windowed&&displayId===operatorId())throw new Error('Choose a display other than the operator screen, or explicitly open a windowed preview.');
  if(!windowed&&[...slots.values()].some(s=>s.role!==input.role&&s.window&&!s.windowed&&s.displayId===displayId))throw new Error('That physical display is already assigned to another output.');
  const split=input.split??savedChoices[input.role]?.split??existing?.split??'full';
  if(!['full','left','right'].includes(split))throw new Error('Unknown projection split.');
  if(existing)closeSlot(existing);
  const slot:Slot={role:input.role,displayId,split,enabled:true,connected:true,window:null,windowed,awaitingBlack:true,closing:false,generation:0};
  slots.set(input.role,slot);
  event({kind:'info',message:input.role+' output armed. Output starts black.',role:input.role,displayId,requiresBlackout:true});
  await loadSlot(slot);
  if(slots.get(input.role)===slot){savedChoices[input.role]={displayId,split};options.onChoices?.(choices());}
 };
 const disarm=(role?:OutputRole)=>{
  for(const slot of slots.values())if(!role||slot.role===role){slot.enabled=false;closeSlot(slot);}
  event({kind:'info',message:role?role+' output disarmed.':'All outputs disarmed.'});
 };
 const handleChange=async(change:DisplayChange)=>{
  const assignments=[...slots.values()].map(s=>({role:s.role,displayId:s.displayId,enabled:s.enabled,connected:s.connected}));
  for(const plan of planDisplayChange(assignments,change)){
   const slot=slots.get(plan.role)!;
   if(plan.action==='suspend'){
    slot.connected=false;slot.awaitingBlack=true;closeSlot(slot);
    event({kind:'warning',message:slot.role+' display disconnected. Its output is suspended; it will reconnect black when the same display returns.',role:slot.role,displayId:slot.displayId,requiresBlackout:slot.role==='audience'||slot.role==='audience-secondary'});
   }else if(plan.action==='reconnect'){
    event({kind:'info',message:slot.role+' display returned. Reconnecting with black output.',role:slot.role,displayId:slot.displayId,requiresBlackout:true});
    try{await loadSlot(slot);}catch(error){event({kind:'error',message:error instanceof Error?error.message:String(error),role:slot.role,displayId:slot.displayId});}
   }else{
    const display=allDisplays().find(d=>d.id===slot.displayId);
    if(display&&slot.window&&!slot.window.isDestroyed()&&!slot.windowed){
     slot.window.setBounds(display.bounds);slot.window.setFullScreen(true);
     event({kind:'info',message:slot.role+' output adjusted to the display resolution.',role:slot.role,displayId:slot.displayId});
    }
   }
  }
  for(const slot of slots.values())slot.connected=allDisplays().some(d=>d.id===slot.displayId);
  publish();
 };
 const added=(_e:unknown,d:Display)=>{void handleChange({kind:'added',displayId:d.id});};
 const removed=(_e:unknown,d:Display)=>{void handleChange({kind:'removed',displayId:d.id});};
 const metrics=(_e:unknown,d:Display)=>{void handleChange({kind:'metrics',displayId:d.id});};
 screen.on('display-added',added);screen.on('display-removed',removed);screen.on('display-metrics-changed',metrics);
 const operatorMoved=()=>{
  if(closed||options.operator.isDestroyed())return;
  const occupied=operatorId();
  for(const slot of slots.values())if(slot.enabled&&!slot.windowed&&slot.displayId===occupied){
   slot.enabled=false;closeSlot(slot);
   event({kind:'warning',message:'The operator window moved onto the '+slot.role+' display. Output was disarmed to keep the operator workspace private.',role:slot.role,displayId:slot.displayId,requiresBlackout:true});
  }
 };
 options.operator.on('move',operatorMoved);
 const showPattern=async(display:Display,index:number,kind:'identify'|'grid'|'bars'|'resolution',seconds:number)=>{
  const width=Math.max(1,Math.min(display.bounds.width,Math.max(240,Math.min(520,Math.round(display.bounds.width*.32)))));
  const height=Math.max(1,Math.min(display.bounds.height,Math.round(width*.5625)));
  const win=new BrowserWindow({
   ...(kind==='identify'?{x:display.bounds.x+Math.floor((display.bounds.width-width)/2),y:display.bounds.y+Math.floor((display.bounds.height-height)/2),width,height}:display.bounds),
   frame:false,fullscreen:kind!=='identify',resizable:false,alwaysOnTop:true,skipTaskbar:true,focusable:false,show:false,backgroundColor:'#102d30',
   webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'worship-pattern'}
  });
  patterns.add(win);win.on('closed',()=>patterns.delete(win));win.setMenu(null);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
  const bg=kind==='identify'?'#102d30':kind==='grid'?'repeating-linear-gradient(0deg,transparent 0 9.8%,#fff6 10%),repeating-linear-gradient(90deg,#16232d 0 9.8%,#fff6 10%)':kind==='bars'?'linear-gradient(90deg,#fff 0 12.5%,#ff0 12.5% 25%,#0ff 25% 37.5%,#0f0 37.5% 50%,#f0f 50% 62.5%,#f00 62.5% 75%,#00f 75% 87.5%,#000 87.5%)':'#16232d';
  const label=kind==='identify'?String(index+1):'Display '+(index+1)+'<br>'+display.size.width+' × '+display.size.height+'<br><small>'+kind+' test</small>';
  const policy="default-src 'none'; style-src 'unsafe-inline'";
  const html=kind==='identify'
   ? '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{display:grid;place-items:center;background:#102d30;color:#f4fbf9;font-family:Segoe UI,sans-serif}.frame{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:clamp(3px,1.2vmin,6px) solid #56c5b3;box-shadow:inset 0 0 0 1px #ffffff20}.caption{font-size:clamp(10px,7vmin,25px);font-weight:600;letter-spacing:.02em;color:#b6ded7;line-height:1.2}.number{font-size:min(53vh,'+(String(index+1).length>2?'35':'48')+'vw);font-weight:700;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums}</style><main class="frame"><span class="caption">Screen</span><strong class="number">'+(index+1)+'</strong></main>'
   : '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><body style="margin:0;height:100vh;overflow:hidden;display:grid;place-items:center;color:white;text-align:center;background:'+bg+';font:700 64px Segoe UI"><div style="background:#0009;padding:24px;border:2px solid white">'+label+'</div>';
  await win.loadURL('data:text/html,'+encodeURIComponent(html));
  if(!win.isDestroyed())win.showInactive();
  setTimeout(()=>{if(!win.isDestroyed())win.close();},Math.max(500,Math.min(10000,seconds*1000)));
 };
 const identify=async()=>{await Promise.all(allDisplays().map((display,index)=>showPattern(display,index,'identify',2)));};
 const testPattern=async(input:{displayId:number;kind:'grid'|'bars'|'resolution';seconds?:number})=>{
  const displays=allDisplays(),index=displays.findIndex(d=>d.id===input.displayId);if(index<0)throw new Error('Display is unavailable.');
  if(!['grid','bars','resolution'].includes(input.kind))throw new Error('Unknown test pattern.');
  await showPattern(displays[index],index,input.kind,input.seconds??3);
 };
 const close=()=>{
  closed=true;
  screen.removeListener('display-added',added);screen.removeListener('display-removed',removed);screen.removeListener('display-metrics-changed',metrics);
  options.operator.removeListener('move',operatorMoved);
  ipcMain.removeHandler('output:get');
  for(const slot of slots.values()){slot.enabled=false;closeSlot(slot);}
  for(const pattern of patterns)if(!pattern.isDestroyed())pattern.close();
 };
 const restoreChoices=(value:Partial<Record<OutputRole,OutputChoice>>)=>{
  // Restoring preferences does not move, arm or close any running output.
  savedChoices=structuredClone(value);options.onChoices?.(choices());
  for(const role of roles){const current=slots.get(role),choice=savedChoices[role];if(current?.enabled)continue;if(!choice){slots.delete(role);continue;}slots.set(role,{role,displayId:choice.displayId,split:choice.split??'full',enabled:false,connected:allDisplays().some(d=>d.id===choice.displayId),window:null,windowed:role==='rehearsal',awaitingBlack:true,closing:false,generation:0});}
 };
 return {list,arm,disarm,publish,identify,testPattern,close,isOutputSender,choices,restoreChoices};
}

