# Beliefs — index

60 belief documents, consolidated from ~631 non-workflow-change-memory packets under
`.agent_memory/packets/` (of ~758 total; workflow-change-memory packets were used only
as evidence trails, per the wave-1 brief). Each belief states one durable domain of
understanding in plain prose, with a confidence line, supporting packet citations, and
honestly-surfaced contradictions or open questions — see the belief doc itself for the
full statement and evidence; this file is a one-line-per-belief map for a human reviewer.

Nothing here is wired to any reader yet (no kernel, recall, or MCP-tool path reads this
directory). That wiring is wave 2, after owner review. See `self.md` for what this
harness manages overall and the current confidence map.

Confidence key: **settled** (foundational, repeatedly re-confirmed) · **firm** (verified,
but a real gap or standing-risk pattern remains) · **provisional** (thinner evidence, or
an unconfirmed/undone follow-up).

## Verification & Honesty

- **Checks Passed Is Not Verified** — firm ([`verify-checks-not-verified-gate.md`](verify-checks-not-verified-gate.md))
- **The Citations Check's Honesty Boundary** — firm ([`verify-citation-check-honesty.md`](verify-citation-check-honesty.md))
- **Claim-Shape Receipts And The Empty Diff** — firm ([`verify-claim-shape-and-empty-diff.md`](verify-claim-shape-and-empty-diff.md))
- **Verification By Execution** — settled ([`verify-execution-architecture.md`](verify-execution-architecture.md))
- **Liveness Tracking Under Parallel Dispatch** — firm ([`verify-liveness-and-parallel-dispatch.md`](verify-liveness-and-parallel-dispatch.md))
- **Verification Lock Mechanics** — settled ([`verify-lock-mechanics.md`](verify-lock-mechanics.md))
- **The Value/Gains Receipts Ledger** — settled ([`verify-value-ledger-receipts.md`](verify-value-ledger-receipts.md))

## Delegation & Merge-Ratification

- **Brief Compilation and Hired-Agent Sandbox Permissions** — firm ([`delegation-brief-and-sandbox-permissions.md`](delegation-brief-and-sandbox-permissions.md))
- **Merge-Ratification Flywheel** — firm ([`delegation-merge-ratification-flywheel.md`](delegation-merge-ratification-flywheel.md))
- **Reject State Gate and Honest Rejection Reasons** — firm ([`delegation-reject-state-gate-and-claim-honesty.md`](delegation-reject-state-gate-and-claim-honesty.md))
- **Run Lifecycle: Detached Dispatch and Honest Event Delivery** — firm ([`delegation-run-lifecycle-and-event-delivery.md`](delegation-run-lifecycle-and-event-delivery.md))

## Run & Goal Lifecycle

- **Goal Attachment and the Orchestrator Wake-Loop** — firm ([`run-goal-attachment-and-wake-loop.md`](run-goal-attachment-and-wake-loop.md))
- **MCP Tool Response Budget Discipline** — firm ([`run-mcp-response-budget-discipline.md`](run-mcp-response-budget-discipline.md))
- **Run Recovery and Orphan Semantics** — firm ([`run-recovery-and-orphan-semantics.md`](run-recovery-and-orphan-semantics.md))
- **Risk Assessment Stays Memory-First** — provisional ([`run-risk-assessment.md`](run-risk-assessment.md))
- **State-Machine Reachability Discipline** — firm ([`run-state-machine-reachability-discipline.md`](run-state-machine-reachability-discipline.md))

## Room Manager

- **Room Chat Unification and Actions** — provisional ([`room-chat-unification-and-actions.md`](room-chat-unification-and-actions.md))
- **Room Delegation-API Seams** — provisional ([`room-delegation-api-seams.md`](room-delegation-api-seams.md))
- **Room Honesty Guards** — firm ([`room-honesty-guards.md`](room-honesty-guards.md))
- **Room MCP Config and Thread Scoping** — firm ([`room-mcp-config-and-thread-scoping.md`](room-mcp-config-and-thread-scoping.md))
- **Room Supervisor Lifecycle** — firm ([`room-supervisor-lifecycle.md`](room-supervisor-lifecycle.md))

## App Renderer

- **CSS/DOM Conventions and Layout Gotchas in the App Renderer** — provisional ([`renderer-css-dom-conventions.md`](renderer-css-dom-conventions.md))
- **App Renderer Template-Literal Constraints** — firm ([`renderer-template-literal-constraints.md`](renderer-template-literal-constraints.md))
- **VM-Sandbox Testing of app-client.ts's Module-Level State** — firm ([`renderer-vm-sandbox-testing.md`](renderer-vm-sandbox-testing.md))

## Knowledge Portal / Viewer

- **The viewer's proof surfaces must not overstate what they measure** — firm ([`portal-benchmark-and-trust-honesty.md`](portal-benchmark-and-trust-honesty.md))
- **Local daemon routing vs. hosted GitHub Pages viewer** — firm ([`portal-daemon-routing-and-hosting.md`](portal-daemon-routing-and-hosting.md))
- **Viewer graph canvas: rendering approach and default density** — firm ([`portal-graph-canvas-rendering.md`](portal-graph-canvas-rendering.md))
- **Viewer layout: bounded scroll regions and explicit navigation** — firm ([`portal-layout-and-interaction.md`](portal-layout-and-interaction.md))
- **Making the memory-code graph visually trustworthy** — firm ([`portal-memory-code-graph-fidelity.md`](portal-memory-code-graph-fidelity.md))
- **The viewer's product-shell redesign, and its later retirement** — firm ([`portal-product-design-evolution.md`](portal-product-design-evolution.md))

## Release & Versioning

- **Release: the 1.1.x Feature Train and Changelog Convention** — firm ([`release-1-1-x-train-and-changelog-convention.md`](release-1-1-x-train-and-changelog-convention.md))
- **Release Verification: Dispatched-Agent Sandbox Command Execution** — provisional ([`release-agent-sandbox-command-execution.md`](release-agent-sandbox-command-execution.md))
- **Release: npm Publish and Electron Packaging Flow** — firm ([`release-publish-and-packaging-flow.md`](release-publish-and-packaging-flow.md))
- **Release: Version Lockstep and the Burned npm Lineage** — firm ([`release-version-lockstep-and-burned-lineage.md`](release-version-lockstep-and-burned-lineage.md))
- **Release: Website, Hosted Viewer, and Public Positioning** — firm ([`release-website-viewer-and-public-positioning.md`](release-website-viewer-and-public-positioning.md))

## Desktop Shell & Delegation-App UX

- **Desktop Shell Packaging and Delegation App Interaction Surface** — firm ([`desktop-shell-packaging-and-delegation-app-ux.md`](desktop-shell-packaging-and-delegation-app-ux.md))

## Memory System (Admission, Staleness, Recall, Governance)

- **Memory Admission Quality Floor** — firm ([`memory-admission-quality-floor.md`](memory-admission-quality-floor.md))
- **Distillation and Curation Lifecycle** — provisional ([`memory-distillation-curation.md`](memory-distillation-curation.md))
- **Memory Governance: Audit, Lineage, Privacy, and the Hooks-Only Capture Loop** — provisional ([`memory-governance-audit-lineage-privacy.md`](memory-governance-audit-lineage-privacy.md))
- **Recall Retrieval Tuning** — firm ([`memory-recall-retrieval-tuning.md`](memory-recall-retrieval-tuning.md))
- **Memory Staleness Triage** — firm ([`memory-staleness-triage.md`](memory-staleness-triage.md))

## Code & Knowledge Graph

- **Code Graph Construction and Scale** — firm ([`graph-code-graph-construction-and-scale.md`](graph-code-graph-construction-and-scale.md))
- **Code Graph Language and Framework Coverage** — firm ([`graph-language-and-framework-coverage.md`](graph-language-and-framework-coverage.md))
- **Memory-Code Linkage and Freshness Fingerprinting** — firm ([`graph-memory-code-linkage-and-freshness.md`](graph-memory-code-linkage-and-freshness.md))
- **Reachability Checker Parser Edge Cases** — firm ([`graph-reachability-parser-edge-cases.md`](graph-reachability-parser-edge-cases.md))

## Infrastructure (Process, Storage, Worktrees)

- **Daemon Startup, Port Honesty, and Not Blocking the Serving Thread** — firm ([`infra-daemon-startup-and-port-honesty.md`](infra-daemon-startup-and-port-honesty.md))
- **Local-Only Repo Intelligence Governance** — settled ([`infra-local-only-repo-intelligence-governance.md`](infra-local-only-repo-intelligence-governance.md))
- **Memory Store Backend Correctness (JSON/SQLite Port)** — firm ([`infra-memory-store-backend-correctness.md`](infra-memory-store-backend-correctness.md))
- **Process Liveness and Kill Semantics** — provisional ([`infra-process-liveness-and-kill-semantics.md`](infra-process-liveness-and-kill-semantics.md))
- **Worktree Isolation and Git-Scoped Diffs** — firm ([`infra-worktree-isolation-and-git-scoped-diffs.md`](infra-worktree-isolation-and-git-scoped-diffs.md))

## Terminal & Chat UI

- **Board/Card Layout and Responsive (Phone-Width) Fixes** — firm ([`ui-board-card-and-responsive-layout.md`](ui-board-card-and-responsive-layout.md))
- **Chat/Session Continuity: Resume the Real Session, Never Restart** — firm ([`ui-chat-session-continuity.md`](ui-chat-session-continuity.md))
- **Terminal Mode and PTY Take-Over Lessons** — firm ([`ui-terminal-mode-and-pty-lessons.md`](ui-terminal-mode-and-pty-lessons.md))
- **Transcript, Chat, and Receipt Rendering Must Stay Honest** — firm ([`ui-transcript-chat-and-receipt-rendering.md`](ui-transcript-chat-and-receipt-rendering.md))

## Operations (CI, Metrics, Stalls, OKF)

- **Testing-infrastructure gotchas found via dogfooding and fast test fixtures** — provisional ([`ops-dogfood-testing-gotchas.md`](ops-dogfood-testing-gotchas.md))
- **OKF is Kage's standard on-disk and interchange memory format** — provisional ([`ops-okf-standard-adoption.md`](ops-okf-standard-adoption.md))
- **PR-check gating and Kage's self-hosted CI reliability** — provisional ([`ops-pr-check-and-ci-gate-reliability.md`](ops-pr-check-and-ci-gate-reliability.md))
- **Delegated-run budgets evolved from an unconfigurable $2 cap into a stall-detecting circuit breaker** — firm ([`ops-run-lifecycle-budgets-and-stalls.md`](ops-run-lifecycle-budgets-and-stalls.md))
- **Honest value and cost accounting in Kage's self-reported metrics** — provisional ([`ops-value-metrics-accuracy.md`](ops-value-metrics-accuracy.md))

## Benchmarks & Agent Orientation

- **Benchmarks, Agent Orientation, and MCP Tool Token Economy** — firm ([`benchmarks-and-agent-orientation.md`](benchmarks-and-agent-orientation.md))

