import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
export const PortableService=z.object({format:z.literal('worship-studio-service-v1'),items:z.array(z.object({title:z.string().min(1).max(200),slides:z.array(z.string().min(1).max(100000)).min(1).max(1000)})).max(5000)});
export type Verse={book:string;chapter:number;verse:number;text:string};
const array=(value:any):any[]=>value===undefined?[]:Array.isArray(value)?value:[value];
export function parseBible(xml:string):{name:string;verses:Verse[]} {
 if(xml.length>30_000_000)throw new Error('Bible file exceeds 30 MB.');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('XML entities and document types are not supported.');
 if(XMLValidator.validate(xml)!==true)throw new Error('Invalid Bible XML.');
 const data=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',textNodeName:'#text',parseTagValue:false}).parse(xml);
 const root=data.XMLBIBLE??data.bible;if(!root)throw new Error('Expected Zefania or OpenSong Bible XML.');
 const verses:Verse[]=[];
 const extract=(value:any):string=>typeof value==='string'?value:typeof value==='number'?String(value):value&&typeof value==='object'?Object.entries(value).filter(([k])=>!k.startsWith('@')).map(([,v])=>array(v).map(extract).join(' ')).join(' '):'';
 for(const book of array(root.BIBLEBOOK??root.b))for(const chapter of array(book.CHAPTER??book.c))for(const verse of array(chapter.VERS??chapter.v)){
  const row={book:String(book['@bname']??book['@n']??book['@bnumber']??''),chapter:Number(chapter['@cnumber']??chapter['@n']),verse:Number(verse['@vnumber']??verse['@n']),text:extract(verse).trim()};
  if(!row.book||!Number.isInteger(row.chapter)||row.chapter<1||!Number.isInteger(row.verse)||row.verse<1||!row.text)throw new Error('Bible contains an invalid verse record.');verses.push(row);
 }
 if(!verses.length)throw new Error('No verses found in this Bible.');
 return {name:String(root['@biblename']??root['@n']??'Imported Bible'),verses};
}
