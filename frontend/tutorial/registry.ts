import {PENDING_IDS} from './pending-ids';
import {FAMILY_REGISTRY} from './families';
import {MENU_REGISTRY} from './menus';
import {LIBRARY_REGISTRY} from './library';
import {SONG_REGISTRY} from './songs';
import {BIBLE_REGISTRY} from './bible';
import {MEDIA_REGISTRY} from './media';
import {SERVICE_REGISTRY} from './service';
import {PRESENTATION_REGISTRY} from './presentation';
import {QUICK_REGISTRY} from './quick-send';
import {registerDeskCatalog,deskT} from '../desk-i18n';
import type {HelpShortcutReference} from '../shortcuts';
/** Stable identifiers and localizable content for operator control help. */
export type HelpLocale='en'|'fil';
export type HelpText={name:string;what:string;how:readonly string[];warning?:string};
export type ControlHelp={id:string;area:string;text:Record<HelpLocale,HelpText>;shortcuts:readonly HelpShortcutReference[];related:readonly string[];filipinoReviewed:false;family?:boolean;parameters?:readonly string[];conditional?:string};

// This registry is intentionally incomplete until the live coverage audit passes.
export const AUTHORED_REGISTRY={
 'common.close':{id:'common.close',area:'common',text:{
  en:{name:'Close',what:'Closes this window or panel.',how:['Choose "Close" to return.']},
  fil:{name:'Isara',what:'Isinasara ang window o panel na ito.',how:['Piliin ang "Isara" upang bumalik.']}
 },shortcuts:[],related:[],filipinoReviewed:false},
 'layout.librarySplitter':{id:'layout.librarySplitter',area:'layout',text:{en:{name:'Resize Library',what:'Changes the Library width.',how:['Drag the divider or use the arrow keys.']},fil:{name:'Baguhin ang lapad ng Library',what:'Binabago nito ang lapad ng Library.',how:['I-drag ang divider o gamitin ang mga arrow key.']}},shortcuts:[],related:[],filipinoReviewed:false},
 'layout.presentationSplitter':{id:'layout.presentationSplitter',area:'layout',text:{en:{name:'Resize Presentation',what:'Changes the Presentation width.',how:['Drag the divider or use the arrow keys.']},fil:{name:'Baguhin ang lapad ng Presentation',what:'Binabago nito ang lapad ng Presentation.',how:['I-drag ang divider o gamitin ang mga arrow key.']}},shortcuts:[],related:[],filipinoReviewed:false},
 'layout.serviceSplitter':{id:'layout.serviceSplitter',area:'layout',text:{en:{name:'Resize Service list and Slides',what:'Changes the space given to the service list and slides.',how:['Drag the divider or use the arrow keys.']},fil:{name:'Baguhin ang laki ng Service list at Slides',what:'Binabago nito ang espasyo para sa service list at mga slide.',how:['I-drag ang divider o gamitin ang mga arrow key.']}},shortcuts:[],related:[],filipinoReviewed:false}
} as const satisfies Record<string,ControlHelp>;
export const REGISTRY={...PENDING_IDS,...AUTHORED_REGISTRY,...FAMILY_REGISTRY,...MENU_REGISTRY,...LIBRARY_REGISTRY,...SONG_REGISTRY,...BIBLE_REGISTRY,...MEDIA_REGISTRY,...SERVICE_REGISTRY,...PRESENTATION_REGISTRY,...QUICK_REGISTRY};
export type HelpId=keyof typeof REGISTRY;
export type HelpTarget=HelpId|{skip:string};
export const controlRegistry:readonly ControlHelp[]=[...Object.values(AUTHORED_REGISTRY),...Object.values(FAMILY_REGISTRY),...Object.values(MENU_REGISTRY),...Object.values(LIBRARY_REGISTRY),...Object.values(SONG_REGISTRY),...Object.values(BIBLE_REGISTRY),...Object.values(MEDIA_REGISTRY),...Object.values(SERVICE_REGISTRY),...Object.values(PRESENTATION_REGISTRY),...Object.values(QUICK_REGISTRY)];

export const controlHelpById=new Map(controlRegistry.map(entry=>[entry.id,entry]));
const catalog:Record<HelpLocale,Record<string,string>>={en:{},fil:{}};
for(const entry of controlRegistry)for(const locale of ['en','fil'] as const){const text=entry.text[locale],base='tutorial.'+entry.id;catalog[locale][base+'.name']=text.name;catalog[locale][base+'.what']=text.what;text.how.forEach((step,index)=>catalog[locale][base+'.how.'+index]=step);if(text.warning)catalog[locale][base+'.warning']=text.warning;}
registerDeskCatalog(catalog);
export function helpText(id:string,locale:HelpLocale):HelpText|undefined{const entry=controlHelpById.get(id);if(!entry)return;const base='tutorial.'+id;return{name:deskT(locale,base+'.name'),what:deskT(locale,base+'.what'),how:entry.text[locale].how.map((_,index)=>deskT(locale,base+'.how.'+index)),...(entry.text[locale].warning?{warning:deskT(locale,base+'.warning')}:{})};}
