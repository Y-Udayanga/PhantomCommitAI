import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { authenticated, checkDb, configured } from '@/lib/server/supabase';
import { github, commitDetails, normalizeCommit, ServiceError } from '@/lib/server/github';
import { investigate, PROMPT_VERSION } from '@/lib/server/gemma';
import { parseRepository, classify } from '@/lib/analysis';
import type { Commit, Repository } from '@/lib/types';

export const runtime='nodejs';
export const maxDuration=60;
type Context={params:Promise<{path:string[]}>};
const uuid=z.string().uuid(); const shaSchema=z.string().regex(/^[a-f0-9]{40}$/);
const inputSchema=z.object({url:z.string().max(300)});
const aiSchema=z.object({repository_id:uuid,sha:shaSchema.optional(),mode:z.enum(['explain','risk','chat','root-cause','graveyard','restore','report','tests','story']).default('explain'),question:z.string().min(3).max(2500),thread_id:uuid.optional(),consent:z.literal(true)});
async function body(req:NextRequest) {
  // Bound streaming reads as Content-Length is optional and untrusted.
  const reader=req.body?.getReader(); if (!reader) throw new ServiceError(400,'A JSON body is required.');
  let size=0; const chunks:Uint8Array[]=[];
  while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>16384) {await reader.cancel();throw new ServiceError(413,'Request is too large.');} chunks.push(value); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ServiceError(400,'Invalid JSON body.'); }
}
async function handle(req:NextRequest,ctx:Context) {
 try {
  const {path}=await ctx.params;
  if (path.join('/')==='status' && req.method==='GET') return NextResponse.json({data:{database:configured(),ai:!!process.env.GEMINI_API_KEY,model:process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it'}});
  if (req.method!=='GET' && req.headers.get('origin') !== req.nextUrl.origin) throw new ServiceError(403,'Request origin is not allowed.');
  const {db,user}=await authenticated();
  const quota=await db.rpc('consume_request',{bucket:path[0]==='ai'?'ai':'github',max_requests:path[0]==='ai'?8:90});
  checkDb(quota.error); if (!quota.data) throw new ServiceError(429,'Request limit reached. Wait one minute before retrying.');
  const ok=(data:unknown)=>NextResponse.json({data});
  async function repo(id:string):Promise<Repository> { uuid.parse(id); const r=await db.from('repositories').select('*').eq('id',id).eq('owner_id',user.id).single(); if(r.error || !r.data) throw new ServiceError(404,'Repository not found in your workspace.'); return r.data; }
  async function saveCommit(repository:Repository,c:Commit) {
    const row=await db.from('commits').upsert({repository_id:repository.id,sha:c.sha,message:c.message,author_name:c.author_name,committed_at:c.committed_at,html_url:c.html_url,parent_shas:c.parent_shas,...(c.files?{details_loaded:true,files_incomplete:c.files_incomplete || false}:{})},{onConflict:'repository_id,sha'}).select().single(); checkDb(row.error);
    if(c.files?.length) { const f=await db.from('file_changes').upsert(c.files.map(f=>({...f,commit_id:row.data.id})),{onConflict:'commit_id,file_path'});checkDb(f.error); }
    return {...c,id:row.data.id};
  }
  async function detail(repository:Repository,sha:string):Promise<Commit> {
    shaSchema.parse(sha);
    const cached=await db.from('commits').select('*,file_changes(*)').eq('repository_id',repository.id).eq('sha',sha).maybeSingle();checkDb(cached.error);
    if(cached.data?.details_loaded) return {...cached.data,files:cached.data.file_changes};
    return saveCommit(repository,await commitDetails(repository.github_owner,repository.github_name,sha));
  }
  if(path[0]==='repositories' && path.length===1) {
    if(req.method==='GET') { const r=await db.from('repositories').select('*').order('created_at',{ascending:false});checkDb(r.error);return ok(r.data); }
    if(req.method==='POST') {
      const parsed=parseRepository(inputSchema.parse(await body(req)).url);
      const {data}=await github(`/repos/${parsed.owner}/${parsed.name}`);
      if(data.private) throw new ServiceError(400,'Only public repositories are supported.');
      const r=await db.from('repositories').upsert({owner_id:user.id,github_owner:data.owner.login,github_name:data.name,full_name:data.full_name,github_url:data.html_url,default_branch:data.default_branch,description:data.description},{onConflict:'owner_id,full_name'}).select().single(); checkDb(r.error);return ok(r.data);
    }
  }
  if(path.join('/')==='validate' && req.method==='POST') return ok(parseRepository(inputSchema.parse(await body(req)).url));
  if(path[0]==='repositories' && path[1]) {
    const repository=await repo(path[1]);const base=`/repos/${repository.github_owner}/${repository.github_name}`;
    if(path.length===2) {
      if(req.method==='GET') return ok(repository);
      if(req.method==='DELETE') { const r=await db.from('repositories').delete().eq('id',repository.id);checkDb(r.error);return ok({deleted:true}); }
    }
    if(path[2]==='branches' && req.method==='GET') { const r=await github(`${base}/branches?per_page=100`);return ok({branches:r.data,more:r.more}); }
    if(path[2]==='commits' && path.length===3 && req.method==='GET') {
      const page=z.coerce.number().int().min(1).max(100).parse(req.nextUrl.searchParams.get('page') || '1');
      const branch=z.string().max(250).parse(req.nextUrl.searchParams.get('branch') || repository.default_branch);
      const r=await github(`${base}/commits?per_page=20&page=${page}&sha=${encodeURIComponent(branch)}`);
      const commits=await Promise.all((r.data as unknown[]).map(normalizeCommit).map(c=>saveCommit(repository,c)));
      return ok({commits,more:r.more,page});
    }
    if(path[2]==='commits' && path[3] && req.method==='GET') return ok(await detail(repository,path[3]));
    if(path[2]==='saved-commits' && req.method==='GET') { const r=await db.from('commits').select('*,file_changes(*)').eq('repository_id',repository.id).order('committed_at',{ascending:false}).limit(200);checkDb(r.error);return ok(r.data.map(c=>({...c,files:c.file_changes}))); }
    if(path[2]==='compare' && req.method==='GET') { const a=shaSchema.parse(req.nextUrl.searchParams.get('base'));const b=shaSchema.parse(req.nextUrl.searchParams.get('head'));const r=await github(`${base}/compare/${a}...${b}?per_page=100`);return ok(r.data); }
    if(path[2]==='snapshot' && req.method==='GET') {
      const sha=shaSchema.parse(req.nextUrl.searchParams.get('ref'));const file=z.string().min(1).max(500).parse(req.nextUrl.searchParams.get('file'));
      if(file.split('/').some(p=>p==='..'||p==='.') || file.startsWith('/')) throw new ServiceError(400,'Invalid file path.');
      const r=await github(`${base}/contents/${file.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`);
      if(r.data.type!=='file' || r.data.size>150000 || r.data.encoding!=='base64') throw new ServiceError(422,'Preview unavailable for binary or large files.');
      const content=Buffer.from(r.data.content,'base64').toString('utf8');
      if(content.includes('\u0000')) throw new ServiceError(422,'Binary preview unavailable.');
      return ok({content,sha,file});
    }
    if(path[2]==='analyze' && req.method==='POST') {
      const payload=z.object({shas:z.array(shaSchema).min(1).max(3)}).parse(await body(req));
      const run=await db.from('analysis_runs').insert({repository_id:repository.id,owner_id:user.id,status:'running',analysis_type:'deterministic'}).select().single();checkDb(run.error);
      try { const commits=[];for(const sha of payload.shas) commits.push(await detail(repository,sha));const finished=await db.from('analysis_runs').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',run.data.id);checkDb(finished.error);return ok({run_id:run.data.id,commits,leads:commits.flatMap(c=>(c.files || []).flatMap(f=>classify(f).map(title=>({title,sha:c.sha,file_path:f.file_path}))))}); }
      catch(e) { await db.from('analysis_runs').update({status:'failed',error_message:'Batch interrupted. Retry to resume; completed commit details are cached.',completed_at:new Date().toISOString()}).eq('id',run.data.id);throw e; }
    }
    if(path[2]==='graveyard' && req.method==='GET') { const r=await db.from('commits').select('*,file_changes(*)').eq('repository_id',repository.id).eq('details_loaded',true).limit(200);checkDb(r.error);return ok(r.data.flatMap(c=>c.file_changes.filter((f:{deletions:number;change_type:string})=>f.deletions>0 || f.change_type==='removed').map((f:object)=>({commit:c.sha,html_url:c.html_url,...f})))); }
  }
  if(path[0]==='ai' && req.method==='POST') {
    const payload=aiSchema.parse(await body(req));const repository=await repo(payload.repository_id);
    const history:{role:string;content:string}[]=[];
    if(payload.thread_id) { const t=await db.from('investigation_threads').select('id').eq('id',payload.thread_id).eq('repository_id',repository.id).single();if(t.error) throw new ServiceError(404,'Conversation not found.');const msgs=await db.from('investigation_messages').select('role,content').eq('thread_id',payload.thread_id).order('created_at',{ascending:false}).limit(6);checkDb(msgs.error);history.push(...(msgs.data || []).reverse()); }
    let commits:Commit[]=[];
    if(payload.sha) commits=[await detail(repository,payload.sha)];
    else { const r=await db.from('commits').select('*,file_changes(*)').eq('repository_id',repository.id).eq('details_loaded',true).order('committed_at',{ascending:false}).limit(100);checkDb(r.error);commits=(r.data || []).map(c=>({...c,files:c.file_changes})); }
    if(!commits.length) throw new ServiceError(422,'Inspect or analyze commits first so Gemma has historical evidence.');
    const key=createHash('sha256').update(JSON.stringify({commits,question:payload.question,mode:payload.mode,history,model:process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',v:PROMPT_VERSION})).digest('hex');
    const cache=await db.from('ai_cache').select('result').eq('owner_id',user.id).eq('cache_key',key).maybeSingle();checkDb(cache.error);
    const run=await db.from('analysis_runs').insert({repository_id:repository.id,owner_id:user.id,status:'running',analysis_type:payload.mode}).select().single();checkDb(run.error);
    try {
      const result=cache.data?.result || await investigate(payload.question,payload.mode,commits,history);
      if(!cache.data) { const c=await db.from('ai_cache').upsert({owner_id:user.id,repository_id:repository.id,cache_key:key,result},{onConflict:'owner_id,cache_key'});checkDb(c.error); }
      if(result.findings.length) { const f=await db.from('ai_findings').insert(result.findings.map((f:{finding_type:string;title:string;summary:string;severity:string;evidence_status:string;evidence:unknown;recommended_action:string;explanation:string})=>({analysis_run_id:run.data.id,finding_type:f.finding_type,title:f.title,description:f.summary,severity:f.severity,evidence_status:f.evidence_status,evidence_json:f.evidence,recommended_action:f.recommended_action,explanation:f.explanation})));checkDb(f.error); }
      let thread=payload.thread_id;
      if(!thread) { const t=await db.from('investigation_threads').insert({repository_id:repository.id,owner_id:user.id,title:payload.question.slice(0,100)}).select().single();checkDb(t.error);thread=t.data.id; }
      const m=await db.from('investigation_messages').insert([{thread_id:thread,role:'user',content:payload.question},{thread_id:thread,role:'assistant',content:result.answer,evidence_json:result.findings}]);checkDb(m.error);
      if(payload.mode==='report') { const report=await db.from('reports').insert({analysis_run_id:run.data.id,owner_id:user.id,title:`Investigation: ${repository.full_name}`,report_content:JSON.stringify(result)});checkDb(report.error); }
      const update=await db.from('analysis_runs').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',run.data.id);checkDb(update.error);
      return ok({...result,thread_id:thread,run_id:run.data.id,cached:!!cache.data});
    } catch(e) { await db.from('analysis_runs').update({status:'failed',error_message:'Analysis failed. Retry from the investigation workspace.',completed_at:new Date().toISOString()}).eq('id',run.data.id);throw e; }
  }
  if(path[0]==='investigations' && req.method==='GET') {
    if(path[1]) { uuid.parse(path[1]);const t=await db.from('investigation_threads').select('*').eq('id',path[1]).single();if(t.error) throw new ServiceError(404,'Investigation not found.');const m=await db.from('investigation_messages').select('*').eq('thread_id',path[1]).order('created_at');checkDb(m.error);return ok({...t.data,messages:m.data}); }
    const r=await db.from('investigation_threads').select('*,repositories(full_name)').order('created_at',{ascending:false}).limit(50);checkDb(r.error);return ok(r.data);
  }
  if(path[0]==='runs' && req.method==='GET') {const r=await db.from('analysis_runs').select('*').order('started_at',{ascending:false}).limit(100);checkDb(r.error);return ok(r.data);}
  if(path[0]==='reports' && req.method==='GET') {const r=await db.from('reports').select('*').order('created_at',{ascending:false}).limit(50);checkDb(r.error);return ok(r.data);}
  if(path[0]==='profile') {
    if(req.method==='GET') { const r=await db.from('profiles').select('*').eq('id',user.id).maybeSingle();checkDb(r.error);return ok({email:user.email,...r.data}); }
    if(req.method==='PATCH') {const p=z.object({display_name:z.string().trim().min(1).max(80)}).parse(await body(req));const r=await db.from('profiles').upsert({id:user.id,...p});checkDb(r.error);return ok(p);}
    if(req.method==='DELETE') {const r=await db.from('repositories').delete().eq('owner_id',user.id);checkDb(r.error);return ok({deleted:true});}
  }
  throw new ServiceError(404,'Endpoint not found.');
 } catch(error) {
   let status=500,message='The request could not be completed. Please retry.';
   if(error instanceof ServiceError) {status=error.status;message=error.message;}
   else if(error instanceof z.ZodError) {status=400;message='Invalid request. Check the supplied fields.';}
   else if(error instanceof Error && error.message==='UNAUTHORIZED') {status=401;message='Sign in to access your investigation workspace.';}
   else if(error instanceof Error && error.message==='SETUP_REQUIRED') {status=503;message='Configure Supabase to use the live workspace. The synthetic demo is available.';}
   else if(error instanceof Error && error.message==='DATABASE_ERROR') {status=503;message='Database request failed. Check the migration and project configuration.';}
   else if(error instanceof Error && error.message.startsWith('Use ') || error instanceof Error && error.message.startsWith('Enter ') || error instanceof Error && error.message.startsWith('Invalid GitHub')) {status=400;message=(error as Error).message;}
   return NextResponse.json({error:{code:status,message}},{status,headers:{'Cache-Control':'no-store'}});
 }
}
export { handle as GET,handle as POST,handle as DELETE,handle as PATCH };
