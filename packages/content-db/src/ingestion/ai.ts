/** Disabled extension point: a provider can propose, never apply, a change. */
export interface ExceptionProposal {
  kind: "parse" | "match" | "explain-conflict" | "parser-improvement";
  entryId: number;
  inputReferences: string[];
  proposedFields?: Record<string, unknown>;
  candidateIds?: string[];
  supportingPassages: Array<{ reference: string; text: string }>;
  uncertainty: string;
  model: string;
  promptVersion: string;
  usage: { requests: number; inputTokens: number; outputTokens: number };
}
export interface ExceptionBudget {
  maxRequests: number;
  maxTokens: number;
  timeoutMs: number;
  retries: number;
}
export const DEFAULT_AI_BUDGET: ExceptionBudget = {
  maxRequests: 0,
  maxTokens: 0,
  timeoutMs: 15000,
  retries: 0,
};
export function validateProposal(
  proposal: ExceptionProposal,
  budget: ExceptionBudget,
  allowedReferences: Set<string>,
) {
  if (
    !proposal.model ||
    !proposal.promptVersion ||
    !proposal.uncertainty ||
    !proposal.supportingPassages.length ||
    !Number.isInteger(proposal.entryId)
  )
    throw new Error("Incomplete evidence-backed proposal");
  const usage = proposal.usage;
  if (
    budget.maxRequests <= 0 ||
    budget.maxTokens <= 0 ||
    usage.requests < 1 ||
    ![usage.requests, usage.inputTokens, usage.outputTokens].every(
      (v) => Number.isSafeInteger(v) && v >= 0,
    ) ||
    usage.requests > budget.maxRequests ||
    usage.inputTokens + usage.outputTokens > budget.maxTokens
  )
    throw new Error("AI budget exceeded or disabled");
  for (const ref of [
    ...proposal.inputReferences,
    ...proposal.supportingPassages.map((p) => p.reference),
  ])
    if (!allowedReferences.has(ref))
      throw new Error("Unapproved input reference");
  const forbidden = [
    "eligibility",
    "license",
    "exception",
    "protectedFields",
    "authority",
    "purge",
    "promote",
  ];
  if (
    Object.keys(proposal.proposedFields ?? {}).some((k) =>
      forbidden.includes(k),
    )
  )
    throw new Error("AI cannot decide policy or mutate catalogue state");
  return {
    outcome: "pending-human-review" as const,
    schemaValidationRequired: true,
    proposal,
  };
}
