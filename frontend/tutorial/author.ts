import type {ControlHelp} from './registry';
import type {HelpShortcutReference} from '../shortcuts';
import {deskT} from '../desk-i18n';

/** The explanations passed here are authored, never derived from control names. */
export function authored(id:string,name:string,what:string,how:string,filWhat:string,filHow:string,shortcuts:readonly HelpShortcutReference[]=[],warning?:{en:string;fil:string}):ControlHelp{
 return{id,area:id.split('.')[0],text:{en:{name,what,how:[how],...(warning?{warning:warning.en}:{})},fil:{name:deskT('fil',name),what:filWhat,how:[filHow],...(warning?{warning:warning.fil}:{})}},shortcuts,related:[],filipinoReviewed:false};
}
