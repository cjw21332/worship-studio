/** Native file consumers cannot read Electron's virtual ASAR filesystem. */
export function unpackedResource(file:string):string{return file.replace(/([\\/])app\.asar(?=[\\/])/,'$1app.asar.unpacked');}
