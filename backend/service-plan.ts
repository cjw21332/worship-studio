import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Item} from './database';
import {SongInput,normalizeSong} from './songs';
import {MediaPage} from './media';
import {SlideStyleSchema,TransitionSchema,ThemeConfigSchema} from './themes';
const uuid=z.string().uuid();
const text=z.string().max(100000);
const column=z.object({translationId:uuid,label:z.string().max(200),text,copyright:z.string().max(2000),fontFamily:z.string().max(200).optional(),missing:z.boolean().default(false)});
const biblePage=z.object({title:z.string().max(200),reference:z.string().max(200),mode:z.enum(['single','parallel','stacked','line-by-line']),showVerseNumbers:z.boolean(),columns:z.array(column).min(1).max(3),rows:z.array(z.object({bookId:z.number().int().min(1).max(66),book:z.string().max(100),chapter:z.number().int().min(1).max(200),verse:z.number().int().min(1).max(1000),columns:z.array(column).min(1).max(3)})).min(1).max(100),continuation:z.object({part:z.number().int().min(1),total:z.number().int().min(1)}).optional()});
const mediaPage=MediaPage;
export const ServiceItemSchema=z.object({
 id:uuid,position:z.number().int().min(0),title:z.string().trim().min(1).max(200),slides:z.array(text).min(1).max(10000),
 kind:z.string().max(40).optional(),sourceId:uuid.optional(),notes:text.optional(),stageSlides:z.array(text).max(10000).optional(),sectionIds:z.array(z.string().max(100)).max(10000).optional(),songSnapshot:SongInput.transform(v=>normalizeSong(v)).optional(),
 biblePages:z.array(biblePage).max(10000).optional(),mediaPages:z.array(mediaPage).max(10000).optional(),mediaDocumentId:uuid.optional(),
 autoAdvance:z.boolean().optional(),loop:z.boolean().optional(),durations:z.array(z.number().min(.1).max(86400)).max(10000).optional(),duration:z.number().min(0).max(86400).optional(),colorTag:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
 themeId:z.string().max(100).optional(),backgroundId:uuid.optional(),transition:TransitionSchema.optional(),style:SlideStyleSchema.optional(),slideStyles:z.array(SlideStyleSchema).max(10000).optional(),slideTransitions:z.array(TransitionSchema).max(10000).optional(),warning:z.string().max(3000).optional(),alert:z.object({text:z.string().max(2000),scrolling:z.boolean(),seconds:z.number().min(0).max(86400)}).optional(),placeholder:z.boolean().optional()
});
export type ServiceItem=z.infer<typeof ServiceItemSchema>;
const serviceSettings=z.object({themes:ThemeConfigSchema.optional(),themeId:z.string().max(100).optional(),bible:z.object({translationIds:z.array(uuid).max(3),mode:z.enum(['single','parallel','stacked','line-by-line']),versesPerSlide:z.number().int().min(1).max(20),showVerseNumbers:z.boolean()}).optional()}).default({});
export const ServiceFileSchema=z.object({format:z.literal('worship-studio-service'),version:z.literal(2),name:z.string().trim().min(1).max(200),items:z.array(ServiceItemSchema).max(5000),settings:serviceSettings,savedAt:z.string().max(50).optional()}).refine(s=>new Set(s.items.map(i=>i.id)).size===s.items.length,'Service item IDs must be unique.');
export type ServiceFile=z.infer<typeof ServiceFileSchema>;
export function parseService(input:unknown):ServiceFile{
 const legacy=z.object({format:z.literal('worship-studio-service-v1'),items:z.array(z.object({title:z.string().trim().min(1).max(200),slides:z.array(z.string().min(1).max(100000)).min(1).max(1000)})).max(5000)}).safeParse(input);
 if(legacy.success)return {format:'worship-studio-service',version:2,name:'Imported service',items:legacy.data.items.map((i,position)=>({...i,id:randomUUID(),position})),settings:{}};
 if(input&&typeof input==='object'&&'version'in input&&Number(input.version)>2)throw new Error('This service was made by a newer Worship Studio version.');
 return ServiceFileSchema.parse(input);
}
export function snapshotService(items:Item[],name='Untitled service',settings:ServiceFile['settings']={}):ServiceFile{
 return parseService({format:'worship-studio-service',version:2,name,items:items.map((item,position)=>({...item,position})),settings,savedAt:new Date().toISOString()});
}
export class ServiceHistory{
 private past:Item[][]=[];private future:Item[][]=[];
 capture(before:Item[],after:Item[]){if(JSON.stringify(before)===JSON.stringify(after))return;this.past.push(structuredClone(before));if(this.past.length>100)this.past.shift();this.future=[];}
 undo(current:Item[]):Item[]{const previous=this.past.pop();if(!previous)throw new Error('Nothing to undo.');this.future.push(structuredClone(current));return previous;}
 redo(current:Item[]):Item[]{const next=this.future.pop();if(!next)throw new Error('Nothing to redo.');this.past.push(structuredClone(current));return next;}
 clear(){this.past=[];this.future=[];}
 status(){return {canUndo:!!this.past.length,canRedo:!!this.future.length};}
}
export type PreflightIssue={kind:'error'|'warning';itemId?:string;message:string};
export function preflight(items:Item[],options:{armed:boolean;displayFound:boolean;missingAssetIds:string[];missingFonts:string[]}):PreflightIssue[]{
 const issues:PreflightIssue[]=[];
 if(!options.armed)issues.push({kind:'warning',message:'Audience output is not armed.'});
 if(!options.displayFound)issues.push({kind:'error',message:'The selected audience display is not connected.'});
 for(const font of options.missingFonts)issues.push({kind:'warning',message:'Missing font: '+font+'. A fallback will be used.'});
 for(const item of items){
  if(!item.slides.length||item.slides.every(s=>!s.trim())&&!item.mediaPages?.length)issues.push({kind:'error',itemId:item.id,message:item.title+': no slide content.'});
  const refs=referencedAssets([item]);
  for(const id of refs)if(options.missingAssetIds.includes(id))issues.push({kind:'error',itemId:item.id,message:item.title+': missing media '+id+'.'});
  if((item as ServiceItem).placeholder)issues.push({kind:'warning',itemId:item.id,message:item.title+': template placeholder has not been filled.'});
 }
 return issues;
}
export function referencedAssets(items:Item[]):string[]{
 const found=new Set<string>();
 const walk=(value:unknown)=>{if(typeof value==='string'){
  const match=value.match(/^(?:asset:|studio-media:\/\/asset\/)([a-f0-9-]{36})$/i);if(match&&uuid.safeParse(match[1]).success)found.add(match[1]);
 }else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(['imageId','videoId','backgroundId'].includes(key)&&typeof v==='string'&&uuid.safeParse(v).success)found.add(v);else walk(v);}};
 items.forEach(walk);return [...found];
}
export function usageCSV(rows:{title:string;serviceName:string;usedAt:string;songId?:string|null;kind?:string;reference?:string;translations?:string}[]):string{
 const field=(s:string)=>'"'+(/^[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';
 return '\uFEFFDate,Service,Title,Song ID,Content type,Reference,Translations\r\n'+rows.map(r=>[r.usedAt,r.serviceName,r.title,r.songId||'',r.kind||'song',r.reference||'',r.translations||''].map(field).join(',')).join('\r\n');
}
