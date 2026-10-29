export type FileChange = {
  file_path: string;
  previous_path?: string;
  change_type: string;
  additions: number;
  deletions: number;
  patch_excerpt: string | null;
  diff_truncated: boolean;
};
export type Commit = {
  id?: string;
  sha: string;
  message: string;
  author_name: string;
  committed_at: string;
  html_url: string;
  parent_shas: string[];
  files?: FileChange[];
  files_incomplete?: boolean;
};
export type Repository = {
  id: string;
  full_name: string;
  github_owner: string;
  github_name: string;
  github_url: string;
  default_branch: string;
  description: string | null;
  created_at?: string;
};
export type Evidence = {
  sha: string;
  file_path: string;
  line?: number;
  quote?: string;
  html_url: string;
  verified: boolean;
};
export type Finding = {
  title: string;
  finding_type: string;
  summary: string;
  severity: "info" | "low" | "medium" | "high";
  evidence_status: "direct" | "hypothesis" | "insufficient" | "contradicted";
  explanation: string;
  recommended_action: string;
  evidence: Evidence[];
};
