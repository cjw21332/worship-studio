import { openStore } from '../backend/database';
import { homedir } from 'node:os';
import { join } from 'node:path';

const workspaceRoot = join(homedir(), 'AppData', 'Roaming', 'worship-studio');
const store = openStore(join(workspaceRoot, 'workspace.db'));

const songs = store.listSongs();
console.log(`Analyzing ${songs.length} songs in database...`);

let fixedCount = 0;

for (const song of songs) {
  if (!song.sections || song.sections.length === 0) continue;
  
  const sectionIds = new Set(song.sections.map(s => s.id));
  const arrangementIds = new Set(song.arrangement || []);
  
  // Find sections that exist in the song but are missing from arrangement
  const missingSectionIds = song.sections.filter(s => !arrangementIds.has(s.id)).map(s => s.id);
  
  if (missingSectionIds.length > 0) {
    console.log(`Fixing song: "${song.title}" (${song.id}) - missing ${missingSectionIds.length} sections in arrangement`);
    
    // Re-build full default arrangement containing all sections in order
    const newArrangement = song.sections.map(s => s.id);
    
    // Update the song
    store.updateSong(song.id, {
      ...song,
      arrangement: newArrangement
    });
    
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} songs where sections were missing from arrangement.`);

store.close();
