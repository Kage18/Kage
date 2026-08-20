---
type: "Decision"
title: "manager-orchestration.test.ts's settleRun/tempProject/inRoom helpers are the right mode..."
description: "manager orchestration.test.ts's settleRun/tempProject/inRoom helpers are the right model for any new test file exercising callTool against a fabricated run lifecycle — createRun requires an agent field CreateRunInput , a"
resource: "mcp/delegation/manager-client.ts"
tags: ["delegated-run", "kage-run:mcp-tool-surface-manager-prompt-for-the-260820-31ce"]
timestamp: "2026-08-20T20:37:37.247Z"
x-kage-id: "repo:mcp-tool-surface-manager-prompt-for-the-260820-31ce:decision:manager-orchestration-test-tss-settlerun-tempproject-inroom-helpers-are-the-righ"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/manager-client.ts", "mcp/delegation/manager-prompt.ts", "mcp/delegation/manager.ts", "mcp/delegation/room-supervisor.ts", "mcp/index.ts", "mcp/mcp-tool-surface-manager.test.ts"]
---

# manager-orchestration.test.ts's settleRun/tempProject/inRoom helpers are the right mode...

> manager orchestration.test.ts's settleRun/tempProject/inRoom helpers are the right model for any new test file exerci…

manager-orchestration.test.ts's settleRun/tempProject/inRoom helpers are the right model for any new test file exercising callTool() against a fabricated run lifecycle — createRun requires an `agent` field (CreateRunInput), and transitionRun must walk the legal chain (briefed→dispatched→running→verifying→ready) rather than writing task.json by hand.

Learned while delivering: MCP tool surface + manager prompt for the reviewer role: new kage_review_run tool, manager constitution update describing the review gate, MANAGER_ALLOWED_TOOLS addition, room-supervisor wake-event extension for the new states.
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-20T20:37:37.247Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:mcp-tool-surface-manager-prompt-for-the-260820-31ce:decision:manager-orchestration-test-tss-settlerun-tempproject-inroom-helpers-are-the-righ","title":"manager-orchestration.test.ts's settleRun/tempProject/inRoom helpers are the right mode...","summary":"manager orchestration.test.ts's settleRun/tempProject/inRoom helpers are the right model for any new test file exercising callTool against a fabricated run lifecycle — createRun requires an agent field CreateRunInput , a","body":"manager-orchestration.test.ts's settleRun/tempProject/inRoom helpers are the right model for any new test file exercising callTool() against a fabricated run lifecycle — createRun requires an `agent` field (CreateRunInput), and transitionRun must walk the legal chain (briefed→dispatched→running→verifying→ready) rather than writing task.json by hand.\n\nLearned while delivering: MCP tool surface + manager prompt for the reviewer role: new kage_review_run tool, manager constitution update describing the review gate, MANAGER_ALLOWED_TOOLS addition, room-supervisor wake-event extension for the new states.\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:mcp-tool-surface-manager-prompt-for-the-260820-31ce"],"paths":["mcp/delegation/manager-client.ts","mcp/delegation/manager-prompt.ts","mcp/delegation/manager.ts","mcp/delegation/room-supervisor.ts","mcp/index.ts","mcp/mcp-tool-surface-manager.test.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-20T20:37:37.247Z"}],"context":{"fact":"manager-orchestration.test.ts's settleRun/tempProject/inRoom helpers are the right model for any new test file exercising callTool() against a fabricated run lifecycle — createRun requires an `agent` field (CreateRunInput), and transitionRun must walk the legal chain (briefed→dispatched→running→verifying→ready) rather than writing task.json by hand.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-20T20:37:37.247Z","path_fingerprints":[{"path":"mcp/delegation/manager-client.ts","sha256":"3f6e39804b5fb50b5fc5f19487f436ef00ed197ebf6db3d84ed61132e35a7681","size":15306,"symbols":[{"name":"manager_allowed_tools","kind":"constant","sha256":"473efa458edfb11979a45606f766414168137942b3c39f5be0d47f6389d19fe4"}]},{"path":"mcp/delegation/manager-prompt.ts","sha256":"31bc3a98467ce4a97015e4494afca85767a6bb5bcca9b7001d34fca162e3609e","size":9914},{"path":"mcp/delegation/manager.ts","sha256":"772f5ea284ae5c850bd1d8f8fe42d65c1d2e645636211ac1e281f760f4d59482","size":8811},{"path":"mcp/delegation/room-supervisor.ts","sha256":"6b94fe968a0c90c25ac5e19c437121ddb6b1dedd81a3152bb66f1e1f6ecf6f6b","size":39476,"symbols":[{"name":"states","kind":"constant","sha256":"55e019cc82ed4a5a01e4b66776dfdae7d7f7d23339c0f314810d247fdc184c3d"}]},{"path":"mcp/index.ts","sha256":"5d83c47b14ac1474a1e545536cf1a3035780d39d5b3273cf5fcc03dead92307b","size":112109,"symbols":[{"name":"agent","kind":"constant","sha256":"f43965840101ba03f34df722db6ad9cd1ca443fc381b27433cff4ad00194473f"},{"name":"task","kind":"constant","sha256":"ec4fcc5a0ea5e8abfd8fe4ecd1e94211299bad60dad6b084d9bfa95f651ae3e5"},{"name":"review","kind":"constant","sha256":"77f09fa7051dee0157a23ad91eabc7c7622cb043ef103c8ff2e1ca64618f8ca0"},{"name":"calltool","kind":"function","sha256":"9c4a65a8c3fa44a58303b6f0ffed2f1f734dabcb9dac5a4c0a4afb2ec87cdcb8"},{"name":"mode","kind":"constant","sha256":"18b82a4b81ca7c830c569f40cf5c828b5455eeeb0a3bec4059c2890192dbdd94"},{"name":"event","kind":"constant","sha256":"39b93629feeb4077605f2bb4417f7bd7098e3957819c689e0da5ec3b45c71bea"}]},{"path":"mcp/mcp-tool-surface-manager.test.ts","sha256":"5dbcd54812f2d3258f3248d36569e70d7b790878ea84d45eb33864736f069c0f","size":11051,"symbols":[{"name":"tempproject","kind":"function","sha256":"a154b78524c1f931fb1140534aebb58136e522a808769e184b2146ed41168548"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":179,"unresolved_symbols":["inRoom","CreateRunInput","noEmit"]},"created_at":"2026-08-20T20:37:37.247Z","updated_at":"2026-08-20T20:40:22.931Z","author_branch":"kage/mcp-tool-surface-manager-prompt-for-the-260820-31ce"}
```

