import{z}from'zod';
import type{SlideStyle}from'./presentation';
import{ThemeConfigSchema}from'./themes';
export const ClickerActionSchema=z.enum(['next','previous','blackout','logo','live']);
export type ClickerAction=z.infer<typeof ClickerActionSchema>;
export type ClickerSettings={enabled:boolean;mappings:Record<string,ClickerAction>};
export function normalizeClickerKey(key:string):string{
 if(key==='Spacebar'||key==='Space')return ' ';
 return key.toLowerCase();
}
export function isClickerKey(key:string){
 return key===' '||/^[a-z0-9]$/.test(key)||/^[.,;/'\\[\]\-=+]$/.test(key)||/^(pageup|pagedown|arrowup|arrowdown|arrowleft|arrowright|f(?:[1-9]|1[0-2]))$/.test(key);
}
export const ClickerSchema=z.object({enabled:z.boolean(),mappings:z.record(z.string().max(20),ClickerActionSchema).superRefine((mapping,context)=>{
 if(Object.keys(mapping).length>30)context.addIssue({code:'custom',message:'Use at most 30 clicker mappings.'});
 for(const key of Object.keys(mapping))if(!isClickerKey(key)||normalizeClickerKey(key)!==key)context.addIssue({code:'custom',message:'Unsupported clicker key: '+key});
})}).strict();
export const LayoutSchema=z.object({library:z.number().min(260).max(600),presentation:z.number().min(300).max(600)}).strict();
export const defaultLayout=()=>({library:280,presentation:320});
export const defaultAccessibility=()=>({theme:'light' as const,scale:100 as const,largeTargets:false,strongFocus:true,reduceMotion:false,shortcutHints:true,colorTags:true,mode:'simple' as const});
export const AccessibilitySchema=z.object({theme:z.enum(['light','dark','high-contrast','system']),scale:z.union([z.literal(100),z.literal(125),z.literal(150),z.literal(200)]),largeTargets:z.boolean(),strongFocus:z.boolean(),reduceMotion:z.boolean(),shortcutHints:z.boolean(),colorTags:z.boolean(),mode:z.enum(['simple','full'])}).strict();
export const defaultOperatorV2=()=>({mode:'prepare' as const,quickType:'bible' as const,showQuickSend:true,layout:{library:280,presentation:380,serviceRatio:45}});
export const OperatorV2Schema=z.object({mode:z.enum(['prepare','present']),quickType:z.enum(['bible','notice','alert']),showQuickSend:z.boolean(),layout:z.object({library:z.number().min(240).max(600),presentation:z.number().min(320).max(600),serviceRatio:z.number().min(20).max(80)}).strict()}).strict();
export const SettingsSchema=z.object({
 operatorV2:OperatorV2Schema.default(defaultOperatorV2),
 language:z.enum(['en','fil']),touchMode:z.boolean(),
 layout:LayoutSchema.default(defaultLayout),
 accessibility:AccessibilitySchema.default(defaultAccessibility),
 clicker:ClickerSchema,
 capture:z.object({mode:z.enum(['normal','chroma','transparent']),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict()
}).strict();
export type StudioSettings=z.infer<typeof SettingsSchema>;
const displayChoice=z.object({displayId:z.number().int(),split:z.enum(['full','left','right']).optional()}).strict();
export const WorkspaceSettingsSchema=z.object({
 themes:ThemeConfigSchema.optional(),
 bible:z.object({translationIds:z.array(z.string().uuid()).max(3),mode:z.enum(['single','parallel','stacked','line-by-line']),versesPerSlide:z.number().int().min(1).max(20),showVerseNumbers:z.boolean()}).strict().optional(),
 outputs:z.object({audience:displayChoice.optional(),'audience-secondary':displayChoice.optional(),stage:displayChoice.optional(),rehearsal:displayChoice.optional(),confidence:displayChoice.optional()}).strict().optional()
}).strict();
export type WorkspaceSettings=z.infer<typeof WorkspaceSettingsSchema>;
export function defaultSettings():StudioSettings{return{
 language:'en',touchMode:false,clicker:{enabled:true,mappings:{pagedown:'next',pageup:'previous','.':'blackout',b:'blackout',f5:'live'}},
 operatorV2:defaultOperatorV2(),capture:{mode:'normal',color:'#00ff00'},layout:defaultLayout(),accessibility:defaultAccessibility()
};}
export function validateSettings(value:unknown):StudioSettings{return SettingsSchema.parse(value);}
export function exportSettingsBackup(settings:StudioSettings,workspace?:WorkspaceSettings){
 return JSON.stringify(workspace===undefined?{format:'worship-studio-settings-v1',settings:validateSettings(settings)}:{format:'worship-studio-settings-v2',settings:validateSettings(settings),workspace:WorkspaceSettingsSchema.parse(workspace)},null,2);
}
export function parseSettingsBackup(text:string):StudioSettings{
 return parseSettingsDocument(text).settings;
}
export function parseSettingsDocument(text:string):{settings:StudioSettings;workspace?:WorkspaceSettings}{
 if(new TextEncoder().encode(text).length>30_000_000)throw new Error('Settings backup exceeds 30 MB.');
 const data=z.discriminatedUnion('format',[
  z.object({format:z.literal('worship-studio-settings-v1'),settings:SettingsSchema}).strict(),
  z.object({format:z.literal('worship-studio-settings-v2'),settings:SettingsSchema,workspace:WorkspaceSettingsSchema}).strict()
 ]).parse(JSON.parse(text));
 return{settings:data.settings,...('workspace'in data?{workspace:data.workspace}:{})};
}
export function deriveCaptureStyle(settings:StudioSettings):SlideStyle{
 if(settings.capture.mode==='chroma')return{background:settings.capture.color,backgroundImage:undefined,backgroundVideo:undefined};
 if(settings.capture.mode==='transparent')return{background:'transparent',backgroundImage:undefined,backgroundVideo:undefined,lowerThird:true};
 return{};
}
