import {readdirSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {openStore} from '../backend/database';
import {parseSongFile} from '../backend/songs';
import {parseBibleImport} from '../backend/bible';

const [songDir,bibleDir]=process.argv.slice(2);
if(!songDir||!bibleDir)throw new Error('Usage: npx tsx scripts/build-starting-library.ts <songs folder> <bibles folder>');
mkdirSync('resources',{recursive:true});
const target=path.resolve('resources/starting-library.db');
for(const suffix of ['', '-wal','-shm'])rmSync(target+suffix,{force:true});
const store=openStore(target),errors:string[]=[];
const decode=(buffer:Buffer)=>buffer[0]===0xff&&buffer[1]===0xfe?buffer.subarray(2).toString('utf16le'):buffer.toString('utf8').replace(/^\uFEFF/,'');
let songs=0,bibles=0;const seen=new Set<string>();
for(const name of readdirSync(songDir).filter(n=>n.toLowerCase().endsWith('.xml')).sort()){
 try{const content=decode(readFileSync(path.join(songDir,name))).replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi,'&amp;');const parsed=parseSongFile(content,/openlyrics\.info\/namespace/i.test(content)?'openlyrics':'opensong',name);if(!parsed.length)throw new Error('No songs found');for(const song of parsed){store.saveSong(song);songs++;}}
 catch(error){errors.push(`Song ${name}: ${String(error)}`);}
}
for(const name of readdirSync(bibleDir).filter(n=>n.toLowerCase().endsWith('.xml')).sort()){
 try{const bytes=readFileSync(path.join(bibleDir,name)),hash=createHash('sha256').update(bytes).digest('hex');if(seen.has(hash)){console.log(`Duplicate Bible skipped: ${name}`);continue;}seen.add(hash);const document=parseBibleImport(decode(bytes));const result=store.bible.importBibleDocument(document);console.log(`Bible: ${name}: ${document.name}, ${result.verseCount} verses`);bibles++;}
 catch(error){errors.push(`Bible ${name}: ${String(error)}`);}
}
store.close();
console.log(`Starting library: ${songs} songs, ${bibles} Bibles, ${errors.length} errors`);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
