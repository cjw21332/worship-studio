import{useEffect,useState}from'react';
import{Modal,Select}from'./ui';
import{defaultSettings,normalizeClickerKey,isClickerKey,type StudioSettings,type ClickerAction}from'../backend/settings-model';
import{t,applyWorkspaceLanguage,applyTouchMode,type MessageKey}from'./i18n';
type RemoteStatus={enabled:boolean;pin:string;pinExpires:number;urls:string[];port:number;paired:number};
type ExtrasState={settings:StudioSettings;remote:RemoteStatus;warning?:string;message?:string;canceled?:boolean};
const initialRemote:RemoteStatus={enabled:false,pin:'',pinExpires:0,urls:[],port:0,paired:0};
const actions:ClickerAction[]=['next','previous','blackout','logo','live'];
export function ExtrasSettings({onClose,onChanged,embedded=false}:{embedded?:boolean;onClose:()=>void;onChanged?:(settings:StudioSettings)=>void}){
 const[settings,setSettings]=useState(defaultSettings),[remote,setRemote]=useState(initialRemote),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[url,setUrl]=useState(''),[qr,setQr]=useState(''),[learn,setLearn]=useState<ClickerAction|null>(null),[action,setAction]=useState<ClickerAction>('next');
 const text=(key:MessageKey)=>t(settings.language,key);
 const call=async(action:string,payload:unknown={}):Promise<ExtrasState|undefined>=>{
  setBusy(true);setError('');setMessage('');
  try{
   const result=await window.studio.extras(action,payload) as ExtrasState;
   if(result.settings&&['save','restore','reset'].includes(action)){setSettings(result.settings);applyWorkspaceLanguage(result.settings.language);applyTouchMode(result.settings.touchMode);onChanged?.(result.settings);}
   if(result.remote)setRemote(result.remote);
   setMessage(result.message||result.warning||(action==='save'?text('saved'):result.canceled?text('cancel'):''));
   return result;
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 useEffect(()=>{
  let active=true;
  void window.studio.extras('initial',{}).then((value:ExtrasState)=>{if(active){setSettings(value.settings);setRemote(value.remote);setMessage(value.warning||'');}}).catch((e:unknown)=>{if(active)setError(String(e));});
  const timer=setInterval(()=>{void window.studio.extras('initial',{}).then((value:ExtrasState)=>{if(active)setRemote(value.remote);}).catch(()=>{});},2000);
  return()=>{active=false;clearInterval(timer);};
 },[]);
 useEffect(()=>{if(!remote.enabled){setUrl('');setQr('');return;}if(!remote.urls.includes(url))setUrl(remote.urls.find(u=>!u.includes('127.0.0.1'))||remote.urls[0]||'');},[remote.enabled,remote.urls.join('|'),url]);
 useEffect(()=>{
  let active=true;setQr('');if(url&&remote.enabled)void window.studio.extras('remote-qr',{url}).then((value:{image:string})=>{if(active)setQr(value.image);}).catch((e:unknown)=>{if(active)setError(String(e));});
  return()=>{active=false;};
 },[url,remote.enabled]);
 useEffect(()=>{
  if(!learn)return;
  const capture=(event:KeyboardEvent)=>{
   event.preventDefault();event.stopImmediatePropagation();
   if(event.key==='Escape'){setLearn(null);return;}
   const key=normalizeClickerKey(event.key);
   if(event.ctrlKey||event.altKey||event.metaKey||!isClickerKey(key)){setError('Choose a presenter key without Ctrl, Alt or the Windows key. Tab, Enter and Escape stay available for navigation.');return;}
   setSettings(s=>({...s,clicker:{...s.clicker,mappings:{...s.clicker.mappings,[key]:learn}}}));setLearn(null);setError('');setMessage((key===' '?'Space':key.toUpperCase())+' Ã¢â€ â€™ '+text(learn));
  };
  window.addEventListener('keydown',capture,true);return()=>window.removeEventListener('keydown',capture,true);
 },[learn,settings.language]);
 const content=<><style>{'.extras-section{padding:18px 0;border-top:1px solid var(--line)}.extras-section:first-of-type{border-top:0}.extras-remote{display:grid;grid-template-columns:minmax(240px,1fr) 250px;gap:20px}.extras-qr{width:240px;height:240px;background:white;border-radius:7px}.pairing-pin{font-size:32px;letter-spacing:5px;font-weight:700;font-variant-numeric:tabular-nums}.clicker-map{display:grid;grid-template-columns:100px 1fr 100px;align-items:center;gap:10px;padding:6px 0}.learn-key{padding:14px;border:2px solid var(--accent);background:var(--accent-soft)}:root[data-touch=true] button{min-height:52px}:root[data-touch=true] .icon-button{min-width:52px;width:52px}:root[data-touch=true] input,:root[data-touch=true] textarea{min-height:48px;font-size:16px}:root[data-touch=true] .toolbar{flex-wrap:wrap}:root[data-touch=true] .app-header{min-height:82px} @media(max-width:850px){.extras-remote{grid-template-columns:1fr}}'}</style>
 {error&&<p role="alert" className="banner">{error}</p>}{message&&<p role="status" className="hint">{message}</p>}
 <section className="extras-section"><div className="fields"><label>{text('language')}<Select help="extrasSettings.languageSelect" optionHelp="common.selectOption" label={text('language')} value={settings.language} options={[{value:'en',label:'English'},{value:'fil',label:'Filipino'}]} onChange={value=>setSettings({...settings,language:value as 'en'|'fil'})}/></label><label className="row"><input data-help-id="extrasSettings.undefined" type="checkbox" checked={settings.touchMode} onChange={e=>setSettings({...settings,touchMode:e.target.checked})}/>{text('touchMode')}</label></div></section>
 <section className="extras-section"><h3>{text('phoneRemote')}</h3><p className="hint">{text('remoteHint')}</p><p className="hint">{text('remoteWarning')}</p><div className="row wrap"><button data-help-id="extrasSettings.undefined2" disabled={busy} className={remote.enabled?'danger':'primary'} onClick={()=>void call(remote.enabled?'remote-stop':'remote-start')}>{text(remote.enabled?'disableRemote':'enableRemote')}</button><span className="badge">{text('paired')}: {remote.paired}</span>{remote.enabled&&<button data-help-id="extrasSettings.undefined3" disabled={busy} onClick={()=>void call('remote-rotate')}>{text('newPin')}</button>}</div>
 {remote.enabled&&<div className="extras-remote"><div className="stack"><div><strong>{text('pairPin')}</strong><div className="pairing-pin">{remote.pin}</div><small>{text('expires')}: {new Date(remote.pinExpires).toLocaleTimeString()}</small></div><label>{text('localUrl')}<Select help="extrasSettings.localUrlSelect" optionHelp="common.selectOption" label={text('localUrl')} value={url} options={remote.urls.map(value=>({value,label:value}))} onChange={setUrl}/></label><p>{url||text('noNetwork')}</p><p className="hint">{text('scanQr')}</p></div>{qr&&<img className="extras-qr" src={qr} alt={text('scanQr')}/>}</div>}
 </section>
 <section className="extras-section"><h3>{text('clicker')}</h3><label className="row"><input data-help-id="extrasSettings.undefined4" type="checkbox" checked={settings.clicker.enabled} onChange={e=>setSettings({...settings,clicker:{...settings.clicker,enabled:e.target.checked}})}/>{text('clickerEnabled')}</label>{Object.entries(settings.clicker.mappings).map(([key,value])=><div className="clicker-map" key={key}><kbd>{key===' '?'Space':key.toUpperCase()}</kbd><Select help="extrasSettings.actionSelect" optionHelp="common.selectOption" label={text('action')+' '+key} value={value} options={actions.map(value=>({value,label:text(value)}))} onChange={value=>setSettings({...settings,clicker:{...settings.clicker,mappings:{...settings.clicker.mappings,[key]:value as ClickerAction}}})}/><button data-help-id="extrasSettings.undefined5" onClick={()=>{const mappings={...settings.clicker.mappings};delete mappings[key];setSettings({...settings,clicker:{...settings.clicker,mappings}});}}>{text('remove')}</button></div>)}<div className="row"><Select help="extrasSettings.actionSelect" optionHelp="common.selectOption" label={text('action')} value={action} options={actions.map(value=>({value,label:text(value)}))} onChange={value=>setAction(value as ClickerAction)}/><button data-help-id="extrasSettings.undefined6" disabled={busy||!!learn} onClick={()=>{setError('');setLearn(action);}}>{text('learnKey')}</button></div>{learn&&<p className="learn-key" role="status">{text('pressKey')}</p>}</section>
 <section className="extras-section"><h3>{text('capture')}</h3><p className="hint">{text('captureHint')}</p><div className="fields"><label>{text('captureMode')}<Select help="extrasSettings.captureModeSelect" optionHelp="common.selectOption" label={text('captureMode')} value={settings.capture.mode} options={(['normal','chroma','transparent'] as const).map(value=>({value,label:text(value)}))} onChange={value=>setSettings({...settings,capture:{...settings.capture,mode:value as StudioSettings['capture']['mode']}})}/></label><label>{text('chromaColor')}<input data-help-id="extrasSettings.undefined7" type="text" placeholder="#00ff00" pattern="#[0-9a-fA-F]{6}" maxLength={7} value={settings.capture.color} onChange={e=>setSettings({...settings,capture:{...settings.capture,color:e.target.value}})}/></label></div></section>
 <section className="extras-section"><div className="row wrap"><button data-help-id="extrasSettings.undefined8" disabled={busy} onClick={()=>void call('backup')}>{text('backup')}</button><button data-help-id="extrasSettings.undefined9" disabled={busy} onClick={()=>void call('restore')}>{text('restore')}</button><button data-help-id="extrasSettings.undefined10" disabled={busy} className="danger" onClick={()=>void call('reset')}>{text('reset')}</button></div></section>
 <div className="dialog-actions"><button data-help-id="extrasSettings.undefined11" onClick={onClose}>{text('close')}</button><button data-help-id="extrasSettings.undefined12" className="primary" disabled={busy||!!learn||!/^#[0-9a-fA-F]{6}$/.test(settings.capture.color)} onClick={()=>void call('save',settings)}>{text('save')}</button></div>
 </>;return embedded?content:<Modal title={text('extras')} onClose={onClose} wide>{content}</Modal>;
}

