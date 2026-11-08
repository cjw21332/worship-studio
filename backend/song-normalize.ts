/** Canonical user input helpers shared by the editor and persistence layer. */
export const songLimits={title:120,authors:200,copyright:300,publisher:120,comments:1000,lyrics:50000} as const;
export function cleanSongText(value:unknown){return String(value??'').normalize('NFC').replace(/\r\n?/g,'\n').trim();}
export function cleanSongLyrics(value:unknown){return String(value??'').normalize('NFC').replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/[\t ]+$/g,'')).join('\n').replace(/^\s*\n|\n\s*$/g,'').trim();}
export function normalizedAuthors(value:unknown){const input=Array.isArray(value)?value:String(value??'').split(';');const seen=new Set<string>();return input.map(cleanSongText).filter(name=>{const key=name.toLocaleLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;});}
export function normalizedTags(value:unknown){const input=Array.isArray(value)?value:String(value??'').split(',');return [...new Set(input.map(item=>cleanSongText(item).toLocaleLowerCase()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
export function normalizedTitleKey(value:string){return value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
export function normalizedLyricKey(value:string){return cleanSongLyrics(value).toLocaleLowerCase().replace(/\s+/g,' ');}
/** Deterministic 64-bit FNV-1a; used only to find likely duplicates, not for security. */
export function lyricHash(value:string){let hash=0xcbf29ce484222325n;for(const byte of new TextEncoder().encode(normalizedLyricKey(value))){hash=BigInt.asUintN(64,(hash^BigInt(byte))*0x100000001b3n);}return hash.toString(16).padStart(16,'0');}
export function suggestSongTitle(lyrics:string){for(const line of cleanSongLyrics(lyrics).split('\n')){const trimmed=line.trim();if(!trimmed||/^(---+|\[slide\]|<split>)$/i.test(trimmed)||/^\s*(?:\[\s*)?(?:verse|chorus|bridge|pre[- ]?chorus|tag|intro|outro|end|[vcbptioe])\s*\d*\s*\]?\s*:?\s*$/i.test(trimmed))continue;const plain=trimmed.replace(/\[(?:[A-G](?:#|b)?[^\]\n]*|N\.?C\.?)\]/g,'').trim();if(plain)return Array.from(plain).slice(0,60).join('');}return '';}
export function songDraftErrors(input:{title:string;lyrics:string;authors?:string;copyright?:string;publisher?:string;comments?:string;tempo?:number|string;key?:string;ccliNumber?:string;tags?:string[]}){
 const errors:Record<string,string>={};for(const key of Object.keys(songLimits) as (keyof typeof songLimits)[]){const value=String(input[key]??'');if(value.length>songLimits[key])errors[key]='Too long';}
 if(!input.title.trim())errors.title='Enter a title.';if(!input.lyrics.trim())errors.lyrics='Enter lyrics.';
 if(input.key&&!/^[A-G](#|b)?m?$/.test(input.key))errors.key='Choose a valid key.';
 const tempo=Number(input.tempo||0);if(tempo!==0&&(!Number.isFinite(tempo)||tempo<20||tempo>300))errors.tempo='Enter a tempo from 20 to 300.';
 if(input.ccliNumber&&!/^\d{1,10}$/.test(input.ccliNumber))errors.ccliNumber='Use up to 10 digits.';
 const tags=normalizedTags(input.tags||[]);if(tags.length>10||tags.some(tag=>tag.length>30))errors.tags='Use up to 10 tags, each 30 characters or less.';
 return errors;
}
