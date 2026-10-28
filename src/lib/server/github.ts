import 'server-only';
import { z } from 'zod';
import type { Commit, FileChange } from '../types';
export class ServiceError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function github(path: string) {
  for (let attempt=0; attempt<2; attempt++) {
    let response: Response;
    try { response = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }, signal: AbortSignal.timeout(12000), cache:'no-store' }); }
    catch { if (!attempt) continue; throw new ServiceError(504,'GitHub timed out. Try again.'); }
    if (response.status === 404) throw new ServiceError(404,'Public repository or revision not found. Private repositories are not supported.');
    if (response.status === 409) return { data: [], more: false };
    if (response.status === 403 || response.status === 429) throw new ServiceError(429,`GitHub request limit reached. Try after ${response.headers.get('x-ratelimit-reset') ? new Date(Number(response.headers.get('x-ratelimit-reset'))*1000).toISOString() : 'a short wait'}.`);
    if (response.status >= 500 && !attempt) continue;
    if (!response.ok) throw new ServiceError(502,'GitHub could not complete this request.');
    return { data: await response.json(), more: response.headers.get('link')?.includes('rel="next"') || false };
  }
  throw new ServiceError(502,'GitHub unavailable.');
}
const commitSchema = z.object({ sha:z.string(), html_url:z.string().url(), commit:z.object({message:z.string(),author:z.object({name:z.string(),date:z.string()}).nullable(),committer:z.object({date:z.string()}).nullable()}), parents:z.array(z.object({sha:z.string()})) });
export function normalizeCommit(input: unknown): Commit {
  const c = commitSchema.parse(input);
  return {sha:c.sha,message:c.commit.message,author_name:c.commit.author?.name || 'Unknown',committed_at:c.commit.committer?.date || c.commit.author?.date || new Date(0).toISOString(),html_url:c.html_url,parent_shas:c.parents.map(p=>p.sha)};
}
const fileSchema = z.object({filename:z.string(),previous_filename:z.string().optional(),status:z.string(),additions:z.number(),deletions:z.number(),patch:z.string().optional()});
export function normalizeFile(input: unknown): FileChange {
  const f=fileSchema.parse(input); const cap=12000;
  return {file_path:f.filename,previous_path:f.previous_filename,change_type:f.status,additions:f.additions,deletions:f.deletions,patch_excerpt:f.patch?.slice(0,cap) || null,diff_truncated:!f.patch || f.patch.length>cap};
}
export async function commitDetails(owner: string, name: string, sha: string): Promise<Commit> {
  const result=await github(`/repos/${owner}/${name}/commits/${sha}?per_page=100`);
  const data=result.data;
  return {...normalizeCommit(data), files:z.array(z.unknown()).parse(data.files || []).map(normalizeFile), files_incomplete:result.more};
}
