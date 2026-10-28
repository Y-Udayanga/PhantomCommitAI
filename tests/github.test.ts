import {it,expect,vi,afterEach,describe} from 'vitest';
import {github,normalizeCommit,normalizeFile,commitDetails} from '../src/lib/server/github';
afterEach(()=>vi.unstubAllGlobals());
const raw={sha:'a'.repeat(40),html_url:'https://github.com/test/repo/commit/'+'a'.repeat(40),commit:{message:'remove validator',author:{name:'Alex',date:'2026-10-24T00:00:00Z'},committer:{date:'2026-10-24T00:00:00Z'}},parents:[{sha:'b'.repeat(40)}]};
describe('GitHub boundary',()=>{
 it('normalizes metadata without inventing intent',()=>expect(normalizeCommit(raw)).toMatchObject({sha:raw.sha,message:'remove validator',parent_shas:['b'.repeat(40)]}));
 it('bounds patch storage and marks truncation',()=>expect(normalizeFile({filename:'a.ts',status:'modified',additions:1,deletions:5,patch:'x'.repeat(15000)})).toMatchObject({patch_excerpt:'x'.repeat(12000),diff_truncated:true}));
 it('handles missing patches and renames',()=>expect(normalizeFile({filename:'new.ts',previous_filename:'old.ts',status:'renamed',additions:0,deletions:0})).toMatchObject({previous_path:'old.ts',patch_excerpt:null,diff_truncated:true}));
 it('surfaces rate limits without retry storms',async()=>{const mock=vi.fn().mockResolvedValue(new Response('{}',{status:403,headers:{'x-ratelimit-reset':'1800000000'}}));vi.stubGlobal('fetch',mock);await expect(github('/repos/a/b')).rejects.toMatchObject({status:429});expect(mock).toHaveBeenCalledTimes(1);});
 it('handles empty repositories',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:409})));expect((await github('/repos/a/b/commits')).data).toEqual([]);});
 it('retries temporary failures at most once',async()=>{const f=vi.fn().mockResolvedValue(new Response('{}',{status:503}));vi.stubGlobal('fetch',f);await expect(github('/repos/a/b')).rejects.toMatchObject({status:502});expect(f).toHaveBeenCalledTimes(2);});
 it('preserves incomplete file pagination',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({...raw,files:[]}),{headers:{link:'<https://api.github.com/page2>; rel="next"'}})));expect((await commitDetails('test','repo',raw.sha)).files_incomplete).toBe(true);});
});
it.skipIf(!process.env.RUN_LIVE_GITHUB)('reads actual public GitHub metadata',async()=>{const r=await github('/repos/octocat/Hello-World');expect(r.data.full_name).toBe('octocat/Hello-World');});
