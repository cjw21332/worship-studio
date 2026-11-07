import {useEffect,useRef,useState} from 'react';
import {initialPresentation,visiblePresentation,type Presentation} from '../backend/presentation';
import type {outputBridge} from '../backend/output-preload';
import type {OutputRole,OutputSplit} from '../backend/outputs';
import {SlideRenderer} from './SlideRenderer';
import {ErrorBoundary} from './ErrorBoundary';
import './output.css';

declare global{interface Window{studioOutput?:typeof outputBridge}}
const roles:OutputRole[]=['audience','audience-secondary','stage','rehearsal','confidence'];
export function Output(){
 const params=new URLSearchParams(location.hash.slice(1));
 const rawRole=params.get('output'),role:OutputRole=roles.includes(rawRole as OutputRole)?rawRole as OutputRole:'audience';
 const rawSplit=params.get('split'),split:OutputSplit=rawSplit==='left'||rawSplit==='right'?rawSplit:'full';
 const [state,setState]=useState(initialPresentation),[error,setError]=useState(''),revision=useRef(-1);
 useEffect(()=>{
  const bridge=window.studioOutput;if(!bridge){setError('The output connection is unavailable. Close this window and rearm output.');return;}
  let active=true;
  const accept=(snapshot:Presentation)=>{
   if(!active||!snapshot||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<=revision.current)return;
   revision.current=snapshot.revision;setState(snapshot);setError('');
  };
  // Subscribe first so a newer push cannot be overwritten by a delayed initial read.
  const unsubscribe=bridge.subscribe(accept);
  void bridge.get().then(accept).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));});
  return()=>{active=false;unsubscribe();};
 },[]);
 useEffect(()=>{document.title='Worship Studio — '+role;},[role]);
 const mode=role==='stage'?'stage':role==='confidence'?'confidence':'audience';
 const visible=visiblePresentation(state),transparent=mode==='audience'&&!visible.blackout&&(visible.live?.style?.background??visible.theme?.background)==='transparent';
 return <div className="output-root" data-output-role={role} data-output-split={split} data-capture-transparent={transparent}><ErrorBoundary output>{error?<div className="output-failure" role="alert">{error}</div>:<div className={'output-viewport split-'+split}><SlideRenderer slide={state.live} state={state} mode={mode}/></div>}</ErrorBoundary></div>;
}
