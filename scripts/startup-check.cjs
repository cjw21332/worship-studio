const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'worship-check-'));
 const app=await electron.launch({args:['.',`--user-data-dir=${dir}`],timeout:30000});
 try {
  const win=await app.firstWindow({timeout:30000});
  await win.waitForLoadState('domcontentloaded');
  await win.getByText('Worship Studio walkthrough').waitFor({timeout:15000});
  await win.getByRole('button',{name:'Next topic'}).click();
  await win.getByRole('heading',{name:'Songs',exact:true}).waitFor();
  await win.getByRole('button',{name:'Close dialog',exact:true}).click();
  await win.getByText('Library',{exact:true}).first().waitFor();
  await win.getByRole('menuitem',{name:'Library',exact:true}).click();
  await win.getByRole('menuitem',{name:'New song',exact:true}).click();
  const lyrics=win.getByRole('textbox',{name:'Lyrics'});
  await lyrics.fill('Verse 1\nAmazing grace\nPre- chorus\nSing again\nChorus\nHallelujah');
  const headers=await win.locator('.lyrics-header').allTextContents();
  if(headers.map(s=>s.trim()).join('|')!=='Verse 1|Pre- chorus|Chorus')throw new Error('Section headings are not highlighted: '+headers);
  if(await lyrics.inputValue()!=='Verse 1\nAmazing grace\nPre- chorus\nSing again\nChorus\nHallelujah')throw new Error('Editor changed lyrics');
  await win.getByRole('button',{name:'Cancel',exact:true}).click();
  await win.getByRole('button',{name:'Discard changes'}).click();
  console.log('Song editor highlights section labels and preserves lyrics.');
  const patternPromise=app.waitForEvent('window');
  await win.evaluate(()=>window.studio.identify());
  const pattern=await patternPromise;
  await pattern.waitForLoadState('domcontentloaded');
  for (const size of [{width:240,height:135},{width:320,height:180},{width:520,height:293},{width:200,height:100}]) {
   await pattern.setViewportSize(size);
   const layout=await pattern.evaluate(()=>{const root=document.documentElement,number=document.querySelector('.number').getBoundingClientRect();return {scrollWidth:root.scrollWidth,scrollHeight:root.scrollHeight,width:root.clientWidth,height:root.clientHeight,number:{left:number.left,right:number.right,top:number.top,bottom:number.bottom}}});
   if(layout.scrollWidth>layout.width||layout.scrollHeight>layout.height||layout.number.left<0||layout.number.right>layout.width||layout.number.top<0||layout.number.bottom>layout.height)throw new Error('Identify overlay does not fit: '+JSON.stringify(layout));
  }
  console.log('Identify overlay fits without scrolling at four window sizes.');
  const displays=await win.evaluate(()=>window.studio.outputs('list',{}));
  const displayId=displays.displays[0].id;
  const outputPromise=app.waitForEvent('window');
  await win.evaluate(id=>window.studio.outputs('arm',{role:'stage',displayId:id,windowed:true,split:'full'}),displayId);
  const output=await outputPromise;
  await output.waitForLoadState('domcontentloaded');
  const armed=await win.evaluate(()=>window.studio.outputs('list',{}));
  if(!armed.outputs.find(s=>s.role==='stage')?.armed)throw new Error('Stage output did not arm');
  await win.evaluate(()=>window.studio.outputs('disarm',{role:'stage'}));
  await win.evaluate(()=>window.studio.outputs('lock',{locked:true}));
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0,checkboxChecked:false});});
  const cancel=await win.evaluate(()=>window.studio.outputs('lock',{locked:false}));
  if(!cancel.message?.includes('canceled'))throw new Error('Lock cancellation was not handled');
  console.log('Windowed stage output armed and disarmed; lock cancellation handled.');
  console.log('Electron opened; walkthrough navigation and workspace rendered.');
 } finally {await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
