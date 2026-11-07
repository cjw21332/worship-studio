import {copyFile, mkdir, access} from 'node:fs/promises';
await mkdir('dist-electron/resources',{recursive:true});
await copyFile('backend/export-powerpoint.ps1','dist-electron/export-powerpoint.ps1');
for (const [source,destination] of [['resources/bundled-bibles.db','dist-electron/resources/bundled-bibles.db'],['packaging/icon.ico','dist-electron/icon.ico']]) {
  try { await access(source); await copyFile(source,destination); }
  catch (error) { if (error.code !== 'ENOENT') throw error; console.warn(`Optional resource missing: ${source}`); }
}
