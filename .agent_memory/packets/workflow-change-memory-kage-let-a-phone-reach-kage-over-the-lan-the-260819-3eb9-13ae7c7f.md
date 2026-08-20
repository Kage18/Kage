---
type: "Workflow"
title: "Change memory: kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9"
description: "Repo-local context for 20 changed repo paths on kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9."
resource: "mcp/add-project.test.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9"]
timestamp: "2026-08-20T12:42:12.708Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/add-project.test.ts", "mcp/cli.ts", "mcp/daemon.ts", "mcp/delegation/add-project.ts", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-html.ts", "mcp/delegation/app-styles.ts", "mcp/delegation/config.ts", "mcp/delegation/guard.ts", "mcp/lan-mode.test.ts"]
---

# Change memory: kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9

> Repo-local context for 20 changed repo paths on kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md
- .agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md
- .agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md
- .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md
- .agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md
- .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md
- .agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md
- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/add-project.test.ts
- mcp/cli.ts
- mcp/daemon.ts
- mcp/delegation/add-project.ts
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/delegation/app-html.ts
- mcp/delegation/app-styles.ts
- mcp/delegation/config.ts
- mcp/delegation/guard.ts
- mcp/lan-mode.test.ts

Diff summary:
```text
...ain-interface-not-touched-by-any-of-3867ab63.md |  92 --------
 ...erwrites-an-explicit-host-header-it-b5647f5c.md |  92 --------
 ...ates-every-daemon-start-by-design-a-6027a2b8.md |  92 --------
 ...workflow-change-memory-release-prep-a72d4251.md |  20 +-
 mcp/cli.ts                                         |  57 ++++-
 mcp/daemon.ts                                      |  86 +------
 mcp/delegation/api.ts                              |  58 ++++-
 mcp/delegation/app-client.ts                       | 129 ++++++++++-
 mcp/delegation/app-html.ts                         |  34 +++
 mcp/delegation/app-styles.ts                       |   5 +
 mcp/delegation/config.ts                           |  13 +-
 mcp/delegation/guard.ts                            |  61 +----
 mcp/lan-mode.test.ts                               | 247 ---------------------
 13 files changed, 301 insertions(+), 685 deletions(-)
.agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md | untracked
.agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md | untracked
.agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked
mcp/add-project.test.ts | untracked
mcp/delegation/add-project.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9","title":"Change memory: kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9","summary":"Repo-local context for 20 changed repo paths on kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md\n- .agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md\n- .agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md\n- .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md\n- .agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md\n- .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md\n- .agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md\n- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/add-project.test.ts\n- mcp/cli.ts\n- mcp/daemon.ts\n- mcp/delegation/add-project.ts\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-html.ts\n- mcp/delegation/app-styles.ts\n- mcp/delegation/config.ts\n- mcp/delegation/guard.ts\n- mcp/lan-mode.test.ts\n\nDiff summary:\n```text\n...ain-interface-not-touched-by-any-of-3867ab63.md |  92 --------\n ...erwrites-an-explicit-host-header-it-b5647f5c.md |  92 --------\n ...ates-every-daemon-start-by-design-a-6027a2b8.md |  92 --------\n ...workflow-change-memory-release-prep-a72d4251.md |  20 +-\n mcp/cli.ts                                         |  57 ++++-\n mcp/daemon.ts                                      |  86 +------\n mcp/delegation/api.ts                              |  58 ++++-\n mcp/delegation/app-client.ts                       | 129 ++++++++++-\n mcp/delegation/app-html.ts                         |  34 +++\n mcp/delegation/app-styles.ts                       |   5 +\n mcp/delegation/config.ts                           |  13 +-\n mcp/delegation/guard.ts                            |  61 +----\n mcp/lan-mode.test.ts                               | 247 ---------------------\n 13 files changed, 301 insertions(+), 685 deletions(-)\n.agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md | untracked\n.agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md | untracked\n.agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked\nmcp/add-project.test.ts | untracked\nmcp/delegation/add-project.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9"],"paths":["mcp/add-project.test.ts","mcp/cli.ts","mcp/daemon.ts","mcp/delegation/add-project.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/guard.ts","mcp/lan-mode.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9","head":"933008dac7a35d364b53fa0c1e4cb5ebb3b0187f","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md",".agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md",".agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md",".agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md",".agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md",".agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md",".agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md",".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/add-project.test.ts","mcp/cli.ts","mcp/daemon.ts","mcp/delegation/add-project.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/guard.ts","mcp/lan-mode.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9.json"}],"context":{"fact":"Current branch kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9 changes 20 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:12.708Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/add-project.test.ts","sha256":"57e4dda57cad815faf7ba511052f3478de853b5c4de75acbb03094d34cb398cf","size":6415,"symbols":[{"name":"plain","kind":"constant","sha256":"00249717ff96dab370ac7005ebad33a6a22bb58d8388f2e4c0860077e76f82b1"},{"name":"real","kind":"constant","sha256":"cf1885f4a0d0822181d76bbe5940812dbae59a9b2d58b1d414d9f8e8cdfd764f"},{"name":"html","kind":"constant","sha256":"c7acf0a3d841b44f4b389e3bce6f5fb94cf87dca3af1cb6dfe483aedf82796d0"}]},{"path":"mcp/cli.ts","sha256":"f49dea5e35b66b1309c62c71f90a8b0a6986061d7956f3417bcb330139cd14e3","size":150054,"symbols":[{"name":"files","kind":"constant","sha256":"8984fb1011c0e9e4a2f8140ee1b80011ee39c80fba2fb0d6012223d8cc01fbfb"},{"name":"review","kind":"function","sha256":"cd5b65cd476d7eaecccc181de3bcad5b3d7c99237dcbfce313709f8eb35f9a13"},{"name":"command","kind":"constant","sha256":"9e594169e1f8559f50d7e73b407f1aa3a9a0f14bf43a676fedefa72734badb98"},{"name":"packets","kind":"constant","sha256":"08565eddc844fbb13d207b1a5875e07b52807950760d7784cce666504b0eda13"},{"name":"json","kind":"constant","sha256":"9115381310c6d4c5ecb25a7e67e4fd0bb4b20a9b328adb25b606065454f79370"},{"name":"current","kind":"constant","sha256":"471f3cfbffa04d6ecddb2f3d4013027b71237de766afb69ec418f1f1b8308937"},{"name":"agent","kind":"constant","sha256":"5b9caa614311fe691d6af171b9a8985b0d49464b9df178ad28ff5b9883eb4cf2"},{"name":"known","kind":"constant","sha256":"437d0eb26101b2e1555d61ea245e3062bfdddc1f818e825cfd3beb6a375f05a8"},{"name":"from","kind":"constant","sha256":"b386d829bcacbd9e216c726f6dff71fc7d8a53aade383fa45b850387414b780c"},{"name":"summary","kind":"constant","sha256":"0938b0afc17695033381e2248401bba9b7c6abb6f9f0eaae0d2a8ff2c660d662"},{"name":"durable","kind":"constant","sha256":"59e1af86ee722f58562da0478f6f3fe6621ae96f9473de8c0037e63fe779215e"},{"name":"held","kind":"constant","sha256":"e0764f9b2a4379f1e3c5bce914e34ce42d80be667f8e6b2f138da943927a00c8"},{"name":"runs","kind":"constant","sha256":"f7d055af62b25c4cb13983f9c81fa5b35c09b64c06279e258694f6f7b180485a"},{"name":"test","kind":"constant","sha256":"c67f3770bf3c3e9b9aff73d99406c7664a900a970c68cfe75a1efefbd4447185"}]},{"path":"mcp/daemon.ts","sha256":"5fbd1abcbbbafeffebfcf4208d562b846f0f309d2d64861531459b485c14e93e","size":53327,"symbols":[{"name":"provisiondaemontoken","kind":"function","sha256":"8ea28155f7565655bd2eab97eff3ee4f29c46df7b2eea08fc716a4c679a64f43"},{"name":"json","kind":"function","sha256":"c6cfd13a6f9203c85fedf4efd643fcb209309a376a34ce77909c444a05e9b0e5"},{"name":"text","kind":"constant","sha256":"70f68baaeedf940b18569f940046a8a0a978afd00077c6b27618336a05fa1cc1"},{"name":"guardcontext","kind":"constant","sha256":"66a00c2f94cfa8ea1f7c41ab97575d70857303827da5ecb547b8b9206b76e1b8"},{"name":"html","kind":"constant","sha256":"6159e141ec24a3e7bf05b2bbfb590be78f44601085676f2f110a8ca810e022a0"},{"name":"files","kind":"constant","sha256":"69140299050f3544f2a8f5cdcfa3672dd7f2a78cf8960d3197b23624253b5b9e"}]},{"path":"mcp/delegation/add-project.ts","sha256":"de6d85433e49ad40fd36b7dfc245e91a2f096938b06ad2a782fef85e79a739b4","size":5520,"symbols":[{"name":"projects","kind":"constant","sha256":"6012534be7e1075a87aaf63eaff037a8176eb4d76439cccbc7fba31961df7e62"}]},{"path":"mcp/delegation/api.ts","sha256":"30af4be6d286f7c204e38ee72a79599e7a65a2349516e9bac8245d3f420f97d5","size":78606,"symbols":[{"name":"json","kind":"function","sha256":"9534facbff0d20476918887174c4edf739d502278aa0750b5fa1da683358d3e7"},{"name":"text","kind":"constant","sha256":"c821f21e865b5862788006905c0f4fd09dd7ef6d223fcf2c505033203d6555aa"},{"name":"resolveroomreply","kind":"function","sha256":"66e8e33489795fe0ec6df881a45444980cf6b72d9e0ad5e22fa92e98ac89bb07"},{"name":"live","kind":"constant","sha256":"0464c1ad8cea9bdb94dd256ae9d9a420b46fb319b929e97bcad03d302ee53478"},{"name":"files","kind":"constant","sha256":"10f5a322e356009fe3570a8b1fc93b0e50f550074efda18f91eb7ba5b0cd7445"},{"name":"change","kind":"constant","sha256":"b3e774e47224ceab04308a4b2408fdc25f84082e73ac544f4f45949d63ca929f"},{"name":"runs","kind":"constant","sha256":"aeed515a96dc123ddceac928842184b148f9bbd85f63bccbb0918926221c95e2"},{"name":"packet","kind":"constant","sha256":"e71a4806ab105f9413aed2fb80d62995b29b2c809b72ebecbfeb144a235fbfa9"},{"name":"projects","kind":"constant","sha256":"b8b6499be250d742f66205e701e060745cf4aad88a56d7e9a5f68e65e94196d3"},{"name":"config","kind":"constant","sha256":"f8e54559c158b033c0d895af0970af92f19e06c8b8c38c81345f3f6c953bd08e"},{"name":"session","kind":"constant","sha256":"469d8b6ff94888de462ef809debd9cc097e66bc3c70ee39f0e666afe4ece1530"},{"name":"agent","kind":"constant","sha256":"73eaaefa603f1faada136a1ce30a9c4bb4443c8e5a7f71bfcd673cf695bda208"},{"name":"current","kind":"constant","sha256":"9c4cd387881f26f6987d035a16dca7885b8f9aaedb8ca13696be65c344bf840a"}]},{"path":"mcp/delegation/app-client.ts","sha256":"ded26e7b2ea02db2b4eade9056358d995b0517b8f9cf1181245a867beb33bafb","size":206711},{"path":"mcp/delegation/app-html.ts","sha256":"ce8d9a5a3bc47b68e8aef4dd6277c2b22a08bdbb6a50e0e583d0024a2e9728e7","size":14159},{"path":"mcp/delegation/app-styles.ts","sha256":"c8d1bb16e765a5659d5a425df9d3e21f50cc10456d0095463a03618f21efbb77","size":76146},{"path":"mcp/delegation/config.ts","sha256":"bcf16139575549cce06a09bba484cfe9f6efb2354a35a9c4704119af48d228f3","size":7960},{"path":"mcp/delegation/guard.ts","sha256":"b17c3d5f01a7d18ab572330513ea4f8fd6e045b0bd8c56692ff4ea15ff3c77c9","size":6508,"symbols":[{"name":"header","kind":"function","sha256":"88ca5a0106498faa62ce704bcc748a38b533625927d0038b16fc9eba0fd56ad6"},{"name":"diff","kind":"constant","sha256":"34c277ef1037319a460efd15f3973919172d686205737ac749d57aa35534cc39"}]},{"path":"mcp/lan-mode.test.ts","sha256":"31270c0f999a2371d01aaa07f20adf23e709321175c7f7ce4157c0b9d5adc6ac","size":10785,"symbols":[{"name":"token","kind":"constant","sha256":"a3060172aa71649318652d03b47cf1a9f87eda4a2472100487b385953afd501c"},{"name":"context","kind":"constant","sha256":"5cafc5d2eed26e4e144adc252d2da755933ee4f845cb57b6c783c1b489f8c838"},{"name":"project","kind":"constant","sha256":"34dcdcd36c1ff04b81cebaba9eb4f33040f66ffc7319661154468aa3c8b5fdfd"},{"name":"mode","kind":"constant","sha256":"5f6b2b7ab81dec7c7f6ad2f4511f0775c4e370403fcb056085412f8840b1eb6a"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/add-project.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/daemon.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/add-project.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-html.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-styles.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/config.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/guard.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/lan-mode.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md, .agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md, .agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md, mcp/lan-mode.test.ts"],"duplicate_candidates":[],"estimated_tokens_saved":930,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:12.708Z"},"created_at":"2026-08-19T11:26:30.890Z","updated_at":"2026-08-20T12:42:12.708Z"}
```

