import {contextBridge,ipcRenderer} from 'electron';
import type {Presentation} from './presentation';

// Output windows can read presentation snapshots only. They never receive the
// operator bridge, IPC event objects, file operations or unrestricted channel names.
export const outputBridge={
 get:():Promise<Presentation>=>ipcRenderer.invoke('output:get'),
 subscribe:(listener:(snapshot:Presentation)=>void)=>{
  const receive=(_event:Electron.IpcRendererEvent,snapshot:Presentation)=>listener(snapshot);
  ipcRenderer.on('output:state',receive);
  return ()=>ipcRenderer.removeListener('output:state',receive);
 }
};
contextBridge.exposeInMainWorld('studioOutput',outputBridge);
