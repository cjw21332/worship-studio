export const v2LayoutDefaults=()=>({library:280,presentation:380,serviceRatio:45});
export function clampV2Layout(value:Partial<ReturnType<typeof v2LayoutDefaults>>|undefined,width:number){const wanted={...v2LayoutDefaults(),...value},available=Math.max(1024,width)-72-16-340,presentation=Math.max(320,Math.min(600,available-240,wanted.presentation)),library=Math.max(240,Math.min(600,available-presentation,wanted.library));return{library,presentation,serviceRatio:Math.max(20,Math.min(80,wanted.serviceRatio))};}
export function resizeV2(value:ReturnType<typeof v2LayoutDefaults>,part:'library'|'presentation'|'serviceRatio',key:string,shift=false,width=1366,height=600){const start=part==='serviceRatio'?20:part==='library'?240:320,max=part==='serviceRatio'?80:600,delta=(shift?64:16)*(part==='serviceRatio'?100/height:1),direction=['ArrowLeft','ArrowUp'].includes(key)?-1:1,next=key==='Home'?start:key==='End'?max:key==='Enter'?v2LayoutDefaults()[part]:value[part]+direction*delta;return clampV2Layout({...value,[part]:Math.round(next*10)/10},width);}

// NEW: Responsive breakpoint support
export function getResponsiveLayout(width:number):ReturnType<typeof v2LayoutDefaults>{
  // Mobile-first breakpoints
  if (width < 768) {
    // Narrow screen - prioritize presentation, shrink other panes
    return {library: 240, presentation: Math.min(400, width - 128), serviceRatio: 50};
  }
  if (width < 1024) {
  // Medium screen - balanced layout
    return {library: 280, presentation: 380, serviceRatio: 45};
  }
  // Large screen - default full layout
  return v2LayoutDefaults();
}