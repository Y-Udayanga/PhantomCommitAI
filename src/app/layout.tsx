import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'PhantomCommit AI — Code never truly dies',description:'Evidence-driven Git history forensics. Investigate deleted code, replay history, and follow the evidence with Gemma.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>}
