import{useState,useEffect}from'react';

export function useWindowSize(){
  const[isMobile,setIsMobile]=useState(false);

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    check();
    const timer=setTimeout(check,100);
    return()=>clearTimeout(timer);
  },[]);

  return isMobile;
}