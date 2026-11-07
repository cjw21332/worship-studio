import {mkdir,copyFile,readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export const imageExtensions=['png','jpg','jpeg','webp','bmp','gif'];
export async function importImage(file:string,root:string){
 const extension=path.extname(file).slice(1).toLowerCase();if(!imageExtensions.includes(extension))throw new Error('Unsupported image format.');
 if((await stat(file)).size>20_000_000)throw new Error('Image exceeds 20 MB.');
 await mkdir(root,{recursive:true});const id=randomUUID(),name=`${id}.${extension}`;await copyFile(file,path.join(root,name));return {id,name,title:path.basename(file)};
}
export async function imageData(root:string,name:string){
 if(path.basename(name)!==name)throw new Error('Invalid media path');
 const ext=path.extname(name).slice(1).toLowerCase();if(!imageExtensions.includes(ext))throw new Error('Invalid image format');
 const bytes=await readFile(path.join(root,name));if(bytes.length>20_000_000)throw new Error('Image exceeds 20 MB.');
 return `data:image/${ext==='jpg'?'jpeg':ext};base64,${bytes.toString('base64')}`;
}
export async function convertPowerPoint(file:string,root:string){
 if(!['.ppt','.pptx'].includes(path.extname(file).toLowerCase()))throw new Error('Choose a PPT or PPTX file.');
 if((await stat(file)).size>100_000_000)throw new Error('Presentation exceeds 100 MB.');
 const directory=path.join(root,'conversion-'+randomUUID());await mkdir(directory,{recursive:true});
 try{await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'export-powerpoint.ps1'),'-InputFile',file,'-OutputDirectory',directory],{timeout:120000,maxBuffer:1_000_000});}
 catch{throw new Error('PowerPoint conversion failed. Microsoft PowerPoint must be installed locally. Open the file in PowerPoint to check it, or export slides as PNG images and import those.');}
 const files=(await readdir(directory)).filter(f=>f.toLowerCase().endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 if(!files.length)throw new Error('PowerPoint exported no slides.');return files.map(f=>path.join(directory,f));
}
