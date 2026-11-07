import type {BrowserWindow,IpcMainInvokeEvent} from 'electron';
import {Worker} from 'node:worker_threads';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {createBibleStore} from './bible-store';
import {formatReference,navigatePassage,paginatePassage,parseReference,type BibleImport,type BibleImportOptions,type BibleImportPreview,type BiblePage} from './bible';
import {preview,takeLive,type Presentation,type Slide} from './presentation';

export type BibleImportSummary=Pick<BibleImportPreview,'name'|'abbreviation'|'language'|'copyright'|'sample'|'total'|'unmappedBooks'|'bookMappings'>;
export type BibleWorkerRequest={file:string;mode:'preview'|'commit';options?:BibleImportOptions;expectedDigest?:string};
export type BibleWorkerResult={digest:string;preview?:BibleImportSummary;document?:BibleImport};
type Context={
 store:{bible:ReturnType<typeof createBibleStore>;addSlides:(title:string,slides:string[],metadata?:Record<string,unknown>)=>unknown};
 win:BrowserWindow;resourcesRoot:string;getState:()=>Presentation;setState:(state:Presentation)=>unknown;render:()=>Promise<unknown>|void;
 workerPath?:string;chooseImportFile?:()=>Promise<string|null>;parseImport?:(request:BibleWorkerRequest)=>Promise<BibleWorkerResult>;
 prepareSlide?:(slide:Slide)=>Slide;
 onLive?:(page:BiblePage)=>void;
};
const uuid=z.string().uuid();
const displayInput={mode:z.enum(['single','parallel','stacked','line-by-line']).optional(),versesPerSlide:z.number().int().min(1).max(20).optional(),showVerseNumbers:z.boolean().optional()};
const passageInput=z.object({translationIds:z.array(uuid).min(1).max(3),reference:z.string().trim().min(1).max(200),...displayInput,index:z.number().int().min(0).max(10000).optional(),selectedIndices:z.array(z.number().int().min(0).max(10000)).min(1).max(10000).optional(),takeLive:z.boolean().optional()}).strict();
export function combineBiblePages(pages:BiblePage[],indices:number[]):BiblePage{
 const selected=[...new Set(indices)].sort((a,b)=>a-b).map(i=>pages[i]);
 if(!selected.length||selected.some(page=>!page))throw new Error('The selected verses changed. Find the passage again.');
 const first=selected[0];
 return {...first,reference:selected.map(p=>p.reference).join(' · '),rows:selected.flatMap(p=>p.rows),continuation:undefined,columns:first.columns.map((column,i)=>({...column,text:selected.map(page=>page.columns[i]?.text||'').filter(Boolean).join('\n')}))};
}
const empty=z.object({}).strict();
function inWorker(workerFile:string,request:BibleWorkerRequest):Promise<BibleWorkerResult>{
 return new Promise((resolve,reject)=>{
  const worker=new Worker(workerFile,{workerData:request,resourceLimits:{maxOldGenerationSizeMb:512}});let settled=false;
  const finish=(error?:Error,result?:BibleWorkerResult)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(result!);};
  const timer=setTimeout(()=>finish(new Error('Bible parsing timed out. Try a smaller import file.')),30000);
  worker.once('message',(message:{ok:boolean;result?:BibleWorkerResult;error?:string})=>message.ok&&message.result?finish(undefined,message.result):finish(new Error(message.error||'Bible import failed.')));
  worker.once('error',error=>finish(error));worker.once('exit',code=>{if(!settled)finish(new Error('Bible parser stopped before finishing (code '+code+').'));});
 });
}
export function bibleHandlers(context:Context){
 const {store,win,getState,setState,render}=context,pending=new Map<string,{file:string;digest:string;createdAt:number}>();
 const parseImport=context.parseImport||((request:BibleWorkerRequest)=>inWorker(context.workerPath||path.join(context.resourcesRoot,'..','dist-electron','bible-worker.cjs'),request));
 const chooseImportFile=context.chooseImportFile||(async()=>{const {dialog}=await import('electron');const result=await dialog.showOpenDialog(win,{title:'Import Bible translation',properties:['openFile'],filters:[{name:'Bible (XML, text or JSON)',extensions:['xml','txt','tsv','json']}]});return result.canceled?null:result.filePaths[0];});
 const initial=()=>({translations:store.bible.translations(),preferences:store.bible.preferences(),favorites:store.bible.favorites(),recent:store.bible.recent()});
 const passage=(payload:unknown)=>{
  const input=passageInput.parse(payload),reference=parseReference(input.reference),preferences=store.bible.preferences();
  const settings={mode:input.mode??preferences.mode,versesPerSlide:input.versesPerSlide??preferences.versesPerSlide,showVerseNumbers:input.showVerseNumbers??preferences.showVerseNumbers};
  const rows=store.bible.queryPassage(input.translationIds,reference),pages=paginatePassage(rows,settings);
  return {input,reference,pages};
 };
 const pageText=(page:BiblePage)=>page.columns.map(column=>column.text+'\n'+column.label).join('\n\n')+'\n'+page.reference;
 return {
  'bible:action':async(_event:IpcMainInvokeEvent,value:unknown):Promise<unknown>=>{
   const {action,payload}=z.object({action:z.enum(['initial','passage','preview','add','search','navigate','favorite','remove-favorite','remove-passage','translation-settings','preferences','import-preview','import-commit','import-cancel']),payload:z.unknown().optional()}).strict().parse(value);
   if(action==='initial'){empty.parse(payload??{});return initial();}
   if(action==='passage'||action==='preview'||action==='add'||action==='favorite'){
    const result=passage(payload),reference=formatReference(result.reference);
    if(action==='passage')return {pages:result.pages,reference};
    if(action==='favorite')return {key:store.bible.rememberPassage(result.reference,result.input.translationIds,true)};
    store.bible.rememberPassage(result.reference,result.input.translationIds);
    const chosen=result.input.selectedIndices?combineBiblePages(result.pages,result.input.selectedIndices):null;
    if(action==='add'){const pages=chosen?[chosen]:result.pages;return {itemId:store.addSlides(reference,pages.map(pageText),{kind:'bible',biblePages:pages,notes:reference,reference:result.reference,translationIds:result.input.translationIds})};}
    const index=result.input.index??0,page=chosen??result.pages[index];if(!page)throw new Error('This Bible slide is no longer available. Preview the passage again.');
    const makeSlide=(page:BiblePage,index:number):Slide=>{const slide={title:page.reference,text:pageText(page),bible:page,index};return context.prepareSlide?.(slide)??slide;};
    const next=preview(getState(),makeSlide(page,index));
    if(result.input.takeLive){const live=takeLive(next);live.next=!chosen&&result.pages[index+1]?makeSlide(result.pages[index+1],index+1):null;setState(live);if(!live.freeze)context.onLive?.(page);}else setState(next);
    await render();
    return {pages:result.pages,reference,state:getState()};
   }
   if(action==='search'){
    const input=z.object({translationId:uuid,query:z.string().trim().min(1).max(200)}).strict().parse(payload);return store.bible.search(input.translationId,input.query);
   }
   if(action==='navigate'){
    const input=z.object({translationId:uuid,reference:z.string().trim().min(1).max(200),unit:z.enum(['verse','chapter']),direction:z.union([z.literal(1),z.literal(-1)])}).strict().parse(payload);
    const ref=navigatePassage(store.bible.verses(input.translationId),parseReference(input.reference),input.unit,input.direction);return {reference:formatReference(ref)};
   }
   if(action==='remove-passage'){const input=z.object({key:z.string().min(1).max(500)}).strict().parse(payload);store.bible.removePassage(input.key);return initial();}
   if(action==='remove-favorite'){const input=z.object({key:z.string().min(1).max(500)}).strict().parse(payload);store.bible.removeFavorite(input.key);return initial();}
   if(action==='translation-settings'){
    const input=z.object({translationId:uuid,settings:z.object({name:z.string().trim().min(1).max(200).optional(),abbreviation:z.string().trim().min(1).max(40).optional(),language:z.string().max(40).optional(),fontFamily:z.string().max(200).optional(),copyright:z.string().max(2000).optional()}).strict()}).strict().parse(payload);store.bible.setTranslation(input.translationId,input.settings);return initial();
   }
   if(action==='preferences')return store.bible.setPreferences(payload);
   if(action==='import-cancel'){empty.parse(payload??{});pending.clear();return {canceled:true};}
   if(action==='import-preview'){
    empty.parse(payload??{});const file=await chooseImportFile();if(!file)return null;
    const parsed=await parseImport({file,mode:'preview'});if(!parsed.preview)throw new Error('Bible preview did not finish. Choose the file again.');
    const token=randomUUID();pending.clear();pending.set(token,{file,digest:parsed.digest,createdAt:Date.now()});return {token,...parsed.preview};
   }
   const input=z.object({token:uuid,name:z.string().trim().min(1).max(200).optional(),bookMappings:z.record(z.string().max(100),z.number().int().min(1).max(66)).optional(),permissionConfirmed:z.literal(true)}).strict().parse(payload);
   const selected=pending.get(input.token);if(!selected||Date.now()-selected.createdAt>10*60*1000){pending.delete(input.token);throw new Error('Bible import preview expired. Choose the file again.');}
   // Consume the approval before awaiting the worker; concurrent/replayed calls cannot import twice.
   pending.delete(input.token);
   const parsed=await parseImport({file:selected.file,mode:'commit',expectedDigest:selected.digest,options:{name:input.name,bookMappings:input.bookMappings}});
   if(!parsed.document)throw new Error('Bible import did not finish.');const imported=store.bible.importBibleDocument(parsed.document);pending.delete(input.token);return {...imported,...initial()};
  }
 };
}
