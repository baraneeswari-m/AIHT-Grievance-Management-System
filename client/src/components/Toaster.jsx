import{useEffect,useState}from'react';
export function notifyToast(message){window.dispatchEvent(new CustomEvent('cgms-toast',{detail:message}))}
export function Toaster(){const[value,setValue]=useState('');useEffect(()=>{const fn=e=>{setValue(e.detail);setTimeout(()=>setValue(''),3500)};window.addEventListener('cgms-toast',fn);return()=>window.removeEventListener('cgms-toast',fn)},[]);return value?<div className="toast"><span>✓</span>{value}</div>:null}
