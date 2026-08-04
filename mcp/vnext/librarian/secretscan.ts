// The deterministic secret scan — the gate's hardest "no".
//
// A card is about to become durable, synced, team-visible text. A leaked key in a claim is not
// a quality problem, it is an incident — so this check is deterministic, runs before any human
// sees the proposal, and its refusal cannot be argued with by a model. False positives are
// acceptable here in a way false negatives are not: a blocked card can be rephrased in a
// minute; a synced secret cannot be unsynced.

const PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "aws access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "anthropic/openai-style key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "github token", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/ },
  { name: "github fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: "slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "bearer token", pattern: /\bBearer\s+[A-Za-z0-9_\-.=]{24,}\b/ },
  // The generic catch: `password = "…"`-shaped assignments with a long opaque value. The value
  // must be quoted — an unquoted identifier is far more likely to be code being cited.
  { name: "credential assignment", pattern: /\b(?:api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*["'][A-Za-z0-9+/_=-]{16,}["']/i },
];

/** Names of every pattern the text trips. Empty means clean. */
export function scanForSecrets(text: string): string[] {
  const hits: string[] = [];
  for (const { name, pattern } of PATTERNS) {
    if (pattern.test(text)) hits.push(name);
  }
  return hits;
}
