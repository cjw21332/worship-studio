import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {z} from 'zod';

/** Canonical identities never depend on the language used to label a book. */
const bookData:[string,string,string,string][]=[
 ['Genesis','Gen','Genesis','ge|gn'],['Exodus','Exod','Exodo','ex|exo'],['Leviticus','Lev','Levitico','lv|levitico'],['Numbers','Num','Mga Bilang','nu|nm|bilang'],['Deuteronomy','Deut','Deuteronomio','dt|deu'],['Joshua','Josh','Josue','jos'],['Judges','Judg','Mga Hukom','jdg|hukom'],['Ruth','Ruth','Ruth','rut'],
 ['1 Samuel','1Sam','1 Samuel','1sa|1sm'],['2 Samuel','2Sam','2 Samuel','2sa|2sm'],['1 Kings','1Kgs','1 Mga Hari','1ki|1king|1hari'],['2 Kings','2Kgs','2 Mga Hari','2ki|2king|2hari'],['1 Chronicles','1Chr','1 Mga Cronica','1ch|1cronica|1kronika|1mgakronika'],['2 Chronicles','2Chr','2 Mga Cronica','2ch|2cronica|2kronika|2mgakronika'],['Ezra','Ezra','Ezra','ezr'],['Nehemiah','Neh','Nehemias','ne'],['Esther','Esth','Esther','est'],['Job','Job','Job','jb'],['Psalms','Ps','Mga Awit','psalm|psa|awit'],['Proverbs','Prov','Mga Kawikaan','pr|pro|kawikaan'],['Ecclesiastes','Eccl','Mangangaral','ecc|eccles|eclesiastes'],['Song of Solomon','Song','Awit ng mga Awit','songs|songofsongs|sos|canticles|cant'],['Isaiah','Isa','Isaias','is'],['Jeremiah','Jer','Jeremias','je'],['Lamentations','Lam','Mga Panaghoy','la|panaghoy'],['Ezekiel','Ezek','Ezekiel','eze|ezk'],['Daniel','Dan','Daniel','da|dn'],['Hosea','Hos','Oseas','ho|osea'],['Joel','Joel','Joel','jl'],['Amos','Amos','Amos','am'],['Obadiah','Obad','Obadias','ob'],['Jonah','Jonah','Jonas','jon'],['Micah','Mic','Mikas','mi|mica'],['Nahum','Nah','Nahum','na'],['Habakkuk','Hab','Habacuc','hb|habakuk'],['Zephaniah','Zeph','Zefanias','zep|sofonias'],['Haggai','Hag','Hagai','hg|hageo'],['Zechariah','Zech','Zacarias','zec'],['Malachi','Mal','Malakias','ml'],
 ['Matthew','Matt','Mateo','mt|mat'],['Mark','Mark','Marcos','mk|mr'],['Luke','Luke','Lucas','lk|lu'],['John','John','Juan','jn|jhn|joh'],['Acts','Acts','Mga Gawa','ac|act|gawa'],['Romans','Rom','Mga Taga-Roma','ro|rm|roma|taga-roma'],['1 Corinthians','1Cor','1 Mga Taga-Corinto','1co|1corinto|1corinthian|1tagacorinto'],['2 Corinthians','2Cor','2 Mga Taga-Corinto','2co|2corinto|2corinthian|2tagacorinto'],['Galatians','Gal','Mga Taga-Galacia','ga|galacia|tagagalacia'],['Ephesians','Eph','Mga Taga-Efeso','ep|efeso|tagaefeso'],['Philippians','Phil','Mga Taga-Filipos','php|pp|filipos|tagafilipos'],['Colossians','Col','Mga Taga-Colosas','co|colosas|tagacolosas'],['1 Thessalonians','1Thess','1 Mga Taga-Tesalonica','1th|1thes|1tesalonica|1tagatesalonica'],['2 Thessalonians','2Thess','2 Mga Taga-Tesalonica','2th|2thes|2tesalonica|2tagatesalonica'],['1 Timothy','1Tim','1 Timoteo','1ti'],['2 Timothy','2Tim','2 Timoteo','2ti'],['Titus','Titus','Tito','tit'],['Philemon','Phlm','Filemon','phm|philem'],['Hebrews','Heb','Mga Hebreo','he|heb||hebreo'],['James','Jas','Santiago','jm|jam|sant'],['1 Peter','1Pet','1 Pedro','1pe|1pt'],['2 Peter','2Pet','2 Pedro','2pe|2pt'],['1 John','1John','1 Juan','1jn|1jhn|1jo'],['2 John','2John','2 Juan','2jn|2jhn|2jo'],['3 John','3John','3 Juan','3jn|3jhn|3jo'],['Jude','Jude','Judas','jud'],['Revelation','Rev','Apocalipsis','re|rv|revelations|apoc|apocalipsisni juan']
];
export type BibleBook={id:number;name:string;osis:string;filipino:string};
export const BOOKS:readonly BibleBook[]=bookData.map(([name,osis,filipino],i)=>({id:i+1,name,osis,filipino}));
function normalizedBook(value:string):string{
 return value.normalize('NFKC').toLocaleLowerCase('en').trim().replace(/^(iii|ii|i)\s+(?=\D)/,m=>({'i':1,'ii':2,'iii':3}[m.trim() as 'i']+' ')).replace(/[.\s_-]/g,'');
}
const aliases=new Map<string,BibleBook>();
bookData.forEach(([name,osis,filipino,extra],i)=>{for(const namePart of [name,osis,filipino,...extra.split('|')])if(namePart)aliases.set(normalizedBook(namePart),BOOKS[i]);});
export function canonicalBook(value:string|number):BibleBook|undefined{
 if(typeof value==='number'||/^\d+$/.test(String(value).trim()))return BOOKS[Number(value)-1];
 return aliases.get(normalizedBook(value));
}
export function suggestBooks(query:string,limit=8):BibleBook[]{
 const normalized=normalizedBook(query);if(!normalized)return BOOKS.slice(0,limit);
 return BOOKS.filter(b=>[...aliases].some(([key,value])=>value.id===b.id&&key.startsWith(normalized))).slice(0,limit);
}
export type BibleEndpoint={chapter:number;verse?:number};
export type BibleReference={bookId:number;book:string;start:BibleEndpoint;end:BibleEndpoint};
const validChapter=(n:number)=>Number.isInteger(n)&&n>=1&&n<=200;
const validVerse=(n:number)=>Number.isInteger(n)&&n>=1&&n<=1000;
export function parseReference(input:string):BibleReference{
 if(typeof input!=='string'||input.length>200)throw new Error('Enter a Bible reference of at most 200 characters.');
 const text=input.normalize('NFKC').trim().replace(/[–—]/g,'-').replace(/\s+/g,' ');
 const match=text.match(/^(.+?)\s*(\d+)\s*(?:(?::|\s)\s*(\d+))?\s*(?:-\s*(\d+)\s*(?::\s*(\d+))?)?$/);
 if(!match)throw new Error('Use a reference such as John 3:16, Ps 23, or 1 Cor 13:4-7.');
 const book=canonicalBook(match[1].trim());if(!book)throw new Error('Book not recognized. Try an English or Filipino name, such as John or Juan.');
 const start:BibleEndpoint={chapter:Number(match[2])};if(match[3])start.verse=Number(match[3]);
 let end:BibleEndpoint={...start};
 if(match[4])end=match[5]?{chapter:Number(match[4]),verse:Number(match[5])}:start.verse?{chapter:start.chapter,verse:Number(match[4])}:{chapter:Number(match[4])};
 if(!validChapter(start.chapter)||!validChapter(end.chapter))throw new Error('Chapter numbers must be between 1 and 200.');
 if((start.verse!==undefined&&!validVerse(start.verse))||(end.verse!==undefined&&!validVerse(end.verse)))throw new Error('Verse numbers must be between 1 and 1000.');
 if(end.chapter<start.chapter||(end.chapter===start.chapter&&(end.verse??1000)<(start.verse??1)))throw new Error('The end of a verse range must be after its beginning.');
 return {bookId:book.id,book:book.name,start,end};
}
export function formatReference(reference:BibleReference):string{
 const start=reference.start.chapter+(reference.start.verse!==undefined?':'+reference.start.verse:'');
 if(reference.start.chapter===reference.end.chapter&&reference.start.verse===reference.end.verse)return reference.book+' '+start;
 const end=reference.end.chapter===reference.start.chapter&&reference.start.verse!==undefined?String(reference.end.verse):reference.end.chapter+(reference.end.verse!==undefined?':'+reference.end.verse:'');
 return reference.book+' '+start+'–'+end;
}
export type BibleVerse={bookId:number;book:string;chapter:number;verse:number;text:string};
// Empty strings are authentic omissions in some source versifications; retain their coordinates.
const verseInput=z.object({bookId:z.number().int().min(1).max(66),chapter:z.number().int().min(1).max(200),verse:z.number().int().min(1).max(1000),text:z.string().max(100000)});
const rawVerseInput=verseInput.omit({bookId:true});
const key=(v:{bookId:number;chapter:number;verse:number})=>v.bookId+':'+v.chapter+':'+v.verse;
const compare=(a:BibleVerse,b:BibleVerse)=>a.bookId-b.bookId||a.chapter-b.chapter||a.verse-b.verse;
export function selectPassage(verses:readonly BibleVerse[],reference:BibleReference,validateEndpoints=true):BibleVerse[]{
 const {start,end}=reference;
 const rows=verses.filter(v=>v.bookId===reference.bookId&&(v.chapter>start.chapter||(v.chapter===start.chapter&&v.verse>=(start.verse??1)))&&(v.chapter<end.chapter||(v.chapter===end.chapter&&v.verse<=(end.verse??1000)))).sort(compare);
 if(!rows.length)throw new Error('This passage is not available in the selected translation.');
 if(validateEndpoints){
  if(!rows.some(v=>v.chapter===start.chapter&&(start.verse===undefined||v.verse===start.verse)))throw new Error('The beginning of this passage is unavailable in the selected translation.');
  if(!rows.some(v=>v.chapter===end.chapter&&(end.verse===undefined||v.verse===end.verse)))throw new Error('The end of this passage is unavailable in the selected translation.');
 }
 return rows;
}
export function navigatePassage(verses:readonly BibleVerse[],reference:BibleReference,unit:'verse'|'chapter',direction:1|-1):BibleReference{
 const sorted=[...verses].sort(compare);if(!sorted.length)throw new Error('This translation contains no verses.');
 const position=sorted.findIndex(v=>v.bookId===reference.bookId&&v.chapter===reference.start.chapter&&(reference.start.verse===undefined||v.verse===reference.start.verse));
 if(position<0)throw new Error('The current passage is unavailable in this translation.');
 let next:BibleVerse|undefined;
 if(unit==='verse')next=sorted[position+direction];
 else{let at=position+direction;while(at>=0&&at<sorted.length){const row=sorted[at];if(row.bookId!==reference.bookId||row.chapter!==reference.start.chapter){next=row;break;}at+=direction;}}
 if(!next)throw new Error(direction>0?'You are at the end of this translation.':'You are at the beginning of this translation.');
 const endpoint:BibleEndpoint={chapter:next.chapter};if(unit==='verse')endpoint.verse=next.verse;
 return {bookId:next.bookId,book:BOOKS[next.bookId-1].name,start:endpoint,end:{...endpoint}};
}

type RawVerse={book:string;bookId?:number;chapter:number;verse:number;text:string};
export type BibleImport={format:'worship-studio-bible-v1';name:string;abbreviation:string;language:string;copyright:string;verses:BibleVerse[]};
export type BibleImportOptions={name?:string;bookMappings?:Record<string,number>};
export type BibleImportPreview=BibleImport&{unmappedBooks:string[];sample:RawVerse[];total:number;bookMappings:Record<string,number>};
type RawImport={name:string;abbreviation?:string;language?:string;copyright?:string;verses:RawVerse[]};
const stringField=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
type XmlNode=Record<string,unknown>;
const attrs=(node:XmlNode)=>node[':@'] as Record<string,string>|undefined;
const tagName=(node:XmlNode)=>Object.keys(node).find(k=>k!==':@')??'';
const children=(node:XmlNode):XmlNode[]=>{const value=node[tagName(node)];return Array.isArray(value)?value as XmlNode[]:[];};
const skippedText=new Set(['note','title','header','work','revisionDesc']);
function xmlText(nodes:XmlNode[]):string{return nodes.map(node=>{const tag=tagName(node);if(tag==='#text')return String(node['#text']??'');if(skippedText.has(tag)||skippedText.has(tag.toLowerCase()))return '';return xmlText(children(node));}).join('');}
function findNodes(nodes:XmlNode[],tag:string):XmlNode[]{const found:XmlNode[]=[];for(const node of nodes){if(tagName(node).toLowerCase()===tag.toLowerCase())found.push(node);found.push(...findNodes(children(node),tag));}return found;}
function cleanText(text:string):string{return text.replace(/\s+/g,' ').trim();}
function osisKeys(value:string):{book:string;chapter:number;verse:number}[]{
 const values=value.trim().split(/\s+/);if(!values[0])throw new Error('OSIS verse is missing its osisID.');
 return values.flatMap(entry=>{
  const m=entry.match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:-(?:([A-Za-z0-9]+)\.(\d+)\.)?(\d+))?$/);
  if(!m)throw new Error('Unsupported OSIS verse reference: '+entry);
  const chapter=Number(m[2]),start=Number(m[3]),end=m[6]?Number(m[6]):start;
  if((m[4]&&m[4]!==m[1])||(m[5]&&Number(m[5])!==chapter)||end<start||end-start>200)throw new Error('OSIS linked verses must be a forward range within one chapter.');
  return Array.from({length:end-start+1},(_,offset)=>({book:m[1],chapter,verse:start+offset}));
 });
}
function parseXml(source:string):RawImport{
 if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('XML entities and document types are not supported.');
 if(XMLValidator.validate(source)!==true)throw new Error('Invalid Bible XML. Check that all tags are closed.');
 const nodes=new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:'@',textNodeName:'#text',parseTagValue:false,trimValues:false,removeNSPrefix:true,maxNestedTags:128}).parse(source) as XmlNode[];
 const zefania=findNodes(nodes,'XMLBIBLE')[0],openSong=findNodes(nodes,'bible')[0],osis=findNodes(nodes,'osisText')[0];
 const verses:RawVerse[]=[];
 if(zefania||openSong){
  const root=zefania||openSong,rootAttrs=attrs(root)||{};
  for(const book of children(root).filter(n=>['BIBLEBOOK','b'].includes(tagName(n)))){
   const a=attrs(book)||{},number=Number(a['@bnumber']);const canonical=Number.isInteger(number)&&number>=1&&number<=66?number:undefined;
   const bookName=String(a['@bname']??a['@n']??a['@bnumber']??'');
   for(const chapter of children(book).filter(n=>['CHAPTER','c'].includes(tagName(n))))for(const verse of children(chapter).filter(n=>['VERS','v'].includes(tagName(n)))){
    verses.push({book:bookName,bookId:canonical,chapter:Number(attrs(chapter)?.['@cnumber']??attrs(chapter)?.['@n']),verse:Number(attrs(verse)?.['@vnumber']??attrs(verse)?.['@n']),text:cleanText(xmlText(children(verse)))});
   }
  }
  return {name:rootAttrs['@biblename']??rootAttrs['@n']??'Imported Bible',abbreviation:rootAttrs['@abbreviation'],language:rootAttrs['@language']??rootAttrs['@lang'],copyright:cleanText(xmlText(children(findNodes(nodes,'rights')[0]||{}))),verses};
 }
 if(!osis)throw new Error('Expected Zefania, OpenSong or OSIS Bible XML.');
 let active:{id:string;references:{book:string;chapter:number;verse:number}[];text:string}|null=null;
 const walk=(rows:XmlNode[])=>{for(const node of rows){const tag=tagName(node),a=attrs(node)||{};
  if(tag==='#text'){if(active)active.text+=String(node['#text']??'');continue;}
  if(skippedText.has(tag)||skippedText.has(tag.toLowerCase()))continue;
  if(tag==='verse'){
   if(a['@eID']){if(!active||active.id!==a['@eID'])throw new Error('OSIS verse milestone ends without a matching start.');for(const ref of active.references)verses.push({...ref,text:cleanText(active.text)});active=null;}
   else if(a['@sID']){if(active)throw new Error('OSIS verse milestones overlap or are not closed.');active={id:a['@sID'],references:osisKeys(a['@osisID']||a['@sID']),text:''};if(children(node).length)walk(children(node));}
   else{if(active)throw new Error('OSIS mixes container verses with open milestones.');const text=cleanText(xmlText(children(node)));for(const ref of osisKeys(a['@osisID']||''))verses.push({...ref,text});}
  }else walk(children(node));
 }};
 walk(children(osis));if(active)throw new Error('OSIS verse milestone was not closed.');
 const a=attrs(osis)||{};
 return {name:a['@osisIDWork']||'Imported Bible',abbreviation:a['@osisIDWork'],language:a['@lang'],copyright:cleanText(xmlText(children(findNodes(nodes,'rights')[0]||{}))),verses};
}
function rawImport(source:string):RawImport{
 if(typeof source!=='string'||source.length>30_000_000)throw new Error('Bible file exceeds the 30 MB limit.');
 const text=source.replace(/^\uFEFF/,'').trim();if(!text)throw new Error('Bible file is empty.');
 if(text.startsWith('<'))return parseXml(text);
 if(text.startsWith('{')||text.startsWith('[')){
  let input:unknown;try{input=JSON.parse(text);}catch{throw new Error('Invalid Bible JSON.');}
  const schema=z.object({format:z.literal('worship-studio-bible-v1'),name:z.string().trim().min(1).max(200),abbreviation:z.string().max(40).optional(),language:z.string().max(40).optional(),copyright:z.string().max(2000).optional(),verses:z.array(z.object({book:z.string().max(100).optional(),bookId:z.number().int().min(1).max(66).optional(),chapter:z.number(),verse:z.number(),text:z.string()})).min(1).max(100000)});
  const data=schema.parse(input);
  return {...data,verses:data.verses.map(v=>({...v,book:v.book??String(v.bookId??'')}))};
 }
 const verses:RawVerse[]=[];for(const [index,line] of text.split(/\r?\n/).entries()){
  if(!line.trim())continue;const tab=line.indexOf('\t');if(tab<0)throw new Error('Line '+(index+1)+' must contain Book Chapter:Verse, a tab, then verse text.');
  const m=line.slice(0,tab).trim().match(/^(.+?)\s+(\d+)\s*:\s*(\d+)$/);if(!m)throw new Error('Invalid verse reference on line '+(index+1)+'.');
  verses.push({book:m[1],chapter:Number(m[2]),verse:Number(m[3]),text:line.slice(tab+1).trim()});
 }
 return {name:'Imported Bible',verses};
}
export function previewBibleImport(source:string,options:BibleImportOptions={}):BibleImportPreview{
 const raw=rawImport(source);if(!raw.verses.length||raw.verses.length>100000)throw new Error('A Bible import must contain between 1 and 100,000 verses.');
 const mappings=z.record(z.string().max(100),z.number().int().min(1).max(66)).parse(options.bookMappings||{});
 const name=z.string().trim().min(1).max(200).parse(options.name??raw.name);
 const verses:BibleVerse[]=[],unmapped=new Set<string>(),seen=new Set<string>(),bookMappings:Record<string,number>={};
 for(const row of raw.verses){
  if(!row.book||row.book.length>100)throw new Error('Bible contains an invalid book name.');
  // Validate every row even while waiting for the user to map an unfamiliar name.
  rawVerseInput.parse(row);
  const mapped=Object.prototype.hasOwnProperty.call(mappings,row.book)?mappings[row.book]:row.bookId;
  const book=canonicalBook(mapped??row.book);if(!book){unmapped.add(row.book);continue;}
  const verse={...verseInput.parse({...row,bookId:book.id}),book:book.name};
  if(seen.has(key(verse)))throw new Error('Duplicate verse reference: '+verse.book+' '+verse.chapter+':'+verse.verse+'.');seen.add(key(verse));
  bookMappings[row.book]=book.id;verses.push(verse);
 }
 return {format:'worship-studio-bible-v1',name,abbreviation:stringField(raw.abbreviation,name.slice(0,12)),language:stringField(raw.language,'und'),copyright:stringField(raw.copyright),verses:verses.sort(compare),unmappedBooks:[...unmapped],sample:raw.verses.slice(0,5),total:raw.verses.length,bookMappings};
}
export function parseBibleImport(source:string,options:BibleImportOptions={}):BibleImport{
 const preview=previewBibleImport(source,options);if(preview.unmappedBooks.length)throw new Error('Map these unrecognized book names before importing: '+preview.unmappedBooks.join(', '));
 const {unmappedBooks,sample,total,bookMappings,...bible}=preview;return bible;
}

export type ParallelTranslation={id:string;name:string;abbreviation?:string;copyright?:string;fontFamily?:string;verses:readonly BibleVerse[]};
export type ParallelColumn={translationId:string;label:string;text:string;missing:boolean;copyright:string;fontFamily?:string};
export type ParallelRow={bookId:number;book:string;chapter:number;verse:number;columns:ParallelColumn[]};
export function parallelPassage(translations:readonly ParallelTranslation[],reference:BibleReference):ParallelRow[]{
 if(translations.length<1||translations.length>3)throw new Error('Choose one, two or three translations.');
 const passages=translations.map(t=>{try{return selectPassage(t.verses,reference,false);}catch{return [];}});
 const union=new Map<string,BibleVerse>();for(const passage of passages)for(const verse of passage)union.set(key(verse),verse);
 if(!union.size)throw new Error('This passage is unavailable in the selected translations.');
 // Check the requested endpoints in the combined versification while allowing omissions in individual versions.
 selectPassage([...union.values()],reference);
 const indexes=passages.map(p=>new Map(p.map(v=>[key(v),v])));
  return [...union.values()].sort(compare).map(v=>({bookId:v.bookId,book:v.book,chapter:v.chapter,verse:v.verse,columns:translations.map((t,n)=>{const row=indexes[n].get(key(v));return {translationId:t.id,label:t.abbreviation||t.name,text:row?.text||'Verse unavailable',missing:!row||!row.text,copyright:t.copyright||'',fontFamily:t.fontFamily};})}));
}
export type BibleDisplayMode='single'|'parallel'|'stacked'|'line-by-line';
export type BiblePage={title:string;reference:string;mode:BibleDisplayMode;showVerseNumbers:boolean;rows:ParallelRow[];continuation?:{part:number;total:number};columns:{translationId:string;label:string;text:string;copyright:string;fontFamily?:string}[]};
function chunks(text:string,capacity:number):string[]{
 const points=Array.from(text),parts:string[]=[];let offset=0;
 while(offset<points.length){let end=Math.min(points.length,offset+capacity);if(end<points.length){const candidate=points.slice(offset,end).join(''),space=candidate.lastIndexOf(' ');if(space>capacity/2)end=offset+Array.from(candidate.slice(0,space+1)).length;}parts.push(points.slice(offset,end).join(''));offset=end;}
 return parts.length?parts:[''];
}
export function paginatePassage(rows:readonly ParallelRow[],options:{versesPerSlide:number;mode:BibleDisplayMode;showVerseNumbers:boolean;maxCharactersPerColumn?:number}):BiblePage[]{
 if(!Number.isInteger(options.versesPerSlide)||options.versesPerSlide<1||options.versesPerSlide>20)throw new Error('Choose between 1 and 20 verses per slide.');
 const pages:BiblePage[]=[],capacity=options.maxCharactersPerColumn??Math.max(200,Math.floor(800/(rows[0]?.columns.length||1)));
 if(!Number.isInteger(capacity)||capacity<80||capacity>10000)throw new Error('Bible page text capacity must be between 80 and 10,000 characters.');
 const segments:{row:ParallelRow;continuation?:{part:number;total:number}}[]=[];
 for(const row of rows){const parts=row.columns.map(c=>chunks(c.text,capacity)),count=Math.max(...parts.map(p=>p.length));for(let n=0;n<count;n++)segments.push({row:{...row,columns:row.columns.map((c,index)=>({...c,text:parts[index][n]??''}))},continuation:count>1?{part:n+1,total:count}:undefined});}
 let index=0;
 while(index<segments.length){const current=segments[index],chunk=[current.row];index++;
  if(!current.continuation)while(index<segments.length&&chunk.length<options.versesPerSlide&&!segments[index].continuation){const next=segments[index].row;if(chunk[0].columns.some((_,n)=>chunk.reduce((total,row)=>total+row.columns[n].text.length+8,0)+next.columns[n].text.length>capacity))break;chunk.push(next);index++;}
  const first=chunk[0],last=chunk[chunk.length-1];
  const reference=formatReference({bookId:first.bookId,book:first.book,start:{chapter:first.chapter,verse:first.verse},end:{chapter:last.chapter,verse:last.verse}});
  const columns=first.columns.map((c,n)=>({...c,text:chunk.map(row=>(options.showVerseNumbers?row.verse+' ':'')+row.columns[n].text).join('\n')}));
  pages.push({title:reference,reference,mode:options.mode,showVerseNumbers:options.showVerseNumbers,rows:[...chunk],columns,...(current.continuation?{continuation:current.continuation}:{})});
 }
 return pages;
}
