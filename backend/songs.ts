import{cleanSongText,cleanSongLyrics,normalizedAuthors,normalizedTags,normalizedTitleKey,lyricHash}from'./song-normalize';
import {z} from 'zod';
import {XMLParser,XMLValidator} from 'fast-xml-parser';

export const SectionType=z.enum(['verse','chorus','bridge','prechorus','tag','intro','outro','end']);
export const SectionSchema=z.object({id:z.string().min(1).max(100),type:SectionType,label:z.string().min(1).max(100),lines:z.array(z.string().max(100000)).min(1).max(10000)});
export type Section=z.infer<typeof SectionSchema>;
export const SongInput=z.object({
 title:z.string().trim().min(1).max(200),lyrics:z.string().max(100000).default(''),author:z.string().max(30200).default(''),copyright:z.string().max(500).default(''),
 authors:z.array(z.string().trim().min(1).max(300)).max(100).default([]),publisher:z.string().max(500).default(''),ccliNumber:z.string().max(50).default(''),key:z.string().max(30).default(''),tempo:z.number().min(0).max(999).default(0),
 tags:z.array(z.string().trim().min(1).max(100)).max(100).default([]),language:z.string().max(50).default('en'),sections:z.array(SectionSchema).max(1000).default([]),arrangement:z.array(z.string().max(100)).max(10000).default([]),
 notes:z.string().max(100000).default(''),linesPerSlide:z.union([z.literal(2),z.literal(3),z.literal(4),z.literal(6)]).optional(),createdAt:z.string().max(50).optional(),updatedAt:z.string().max(50).optional(),backgroundId:z.string().max(200).optional(),themeId:z.string().max(200).optional()
});
export type SongInput=z.input<typeof SongInput>;
export type SongContent=z.infer<typeof SongInput> & {createdAt:string;updatedAt:string};
export type Song=SongContent & {id:string;usageCount:number;lastUsed:string|null};
export type SongSlide={text:string;stageText:string;sectionId:string;label:string};

const sectionNames:Record<string,Section['type']>={v:'verse',verse:'verse',c:'chorus',chorus:'chorus',b:'bridge',bridge:'bridge',p:'prechorus',pre:'prechorus',prechorus:'prechorus',t:'tag',tag:'tag',i:'intro',intro:'intro',o:'outro',outro:'outro',e:'end',end:'end'};
const headerPattern=/^\s*(?:\[\s*)?(verse|chorus|bridge|pre(?:\s*-\s*|\s+)?chorus|pre|tag|intro|outro|end|[vcbptioe])\s*(\d*)\s*\]?\s*:?\s*$/i;
export function isSectionHeader(line:string):boolean{return headerPattern.test(line);}
export function parseSections(lyrics:string):Section[]{
 const sections:Section[]=[];let current:Section|null=null;
 const start=(type:Section['type'],label:string)=>{current={id:'section-'+(sections.length+1),type,label,lines:[]};sections.push(current);};
 for(const raw of lyrics.replace(/\r\n?/g,'\n').split('\n')){
  const match=raw.match(headerPattern);
  if(match){const type=sectionNames[match[1].toLowerCase().replace(/[\s-]/g,'')];const number=match[2];start(type,type[0].toUpperCase()+type.slice(1)+(number?' '+number:''));continue;}
  if(!current){if(!raw.trim())continue;start('verse','Verse 1');}
  current!.lines.push(raw.trimEnd());
 }
 const populated=sections.map(s=>({...s,lines:s.lines.join('\n').trim().split('\n')})).filter(s=>s.lines.some(l=>l.trim()&&!/^(---+|\[slide\]|<split>)$/i.test(l.trim())));
 return populated.length?populated:lyrics.split(/\r?\n/).some(l=>l.trim()&&!/^(---+|\[slide\]|<split>)$/i.test(l.trim()))?[{id:'section-1',type:'verse',label:'Verse 1',lines:lyrics.trim().split(/\r?\n/)}]:[];
}
export function sectionsToLyrics(sections:Section[]):string{return sections.map(s=>s.label+'\n'+s.lines.join('\n')).join('\n\n');}
export function normalizeSong(input:unknown,base?:SongContent):SongContent{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('A song must be an object.');
 const raw=input as Record<string,unknown>;
 const merged={...base,...raw};
 if(base&&typeof raw.lyrics==='string'&&raw.lyrics!==base.lyrics&&!Object.hasOwn(raw,'sections')){merged.sections=[];merged.arrangement=[];}
 if(Object.hasOwn(raw,'author')&&!Object.hasOwn(raw,'authors'))merged.authors=String(raw.author||'').split(/\s*;\s*/).filter(Boolean);
 for(const field of ['title','author','copyright','publisher','ccliNumber','key','language','notes'] as const)if(typeof merged[field]==='string')merged[field]=cleanSongText(merged[field]);if(typeof merged.lyrics==='string')merged.lyrics=cleanSongLyrics(merged.lyrics);
 const song=SongInput.parse(merged);
 const sections=song.sections.length?song.sections:parseSections(song.lyrics);
 if(!sections.length)throw new Error('Enter song lyrics or at least one non-empty section.');
 if(!sections.some(s=>s.lines.some(l=>l.trim()&&!/^(---+|\[slide\]|<split>)$/i.test(l.trim()))))throw new Error('Enter lyrics in at least one section.');
 if(new Set(sections.map(s=>s.id)).size!==sections.length)throw new Error('Section IDs must be unique.');
 // Ensure arrangement includes all sections if it's missing or incomplete (common on import or legacy data)
 let arrangement=song.arrangement;
 if(!arrangement.length || arrangement.length < sections.length){
  arrangement = sections.map(s => s.id);
 }
 if(arrangement.some(id=>!sections.some(s=>s.id===id)))throw new Error('The arrangement refers to a section that does not exist.');
 const authors=normalizedAuthors(song.authors.length?song.authors:song.author);
 const now=new Date().toISOString();
 return {...song,authors,author:authors.join('; '),lyrics:song.lyrics.trim()||sectionsToLyrics(sections),sections,arrangement,tags:normalizedTags(song.tags),createdAt:base?.createdAt||song.createdAt||now,updatedAt:base?now:song.updatedAt||now};
}
/** A compact representation. Runtime SongContent remains hydrated for legacy readers. */
export function songStorageRecord(song:SongContent,defaults:{language:string;linesPerSlide:number}={language:'en',linesPerSlide:4}){
 const detail:Record<string,unknown>={createdAt:song.createdAt,updatedAt:song.updatedAt};
 if(JSON.stringify(song.author.split(/\s*;\s*/).filter(Boolean))!==JSON.stringify(song.authors))detail.authors=song.authors;
 for(const field of ['publisher','ccliNumber','key','notes','backgroundId','themeId'] as const)if(song[field])detail[field]=song[field];
 if(song.tempo>=20&&song.tempo<=300)detail.tempo=song.tempo;
 if(song.tags.length)detail.tags=song.tags;
 if(song.language&&song.language!==defaults.language)detail.language=song.language;
 if(song.linesPerSlide&&song.linesPerSlide!==defaults.linesPerSlide)detail.linesPerSlide=song.linesPerSlide;
 if(JSON.stringify(parseSections(song.lyrics))!==JSON.stringify(song.sections))detail.sections=song.sections;
 if(JSON.stringify(song.arrangement)!==JSON.stringify(song.sections.map(s=>s.id)))detail.arrangement=song.arrangement;
 return {title:song.title,lyrics:song.lyrics,author:song.author||null,copyright:song.copyright||null,detail};
}
const chordPattern=/\[(?:[A-G](?:#|b)?(?:maj|min|m|M|sus|dim|aug|add)?\d*(?:sus\d+|add\d+)?(?:\/[A-G](?:#|b)?)?|N\.?C\.?)\]/g;
export function stripChords(text:string):string{return text.replace(chordPattern,'');}
function wrapLine(line:string,max=70):string[]{
 const tokens=(line.match(/\[[^\]\n]+\]|[\s\S]/gu)||[]).flatMap(token=>stripChords(token)===''?[token]:Array.from(token));const out:string[]=[];let buffer:string[]=[];
 const count=(parts:string[])=>Array.from(stripChords(parts.join(''))).length;
 for(const token of tokens){
  buffer.push(token);
  if(count(buffer)>max){let space=-1;for(let n=buffer.length-2;n>=0;n--)if(/^\s$/.test(buffer[n])){space=n;break;}
   if(space>=0){out.push(buffer.slice(0,space).join('').trim());buffer=buffer.slice(space+1);}
   else{const last=buffer.pop()!;out.push(buffer.join('').trim());buffer=[last];}
  }
 }
 if(buffer.length)out.push(buffer.join('').trim());
 return out.filter(Boolean);
}
export function buildSlides(song:Pick<SongContent,'sections'|'arrangement'>,maxLines=4):SongSlide[]{
 if(![2,3,4,6].includes(maxLines))throw new Error('Choose 2, 3, 4 or 6 lines per slide.');
 const result:SongSlide[]=[];
 for(const id of song.arrangement){
  const section=song.sections.find(s=>s.id===id);if(!section)throw new Error('The arrangement contains a missing section.');let lines:string[]=[];
  const flush=()=>{if(lines.length){const stageText=lines.join('\n');result.push({text:stripChords(stageText),stageText,sectionId:id,label:section.label});lines=[];}};
  for(const raw of section.lines){if(!raw.trim()||/^(---+|\[slide\]|<split>)$/i.test(raw.trim())){flush();continue;}
   for(const line of wrapLine(raw)){lines.push(line);if(lines.length>=maxLines)flush();}
  }flush();
 }
 return result;
}
export function rankSongs<T extends Pick<Song,'title'|'author'|'lyrics'|'tags'>>(songs:T[],query:string):T[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 if(!terms.length)return [...songs];
 return songs.map((song,index)=>{let score=0;for(const term of terms){const title=song.title.toLocaleLowerCase(),author=song.author.toLocaleLowerCase(),lyrics=stripChords(song.lyrics).toLocaleLowerCase();if(title===term)score+=1000;else if(title.startsWith(term))score+=500;else if(title.includes(term))score+=300;else if(author.includes(term))score+=100;else if(song.tags.some(t=>t.toLocaleLowerCase().includes(term)))score+=70;else if(lyrics.includes(term))score+=30;else return {song,score:-1,index};}return {song,score,index};}).filter(s=>s.score>=0).sort((a,b)=>b.score-a.score||a.song.title.localeCompare(b.song.title)||a.index-b.index).map(s=>s.song);
}
const array=(value:unknown):any[]=>value===undefined||value===null?[]:Array.isArray(value)?value:[value];
const text=(value:any):string=>value==null?'':typeof value==='string'||typeof value==='number'?String(value):Array.isArray(value)?value.map(text).join(' '):Object.entries(value).filter(([key])=>!key.startsWith('@')).map(([,v])=>text(v)).join(' ');
// OpenLP exports OpenLyrics: preserve inline order and <br/> boundaries, while ignoring formatting code.
// Format reference: https://docs.openlyrics.org/en/latest/dataformat.html
function inlineLyrics(raw:string):string{
 const ordered=new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:'@',trimValues:false,parseTagValue:false}).parse('<lines>'+raw+'</lines>');
 const walk=(nodes:any[]):string=>nodes.map(node=>Object.entries(node).filter(([key])=>key!==':@').map(([key,value])=>{
  if(key==='#text')return String(value);if(key==='br')return '\n';if(key==='comment')return '';
  const content=Array.isArray(value)?walk(value):'';
  if(key==='chord'){const attrs=node[':@']||{},name=String(attrs['@name']||''),root=String(attrs['@root']||''),bass=String(attrs['@bass']||''),structure=String(attrs['@structure']||''),quality:Record<string,string>={min:'m',maj:'maj',dom7:'7',min7:'m7',maj7:'maj7',dim:'dim',dim7:'dim7',aug:'aug',sus4:'sus4',sus2:'sus2',add9:'add9'};return (name?'['+name+']':/^[A-G][#b]?$/.test(root)?'['+root+(quality[structure]||'')+(bass?'/'+bass:'')+']':'')+content;}
  return content;
 }).join('')).join('');
 return walk(ordered).replace(/^[ \t]+|[ \t]+$/gm,'').trim();
}
function fromXMLSong(song:any,openLP:boolean):SongContent{
 const properties=song.properties||{};
 const verses=array(song.lyrics?.verse);
 const xmlSections:Section[]=openLP?verses.map((verse,index)=>{const named=String(verse['@name']||''),name=named.match(/^([a-z])(\d*)/i),short=String(verse['@type']||name?.[1]||'v').toLowerCase(),type=sectionNames[short]||'verse',number=String(verse['@label']??name?.[2]??index+1),label=type[0].toUpperCase()+type.slice(1)+(number?' '+number:'');const body=verse.lines===undefined?text(verse):array(verse.lines).map(line=>inlineLyrics(typeof line==='string'?line:text(line))).join('\n---\n');return {id:'section-'+(index+1),type,label,lines:body.trim().split(/\r?\n/)};}):[];
 const lyrics=openLP?sectionsToLyrics(xmlSections):text(song.lyrics);
 const authors=openLP?array(properties.authors?.author).map(text).map(value=>value.trim()).filter(Boolean):text(song.author).split(/\s*;\s*/).filter(Boolean);
 const title=text(openLP?array(properties.titles?.title)[0]:song.title)||'Imported song';
 const numericTempo=Number(text(openLP?properties.tempo:song.tempo));
 const result=normalizeSong({title,authors,lyrics,...(openLP?{sections:xmlSections}:{}),publisher:text(song.publisher||properties.publisher),copyright:text(openLP?properties.copyright:song.copyright),ccliNumber:text(openLP?properties.ccliNo:song.ccli),key:text(openLP?properties.key:song.key),tempo:Number.isFinite(numericTempo)&&numericTempo>=0&&numericTempo<=999?numericTempo:0,tags:openLP?[...array(properties.themes?.theme).map(text),...text(properties.keywords).split(',')].filter(Boolean):[],language:String(song['@xml:lang']||song['@lang']||'en'),notes:text(openLP?properties.comments?.comment:song.comments)});
 const order=text(openLP?properties.verseOrder:song.presentation).trim().split(/[\s,;]+/).filter(Boolean);
 if(order.length){const arrangement=order.map(token=>{if(openLP){const index=verses.findIndex(v=>String(v['@name']||'').toLowerCase()===token.toLowerCase());if(index>=0)return xmlSections[index].id;}const m=token.match(/^([vcbptio])(\d*)$/i);if(!m)return '';return result.sections.find(s=>s.type===sectionNames[m[1].toLowerCase()]&&(!m[2]||s.label.endsWith(' '+m[2])))?.id||'';});if(arrangement.every(Boolean))result.arrangement=arrangement;}
 return result;
}
export function parseSongFile(content:string,format:'text'|'opensong'|'openlp'|'openlyrics'|'json',filename='Imported song'):SongContent[]{
 if(content.length>30_000_000)throw new Error('Song file exceeds 30 MB.');
 if(format==='json'){
  let parsed:any;try{parsed=JSON.parse(content);}catch{throw new Error('Invalid song backup JSON.');}
  const records=Array.isArray(parsed)?parsed:parsed&&['worship-studio-songs-v1','worship-studio-songs-v2'].includes(parsed.format)?parsed.songs:null;
  if(!Array.isArray(records)||records.length>10000)throw new Error('Choose a Worship Studio song backup containing at most 10,000 songs.');
  return records.map(s=>normalizeSong(s));
 }
 if(format==='opensong'||format==='openlp'||format==='openlyrics'){
  if(/<!DOCTYPE|<!ENTITY/i.test(content))throw new Error('XML entities and document types are not supported.');
  if(XMLValidator.validate(content)!==true)throw new Error('Invalid song XML.');
  const data=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',textNodeName:'#text',parseTagValue:false,cdataPropName:'#cdata',stopNodes:['*.lines'],removeNSPrefix:true}).parse(content);
  const records=array(data.song??data.songs?.song??data.openlp?.song??data.songbook?.song);
  if(!records.length)throw new Error('Expected OpenSong or OpenLP XML.');
  if(records.length>10000)throw new Error('Import at most 10,000 songs at a time.');
  return records.map(s=>fromXMLSong(s,!!s.properties||format==='openlp'||format==='openlyrics'));
 }
 const blocks=content.replace(/\r\n?/g,'\n').split(/\n={3,}\s*SONG\s*={3,}\n/i);
 if(blocks.length>10000)throw new Error('Import at most 10,000 songs at a time.');
 return blocks.filter(b=>b.trim()).map(block=>{
  const lines=block.trim().split('\n');let title=filename.replace(/\.[^.]+$/,''),author='',copyright='',publisher='',notes='',key='',tempo=0;
  if(/^#\s+/.test(lines[0]))title=lines.shift()!.replace(/^#\s+/,'').trim();
  while(lines.length&&/^(Title|Authors?|Copyright|Publisher|Comments|Key|Tempo):/i.test(lines[0])){const line=lines.shift()!,at=line.indexOf(':'),field=line.slice(0,at).toLowerCase(),value=line.slice(at+1).trim();if(field==='title')title=value;else if(field==='author'||field==='authors')author=value;else if(field==='copyright')copyright=value;else if(field==='publisher')publisher=value;else if(field==='comments')notes=value.replace(/\\(\\|n)/g,(_,c:string)=>c==='n'?'\n':'\\');else if(field==='key')key=value;else if(field==='tempo')tempo=Number(value)||0;}
  return normalizeSong({title,author,copyright,publisher,notes,key,tempo,lyrics:lines.join('\n').trim()});
 });
}
export function previewSongImport(candidates:SongInput[],existing:Pick<Song,'id'|'title'|'lyrics'>[]):{song:SongContent;duplicateIds:string[]}[]{
 const seen=[...existing];return candidates.map((input,index)=>{const song=normalizeSong(input),duplicateIds=seen.filter(s=>normalizedTitleKey(s.title)===normalizedTitleKey(song.title)||lyricHash(stripChords(s.lyrics))===lyricHash(stripChords(song.lyrics))).map(s=>s.id);seen.push({...song,id:'import:'+index});return {song,duplicateIds};});
}
export function exportSongs<T extends Pick<Song,'title'|'author'|'copyright'|'lyrics'>>(songs:T[],format:'json'|'text'|'fields'):string{
 if(format==='json')return JSON.stringify({format:'worship-studio-songs-v2',formatVersion:3,songs:songs.map(input=>{const song=normalizeSong(input),record=songStorageRecord(song,{language:'en',linesPerSlide:0});return {title:record.title,lyrics:record.lyrics,...(record.author?{author:record.author}:{}),...(record.copyright?{copyright:record.copyright}:{}),...record.detail};})},null,2);
 if(format==='fields')return songs.map(input=>{const s=normalizeSong(input);return ['Title: '+s.title,'Authors: '+s.author,'Publisher: '+s.publisher,'Copyright: '+s.copyright,'Comments: '+s.notes.replace(/\\/g,'\\\\').replace(/\n/g,'\\n'),'Key: '+s.key,'Tempo: '+(s.tempo||''),'',s.lyrics].join('\n');}).join('\n=== SONG ===\n');
 return songs.map(s=>'# '+s.title+'\nAuthor: '+s.author+'\nCopyright: '+s.copyright+'\n\n'+s.lyrics).join('\n=== SONG ===\n');
}
