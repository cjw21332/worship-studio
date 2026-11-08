import type {BiblePage} from './bible';

export type TransitionName='none'|'fade'|'push'|'zoom'|'flip';
export type Transition={name:TransitionName;duration:number;reduceMotion:boolean};
export type SlideStyle={
 fontFamily?:string;minFontSize?:number;maxFontSize?:number;color?:string;outlineColor?:string;outlineWidth?:number;
 shadow?:string;align?:'left'|'center'|'right'|'justify';verticalAlign?:'top'|'center'|'bottom';lineSpacing?:number;
 margin?:number;background?:string;backgroundImage?:string;backgroundVideo?:string;fit?:'contain'|'cover'|'fill';
 lowerThird?:boolean;footerColor?:string;footerSize?:number;box?:{x:number;y:number;width:number;height:number};
};
export type VideoSlide={src:string;start?:number;end?:number;loop?:boolean;muted?:boolean;volume?:number;brightness?:number;contrast?:number;playing?:boolean;position?:number;startedAt?:number};
export type CountdownSlide={endsAt:number;message?:string;format?:'mm:ss'|'hh:mm:ss';stoppedRemaining?:number};
export type Slide={title:string;text:string;image?:string;itemId?:string;index?:number;stageText?:string;notes?:string;bible?:BiblePage;style?:SlideStyle;transition?:Transition;video?:VideoSlide;countdown?:CountdownSlide};
export type StageBoxId='current'|'next'|'notes'|'clock'|'countdown'|'message';
export type StageBox={id:StageBoxId;x:number;y:number;width:number;height:number;fontSize:number};
export type StageState={message:string;showChords:boolean;layout:StageBox[]};
export type Alert={id:string;text:string;scrolling:boolean;expiresAt?:number};
export type Timer={id:string;label:string;endsAt:number;pausedRemaining?:number};
export type Presentation={
 preview:Slide|null;live:Slide|null;next:Slide|null;blackout:boolean;clear:boolean;logo:boolean;freeze:boolean;
 frozenLive?:Slide|null;frozenNext?:Slide|null;frozenClear?:boolean;frozenLogo?:boolean;frozenBlackout?:boolean;
 frozenTheme?:SlideStyle;frozenAlerts?:Alert[];frozenTimers?:Timer[];frozenTransition?:Transition;frozenAt?:number;revision:number;updatedAt:number;stage:StageState;transition:Transition;
 theme?:SlideStyle;alerts:Alert[];timers:Timer[];
};
export const defaultStageLayout=():StageBox[]=>[
 {id:'current',x:3,y:5,width:59,height:51,fontSize:72},
 {id:'next',x:65,y:5,width:32,height:51,fontSize:40},
 {id:'notes',x:3,y:60,width:59,height:22,fontSize:32},
 {id:'clock',x:65,y:60,width:32,height:12,fontSize:48},
 {id:'countdown',x:65,y:76,width:32,height:18,fontSize:40},
 {id:'message',x:3,y:85,width:59,height:10,fontSize:36}
];
const finite=(value:number,fallback:number)=>Number.isFinite(value)?value:fallback;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function clampStageLayout(layout:readonly StageBox[]):StageBox[]{
 const valid=new Set<StageBoxId>(['current','next','notes','clock','countdown','message']),seen=new Set<StageBoxId>();
 return layout.filter(box=>valid.has(box.id)&&!seen.has(box.id)&&!!seen.add(box.id)).map(box=>{
  const width=clamp(finite(box.width,40),8,100),height=clamp(finite(box.height,20),8,100);
  return {id:box.id,width,height,x:clamp(finite(box.x,0),0,100-width),y:clamp(finite(box.y,0),0,100-height),fontSize:clamp(finite(box.fontSize,32),14,160)};
 });
}
export const initialPresentation=():Presentation=>({
 preview:null,live:null,next:null,blackout:true,clear:false,logo:false,freeze:false,revision:0,updatedAt:Date.now(),
 stage:{message:'',showChords:true,layout:defaultStageLayout()},transition:{name:'none',duration:250,reduceMotion:false},
 alerts:[],timers:[]
});
export function updatePresentation(state:Presentation,patch:Partial<Omit<Presentation,'revision'|'updatedAt'>>):Presentation{
 return {...structuredClone(state),...structuredClone(patch),revision:(state.revision||0)+1,updatedAt:Date.now()};
}
export function preview(state:Presentation,slide:Slide):Presentation{return updatePresentation(state,{preview:slide});}
export function takeLive(state:Presentation):Presentation{
 if(!state.preview)throw new Error('Choose a slide to preview first.');
 return updatePresentation(state,{live:state.preview,blackout:false,clear:false,logo:false});
}
export function blackout(state:Presentation):Presentation{return updatePresentation(state,{blackout:true});}
/** Check both the live slide and, after asynchronous preparation, intervening changes. */
export function canAutoAdvance(state:Presentation,itemId:string,index:number,revision?:number):boolean{
 return !state.freeze&&!state.blackout&&!state.clear&&!state.logo&&state.live?.itemId===itemId&&(state.live.index??0)===index&&(revision===undefined||state.revision===revision);
}
export function toggleOutput(state:Presentation,mode:'blackout'|'clear'|'logo'):Presentation{
 return updatePresentation(state,{blackout:false,clear:false,logo:false,[mode]:!state[mode]});
}
export function toggleFreeze(state:Presentation):Presentation{
 if(state.freeze){
  const {frozenLive,frozenNext,frozenClear,frozenLogo,frozenBlackout,frozenTheme,frozenAlerts,frozenTimers,frozenTransition,frozenAt,...rest}=state;
  return updatePresentation(rest,{freeze:false});
 }
 return updatePresentation(state,{freeze:true,frozenLive:state.live,frozenNext:state.next,frozenClear:state.clear,frozenLogo:state.logo,frozenBlackout:state.blackout,frozenTheme:state.theme,frozenAlerts:state.alerts,frozenTimers:state.timers,frozenTransition:state.transition,frozenAt:Date.now()});
}
/** Emergency blackout always wins. Preview and queued live changes remain in state. */
export function visiblePresentation(state:Presentation):Presentation{
 if(!state.freeze)return state;
 return {...state,live:state.frozenLive??null,next:state.frozenNext??null,clear:state.frozenClear??false,logo:state.frozenLogo??false,theme:state.frozenTheme,alerts:state.frozenAlerts??state.alerts,timers:state.frozenTimers??state.timers,transition:state.frozenTransition??state.transition,blackout:state.blackout||!!state.frozenBlackout};
}
