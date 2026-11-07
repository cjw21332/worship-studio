import {useEffect,useState} from 'react';
import {AlignLeft,AlignCenter,AlignRight,AlignJustify,Check,Monitor} from 'lucide-react';
import {Modal} from './ui';
import {SlideRenderer} from './SlideRenderer';
import {useDeskTranslate} from './i18n';
import {defaultThemeConfig,resolveTheme,themeContrast,type Theme,type ThemeConfig} from '../backend/themes';
import type {SlideStyle} from '../backend/presentation';
import './TextStyles.css';

const kinds=['song','bible','note','slides','text','countdown','image','video','powerpoint'] as const;
type Kind=typeof kinds[number];
const labels:Record<Kind,string>={song:'Songs',bible:'Bible',note:'Notes',slides:'Slides',text:'Text',countdown:'Countdown',image:'Images',video:'Videos',powerpoint:'PowerPoint'};
const sizes=[24,32,40,48,56,64,72,80,96,120,144,192];
export function TextStyles({onClose,onApply,initialKind='song'}:{onClose:()=>void;onApply:()=>Promise<void>;initialKind?:string}){
 const start=kinds.find(value=>value===initialKind)||'song';
 const tr=useDeskTranslate(),[config,setConfig]=useState<ThemeConfig>(defaultThemeConfig),[kind,setKind]=useState<Kind>(start),[draft,setDraft]=useState<Theme>(()=>resolveTheme(defaultThemeConfig(),{kind:start})),[drafts,setDrafts]=useState<Partial<Record<Kind,Theme>>>({}),[fonts,setFonts]=useState(['Segoe UI','Arial','Georgia','Tahoma','Verdana']),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false),[ready,setReady]=useState(false),[sizeInput,setSizeInput]=useState('76');
 useEffect(()=>{let active=true;void window.studio.themes('initial',{}).then(value=>{if(!active)return;setConfig(value.config);setDraft(resolveTheme(value.config,{kind:start}));setReady(true);if(value.warning)setMessage(value.warning);}).catch(e=>{if(active){setError(true);setMessage(String(e));}});void window.studio.themes('fonts',{}).then(value=>{if(active)setFonts(current=>[...new Set([...current,...value.fonts])]);}).catch(()=>{});return()=>{active=false;};},[]);
 useEffect(()=>setSizeInput(String(draft.style.maxFontSize??76)),[kind,draft.style.maxFontSize]);
 const change=(patch:Partial<SlideStyle>)=>{setDraft(value=>({...value,style:{...value.style,...patch}}));setMessage('');setError(false);};
 const selectKind=(value:Kind)=>{setDrafts(current=>({...current,[kind]:draft}));setKind(value);setDraft(drafts[value]??resolveTheme(config,{kind:value}));setMessage('');setError(false);};
 const validSize=sizeInput.trim()!==''&&Number.isFinite(Number(sizeInput))&&Number(sizeInput)>=8&&Number(sizeInput)<=400;
 const apply=async()=>{if(busy||!ready||!validSize)return;setBusy(true);setMessage('');setError(false);try{const result=await window.studio.themes('apply-text-style',{theme:draft,kind});setConfig(result.config);setDraft(result.theme);setDrafts(current=>({...current,[kind]:result.theme}));await onApply();setMessage(result.warning||tr('Text style applied.'));}catch(e){setError(true);setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const contrast=themeContrast(draft);
 const sample=kind==='song'?'Let every voice be heard\nLet every heart be ready':kind==='bible'?'Your word is a lamp to my feet,\nand a light for my path.':kind==='countdown'?'Service starts in':kind==='note'?'Welcome to our gathering\nWe are glad you are here':'Let every voice be heard\nand every heart be ready.';
 return <Modal title={tr('Text styles by content type')} onClose={()=>{if(!busy)onClose();}} wide className="text-style-dialog">
 <form onSubmit={e=>{e.preventDefault();void apply();}} aria-busy={busy}>
 <p className="text-style-intro">{tr('Set the default text appearance for each content type.')}</p>
 <div className="text-styles">
 <fieldset className="text-style-controls" disabled={!ready||busy}><legend className="sr-only">{tr('Text style settings')}</legend>
 <label>{tr('Content type')}<select aria-label={tr('Content type')} autoFocus data-help-id="textStyles.contentType" value={kind} onChange={e=>selectKind(e.target.value as Kind)}>{kinds.map(value=><option key={value} value={value}>{tr(labels[value])}</option>)}</select></label>
 <label>{tr('Font family')}<select aria-label={tr('Font family')} data-help-id="textStyles.fontFamily" value={draft.style.fontFamily||'Segoe UI'} onChange={e=>change({fontFamily:e.target.value})}>{[...new Set([draft.style.fontFamily||'Segoe UI',...fonts])].map(value=><option key={value}>{value}</option>)}</select></label>
 <div className="text-style-row"><label>{tr('Font size preset')}<select aria-label={tr('Font size preset')} data-help-id="textStyles.fontSizePreset" value={sizes.includes(draft.style.maxFontSize||76)?draft.style.maxFontSize:'custom'} onChange={e=>{if(e.target.value!=='custom'){const size=Number(e.target.value);change({maxFontSize:size,minFontSize:Math.min(draft.style.minFontSize||24,size)});}}}><option value="custom">{tr('Custom')}</option>{sizes.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
 <label>{tr('Maximum font size')}<input type="number" min={8} max={400} step="any" required value={sizeInput} aria-invalid={!validSize} aria-describedby="text-size-hint" onChange={e=>{const value=e.target.value;setSizeInput(value);const n=Number(value);if(value&&Number.isFinite(n)&&n>=8&&n<=400)change({maxFontSize:n,minFontSize:Math.min(draft.style.minFontSize||24,n)});}}/></label></div>
 <p id="text-size-hint" className={'text-style-help '+(!validSize?'text-style-error':'')}>{tr(validSize?'Text shrinks automatically to fit the slide.':'Enter a font size between 8 and 400.')}</p>
 <label>{tr('Text color')}<span className="text-style-color"><input type="color" value={draft.style.color||'#ffffff'} onChange={e=>change({color:e.target.value})}/><span aria-hidden="true">{(draft.style.color||'#ffffff').toUpperCase()}</span></span></label>
 <div className="text-style-row"><fieldset className="text-style-alignment"><legend>{tr('Text alignment')}</legend><div className="text-alignment">{([['left','Align left',AlignLeft],['center','Align center',AlignCenter],['right','Align right',AlignRight],['justify','Justify',AlignJustify]] as const).map(([value,label,Icon])=><button type="button" key={value} title={tr(label)} aria-label={tr(label)} aria-pressed={(draft.style.align||'center')===value} onClick={()=>change({align:value})}><Icon size={18} aria-hidden="true"/></button>)}</div></fieldset>
 <label>{tr('Vertical alignment')}<select aria-label={tr('Vertical alignment')} data-help-id="textStyles.verticalAlignment" value={draft.style.verticalAlign||'center'} onChange={e=>change({verticalAlign:e.target.value as 'top'|'center'|'bottom'})}><option value="top">{tr('Top')}</option><option value="center">{tr('Middle')}</option><option value="bottom">{tr('Bottom')}</option></select></label></div>
 </fieldset>
 <section className="text-style-preview" aria-label={tr('Preview')}><div className="text-style-preview-heading"><h3><Monitor size={17} aria-hidden="true"/>{tr('Preview')}</h3><span>16:9</span></div>
 <div className="text-style-canvas"><SlideRenderer slide={{title:'Preview',text:sample,...(kind==='countdown'?{countdown:{endsAt:0,stoppedRemaining:300000,message:sample}}:{})}} style={draft.style} mode="preview"/></div>
 <p className="text-style-help">{tr('Sample text · changes appear here before applying.')}</p>
 <div className="text-style-summary"><strong>{tr(labels[kind])}</strong><span>{draft.style.fontFamily} · {draft.style.maxFontSize} {tr('maximum')}</span></div>
 <p className="text-style-contrast">{contrast.verified&&contrast.ratio>=4.5&&<Check size={16} aria-hidden="true"/>}{tr(contrast.verified?(contrast.ratio>=4.5?'Good text contrast':'Low text contrast — try another color'):'Check text contrast against your media background.')}{contrast.verified&&' · '+contrast.ratio.toFixed(1)+':1'}</p>
 <p className="text-style-help">{tr('Item themes can override this default. Images and videos keep their original content.')}</p>
 </section></div>
 <div className="text-style-footer"><div className="text-style-feedback"><p className="text-style-help">{tr('Applying updates matching live content immediately.')}</p><p role={error?'alert':'status'} className={error?'text-style-error':''}>{message||(!ready?tr('Loading text styles…'):'')}</p></div><button type="button" disabled={busy} onClick={onClose}>{tr('Done')}</button><button data-help-id="textStyles.applyTextStyle" type="submit" className="primary" disabled={busy||!ready||!validSize}>{tr(busy?'Applying…':'Apply text style')}</button></div>
 </form></Modal>;
}

