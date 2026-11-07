import{Settings as SettingsV2}from'./ui-v2/Settings';
import {TextStyles} from './TextStyles';
import type{DeskController,V2Preferences}from'./ui-v2/types';
import{modeAllows}from'./ui-v2/keyboard';
import{v2LayoutDefaults}from'./ui-v2/layout';
import{KitchenSink}from'./ui-v2/KitchenSink';
import{DeskV2}from'./ui-v2/DeskV2';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Song,Item} from '../backend/database';
import {initialPresentation,visiblePresentation} from '../backend/presentation';
import type {Asset,Translation} from '../backend/preload';
import './api';
import {Modal,Select,Toasts,type Notice} from './ui';
import {shortcutFor,resolvedShortcuts} from './shortcuts';
import './style.css';
import './desk-base.css';
import {SongEditor,DatabaseManager} from './SongTools';
import {SongImport} from './SongImport';
import {BiblePanel} from './BiblePanel';
import {BibleImport} from './BibleImport';
import {Output} from './Output';
import {OutputSettings,type OutputStatus} from './OutputSettings';
import {ThemeEditor} from './ThemeEditor';
import {ServicePlanner,ItemOptions,type ServiceStatus} from './ServicePlanner';
import {DeskTooltip} from './DeskTooltip';
import {deferredActions} from './DeferredActions';
import {AccessibilitySettings} from './AccessibilitySettings';
import {SimpleThemes} from './SimpleThemes';
import {useAccessibility} from './useAccessibility';
import {libraryTabs} from './library-model';
import {outputView,acceptSnapshot} from './desk-model';
import {deskT} from './i18n';
import './operator-support.css';
import {ExtrasSettings} from './ExtrasSettings';
import {ErrorBoundary} from './ErrorBoundary';
import {ReliabilitySettings} from './ReliabilitySettings';
import {Tutorial} from './Tutorial';
import {defaultSettings} from '../backend/settings-model';
import {applyWorkspaceLanguage,applyTouchMode} from './i18n';
function App(){
 const [songs,setSongs]=useState<Song[]>([]),[items,setItems]=useState<Item[]>([]),[presentation,setPresentation]=useState(initialPresentation),[assets,setAssets]=useState<Asset[]>([]),[translations,setTranslations]=useState<Translation[]>([]);
 const [extrasSettings,setExtrasSettings]=useState(defaultSettings);
 useAccessibility(extrasSettings);
 const tr=(label:string)=>deskT(extrasSettings.language,label);
 const simple=extrasSettings.accessibility.mode==='simple';
 useEffect(()=>{void window.studio.extras('initial',{}).then(value=>setExtrasSettings(value.settings));return window.studio.onSettings(setExtrasSettings);},[]);
 useEffect(()=>{applyWorkspaceLanguage(extrasSettings.language);applyTouchMode(extrasSettings.touchMode);},[extrasSettings]);
 const [outputSection,setOutputSection]=useState('displays'),[preflightIssues,setPreflightIssues]=useState<{kind:string;message:string}[]>([]);
 const [itemField,setItemField]=useState<'title'|'notes'|'colorTag'>('title');
 const [textStyleKind,setTextStyleKind]=useState('song');
 const [serviceStatus,setServiceStatus]=useState<ServiceStatus|null>(null),[itemOptions,setItemOptions]=useState<Item|null>(null),[themeOptions,setThemeOptions]=useState<{id:string;name:string}[]>([]);
 const [outputs,setOutputs]=useState<OutputStatus|null>(null);
 const [info,setInfo]=useState({path:'Loading workspace…',version:''}),[selected,setSelected]=useState<string|null>(null),[tab,setTab]=useState('Songs'),[queries,setQueries]=useState<Record<string,string>>({}),[modal,setModal]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [notices,setNotices]=useState<Notice[]>([]),[log,setLog]=useState<Notice[]>([]),[onboarding,setOnboarding]=useState(()=>!localStorage.getItem('studio-onboarded'));
 const [editing,setEditing]=useState<string|null>(null),[title,setTitle]=useState(''),[lyrics,setLyrics]=useState('');
 const [pendingDocuments,setPendingDocuments]=useState<Set<string>>(new Set()),[pendingDeletes,setPendingDeletes]=useState<Set<string>>(new Set()),deleteQueue=useRef(deferredActions()),pendingActions=useRef(0),serviceRevision=useRef(0),serviceFingerprint=useRef('');
 const searchRef=useRef<HTMLInputElement>(null),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const notify=useCallback((text:string,kind:Notice['kind']='success',action?:()=>void)=>{const n={id:Date.now()+Math.random(),text,kind,time:new Date().toLocaleTimeString(),action};setNotices(v=>[...v.slice(-3),n]);setLog(v=>[n,...v].slice(0,200));const timer=setTimeout(()=>{setNotices(v=>v.filter(x=>x.id!==n.id));timers.current=timers.current.filter(t=>t!==timer);},action?10000:4000);timers.current.push(timer);},[]);
 useEffect(()=>window.studio.onPresentation(next=>setPresentation(current=>acceptSnapshot(current,next))),[]);
 useEffect(()=>window.studio.onActivity(value=>notify(value.message,value.kind)),[notify]);
 const refresh=useCallback(async()=>{const [s,i,p,a,t]=await Promise.all([window.studio.songs(),window.studio.service(),window.studio.presentation(),window.studio.media(),window.studio.translations()]);const fingerprint=JSON.stringify(i);if(fingerprint!==serviceFingerprint.current){serviceRevision.current++;serviceFingerprint.current=fingerprint;}setServiceStatus(await window.studio.serviceTools('initial',{}));setSongs(s);setItems(i);setPresentation(current=>acceptSnapshot(current,p));setAssets(a);setTranslations(t);},[]);
 const act=async(fn:()=>Promise<unknown>,message?:string)=>{pendingActions.current++;setBusy(true);try{const result=await fn();await refresh();if(typeof result==='string')notify(result==='Canceled'?(message?message+' canceled.':'File selection canceled.'):result,result==='Canceled'?'info':'success');else if(message)notify(message);if(result&&typeof result==='object'){const feedback=result as {message?:string;warning?:string};if(feedback.message&&!message)notify(tr(feedback.message));if(feedback.warning)notify(tr(feedback.warning),'info');}return result;}catch(error){notify(error instanceof Error?error.message:String(error),'error');return null;}finally{pendingActions.current--;setBusy(pendingActions.current>0);}};
 useEffect(()=>{void refresh().catch(e=>notify(String(e),'error'));void window.studio.info().then(setInfo).catch(e=>notify(String(e),'error'));return()=>{timers.current.forEach(clearTimeout);deleteQueue.current.close();};},[refresh,notify]);
 const saveAccess=async(next:typeof extrasSettings)=>{const result=await window.studio.extras('save',next);setExtrasSettings(result.settings);notify(tr('Accessibility settings saved.'));return result;};
 useEffect(()=>{const check=()=>window.studio.outputs('list',{}).then(value=>{setOutputs(previous=>JSON.stringify(previous)===JSON.stringify(value)?previous:value);}).catch(e=>notify(String(e),'error'));void check();const timer=setInterval(check,1500);return()=>clearInterval(timer);},[notify]);
 useEffect(()=>{if(simple&&tab==='Slides')setTab('Songs');},[simple]);
 const item=items.find(i=>i.id===selected),query=queries[tab]||'';
 const liveView=outputView(outputs,presentation),shownSlide=visiblePresentation(presentation).live;
 const transfer=async(action:string)=>act(()=>window.studio.transfer(action));
 const showSong=async(song?:Song)=>{try{if(song)await window.studio.songLock(song.id);setEditing(song?.id||null);setModal('song');}catch(e){notify(String(e),'error');}};
 const closeSong=()=>{if(editing)void window.studio.songUnlock(editing);setEditing(null);setModal(null);};
 const previewSlide=async(i:Item,n:number,live=false)=>{await act(async()=>{await window.studio.preview({title:i.title,text:i.slides[n],itemId:i.id,index:n});if(live)await window.studio.takeLive();});};
 const navigate=(direction:number)=>{const current=items.find(i=>i.id===(presentation.preview?.itemId||selected));if(!current)return;const index=presentation.preview?.itemId===current.id?(presentation.preview.index??0):-1;const next=Math.max(0,Math.min(current.slides.length-1,index+direction));void previewSlide(current,next);};
 const move=(id:string,direction:number)=>{if(extrasSettings.operatorV2.mode==='present'){notify(tr('Switch to Prepare mode to edit.'),'info');return;}const ids=items.map(i=>i.id),at=ids.indexOf(id),to=at+direction;if(to<0||to>=ids.length)return;[ids[at],ids[to]]=[ids[to],ids[at]];void act(()=>window.studio.reorder(ids),deskT(extrasSettings.language,'Moved to position {position} of {total}',{position:to+1,total:ids.length}));};
 const toggle=(mode:'blackout'|'clear'|'logo')=>void act(()=>window.studio.toggle(mode));
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{const editing=!!(e.target as HTMLElement)?.closest('input,textarea,[contenteditable=true]');if(e.defaultPrevented||modal||onboarding||document.querySelector('dialog[open]'))return;if(e.key==='F6'){e.preventDefault();const panes=Array.from(document.querySelectorAll<HTMLElement>('[data-pane]'));const at=panes.findIndex(p=>p.contains(document.activeElement));panes[(at+(e.shiftKey?-1:1)+panes.length)%panes.length]?.focus();return;}if((e.ctrlKey||e.metaKey)&&!editing&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();if(extrasSettings.operatorV2.mode==='present'){notify(tr('Switch to Prepare mode to edit.'),'info');return;}void act(()=>window.studio.serviceTools(e.key.toLowerCase()==='y'||e.shiftKey?'redo':'undo',{}));return;}if((e.ctrlKey||e.metaKey)&&/^[1-6]$/.test(e.key)){e.preventDefault();if(extrasSettings.operatorV2.mode==='present'){notify(tr('Switch to Prepare mode to edit.'),'info');return;}const chosen=libraryTabs[Number(e.key)-1];if(chosen.id==='Slides'&&simple)void saveAccess({...extrasSettings,accessibility:{...extrasSettings.accessibility,mode:'full'}});setTab(chosen.id);requestAnimationFrame(()=>document.getElementById('tab-'+chosen.id)?.focus());return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='b'){e.preventDefault();if(e.shiftKey){window.dispatchEvent(new Event('studio-quick-focus'));requestAnimationFrame(()=>document.getElementById('quick-bible-reference')?.focus());}else if(extrasSettings.operatorV2.mode==='present')window.dispatchEvent(new Event('studio-quick-focus'));else setModal('quick-bible');return;}if(!(e.ctrlKey||e.metaKey)&&!!(e.target as HTMLElement).closest('[role=tablist],[role=listbox],[role=menu]'))return;const action=shortcutFor(e,editing,extrasSettings.clicker);if(!action)return;if(e.key===' '&&(e.target as HTMLElement).closest('button'))return;e.preventDefault();if(presentation.freeze&&(action==='clear'||action==='logo')){notify(tr('Unfreeze output before changing text or logo.'),'info');return;}if(busy&&!['blackout','search','escape'].includes(action))return;switch(action){case 'next':void act(()=>window.studio.navigate(1));break;case 'previous':void act(()=>window.studio.navigate(-1));break;case 'live':void act(()=>window.studio.takeLive(),tr(presentation.freeze?'Prepared for when output is unfrozen.':'Preview sent live.'));break;case 'blackout':case 'clear':case 'logo':toggle(action);break;case 'escape':setSelected(null);break;case 'save':void transfer('save-service');break;case 'search':if(extrasSettings.operatorV2.mode==='present')notify(tr('Switch to Prepare mode to edit.'),'info');else searchRef.current?.focus();break;}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);});
 const runService=async(action:string,payload:any={})=>{if(!modeAllows(extrasSettings.operatorV2.mode,action)){notify(tr('Switch to Prepare mode to edit.'),'info');return null;}if(action==='item'&&payload.id===presentation.live?.itemId&&!window.confirm(tr('Change this live item?')))return Promise.resolve(null);const result=await act(()=>window.studio.serviceTools(action,payload));if(['new','open','recent','template-open','template-sunday','recover'].includes(action)&&result!==null&&!String(result).toLowerCase().includes('canceled')){await updateUI({mode:'prepare'});setSelected(null);}return result;};
 const deleteSongWithUndo=(id:string)=>{if(pendingDeletes.has(id))return;if(items.some(i=>i.sourceId===id&&i.id===presentation.live?.itemId)&&!window.confirm(tr('Change this live item?')))return;setPendingDeletes(v=>new Set([...v,id]));const clear=()=>setPendingDeletes(v=>{const next=new Set(v);next.delete(id);return next;});const cancel=deleteQueue.current.defer(id,()=>{void act(()=>window.studio.deleteSong(id)).finally(clear);});notify(tr('Song deleted.'),'info',()=>{cancel();clear();});};
 const deleteDocumentWithUndo=(id:string)=>{if(pendingDocuments.has(id))return;if(items.some(i=>i.sourceId===id&&i.id===presentation.live?.itemId)&&!window.confirm(tr('Change this live item?')))return;setPendingDocuments(v=>new Set([...v,id]));const clear=()=>setPendingDocuments(v=>{const next=new Set(v);next.delete(id);return next;});const cancel=deleteQueue.current.defer('document:'+id,()=>{void act(()=>window.studio.mediaTools('document-delete',{id})).finally(clear);});notify(tr('Library item deleted.'),'info',()=>{cancel();clear();});};
 const runSongTools=(action:string,payload:unknown)=>{if(action==='delete'){const ids=(payload as {ids:string[]}).ids;ids.forEach(deleteSongWithUndo);setModal(null);return Promise.resolve(true);}if(action==='merge'){const value=payload as {keepId:string;removeIds:string[]};if(items.some(i=>i.id===presentation.live?.itemId&&[value.keepId,...value.removeIds].includes(i.sourceId||''))&&!window.confirm(tr('Change this live item?')))return Promise.resolve(null);const cancel=deleteQueue.current.defer('merge:'+value.keepId,()=>{void act(()=>window.studio.songTools(action,payload));});setModal(null);notify(tr('Changes scheduled.'),'info',cancel);return Promise.resolve(true);}return act(()=>window.studio.songTools(action,payload));};
 const removeWithUndo=(i:Item)=>{if(presentation.live?.itemId===i.id&&!window.confirm(tr('Change this live item?')))return;void act(async()=>{await window.studio.removeItem(i.id);if(selected===i.id)setSelected(null);}).then(async()=>{if((await window.studio.service()).some(item=>item.id===i.id))return;const revision=serviceRevision.current;notify(tr('Item removed.'),'info',()=>{if(serviceRevision.current!==revision){notify(tr('Undo the later service changes first.'),'info');return;}void act(()=>window.studio.serviceTools('undo'),tr('Item restored.'));});});};
 const dropIntoService=(event:React.DragEvent)=>{
  event.preventDefault();if(busy)return;if(extrasSettings.operatorV2.mode==='present'){notify(tr('Switch to Prepare mode to edit.'),'info');return;}const files=Array.from(event.dataTransfer.files);
  if(files.length){void act(async()=>{const result=await window.studio.dropFiles(files);notify(result.message);if(result.warning)notify(result.warning,'info');});return;}
  const song=event.dataTransfer.getData('application/studio-song');if(song){void act(()=>window.studio.addSong(song),'Song added to service.');return;}
  for(const [format,action] of [['application/studio-asset','asset-add'],['application/studio-document','document-add']]){const id=event.dataTransfer.getData(format);if(id){void act(()=>window.studio.mediaTools(action,{id}),'Item added to service.');return;}}
 };
 const openItemOptions=(item:Item)=>{setItemOptions(item);void window.studio.themes('initial',{}).then(result=>setThemeOptions(result.config.themes)).catch(e=>notify(String(e),'error'));setModal('item-options');};
 const updateUI=async(patch:Partial<V2Preferences>)=>{const next={...extrasSettings,operatorV2:{...extrasSettings.operatorV2,...patch}};setExtrasSettings(next);const value=await window.studio.extras('save',next);setExtrasSettings(value.settings);return value;};
 const runOutput=(action:string,payload:unknown={})=>act(async()=>{const result=await window.studio.outputs(action,payload);const next=await window.studio.outputs('list');setOutputs(next);return result;});
 const command=async(id:string,payload:any={})=>{
  const present=extrasSettings.operatorV2.mode==='present';const edits=new Set(['new-service','open-service','recent','service-name','rename-service','new-song','new-note','new-slides','add-bible','import-songs','import-bible','import-powerpoint','import-images','import-video','database','undo','redo','recover','template-open','template-sunday','template-save','quick-edit']);
  if(present&&edits.has(id)){notify(tr('Switch to Prepare mode to edit.'),'info');return null;}
  const loadService=async(action:string,value:unknown={})=>{const result=await runService(action,value);if(typeof result!=='string'||!result.toLowerCase().includes('canceled')){await updateUI({mode:'prepare'});setSelected(null);}return result;};
  if(id==='noop')return;
  if(id==='new-service')return loadService('new');if(id==='open-service')return loadService('open');if(['recent','template-open','template-sunday','recover'].includes(id))return loadService(id,payload);
  if(id==='save-service'||id==='save-as')return runService('save');if(id==='package')return runService('package');if(['undo','redo','usage-export'].includes(id))return runService(id);
  if(id==='service-name')return runService('name',payload);if(id==='rename-service'){document.getElementById('ws-service-title')?.focus();(document.getElementById('ws-service-title') as HTMLInputElement)?.select();return;}
  if(id==='new-song')return showSong();if(id==='new-note'||id==='new-slides'){setTitle('');setLyrics('');setModal(id==='new-note'?'note':'slide');return;}
  if(id==='import-songs'){setModal('import');return;}if(id==='export-songs')return transfer('export-songs');if(id==='import-bible'){setModal('bible-import');return;}
  if(id==='import-powerpoint')return act(()=>window.studio.importMedia('powerpoint'));if(id==='import-images'||id==='import-video')return act(()=>window.studio.mediaTools('import',{kind:id==='import-images'?'image':'video'}));
  if(id==='add-bible'||id==='translation-settings'){if(typeof payload.reference==='string')setQueries(value=>({...value,Bible:payload.reference}));setModal(id==='add-bible'?'quick-bible':'bible-settings');return;}
  if(id==='text-styles'){setTextStyleKind(typeof payload.kind==='string'?payload.kind:'song');setModal('text-styles');return;}
  if(id==='service-tools'){setModal('service-plan');return;}if(id==='preflight'){const result=await runService('preflight') as {issues:{kind:string;message:string}[]}|null;if(result){setPreflightIssues(result.issues);setModal('preflight');}return;}
  if(id==='prepare'||id==='present')return updateUI({mode:id});if(id==='toggle-quick')return updateUI({showQuickSend:!extrasSettings.operatorV2.showQuickSend});if(id==='reset-panes')return updateUI({layout:v2LayoutDefaults()});
  if(id==='simple'||id==='full')return saveAccess({...extrasSettings,accessibility:{...extrasSettings.accessibility,mode:id}});if(id==='theme')return saveAccess({...extrasSettings,accessibility:{...extrasSettings.accessibility,theme:payload.theme}});if(id==='scale')return saveAccess({...extrasSettings,accessibility:{...extrasSettings.accessibility,scale:payload.scale}});
  if(id==='arm-output'){const choice=String(payload),external=choice.startsWith('audience:');return runOutput('arm',external?{role:'audience',displayId:Number(choice.split(':')[1])}:{role:'rehearsal'});}if(id==='disarm-output'){for(const slot of outputs?.outputs||[])if(slot.armed||slot.enabled)await runOutput('disarm',{role:slot.role});return;}
  if(id==='arm-disarm'){if(liveView.kind!=='off')return command('disarm-output');setModal('outputs');return;}if(id==='lock-output')return runOutput('lock',{locked:!outputs?.locked});
  if(id==='outputs'||id==='stage'||id==='patterns'){setOutputSection(id==='stage'?'stage':id==='patterns'?'safety':'displays');setModal('outputs');return;}
  if(id==='go-live')return act(()=>window.studio.takeLive(),tr(presentation.freeze?'Prepared for when output is unfrozen.':'Preview sent live.'));if(id==='freeze')return act(()=>window.studio.freeze());if(id==='emergency-blackout')return act(()=>window.studio.blackout());if(id.startsWith('toggle-'))return toggle(id.slice(7) as 'blackout'|'clear'|'logo');
  if(id==='quick-edit'){setModal('quick');return;}if(id==='shortcuts'){setModal('help');return;}if(id==='welcome'){setOnboarding(true);return;}if(id==='diagnostics'){setModal('reliability');return;}if(id==='backup-settings')return act(()=>window.studio.extras('backup'));if(id==='copy-path'){await window.studio.copyWorkspacePath();notify(tr('Workspace path copied.'));return;}if(id==='exit'){window.close();return;}setModal(id);
 };
 const controller:DeskController={songs,items,state:presentation,shownSlide,view:liveView,outputs,settings:extrasSettings,service:serviceStatus,info,tab,query,selected,busy,pendingDeletes,pendingDocuments,searchRef,setTab,setQuery:value=>setQueries({...queries,[tab]:value}),setModal,command,updateUI,saveSettings:saveAccess,refresh,notify,act,onSelect:i=>{setSelected(i.id);void previewSlide(i,0);},onPreview:(i,n,live)=>void previewSlide(i,n,live),onNavigate:navigate,onMove:move,onReorder:ids=>{if(extrasSettings.operatorV2.mode==='prepare')void act(()=>window.studio.reorder(ids));},onOptions:(i,field)=>{if(extrasSettings.operatorV2.mode==='present')return;setItemField(field==='notes'?'notes':field==='colorTag'?'colorTag':'title');openItemOptions(i);},onDuplicate:i=>{if(extrasSettings.operatorV2.mode==='prepare')void act(()=>window.studio.duplicateItem(i.id));},onRemove:i=>{if(extrasSettings.operatorV2.mode==='prepare')removeWithUndo(i);},onDeleteSong:deleteSongWithUndo,onDeleteDocument:deleteDocumentWithUndo,onEditSong:song=>void showSong(song),onDrop:dropIntoService};
 const overlays=<>
 <DeskTooltip language={extrasSettings.language}/>
 <Toasts notices={notices} dismiss={id=>setNotices(v=>v.filter(n=>n.id!==id))}/>
 {modal==='song'&&<SongEditor song={songs.find(s=>s.id===editing)||null} songs={songs} workspaceLanguage={extrasSettings.language} onClose={closeSong} onOpenExisting={song=>{closeSong();void showSong(song);}} busy={busy} onSave={(input,add)=>act(async()=>{const id=editing||await window.studio.createSong(input);if(editing)await window.studio.updateSong(editing,input);if(add)await window.studio.addSong(id,input.linesPerSlide||Number(localStorage.getItem('studio-max-lines')||4));closeSong();},'Song saved.')}/>}
 {modal==='quick'&&<SongEditor quick song={(()=>{const i=items.find(i=>i.id===presentation.live?.itemId);return i?.songSnapshot?{...i.songSnapshot,id:i.sourceId||i.id,usageCount:0,lastUsed:null}:null;})()} onClose={()=>setModal(null)} busy={busy} onSave={input=>act(async()=>{if(presentation.live?.itemId)await window.studio.quickEdit(presentation.live.itemId,input,Number(localStorage.getItem('studio-max-lines')||4));setModal(null);},'QuickEdit applied to live output.')}/>}
 {modal==='database'&&<DatabaseManager songs={songs.filter(s=>!pendingDeletes.has(s.id))} onClose={()=>setModal(null)} run={runSongTools}/>}
 {modal==='import'&&<SongImport onClose={()=>setModal(null)} onError={message=>notify(message,'error')} onComplete={(token,indices)=>act(async()=>{const result=await window.studio.songImportCommit(token,indices);setModal(null);return result;})}/>}
 {(modal==='note'||modal==='slide')&&<Modal title={modal==='note'?'Create note':'Create text slides'} onClose={()=>setModal(null)}><label>{tr("Title")}<input data-help-id="main.undefined" autoFocus value={title} onChange={e=>setTitle(e.target.value)}/></label><label>{tr("Text")}<textarea data-help-id="main.undefined2" rows={10} value={lyrics} onChange={e=>setLyrics(e.target.value)}/></label><div className="dialog-actions"><button data-help-id="main.cancel" onClick={()=>setModal(null)}>{tr("Cancel")}</button><button data-help-id="main.addToService" className="primary" disabled={busy||!title.trim()||!lyrics.trim()} onClick={()=>void act(async()=>{const result=await window.studio.mediaTools('document-save',{title,kind:modal==='note'?'note':'slides',text:lyrics});await window.studio.mediaTools('document-add',{id:result.documentId});setModal(null);},'Text added to service.')}>{tr("Add to service")}</button></div></Modal>}
 {modal==='extras'&&<ExtrasSettings onClose={()=>setModal(null)} onChanged={setExtrasSettings}/>}
 {modal==='reliability'&&<ReliabilitySettings onClose={()=>setModal(null)}/>}
 {modal==='service-plan'&&serviceStatus&&<ServicePlanner readOnly={extrasSettings.operatorV2.mode==='present'} status={serviceStatus} onClose={()=>setModal(null)} run={runService}/>}
 {modal==='item-options'&&itemOptions&&<ItemOptions initialField={itemField} item={itemOptions} assets={assets} themes={themeOptions} onClose={()=>setModal(null)} run={runService}/>}
 {modal==='themes'&&simple&&<SimpleThemes language={extrasSettings.language} slide={presentation.preview} onClose={()=>setModal(null)} onMore={()=>setModal('themes-advanced')} onApply={refresh}/>}
 {(modal==='themes-advanced'||modal==='themes'&&!simple)&&<ThemeEditor previewSlide={presentation.preview} onClose={()=>setModal(null)} onApply={async(theme,scope)=>{const result=await window.studio.themes('apply',{themeId:theme.id,scope});if(result.warning)notify(result.warning,'info');await refresh();}}/>}
 {modal==='outputs'&&outputs&&<OutputSettings initialSection={outputSection} simple={simple} language={extrasSettings.language} status={outputs} state={presentation} onClose={()=>setModal(null)} run={(action,payload)=>act(async()=>{const result=await window.studio.outputs(action,payload);const next=await window.studio.outputs('list',{});setOutputs(next);return result;})}/>}
 {modal==='accessibility'&&<AccessibilitySettings settings={extrasSettings} onClose={()=>setModal(null)} onSave={saveAccess} onReset={()=>void command('reset-panes')}/>}
 {modal==='settings'&&<SettingsV2 c={controller} onClose={()=>setModal(null)}/>}
 {modal==='text-styles'&&<TextStyles initialKind={textStyleKind} onClose={()=>setModal(null)} onApply={refresh}/>}
 {modal==='help'&&<Modal title={tr("Help and shortcuts")} onClose={()=>setModal(null)}><p className="hint">{tr("Prepare in the library, select a slide, then send it live. Typing in an editor never triggers output shortcuts.")}</p><p>{tr('Song details text uses Title, Authors, Publisher, Copyright, Comments, Key and Tempo headers, a blank line, then the lyrics. Use Song database to export it.')}</p>{resolvedShortcuts(extrasSettings.clicker).map(([keys,action])=><div className="shortcut-row" key={action}><span>{tr(action)}</span><kbd>{keys}</kbd></div>)}</Modal>}
 {modal==='quick-bible'&&<BiblePanel quick query={queries.Bible||''} onQuery={q=>setQueries({...queries,Bible:q})} onClose={()=>setModal(null)} refresh={refresh} notify={notify}/>}
 {modal==='bible-settings'&&<BiblePanel settingsOnly query={queries.Bible||''} onQuery={q=>setQueries({...queries,Bible:q})} onClose={()=>setModal(null)} refresh={refresh} notify={notify}/>}
 {modal==='bible-import'&&<BibleImport onClose={()=>setModal(null)} onComplete={async()=>{await refresh();setModal(null);notify('Bible translation imported.');}} onError={message=>notify(message,'error')}/>}
 {modal==='activity'&&<Modal title={tr("Activity log")} onClose={()=>setModal(null)}>{log.length?log.map(n=><div className="log-row" key={n.id}><time>{n.time}</time>{n.text}</div>):<p className="hint">{tr("Actions and messages from this session will appear here.")}</p>}</Modal>}
 {onboarding&&<Tutorial onClose={()=>{setOnboarding(false);localStorage.setItem('studio-onboarded','1');}}/>}
 {modal==='about'&&<Modal title={tr('About')} onClose={()=>setModal(null)}><p>Worship Studio · {tr('Version')} {info.version}</p><p className="ws-path">{info.path}</p><button data-help-id="main.copyWorkspacePath" onClick={()=>void command('copy-path')}>{tr('Copy workspace path')}</button></Modal>}
 {modal==='preflight'&&<Modal title={tr('Pre-flight check')} onClose={()=>setModal(null)}>{preflightIssues.length?preflightIssues.map((issue,index)=><p key={index}>{issue.message}</p>):<p>{tr('No issues found.')}</p>}</Modal>}
 </>;
 return <><DeskV2 c={controller}/>{overlays}</>;
}
const outputWindow=new URLSearchParams(location.hash.slice(1)).has('output');
const reportRendererError=(event:{name:string;code:'renderer-error'})=>{if(window.studio)void window.studio.diagnostics('renderer-error',event).catch(()=>{});};
createRoot(document.getElementById('root')!).render(<ErrorBoundary name={outputWindow?'Output':'Operator workspace'} output={outputWindow} onError={reportRendererError}>{outputWindow?<Output/>:location.hash==='#ui-kitchen-sink'?<KitchenSink/>:<App/>}</ErrorBoundary>);
