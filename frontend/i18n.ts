import {useSyncExternalStore} from 'react';
import {deskT as translateDesk} from './desk-i18n';
export type Language='en'|'fil';
const subscribeLanguage=(listener:()=>void)=>{window.addEventListener('studio-language',listener);return()=>window.removeEventListener('studio-language',listener);};
export function useUILanguage():Language{return useSyncExternalStore(subscribeLanguage,()=>document.documentElement.lang==='fil'?'fil':'en',()=>'en');}
export function useDeskTranslate(){const language=useUILanguage();return(label:string)=>translateDesk(language,label);}
export const messages={
 en:{
  settings:'Settings',extras:'Remote, clicker and extras',language:'Language',touchMode:'Touch-friendly controls',phoneRemote:'Phone remote',
  remoteHint:'Control this service from a phone on the same trusted Wi-Fi or wired network. Disabled every time the app starts.',
  remoteWarning:'The remote uses local HTTP. Anyone on this network who has the PIN can control presentation output. Use a trusted church network; turn it off after the service.',
  enableRemote:'Enable phone remote',disableRemote:'Disable phone remote',paired:'Paired devices',pairPin:'Pairing PIN',newPin:'Create a new PIN',expires:'PIN expires',scanQr:'Scan this QR code with your phone',localUrl:'Local remote address',noNetwork:'No local address is available.',
  clicker:'Presenter clicker',clickerEnabled:'Enable clicker mappings',learnKey:'Learn a key',pressKey:'Press the clicker button now. Escape cancels.',action:'Action',key:'Key',remove:'Remove',next:'Next',previous:'Previous',blackout:'Blackout',logo:'Logo',live:'Send preview live',
  capture:'OBS and capture output',captureMode:'Capture mode',normal:'Normal presentation',chroma:'Chroma-key background',transparent:'Transparent lower third',chromaColor:'Chroma-key color',
  captureHint:'Capture a Worship Studio output window in OBS. Chroma key works with fullscreen or windowed output. Transparent lower thirds require a newly opened windowed output; capture support varies by OS and OBS source.',
  backup:'Back up settings',restore:'Restore settings',reset:'Reset settings',save:'Save settings',close:'Close',cancel:'Cancel',
  saved:'Settings saved.',songs:'Songs',bible:'Bible',slides:'Slides',images:'Images',video:'Video',notes:'Notes',library:'Library',serviceOrder:'Service order',runningOrder:'Running order',presentation:'Presentation',preview:'Preview',rehearsal:'Rehearsal',open:'Open',new:'New',files:'Files',help:'Help and shortcuts',activity:'Activity',armOutput:'Arm output',disarm:'Disarm',identifyScreens:'Identify screens',clear:'Clear',output:'Output',goLive:'Send live',sendRehearsal:'Send to rehearsal',audienceOutput:'Audience output',notOnScreen:'Not on screen',currentSlide:'Current slide',nextSlide:'Next slide',song:'Song',addToService:'Add to service'
 },
 fil:{
  settings:'Mga setting',extras:'Remote, clicker at iba pa',language:'Wika',touchMode:'Malalaking kontrol para sa touch',phoneRemote:'Remote sa telepono',
  remoteHint:'Kontrolin ang pagsamba gamit ang telepono sa parehong pinagkakatiwalaang Wi-Fi o wired network. Naka-off ito tuwing bubuksan ang app.',
  remoteWarning:'Gumagamit ang remote ng lokal na HTTP. Makokontrol ng sinumang nasa network at may PIN ang ipinapakita. Gumamit ng pinagkakatiwalaang network at i-off pagkatapos ng pagsamba.',
  enableRemote:'I-on ang remote',disableRemote:'I-off ang remote',paired:'Mga nakapares na device',pairPin:'PIN sa pagpapares',newPin:'Gumawa ng bagong PIN',expires:'Pag-expire ng PIN',scanQr:'I-scan ang QR code gamit ang telepono',localUrl:'Lokal na address ng remote',noNetwork:'Walang lokal na address.',
  clicker:'Clicker ng presenter',clickerEnabled:'Gamitin ang mga key ng clicker',learnKey:'Itakda ang key',pressKey:'Pindutin ngayon ang button ng clicker. Escape para kanselahin.',action:'Gagawin',key:'Key',remove:'Alisin',next:'Susunod',previous:'Nakaraan',blackout:'Itim na screen',logo:'Logo',live:'Ipakita ang preview',
  capture:'OBS at capture output',captureMode:'Uri ng capture',normal:'Karaniwang presentasyon',chroma:'Chroma-key na background',transparent:'Transparent na lower third',chromaColor:'Kulay ng chroma key',
  captureHint:'I-capture sa OBS ang output window ng Worship Studio. Maaaring fullscreen o windowed ang chroma key. Para sa transparent na lower third, magbukas ng bagong windowed output; nag-iiba ang suporta ayon sa OS at OBS source.',
  backup:'I-back up ang mga setting',restore:'Ibalik ang mga setting',reset:'I-reset ang mga setting',save:'I-save ang mga setting',close:'Isara',cancel:'Kanselahin',
  saved:'Na-save ang mga setting.',songs:'Mga awit',bible:'Biblia',slides:'Mga slide',images:'Mga larawan',video:'Video',notes:'Mga tala',library:'Aklatan',serviceOrder:'Ayos ng pagsamba',runningOrder:'Pagkakasunod-sunod',presentation:'Presentasyon',preview:'Paunang tingin',rehearsal:'Pagsasanay',open:'Buksan',new:'Bago',files:'Mga file',help:'Tulong at mga shortcut',activity:'Mga aktibidad',armOutput:'Ihanda ang output',disarm:'Ihinto',identifyScreens:'Kilalanin ang mga screen',clear:'Alisin ang teksto',output:'Output',goLive:'Ipakita ngayon',sendRehearsal:'Ipakita sa pagsasanay',audienceOutput:'Output para sa kongregasyon',notOnScreen:'Hindi pa nakikita',currentSlide:'Kasalukuyang slide',nextSlide:'Susunod na slide',song:'Awit',addToService:'Idagdag sa pagsamba'
 }
} as const;
export type MessageKey=keyof typeof messages.en;
export function t(language:Language,key:MessageKey):string{return messages[language]?.[key]||messages.en[key];}
const englishKeys=new Map<string,MessageKey>(Object.entries(messages.en).map(([key,value])=>[value,key as MessageKey]));
export function translateLabel(language:Language,label:string){const key=englishKeys.get(label);return key?t(language,key):label;}
export function applyWorkspaceLanguage(language:Language){
 document.documentElement.lang=language==='fil'?'fil':'en';
 document.documentElement.dataset.language=language;
 localStorage.setItem('studio-language',language);
 // React components translate their source strings using t/translateLabel.
 window.dispatchEvent(new CustomEvent('studio-language',{detail:language}));
}
export function applyTouchMode(enabled:boolean){
 document.documentElement.dataset.touch=enabled?'true':'false';
 if(!document.getElementById('studio-touch-mode')){
  const style=document.createElement('style');style.id='studio-touch-mode';
  style.textContent=':root[data-touch=true] button{min-height:52px}:root[data-touch=true] .icon-button{min-width:52px;width:52px}:root[data-touch=true] input,:root[data-touch=true] textarea{min-height:48px;font-size:16px}:root[data-touch=true] .toolbar{flex-wrap:wrap}:root[data-touch=true] .app-header{min-height:82px}';
  document.head.append(style);
 }
}


export {deskT} from './desk-i18n';
