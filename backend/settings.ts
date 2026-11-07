import{existsSync,mkdirSync,readFileSync,statSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync}from'node:fs';
import path from'node:path';
import{randomUUID}from'node:crypto';
import{defaultSettings,validateSettings}from'./settings-model';
export*from'./settings-model';

export function settingsStore(directory:string){
 const file=path.join(directory,'extras-settings.json');let current=defaultSettings(),warning:string|undefined;
 if(existsSync(file)){try{
  if(statSync(file).size>1_000_000)throw new Error('Settings exceed 1 MB.');
  current=validateSettings(JSON.parse(readFileSync(file,'utf8')));
 }catch{warning='Saved extras settings could not be read. Defaults are active; the original file remains until you save a change.';}}
 const save=(value:unknown)=>{
  const checked=validateSettings(value);mkdirSync(directory,{recursive:true});
  const temporary=file+'.'+randomUUID()+'.tmp';let fd:number|undefined;
  try{
   fd=openSync(temporary,'wx');writeFileSync(fd,JSON.stringify(checked,null,2),'utf8');fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temporary,file);
   current=checked;warning=undefined;
  }finally{if(fd!==undefined)closeSync(fd);if(existsSync(temporary))unlinkSync(temporary);}
  return structuredClone(current);
 };
 return{get:()=>structuredClone(current),save,get warning(){return warning;}};
}

