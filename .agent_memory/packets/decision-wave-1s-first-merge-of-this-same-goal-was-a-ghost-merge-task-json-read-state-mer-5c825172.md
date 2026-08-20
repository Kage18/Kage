---
type: "Decision"
title: "Wave 1's FIRST merge of this same goal was a 'ghost merge': task.json read state=merged..."
description: "Wave 1's FIRST merge of this same goal was a 'ghost merge': task.json read state=merged with all checks passing, but git log S \"reviewRun\" across every ref AND the reflog returned zero hits anywhere in history, and the b"
resource: "mcp/adapters-dispatch-supervisor-wiring.test.ts"
tags: ["delegated-run", "kage-run:adapters-dispatch-supervisor-wiring-for-260820-41d2"]
timestamp: "2026-08-20T21:35:55.979Z"
x-kage-id: "repo:adapters-dispatch-supervisor-wiring-for-260820-41d2:decision:wave-1s-first-merge-of-this-same-goal-was-a-ghost-merge-task-json-read-state-mer"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/adapters-dispatch-supervisor-wiring.test.ts", "mcp/cli.ts", "mcp/delegation/adapters/index.ts", "mcp/delegation/adapters/stub.ts", "mcp/delegation/dispatch.ts"]
---

# Wave 1's FIRST merge of this same goal was a 'ghost merge': task.json read state=merged...

> Wave 1's FIRST merge of this same goal was a 'ghost merge': task.json read state=merged with all checks passing, but …

Wave 1's FIRST merge of this same goal was a 'ghost merge': task.json read state=merged with all checks passing, but git log -S "reviewRun" across every ref AND the reflog returned zero hits anywhere in history, and the branch named for that run had been silently repointed to an unrelated commit — task-record metadata claiming a merge landed is not proof the code exists; always verify against git history directly, especially before building on a dependency another run claims to have shipped.

Learned while delivering: Adapters + dispatch/supervisor wiring for the reviewer role: reviewer-mode adapter input/argv builders reusing claude/codex, scripted stub reviewer behavior for tests, wiring dispatchReviewer via the onRunTransition hook Wave 1 added.
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-20T21:35:55.979Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:adapters-dispatch-supervisor-wiring-for-260820-41d2:decision:wave-1s-first-merge-of-this-same-goal-was-a-ghost-merge-task-json-read-state-mer","title":"Wave 1's FIRST merge of this same goal was a 'ghost merge': task.json read state=merged...","summary":"Wave 1's FIRST merge of this same goal was a 'ghost merge': task.json read state=merged with all checks passing, but git log S \"reviewRun\" across every ref AND the reflog returned zero hits anywhere in history, and the b","body":"Wave 1's FIRST merge of this same goal was a 'ghost merge': task.json read state=merged with all checks passing, but git log -S \"reviewRun\" across every ref AND the reflog returned zero hits anywhere in history, and the branch named for that run had been silently repointed to an unrelated commit — task-record metadata claiming a merge landed is not proof the code exists; always verify against git history directly, especially before building on a dependency another run claims to have shipped.\n\nLearned while delivering: Adapters + dispatch/supervisor wiring for the reviewer role: reviewer-mode adapter input/argv builders reusing claude/codex, scripted stub reviewer behavior for tests, wiring dispatchReviewer via the onRunTransition hook Wave 1 added.\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:adapters-dispatch-supervisor-wiring-for-260820-41d2"],"paths":["mcp/adapters-dispatch-supervisor-wiring.test.ts","mcp/cli.ts","mcp/delegation/adapters/index.ts","mcp/delegation/adapters/stub.ts","mcp/delegation/dispatch.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-20T21:35:55.979Z"}],"context":{"fact":"Wave 1's FIRST merge of this same goal was a 'ghost merge': task.json read state=merged with all checks passing, but git log -S \"reviewRun\" across every ref AND the reflog returned zero hits anywhere in history, and the branch named for that run had been silently repointed to an unrelated commit — task-record metadata claiming a merge landed is not proof the code exists; always verify against git history directly, especially before building on a dependency another run claims to have shipped.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-20T21:35:55.979Z","path_fingerprints":[{"path":"mcp/adapters-dispatch-supervisor-wiring.test.ts","sha256":"9a2c7dedf1d80e59748936c07443568062d204a68a8022b326fa5c0699c78c0a","size":11872,"symbols":[{"name":"state","kind":"constant","sha256":"b3aa94c9b546529aa80a34893379916574ab86398e684d6d9c91a8e10c0c03c4"}]},{"path":"mcp/cli.ts","sha256":"8f1e5df48842c357d172e06d84a81bff52329a8eea4b52c40ead41841b40f72b","size":150603,"symbols":[{"name":"json","kind":"constant","sha256":"9115381310c6d4c5ecb25a7e67e4fd0bb4b20a9b328adb25b606065454f79370"},{"name":"hits","kind":"constant","sha256":"2a108c5891a38559f3ffa3c05b368930be7cffb0a689eab195a43db5d0c97935"},{"name":"input","kind":"constant","sha256":"d1d17c5af7ab9a44dc69e4a5fac5e99a63dca89b1ee8252539b2ef74c8491ac3"},{"name":"adapter","kind":"constant","sha256":"2e03965f0bcebe5def784f5c4a88db584c4ace375048dc8f47f8f88c6399654d"},{"name":"test","kind":"constant","sha256":"c67f3770bf3c3e9b9aff73d99406c7664a900a970c68cfe75a1efefbd4447185"},{"name":"merged","kind":"constant","sha256":"f8820b7b2ad0d41f0dbeaaf24730974c74ae41535acbf5b741c959dc8f190046"}]},{"path":"mcp/delegation/adapters/index.ts","sha256":"bff6da4337f1942db905b8524e68833aa9f3c67b9585ea6959e8ea8439b99c8f","size":8884},{"path":"mcp/delegation/adapters/stub.ts","sha256":"d94b48c4f218b6e3ec33b5e681f255b55a5e0622b13c606874a2462fe0c564a6","size":8093,"symbols":[{"name":"behavior","kind":"constant","sha256":"029c100317bc7fa15f938473377e0f6d589541ae29e689868ea065d8ce1386f2"},{"name":"adapter","kind":"constant","sha256":"c79b530e75f682414c7df30fb3f09a4c12eef985e6f632712bf604f919c4388e"}]},{"path":"mcp/delegation/dispatch.ts","sha256":"aadee20ae15838bd5cf45ec670a232586eca1a74ff2f80d3d137bca804c3b6b7","size":27749,"symbols":[{"name":"record","kind":"constant","sha256":"358ba0c5b6d9bfd51109f2ed82f8365cc54e53c2d6cbd1bbd312888223b513e3"},{"name":"dispatchreviewer","kind":"function","sha256":"8f2fa8946e4012d0293dcedbd49419fe7107d28e5194db23479046a4568d62c2"},{"name":"adapter","kind":"constant","sha256":"1e6534678ef07ea12762faac642b5a3b85db4d844381f5d216508a57925e0312"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":217,"unresolved_symbols":["noEmit"]},"created_at":"2026-08-20T21:35:55.979Z","updated_at":"2026-08-20T21:37:36.790Z","author_branch":"kage/adapters-dispatch-supervisor-wiring-for-260820-41d2"}
```

