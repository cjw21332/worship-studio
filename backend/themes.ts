import {z} from 'zod';
import type {SlideStyle,Transition} from './presentation';
const color=z.string().regex(/^#[0-9a-f]{6}$/i,'Use a six-digit hexadecimal color.');
const gradientPattern=/^linear-gradient\(\s*-?\d{1,3}deg\s*,\s*#[0-9a-f]{6}(?:\s+\d{1,3}%)?\s*,\s*#[0-9a-f]{6}(?:\s+\d{1,3}%)?\s*\)$/i;
const background=z.string().max(200).refine(value=>/^#[0-9a-f]{6}$/i.test(value)||gradientPattern.test(value),'Choose a color or a two-color linear gradient.');
const mediaUrl=z.string().max(30_000_000).refine(value=>value===''||/^studio-media:\/\/asset\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)||/^data:image\/(?:png|jpeg|webp|gif|bmp);base64,[a-z0-9+/=]+$/i.test(value),'Choose a managed local media file.');
const shadow=z.string().max(100).refine(value=>value===''||value==='none'||/^-?\d{1,2}px\s+-?\d{1,2}px\s+\d{1,2}px\s+#[0-9a-f]{6}$/i.test(value),'Shadow must use pixel offsets, blur and a hexadecimal color.');
export const SlideStyleSchema=z.object({
 fontFamily:z.string().trim().min(1).max(200).optional(),minFontSize:z.number().min(8).max(200).optional(),maxFontSize:z.number().min(8).max(400).optional(),color:color.optional(),outlineColor:color.optional(),outlineWidth:z.number().min(0).max(8).optional(),shadow:shadow.optional(),align:z.enum(['left','center','right','justify']).optional(),verticalAlign:z.enum(['top','center','bottom']).optional(),lineSpacing:z.number().min(.8).max(2.5).optional(),margin:z.number().min(0).max(30).optional(),background:background.optional(),backgroundImage:mediaUrl.optional(),backgroundVideo:mediaUrl.optional(),fit:z.enum(['contain','cover','fill']).optional(),lowerThird:z.boolean().optional(),footerColor:color.optional(),footerSize:z.number().min(10).max(80).optional(),box:z.object({x:z.number().min(0).max(98),y:z.number().min(0).max(98),width:z.number().min(2).max(100),height:z.number().min(2).max(100)}).strict().refine(box=>box.x+box.width<=100&&box.y+box.height<=100,'Text box must remain inside the slide.').optional()
}).strict().refine(style=>style.minFontSize===undefined||style.maxFontSize===undefined||style.minFontSize<=style.maxFontSize,'Minimum font size must not exceed maximum.');
export const TransitionSchema=z.object({name:z.enum(['none','fade','push','zoom','flip']),duration:z.number().int().min(0).max(3000),reduceMotion:z.boolean()}).strict();
export const ThemeSchema=z.object({id:z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/i),name:z.string().trim().min(1).max(100),style:SlideStyleSchema,transition:TransitionSchema,builtIn:z.boolean().optional()}).strict();
export type Theme=z.infer<typeof ThemeSchema>;
const base:SlideStyle={fontFamily:'Segoe UI',minFontSize:24,maxFontSize:76,color:'#ffffff',outlineColor:'#000000',outlineWidth:0,shadow:'none',align:'center',verticalAlign:'center',lineSpacing:1.25,margin:6,background:'#101820',fit:'contain',lowerThird:false,footerColor:'#dce8ee',footerSize:26};
const theme=(id:string,name:string,style:Partial<SlideStyle>,transition:Partial<Transition>={}):Theme=>({id,name,builtIn:true,style:{...base,...style},transition:{name:'fade',duration:250,reduceMotion:false,...transition}});
export const builtInThemes:readonly Theme[]=[
 theme('light','Morning light',{background:'#f4f8f9',color:'#173e4b',footerColor:'#315d6b',maxFontSize:72,align:'left',shadow:'none'}),
 theme('dark','Evening slate',{background:'#101820',color:'#ffffff',footerColor:'#c9dde7',shadow:'0px 2px 6px #000000'}),
 theme('warm','Gathered light',{background:'linear-gradient(135deg, #482b21 0%, #271d25 100%)',color:'#fff4de',footerColor:'#f1d7b7',maxFontSize:72,shadow:'0px 2px 6px #000000'}),
 theme('minimal','Quiet words',{background:'#ffffff',color:'#183935',footerColor:'#42615c',maxFontSize:68,margin:10,align:'left',shadow:'none'},{name:'none',duration:0}),
 theme('bold','Strong voice',{background:'#173d44',color:'#ffffff',footerColor:'#d4e9ec',maxFontSize:100,outlineColor:'#102e33',outlineWidth:1,margin:5},{name:'push',duration:220}),
 theme('motion','Moving water',{background:'linear-gradient(110deg, #123b45 0%, #172642 100%)',color:'#ffffff',footerColor:'#ccebe9',shadow:'0px 2px 8px #000000'},{name:'zoom',duration:350})
];
export type ThemeConfig={themes:Theme[];serviceThemeId:string;typeThemes:Record<string,string>;itemThemes:Record<string,string>};
const allowedKind=z.enum(['song','bible','image','video','slides','note','countdown','alert','text','powerpoint']);
export const ThemeScopeSchema=z.discriminatedUnion('scope',[z.object({scope:z.literal('service')}).strict(),z.object({scope:z.literal('type'),kind:allowedKind}).strict(),z.object({scope:z.literal('item'),itemId:z.string().uuid()}).strict()]);
export type ThemeScope=z.infer<typeof ThemeScopeSchema>;
export const ThemeConfigSchema=z.object({themes:z.array(ThemeSchema).max(500),serviceThemeId:z.string().max(100),typeThemes:z.partialRecord(allowedKind,z.string().max(100)).optional().default({}),itemThemes:z.record(z.string().uuid(),z.string().max(100))}).strict();
export const defaultThemeConfig=():ThemeConfig=>({themes:structuredClone([...builtInThemes]),serviceThemeId:'dark',typeThemes:{},itemThemes:{}});
export function normalizeThemeConfig(value:unknown):ThemeConfig{
 const parsed=ThemeConfigSchema.parse(value),custom=parsed.themes.filter(t=>!builtInThemes.some(b=>b.id===t.id));
 return {...parsed,themes:[...structuredClone([...builtInThemes]),...custom.map(t=>({...t,builtIn:false}))]};
}
export function resolveTheme(config:ThemeConfig,context:{itemId?:string;kind?:string}):Theme{
 const ids=[context.itemId?config.itemThemes[context.itemId]:undefined,context.kind?config.typeThemes[context.kind]:undefined,config.serviceThemeId,'dark'];
 for(const id of ids){const found=config.themes.find(t=>t.id===id);if(found)return structuredClone(found);}return structuredClone(builtInThemes[1]);
}
export function applyThemeScope(config:ThemeConfig,themeId:string,scope:ThemeScope):ThemeConfig{
 ThemeScopeSchema.parse(scope);if(!config.themes.some(t=>t.id===themeId))throw new Error('Theme not found. Save the theme before applying it.');
 const next=structuredClone(config);if(scope.scope==='service')next.serviceThemeId=themeId;else if(scope.scope==='type')next.typeThemes[scope.kind]=themeId;else next.itemThemes[scope.itemId]=themeId;return next;
}
const luminance=(hex:string)=>{const rgb=[1,3,5].map(offset=>parseInt(color.parse(hex).slice(offset,offset+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
export function contrastRatio(a:string,b:string):number{const [high,low]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (high+.05)/(low+.05);}
export function themeContrast(input:Theme):{ratio:number;footerRatio:number;verified:boolean;message:string}{
 const theme=ThemeSchema.parse(input),colors=theme.style.background?.match(/#[0-9a-f]{6}/gi)||['#101820'],text=theme.style.color||'#ffffff',footer=theme.style.footerColor||text;
 // Check intermediate gradient colors too: dark text may have its worst contrast between endpoints.
 if(colors.length===2){const [a,b]=colors.map(hex=>[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)));for(let step=1;step<20;step++)colors.push('#'+a.map((channel,index)=>Math.round(channel+(b[index]-channel)*step/20).toString(16).padStart(2,'0')).join(''));}
 const ratio=Math.min(...colors.map(bg=>contrastRatio(text,bg))),footerRatio=Math.min(...colors.map(bg=>contrastRatio(footer,bg))),verified=!theme.style.backgroundImage&&!theme.style.backgroundVideo;
 return {ratio,footerRatio,verified,message:!verified?'Media backgrounds vary. Check text against the actual image or video.':ratio>=4.5&&footerRatio>=4.5?'Text and footer meet 4.5:1 contrast.':'Increase text or footer contrast to at least 4.5:1.'};
}
export function parseThemeFile(source:string):Theme{if(source.length>30_000_000)throw new Error('Theme file exceeds 30 MB.');let parsed:unknown;try{parsed=JSON.parse(source);}catch{throw new Error('Invalid theme JSON.');}const input=z.object({format:z.literal('worship-studio-theme-v1'),theme:ThemeSchema}).strict().parse(parsed);return {...input.theme,builtIn:false};}
export function exportTheme(theme:Theme):string{return JSON.stringify({format:'worship-studio-theme-v1',theme:ThemeSchema.parse(theme)},null,2);}
const genericFonts=new Set(['sans-serif','serif','monospace','system-ui']);
export function withFontFallback(theme:Theme,installedFonts:readonly string[],fallback='Segoe UI'):{theme:Theme;warning:string|null}{
 const requested=theme.style.fontFamily||fallback,installed=new Set(installedFonts.map(f=>f.toLocaleLowerCase()));if(genericFonts.has(requested.toLocaleLowerCase())||installed.has(requested.toLocaleLowerCase()))return {theme:structuredClone(theme),warning:null};
 const available=installed.has(fallback.toLocaleLowerCase())?fallback:installedFonts[0]||'sans-serif';return {theme:{...structuredClone(theme),style:{...theme.style,fontFamily:available}},warning:'Font “'+requested+'” is unavailable. Using '+available+'.'};
}
export function validateThemeFonts(themes:readonly Theme[],installedFonts:readonly string[]):string[]{return [...new Set(themes.map(t=>t.style.fontFamily||'Segoe UI').filter(font=>!genericFonts.has(font.toLocaleLowerCase())&&!installedFonts.some(f=>f.toLocaleLowerCase()===font.toLocaleLowerCase())))];}
