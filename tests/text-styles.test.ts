import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {themeHandlers} from '../backend/theme-handlers';
import {defaultThemeConfig,resolveTheme} from '../backend/themes';
import {initialPresentation} from '../backend/presentation';

test('text styles persist once, reach matching slides, respect item overrides and output lock',async()=>{
 const root=mkdtempSync(join(tmpdir(),'text-style-test-'));
 let state=initialPresentation(),locked=false;
 state.live={title:'Song',text:'Sing',itemId:'00000000-0000-4000-8000-000000000001'};
 state.preview={title:'Bible',text:'Read',itemId:'00000000-0000-4000-8000-000000000002'};
 const context={workspaceRoot:root,win:{} as any,getState:()=>state,setState:(next:typeof state)=>{state=next;},render:()=>{},canChange:()=>!locked,fontDiscovery:async()=>({fonts:['Segoe UI']}),resolveContext:(slide:any)=>({itemId:slide.itemId,kind:slide.title==='Bible'?'bible':'song'})};
 try{
  const service=themeHandlers(context),invoke=(payload:any)=>service.handlers['themes:action']({} as any,{action:'apply-text-style',payload});
  const theme=resolveTheme(defaultThemeConfig(),{kind:'song'});theme.style.maxFontSize=96;
  await invoke({theme,kind:'song'});
  assert.equal(state.live?.style?.maxFontSize,96);
  assert.equal(state.preview?.style?.maxFontSize,76);
  const count=service.getConfig().themes.length;
  theme.style.maxFontSize=120;await invoke({theme,kind:'song'});
  assert.equal(service.getConfig().themes.length,count);
  assert.equal(themeHandlers(context).resolveStyle({kind:'song'}).style.maxFontSize,120);
  const config=service.getConfig();config.itemThemes[state.live!.itemId!]='minimal';service.restoreConfig(config);
  await invoke({theme,kind:'song'});assert.equal(state.live?.style?.maxFontSize,68);
  locked=true;const before=service.getConfig();theme.style.maxFontSize=144;
  await assert.rejects(invoke({theme,kind:'song'}),/locked/);
  assert.deepEqual(service.getConfig(),before);
  locked=false;theme.style.maxFontSize=401;await assert.rejects(invoke({theme,kind:'song'}));
  assert.deepEqual(service.getConfig(),before);
 }finally{rmSync(root,{recursive:true,force:true});}
});
