import { describe,it,expect } from 'vitest';
import { parseRepository,changedLines,classify,validateEvidence,answerSchema,rankCommits } from '../src/lib/analysis';
import {demoCommits} from '../src/lib/demo';
describe('repository URLs',()=>{
 it('normalizes HTTPS root URLs',()=>expect(parseRepository(' https://github.com/owner/repo.git/ ').url).toBe('https://github.com/owner/repo'));
 it.each(['http://github.com/a/b','https://github.com.evil.test/a/b','https://github.com/a/b/tree/main','https://user:secret@github.com/a/b','https://github.com/a/b?x=y','https://gitlab.com/a/b','https://github.com/a/b#readme','not a URL'])('rejects unsafe or non-root URL %s',url=>expect(()=>parseRepository(url)).toThrow());
});
describe('deterministic diff evidence',()=>{
 it('tracks old and new source lines independently',()=>{const lines=changedLines(demoCommits[0].files![0]);expect(lines[0]).toMatchObject({side:'old',line:13,text:'  if (!token || token.length < 32) {'});expect(lines.find(l=>l.side==='new')?.line).toBe(13);});
 it('distinguishes renames from confirmed deletion',()=>{expect(classify(demoCommits[2].files![0])).toContain('Renamed or moved file');expect(classify(demoCommits[2].files![0])).not.toContain('Confirmed file deletion');expect(classify(demoCommits[1].files![0])).toContain('Confirmed file deletion');});
 it('flags unavailable patches as incomplete',()=>expect(classify({...demoCommits[0].files![0],patch_excerpt:null,diff_truncated:true})).toContain('Incomplete diff evidence'));
 it('flags a validation removal as a review lead, never a vulnerability',()=>expect(classify(demoCommits[0].files![0])).toContain('Validation or error-handling review'));
 it('ranks transparent keyword evidence',()=>expect(rankCommits(demoCommits,'payment validator')[0].commit.sha).toBe(demoCommits[1].sha));
});
const finding={title:'Removed check',finding_type:'validation',summary:'Check removed',severity:'medium' as const,evidence_status:'hypothesis' as const,explanation:'Possible risk, requires testing',recommended_action:'Check gateway validation',evidence:[{sha:demoCommits[0].sha,file_path:'src/auth/session.ts',line:13,quote:'  if (!token || token.length < 32) {'}]};
describe('evidence validator',()=>{
 it('accepts exact changed-line references',()=>{const f=validateEvidence(finding,demoCommits);expect(f.evidence_status).toBe('hypothesis');expect(f.evidence[0].verified).toBe(true);});
 it.each([{sha:'f'.repeat(40)},{file_path:'imaginary.ts'},{line:999},{quote:'invented code'}])('rejects unsupported reference %o',override=>{const f=validateEvidence({...finding,evidence:[{...finding.evidence[0],...override}]},demoCommits);expect(f.evidence_status).toBe('insufficient');expect(f.evidence[0].verified).toBe(false);});
 it('does not accept a naked line number',()=>{const f=validateEvidence({...finding,evidence:[{sha:demoCommits[0].sha,file_path:'src/auth/session.ts',line:13}]},demoCommits);expect(f.evidence_status).toBe('insufficient');});
 it('requires evidence for important findings',()=>expect(validateEvidence({...finding,evidence:[]},demoCommits).evidence_status).toBe('insufficient'));
 it('rejects malformed AI output',()=>{expect(answerSchema.safeParse({answer:'hello',findings:[{title:'fake'}]}).success).toBe(false);expect(answerSchema.safeParse({answer:'hello',findings:[finding]}).success).toBe(true);});
});
