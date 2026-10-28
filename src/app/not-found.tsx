import Link from 'next/link';
import { Ghost } from '@/components/brand';
export default function NotFound(){return <main id="main" className="empty" style={{minHeight:'100vh'}}><Ghost size={70}/><h1>This page has vanished.</h1><p>The history is still waiting in your workspace.</p><Link className="btn" href="/">Return home</Link></main>;}
