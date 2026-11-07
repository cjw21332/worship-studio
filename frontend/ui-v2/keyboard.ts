export function rove(index:number,key:string,length:number,vertical=false){if(!length)return 0;if(key==='Home')return 0;if(key==='End')return length-1;const previous=vertical?'ArrowUp':'ArrowLeft',next=vertical?'ArrowDown':'ArrowRight';return key===previous?(index-1+length)%length:key===next?(index+1)%length:index;}
export function editsAllowed(mode:'prepare'|'present'){return mode==='prepare';}
export const editActions=new Set(['new','open','recent','name','template-open','template-sunday','template-save','quick-edit','recover','undo','redo','item','add','remove','duplicate','reorder','import','delete','merge']);
export function modeAllows(mode:'prepare'|'present',action:string){return editsAllowed(mode)||!editActions.has(action);}
