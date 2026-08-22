---
type: "belief"
title: "Release Verification: Dispatched-Agent Sandbox Command Execution"
tags: ["release", "sandbox", "dispatch", "bash", "verification", "gotcha"]
---

# Release Verification: Dispatched-Agent Sandbox Command Execution

**Confidence:** provisional — the corrected explanation is well-evidenced and directly supersedes the earlier misdiagnosis, but it rests on a single corrective packet versus three that recorded the wrong belief, so it is worth re-confirming if the symptom resurfaces.

When a hired/delegated agent is verifying release-adjacent work — running `mcp/release.test.ts`'s version-lockstep test, checking a packaging fix builds cleanly, confirming a test-guard change — several early sessions recorded that the sandbox itself flatly denies most non-trivial Bash commands: `npm test`, `node --test ...`, `node -e`, `npx`, and even plain `node dist/x.js` all came back "requires approval" with no interactive prompt ever reaching the agent, while only trivial read-only commands (`pwd`, `node --version`, `grep`, `npm run build`) succeeded. One session found a partial workaround: `npm run test --prefix mcp` and `npm run build --prefix mcp` (invoking the same package.json scripts via the `npm run` form) were permitted even when the literal `npm test --prefix mcp` and raw `node -e`/`npx` were denied — establishing a practical rule of thumb to retry any denied command in `npm run <script>` form before concluding it truly can't run. That rule remains true as a workaround, but the root-cause belief behind it was wrong: a later correction established that hired agents genuinely *can* execute the full range of shell commands, including scoped `npx` and `node -e`. The actual cause of the earlier denials was that those agents had been spawned with `acceptEdits` but without an explicit `--allowedTools` grant — and a headless session with no allowlist and no interactive permission dialog denies Bash silently, which is indistinguishable from a real sandbox policy denial when observed only from inside the agent. Once the spawn was corrected to pass `--allowedTools`, the previously-denied commands ran normally.

The practical implication for anyone briefing a dispatched agent on release verification: do not tell it to skip running tests on the assumption that "the sandbox blocks commands here" — that assumption has already been shown false once. Require the agent to actually run its checks, and if commands genuinely fail, first suspect the spawn configuration (missing `--allowedTools`) before concluding the environment is fundamentally restricted. The `npm run <script>` retry trick is still useful as an immediate fallback, but the durable fix belongs at the dispatch/spawn layer, not in individual verification workarounds.

## Supporting evidence

- `.agent_memory/packets/bug_fix-this-delegated-agent-sandbox-denies-all-non-trivial-bash-commands-npm-npx-tsc-pi-0b9527c6.md` — original observation: only trivial read-only commands succeeded, echoed by an earlier session hitting the same task.
- `.agent_memory/packets/bug_fix-npm-test-prefix-mcp-and-node-e-npx-are-denied-by-this-sandboxs-command-approv-7d0edd52.md` — the `npm run <script>` workaround discovered against the same apparent denial pattern.
- `.agent_memory/packets/bug_fix-in-this-delegated-agent-sandbox-bash-is-restricted-to-a-narrow-allowlist-npm-run-b7338847.md` — practical guidance under the (later-corrected) belief: verify packaging/test-guard fixes via `npm run build` plus static reasoning, and flag Kage's own re-run as the real verification.
- `.agent_memory/packets/gotcha-hired-agents-can-run-npm-node-npx-the-earlier-sandbox-denies-commands-reading-wa-adfd2eb2.md` — the correction: root cause was a missing `--allowedTools` spawn flag, not a sandbox policy; commands ran normally once fixed.

## Contradictions / open questions

- The four cited packets directly disagree with each other on the root cause: three (`0b9527c6`, `7d0edd52`, `b7338847`) describe a hard sandbox-level denial as environmental fact, while the fourth (`adfd2eb2`) explicitly states "An earlier packet recorded the opposite... and that reading was wrong about the cause." This belief treats the corrected packet as authoritative since it identifies a concrete, falsifiable mechanism (missing `--allowedTools`) rather than an unexplained policy, but the earlier three are kept as evidence of how convincing the misdiagnosis looked from inside an affected agent.
- Open question: whether every spawn path in the current dispatch system reliably sets `--allowedTools` now, or whether this class of false "sandbox denial" report could still recur for a differently-configured spawn.

## Causality

```mermaid
graph TD
  A[Agent spawned with acceptEdits but no explicit --allowedTools] --> B[Headless session has no allowlist and no interactive permission dialog]
  B --> C[Bash calls are denied silently, with no prompt]
  C --> D[From inside the agent, this is indistinguishable from a real sandbox policy]
  D --> E[Multiple sessions record "sandbox denies npm/npx/node" as environmental fact]
  F[Spawn corrected to pass --allowedTools] --> G[Same commands run normally]
  G --> H[Correction packet supersedes the earlier misdiagnosis]
```
