import type {HelpTarget} from './registry';
export function helpAttributes(help:HelpTarget){
 if(typeof help==='string')return {'data-help-id':help};
 if(!help.skip.trim())throw new Error('A skipped control needs a reason.');
 return {'data-help-skip':help.skip};
}
