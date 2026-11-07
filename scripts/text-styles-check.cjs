const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'worship-text-'));
 const packaged=process.argv.includes('--packaged');
 const app=await electron.launch({...(packaged?{executablePath:path.resolve('release/win-unpacked/Worship Studio.exe')}:{ }),args:[...(!packaged?['.']:[]), '--user-data-dir='+dir],timeout:30000});
 try{
  const win=await app.firstWindow();
  await win.emulateMedia({reducedMotion:'reduce'});
  await win.getByText('Worship Studio walkthrough').waitFor();
  await win.getByRole('button',{name:'Close dialog',exact:true}).click();
  await win.getByRole('button',{name:'Presentation options',exact:true}).click();
  await win.getByRole('menuitem',{name:'Text formatting…',exact:true}).click();
  const dialog=win.locator('.text-style-dialog');
  await expect(dialog.getByLabel('Content type',{exact:true})).toBeEnabled();
  const canvas=dialog.locator('.studio-slide');
  const box=await canvas.boundingBox();
  if(box.height<150)throw new Error('Preview collapsed');
  await dialog.getByLabel('Maximum font size',{exact:true}).fill('96');
  await dialog.getByRole('button',{name:'Align left',exact:true}).click();
  await dialog.getByLabel('Content type',{exact:true}).selectOption('bible');
  await dialog.getByLabel('Content type',{exact:true}).selectOption('song');
  await expect(dialog.getByLabel('Maximum font size',{exact:true})).toHaveValue('96');
  await dialog.getByRole('button',{name:'Apply text style',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('Text style applied.');
  const result=await win.evaluate(async()=>{
   const before=await window.studio.themes('initial');
   const selected=before.config.themes.find(t=>t.id===before.config.typeThemes.song);
   await window.studio.themes('apply-text-style',{theme:selected,kind:'song'});
   const after=await window.studio.themes('initial');
   return {selected,count:before.config.themes.length,next:after.config.themes.length};
  });
  if(result.selected.style.maxFontSize!==96||result.selected.style.align!=='left'||result.count!==result.next)throw new Error('Save or reuse failed');
  await dialog.getByLabel('Maximum font size',{exact:true}).fill('401');
  await expect(dialog.getByRole('button',{name:'Apply text style',exact:true})).toBeDisabled();
  await dialog.getByLabel('Maximum font size',{exact:true}).fill('96');
  await win.evaluate(require('axe-core').source);
  const audit=await win.evaluate(()=>window.axe.run(document.querySelector('.text-style-dialog')));
  if(audit.violations.length)throw new Error(JSON.stringify(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
  for(const theme of ['dark','high-contrast']){
   await win.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   const themed=await win.evaluate(()=>window.axe.run(document.querySelector('.text-style-dialog')));
   if(themed.violations.length)throw new Error(theme+': '+JSON.stringify(themed.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));
  }
  await win.evaluate(()=>document.documentElement.dataset.theme='light');
  await win.screenshot({path:'release/text-styles-2.0.0.png'});
  await win.setViewportSize({width:700,height:700});
  const overflow=await dialog.evaluate(d=>d.scrollWidth>d.clientWidth||d.querySelector('.dialog-body').scrollWidth>d.querySelector('.dialog-body').clientWidth);
  if(overflow)throw new Error('Dialog overflows narrow viewport');
  await win.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  console.log('Text styles: visible preview, draft retention, persistence, repeated save, validation, accessibility and narrow layout passed.');
 }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});

