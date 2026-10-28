'use client';
import { DiffEditor } from '@monaco-editor/react';
export default function CodePortal({before,after}:{before:string;after:string}){return <DiffEditor height="400px" theme="vs-dark" original={before} modified={after} options={{readOnly:true,minimap:{enabled:false},scrollBeyondLastLine:false,fontSize:12,automaticLayout:true,renderSideBySide:true}} loading={<div className="skeleton">Loading code portal…</div>}/>;}
