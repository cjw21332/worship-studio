import {rove} from './ui-v2/keyboard';
import {useDeskTranslate} from './i18n';
import {useState,useRef} from 'react';
import type {Presentation,StageBox} from '../backend/presentation';
import {defaultStageLayout} from '../backend/presentation';
import type {DisplayInfo} from '../backend/preload';
import type {OutputRole} from '../backend/outputs';
import {deskT,type Language} from './i18n';
import {Modal,Select} from './ui';
export type OutputStatus={displays:DisplayInfo[];outputs:{role:OutputRole;displayId:number|null;armed:boolean;connected:boolean;enabled:boolean;suspended:boolean;split:'full'|'left'|'right';windowed:boolean}[];target:number|null;locked:boolean};
export function OutputSettings({status,state,onClose,run,simple=false,language='en',initialSection='displays'}:{status:OutputStatus;state:Presentation;onClose:()=>void;run:(action:string,payload:unknown)=>Promise<unknown>;simple?:boolean;language?:Language;initialSection?:string}){
 const tr=useDeskTranslate();const tabs=[['displays','Displays'],['audience','Audience'],['stage','Stage'],['rehearsal','Rehearsal and Confidence'],['safety','Safety']];const [section,setSection]=useState(initialSection);

 const [choices,setChoices]=useState<Record<string,string>>({}),[windowed,setWindowed]=useState<Record<string,boolean>>({}),[splits,setSplits]=useState<Record<string,string>>({}),[pattern,setPattern]=useState('grid');
 const [stage,setStage]=useState(structuredClone(state.stage)),[selected,setSelected]=useState('current');
 const drag=useRef<{id:string;x:number;y:number;box:StageBox;resize:boolean}|null>(null),canvas=useRef<HTMLDivElement>(null);
 const box=stage.layout.find(b=>b.id===selected);
 const update=(patch:Partial<StageBox>)=>setStage({...stage,layout:stage.layout.map(b=>b.id===selected?{...b,...patch}:b)});
 const move=(e:React.PointerEvent)=>{if(!drag.current||!canvas.current)return;const rect=canvas.current.getBoundingClientRect(),dx=(e.clientX-drag.current.x)/rect.width*100,dy=(e.clientY-drag.current.y)/rect.height*100,b=drag.current.box;setStage(s=>({...s,layout:s.layout.map(v=>v.id===b.id?drag.current!.resize?{...b,width:Math.max(8,Math.min(100-b.x,b.width+dx)),height:Math.max(8,Math.min(100-b.y,b.height+dy))}:{...b,x:Math.max(0,Math.min(100-b.width,b.x+dx)),y:Math.max(0,Math.min(100-b.height,b.y+dy))}:v)}));};
 return <Modal title={tr('Outputs and displays…')} wide onClose={onClose}><div className="ws-outputs">{<nav data-help-id="outputSettings.outputSections" className="ws-section-nav" role="tablist" aria-label={tr('Output sections')} aria-orientation="vertical" onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const next=rove(tabs.findIndex(t=>t[0]===section),e.key,tabs.length,true);setSection(tabs[next][0]);e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();}}}>{tabs.map(([id,label])=><button data-help-id="outputSettings.outputTab" key={id} type="button" id={'output-tab-'+id} role="tab" aria-selected={section===id} aria-controls="output-section" tabIndex={section===id?0:-1} onClick={()=>setSection(id)}>{tr(label)}</button>)}</nav>}<section data-help-id="outputSettings.outputSection" id="output-section" className="ws-output-content" role="tabpanel" aria-labelledby={'output-tab-'+section}>
 <h3 className="ws-output-heading">{tr(tabs.find(([id])=>id===section)?.[1]||'Displays')}</h3>
 <p className="ws-output-intro">{tr("Each output has its own window and receives the same live state. Arming or reconnecting starts black. Windowed previews can be tested on this computer.")}</p>
 {section==='displays'&&(
              <>
                <div className="output-display-grid">
                  {status.displays.map(d=>
                    <div key={d.id} className="output-display-card" style={{borderColor: d.primary ? 'var(--ws-accent)' : 'var(--ws-border)'}}>
                      <div className="ws-monitor-caption">
                        <strong>{d.label}</strong>
                        <span>{d.number}. {d.width} × {d.height}</span>
                      </div>
                      <div className="ws-monitor-slot" style={{aspectRatio: '16/9'}}>
                        {d.operator ? (
                          <span className="badge badge-live">{tr("Operator screen")}</span>
                        ) : (
                          <span className="badge badge-secondary">{tr("Preview")}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button className="output-identify-button" data-help-id="outputSettings.identifyScreens" onClick={()=>void run('identify',{})}>{tr('Identify screens')}</button>
              </>
            )}
            <div hidden={section!=='safety'} className="output-safety-controls">
              <button data-help-id="outputSettings.unlockOutputControls" aria-pressed={status.locked} onClick={()=>void run('lock',{locked:!status.locked})}>{status.locked?tr("Unlock output controls"):tr("Lock output controls")}</button>
              <button data-help-id="outputSettings.identifyScreens2" onClick={()=>void run('identify',{})}>{tr("Identify screens")}</button>
              <label className="output-control-field">
                <span>{tr("Test pattern")}</span>
                <Select help="outputSettings.testPatternSelect" optionHelp="common.selectOption" label={tr("Test pattern")} value={pattern} options={['grid','bars','resolution'].map(v=>({value:v,label:v==='bars'?'Color bars':v==='grid'?'Grid':'Resolution'}))} onChange={setPattern}/>
              </label>
            </div>
            {status.outputs.filter(slot=>section==='audience'&&slot.role.startsWith('audience')||section==='stage'&&slot.role==='stage'||section==='rehearsal'&&['rehearsal','confidence'].includes(slot.role)).map(slot=>{
             const chosen=choices[slot.role]??String(slot.displayId??'');
             const isWindowed=slot.role==='rehearsal'||(windowed[slot.role]??slot.windowed);
             const chosenDisplay=status.displays.find(d=>String(d.id)===chosen);
             const canArm=!!chosenDisplay&&(!chosenDisplay.operator||isWindowed);
             return <section className="output-setting-row" key={slot.role}>
              <div className="output-card-heading">
               <h4>{slot.role==='audience-secondary'?tr("Audience, second projector"):tr(slot.role[0].toUpperCase()+slot.role.slice(1))}</h4>
               <span className={`output-state${slot.armed?' is-armed':''}${slot.suspended?' is-disconnected':''}`}>{slot.armed?tr("Armed"):slot.suspended?tr("Display disconnected"):tr("Disarmed")}</span>
              </div>
              <div className="output-controls">
               <label className="output-control-field">
                <span>{tr("Display")}</span>
                <Select help="outputSettings.displaySelect" optionHelp="outputs.displayOption" label={slot.role+tr(" display")} value={chosen} onChange={value=>setChoices({...choices,[slot.role]:value})} options={status.displays.map(d=>({value:String(d.id),label:d.number+'. '+d.label,detail:d.width+' × '+d.height+(d.primary?' · Primary':'')+(d.operator?' · Operator':''),disabled:d.operator&&!isWindowed}))}/>
               </label>
               <label className="output-control-field">
                <span>{tr("Projection area")}</span>
                <Select help="outputSettings.projectionAreaSelect" optionHelp="common.selectOption" label={slot.role+tr(" projection area")} value={splits[slot.role]||slot.split} onChange={value=>setSplits({...splits,[slot.role]:value})} options={[{value:'full',label:'Full slide'},{value:'left',label:'Left half'},{value:'right',label:'Right half'}]}/>
               </label>
               {slot.role!=='rehearsal'&&<label className="output-windowed-toggle"><input data-help-id="outputSettings.undefined2" type="checkbox" checked={isWindowed} onChange={e=>setWindowed({...windowed,[slot.role]:e.target.checked})}/><span>{tr("Windowed preview")}</span></label>}
              </div>
              <div className="output-actions">
               <button className="primary" data-help-id="outputSettings.arm" disabled={!canArm} onClick={()=>void run('arm',{role:slot.role,displayId:Number(chosen),windowed:isWindowed,split:splits[slot.role]||slot.split})}>{tr("Arm")}{' '}{slot.role}</button>
               <button data-help-id="outputSettings.disarm" disabled={!slot.armed&&!slot.enabled} onClick={()=>void run('disarm',{role:slot.role})}>{tr("Disarm")}</button>
               <button data-help-id="outputSettings.showTestPattern" disabled={!chosenDisplay} onClick={()=>void run('pattern',{displayId:Number(chosen),kind:pattern})}>{tr("Show test pattern")}</button>
              </div>
              {chosen&&!chosenDisplay&&<p className="output-status-message" role="status">{tr("The saved display is disconnected. Choose a connected display.")}</p>}
              {chosenDisplay?.operator&&!isWindowed&&<p className="output-status-message" role="status">{tr("Choose another display or enable Windowed preview.")}</p>}
             </section>;
            })}
 <details className="stage-layout-disclosure" hidden={section!=='stage'} open={!simple}><summary data-help-id="outputSettings.undefined3"><span>{deskT(language,'Stage layout')}</span><span className="stage-layout-hint">{tr("Customize")}</span></summary><h3>{tr("Stage layout")}</h3><p className="hint">{tr("Drag a box to move it. Drag its lower-right handle to resize it. Changes reach the stage only after Apply.")}</p><div className="stage-editor" ref={canvas} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>{stage.layout.map(b=><div className={'stage-editor-box '+(selected===b.id?'selected':'')} key={b.id} style={{left:b.x+'%',top:b.y+'%',width:b.width+'%',height:b.height+'%'}} onPointerDown={e=>{e.preventDefault();setSelected(b.id);e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:b.id,x:e.clientX,y:e.clientY,box:{...b},resize:(e.target as HTMLElement).classList.contains('resize-handle')};}}><strong>{b.id}</strong><span>{b.fontSize}{tr("px")}</span><span className="resize-handle" aria-hidden="true">◢</span></div>)}</div>
 <div className="fields"><label>{tr("Layout box")}<Select help="outputSettings.layoutBoxSelect" optionHelp="common.selectOption" label={tr("Layout box")} value={selected} options={stage.layout.map(b=>({value:b.id,label:b.id}))} onChange={setSelected}/></label><label>{tr("Font size")}<input data-help-id="outputSettings.undefined4" type="number" min={14} max={160} value={box?.fontSize||32} onChange={e=>update({fontSize:Number(e.target.value)})}/></label>{(['x','y','width','height'] as const).map(key=><label key={key}>{key} (%)<input data-help-id="outputSettings.undefined5" type="number" min={0} max={100} value={Math.round(box?.[key]||0)} onChange={e=>update({[key]:Number(e.target.value)})}/></label>)}</div><label>{tr("Operator message")}<input data-help-id="outputSettings.undefined6" value={stage.message} maxLength={1000} onChange={e=>setStage({...stage,message:e.target.value})}/></label><label className="row"><input data-help-id="outputSettings.undefined7" type="checkbox" checked={stage.showChords} onChange={e=>setStage({...stage,showChords:e.target.checked})}/>{tr("Show song chords on stage")}</label><div className="dialog-actions"><button data-help-id="outputSettings.resetLayout" onClick={()=>setStage({...stage,layout:defaultStageLayout()})}>{tr("Reset layout")}</button><button data-help-id="outputSettings.applyStageLayout" className="primary" onClick={()=>void run('stage',stage)}>{tr("Apply stage layout")}</button></div></details></section></div></Modal>;
}
