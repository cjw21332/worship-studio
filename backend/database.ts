import { DatabaseSync } from 'node:sqlite';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PortableService, type Verse } from './imports';
import {createBibleStore} from './bible-store';
import {canonicalBook} from './bible';
import {SongInput,normalizeSong,songStorageRecord,buildSlides,type Song,type SongContent} from './songs';
import {backupSongsDatabase,migrateSongDatabase,optimizeSongDatabase} from './song-migration';
import {normalizeDocument,AssetOptions,type MediaAsset,type MediaDocument,type MediaPage} from './media';
export {SongInput};
export type {Song};

export const songs = sqliteTable('songs', {id:text('id').primaryKey(), title:text('title').notNull(), lyrics:text('lyrics').notNull(), author:text('author'), copyright:text('copyright')});
export const items = sqliteTable('service_items', {id:text('id').primaryKey(), position:integer('position').notNull(), title:text('title').notNull(), slides:text('slides').notNull()});
export type Item = {id:string;position:number;title:string;slides:string[];kind?:string;sourceId?:string;notes?:string;stageSlides?:string[];sectionIds?:string[];songSnapshot?:SongContent;biblePages?:import('./bible').BiblePage[];mediaPages?:MediaPage[];mediaDocumentId?:string;autoAdvance?:boolean;loop?:boolean;durations?:number[];[key:string]:unknown};
export type Usage={id:string;songId:string|null;title:string;serviceName:string;usedAt:string;kind:'song'|'bible';reference:string;translations:string};
export function openStore(path:string) {
  const raw = new DatabaseSync(path); raw.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA cache_size = -64; PRAGMA temp_store = MEMORY;');
  const version = Number(raw.prepare('PRAGMA user_version').get()?.user_version);
  if (version > 8) {raw.close(); throw new Error('This database was created by a newer version.');}
  let backupPath:string|undefined;
  try{if(version<8&&raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='songs'").get())backupPath=backupSongsDatabase(raw,path);}catch(error){raw.close();throw error;}
  raw.exec('PRAGMA journal_mode = WAL;');
  if (version === 0) raw.exec(`BEGIN; CREATE TABLE songs(id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,lyrics TEXT NOT NULL,author TEXT NOT NULL DEFAULT '',copyright TEXT NOT NULL DEFAULT ''); CREATE INDEX songs_title ON songs(title); CREATE TABLE service_items(id TEXT PRIMARY KEY NOT NULL,position INTEGER NOT NULL UNIQUE,title TEXT NOT NULL,slides TEXT NOT NULL); PRAGMA user_version=1; COMMIT;`);
  if(version<2)raw.exec(`BEGIN; CREATE TABLE translations(id TEXT PRIMARY KEY,name TEXT NOT NULL); CREATE TABLE verses(translation_id TEXT NOT NULL REFERENCES translations(id) ON DELETE CASCADE,book TEXT NOT NULL,chapter INTEGER NOT NULL,verse INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(translation_id,book,chapter,verse)); PRAGMA user_version=2; COMMIT;`);
  if(version<3)raw.exec('BEGIN; CREATE TABLE assets(id TEXT PRIMARY KEY,name TEXT NOT NULL,title TEXT NOT NULL); PRAGMA user_version=3; COMMIT;');
  if(version<4)raw.exec(`BEGIN; ALTER TABLE songs ADD COLUMN detail TEXT NOT NULL DEFAULT '{}'; ALTER TABLE service_items ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'; CREATE TABLE usage_history(id TEXT PRIMARY KEY,song_id TEXT REFERENCES songs(id) ON DELETE SET NULL,title TEXT NOT NULL,service_name TEXT NOT NULL,used_at TEXT NOT NULL); CREATE INDEX usage_song ON usage_history(song_id,used_at);PRAGMA user_version=4;COMMIT;`);
  const bible=createBibleStore(raw);
  for(const translation of raw.prepare('SELECT id,name FROM translations').all() as {id:string;name:string}[]){
    if(bible.translations().some(t=>t.id===translation.id))continue;
    const legacy=raw.prepare('SELECT book,chapter,verse,body FROM verses WHERE translation_id=?').all(translation.id) as {book:string;chapter:number;verse:number;body:string}[];
    const mapped=legacy.map(v=>({...v,bookId:canonicalBook(v.book)?.id,text:v.body}));
    if(mapped.length&&mapped.every(v=>v.bookId))bible.importBibleDocument({format:'worship-studio-bible-v1',name:translation.name,verses:mapped},translation.id);
  }
  if(version<6)raw.exec(`BEGIN;ALTER TABLE assets ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';CREATE TABLE media_documents(id TEXT PRIMARY KEY,title TEXT NOT NULL,kind TEXT NOT NULL,document TEXT NOT NULL);CREATE TABLE media_backgrounds(scope TEXT NOT NULL,key TEXT NOT NULL,asset_id TEXT NOT NULL,PRIMARY KEY(scope,key));CREATE TABLE workspace_preferences(key TEXT PRIMARY KEY,value TEXT NOT NULL);PRAGMA user_version=6;COMMIT;`);
  if(version<7)raw.exec(`BEGIN;ALTER TABLE usage_history ADD COLUMN kind TEXT NOT NULL DEFAULT 'song';ALTER TABLE usage_history ADD COLUMN reference TEXT NOT NULL DEFAULT '';ALTER TABLE usage_history ADD COLUMN translations TEXT NOT NULL DEFAULT '';PRAGMA user_version=7;COMMIT;`);
  if(version<8){try{migrateSongDatabase(raw,backupPath);}catch(error){raw.close();throw error;}}
  let itemsCache:Item[]|undefined,itemsCacheVersion=-1;
  const listItems=():Item[]=>{
    const version=songVersion();
    if(!itemsCache||version!==itemsCacheVersion){
      itemsCache=(raw.prepare('SELECT id,position,title,slides,metadata FROM service_items ORDER BY position').all() as {id:string;position:number;title:string;slides:string;metadata:string}[]).map(({metadata,...i})=>({...JSON.parse(metadata),...i,slides:z.array(z.string()).parse(JSON.parse(i.slides))}));
      itemsCacheVersion=version;
    }
    return structuredClone(itemsCache);
  };
  type SongRow={id:string;title:string;lyrics:string;author:string|null;copyright:string|null;detail:string;usage_count:number;last_used:string|null};
  const selectSongs='SELECT s.id,s.title,s.lyrics,s.author,s.copyright,s.detail,(SELECT COUNT(*) FROM usage_history u WHERE u.song_id=s.id) AS usage_count,(SELECT MAX(used_at) FROM usage_history u WHERE u.song_id=s.id) AS last_used FROM songs s';
  const decodeSong=({detail,usage_count,last_used,...row}:SongRow):Song=>{
    const stored=JSON.parse(detail),song=normalizeSong({...stored,...row,author:row.author||'',copyright:row.copyright||''});
    if(!stored.createdAt||!stored.updatedAt)raw.prepare('UPDATE songs SET detail=? WHERE id=?').run(JSON.stringify({...stored,createdAt:stored.createdAt||song.createdAt,updatedAt:stored.updatedAt||song.updatedAt}),row.id);
    return {...song,id:row.id,usageCount:Number(usage_count||0),lastUsed:last_used};
  };
  let songCache:Song[]|undefined,songCacheVersion=-1;
  const songVersion=()=>{const changes=Number(raw.prepare('SELECT total_changes() AS changes').get()!.changes);const pragma=raw.prepare('PRAGMA data_version').get()!;const dataVersion=Number(pragma!.data_version||0);return changes * 1000000 + dataVersion;};
  const listSongs=():Song[]=>{
    const version=songVersion();
    if(!songCache||version!==songCacheVersion){
      songCache=(raw.prepare(selectSongs+' ORDER BY s.title COLLATE NOCASE').all() as SongRow[]).map(decodeSong);
      songCacheVersion=version;
    }
    // Callers may edit their copy; cached database records must remain immutable.
    return songCache.map(song=>({...song,usageCount:song.usageCount,lastUsed:song.lastUsed}));
  };
  const getSong=(id:string)=>{const row=raw.prepare(selectSongs+' WHERE s.id=?').get(id) as SongRow|undefined;if(!row)throw new Error('Song not found');return decodeSong(row);};
  const compact=(song:SongContent)=>songStorageRecord(song,{language:'en',linesPerSlide:0});
  const writeSong=(id:string,song:SongContent)=>{const record=compact(song),previous=raw.prepare('SELECT detail FROM songs WHERE id=?').get(id);if(previous){try{const old=JSON.parse(String(previous.detail));if(old.tempo===song.tempo&&song.tempo!==0&&(song.tempo<20||song.tempo>300))record.detail.tempo=song.tempo;}catch{/* Invalid legacy JSON is not replaced by a successful normal edit. */}}const result=raw.prepare('UPDATE songs SET title=?,lyrics=?,author=?,copyright=?,detail=? WHERE id=?').run(record.title,record.lyrics,record.author,record.copyright,JSON.stringify(record.detail),id);if(!result.changes)throw new Error('Song not found');};
  const insertSong=(input:unknown)=>{const record=compact(normalizeSong(input)),id=randomUUID();raw.prepare('INSERT INTO songs(id,title,lyrics,author,copyright,detail) VALUES(?,?,?,?,?,?)').run(id,record.title,record.lyrics,record.author,record.copyright,JSON.stringify(record.detail));return id;};
  const transaction=<T>(operation:()=>T):T=>{raw.exec('BEGIN IMMEDIATE');try{const result=operation();raw.exec('COMMIT');return result;}catch(error){raw.exec('ROLLBACK');throw error;}};
  // Only consolidate records with identical content and metadata; matching titles alone can be different arrangements.
  const duplicateGroups=()=>{
   const groups=new Map<string,string[]>();
   const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
   for(const row of raw.prepare('SELECT id,title,lyrics,author,copyright,detail FROM songs ORDER BY rowid').all() as {id:string;title:string;lyrics:string;author:string|null;copyright:string|null;detail:string}[]){
    try{const detail=JSON.parse(row.detail);delete detail.createdAt;delete detail.updatedAt;
     if(Array.isArray(detail.sections)){const ids=new Map(detail.sections.map((section:any,index:number)=>[section.id,index]));detail.sections=detail.sections.map(({id,...rest}:any)=>rest);if(Array.isArray(detail.arrangement))detail.arrangement=detail.arrangement.map((id:string)=>ids.has(id)?ids.get(id):id);}
     const key=JSON.stringify(sorted({title:row.title,lyrics:row.lyrics,author:row.author||'',copyright:row.copyright||'',detail}));const group=groups.get(key)||[];group.push(row.id);groups.set(key,group);
    }catch{/* Opaque metadata is never merged automatically. */}
   }
   return [...groups.values()].filter(group=>group.length>1);
  };
  const songSnapshot=(song:Song,maxLines=4)=>{const slides=buildSlides(song,song.linesPerSlide??maxLines);const {id,usageCount:_,lastUsed:__,...snapshot}=song;return {slides:slides.map(s=>s.text),metadata:JSON.stringify({kind:'song',sourceId:id,notes:song.notes,stageSlides:slides.map(s=>s.stageText),sectionIds:slides.map(s=>s.sectionId),songSnapshot:snapshot})};};
  const decodeAsset=({metadata,...asset}:{id:string;name:string;title:string;metadata:string}):MediaAsset=>{const extra=JSON.parse(metadata);return {...extra,...asset,kind:extra.kind==='video'?'video':'image',options:AssetOptions.parse(extra.options||{})};};
  const asset=(id:string)=>{const row=raw.prepare('SELECT id,name,title,metadata FROM assets WHERE id=?').get(id) as {id:string;name:string;title:string;metadata:string}|undefined;return row?decodeAsset(row):undefined;};
  return {
    bible,
    seedStartingLibrary:(file:string)=>{
      if(raw.prepare("SELECT 1 FROM workspace_preferences WHERE key='starting-library-v1'").get())return;
      raw.prepare('ATTACH DATABASE ? AS starter').run(file);
      try{transaction(()=>{
       raw.exec(`INSERT OR IGNORE INTO songs(id,title,lyrics,author,copyright,detail)
        SELECT s.id,s.title,s.lyrics,s.author,s.copyright,s.detail FROM starter.songs s
        WHERE NOT EXISTS (SELECT 1 FROM songs existing WHERE existing.title=s.title AND existing.lyrics=s.lyrics);
        INSERT OR IGNORE INTO canonical_translations SELECT * FROM starter.canonical_translations;
        INSERT OR IGNORE INTO canonical_verses SELECT * FROM starter.canonical_verses;
        INSERT INTO workspace_preferences(key,value) VALUES('starting-library-v1','true');`);
      });}finally{raw.exec('DETACH DATABASE starter');}
    },
    seedBundledBibles:(file:string)=>{
      const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
      if(ids.every(id=>bible.translations().some(t=>t.id===id)))return;
      raw.prepare('ATTACH DATABASE ? AS bundled').run(file);
      try{transaction(()=>{
       raw.exec('INSERT OR IGNORE INTO canonical_translations SELECT * FROM bundled.canonical_translations');
       raw.exec('INSERT OR IGNORE INTO canonical_verses SELECT * FROM bundled.canonical_verses');
      });}finally{raw.exec('DETACH DATABASE bundled');}
    },
    assets:()=> (raw.prepare('SELECT id,name,title,metadata FROM assets ORDER BY title').all() as {id:string;name:string;title:string;metadata:string}[]).map(decodeAsset),
    asset,
    removeAssetFromLibrary:(id:string)=>{const row=raw.prepare('SELECT metadata FROM assets WHERE id=?').get(z.string().uuid().parse(id));if(!row)throw new Error('Media file not found.');const metadata=JSON.parse(String(row.metadata));metadata.hiddenFromLibrary=true;raw.prepare('UPDATE assets SET metadata=? WHERE id=?').run(JSON.stringify(metadata),id);},
    saveAsset:(asset:{id:string;name:string;title:string}&Partial<MediaAsset>)=>{const {id,name,title,...metadata}=asset;raw.prepare('INSERT INTO assets(id,name,title,metadata) VALUES(?,?,?,?)').run(id,name,title,JSON.stringify(metadata));},
    updateAsset:(id:string,input:unknown)=>{const current=asset(id);if(!current)throw new Error('Media file not found.');const patch=z.object({title:z.string().trim().min(1).max(200).optional(),options:AssetOptions.optional(),thumbnail:z.string().max(200).optional()}).parse(input),updated={...current,...patch};const {id:_,name:__,title,...metadata}=updated;raw.prepare('UPDATE assets SET title=?,metadata=? WHERE id=?').run(title,JSON.stringify(metadata),id);return updated;},
    documents:()=> (raw.prepare('SELECT document FROM media_documents ORDER BY title COLLATE NOCASE').all() as {document:string}[]).map(row=>JSON.parse(row.document) as MediaDocument&{id:string}),
    saveDocument:(input:unknown)=>{const document=normalizeDocument(input),id=document.id||randomUUID();raw.prepare('INSERT INTO media_documents(id,title,kind,document) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,kind=excluded.kind,document=excluded.document').run(id,document.title,document.kind,JSON.stringify({...document,id}));return id;},
    deleteDocument:(id:string)=>raw.prepare('DELETE FROM media_documents WHERE id=?').run(z.string().uuid().parse(id)),
    setMediaBackground:(scope:string,key:string,assetId:string|null)=>{z.enum(['service','item','song','section']).parse(scope);z.string().min(1).max(300).parse(key);if(assetId===null)raw.prepare('DELETE FROM media_backgrounds WHERE scope=? AND key=?').run(scope,key);else{if(!asset(z.string().uuid().parse(assetId)))throw new Error('Background media not found.');raw.prepare('INSERT INTO media_backgrounds VALUES(?,?,?) ON CONFLICT(scope,key) DO UPDATE SET asset_id=excluded.asset_id').run(scope,key,assetId);}},
    mediaBackground:(scope:string,key:string)=>(raw.prepare('SELECT asset_id FROM media_backgrounds WHERE scope=? AND key=?').get(scope,key)?.asset_id as string|undefined),
    getPreference:(key:string)=>{const value=raw.prepare('SELECT value FROM workspace_preferences WHERE key=?').get(key)?.value;return typeof value==='string'?JSON.parse(value):undefined;},
    setPreference:(key:string,value:unknown)=>{z.string().min(1).max(200).parse(key);const encoded=JSON.stringify(value);if(encoded===undefined||encoded.length>5_000_000)throw new Error('Preference data is too large or invalid.');raw.prepare('INSERT INTO workspace_preferences VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,encoded);},
    addSlides:(title:string,slides:string[],metadata:Record<string,unknown>={})=>{const position=Number(raw.prepare('SELECT COALESCE(MAX(position),-1)+1 AS n FROM service_items').get()?.n),id=randomUUID();raw.prepare('INSERT INTO service_items(id,position,title,slides,metadata) VALUES(?,?,?,?,?)').run(id,position,title,JSON.stringify(slides),JSON.stringify(metadata));return id;},
    exportService:()=>({format:'worship-studio-service-v1',items:listItems().map(({title,slides})=>({title,slides}))}),
    importService:(input:unknown)=>{const service=PortableService.parse(input);raw.exec('BEGIN IMMEDIATE');try{raw.exec('DELETE FROM service_items');service.items.forEach((i,n)=>raw.prepare('INSERT INTO service_items(id,position,title,slides) VALUES(?,?,?,?)').run(randomUUID(),n,i.title,JSON.stringify(i.slides)));raw.exec('COMMIT');}catch(error){raw.exec('ROLLBACK');throw error;}},
    importSongs:(input:unknown)=>{const records=z.object({format:z.enum(['worship-studio-songs-v1','worship-studio-songs-v2']),songs:z.array(SongInput).max(10000)}).parse(input);return transaction(()=>{for(const s of records.songs)insertSong(s);return records.songs.length;});},
    translations:()=>raw.prepare('SELECT id,name FROM translations ORDER BY name').all(),
    importBible:(name:string,verses:Verse[])=>{const id=randomUUID();raw.exec('BEGIN');try{raw.prepare('INSERT INTO translations VALUES(?,?)').run(id,name);const insert=raw.prepare('INSERT INTO verses VALUES(?,?,?,?,?)');for(const v of verses)insert.run(id,v.book,v.chapter,v.verse,v.text);raw.exec('COMMIT');return verses.length;}catch(error){raw.exec('ROLLBACK');throw error;}},
    searchBible:(id:string,query:string)=>raw.prepare('SELECT book,chapter,verse,body FROM verses WHERE translation_id=? AND (body LIKE ? OR book || \' \' || chapter || \':\' || verse LIKE ?) ORDER BY rowid LIMIT 100').all(id,'%'+query+'%','%'+query+'%'),
    addText:(title:string,body:string)=>{const position=Number(raw.prepare('SELECT COALESCE(MAX(position),-1)+1 AS n FROM service_items').get()?.n);raw.prepare('INSERT INTO service_items(id,position,title,slides) VALUES(?,?,?,?)').run(randomUUID(),position,title,JSON.stringify([body]));},
    listSongs,
    optimizeSongs:(change?:()=>void,onStage?:(stage:string)=>void)=>optimizeSongDatabase(raw,path,change,onStage),
    duplicateSongGroups:duplicateGroups,
    consolidateDuplicateSongs:(groups:string[][])=>transaction(()=>{
      const actual=duplicateGroups();if(JSON.stringify(actual)!==JSON.stringify(groups))throw new Error('Songs changed during optimization. Run it again.');
      const updateUsage=raw.prepare('UPDATE usage_history SET song_id=? WHERE song_id=?');
      const updateItems=raw.prepare("UPDATE service_items SET metadata=json_set(metadata,'$.sourceId',?) WHERE json_valid(metadata) AND json_extract(metadata,'$.sourceId')=?");
      const remove=raw.prepare('DELETE FROM songs WHERE id=?');
      for(const [keep,...duplicates] of groups)for(const id of duplicates){updateUsage.run(keep,id);updateItems.run(keep,id);remove.run(id);}
      return groups.reduce((sum,group)=>sum+group.length-1,0);
    }),
    saveSong:insertSong,
    syncSong:(id:string,input:unknown)=>{z.string().uuid().parse(id);const record=compact(normalizeSong(input));raw.prepare('INSERT INTO songs(id,title,lyrics,author,copyright,detail) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,lyrics=excluded.lyrics,author=excluded.author,copyright=excluded.copyright,detail=excluded.detail').run(id,record.title,record.lyrics,record.author,record.copyright,JSON.stringify(record.detail));return id;},
    listItems,
    replaceItems:(input:Item[])=>transaction(()=>{const rows=z.array(z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(200),slides:z.array(z.string().max(100000)).min(1).max(1000)}).passthrough()).max(5000).parse(input);if(new Set(rows.map(i=>i.id)).size!==rows.length)throw new Error('Service item IDs must be unique.');raw.exec('DELETE FROM service_items');for(const [position,row] of rows.entries()){const {id,title,slides,position:_,...metadata}=row;raw.prepare('INSERT INTO service_items(id,position,title,slides,metadata) VALUES(?,?,?,?,?)').run(id,position,title,JSON.stringify(slides),JSON.stringify(metadata));}}),
    updateItem:(id:string,patch:Record<string,unknown>)=>{const current=listItems().find(i=>i.id===id);if(!current)throw new Error('Service item not found.');const value={...current,...patch,id:current.id,position:current.position};z.string().trim().min(1).max(200).parse(value.title);z.array(z.string().max(100000)).min(1).max(1000).parse(value.slides);const {id:_,position:__,title,slides,...metadata}=value;raw.prepare('UPDATE service_items SET title=?,slides=?,metadata=? WHERE id=?').run(title,JSON.stringify(slides),JSON.stringify(metadata),id);},
    newService:()=>raw.exec('DELETE FROM service_items'),
    updateSong:(id:string,input:unknown)=>writeSong(id,normalizeSong(input,getSong(id))),
    deleteSong:(id:string)=>raw.prepare('DELETE FROM songs WHERE id=?').run(id),
    deleteSongs:(ids:string[])=>transaction(()=>{if(ids.length>10000||new Set(ids).size!==ids.length)throw new Error('Invalid song selection.');for(const id of ids){getSong(id);raw.prepare('DELETE FROM songs WHERE id=?').run(id);}}),
    recordUsage:(songId:string,serviceName='Untitled service')=>{const song=getSong(songId);raw.prepare('INSERT INTO usage_history(id,song_id,title,service_name,used_at) VALUES(?,?,?,?,?)').run(randomUUID(),songId,song.title,z.string().max(300).parse(serviceName),new Date().toISOString());},
    recordItemUsage:(item:Item,serviceName='Untitled service')=>{
      if(item.kind!=='song'&&item.kind!=='bible')return;
      const songId=item.kind==='song'&&item.sourceId&&raw.prepare('SELECT id FROM songs WHERE id=?').get(item.sourceId)?item.sourceId:null;
      const reference=item.kind==='bible'?[...new Set(item.biblePages?.map(p=>p.reference)||[])].join('; '):'';
      const translations=item.kind==='bible'?[...new Set(item.biblePages?.flatMap(p=>p.columns.map(c=>c.label))||[])].join('; '):'';
      raw.prepare('INSERT INTO usage_history(id,song_id,title,service_name,used_at,kind,reference,translations) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),songId,item.title,z.string().max(300).parse(serviceName),new Date().toISOString(),item.kind,reference,translations);
    },
    usageHistory:(songId?:string):Usage[]=>((songId?raw.prepare('SELECT * FROM usage_history WHERE song_id=? ORDER BY used_at DESC').all(songId):raw.prepare('SELECT * FROM usage_history ORDER BY used_at DESC').all()) as {id:string;song_id:string|null;title:string;service_name:string;used_at:string;kind:'song'|'bible';reference:string;translations:string}[]).map(r=>({id:r.id,songId:r.song_id,title:r.title,serviceName:r.service_name,usedAt:r.used_at,kind:r.kind,reference:r.reference,translations:r.translations})),
    updateServiceSong:(itemId:string,input:unknown,maxLines=4)=>{const item=listItems().find(i=>i.id===itemId);if(!item)throw new Error('Service item not found');const song=normalizeSong(input),snapshot=songSnapshot({...song,id:item.sourceId||'',usageCount:0,lastUsed:null},maxLines);raw.prepare('UPDATE service_items SET title=?,slides=?,metadata=? WHERE id=?').run(song.title,JSON.stringify(snapshot.slides),snapshot.metadata,itemId);},
    duplicateItem:(id:string)=>{const item=listItems().find(i=>i.id===id);if(!item)throw new Error('Service item not found');const position=Number(raw.prepare('SELECT COALESCE(MAX(position),-1)+1 AS n FROM service_items').get()?.n);const {id:_,position:__,title,slides,...metadata}=item;raw.prepare('INSERT INTO service_items(id,position,title,slides,metadata) VALUES(?,?,?,?,?)').run(randomUUID(),position,title,JSON.stringify(slides),JSON.stringify(metadata));},
    reorder:(ids:string[])=>{const current=listItems();if(ids.length!==current.length||new Set(ids).size!==ids.length||ids.some(id=>!current.some(i=>i.id===id)))throw new Error('Service changed. Refresh and try again.');raw.exec('BEGIN IMMEDIATE');try{raw.exec('UPDATE service_items SET position=-position-1');ids.forEach((id,index)=>raw.prepare('UPDATE service_items SET position=? WHERE id=?').run(index,id));raw.exec('COMMIT');}catch(error){raw.exec('ROLLBACK');throw error;}},
    addSong:(id:string,maxLines=4)=>{const song=getSong(id),snapshot=songSnapshot(song,maxLines);transaction(()=>{const position=Number(raw.prepare('SELECT COALESCE(MAX(position),-1)+1 AS n FROM service_items').get()?.n);raw.prepare('INSERT INTO service_items(id,position,title,slides,metadata) VALUES(?,?,?,?,?)').run(randomUUID(),position,song.title,JSON.stringify(snapshot.slides),snapshot.metadata);});},
    removeItem:(id:string)=>{raw.prepare('DELETE FROM service_items WHERE id=?').run(id);},
    close:()=>raw.close()
  };
}
