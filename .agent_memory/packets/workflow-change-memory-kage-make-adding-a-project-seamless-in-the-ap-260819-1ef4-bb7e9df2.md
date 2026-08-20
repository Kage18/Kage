---
type: "Workflow"
title: "Change memory: kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4"
description: "Repo-local context for 19 changed repo paths on kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4."
resource: "mcp/add-project.test.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4"]
timestamp: "2026-08-20T12:42:13.162Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/add-project.test.ts", "mcp/cli.ts", "mcp/delegation/add-project.ts", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-html.ts", "mcp/delegation/app-styles.ts", "mcp/delegation/config.ts", "mcp/delegation/room-pty.ts", "mcp/delegation/room-supervisor.ts", "mcp/orchestrator-session.test.ts"]
---

# Change memory: kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4

> Repo-local context for 19 changed repo paths on kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md
- .agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md
- .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md
- .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md
- .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md
- .agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md
- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/add-project.test.ts
- mcp/cli.ts
- mcp/delegation/add-project.ts
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/delegation/app-html.ts
- mcp/delegation/app-styles.ts
- mcp/delegation/config.ts
- mcp/delegation/room-pty.ts
- mcp/delegation/room-supervisor.ts
- mcp/orchestrator-session.test.ts

Diff summary:
```text
...tries-a-live-held-open-session-with-a02bd27d.md |  69 ----------
 ...ent-to-claude-when-the-caller-omitt-68fec206.md |  69 ----------
 ...s-registry-kage-projects-json-previ-4f2577bf.md |  69 ----------
 ...workflow-change-memory-release-prep-a72d4251.md |  21 ++-
 mcp/add-project.test.ts                            | 153 ---------------------
 mcp/cli.ts                                         |  57 +-------
 mcp/delegation/add-project.ts                      | 123 -----------------
 mcp/delegation/api.ts                              |  58 +-------
 mcp/delegation/app-client.ts                       | 129 +----------------
 mcp/delegation/app-html.ts                         |  34 -----
 mcp/delegation/app-styles.ts                       |   5 -
 mcp/delegation/config.ts                           |   7 -
 mcp/delegation/room-pty.ts                         |  83 ++++++++++-
 mcp/delegation/room-supervisor.ts                  |  27 ++--
 14 files changed, 118 insertions(+), 786 deletions(-)
.agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md | untracked
.agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md | untracked
.agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked
mcp/orchestrator-session.test.ts | untracked
```

How to verify:
- Add the exact test, build, or manual verification command when you refine this memory.

Improve this packet when more context is known:
- The actual feature, fix, or refactor rationale.
- Why the change was made, including relevant bugs, issues, decisions, and code explanations.
- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.
- Any gotchas, follow-up risks, or branch-specific assumptions.

Promote beyond this repo only after explicit org/global review.

## Why

Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.

## Trigger

Recall when asking what changed on this branch, preparing a PR review, or resuming this work.

## Action

Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.

## Verification

Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.

## Risk if forgotten

Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.

## Stale when

The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it.

# Citations

[1] git_diff

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4","title":"Change memory: kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4","summary":"Repo-local context for 19 changed repo paths on kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md\n- .agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md\n- .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md\n- .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md\n- .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md\n- .agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md\n- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/add-project.test.ts\n- mcp/cli.ts\n- mcp/delegation/add-project.ts\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-html.ts\n- mcp/delegation/app-styles.ts\n- mcp/delegation/config.ts\n- mcp/delegation/room-pty.ts\n- mcp/delegation/room-supervisor.ts\n- mcp/orchestrator-session.test.ts\n\nDiff summary:\n```text\n...tries-a-live-held-open-session-with-a02bd27d.md |  69 ----------\n ...ent-to-claude-when-the-caller-omitt-68fec206.md |  69 ----------\n ...s-registry-kage-projects-json-previ-4f2577bf.md |  69 ----------\n ...workflow-change-memory-release-prep-a72d4251.md |  21 ++-\n mcp/add-project.test.ts                            | 153 ---------------------\n mcp/cli.ts                                         |  57 +-------\n mcp/delegation/add-project.ts                      | 123 -----------------\n mcp/delegation/api.ts                              |  58 +-------\n mcp/delegation/app-client.ts                       | 129 +----------------\n mcp/delegation/app-html.ts                         |  34 -----\n mcp/delegation/app-styles.ts                       |   5 -\n mcp/delegation/config.ts                           |   7 -\n mcp/delegation/room-pty.ts                         |  83 ++++++++++-\n mcp/delegation/room-supervisor.ts                  |  27 ++--\n 14 files changed, 118 insertions(+), 786 deletions(-)\n.agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md | untracked\n.agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md | untracked\n.agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked\nmcp/orchestrator-session.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4"],"paths":["mcp/add-project.test.ts","mcp/cli.ts","mcp/delegation/add-project.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/orchestrator-session.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4","head":"25090460cba8924803001fa35aa878e5c9716ceb","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md",".agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md",".agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md",".agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md",".agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md",".agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md",".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/add-project.test.ts","mcp/cli.ts","mcp/delegation/add-project.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/orchestrator-session.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4.json"}],"context":{"fact":"Current branch kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4 changes 19 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:13.162Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/add-project.test.ts","sha256":"57e4dda57cad815faf7ba511052f3478de853b5c4de75acbb03094d34cb398cf","size":6415,"symbols":[{"name":"real","kind":"constant","sha256":"cf1885f4a0d0822181d76bbe5940812dbae59a9b2d58b1d414d9f8e8cdfd764f"},{"name":"html","kind":"constant","sha256":"c7acf0a3d841b44f4b389e3bce6f5fb94cf87dca3af1cb6dfe483aedf82796d0"}]},{"path":"mcp/cli.ts","sha256":"f49dea5e35b66b1309c62c71f90a8b0a6986061d7956f3417bcb330139cd14e3","size":150054,"symbols":[{"name":"files","kind":"constant","sha256":"8984fb1011c0e9e4a2f8140ee1b80011ee39c80fba2fb0d6012223d8cc01fbfb"},{"name":"review","kind":"function","sha256":"cd5b65cd476d7eaecccc181de3bcad5b3d7c99237dcbfce313709f8eb35f9a13"},{"name":"command","kind":"constant","sha256":"9e594169e1f8559f50d7e73b407f1aa3a9a0f14bf43a676fedefa72734badb98"},{"name":"packets","kind":"constant","sha256":"08565eddc844fbb13d207b1a5875e07b52807950760d7784cce666504b0eda13"},{"name":"json","kind":"constant","sha256":"9115381310c6d4c5ecb25a7e67e4fd0bb4b20a9b328adb25b606065454f79370"},{"name":"current","kind":"constant","sha256":"471f3cfbffa04d6ecddb2f3d4013027b71237de766afb69ec418f1f1b8308937"},{"name":"agent","kind":"constant","sha256":"5b9caa614311fe691d6af171b9a8985b0d49464b9df178ad28ff5b9883eb4cf2"},{"name":"known","kind":"constant","sha256":"437d0eb26101b2e1555d61ea245e3062bfdddc1f818e825cfd3beb6a375f05a8"},{"name":"from","kind":"constant","sha256":"b386d829bcacbd9e216c726f6dff71fc7d8a53aade383fa45b850387414b780c"},{"name":"summary","kind":"constant","sha256":"0938b0afc17695033381e2248401bba9b7c6abb6f9f0eaae0d2a8ff2c660d662"},{"name":"durable","kind":"constant","sha256":"59e1af86ee722f58562da0478f6f3fe6621ae96f9473de8c0037e63fe779215e"},{"name":"held","kind":"constant","sha256":"e0764f9b2a4379f1e3c5bce914e34ce42d80be667f8e6b2f138da943927a00c8"},{"name":"runs","kind":"constant","sha256":"f7d055af62b25c4cb13983f9c81fa5b35c09b64c06279e258694f6f7b180485a"},{"name":"test","kind":"constant","sha256":"c67f3770bf3c3e9b9aff73d99406c7664a900a970c68cfe75a1efefbd4447185"}]},{"path":"mcp/delegation/add-project.ts","sha256":"de6d85433e49ad40fd36b7dfc245e91a2f096938b06ad2a782fef85e79a739b4","size":5520,"symbols":[{"name":"projects","kind":"constant","sha256":"6012534be7e1075a87aaf63eaff037a8176eb4d76439cccbc7fba31961df7e62"}]},{"path":"mcp/delegation/api.ts","sha256":"30af4be6d286f7c204e38ee72a79599e7a65a2349516e9bac8245d3f420f97d5","size":78606,"symbols":[{"name":"json","kind":"function","sha256":"9534facbff0d20476918887174c4edf739d502278aa0750b5fa1da683358d3e7"},{"name":"text","kind":"constant","sha256":"c821f21e865b5862788006905c0f4fd09dd7ef6d223fcf2c505033203d6555aa"},{"name":"tools","kind":"constant","sha256":"ad3db571cc256d20ebce1318f16c1969de24636b748f30cf6f155393c05ee301"},{"name":"resolveroomreply","kind":"function","sha256":"66e8e33489795fe0ec6df881a45444980cf6b72d9e0ad5e22fa92e98ac89bb07"},{"name":"live","kind":"constant","sha256":"0464c1ad8cea9bdb94dd256ae9d9a420b46fb319b929e97bcad03d302ee53478"},{"name":"room","kind":"constant","sha256":"a9a23abe365a041f26787a2ec73b24fda2145c66a24433d13a5a8f56c3aae380"},{"name":"files","kind":"constant","sha256":"10f5a322e356009fe3570a8b1fc93b0e50f550074efda18f91eb7ba5b0cd7445"},{"name":"change","kind":"constant","sha256":"b3e774e47224ceab04308a4b2408fdc25f84082e73ac544f4f45949d63ca929f"},{"name":"runs","kind":"constant","sha256":"aeed515a96dc123ddceac928842184b148f9bbd85f63bccbb0918926221c95e2"},{"name":"packet","kind":"constant","sha256":"e71a4806ab105f9413aed2fb80d62995b29b2c809b72ebecbfeb144a235fbfa9"},{"name":"projects","kind":"constant","sha256":"b8b6499be250d742f66205e701e060745cf4aad88a56d7e9a5f68e65e94196d3"},{"name":"config","kind":"constant","sha256":"f8e54559c158b033c0d895af0970af92f19e06c8b8c38c81345f3f6c953bd08e"},{"name":"session","kind":"constant","sha256":"469d8b6ff94888de462ef809debd9cc097e66bc3c70ee39f0e666afe4ece1530"},{"name":"agent","kind":"constant","sha256":"73eaaefa603f1faada136a1ce30a9c4bb4443c8e5a7f71bfcd673cf695bda208"},{"name":"current","kind":"constant","sha256":"9c4cd387881f26f6987d035a16dca7885b8f9aaedb8ca13696be65c344bf840a"}]},{"path":"mcp/delegation/app-client.ts","sha256":"ded26e7b2ea02db2b4eade9056358d995b0517b8f9cf1181245a867beb33bafb","size":206711},{"path":"mcp/delegation/app-html.ts","sha256":"ce8d9a5a3bc47b68e8aef4dd6277c2b22a08bdbb6a50e0e583d0024a2e9728e7","size":14159},{"path":"mcp/delegation/app-styles.ts","sha256":"c8d1bb16e765a5659d5a425df9d3e21f50cc10456d0095463a03618f21efbb77","size":76146},{"path":"mcp/delegation/config.ts","sha256":"bcf16139575549cce06a09bba484cfe9f6efb2354a35a9c4704119af48d228f3","size":7960},{"path":"mcp/delegation/room-pty.ts","sha256":"7d65bb5da050fca50174486611d85126b4d829cbf44f887550c5ffa43b38125a","size":23499},{"path":"mcp/delegation/room-supervisor.ts","sha256":"78d92419a70d835de3a0df55acbd64adc15521ec16783f1005b4eb01d9b90fc2","size":37422,"symbols":[{"name":"config","kind":"constant","sha256":"fe47c35225c3b6e27ef07be8d775377be3f137208fb516c6b8f47e17e7bc4779"},{"name":"text","kind":"constant","sha256":"e7af38875702f0a852c1863de4847b605fb01a9a18fe5d29eb15d055eef1abfd"},{"name":"runs","kind":"constant","sha256":"b3d76c26b0084e0f4d3ccb5e51c8cca0860499dcbbbc5a38796cad53753a4401"}]},{"path":"mcp/orchestrator-session.test.ts","sha256":"a74914ea8c9d291d6dc57daab01f287583b0681a1a47667cd63f0bce3a8f7d2e","size":6912,"symbols":[{"name":"allowed","kind":"constant","sha256":"c5d700ec20b0e46e39f06e293388be2f3cb02b3f5533b0075be6e2374bd21ef3"},{"name":"branch","kind":"constant","sha256":"feba94d5ef126e10116add46d5d10108f8d01ec43c16ebea747f100610c6007a"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/add-project.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/add-project.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-html.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-styles.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/config.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-pty.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-supervisor.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/orchestrator-session.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md, .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md, .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md, mcp/add-project.test.ts"],"duplicate_candidates":[],"estimated_tokens_saved":895,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:13.162Z"},"created_at":"2026-08-19T11:13:13.214Z","updated_at":"2026-08-20T12:42:13.162Z"}
```

