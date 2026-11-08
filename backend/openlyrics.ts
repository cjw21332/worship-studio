import type {SongContent} from './songs';

const xml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
/** OpenLyrics 0.8 is used for broad interoperability; unsupported chords are reported. */
export function exportOpenLyrics(song:SongContent){
 const warnings:string[]=[],names=new Map<string,string>(),counts:Record<string,number>={};
 const prefixes:Record<string,string>={verse:'v',chorus:'c',bridge:'b',prechorus:'p',tag:'t',intro:'i',outro:'o',end:'e'};
 for(const section of song.sections){const prefix=prefixes[section.type]||'v',number=section.label.match(/\s+(\d+)$/)?.[1]||'';counts[prefix]=(counts[prefix]||0)+1;let name=prefix+number;if([...names.values()].includes(name))name=prefix+counts[prefix];while([...names.values()].includes(name))name=prefix+(++counts[prefix]);names.set(section.id,name);}
 const canonical=song.sections.map(section=>{const name=names.get(section.id)!,number=name.slice(1),label=section.type[0].toUpperCase()+section.type.slice(1)+(number?' '+number:'');return label+'\n'+section.lines.join('\n');}).join('\n\n');
 if(song.lyrics!==canonical||song.sections.some(section=>section.lines.some(line=>!line.trim())))warnings.push('Some section labels or lyric formatting may change on import.');
 const text=(tag:string,value:string)=>value?`<${tag}>${xml(value)}</${tag}>`:'';
 const authors=song.authors.length?'<authors>'+song.authors.map(author=>text('author',author)).join('')+'</authors>':'';
 const customOrder=JSON.stringify(song.arrangement)!==JSON.stringify(song.sections.map(s=>s.id));
 const properties='<titles>'+text('title',song.title)+'</titles>'+authors+text('copyright',song.copyright)+text('publisher',song.publisher)+text('ccliNo',song.ccliNumber)+(song.notes?'<comments>'+text('comment',song.notes)+'</comments>':'')+text('key',song.key)+(song.tempo?`<tempo type="${song.tempo>=30&&song.tempo<=250?'bpm':'text'}">${song.tempo}</tempo>`:'')+text('keywords',song.tags.join(', '))+(customOrder?text('verseOrder',song.arrangement.map(id=>names.get(id)).join(' ')):'');
 if(song.tempo&&(song.tempo<30||song.tempo>250))warnings.push('Tempo is outside the OpenLyrics BPM range and was saved as text.');
 const encodeLine=(line:string)=>{
  let result='',position=0;const chords=/\[([^\]\n]+)\]/g;
  for(const match of line.matchAll(chords)){result+=xml(line.slice(position,match.index));position=match.index!+match[0].length;const chord=match[1];if(/^[A-G](?:#|b)?(?:maj|min|m|M|sus|dim|aug|add)?\d*(?:sus\d+|add\d+)?(?:\/[A-G](?:#|b)?)?$/.test(chord))result+=`<chord name="${xml(chord)}"/>`;else{warnings.push('Unsupported chord was omitted: '+chord);}}
  return result+xml(line.slice(position));
 };
 const verses=song.sections.map(section=>{
  const groups:string[][]=[[]];for(const line of section.lines){if(/^(---+|\[slide\]|<split>)$/i.test(line.trim())||!line.trim())groups.push([]);else groups[groups.length-1].push(line);}
  return `<verse name="${names.get(section.id)}">`+groups.filter(group=>group.length).map(group=>'<lines>'+group.map(encodeLine).join('<br/>')+'</lines>').join('')+'</verse>';
 }).join('');
 const now=new Date().toISOString();
 return {xml:`<?xml version="1.0" encoding="UTF-8"?>\n<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.8" createdIn="Worship Studio" modifiedIn="Worship Studio" modifiedDate="${now}"><properties>${properties}</properties><lyrics>${verses}</lyrics></song>\n`,warnings};
}
