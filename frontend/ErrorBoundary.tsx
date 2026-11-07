import {Component,type ErrorInfo,type ReactNode} from 'react';
type Props={children:ReactNode;name?:string;output?:boolean;onError?:(event:{name:string;code:'renderer-error'})=>void;onReset?:()=>void;resetKey?:unknown};
/** Boundaries are per renderer/surface, so a failed editor never reloads a working output. */
export class ErrorBoundary extends Component<Props,{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error,_info:ErrorInfo){this.props.onError?.({name:['Error','TypeError','RangeError','SyntaxError','ReferenceError'].includes(error.name)?error.name:'Error',code:'renderer-error'});}
 componentDidUpdate(previous:Props){if(this.state.failed&&previous.resetKey!==this.props.resetKey)this.setState({failed:false});}
 reset=()=>{this.props.onReset?.();this.setState({failed:false});};
 render(){
  if(!this.state.failed)return this.props.children;
  if(this.props.output)return <div role="alert" style={{position:'absolute',inset:0,background:'#000000',color:'#ffffff',display:'grid',placeItems:'center',font:'24px Segoe UI',padding:'5%',textAlign:'center'}}>Output unavailable. Rearm this output from the operator workspace.</div>;
  return <section role="alert" style={{padding:24,background:'var(--panel,#ffffff)',color:'var(--ink,#172a3a)',border:'1px solid var(--line,#d2dde3)',borderRadius:8}}><h2>{this.props.name||'This panel'} could not be displayed</h2><p style={{margin:'10px 0 16px'}}>Your last live output stays independent. Try reopening this panel.</p><button data-help-id="errorBoundary.tryAgain" onClick={this.reset}>Try again</button></section>;
 }
}
