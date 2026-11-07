const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async()=>{
 const root=path.resolve('release/win-unpacked');
 for(const name of ['Songs','Bible Versions'])if(!fs.existsSync(path.join(root,'User Files',name,'README.txt')))throw new Error('Missing user files folder: '+name);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'worship-packaged-'));
 const app=await electron.launch({executablePath:path.join(root,'Worship Studio.exe'),args:[`--user-data-dir=${dir}`],timeout:30000});
 try{
  const win=await app.firstWindow({timeout:30000});
  await win.getByText('Worship Studio walkthrough').waitFor({timeout:15000});
  await win.getByRole('button',{name:'Close dialog',exact:true}).click();
  const status=await win.evaluate(()=>window.studio.outputs('list',{}));
  if(!status.displays.length)throw new Error('Backend did not return displays');
  const version=await win.evaluate(()=>window.studio.info());
  if(version.version!==require('../package.json').version)throw new Error('Incorrect app version: '+version.version);
  const result=await win.evaluate(async()=>{
   const id=await window.studio.createSong({title:'Test song',lyrics:'Verse 1\nFirst line\nSecond line\n\nChorus\nSing'});
   await window.studio.addSong(id);
   const items=await window.studio.service();
   await window.studio.preview({title:items[0].title,text:items[0].slides[0],itemId:items[0].id,index:0});
   return {songs:await window.studio.songs(),items,state:await window.studio.presentation()};
  });
  if(result.songs.length!==1||result.items[0].slides[0]!=='First line\nSecond line'||result.state.preview?.text!=='First line\nSecond line')throw new Error('Song creation, service or preview failed');
  console.log('Packaged app opened; version, song creation, service, preview, backend and user file folders passed.');
 }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
