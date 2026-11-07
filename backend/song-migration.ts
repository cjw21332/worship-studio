import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,statSync} from 'node:fs';
import {normalizeSong,songStorageRecord} from './songs';

type Row={id:string;title:string;lyrics:string;author:string|null;copyright:string|null;detail:string};
const hashes=(db:DatabaseSync)=>new Map((db.prepare('SELECT id,lyrics FROM songs').all() as Pick<Row,'id'|'lyrics'>[]).map(row=>[row.id,createHash('sha256').update(row.lyrics,'utf8').digest('hex')]));
const equal=(left:Map<string,string>,right:Map<string,string>)=>left.size===right.size&&[...left].every(([id,hash])=>right.get(id)===hash);

/** Snapshot the whole database with SQLite, so uncheckpointed WAL data is included. */
export function backupSongsDatabase(db:DatabaseSync,path:string){
 if(path===':memory:')return undefined;
 const name=path+'.song-v8-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.bak';
 db.prepare('VACUUM INTO ?').run(name);
 const backup=new DatabaseSync(name,{readOnly:true});
 try{
  if(backup.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok'||!equal(hashes(db),hashes(backup)))throw new Error('Song database backup verification failed.');
 }finally{backup.close();}
 return name;
}

/** Preserve legacy section arrays and unknown metadata until equivalence is proven. */
export function migrateSongDatabase(db:DatabaseSync,backupPath?:string){
 db.exec('PRAGMA foreign_keys=OFF');
 try{
  db.exec('BEGIN IMMEDIATE');
  try{
   const before=hashes(db);
   if(backupPath){const backup=new DatabaseSync(backupPath,{readOnly:true});try{if(!equal(before,hashes(backup)))throw new Error('Songs changed after the backup; migration was canceled.');}finally{backup.close();}}
   const violations=JSON.stringify(db.prepare('PRAGMA foreign_key_check').all());
   db.exec("CREATE TABLE songs_v8(id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,lyrics TEXT NOT NULL,author TEXT,copyright TEXT,detail TEXT NOT NULL DEFAULT '{}')");
   const insert=db.prepare('INSERT INTO songs_v8(id,title,lyrics,author,copyright,detail) VALUES(?,?,?,?,?,?)');
   for(const row of db.prepare('SELECT id,title,lyrics,author,copyright,detail FROM songs').all() as Row[]){
    let detail=row.detail;
    try{
     const old=JSON.parse(row.detail) as Record<string,unknown>;
     const song=normalizeSong({...old,...row,author:row.author||'',copyright:row.copyright||''});
     const compact=songStorageRecord(song,{language:'',linesPerSlide:0}).detail;
     if(typeof old.tempo==='number'&&old.tempo!==0&&(old.tempo<20||old.tempo>300))compact.tempo=old.tempo;
     // Unknown or non-derivable legacy values remain available to older readers.
     for(const [key,value] of Object.entries(old)){
      if(key==='lyrics'&&value===row.lyrics)continue;
      if(key==='title'&&value===row.title)continue;
      if(key==='author'&&value===row.author)continue;
      if(key==='copyright'&&value===row.copyright)continue;
      if(key==='authors'&&song.author===(row.author||''))continue;
      if(key==='sections') {compact.sections=value;continue;}
      if(key==='arrangement'&&JSON.stringify(value)===JSON.stringify(song.sections.map(s=>s.id)))continue;
      if(['publisher','ccliNumber','key','notes','backgroundId','themeId','tempo','tags','language','linesPerSlide','createdAt','updatedAt','arrangement'].includes(key))continue;
      compact[key]=value;
     }
     detail=JSON.stringify(compact);
    }catch{/* Preserve opaque or invalid legacy records without data loss. */}
    insert.run(row.id,row.title,row.lyrics,row.author?.trim()?row.author:null,row.copyright?.trim()?row.copyright:null,detail);
   }
   db.exec('DROP TABLE songs; ALTER TABLE songs_v8 RENAME TO songs; CREATE INDEX songs_title ON songs(title)');
   if(!equal(before,hashes(db))||JSON.stringify(db.prepare('PRAGMA foreign_key_check').all())!==violations)throw new Error('Song migration verification failed.');
   db.exec('PRAGMA user_version=8; COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }finally{db.exec('PRAGMA foreign_keys=ON');}
}

export function optimizeSongDatabase(db:DatabaseSync,path:string){
 if(path===':memory:')throw new Error('A persistent workspace is required to optimize the library.');
 const backupPath=backupSongsDatabase(db,path)!;
 const before=hashes(db),backup=new DatabaseSync(backupPath,{readOnly:true});
 try{if(!equal(before,hashes(backup)))throw new Error('Songs changed after the backup; optimization was canceled.');}finally{backup.close();}
 const size=()=>[path,path+'-wal'].reduce((sum,file)=>sum+(existsSync(file)?statSync(file).size:0),0);
 const beforeBytes=size();
 db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE)');
 if(!equal(before,hashes(db)))throw new Error('Song content changed while the library was being optimized. The backup is available at '+backupPath);
 return {bytesSaved:beforeBytes-size(),songsUnchanged:before.size};
}
