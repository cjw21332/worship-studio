import type{BrowserWindow,IpcMainInvokeEvent}from'electron';
import{readFile,writeFile,stat}from'node:fs/promises';
import{z}from'zod';
import{settingsStore,SettingsSchema,WorkspaceSettingsSchema,defaultSettings,exportSettingsBackup,parseSettingsDocument,type StudioSettings,type WorkspaceSettings}from'./settings';
import type{createRemote}from'./remote';
import{defaultThemeConfig}from'./themes';
type Context={
 workspaceRoot:string;win:BrowserWindow;remote:ReturnType<typeof createRemote>;
 canChange?:(reason:string)=>void|boolean|Promise<void|boolean>;
 onSettings?:(next:StudioSettings,previous:StudioSettings)=>unknown|Promise<unknown>;
 getWorkspaceSettings?:()=>WorkspaceSettings|Promise<WorkspaceSettings>;
 restoreWorkspaceSettings?:(settings:WorkspaceSettings)=>void|Promise<void>;
 dialogs?:{confirm:(message:string,detail:string)=>Promise<boolean>;save:()=>Promise<string|null>;open:()=>Promise<string|null>};
};
export function extrasHandlers(context:Context){
 const store=settingsStore(context.workspaceRoot),remote=context.remote;
 const dialogAPI=async()=>await import('electron');
 const dialogs=context.dialogs||{
  confirm:async(message:string,detail:string)=>{const {dialog}=await dialogAPI();const result=await dialog.showMessageBox(context.win,{type:'warning',buttons:['Cancel','Confirm'],defaultId:0,cancelId:0,message,detail});return result.response===1;},
  save:async()=>{const {dialog}=await dialogAPI();const result=await dialog.showSaveDialog(context.win,{title:'Back up workspace settings',defaultPath:'worship-studio-settings.json',filters:[{name:'Worship Studio settings',extensions:['json']}]});return result.canceled?null:result.filePath||null;},
  open:async()=>{const {dialog}=await dialogAPI();const result=await dialog.showOpenDialog(context.win,{title:'Restore workspace settings',properties:['openFile'],filters:[{name:'Worship Studio settings',extensions:['json']}]});return result.canceled?null:result.filePaths[0]||null;}
 };
 const initial=()=>({settings:store.get(),remote:remote.status(),warning:store.warning});
 const apply=async(value:unknown)=>{
  const next=SettingsSchema.parse(value),previous=store.get();
  if(JSON.stringify(next.capture)!==JSON.stringify(previous.capture)&&await context.canChange?.('Change capture output appearance.')===false)throw new Error('Output is locked. Confirm the capture change first.');
  store.save(next);await context.onSettings?.(next,previous);return initial();
 };
 return{
  getSettings:()=>store.get(),
  close:()=>remote.stop(),
  handlers:{
   'extras:action':async(_event:IpcMainInvokeEvent,value:unknown):Promise<unknown>=>{
    const {action,payload}=z.object({action:z.enum(['initial','save','remote-start','remote-stop','remote-rotate','remote-qr','backup','restore','reset']),payload:z.unknown().optional()}).strict().parse(value);
    if(action==='save')return apply(payload);
    if(action==='remote-qr'){const {url}=z.object({url:z.string().max(1000)}).strict().parse(payload);return{image:await remote.qr(url)};}
    z.object({}).strict().parse(payload??{});
    if(action==='initial')return initial();
    if(action==='remote-start'){await remote.start();return initial();}
    if(action==='remote-stop'){await remote.stop();return initial();}
    if(action==='remote-rotate'){remote.rotate();return initial();}
    if(action==='backup'){
     const file=await dialogs.save();if(!file)return{...initial(),canceled:true};
     const workspace=context.getWorkspaceSettings?WorkspaceSettingsSchema.parse(await context.getWorkspaceSettings()):undefined;
     await writeFile(file,exportSettingsBackup(store.get(),workspace),'utf8');return{...initial(),message:workspace?'Settings backup saved: workspace controls, themes, Bible preferences and display choices. Remote pairing is excluded.':'Workspace control settings saved. Remote pairing is excluded.'};
    }
    if(action==='restore'){
     const file=await dialogs.open();if(!file)return{...initial(),canceled:true};
     if((await stat(file)).size>30_000_000)throw new Error('Settings backup exceeds 30 MB.');
     const document=parseSettingsDocument(await readFile(file,'utf8'));
     if(document.workspace&&!context.restoreWorkspaceSettings)throw new Error('This build cannot restore presentation settings. Update Worship Studio before restoring this backup.');
     if(!await dialogs.confirm('Restore workspace settings?',document.workspace?'Workspace controls, themes, Bible preferences and saved display choices will be replaced. Songs, services and remote sessions are kept. Restored display choices are not armed; the current live slide is kept.':'Language, touch mode, clicker mappings and capture appearance will be replaced. Your songs, service, presentation themes and remote sessions are kept.'))return{...initial(),canceled:true};
     const next=SettingsSchema.parse(document.settings),previous=store.get();
     if((document.workspace||JSON.stringify(next.capture)!==JSON.stringify(previous.capture))&&await context.canChange?.('Restore presentation themes, Bible preferences, saved display choices and capture appearance.')===false)throw new Error('Output is locked. Confirm the settings restore first.');
     if(document.workspace)await context.restoreWorkspaceSettings!(document.workspace);
     store.save(next);await context.onSettings?.(next,previous);return{...initial(),message:'Settings restored. Current live content and remote pairing were kept. Saved display choices remain disarmed.'};
    }
    if(!await dialogs.confirm('Reset workspace settings?',context.restoreWorkspaceSettings?'Workspace controls, presentation theme preferences, Bible preferences and saved display choices return to defaults. Custom themes in these settings are replaced by the built-in themes. Phone remote will be disabled and paired sessions revoked. Songs, services and media are kept. The current live slide is kept until you send new content or rearm output.':'Language, touch mode, clicker mappings and capture appearance return to defaults. Phone remote will be disabled and paired sessions revoked. Songs, services, media and presentation themes are kept.'))return{...initial(),canceled:true};
    // Guard output changes before disabling a running remote, so a canceled lock
    // confirmation has no side effects on settings or network state.
    const previous=store.get(),next=defaultSettings();
    if((context.restoreWorkspaceSettings||JSON.stringify(next.capture)!==JSON.stringify(previous.capture))&&await context.canChange?.('Reset presentation theme preferences, Bible preferences, saved display choices and capture appearance.')===false)throw new Error('Output is locked. Confirm the settings reset first.');
    if(context.restoreWorkspaceSettings)await context.restoreWorkspaceSettings({themes:defaultThemeConfig(),bible:{translationIds:[],mode:'single',versesPerSlide:1,showVerseNumbers:true},outputs:{}});
    await remote.stop();store.save(next);await context.onSettings?.(next,previous);return{...initial(),message:'Workspace settings reset. Phone remote is disabled; saved display choices are cleared. Current live content is kept.'};
   }
  }
 };
}

