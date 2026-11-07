import {useEffect,useInsertionEffect,useRef,useState,type CSSProperties} from 'react';
import {FittedText} from './FittedText';
import {visiblePresentation,type Presentation,type Slide,type SlideStyle,type StageBox,type VideoSlide} from '../backend/presentation';

const css=String.raw`
.studio-slide{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;isolation:isolate;container-type:inline-size;background:#101820;color:white;font-family:'Segoe UI',sans-serif}
.studio-slide *{box-sizing:border-box}.studio-slide .background-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none}
.studio-slide .slide-layer{position:absolute;inset:0;overflow:hidden;transform-origin:center;animation-fill-mode:both;animation-timing-function:ease-out}
.studio-slide .text-box{position:absolute;min-width:0;min-height:0}.studio-slide .fitted-text{height:100%;width:100%;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.studio-slide .fitted-text>div{width:100%;max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal}
.studio-slide .slide-image,.studio-slide .slide-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.studio-slide .slide-footer{position:absolute;left:5%;right:5%;bottom:2%;height:6%;display:flex;justify-content:space-between;align-items:center;gap:3%;font-size:1.5cqw;line-height:1.15}
.studio-slide .slide-footer .copyright{max-width:68%;font-size:.65em;text-align:right;opacity:.9}
.studio-slide .bible-columns{display:grid;height:100%;gap:3%;min-height:0}.studio-slide .bible-column{min-width:0;min-height:0;display:flex;flex-direction:column;gap:3%}
.studio-slide .translation-label{font-size:1.4cqw;font-weight:600;flex:none;opacity:.9}.studio-slide .bible-column .fitted-text{flex:1;min-height:0}
.studio-slide .bible-lines{height:100%;display:flex;flex-direction:column;gap:3%;min-height:0}.studio-slide .bible-verse-group{display:flex;flex-direction:column;flex:1;gap:4%;min-height:0}
.studio-slide .bible-language-line{display:flex;align-items:center;gap:2%;flex:1;min-height:0}.studio-slide .bible-language-line>.translation-label{width:9%;text-align:left;flex:none}
.studio-slide .bible-language-line>.fitted-text{flex:1}.studio-slide .verse-unavailable{font-style:italic;opacity:.7}.studio-slide .verse-number{font-size:.7em;opacity:.85}
.studio-slide .logo-mark{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3%;font-size:3.6cqw;font-weight:600}.studio-slide .logo-mark img{width:18%;height:auto;object-fit:contain}
.studio-slide .countdown-slide{position:absolute;inset:7%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3%;font-variant-numeric:tabular-nums}
.studio-slide .countdown-slide strong{font-size:12cqw;line-height:1.1}.studio-slide .countdown-slide .fitted-text{height:20%;flex:none}
.studio-slide .alert-overlay{position:absolute;left:0;right:0;bottom:10%;min-height:8%;background:#07141de8;color:white;z-index:10;display:flex;align-items:center;overflow:hidden;font-size:2.5cqw;padding:1% 2%}
.studio-slide .alert-overlay.scrolling>span{display:inline-block;white-space:nowrap;min-width:max-content;animation:studio-alert 24s linear infinite}
.studio-stage{background:#05090d}.studio-stage .stage-box{position:absolute;border:1px solid #4b5d69;border-radius:5px;overflow:hidden;padding:1%;color:#fff;background:#101820}
.studio-stage .stage-label{height:11%;min-height:16px;font-size:clamp(14px,1cqw,24px);font-weight:600;color:#b5c7d4}.studio-stage .stage-content{height:85%;position:relative;min-height:0}
.studio-stage .stage-box[data-box=next]{color:#d6e2e8}.studio-stage .stage-box[data-box=message]{color:#ffe09a;border-color:#97732c}
.studio-stage .stage-badges{position:absolute;top:0;left:3%;right:3%;height:4%;display:flex;align-items:center;gap:3%;font-size:clamp(14px,1cqw,24px);color:#b5c7d4}.studio-stage .stage-badges strong{color:#ffb0a8}
.studio-stage .stage-clock,.studio-stage .stage-timer{height:100%;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;font-size:3cqw}
.studio-stage .stage-timer{flex-direction:column;gap:2%}.studio-stage .stage-timer small{font-size:.45em;color:#b5c7d4}
@keyframes studio-fade{from{opacity:0}to{opacity:1}}@keyframes studio-push{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes studio-zoom{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}@keyframes studio-flip{from{transform:perspective(1800px) rotateY(90deg);opacity:0}to{transform:perspective(1800px) rotateY(0);opacity:1}}@keyframes studio-alert{from{transform:translateX(100cqw)}to{transform:translateX(-100%)}}
@media(prefers-reduced-motion:reduce){.studio-slide .slide-layer,.studio-slide .alert-overlay>span{animation:none!important;transform:none!important}}
`;
function useSlideStyles(){
 useInsertionEffect(()=>{
  if(!document.getElementById('worship-slide-renderer-styles')){const style=document.createElement('style');style.id='worship-slide-renderer-styles';style.textContent=css;document.head.append(style);}
 },[]);
}
const number=(value:number|undefined,fallback:number,min:number,max:number)=>Math.min(max,Math.max(min,Number.isFinite(value)?value!:fallback));
function useTime(active=true){const [now,setNow]=useState(Date.now);useEffect(()=>{if(!active)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[active]);return now;}
export function formatCountdown(milliseconds:number,format:'mm:ss'|'hh:mm:ss'='mm:ss'){
 const seconds=Math.max(0,Math.ceil(milliseconds/1000)),minutes=Math.floor(seconds/60),remaining=String(seconds%60).padStart(2,'0');
 return format==='hh:mm:ss'?String(Math.floor(seconds/3600)).padStart(2,'0')+':'+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+remaining:String(minutes).padStart(2,'0')+':'+remaining;
}
function VideoFrame({video,paused=false,freezeAt,background=false,fit='contain',onError}:{video:VideoSlide;paused?:boolean;freezeAt?:number;background?:boolean;fit?:'contain'|'cover'|'fill';onError?:()=>void}){
 const ref=useRef<HTMLVideoElement>(null);
 useEffect(()=>{
  const node=ref.current;if(!node)return;
  const start=number(video.start,0,0,86400),end=number(video.end,86400,start+.05,86400);
  const sync=()=>{
   const elapsed=video.playing!==false&&video.startedAt?((freezeAt??Date.now())-video.startedAt)/1000:0;
   let position=Math.max(start,(video.position??start)+Math.max(0,elapsed));
   const last=Math.min(end,Number.isFinite(node.duration)?node.duration:end);
   if(video.loop&&last>start)position=start+(position-start)%(last-start);
   else position=Math.min(position,last);
   if(Number.isFinite(position)&&Math.abs(node.currentTime-position)>.15)node.currentTime=position;
   node.volume=number(video.volume,1,0,1);node.muted=paused||!!video.muted;
   if(paused||video.playing===false)node.pause();else void node.play().catch(()=>onError?.());
  };
  const bound=()=>{if(node.currentTime>=end){if(video.loop){node.currentTime=start;if(!paused)void node.play().catch(()=>onError?.());}else node.pause();}};
  node.addEventListener('loadedmetadata',sync);node.addEventListener('timeupdate',bound);sync();
  return()=>{node.removeEventListener('loadedmetadata',sync);node.removeEventListener('timeupdate',bound);};
 },[video.src,video.start,video.end,video.loop,video.muted,video.volume,video.position,video.playing,video.startedAt,paused,freezeAt,onError]);
 return <video ref={ref} src={video.src} className={background?'background-media':'slide-video'} style={{objectFit:fit,filter:'brightness('+number(video.brightness,1,0,2)+') contrast('+number(video.contrast,1,0,2)+')'}} playsInline preload="auto" onError={onError}/>;
}
function plainStageText(slide:Slide|null,chords:boolean){
 if(!slide)return 'No slide selected';
 if(slide.bible)return slide.bible.columns.map(c=>c.label+'\n'+c.text).join('\n\n');
 if(slide.video)return slide.title;
 return chords?(slide.stageText||slide.text):slide.text;
}
function StagePanel({state,confidence=false}:{state:Presentation;confidence?:boolean}){
 const visible=visiblePresentation(state),now=useTime(),layout=state.stage.layout;
 const current=visible.live,next=visible.next;
 const labels:Record<StageBox['id'],string>={current:'Current slide',next:'Next slide',notes:'Service notes',clock:'Clock',countdown:'Countdown',message:'Operator message'};
 return <div className="studio-slide studio-stage"><div className="stage-badges"><span>{confidence?'Confidence':'Stage display'}</span>{visible.blackout&&<strong>Audience blacked out</strong>}{visible.clear&&<strong>Audience text cleared</strong>}{visible.logo&&<strong>Audience logo</strong>}{state.freeze&&<strong>Output frozen</strong>}</div>{layout.map(box=><section key={box.id} className="stage-box" data-box={box.id} style={{left:box.x+'%',top:box.y+'%',width:box.width+'%',height:box.height+'%'}}><div className="stage-label">{labels[box.id]}</div><div className="stage-content">
 {box.id==='clock'?<div className="stage-clock">{new Date(now).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>:box.id==='countdown'?<div className="stage-timer">{visible.timers.length?visible.timers.map(timer=><div key={timer.id}><small>{timer.label}</small><div>{formatCountdown(timer.pausedRemaining??timer.endsAt-now)}</div></div>):current?.countdown?formatCountdown(current.countdown.stoppedRemaining??current.countdown.endsAt-now):'â€”'}</div>:box.id==='current'&&current?.image?<img className="slide-image" src={current.image} alt={current.title}/>:<FittedText text={box.id==='current'?plainStageText(current,!confidence&&state.stage.showChords):box.id==='next'?plainStageText(next,!confidence&&state.stage.showChords):box.id==='notes'?(current?.notes||'No notes'):state.stage.message||'No message'} min={14*90/box.width} max={box.fontSize*90/box.width} style={{textAlign:'left'}}/>}
 </div></section>)}</div>;
}
export type SlideRendererProps={slide:Slide|null;state?:Presentation;style?:SlideStyle;mode?:'audience'|'stage'|'confidence'|'preview';onMediaError?:()=>void};
export function SlideRenderer({slide:input,state,style:override,mode='audience',onMediaError}:SlideRendererProps){
 useSlideStyles();const now=useTime(!state?.freeze&&!!(input?.countdown||state?.live?.countdown||state?.alerts?.some(alert=>alert.expiresAt)));
 if(state&&(mode==='stage'||mode==='confidence'))return <StagePanel state={state} confidence={mode==='confidence'}/>;
 const visible=state?visiblePresentation(state):undefined,slide=visible?visible.live:input;
 const style:SlideStyle={background:'#101820',color:'#ffffff',fontFamily:'Segoe UI',minFontSize:20,maxFontSize:76,margin:6,align:'center',verticalAlign:'center',lineSpacing:1.25,...visible?.theme,...slide?.style,...override};
 const transition=slide?.transition??visible?.transition??{name:'none',duration:0,reduceMotion:false};
 const margin=number(style.margin,6,0,30);
 const lower=style.lowerThird;
 const box=style.box??{x:margin,y:lower?72:margin,width:100-margin*2,height:lower?20:82-margin};
 const textStyle:CSSProperties={fontFamily:style.fontFamily,color:style.color,textAlign:style.align,lineHeight:number(style.lineSpacing,1.25,.8,2.5),textShadow:style.shadow,WebkitTextStroke:style.outlineWidth?number(style.outlineWidth,0,0,8)+'px '+(style.outlineColor||'#000'):undefined,alignItems:style.verticalAlign==='top'?'flex-start':style.verticalAlign==='bottom'?'flex-end':'center'};
 const text=(value:string,extra?:CSSProperties)=><FittedText text={value} min={number(style.minFontSize,20,8,200)} max={number(style.maxFontSize,76,8,400)} style={{...textStyle,...extra}}/>;
 const identity=slide?JSON.stringify([slide.itemId,slide.index,slide.text,slide.image,slide.video?.src,slide.bible?.columns.map(c=>c.text)]):'empty';
 const paused=mode==='preview'||!!state?.freeze;
 const at=state?.freeze?(state.frozenAt??now):now;
 const bible=slide?.bible;
 const footer=bible?.reference??'';
 const bundledNotices=new Set(['Public domain. “World English Bible” is a trademark of eBible.org. This edition preserves the publisher’s verse text.','Public domain. American Standard Version of 1901. Source: eBible.org.']);
 const copyright=bible?Array.from(new Set(bible.columns.map(c=>c.copyright).filter(value=>value&&!bundledNotices.has(value)))).join('  '):'';
 const alerts=(visible?.alerts||[]).filter(alert=>!alert.expiresAt||alert.expiresAt>at);
 const transitionStyle:CSSProperties=transition.name==='none'||transition.reduceMotion||mode==='preview'?{}:{animationName:'studio-'+transition.name,animationDuration:number(transition.duration,250,0,3000)+'ms'};
 return <div className="studio-slide" data-mode={mode} data-revision={visible?.revision} style={{background:visible?.blackout?'#000':style.background,color:style.color}}>
 {!visible?.blackout&&<>
 {style.backgroundImage&&<img className="background-media" src={style.backgroundImage} alt=""/>}
 {style.backgroundVideo&&<VideoFrame video={{src:style.backgroundVideo,loop:true,muted:true,playing:true}} background paused={paused} freezeAt={state?.freeze?state.frozenAt:undefined} fit="cover" onError={onMediaError}/>}
 {slide?.image&&<img className="slide-image" src={slide.image} alt={slide.title} style={{objectFit:style.fit||'contain'}}/>}
 {slide?.video&&<VideoFrame video={slide.video} paused={paused} freezeAt={state?.freeze?state.frozenAt:undefined} fit={style.fit||'contain'} onError={onMediaError}/>}
 {visible?.logo?<div className="logo-mark"><img src="./app-icon.png" alt=""/><span>Worship Studio</span></div>:!visible?.clear&&<div className="slide-layer" key={identity} style={transitionStyle}>
 {slide?.countdown?<div className="countdown-slide">{text(slide.countdown.message||'Service starts in')}<strong>{formatCountdown(slide.countdown.stoppedRemaining??slide.countdown.endsAt-at,slide.countdown.format)}</strong></div>:slide&&!slide.image&&!slide.video&&<div className="text-box" style={{left:number(box.x,margin,0,98)+'%',top:number(box.y,margin,0,98)+'%',width:number(box.width,100-margin*2,2,100-number(box.x,margin,0,98))+'%',height:number(box.height,82-margin,2,100-number(box.y,margin,0,98))+'%',background:lower?'#0009':undefined,padding:lower?'1%':undefined}}>
 {bible?(bible.mode==='line-by-line'?<div className="bible-lines">{bible.rows.map(row=><div className="bible-verse-group" key={row.bookId+':'+row.chapter+':'+row.verse}>{row.columns.map(column=><div className="bible-language-line" key={column.translationId}><span className="translation-label">{column.label}</span>{text((bible.showVerseNumbers?row.verse+' ':'')+column.text,{fontFamily:column.fontFamily||style.fontFamily,fontStyle:column.missing?'italic':undefined,opacity:column.missing?.7:1})}</div>)}</div>)}</div>:<div className="bible-columns" style={bible.mode==='stacked'?{gridTemplateRows:'repeat('+bible.columns.length+',minmax(0,1fr))'}:{gridTemplateColumns:'repeat('+bible.columns.length+',minmax(0,1fr))'}}>{bible.columns.map(column=><div className="bible-column" key={column.translationId}><div className="translation-label">{column.label}</div>{text(column.text,{fontFamily:column.fontFamily||style.fontFamily})}</div>)}</div>):text(slide.text)}
 </div>}
 {bible&&<footer className="slide-footer" style={{color:style.footerColor||style.color,fontSize:(number(style.footerSize,28,10,80)/19.2)+'cqw'}}><span>{footer}{bible.continuation?' Â· '+bible.continuation.part+'/'+bible.continuation.total:''}</span><span className="copyright">{copyright}</span></footer>}
 </div>}
 {!visible?.logo&&!visible?.clear&&alerts.map((alert,index)=><div className={'alert-overlay '+(alert.scrolling?'scrolling':'')} style={{bottom:(10+index*9)+'%',animationPlayState:state?.freeze?'paused':'running'}} key={alert.id}><span>{alert.text}</span></div>)}
 </>}
 </div>;
}

