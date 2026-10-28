import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/server/supabase';
export async function GET(req:NextRequest){
 const code=req.nextUrl.searchParams.get('code');const next=req.nextUrl.searchParams.get('next');
 const destination=next==='/auth?action=update'?next:'/dashboard';
 if(code){try{const db=await database();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(destination,req.url));}catch{/* Show the sign-in form without leaking provider errors. */}}
 return NextResponse.redirect(new URL('/auth',req.url));
}
