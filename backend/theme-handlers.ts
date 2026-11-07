import type {BrowserWindow,IpcMainInvokeEvent} from 'electron';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,statSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ThemeSchema,ThemeScopeSchema,defaultThemeConfig,normalizeThemeConfig,resolveTheme,applyThemeScope,parseThemeFile,exportTheme,withFontFallback,validateThemeFonts,themeContrast,type Theme,type ThemeConfig,type ThemeScope} from './themes';
import {updatePresentation,type Presentation,type Slide} from './presentation';
type ThemeContext={workspaceRoot:string;win:BrowserWindow;getState:()=>Presentation;setState:(state:Presentation)=>unknown;render:()=>Promise<unknown>|void;canChange?:()=>boolean|void|Promise<boolean|void>;resolveContext?:(slide:Slide)=>{itemId?:string;kind?:string};onApply?:(config:ThemeConfig,scope:ThemeScope,theme:Theme)=>unknown|Promise<unknown>;fontDiscovery?:typeof installedFonts};
export async function installedFonts():Promise<{fonts:string[];warning?:string}>{
 try{
  let fonts:string[]=[];
  if(process.platform==='win32'){
   const script="[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; $collection=New-Object System.Drawing.Text.InstalledFontCollection; try { @($collection.Families | ForEach-Object { $_.Name }) | ConvertTo-Json -Compress } finally { $collection.Dispose() }";
   const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:10000,maxBuffer:2_000_000});const parsed:unknown=JSON.parse(stdout.replace(/^\uFEFF/,''));fonts=typeof parsed==='string'?[parsed]:z.array(z.string()).parse(parsed);
  }else{
   const {stdout}=await promisify(execFile)('fc-list',['--format=%{family}\n'],{timeout:10000,maxBuffer:2_000_000});fonts=stdout.split(/\r?\n/).flatMap(line=>line.split(','));
  }
  fonts=[...new Set(fonts.map(font=>font.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));if(!fonts.length)throw new Error('No installed font families returned.');return {fonts};
 }catch{return {fonts:['Segoe UI','Arial','Georgia','Tahoma','Verdana','sans-serif'],warning:'Installed font discovery is unavailable. The list contains common fallback families; check your output preview.'};}
}
export function themeHandlers(context:ThemeContext){
 const file=path.join(context.workspaceRoot,'themes.json');let config=defaultThemeConfig(),loadWarning:string|undefined,fontCache:Awaited<ReturnType<typeof installedFonts>>|undefined;
 if(existsSync(file)){try{if(statSync(file).size>30_000_000)throw new Error('Theme settings exceed 30 MB.');config=normalizeThemeConfig(JSON.parse(readFileSync(file,'utf8')));}catch{loadWarning='Saved theme settings could not be read. Built-in themes are available; the original file is retained until you save a change.';}}
 const persist=(next:ThemeConfig)=>{const checked=normalizeThemeConfig(next);mkdirSync(context.workspaceRoot,{recursive:true});const temporary=file+'.'+randomUUID()+'.tmp';writeFileSync(temporary,JSON.stringify(checked,null,2),'utf8');renameSync(temporary,file);config=checked;};
 const fonts=async()=>fontCache??(fontCache=await (context.fontDiscovery||installedFonts)());
 const initial=()=>({config:structuredClone(config),warning:loadWarning});
 const contextOf=(slide:Slide)=>context.resolveContext?.(slide)??{itemId:slide.itemId,kind:slide.bible?'bible':slide.video?'video':slide.image?'image':slide.countdown?'countdown':'song'};
 const guarded=async()=>{if(await context.canChange?.()===false)throw new Error('Output is locked. Unlock output before changing a presentation theme.');};
 const resolveStyle=(item:{itemId?:string;kind?:string})=>{const requested=resolveTheme(config,item),selected=fontCache?withFontFallback(requested,fontCache.fonts).theme:requested;return {themeId:selected.id,style:structuredClone(selected.style),transition:structuredClone(selected.transition)};};
 return {getConfig:()=>structuredClone(config),restoreConfig:(value:unknown)=>{persist(normalizeThemeConfig(value));return structuredClone(config);},resolveStyle,handlers:{
  'themes:action':async(_event:IpcMainInvokeEvent,value:unknown):Promise<unknown>=>{
   const {action,payload}=z.object({action:z.enum(['initial','fonts','save','delete','import','export','apply','apply-text-style','font-check']),payload:z.unknown().optional()}).strict().parse(value);
   if(action==='initial'){z.object({}).strict().parse(payload??{});return initial();}
   if(action==='fonts'){z.object({}).strict().parse(payload??{});return fonts();}
   if(action==='font-check'){const input=z.object({families:z.array(z.string().max(200)).max(500)}).strict().parse(payload),available=await fonts();return {missing:validateThemeFonts(input.families.map((family,index)=>({id:'font-'+index,name:family,style:{fontFamily:family},transition:{name:'none',duration:0,reduceMotion:false}})),available.fonts),fallback:available.fonts.includes('Segoe UI')?'Segoe UI':available.fonts[0],warning:available.warning};}
   if(action==='save'){
    const input=z.object({theme:ThemeSchema}).strict().parse(payload);if(config.themes.some(theme=>theme.id===input.theme.id&&theme.builtIn))throw new Error('Save a built-in theme as a new theme.');
    const next=structuredClone(config),theme={...input.theme,builtIn:false};next.themes=next.themes.filter(t=>t.id!==theme.id);next.themes.push(theme);persist(next);return {...initial(),theme};
   }
   if(action==='delete'){
    const {id}=z.object({id:z.string().max(100)}).strict().parse(payload),theme=config.themes.find(t=>t.id===id);if(!theme)throw new Error('Theme not found.');if(theme.builtIn)throw new Error('Built-in themes cannot be deleted.');
    if(config.serviceThemeId===id||Object.values(config.typeThemes).includes(id)||Object.values(config.itemThemes).includes(id))throw new Error('This theme is assigned to a service or item. Apply another theme before deleting it.');
    persist({...config,themes:config.themes.filter(t=>t.id!==id)});return initial();
   }
   if(action==='import'){
    z.object({}).strict().parse(payload??{});const {dialog}=await import('electron');const result=await dialog.showOpenDialog(context.win,{title:'Import presentation theme',properties:['openFile'],filters:[{name:'Worship Studio theme',extensions:['json','wstheme']}]});if(result.canceled)return null;
    const source=result.filePaths[0];if((await stat(source)).size>30_000_000)throw new Error('Theme file exceeds 30 MB.');const theme={...parseThemeFile(await readFile(source,'utf8')),id:'theme-'+randomUUID()};
    persist({...config,themes:[...config.themes,theme]});const available=await fonts();return {...initial(),theme,missingFonts:validateThemeFonts([theme],available.fonts),contrast:themeContrast(theme)};
   }
   if(action==='export'){
    const {id}=z.object({id:z.string().max(100)}).strict().parse(payload),theme=config.themes.find(t=>t.id===id);if(!theme)throw new Error('Theme not found.');const {dialog}=await import('electron');const result=await dialog.showSaveDialog(context.win,{title:'Export presentation theme',defaultPath:theme.name.replace(/[^a-z0-9 _-]/gi,'')+'.wstheme',filters:[{name:'Worship Studio theme',extensions:['wstheme']}]});if(result.canceled||!result.filePath)return null;await writeFile(result.filePath,exportTheme(theme),'utf8');return {message:'Theme exported.'};
   }
   const textInput=action==='apply-text-style'?z.object({theme:ThemeSchema,kind:z.enum(['song','bible','note','slides','text','countdown','image','video','powerpoint'])}).strict().parse(payload):null;
   const input=textInput?{themeId:'text-style-'+textInput.kind,scope:{scope:'type' as const,kind:textInput.kind}}:z.object({themeId:z.string().max(100),scope:ThemeScopeSchema}).strict().parse(payload);await guarded();
   // Save and assign together after the output guard; repeated edits reuse one style.
   const candidate=textInput?{...config,themes:[...config.themes.filter(t=>t.id!==input.themeId),{...textInput.theme,id:input.themeId,name:textInput.kind+' text style',builtIn:false}]}:config;
   const available=await fonts(),requested=candidate.themes.find(t=>t.id===input.themeId);if(!requested)throw new Error('Theme not found.');const checked=withFontFallback(requested,available.fonts),nextConfig=applyThemeScope(candidate,input.themeId,input.scope);
   // Preserve the requested font in storage; use an available fallback for this machine's output.
   const resolvedConfig={...nextConfig,themes:nextConfig.themes.map(t=>t.id===checked.theme.id?checked.theme:t)};
   const state=context.getState(),applyTo=(slide:Slide|null):Slide|null=>{if(!slide)return null;const selected=resolveTheme(resolvedConfig,contextOf(slide));return {...slide,style:{...slide.style,...selected.style},transition:selected.transition};};
   persist(nextConfig);context.setState(updatePresentation(state,{theme:resolveTheme(resolvedConfig,{}).style,transition:resolveTheme(resolvedConfig,{}).transition,live:applyTo(state.live),preview:applyTo(state.preview),next:applyTo(state.next)}));await context.onApply?.(structuredClone(config),input.scope,checked.theme);await context.render();return {...initial(),theme:checked.theme,warning:checked.warning||available.warning,contrast:themeContrast(checked.theme)};
  }
 }};
}
