export const analysisModes = [
  "review",
  "patch-review",
  "explain",
  "risk",
  "chat",
  "time-machine",
  "root-cause",
  "graveyard",
  "dna",
  "restore",
  "regression",
  "security-drift",
  "forgotten",
  "tests",
  "impact",
  "story",
  "report",
  "intent",
  "recommendations",
] as const;
export type AnalysisMode = (typeof analysisModes)[number];
export type InvestigationScope = {
  file?: string;
  since?: string;
  until?: string;
};
export const aiTasks: {
  mode: AnalysisMode;
  title: string;
  category: string;
  description: string;
  question: string;
  instruction: string;
}[] = [
  {
    mode: "review",
    title: "Evidence challenger",
    category: "Investigate",
    description: "Challenge a prior finding against the actual Git evidence.",
    question:
      "Check the following analysis for unsupported claims, contradictions and missing evidence:",
    instruction:
      "Review the supplied claim against exact evidence. Distinguish unproven from contradicted. Cite a contradiction only when the diff explicitly establishes it. Do not invent numeric confidence or claim exhaustive verification.",
  },
  {
    mode: "patch-review",
    title: "Restoration patch review",
    category: "Create",
    description:
      "Audit a proposed patch against historical behavior and missing checks.",
    question:
      "Review the following proposed restoration patch against the historical evidence:",
    instruction:
      "Treat the proposed patch as untrusted, unapplied developer text. Explain compatibility concerns, missing checks and tests required. Cite historical evidence for each comparison. Never claim the proposal was applied, compiled or tested.",
  },
  {
    mode: "explain",
    title: "Ghost explainer",
    category: "Understand",
    description:
      "Explain previous behavior, new behavior, and what remains unknown.",
    question:
      "Explain what changed, the previous and new implementations, possible effects, and unknowns.",
    instruction:
      "Explain changes for a junior developer. Separate documented intent from guesses and explicitly state when intent is unknown.",
  },
  {
    mode: "time-machine",
    title: "Developer time machine",
    category: "Discover",
    description: "Trace a historical question through inspected commits.",
    question:
      "What does the inspected history establish about the evolution of this code?",
    instruction:
      "Answer historical questions using only inspected commits. Never state the first or last occurrence across the whole repository when only a bounded history is available.",
  },
  {
    mode: "risk",
    title: "Haunted bug review",
    category: "Investigate",
    description:
      "Review removed checks and error handling as testable risk hypotheses.",
    question:
      "Which changes deserve review for possible regressions or security risks, and what evidence is missing?",
    instruction:
      "Focus on changed validation, auth, error handling and dependency/configuration changes. Risks remain hypotheses unless reproduced; do not call an untested lead a confirmed vulnerability.",
  },
  {
    mode: "root-cause",
    title: "Root cause investigator",
    category: "Investigate",
    description: "Compare a reported symptom with historical evidence.",
    question:
      "Investigate this reported behavior and rank relevant commits for reproduction:",
    instruction:
      "Use the reported symptoms to identify relevant inspected commits. Explain the evidence match, alternatives and a reproduction plan. Never assert causality from visual inspection alone.",
  },
  {
    mode: "regression",
    title: "Regression suspect finder",
    category: "Investigate",
    description:
      "Use a symptom, date range, and file scope to narrow the search.",
    question: "Rank the inspected changes that could explain this regression:",
    instruction:
      "Rank potential suspects transparently by symptom, path and diff overlap. Distinguish retrieval ranking from proof of causation. Describe tests that could confirm or reject each suspect.",
  },
  {
    mode: "graveyard",
    title: "Deleted code investigator",
    category: "Discover",
    description:
      "Explain the original role and possible replacements for removed code.",
    question:
      "Explain the original purpose, historical location, and possible impact of removed code. Is a replacement visible?",
    instruction:
      "Explain deleted files and removed lines. A path deletion is not proof a function vanished everywhere. Cite a replacement only when its actual implementation is present in the supplied evidence.",
  },
  {
    mode: "dna",
    title: "Ghost DNA review",
    category: "Discover",
    description:
      "Distinguish recorded renames from possible moves and rewrites.",
    question:
      "Which code changes are confirmed renames, and which could be moves, rewrites, or replacements?",
    instruction:
      "Use previous_path and change_type for confirmed file renames. Similar code is only a lineage hypothesis. Do not invent similarity scores or claim semantic move detection. Mark missing destinations insufficient.",
  },
  {
    mode: "security-drift",
    title: "Security drift review",
    category: "Investigate",
    description:
      "Review changes to security-related logic over the selected scope.",
    question:
      "How has authentication, authorization, validation, or error handling changed in this inspected history?",
    instruction:
      "Order supplied security-related changes by committed_at. Separate removed checks from proof that a protection no longer exists elsewhere. Recommend focused validation and authorization tests.",
  },
  {
    mode: "forgotten",
    title: "Forgotten feature leads",
    category: "Discover",
    description: "Find removed behavior worth investigating further.",
    question:
      "What removed functionality appears worth investigating as a possibly forgotten feature?",
    instruction:
      "Present investigative leads, never claims about abandoned business requirements. Cite concrete removed functionality and explain why the supplied history cannot establish product intent or full feature abandonment.",
  },
  {
    mode: "restore",
    title: "Resurrection planner",
    category: "Create",
    description:
      "Propose a restoration patch with compatibility checks and tests.",
    question:
      "Suggest a carefully scoped restoration patch for historical functionality, with compatibility concerns and tests.",
    instruction:
      "Include an explicitly proposed unified diff in a finding explanation. Explain dependencies, compatibility risks and recommended tests. Never apply or commit code and never claim the proposed patch was tested.",
  },
  {
    mode: "tests",
    title: "Test case generator",
    category: "Create",
    description: "Suggest regression tests tied to the changed behavior.",
    question:
      "Suggest useful test cases for the changed behavior, including boundary cases and negative cases.",
    instruction:
      "Provide concrete suggested test code when the framework is evidenced; otherwise give framework-neutral cases. Link every test rationale to evidence. State tests are suggestions and have not been executed.",
  },
  {
    mode: "impact",
    title: "Change impact summary",
    category: "Understand",
    description: "Summarize the technical impact of several inspected changes.",
    question:
      "Summarize the combined technical impact of the inspected commits for developers and technical team leaders.",
    instruction:
      "Group related observed changes and explain possible effects without inventing a dependency graph or downstream consumers. Distinguish directly changed modules from hypothesized impact.",
  },
  {
    mode: "intent",
    title: "Commit intent classifier",
    category: "Understand",
    description: "Separate documented intent from inferred change categories.",
    question:
      "Classify the inspected commits as feature, refactor, bug fix, security, docs, configuration, or removal.",
    instruction:
      "State whether each category is explicitly documented in the message or inferred from the diff. A commit prefix is author-reported intent, not proof of actual behavior.",
  },
  {
    mode: "story",
    title: "Ghost story mode",
    category: "Understand",
    description:
      "Tell a restrained, factual story of actual repository changes.",
    question:
      "Tell the factual story of the inspected history with a subtle Ghost in the Machine theme.",
    instruction:
      "Write a chronological narrative with a restrained haunting. Every historical assertion belongs in a finding with real evidence. Do not invent events, dates, people, emotions or motives.",
  },
  {
    mode: "recommendations",
    title: "Next investigation steps",
    category: "Investigate",
    description: "Turn evidence gaps into concrete developer actions.",
    question:
      "What should a developer inspect or test next, based on the supplied evidence and its gaps?",
    instruction:
      "Produce specific actionable recommendations attached to real commit/file references. Identify what each next step could establish. No invented issue IDs, files or dependencies.",
  },
  {
    mode: "report",
    title: "Investigation report",
    category: "Create",
    description:
      "Compile observations, risks, open questions, and source references.",
    question:
      "Generate an investigation report with executive summary, scope, observations, risks, unresolved questions and next steps.",
    instruction:
      "Create a professional report. Label confirmed observations separately from hypotheses and limitations. Use findings for cited claims; do not imply full-repository coverage or completed testing.",
  },
];
export function taskInstruction(mode: AnalysisMode) {
  return mode === "chat"
    ? "Answer the follow-up question using the evidence and prior conversation, treating prior AI messages as unverified analysis."
    : aiTasks.find((t) => t.mode === mode)!.instruction;
}
