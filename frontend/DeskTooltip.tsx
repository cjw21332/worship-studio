import {createPortal} from 'react-dom';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {deskT,type Language} from './i18n';

export function DeskTooltip({language}:{language:Language}){
 const [tip,setTip]=useState<{text:string;x:number;y:number;owner:HTMLElement}|null>(null);
 const owner=useRef<HTMLElement|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const hovering=useRef(false),dismissed=useRef<HTMLElement|null>(null),hideTip=useRef(()=>{});
 useLayoutEffect(()=>{
  if(!tip)return;
  const target=tip.owner;
  const position=()=>{
   const node=document.getElementById('desk-tooltip');
   if(!node||!target.isConnected)return;
   const trigger=target.getBoundingClientRect(),box=node.getBoundingClientRect(),gap=8;
   const rail=target.closest('.ws-rail');const left=Math.max(gap,Math.min(innerWidth-box.width-gap,rail?trigger.right+gap:trigger.left));
   let top=rail?Math.max(gap,trigger.top):trigger.top-box.height-gap;
   if(top<gap)top=trigger.bottom+gap;
   if(top+box.height>innerHeight-gap)top=Math.max(gap,innerHeight-box.height-gap);
   setTip(current=>current?.owner===target&&(current.x!==left||current.y!==top)?{...current,x:left,y:top}:current);
  };
  position();
  const observer=new ResizeObserver(position);
  const node=document.getElementById('desk-tooltip');if(node)observer.observe(node);
  observer.observe(target);if(target.parentElement)observer.observe(target.parentElement);
  const dialog=target.closest('dialog');if(dialog)observer.observe(dialog);
  window.addEventListener('resize',position);document.addEventListener('scroll',position,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true);};
 },[tip?.text,tip?.owner]);
 useEffect(()=>{
  const clear=()=>{if(timer.current)clearTimeout(timer.current);};
  const hide=()=>{
   clear();
   if(owner.current){
    const words=(owner.current.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!=='desk-tooltip');
    if(words.length)owner.current.setAttribute('aria-describedby',words.join(' '));else owner.current.removeAttribute('aria-describedby');
   }
   owner.current=null;hovering.current=false;setTip(null);
  };
  hideTip.current=hide;
  const show=(event:Event)=>{
   const target=(event.target as HTMLElement)?.closest<HTMLElement>('[title],[data-desk-tooltip],button[aria-label],summary[aria-label],input[aria-label],textarea[aria-label]');
   if(!target||target.closest('[role=tooltip]')||target===dismissed.current)return;
   if(target===owner.current){clear();return;}
   hide();
   let label=target.getAttribute('title')||target.dataset.deskTooltip||target.getAttribute('aria-label')||'';
   if(!label)return;
   if(target.hasAttribute('title')){target.dataset.deskTooltip=label;target.removeAttribute('title');}
   const hints:Record<string,string>={[deskT(language,'Go Live')]:'F5',[deskT(language,'Save')]:'Ctrl+S',[deskT(language,'Black')]:'B',[deskT(language,'Clear')]:'C',[deskT(language,'Logo')]:'L',[deskT(language,'Previous')]:'Left',[deskT(language,'Next')]:'Right'};
   if(document.documentElement.dataset.shortcutHints!=='false'&&hints[label])label+=' ('+hints[label]+')';
   const rect=target.getBoundingClientRect();owner.current=target;
   target.setAttribute('aria-describedby',[(target.getAttribute('aria-describedby')||''),'desk-tooltip'].filter(Boolean).join(' '));
   setTip({text:label,owner:target,x:Math.max(6,Math.min(window.innerWidth-340,rect.left)),y:rect.top>=70?rect.top-62:rect.bottom+6});
  };
  const leave=(event:Event)=>{
   const next=(event as PointerEvent).relatedTarget as Node|null;
   if(owner.current?.contains(next)||document.getElementById('desk-tooltip')?.contains(next))return;
   clear();timer.current=setTimeout(()=>{if(!hovering.current&&!owner.current?.contains(document.activeElement))hide();},180);dismissed.current=null;
  };
  const dismiss=()=>{if(owner.current){dismissed.current=owner.current;hide();}};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'||['Enter',' '].includes(event.key)&&owner.current?.contains(event.target as Node))dismiss();};
  const activate=(event:PointerEvent)=>{if(owner.current?.contains(event.target as Node))dismiss();};
  document.addEventListener('pointerover',show);document.addEventListener('focusin',show);
  document.addEventListener('pointerout',leave);document.addEventListener('focusout',leave);
  document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',activate,true);
  return()=>{hide();document.removeEventListener('pointerover',show);document.removeEventListener('focusin',show);document.removeEventListener('pointerout',leave);document.removeEventListener('focusout',leave);document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',activate,true);};
 },[language]);
 return tip?createPortal(<div id="desk-tooltip" role="tooltip" className="desk-tooltip" style={{left:tip.x,top:tip.y}} onPointerEnter={()=>{hovering.current=true;if(timer.current)clearTimeout(timer.current);}} onPointerLeave={()=>{hovering.current=false;if(!owner.current?.contains(document.activeElement))hideTip.current();}}>{tip.text}</div>,document.querySelector('dialog[open]')||document.body):null;
}
