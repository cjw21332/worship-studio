import {useLayoutEffect,useRef,type CSSProperties} from 'react';
export function FittedText({text,min=20,max=76,style,className=''}:{text:string;min?:number;max?:number;style?:CSSProperties;className?:string}){
 const box=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const host=box.current,node=content.current;if(!host||!node)return;
  const fit=()=>{
   if(host.clientWidth===0||host.clientHeight===0)return;
   const scale=host.clientWidth/1728;
   let low=Math.max(.5,min*scale),high=Math.max(low,max*scale),best=low;
   node.style.fontSize=low+'px';
   // Oversized imported text must remain visible. Surface the smaller fit to the operator.
   const underMinimum=node.scrollHeight>host.clientHeight||node.scrollWidth>host.clientWidth;
   if(underMinimum)low=.5;
   for(let n=0;n<16;n++){const candidate=(low+high)/2;node.style.fontSize=candidate+'px';if(node.scrollHeight<=host.clientHeight&&node.scrollWidth<=host.clientWidth){best=candidate;low=candidate;}else high=candidate;}
   node.style.fontSize=best+'px';host.dataset.belowMinimum=String(underMinimum);
  };
  const observer=new ResizeObserver(fit);observer.observe(host);fit();void document.fonts.ready.then(fit);return()=>observer.disconnect();
 },[text,min,max,style]);
 return <div className={'fitted-text '+className} ref={box} style={style}><div ref={content}>{text}</div></div>;
}
