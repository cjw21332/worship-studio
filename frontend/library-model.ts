import{rove}from'./ui-v2/keyboard';
export const libraryTabs=[{id:'Songs',label:'Song'},{id:'Bible',label:'Bible'},{id:'Notes',label:'Note'},{id:'Images',label:'Image'},{id:'Video',label:'Video'},{id:'Slides',label:'Slides'}] as const;
export function nextTab(current:number,key:string,count=6){return rove(current,key,count);}
