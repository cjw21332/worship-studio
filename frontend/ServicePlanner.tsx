import {useDeskTranslate} from './i18n';
import {useState,useEffect} from 'react';
import type {Item} from '../backend/database';
import {Modal,Select} from './ui';

export type ServiceStatus={
  name:string;
  filePath:string|null;
  dirty:boolean;
  locallySaved:boolean;
  recovered:boolean;
  recoveryAvailable:boolean;
  recoveryAvailableCount:number;
  recent:{id:string;name:string;openedAt:string}[];
  templates:{id:string;name:string}[];
  canUndo:boolean;
  canRedo:boolean;
  items:{id:string;title:string;duration:number;autoAdvance:boolean;loop:boolean;colorTag:string;themeId:string;backgroundId:string}[];
};

export function ServicePlanner({status,onClose,run,readOnly=false}:{
  status:ServiceStatus;
  readOnly?:boolean;
  onClose:()=>void;
  run:(action:string,payload?:unknown)=>Promise<any>
}) {
  const tr=useDeskTranslate();

  const [name,setName]=useState(status.name),[template,setTemplate]=useState(''),[issues,setIssues]=useState<{kind:string;message:string}[]|null>(null);

  return (
    <Modal title={tr("Service tools")} wide onClose={onClose}>
      <div>
        <label>{tr("Service name")}<input data-help-id="servicePlanner.switchToPrepareModeToEdit" disabled={readOnly} title={readOnly?tr("Switch to Prepare mode to edit."):undefined} value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></label>
        <div className="row wrap">
          <button data-help-id="servicePlanner.switchToPrepareModeToEdit2" disabled={readOnly} title={readOnly?tr('Switch to Prepare mode to edit.'):undefined} onClick={()=>void run('name',{name})}>{tr("Save service name")}</button>
          <button data-help-id="servicePlanner.saveServiceFile" onClick={()=>void run('save',{})}>{tr("Save service file")}</button>
          <button data-help-id="servicePlanner.packageWithMedia" onClick={()=>void run('package',{})}>{tr("Package with media")}</button>
          <button data-help-id="servicePlanner.switchToPrepareModeToEdit3" disabled={readOnly} title={readOnly?tr('Switch to Prepare mode to edit.'):undefined} onClick={()=>void run('open',{})}>{tr("Open service or package")}</button>
        </div>
        <p className="hint">{tr("Service edits save locally immediately. A recovery snapshot saves every 30 seconds. A package includes referenced media for another computer.")}</p>
        <div className="row wrap">
          <button data-help-id="servicePlanner.undo" disabled={readOnly||!status.canUndo} onClick={()=>void run('undo',{})}>{tr("Undo")}</button>
          <button data-help-id="servicePlanner.redo" disabled={readOnly||!status.canRedo} onClick={()=>void run('redo',{})}>{tr("Redo")}</button>
          <button data-help-id="servicePlanner.runPreFlightCheck" onClick={()=>void run('preflight',{}).then(result=>{if(result)setIssues(result.issues);})}>{tr("Run pre-flight check")}</button>
          <button data-help-id="servicePlanner.exportUsageCSV" onClick={()=>void run('usage-export',{})}>{tr("Export usage CSV")}</button>
          <button data-help-id="servicePlanner.restoreRecoverySnapshot" disabled={readOnly||!status.recoveryAvailable} onClick={()=>void run('recover',{})}>{tr("Restore recovery snapshot")}</button>
        </div>
      </div>

      {status.items && status.items.length > 0 && (
        <div className="row wrap" style={{marginTop:'24px'}}>
          <h3>{tr("Service items")}</h3>
          <div className="ws-list-row">
            {status.items.map(item=>(
              <div key={item.id} className="ws-list-row" style={{display:'flex','align-items':'center',gap:'16px'}}>
                <span style={{flex:'1',overflow:'hidden','text-overflow':'ellipsis',whiteSpace:'nowrap'}}>{item.title}</span>
                <span style={{width:'80px',fontFamily:'monospace'}}>
                  {item.duration} {tr("s")}
                </span>
                <span>
                  {item.autoAdvance?tr("Auto"):tr("Manual")}
                </span>
                <span>
                  {item.loop?tr("Loop"):tr("One shot")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {status.templates && status.templates.length > 0 && (
        <div className="row wrap" style={{marginTop:'24px'}}>
          <h3>{tr("Templates")}</h3>
          <Select help="servicePlanner.templateSelect" optionHelp="common.selectOption" label={tr("Load template")} value={template} onChange={value=>setTemplate(value)} options={status.templates.map(t=>({value:t.id,label:t.name}))}/>
        </div>
      )}

      {issues && issues.length > 0 && (
        <div className="row wrap" style={{marginTop:'16px'}}>
          <h4>{tr("Pre-flight issues found")}</h4>
          <ul>
            {issues.map(issue=><li key={issue.kind}>{issue.message}</li>)}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export function ItemOptions({item,assets,themes,onClose,run,initialField='title'}:{
  item:Item;
  assets:{id:string;title:string}[];
  themes:{id:string;name:string}[];
  onClose:()=>void;
  run:(action:string,payload?:unknown)=>Promise<any>;
  initialField?:'title'|'notes'|'colorTag'
}) {
  const tr=useDeskTranslate();

  useEffect(()=>{requestAnimationFrame(()=>document.querySelector<HTMLElement>('dialog[open] [data-field="'+initialField+'"]')?.focus());},[initialField]);
  const [title,setTitle]=useState(item.title),[notes,setNotes]=useState(item.notes||''),[color,setColor]=useState(String(item.colorTag||'#246b67')),[duration,setDuration]=useState(Number(item.duration||0)),[auto,setAuto]=useState(!!item.autoAdvance),[loop,setLoop]=useState(!!item.loop),[themeId,setTheme]=useState(String(item.themeId||'')),[backgroundId,setBackground]=useState(String(item.backgroundId||''));

  return <Modal title={tr("Service item options")} onClose={onClose}><label>{tr("Title")}<input data-help-id="servicePlanner.itemTitle" data-field="title" value={title} maxLength={200} onChange={e=>setTitle(e.target.value)}/></label><label>{tr("Service and stage notes")}<textarea data-help-id="servicePlanner.serviceAndStageNotes" data-field="notes" aria-label={tr("Service and stage notes")} value={notes} rows={4} onChange={e=>setNotes(e.target.value)}/></label><div className="fields"><label>{tr("Color tag")}<input data-help-id="servicePlanner.colorTag" data-field="colorTag" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><label>{tr("Estimated duration (seconds)")}<input data-help-id="servicePlanner.estimatedDuration" type="number" min={0} max={86400} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label></div><label className="row"><input data-help-id="servicePlanner.autoAdvance" type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>{tr("Auto-advance slides (uses each slide's duration)")}</label><label className="row"><input data-help-id="servicePlanner.loop" type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/>{tr("Loop back to the first slide")}</label><label>{tr("Theme override")}<Select help="servicePlanner.itemThemeSelect" optionHelp="common.selectOption" label={tr("Item theme")} value={themeId} onChange={setTheme} options={[{value:'',label:'Use service or content-type theme'},...themes.map(t=>({value:t.id,label:t.name}))]}/></label><label>{tr("Background override")}<Select help="servicePlanner.itemBackgroundSelect" optionHelp="common.selectOption" label={tr("Item background")} value={backgroundId} onChange={setBackground} options={[{value:'',label:'Use existing background'},...assets.map(a=>({value:a.id,label:a.title}))]}/></label><p className="hint">{tr("These changes affect the service copy. Send a slide live when you are ready to publish the changes.")}</p><div className="dialog-actions"><button data-help-id="servicePlanner.ok" className="primary" onClick={()=>void run('ok',{})}>{tr("OK")}</button><button data-help-id="servicePlanner.cancel" onClick={()=>void run('cancel',{})}>{tr("Cancel")}</button></div></Modal>;
}