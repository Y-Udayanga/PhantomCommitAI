import { notFound, redirect } from 'next/navigation';
import { authenticated, configured } from '@/lib/server/supabase';
import Workspace from '@/components/workspace';
const sections=['dashboard','repositories','graveyard','replay','haunted-bugs','detective','resurrection','reports','settings','demo'];
export default async function Page({params}:{params:Promise<{section:string}>}) {const {section}=await params;if(!sections.includes(section)) notFound();if(section!=='demo' && configured()){try{await authenticated();}catch{redirect('/auth');}}return <Workspace section={section} demo={section==='demo'} configured={configured()}/>;}
