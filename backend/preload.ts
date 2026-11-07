import {contextBridge,ipcRenderer,webUtils} from 'electron';
import type {Song,Item} from './database';
import type {Presentation,Slide} from './presentation';
export type DisplayInfo={id:number;number:number;label:string;width:number;height:number;primary:boolean;operator:boolean};
export type Asset={id:string;name:string;title:string};
export type Translation={id:string;name:string};
export type BibleVerse={book:string;chapter:number;verse:number;body:string};
const invoke=<T>(channel:string,value?:unknown):Promise<T>=>ipcRenderer.invoke(channel,value);
export const studio={
 copyWorkspacePath:()=>invoke<boolean>('workspace:copy-path',{}),
 dropFiles:(files:File[])=>invoke<{message:string;warning?:string}>('media:tools',{action:'drop',payload:{paths:files.map(file=>webUtils.getPathForFile(file))}}),
 diagnostics:(action:'report'|'copy'|'export'|'renderer-error',payload:unknown={})=>invoke<any>('diagnostics:action',{action,payload}),
 updates:(action:'status'|'configure'|'check'|'download'|'install',payload:unknown={})=>invoke<import('./update').UpdateStatus>('updates:action',{action,payload}),
 navigate:(direction:1|-1)=>invoke<Presentation>('presentation:navigate',{direction}),

 extras:(action:string,payload:unknown={})=>invoke<any>('extras:action',{action,payload}),
 onSettings:(callback:(value:import('./settings-model').StudioSettings)=>void)=>{const listener=(_event:Electron.IpcRendererEvent,value:import('./settings-model').StudioSettings)=>callback(value);ipcRenderer.on('settings:state',listener);return()=>{ipcRenderer.removeListener('settings:state',listener);};},

 serviceTools:(action:string,payload:unknown={})=>invoke<any>('service:action',{action,payload}),

 mediaTools:(action:string,payload:unknown={})=>invoke<any>('media:tools',{action,payload}),themes:(action:string,payload:unknown={})=>invoke<any>('themes:action',{action,payload}),

 outputs:(action:string,payload:unknown={})=>invoke<any>('outputs:action',{action,payload}),freeze:()=>invoke<Presentation>('presentation:freeze'),
 onPresentation:(callback:(state:Presentation)=>void)=>{const listener=(_event:Electron.IpcRendererEvent,value:Presentation)=>callback(value);ipcRenderer.on('presentation:state',listener);return()=>{ipcRenderer.removeListener('presentation:state',listener);};},
 onActivity:(callback:(value:{kind:'info'|'error';message:string})=>void)=>{const listener=(_event:Electron.IpcRendererEvent,value:{kind:'info'|'error';message:string})=>callback(value);ipcRenderer.on('workspace:activity',listener);return()=>{ipcRenderer.removeListener('workspace:activity',listener);};},

 bible:(action:string,payload:unknown)=>invoke<any>('bible:action',{action,payload}),
 songLock:(id:string)=>invoke<void>('songs:lock',id),songUnlock:(id:string)=>invoke<void>('songs:unlock',id),
 songImport:()=>invoke<{token:string;format:string;warnings:string[];candidates:{song:{title:string;author:string;lyrics:string;publisher:string;copyright:string;key:string;tempo:number;notes:string};duplicateIds:string[]}[]}|null>('songs:import-preview'),songImportCommit:(token:string,indices:number[])=>invoke<string>('songs:import-commit',{token,indices}),
 songTools:(action:string,payload:unknown)=>invoke<unknown>('songs:tools',{action,payload}),chooseWorkspace:()=>invoke<string>('workspace:choose'),quickEdit:(itemId:string,song:unknown,maxLines:number)=>invoke<void>('songs:quick-edit',{itemId,song,maxLines}),
 info:()=>invoke<{path:string;version:string}>('workspace:info'),newService:()=>invoke<void>('service:new'),
 media:()=>invoke<Asset[]>('media:list'),importMedia:(kind:string)=>invoke<string>('media:import',kind),addMedia:(id:string)=>invoke<void>('media:add',id),
 transfer:(action:string)=>invoke<string>('files:transfer',action),translations:()=>invoke<Translation[]>('bible:translations'),searchBible:(id:string,query:string)=>invoke<BibleVerse[]>('bible:search',{id,query}),addText:(title:string,body:string)=>invoke<void>('service:text',{title,body}),
 displays:()=>invoke<{displays:DisplayInfo[];target:number|null}>('displays:list'),identify:()=>invoke<void>('displays:identify'),arm:(id:number)=>invoke<void>('displays:arm',id),disarm:()=>invoke<void>('displays:disarm'),
 updateSong:(id:string,song:unknown)=>invoke<void>('songs:update',{id,song}),deleteSong:(id:string)=>invoke<void>('songs:delete',id),
 duplicateItem:(id:string)=>invoke<void>('service:duplicate',id),reorder:(ids:string[])=>invoke<void>('service:reorder',ids),
 songs:()=>invoke<Song[]>('songs:list'),createSong:(input:unknown)=>invoke<string>('songs:create',input),
 service:()=>invoke<Item[]>('service:list'),addSong:(id:string,maxLines=4)=>invoke<Item[]>('service:add',{id,maxLines}),removeItem:(id:string)=>invoke<Item[]>('service:remove',id),
 presentation:()=>invoke<Presentation>('presentation:get'),preview:(slide:Slide)=>invoke<Presentation>('presentation:preview',slide),
 previewFontSize:(size:number)=>invoke<Presentation>('presentation:preview-font-size',size),
 takeLive:()=>invoke<Presentation>('presentation:live'),blackout:()=>invoke<Presentation>('presentation:blackout'),toggle:(mode:'blackout'|'clear'|'logo')=>invoke<Presentation>('presentation:toggle',mode)
};
contextBridge.exposeInMainWorld('studio',studio);
