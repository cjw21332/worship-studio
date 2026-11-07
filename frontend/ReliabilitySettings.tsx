import {useDeskTranslate} from './i18n';
import {useEffect,useState} from 'react';
import {Modal,Select} from './ui';
import type {UpdateStatus} from '../backend/update';
import type {DiagnosticSnapshot} from '../backend/diagnostics';

export function ReliabilitySettings({onClose,embedded=false}:{onClose:()=>void;embedded?:boolean}){
 const tr=useDeskTranslate();

 const [report,setReport]=useState<DiagnosticSnapshot|null>(null),[updates,setUpdates]=useState<UpdateStatus|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [enabled,setEnabled]=useState(false),[channel,setChannel]=useState<'stable'|'beta'>('stable'),[feedUrl,setFeedUrl]=useState('');
 useEffect(()=>{let active=true;void Promise.all([window.studio.diagnostics('report'),window.studio.updates('status')]).then(([report,status])=>{if(!active)return;setReport(report);setUpdates(status);setEnabled(status.settings.enabled);setChannel(status.settings.channel);setFeedUrl(status.settings.feedUrl);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;};},[]);
 useEffect(()=>{if(!updates||!['checking','downloading'].includes(updates.state))return;const timer=setInterval(()=>{void window.studio.updates('status').then(setUpdates).catch(()=>{});},1000);return()=>clearInterval(timer);},[updates?.state]);
 const run=async(action:()=>Promise<unknown>)=>{setBusy(true);setError('');setMessage('');try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const diagnostic=(action:'copy'|'export')=>run(async()=>{const result=await window.studio.diagnostics(action);setMessage(result.canceled?'Export canceled.':result.message);});
 const update=(action:'configure'|'check'|'download'|'install')=>run(async()=>{const result=await window.studio.updates(action,action==='configure'?{enabled,channel,feedUrl}:action==='install'?{confirmed:true}:{});setUpdates(result);});
 const content=<>
  {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
  <h3>{tr("Diagnostic information")}</h3><p className="hint">{tr("Share app versions, content counts, output status and performance readings to help diagnose a problem. Lyrics, verse text, file paths and credentials are excluded.")}</p>
  {report&&<p className="hint">{tr("Worship Studio")}{' '}{report.runtime.appVersion} · {report.counters.songCount??0}{' '}{tr("songs ·")}{' '}{report.counters.itemCount??0}{' '}{tr("service items")}</p>}
  <div className="row"><button data-help-id="reliabilitySettings.copyDiagnosticInfo" disabled={busy} onClick={()=>void diagnostic('copy')}>{tr("Copy diagnostic info")}</button><button data-help-id="reliabilitySettings.exportDiagnosticFile" disabled={busy} onClick={()=>void diagnostic('export')}>{tr("Export diagnostic file")}</button></div>
  <h3>{tr("App updates")}</h3><p className="hint">{tr("Checks and downloads run only when requested. Enter the HTTPS feed supplied by your release publisher. Install updates after the service has finished.")}</p>
  <label className="row"><input data-help-id="reliabilitySettings.undefined" type="checkbox" checked={enabled} disabled={busy} onChange={e=>setEnabled(e.target.checked)}/>{tr("Enable update checks")}</label>
  <Select help="reliabilitySettings.updateChannelSelect" optionHelp="common.selectOption" label={tr("Update channel")} value={channel} onChange={value=>setChannel(value as 'stable'|'beta')} options={[{value:'stable',label:'Stable'},{value:'beta',label:'Beta'}]}/>
  <label>{tr("Update feed URL")}<input data-help-id="reliabilitySettings.undefined2" type="url" value={feedUrl} disabled={busy} placeholder={tr("https://releases.example.org/worship-studio/")} onChange={e=>setFeedUrl(e.target.value)}/></label>
  <div className="row"><button data-help-id="reliabilitySettings.saveUpdateSettings" disabled={busy} onClick={()=>void update('configure')}>{tr("Save update settings")}</button><button data-help-id="reliabilitySettings.checkForUpdates" disabled={busy||!updates?.settings.enabled||!updates.settings.feedUrl} onClick={()=>void update('check')}>{tr("Check for updates")}</button></div>
  {updates&&<p role="status">{updates.message}{updates.state==='downloading'&&updates.progress!==undefined?' '+Math.round(updates.progress)+'%':''}</p>}
  {updates?.state==='available'&&<button data-help-id="reliabilitySettings.downloadVersion" disabled={busy} onClick={()=>void update('download')}>{tr("Download version")}{' '}{updates.version}</button>}
  {updates?.state==='downloaded'&&<button data-help-id="reliabilitySettings.installAndRestart" disabled={busy} onClick={()=>{if(window.confirm('Finish the service and restart Worship Studio to install the downloaded update?'))void update('install');}}>{tr("Install and restart")}</button>}
 </>;return embedded?content:<Modal title={tr("Diagnostics and updates")} onClose={onClose}>{content}</Modal>;
}
