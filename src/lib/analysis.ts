import { z } from 'zod';
import type { Commit, FileChange, Finding } from './types';

export function parseRepository(input: string) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Enter a full https://github.com/owner/repository URL.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('Use a public github.com repository URL without query parameters.');
  const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  if (parts.length !== 2) throw new Error('Use the repository root URL, not a file or branch URL.');
  const [owner, raw] = parts; const name = raw.replace(/\.git$/, '');
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(owner) || !/^[\w.-]{1,100}$/.test(name) || name === '.' || name === '..') throw new Error('Invalid GitHub owner or repository name.');
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}
export function changedLines(file: FileChange) {
  let oldLine = 0, newLine = 0;
  return (file.patch_excerpt || '').split('\n').flatMap(text => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) { oldLine = +hunk[1]; newLine = +hunk[2]; return []; }
    if (!oldLine && !newLine) return [];
    if (text.startsWith('-')) return [{ side: 'old' as const, line: oldLine++, text: text.slice(1) }];
    if (text.startsWith('+')) return [{ side: 'new' as const, line: newLine++, text: text.slice(1) }];
    if (text.startsWith(' ')) { oldLine++; newLine++; }
    return [];
  });
}
export function classify(file: FileChange) {
  const removed = changedLines(file).filter(l => l.side === 'old').map(l => l.text).join('\n');
  const leads: string[] = [];
  if (file.change_type === 'removed') leads.push('Confirmed file deletion');
  else if (file.change_type === 'renamed') leads.push('Renamed or moved file');
  else if (file.deletions > 0) leads.push('Confirmed line removal');
  if (file.deletions >= 100) leads.push('Large code removal');
  if (/validat|saniti|authoriz|authentic|permission|throw |catch\s*\(/i.test(removed)) leads.push('Validation or error-handling review');
  if (/(config|\.env|package\.json|lock$|\.ya?ml$)/i.test(file.file_path)) leads.push('Configuration change');
  if (!file.patch_excerpt || file.diff_truncated) leads.push('Incomplete diff evidence');
  return leads;
}
export const findingSchema = z.object({
  title: z.string().max(180), finding_type: z.string().max(80), summary: z.string().max(3000),
  severity: z.enum(['info','low','medium','high']), evidence_status: z.enum(['direct','hypothesis','insufficient','contradicted']),
  explanation: z.string().max(5000), recommended_action: z.string().max(3000),
  evidence: z.array(z.object({ sha: z.string(), file_path: z.string(), line: z.number().int().positive().optional(), quote: z.string().max(1000).optional() })).max(12),
});
export const answerSchema = z.object({ answer: z.string().max(12000), findings: z.array(findingSchema).max(12) });
export function validateEvidence(raw: z.infer<typeof findingSchema>, commits: Commit[]): Finding {
  const evidence = raw.evidence.map(ref => {
    const commit = commits.find(c => c.sha === ref.sha);
    const file = commit?.files?.find(f => f.file_path === ref.file_path);
    // A line is accepted only when an exact excerpt also matches that changed line.
    const verified = !!file && (!ref.line || (!!ref.quote && changedLines(file).some(l => l.line === ref.line && l.text === ref.quote))) && (!ref.quote || (file.patch_excerpt || '').split('\n').some(l => l.slice(1) === ref.quote));
    return { ...ref, html_url: commit?.html_url || '', verified };
  });
  return { ...raw, evidence, evidence_status: !evidence.length || evidence.some(e => !e.verified) ? 'insufficient' : raw.evidence_status };
}
export function rankCommits(commits: Commit[], question: string) {
  const words = [...new Set(question.toLowerCase().match(/[a-z][a-z0-9_]{2,}/g) || [])].filter(w => !['the','was','this','when','what','why','how','and','for','with','code','commit'].includes(w));
  return commits.map(c => ({ commit: c, score: words.reduce((n,w) => n + (c.message.toLowerCase().includes(w) ? 3 : 0) + (c.files?.some(f => f.file_path.toLowerCase().includes(w)) ? 2 : 0) + (c.files?.some(f => f.patch_excerpt?.toLowerCase().includes(w)) ? 1 : 0), 0) })).sort((a,b) => b.score-a.score);
}
