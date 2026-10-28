'use client';
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Commit } from '@/lib/types';
export default function CommitGraph({commits,onSelect}:{commits:Commit[];onSelect:(c:Commit)=>void}){
 const nodes:Node[]=commits.slice(0,20).map((c,i)=>({id:c.sha,position:{x:30+(i%3===1?90:0),y:i*95},data:{label:<div><code>{c.sha.slice(0,7)}</code><span style={{display:'block',fontSize:10,marginTop:6}}>{c.message.split('\n')[0].slice(0,32)}</span></div>},style:{background:'#151421',color:'#dcd9ee',border:'1px solid #66558f',borderRadius:9,width:230}}));
 const ids=new Set(nodes.map(n=>n.id));const edges:Edge[]=commits.flatMap(c=>c.parent_shas.filter(p=>ids.has(p)).map(p=>({id:`${c.sha}-${p}`,source:c.sha,target:p,style:{stroke:'#8e74d1',strokeWidth:2}})));
 return <div style={{height:390}}><ReactFlow nodes={nodes} edges={edges} fitView onNodeClick={(_,n)=>{const c=commits.find(c=>c.sha===n.id);if(c)onSelect(c);}} colorMode="dark" nodesDraggable={false} aria-label="Commit ancestry map"><Background color="#302b45" gap={20}/><Controls/></ReactFlow></div>;
}
