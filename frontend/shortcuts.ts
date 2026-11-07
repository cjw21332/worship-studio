import type{ClickerSettings}from'../backend/settings';
export type ShortcutAction='next'|'previous'|'blackout'|'clear'|'logo'|'live'|'escape'|'save'|'search';
export type HelpShortcutReference=ShortcutAction|'undo'|'redo'|'mode'|'menubar'|'panes'|'tabs'|'quickBible'|'preview'|'sendSelected'|'saveSong'|'saveSongAndAdd'|'moveUp'|'moveDown'|'dialogLive';
export const shortcuts=[['Ctrl+Enter','Save song'],['Ctrl+Shift+Enter','Save and add to service'],['F10 / Alt','Focus main menu'],['Alt+F / S / L / O / V / H','Open menu'],['Ctrl+Shift+M','Toggle Prepare or Present mode'],['Space / Right / PageDown','Next slide'],['Left / PageUp','Previous slide'],['B / .','Toggle blackout'],['C','Toggle clear text'],['L','Toggle logo'],['F5','Go Live'],['Esc','Clear selection'],['Ctrl+S','Save service'],['Ctrl+Z','Undo'],['Ctrl+Y','Redo'],['Ctrl+F','Focus library search'],['F6 / Shift+F6','Cycle panes'],['Alt+Up / Alt+Down','Move service item'],['Ctrl+1..6','Switch library tab'],['Ctrl+Shift+B','Focus Quick Bible'],['Enter','Preview selected slide'],['Shift+Enter / Double-click','Send selected slide live']];
const defaultClicker:ClickerSettings={enabled:true,mappings:{pagedown:'next',pageup:'previous','.':'blackout',b:'blackout',f5:'live'}};
export function shortcutFor(event:{key:string;ctrlKey:boolean;metaKey:boolean;altKey:boolean},editing=false,clicker:ClickerSettings=defaultClicker):ShortcutAction|null{
 const key=event.key.toLowerCase();
 if(event.ctrlKey||event.metaKey)return key==='s'?'save':key==='f'?'search':null;
 if(editing||event.altKey)return null;
 if(clicker.enabled&&Object.prototype.hasOwnProperty.call(clicker.mappings,key))return clicker.mappings[key];
 return ({' ':'next',arrowright:'next',arrowleft:'previous',b:'blackout',c:'clear',l:'logo',f5:'live',escape:'escape'} as Record<string,ShortcutAction>)[key]??null;
}

/** Resolve displayed presentation keys through the same rules as keyboard input. */
export function resolvedShortcuts(clicker:ClickerSettings):string[][]{
 const labels:Partial<Record<ShortcutAction,string>>={next:'Next slide',previous:'Previous slide',blackout:'Toggle blackout',clear:'Toggle clear text',logo:'Toggle logo',live:'Go Live'};
 const display:Record<string,string>={' ':'Space',arrowright:'Right',arrowleft:'Left',pagedown:'PageDown',pageup:'PageUp',f5:'F5'};
 const candidates=[...new Set([' ','arrowright','arrowleft','pagedown','pageup','b','.','c','l','f5',...Object.keys(clicker.mappings)])];
 const resolved=new Map<string,string[]>();
 for(const key of candidates){const action=shortcutFor({key,ctrlKey:false,metaKey:false,altKey:false},false,clicker);const label=action&&labels[action];if(label){const keys=resolved.get(label)||[];keys.push(display[key]||key.toUpperCase());resolved.set(label,keys);}}
 return shortcuts.map(([keys,label])=>[resolved.has(label)?resolved.get(label)!.join(' / '):Object.values(labels).includes(label)?'':keys,label]);
}

/** Help refers to action names; key labels always come from the live resolver. */
export function helpShortcutKeys(references:readonly HelpShortcutReference[],clicker:ClickerSettings):string[]{
 const labels:Record<HelpShortcutReference,string>={next:'Next slide',previous:'Previous slide',blackout:'Toggle blackout',clear:'Toggle clear text',logo:'Toggle logo',live:'Go Live',escape:'Clear selection',save:'Save service',search:'Focus library search',undo:'Undo',redo:'Redo',mode:'Toggle Prepare or Present mode',menubar:'Focus main menu',panes:'Cycle panes',tabs:'Switch library tab',quickBible:'Focus Quick Bible',preview:'Preview selected slide',sendSelected:'Send selected slide live',saveSong:'Save song',saveSongAndAdd:'Save and add to service',moveUp:'Move service item',moveDown:'Move service item',dialogLive:'Send selected slide live'};
 const rows=resolvedShortcuts(clicker);
 const single:Partial<Record<HelpShortcutReference,number>>={moveUp:0,moveDown:1,dialogLive:0};
 return references.flatMap(reference=>{const keys=rows.find(([,label])=>label===labels[reference])?.[0].split(' / ').filter(Boolean)||[],index=single[reference];return index===undefined?keys:keys.slice(index,index+1);});
}
