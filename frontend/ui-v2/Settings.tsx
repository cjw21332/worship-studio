import {useState} from 'react';
import {Modal} from '../ui';
import {AccessibilitySettings} from '../AccessibilitySettings';
import {ExtrasSettings} from '../ExtrasSettings';
import {ReliabilitySettings} from '../ReliabilitySettings';
import {Button} from './primitives';
import {useText} from './text';
import type {DeskController} from './types';
import './dialogs.css';

const sections=['Appearance and Accessibility','Language','Workspace and Backup','Outputs','Remote and Clicker','Diagnostics and Updates'];
export function Settings({c,onClose}:{c:DeskController;onClose:()=>void}){
 const tr=useText(),[section,setSection]=useState(0),[more,setMore]=useState(c.settings.accessibility.mode==='full'),[songLines,setSongLines]=useState(localStorage.getItem('studio-max-lines')||'4');
 const saveLanguage=(language:'en'|'fil')=>void c.saveSettings({...c.settings,language});
 return <Modal title={tr('Settings')} onClose={onClose} wide><div className="ws-settings">
  <nav className="ws-section-nav" aria-label={tr('Settings sections')}>
   {sections.map((label,index)=>(index<4||more)&&<button data-help-id="settings.undefined" type="button" key={label} aria-current={section===index?'page':undefined} onClick={()=>setSection(index)}>{tr(label)}</button>)}
   {!more&&<button data-help-id="settings.more" type="button" onClick={()=>setMore(true)}>{tr('More')}</button>}
  </nav>
  <section className="ws-settings-content" aria-label={tr(sections[section])}>
   <h3>{tr(sections[section])}</h3>
   {section===0&&<><Button help="settings.textStylesByContentType" onClick={()=>void c.command('text-styles')}>{tr('Text styles by content type')}</Button><AccessibilitySettings embedded settings={c.settings} onClose={onClose} onSave={c.saveSettings} onReset={()=>void c.command('reset-panes')}/></>}
   {section===1&&<label>{tr('Language')}<select data-help-id="settings.language" aria-label={tr('Language')} value={c.settings.language} onChange={e=>saveLanguage(e.target.value as 'en'|'fil')}><option data-help-id="settings.english" value="en">English</option><option data-help-id="settings.filipino" value="fil">Filipino</option></select></label>}
   {section===2&&<div className="stack"><label>{tr('Workspace')}<p className="ws-path" title={c.info.path}>{c.info.path}</p></label><label>{tr('Default song lines per slide')}<select data-help-id="settings.undefined2" value={songLines} onChange={e=>{setSongLines(e.target.value);localStorage.setItem('studio-max-lines',e.target.value);}}>{[2,3,4,6].map(n=><option data-help-id="settings.undefined3" key={n} value={n}>{n}</option>)}</select></label><Button help="settings.copyWorkspacePath" onClick={()=>void c.command('copy-path')}>{tr('Copy workspace path')}</Button><Button help="settings.chooseWorkspaceFolder" onClick={()=>void c.act(()=>window.studio.chooseWorkspace())}>{tr('Choose workspace folder')}</Button><Button help="settings.welcomeGuide" onClick={()=>void c.command('welcome')}>{tr('Welcome guide')}</Button><Button help="settings.backUpSettings" onClick={()=>void c.command('backup-settings')}>{tr('Back up settings')}</Button><Button help="settings.restoreSettingsBackup" onClick={()=>void c.act(async()=>{const value=await window.studio.extras('restore');if(value.settings)await c.saveSettings(value.settings);})}>{tr('Restore settings backup')}</Button><Button help="settings.resetSettings" onClick={()=>void c.act(async()=>{const value=await window.studio.extras('reset');if(value.settings)await c.saveSettings(value.settings);})}>{tr('Reset settings')}</Button><Button help="settings.resetPaneSizes" onClick={()=>void c.command('reset-panes')}>{tr('Reset pane sizes')}</Button><p className="hint">{tr('Restoring settings never arms an output.')}</p></div>}
   {section===3&&<Button help="settings.outputsAndDisplays" onClick={()=>void c.command('outputs')}>{tr('Outputs and displays…')}</Button>}
   {section===4&&<ExtrasSettings embedded onClose={onClose} onChanged={settings=>void c.saveSettings(settings)}/>}
   {section===5&&<ReliabilitySettings embedded onClose={onClose}/>}
  </section>
 </div></Modal>;
}
