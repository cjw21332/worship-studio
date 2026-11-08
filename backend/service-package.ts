import JSZip from 'jszip';
import {readFile,mkdir,writeFile,link,unlink,lstat,realpath} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {z} from 'zod';
import {parseService,referencedAssets,type ServiceFile} from './service-plan';
const Asset=z.object({id:z.string().uuid(),name:z.string().regex(/^[a-f0-9-]{36}\.[a-z0-9]{1,10}$/i),title:z.string().max(500),kind:z.enum(['image','video']).optional(),mime:z.string().max(100).optional(),options:z.record(z.string(),z.unknown()).optional(),sha256:z.string().regex(/^[a-f0-9]{64}$/)});
export async function packService(service:ServiceFile,assets:{id:string;name:string;title:string;[key:string]:unknown}[],mediaRoot:string):Promise<Buffer>{
 const zip=new JSZip(),manifest:z.infer<typeof Asset>[]=[];let bytes=0;
 const root=await realpath(mediaRoot);
 for(const id of referencedAssets(service.items)){
  const asset=assets.find(a=>a.id===id);if(!asset)throw new Error('Cannot package missing media '+id+'.');
  if(path.basename(asset.name)!==asset.name)throw new Error('Unsafe managed asset name.');
  const file=await realpath(path.join(root,asset.name));if(path.dirname(file)!==root)throw new Error('Media escaped the workspace.');
  const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw new Error('Media must be a regular file.');
  bytes+=info.size;if(bytes>1_000_000_000)throw new Error('Service package exceeds 1 GB.');
  const content=await readFile(file);const record=Asset.parse({...asset,sha256:createHash('sha256').update(content).digest('hex')});
  manifest.push(record);zip.file('media/'+record.name,content,{compression:'STORE'});
 }
 zip.file('service.json',JSON.stringify(service));zip.file('manifest.json',JSON.stringify({format:'worship-studio-package-v1',assets:manifest}));
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:3}});
}
export async function unpackService(buffer:Buffer,mediaRoot:string):Promise<{service:ServiceFile;assets:z.infer<typeof Asset>[]}>{
 if(buffer.length>1_000_000_000)throw new Error('Package exceeds 1 GB.');
 const zip=await JSZip.loadAsync(buffer,{checkCRC32:false}),serviceEntry=zip.file('service.json'),manifestEntry=zip.file('manifest.json');
 if(!serviceEntry||!manifestEntry)throw new Error('Choose a Worship Studio service package.');
 // Reject path sanitization and oversized archives before inflating entries.
 const entries=Object.values(zip.files);if(entries.length>10002)throw new Error('Package contains too many entries.');
 let declaredBytes=0;for(const entry of entries){
  const unsafe=(entry as JSZip.JSZipObject&{unsafeOriginalName?:string;_data?:{uncompressedSize:number}}).unsafeOriginalName||entry.name;
  if(unsafe!==entry.name||unsafe.startsWith('/')||unsafe.includes('..')||unsafe.includes('\\'))throw new Error('Package contains unsafe paths.');
  const declared=(entry as unknown as {_data?:{uncompressedSize:number}})._data?.uncompressedSize||0;if((entry.name==='manifest.json'&&declared>5_000_000)||(entry.name==='service.json'&&declared>30_000_000)||declared>500_000_000)throw new Error('Package entry exceeds safe size limits.');declaredBytes+=declared;
  if(declaredBytes>1_000_000_000)throw new Error('Expanded service package exceeds 1 GB.');
 }
 const rawManifest=await manifestEntry.async('string');if(rawManifest.length>5_000_000)throw new Error('Package manifest is too large.');
 const manifest=z.object({format:z.literal('worship-studio-package-v1'),assets:z.array(Asset).max(5000)}).parse(JSON.parse(rawManifest));
 if(new Set(manifest.assets.map(a=>a.id)).size!==manifest.assets.length)throw new Error('Package contains duplicate assets.');
 if(new Set(manifest.assets.map(a=>a.name.toLowerCase())).size!==manifest.assets.length)throw new Error('Package contains duplicate media filenames.');
 const source=await serviceEntry.async('string');if(source.length>30_000_000)throw new Error('Service exceeds 30 MB.');
 const service=parseService(JSON.parse(source));
 const records=manifest.assets;
 for(const id of referencedAssets(service.items))if(!records.some(a=>a.id===id))throw new Error('Package omits referenced media '+id+'.');
 const approved=new Map<string,Buffer>();
 for(const asset of records){const entry=zip.file('media/'+asset.name);if(!entry)throw new Error('Package is missing '+asset.title+'.');const data=await entry.async('nodebuffer');if(createHash('sha256').update(data).digest('hex')!==asset.sha256)throw new Error('Media checksum mismatch.');approved.set(asset.name,data);}
 await mkdir(mediaRoot,{recursive:true});
 const destinationRoot=await realpath(mediaRoot);
 // Check every destination before writing anything: a later conflict must not
 // leave earlier media imported from a service that could not be opened.
 const missing:[string,Buffer][]=[];
 for(const [name,data]of approved){const dest=path.join(destinationRoot,name);try{const info=await lstat(dest);if(!info.isFile()||info.isSymbolicLink())throw new Error('Media destination must be a regular file.');const actual=await realpath(dest);if(path.dirname(actual)!==destinationRoot)throw new Error('Media destination escaped the workspace.');const existing=await readFile(dest);if(!existing.equals(data))throw new Error('An asset with the same ID has different content.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;missing.push([dest,data]);}}
 for(const [dest,data]of missing){const temporary=dest+'.'+randomUUID()+'.tmp';await writeFile(temporary,data,{flag:'wx'});try{await link(temporary,dest);}finally{await unlink(temporary);}}
 return {service,assets:records};
}
