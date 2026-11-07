import {z} from 'zod';
import JSZip from 'jszip';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {mkdir,readFile,writeFile,copyFile,stat,lstat,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import type {Item} from './database';
import type {Slide,VideoSlide} from './presentation';

const run=promisify(execFile);
export const imageExtensions=['png','jpg','jpeg','webp','bmp','gif'];
export const videoExtensions=['mp4','webm','ogv','ogg','mov','m4v','mkv','avi','wmv'];
export const fitSchema=z.enum(['contain','cover','fill']);
const assetUrl=z.string().regex(/^studio-media:\/\/asset\/[0-9a-f-]{36}$/i);
const colour=z.string().regex(/^#[0-9a-f]{3,8}$/i);
export const MediaStyle=z.object({fontFamily:z.string().max(200).optional(),minFontSize:z.number().min(8).max(160).optional(),maxFontSize:z.number().min(8).max(240).optional(),color:colour.optional(),align:z.enum(['left','center','right','justify']).optional(),background:colour.optional(),backgroundImage:assetUrl.optional(),backgroundVideo:assetUrl.optional(),fit:fitSchema.optional(),margin:z.number().min(0).max(40).optional()});
export const VideoOptions=z.object({start:z.number().finite().min(0).max(86400).default(0),end:z.number().finite().min(0).max(86400).optional(),loop:z.boolean().default(false),muted:z.boolean().default(false),volume:z.number().min(0).max(1).default(1),brightness:z.number().min(0).max(2).default(1),contrast:z.number().min(0).max(2).default(1)}).refine(v=>v.end===undefined||v.end>v.start,{message:'Trim end must be later than trim start.'});
export type VideoOptions=z.infer<typeof VideoOptions>;
export const normalizeVideoOptions=(input:unknown)=>VideoOptions.parse(input);
export const AssetOptions=z.object({fit:fitSchema.default('contain'),duration:z.number().min(1).max(86400).default(8),background:z.boolean().default(false),video:VideoOptions.optional()});
export type AssetOptions=z.infer<typeof AssetOptions>;
export type MediaAsset={id:string;name:string;title:string;kind:'image'|'video';thumbnail?:string;checksum?:string;createdAt?:string;options:AssetOptions};
export const CountdownOptions=z.object({mode:z.enum(['duration','target']),seconds:z.number().finite().min(0).max(604800).optional(),targetTime:z.string().max(50).optional(),message:z.string().max(300).default('Service starts in'),format:z.enum(['mm:ss','hh:mm:ss']).default('mm:ss')}).superRefine((v,ctx)=>{if(v.mode==='duration'&&v.seconds===undefined)ctx.addIssue({code:'custom',message:'Enter the countdown duration.'});if(v.mode==='target'&&(!v.targetTime||!Number.isFinite(Date.parse(v.targetTime))))ctx.addIssue({code:'custom',message:'Choose a valid target time.'});});
export type CountdownOptions=z.infer<typeof CountdownOptions>;
export const MediaPage=z.object({text:z.string().max(100000).default(''),imageId:z.string().uuid().optional(),videoId:z.string().uuid().optional(),notes:z.string().max(100000).default(''),duration:z.number().min(1).max(86400).default(8),style:MediaStyle.optional(),video:VideoOptions.optional(),countdown:CountdownOptions.optional(),transition:z.object({name:z.enum(['none','fade','push','zoom','flip']),duration:z.number().min(0).max(5000),reduceMotion:z.boolean().default(false)}).optional()});
export type MediaPage=z.infer<typeof MediaPage>;
export const MediaDocument=z.object({id:z.string().uuid().optional(),title:z.string().trim().min(1).max(200),kind:z.enum(['note','slides','slideshow','presentation','countdown','alert']),pages:z.array(MediaPage).min(1).max(1000),loop:z.boolean().default(false),autoAdvance:z.boolean().default(false),warning:z.string().max(3000).optional(),sourceChecksum:z.string().regex(/^[a-f0-9]{64}$/).optional(),createdAt:z.string().optional(),updatedAt:z.string().optional()});
export type MediaDocument=z.infer<typeof MediaDocument>;
export function normalizeDocument(input:unknown):MediaDocument{
 if(!input||typeof input!=='object')throw new Error('Enter a media document.');
 const source=input as Record<string,unknown>,pages=source.pages??(typeof source.text==='string'?source.text.split(/\r?\n\s*\r?\n/).filter(s=>s.trim()).map(text=>({text})):[]);
 const parsed=MediaDocument.parse({...source,pages}),now=new Date().toISOString();
 if(parsed.pages.some(p=>!p.text.trim()&&!p.imageId&&!p.videoId&&!p.countdown))throw new Error('Each slide needs text, an image, a video or a countdown.');
 return {...parsed,createdAt:parsed.createdAt||now,updatedAt:now};
}
export function countdownEnd(input:unknown,now=Date.now()):number{const options=CountdownOptions.parse(input);return options.mode==='duration'?now+options.seconds!*1000:Date.parse(options.targetTime!);}
export function countdownText(endsAt:number,now=Date.now(),format:'mm:ss'|'hh:mm:ss'='mm:ss'):string{const total=Math.max(0,Math.ceil((endsAt-now)/1000)),seconds=String(total%60).padStart(2,'0'),minutes=Math.floor(total/60);return format==='hh:mm:ss'?String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')+':'+seconds:String(minutes).padStart(2,'0')+':'+seconds;}
export function activateMediaSlide(slide:Slide,item?:Item,index=slide.index||0,now=Date.now()):Slide{
 const result=structuredClone(slide),countdown=item?.mediaPages?.[index]?.countdown;
 if(result.video)result.video={...result.video,playing:true,position:result.video.start||0,startedAt:now};
 if(countdown)result.countdown={endsAt:countdownEnd(countdown,now),message:countdown.message,format:countdown.format};
 return result;
}
export function nextTimedMediaSlide(item:Item,index:number):{index:number;delay:number}|null{
 if(!item.autoAdvance||!item.slides.length)return null;const next=index+1<item.slides.length?index+1:item.loop?0:null;
 if(next===null)return null;const duration=item.mediaPages?.[index]?.duration||item.durations?.[index]||8;
 return {index:next,delay:Math.max(1,Math.min(86400,duration))*1000};
}
export function patchVideoPlayback(video:VideoSlide,patch:Partial<VideoSlide>,now=Date.now()):VideoSlide{
 const start=video.start||0,end=video.end,elapsed=video.playing!==false&&video.startedAt?Math.max(0,now-video.startedAt)/1000:0;
 let position=patch.position??((video.position??start)+elapsed);if(video.loop&&end&&end>start)position=start+(Math.max(start,position)-start)%(end-start);
 position=Math.max(start,end?Math.min(end,position):position);return {...video,...patch,position,startedAt:now};
}
export function mediaMime(name:string):string{
 const extension=path.extname(name).slice(1).toLowerCase(),mime:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',bmp:'image/bmp',gif:'image/gif',mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',ogv:'video/ogg',ogg:'video/ogg',mov:'video/quicktime',mkv:'video/x-matroska',avi:'video/x-msvideo',wmv:'video/x-ms-wmv'};
 if(!mime[extension])throw new Error('Unsupported local media format.');return mime[extension];
}
export function managedAssetPath(root:string,name:string):string{
 if(path.basename(name)!==name||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.thumb)?\.[a-z0-9]+$/i.test(name))throw new Error('Invalid managed media filename.');
 mediaMime(name);return path.join(path.resolve(root),name);
}
export function validateImageBytes(bytes:Buffer,extension:string):{width:number;height:number}{
 let width=0,height=0;
 if(extension==='png'&&bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
 else if(extension==='gif'&&bytes.length>=10&&/^GIF8[79]a$/.test(bytes.subarray(0,6).toString('ascii'))){width=bytes.readUInt16LE(6);height=bytes.readUInt16LE(8);}
 else if(extension==='bmp'&&bytes.length>=26&&bytes.subarray(0,2).toString()==='BM'){width=Math.abs(bytes.readInt32LE(18));height=Math.abs(bytes.readInt32LE(22));}
 else if(['jpg','jpeg'].includes(extension)&&bytes[0]===255&&bytes[1]===216){
  let at=2;const frames=new Set([192,193,194,195,197,198,199,201,202,203,205,206,207]);
  while(at+3<bytes.length){if(bytes[at]!==255){at++;continue;}while(bytes[at]===255)at++;const marker=bytes[at++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;if(at+1>=bytes.length)break;const length=bytes.readUInt16BE(at);if(length<2||at+length>bytes.length)break;if(frames.has(marker)&&length>=7){height=bytes.readUInt16BE(at+3);width=bytes.readUInt16BE(at+5);break;}at+=length;}
 }else if(extension==='webp'&&bytes.length>=30&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'){
  const format=bytes.subarray(12,16).toString();if(format==='VP8X'){width=bytes.readUIntLE(24,3)+1;height=bytes.readUIntLE(27,3)+1;}else if(format==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=bytes.readUInt16LE(26)&16383;height=bytes.readUInt16LE(28)&16383;}else if(format==='VP8L'&&bytes[20]===47){width=1+bytes[21]+((bytes[22]&63)<<8);height=1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10);}
 }
 if(!width||!height)throw new Error('This image has an unsupported or damaged header. Export it as PNG or JPEG and import again.');
 if(width>16384||height>16384||width*height>50_000_000)throw new Error('Image dimensions exceed 16,384 pixels per side or 50 megapixels. Resize it before importing.');
 return {width,height};
}
export async function importManagedMedia(file:string,root:string,kind:'image'|'video'):Promise<MediaAsset>{
 const extension=path.extname(file).slice(1).toLowerCase();if(!(kind==='image'?imageExtensions:videoExtensions).includes(extension))throw new Error('Choose a supported '+kind+' file.');
 const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw new Error('Choose a regular local media file.');if(info.size>(kind==='image'?20_000_000:2_000_000_000))throw new Error(kind==='image'?'Image exceeds 20 MB.':'Video exceeds 2 GB.');
 let checksum:string|undefined;if(kind==='image'){const bytes=await readFile(file);validateImageBytes(bytes,extension);checksum=createHash('sha256').update(bytes).digest('hex');}
 await mkdir(root,{recursive:true});const id=randomUUID(),name=id+'.'+extension;await copyFile(file,managedAssetPath(root,name));
 return {id,name,title:path.basename(file),kind,checksum,createdAt:new Date().toISOString(),options:AssetOptions.parse({video:kind==='video'?{}:undefined})};
}
function safeXML(xml:string):any{
 if(xml.length>5_000_000)throw new Error('Presentation XML part exceeds 5 MB.');if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Presentation XML entities are not supported.');if(XMLValidator.validate(xml)!==true)throw new Error('Invalid presentation XML.');return new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',parseTagValue:false,removeNSPrefix:true}).parse(xml);
}
const array=(v:any):any[]=>v==null?[]:Array.isArray(v)?v:[v];
function xmlText(xml:string):string{
 safeXML(xml);const ordered=new XMLParser({preserveOrder:true,ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,trimValues:false}).parse(xml);
 const walk=(nodes:any[]):string=>nodes.map(node=>Object.entries(node).filter(([key])=>key!==':@').map(([key,value])=>key==='#text'?String(value):key==='br'?'\n':Array.isArray(value)?walk(value)+(key==='p'?'\n':''):'').join('')).join('');
 return walk(ordered).replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function relPath(owner:string,target:string):string{if(/^[a-z][a-z0-9+.-]*:|^[/\\]|\\/i.test(target))throw new Error('External or absolute presentation paths are unsupported.');const result=path.posix.normalize(path.posix.join(path.posix.dirname(owner),target));if(!result.startsWith('ppt/')||result.includes('../'))throw new Error('Presentation relationship leaves the document.');return result;}
export type ParsedPptx={pages:{text:string;notes:string;images:{name:string;bytes:Buffer}[]}[];warning:string};
export async function parsePptx(bytes:Buffer):Promise<ParsedPptx>{
 if(bytes.length>100_000_000)throw new Error('Presentation exceeds 100 MB.');let zip:JSZip;try{zip=await JSZip.loadAsync(bytes,{checkCRC32:false});}catch{throw new Error('Invalid or unsupported PPTX archive.');}
 const entries=Object.values(zip.files);if(entries.length>15000)throw new Error('Presentation contains too many archive entries.');let unpacked=0;
 for(const entry of entries){const size=Number((entry as any)._data?.uncompressedSize||0);unpacked+=size;if(size>30_000_000||unpacked>500_000_000)throw new Error('Presentation expands beyond the safe import limit.');const unsafe=(entry as any).unsafeOriginalName||entry.name;if(unsafe.includes('..')||unsafe.includes('\\')||unsafe.startsWith('/'))throw new Error('Unsafe path in presentation archive.');}
 const getXML=async(name:string)=>{const file=zip.file(name);return file?await file.async('string'):'';};
 const relationships=async(owner:string)=>{const base=path.posix.dirname(owner),filename=path.posix.basename(owner),xml=await getXML(base+'/_rels/'+filename+'.rels');return xml?array(safeXML(xml).Relationships?.Relationship).filter(r=>r['@TargetMode']!=='External').map(r=>({id:String(r['@Id']),type:String(r['@Type']||''),path:relPath(owner,String(r['@Target']||''))})):[];};
 const slideFiles=entries.filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f.name)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));if(!slideFiles.length||slideFiles.length>1000)throw new Error('Import a presentation containing 1–1000 slides.');
 const presentation=await getXML('ppt/presentation.xml'),rels=await relationships('ppt/presentation.xml'),order=presentation?array(safeXML(presentation).presentation?.sldIdLst?.sldId).map(row=>rels.find(r=>r.id===row['@id'])?.path).filter(Boolean) as string[]:[];
 const names=order.length===slideFiles.length?order:slideFiles.map(f=>f.name),pages:ParsedPptx['pages']=[],imageCache=new Map<string,Buffer>();let imageCount=0;
 for(const name of names){const xml=await getXML(name);if(!xml)throw new Error('Presentation contains a missing slide.');const relations=await relationships(name),imageIds=[...xml.matchAll(/\b(?:r:)?embed\s*=\s*["']([^"']+)["']/g)].map(m=>m[1]),images:ParsedPptx['pages'][number]['images']=[];
  for(const relation of relations.filter(r=>imageIds.includes(r.id))){const file=zip.file(relation.path);if(!file||!imageExtensions.includes(path.posix.extname(relation.path).slice(1).toLowerCase()))continue;if(++imageCount>1000)throw new Error('Presentation contains more than 1,000 image placements. Export slides as PNG files instead.');const data=imageCache.get(relation.path)||await file.async('nodebuffer');if(data.length>20_000_000)throw new Error('An embedded presentation image exceeds 20 MB.');validateImageBytes(data,path.posix.extname(relation.path).slice(1).toLowerCase());imageCache.set(relation.path,data);images.push({name:relation.path,bytes:data});}
  const note=relations.find(r=>r.type.endsWith('/notesSlide')||r.type==='notesSlide'),notesXML=note?await getXML(note.path):'';
  const text=xmlText(xml),notes=notesXML?xmlText(notesXML):'';if(text.length>100000||notes.length>100000)throw new Error('A slide or its speaker notes exceeds 100,000 characters.');pages.push({text,notes,images});
 }
 return {pages,warning:'Simplified PPTX import: text and embedded images are extracted. Original layouts, fonts, animation, video and transitions are flattened or omitted. For exact slides, install PowerPoint or LibreOffice with pdftoppm, or export PNG images. Keynote files must first be exported as PowerPoint.'};
}
export type MediaProgress={operation:string;completed:number;total:number;message:string};
export type ConvertedDeck={mode:'images'|'simplified';checksum:string;warning?:string;pages:{text:string;notes:string;images:string[]}[]};
export async function findMediaTool(tool:'ffmpeg'|'soffice'|'pdftoppm'):Promise<string|null>{
 const candidates=tool==='soffice'?[path.join(process.env.ProgramFiles||'C:/Program Files','LibreOffice/program/soffice.exe'),path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','LibreOffice/program/soffice.exe')]:[];
 for(const candidate of candidates)try{await access(candidate);return candidate;}catch{/* Try PATH next. */}
 try{const result=await run(process.platform==='win32'?'where.exe':'which',[tool],{timeout:5000,windowsHide:true,maxBuffer:100000});return result.stdout.split(/\r?\n/).find(Boolean)||null;}catch{return null;}
}
export async function convertPresentation(file:string,root:string,scriptPath:string,progress?:(p:MediaProgress)=>void,forceFallback=false):Promise<ConvertedDeck>{
 const info=await lstat(file),extension=path.extname(file).toLowerCase();if(!info.isFile()||info.isSymbolicLink()||!['.pptx','.ppt'].includes(extension))throw new Error('Choose a local PPT or PPTX file. Keynote must be exported to PowerPoint first.');if(info.size>100_000_000)throw new Error('Presentation exceeds 100 MB.');
 const bytes=await readFile(file),checksum=createHash('sha256').update(bytes).digest('hex'),cache=path.join(root,'conversions',checksum);await mkdir(cache,{recursive:true});const manifest=path.join(cache,'manifest.json');
 try{const saved=JSON.parse(await readFile(manifest,'utf8')) as ConvertedDeck;if(saved.checksum===checksum&&saved.pages.length&&saved.pages.every(p=>p.images.every(name=>path.basename(name)===name))){await Promise.all(saved.pages.flatMap(p=>p.images.map(name=>access(path.join(cache,name)))));return {...saved,pages:saved.pages.map(p=>({...p,images:p.images.map(name=>path.join(cache,name))}))};}}catch{/* A missing/incomplete cache is rebuilt. */}
 progress?.({operation:'presentation',completed:0,total:100,message:'Reading presentation and speaker notes…'});
 const parsed=extension==='.pptx'?await parsePptx(bytes):undefined;let converted:string[]=[];
 if(!forceFallback){const [office,pdf]=await Promise.all([findMediaTool('soffice'),findMediaTool('pdftoppm')]);
  if(office&&pdf)try{progress?.({operation:'presentation',completed:20,total:100,message:'Rendering slides with LibreOffice…'});await run(office,['-env:UserInstallation='+pathToFileURL(path.join(cache,'office-profile')).href,'--headless','--nologo','--nodefault','--norestore','--convert-to','pdf','--outdir',cache,file],{timeout:120000,windowsHide:true,maxBuffer:1000000});const output=path.join(cache,path.basename(file,extension)+'.pdf');await access(output);await run(pdf,['-png','-r','120',output,path.join(cache,'slide')],{timeout:120000,windowsHide:true,maxBuffer:1000000});converted=(await readdir(cache)).filter(name=>/^slide-\d+\.png$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}catch{/* Try PowerPoint, then offer simplified extraction. */}
  if(!converted.length&&process.platform==='win32')try{progress?.({operation:'presentation',completed:35,total:100,message:'Rendering slides with PowerPoint…'});await run('powershell.exe',['-NoProfile','-NonInteractive','-File',scriptPath,'-InputFile',file,'-OutputDirectory',cache],{timeout:120000,windowsHide:true,maxBuffer:1000000});converted=(await readdir(cache)).filter(name=>/^slide\d+\.png$/i.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}catch{/* Simplified fallback is explicit. */}
 }
 if(!converted.length&&!parsed)throw new Error('PPT conversion needs Microsoft PowerPoint, or LibreOffice and pdftoppm. Export this legacy presentation to PPTX or PNG first.');
 let result:ConvertedDeck;
 if(converted.length){if(converted.length>1000)throw new Error('Import at most 1,000 slides.');result={mode:'images',checksum,warning:'Presentation imported as still images. Animations, embedded video and transitions are flattened.',pages:converted.map((image,index)=>({text:'',notes:parsed?.pages[index]?.notes||'',images:[image]}))};}
 else{const pages:ConvertedDeck['pages']=[];for(const [index,page] of parsed!.pages.entries()){const images:string[]=[];for(const [n,image] of page.images.entries()){const name='embedded-'+index+'-'+n+path.extname(image.name);await writeFile(path.join(cache,name),image.bytes);images.push(name);}pages.push({text:page.text||(!images.length?'Slide '+(index+1):''),notes:page.notes,images});}result={mode:'simplified',checksum,warning:parsed!.warning,pages};}
 await writeFile(manifest,JSON.stringify(result),'utf8');progress?.({operation:'presentation',completed:100,total:100,message:'Presentation ready.'});return {...result,pages:result.pages.map(p=>({...p,images:p.images.map(name=>path.join(cache,name))}))};
}
export async function transcodeVideo(input:string,root:string,progress?:(p:MediaProgress)=>void):Promise<string>{
 const ffmpeg=await findMediaTool('ffmpeg');if(!ffmpeg)throw new Error('FFmpeg is not installed. Install it locally or convert the video to H.264/AAC MP4, then import it.');const source=await lstat(input);if(!source.isFile()||source.isSymbolicLink()||source.size>2_000_000_000)throw new Error('Choose a managed video smaller than 2 GB.');const output=path.join(root,randomUUID()+'.mp4');progress?.({operation:'transcode',completed:0,total:1,message:'Converting video locally with FFmpeg…'});try{await run(ffmpeg,['-nostdin','-hide_banner','-y','-i',input,'-map','0:v:0','-map','0:a?','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',output],{timeout:600000,windowsHide:true,maxBuffer:2000000});progress?.({operation:'transcode',completed:1,total:1,message:'Video conversion complete.'});return output;}catch{throw new Error('FFmpeg could not convert this video. Check the file in a local player or export H.264/AAC MP4.');}
}
