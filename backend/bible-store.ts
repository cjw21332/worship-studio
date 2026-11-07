import type {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {BOOKS,parseBibleImport,parallelPassage,parseReference,type BibleImport,type BibleReference,type BibleVerse,type ParallelRow,type BibleDisplayMode} from './bible';

export type StoredTranslation={id:string;name:string;abbreviation:string;language:string;copyright:string;fontFamily:string;verseCount:number};
export type BiblePreferences={translationIds:string[];mode:BibleDisplayMode;versesPerSlide:number;showVerseNumbers:boolean};
export type SavedPassage={key:string;reference:BibleReference;translationIds:string[];favorite:boolean;lastUsed:string};
const idInput=z.string().uuid();
const endpoint=z.object({chapter:z.number().int().min(1).max(200),verse:z.number().int().min(1).max(1000).optional()});
const referenceInput=z.object({bookId:z.number().int().min(1).max(66),start:endpoint,end:endpoint});
const preferenceInput=z.object({translationIds:z.array(idInput).max(3),mode:z.enum(['single','parallel','stacked','line-by-line']),versesPerSlide:z.number().int().min(1).max(20),showVerseNumbers:z.boolean()});
const defaults:BiblePreferences={translationIds:[],mode:'single',versesPerSlide:1,showVerseNumbers:true};
const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
const literalLike=(text:string)=>'%'+text.replace(/[\\%_]/g,m=>'\\'+m)+'%';
function validateReference(input:unknown):BibleReference{
 const ref=referenceInput.parse(input),book=BOOKS[ref.bookId-1];
 if(ref.end.chapter<ref.start.chapter||(ref.end.chapter===ref.start.chapter&&(ref.end.verse??1000)<(ref.start.verse??1)))throw new Error('The end of a passage must follow its beginning.');
 return {...ref,book:book.name};
}
type VerseRecord={book_id:number;chapter:number;verse:number;body:string};
const fromRecord=(row:VerseRecord):BibleVerse=>({bookId:row.book_id,book:BOOKS[row.book_id-1].name,chapter:row.chapter,verse:row.verse,text:row.body});

/** Own tables allow migration from the legacy name-keyed Bible store without destroying it. */
export function createBibleStore(raw:DatabaseSync){
 raw.exec(`
  CREATE TABLE IF NOT EXISTS canonical_translations(
   id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,abbreviation TEXT NOT NULL,
   language TEXT NOT NULL,copyright TEXT NOT NULL,font_family TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS canonical_verses(
   translation_id TEXT NOT NULL REFERENCES canonical_translations(id) ON DELETE CASCADE,
   book_id INTEGER NOT NULL,chapter INTEGER NOT NULL,verse INTEGER NOT NULL,
   body TEXT NOT NULL,search_text TEXT NOT NULL,
   PRIMARY KEY(translation_id,book_id,chapter,verse)
  );
  CREATE TABLE IF NOT EXISTS bible_preferences(key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS bible_passages(
   key TEXT PRIMARY KEY NOT NULL,reference TEXT NOT NULL,translation_ids TEXT NOT NULL,
   favorite INTEGER NOT NULL DEFAULT 0,last_used TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS bible_passages_recency ON bible_passages(last_used DESC);
 `);
 const translations=():StoredTranslation[]=>(raw.prepare(`SELECT t.id,t.name,t.abbreviation,t.language,t.copyright,t.font_family AS fontFamily,
  (SELECT COUNT(*) FROM canonical_verses v WHERE v.translation_id=t.id) AS verseCount
  FROM canonical_translations t ORDER BY t.name`).all() as StoredTranslation[]).map(row=>({...row,verseCount:Number(row.verseCount)}));
 const translation=(id:string):StoredTranslation=>{idInput.parse(id);const row=translations().find(t=>t.id===id);if(!row)throw new Error('Bible translation not found. Import it or choose an installed translation.');return row;};
 const verses=(id:string,bookId?:number):BibleVerse[]=>{
  translation(id);if(bookId!==undefined)z.number().int().min(1).max(66).parse(bookId);
  const rows=bookId===undefined?raw.prepare('SELECT book_id,chapter,verse,body FROM canonical_verses WHERE translation_id=? ORDER BY book_id,chapter,verse').all(id):raw.prepare('SELECT book_id,chapter,verse,body FROM canonical_verses WHERE translation_id=? AND book_id=? ORDER BY chapter,verse').all(id,bookId);
  return (rows as VerseRecord[]).map(fromRecord);
 };
 const importBibleDocument=(input:unknown,id?:string):{id:string;verseCount:number}=>{
  const doc: BibleImport=parseBibleImport(JSON.stringify(input));const translationId=id===undefined?randomUUID():idInput.parse(id);
  raw.exec('SAVEPOINT bible_document');
  try{
   raw.prepare(`INSERT INTO canonical_translations(id,name,abbreviation,language,copyright) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,abbreviation=excluded.abbreviation,language=excluded.language,copyright=excluded.copyright`).run(translationId,doc.name,doc.abbreviation,doc.language,doc.copyright);
   raw.prepare('DELETE FROM canonical_verses WHERE translation_id=?').run(translationId);
   const insert=raw.prepare('INSERT INTO canonical_verses(translation_id,book_id,chapter,verse,body,search_text) VALUES(?,?,?,?,?,?)');
   for(const verse of doc.verses)insert.run(translationId,verse.bookId,verse.chapter,verse.verse,verse.text,normalize(verse.text));
   raw.exec('RELEASE bible_document');return {id:translationId,verseCount:doc.verses.length};
  }catch(error){raw.exec('ROLLBACK TO bible_document; RELEASE bible_document');throw error;}
 };
 const queryPassage=(ids:string[],input:BibleReference):ParallelRow[]=>{
  z.array(idInput).min(1).max(3).refine(values=>new Set(values).size===values.length,'Choose distinct translations.').parse(ids);
  const ref=validateReference(input);
  // Fetch only one canonical book per translation, never the full Bible for a passage.
  return parallelPassage(ids.map(id=>({...translation(id),verses:verses(id,ref.bookId)})),ref);
 };
 const search=(id:string,query:string,limit=100):BibleVerse[]=>{
  translation(id);const q=z.string().trim().min(1).max(200).parse(query);z.number().int().min(1).max(500).parse(limit);
  let reference:BibleReference|undefined;try{reference=parseReference(q);}catch{/* Ordinary words use local full-text search. */}
  if(reference)return queryPassage([id],reference).slice(0,limit).map(row=>({bookId:row.bookId,book:row.book,chapter:row.chapter,verse:row.verse,text:row.columns[0].missing?'':row.columns[0].text}));
  return (raw.prepare(`SELECT book_id,chapter,verse,body FROM canonical_verses WHERE translation_id=? AND search_text LIKE ? ESCAPE '\\' ORDER BY book_id,chapter,verse LIMIT ?`).all(id,literalLike(normalize(q)),limit) as VerseRecord[]).map(fromRecord);
 };
 const setTranslation=(id:string,input:unknown):void=>{
  const previous=translation(id),patch=z.object({name:z.string().trim().min(1).max(200).optional(),abbreviation:z.string().trim().min(1).max(40).optional(),language:z.string().max(40).optional(),copyright:z.string().max(2000).optional(),fontFamily:z.string().max(200).optional()}).strict().parse(input);
  const next={...previous,...patch};raw.prepare('UPDATE canonical_translations SET name=?,abbreviation=?,language=?,copyright=?,font_family=? WHERE id=?').run(next.name,next.abbreviation,next.language,next.copyright,next.fontFamily,id);
 };
 const preferences=():BiblePreferences=>{
  const row=raw.prepare("SELECT value FROM bible_preferences WHERE key='display'").get() as {value:string}|undefined;
  if(!row)return {...defaults,translationIds:[]};
  try{return preferenceInput.parse(JSON.parse(row.value));}catch{return {...defaults,translationIds:[]};}
 };
 const setPreferences=(patch:unknown):BiblePreferences=>{
  const partial=preferenceInput.partial().strict().parse(patch),next=preferenceInput.parse({...preferences(),...partial});
  for(const id of next.translationIds)translation(id);
  raw.prepare("INSERT INTO bible_preferences(key,value) VALUES('display',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(next));return next;
 };
 const savedPassages=(onlyFavorites:boolean,limit=20):SavedPassage[]=>{
  z.number().int().min(1).max(500).parse(limit);
  const rows=raw.prepare(`SELECT key,reference,translation_ids,favorite,last_used FROM bible_passages ${onlyFavorites?'WHERE favorite=1':''} ORDER BY last_used DESC,key LIMIT ?`).all(limit) as {key:string;reference:string;translation_ids:string;favorite:number;last_used:string}[];
  return rows.map(row=>({key:row.key,reference:validateReference(JSON.parse(row.reference)),translationIds:z.array(idInput).min(1).max(3).parse(JSON.parse(row.translation_ids)),favorite:!!row.favorite,lastUsed:row.last_used}));
 };
 const rememberPassage=(reference:BibleReference,translationIds:string[],favorite=false):string=>{
  const ref=validateReference(reference);z.array(idInput).min(1).max(3).parse(translationIds);z.boolean().parse(favorite);for(const id of translationIds)translation(id);
  const key=[ref.bookId,ref.start.chapter,ref.start.verse??'',ref.end.chapter,ref.end.verse??'',...translationIds].join(':');
  raw.prepare(`INSERT INTO bible_passages(key,reference,translation_ids,favorite,last_used) VALUES(?,?,?,?,?)
   ON CONFLICT(key) DO UPDATE SET last_used=excluded.last_used,favorite=MAX(bible_passages.favorite,excluded.favorite)`).run(key,JSON.stringify(ref),JSON.stringify(translationIds),favorite?1:0,new Date().toISOString());
  // Bounded recent history preserves all favorites.
  raw.exec('DELETE FROM bible_passages WHERE favorite=0 AND key NOT IN (SELECT key FROM bible_passages ORDER BY last_used DESC LIMIT 200)');return key;
 };
 return {importBibleDocument,translations,translation,verses,queryPassage,search,setTranslation,preferences,setPreferences,rememberPassage,
  favorites:(limit=100)=>savedPassages(true,limit),recent:(limit=20)=>savedPassages(false,limit),
  removePassage:(key:string)=>{z.string().min(1).max(500).parse(key);raw.prepare('DELETE FROM bible_passages WHERE key=?').run(key);},
  removeFavorite:(key:string)=>{z.string().min(1).max(500).parse(key);raw.prepare('UPDATE bible_passages SET favorite=0 WHERE key=?').run(key);},
  exportBible:(id:string):BibleImport=>{const row=translation(id);return {format:'worship-studio-bible-v1',name:row.name,abbreviation:row.abbreviation,language:row.language,copyright:row.copyright,verses:verses(id)};}
 };
}
