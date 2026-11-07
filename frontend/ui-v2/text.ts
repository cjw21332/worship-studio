import{deskT,useUILanguage}from'../i18n';export function useText(){const language=useUILanguage();return(label:string,values:Record<string,string|number>={})=>deskT(language,label,values);}
