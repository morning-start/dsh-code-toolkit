# Changelog

## 0.26.1 — 2026-11-25

- `/code-review` has its own input hint: it names the default scope (uncommitted,
  or the branch when clean), `--branch`, and that it fixes by default while
  `report` keeps the report-only behaviour. The shared scope hint no longer
  describes it.

## 0.26.0 — 2026-11-25

- `/code-review` now fixes what it finds. The default run reports and then fixes
  the findings it can prove, re-running the gate after each fix and reverting any
  fix that turns it red; `report` keeps the old report-only behaviour.
- The review persona gained a Mode section and a `fixed` array in its output
  schema (title, file, change, verified_by), rendered as a "Fixed" section after
  the findings.
- 85 deterministic checks.

## 0.25.0 — 2026-11-25

- `--branch <ref>` picks which branch to compare against; the default is still
  the base branch (`origin/HEAD` → `origin/main` → `main` → `master`, first one
  that is not HEAD). `--base` stays as a synonym.
- An explicit `--branch` is honoured even when the working tree is dirty — the
  person asked for that comparison, not for the working tree. The default scope
  still follows the tree.
- 84 deterministic checks.

## 0.24.0 — 2026-11-25

- `/code-review` with no arguments now follows what the person is working on: a
  dirty tree reviews **the uncommitted work**, a clean tree reviews **what the
  branch adds on top of its base**, and a branch with no base reviews the last 5
  commits. Reviewing the committed work while uncommitted edits sat unreviewed
  was the wrong default.
- The receipt names the scope it landed on (`working tree vs HEAD`,
  `HEAD vs main`, `last 5 commits`, `whole project`), so the two cases are
  distinguishable without opening the report.
- 83 deterministic checks.

## 0.23.0 — 2026-11-25

- The receipt now says what actually happened instead of one generic line. Four
  cases: handed to this session, handed to an isolated agent, a plan first (no
  files change), or a plan first from an isolated agent. "已提交" told the person
  nothing about where the task went or whether files would change.
- Menu descriptions match the defaults again: simplify and scrub say they write,
  review says it is read-only.
- 82 deterministic checks.

## 0.22.0 — 2026-11-25

- Every command now delivers the same way. `/code-caption` and `/pua` used to
  steer with `source: { kind: 'user' }`, so the host rendered the whole protocol
  as a green user bubble; they now use the plugin's own source kind, like the
  task commands, and the UI folds them into one request card.
- Simplification pass over the plugin's own source: the two delivery paths share
  one scope resolution, the duplicated minute-to-ms converters are one function,
  `branch` and `base` scope instructions are one branch, and the message builders
  share one wrapper. Net −51 lines, no behaviour change.
- 81 deterministic checks.

## 0.21.0 — 2026-11-25

- `/code-simplify` and `/code-scrub` now execute the plan the person approved:
  an apply run picks up the last finished `report` for the same command and scope
  and carries it into the task, instead of re-deriving a second plan that may
  disagree with the first. The task tells the agent to stop and report if the
  plan is wrong or stale rather than substituting its own.
- The plan expires after `planMaxAgeMinutes` (default 60, `0` disables) — a plan
  older than the tree it describes is worse than no plan.
- Verified in an isolated `dsh web` instance: `/code-scrub report` on a clean
  repository reported no findings with masked patterns, `/code-simplify report`
  and apply both refused to invent work, and `/pua huawei` steered the protocol.
- 81 deterministic checks.

## 0.20.0 — 2026-11-25

- Caption now opens with a choice of two flows: **changing code** (requirement →
  investigate → propose → human approves → execute → test → human confirms →
  update the docs) and **changing documentation** (requirement → investigate →
  propose → human approves → execute → summarize). `references/flows.md` gives
  each step's product and its exit condition, the rules that keep it honest, and
  how to choose when a change touches both.
- The approval gate is stated as a hard stop in the protocol: a plan nobody read
  is not an approval. The flow is recorded in the ledger head.
- 79 deterministic checks.

## 0.19.0 — 2026-11-25

- Caption now teaches how to write an expert into a dispatch brief:
  `references/experts.md` gives the five parts (identity and bar, inputs, what
  counts as a finding, what does not, output shape), the rules that make one
  usable, and a weak/strong pair on the same slice. The protocol and the dispatch
  reference both point at it.
- No new mechanism: an expert is still a paragraph in the brief. The plugin does
  not store, name or reuse experts — that would make a light command heavy.
- 78 deterministic checks.

## 0.18.0 — 2026-11-25

- A `sub` run that hangs — typically an approval nobody answers — no longer blocks
  the session forever: past `runTimeoutMinutes` (default 30, `0` disables) the
  slot is released and the next command may start.
- Verified in an isolated `dsh web` instance: the caption loop drove a real agent
  (read the ledger first, wrote it, proved its guard red then green, committed),
  and `/code-review sub` produced a report the shell delivered back into the
  session.
- 77 deterministic checks.

## 0.17.0 — 2026-11-25

- `/code-caption` no longer re-injects its 5 KB protocol on a second run in the
  same session: the shell records an `installed` journal entry, and the repeat
  carries only the task, the ledger path and a pointer to the protocol already in
  the conversation.
- The caption ledger directory is configurable (`ledgerDirectory`; relative paths
  resolve against the project) and the receipt names the real path. An empty
  value fails at load.
- Caption's dispatch section now names the two mechanisms the plugin actually
  offers — `subagent` / `subagent_fork` and the plugin's own `… sub` — and forbids
  mixing them on one slice; the reference explains that `sub` runs are
  single-flight while `subagent` dispatches are not.
- 76 deterministic checks.

## 0.16.0 — 2026-11-24

- The review default no longer produces an empty scope. "Current branch" now
  ignores a base ref that already equals HEAD; when the branch has no distinct
  base (work happens on main), the scope falls back to the **last 5 commits**
  instead of a diff of nothing.
- Empty scopes are caught before a run: a clean working tree with no base returns
  "nothing to review" with the flags that would fix it, instead of spending a
  turn.
- The in-session path now tells the agent to read `AGENT.md` first and, for
  structured commands, to write the human Markdown report instead of the JSON
  envelope (only the isolated path returns JSON, which the shell renders).
- 73 deterministic checks.

## 0.15.0 — 2026-11-24

- Every command now runs on empty input with a sensible default:
  `/code-review` reviews the current branch against its base (auto-detected
  `origin/HEAD` / `main` / `master`), `/code-simplify` and `/code-scrub` work on
  the whole project and write, `/code-caption` continues the task already in the
  conversation, `/pua` uses the default flavor.
- Commands can declare their own default scope (`defaultScope`), so review's
  "current branch" and simplify's "whole project" coexist in the same shell.
- 71 deterministic checks.

## 0.14.0 — 2026-11-24

- Every command now has a default that needs no input: scope is the **whole
  project on the current branch**, the executor is the current session, and the
  mode is **write** (add `report` for a plan, `sub` for an isolated agent). The
  scope picker is gone — `--files` / `--base` / `--commit` / custom text still
  narrow it.
- `/code-review` stays read-only by nature; `report` is a no-op there.
- 71 deterministic checks.

## 0.13.0 — 2026-11-24

- No more apply/report question. `/code-simplify` and `/code-scrub` now **write by
  default**; add the word `report` to get a plan instead (`/code-simplify report`,
  `/code-simplify sub report --base main`). `sub` and `report` are positional
  words, so they compose.
- The question helper, its i18n copy and its test are gone; the flag parser
  (`splitFlags`) covers both modifiers and is tested.
- 70 deterministic checks.

## 0.12.0 — 2026-11-24

- Extracted the session-interaction ability into one `SessionCommand` class
  (`src/command.js`). Every command — review, simplify, scrub, caption, pua,
  status, cancel — is now a declaration registered through it: `kind` is `task`
  (scope + inline or isolated delivery), `inject` (text into the session), or
  `local` (journal/status). Immediate settlement, scope selection, the apply
  question, failure delivery and journal states live in one place instead of
  once per handler.
- A test asserts `index.js` no longer registers commands directly, so the shell
  stays the only entry.
- 71 deterministic checks.

## 0.11.0 — 2026-11-24

- `/code-review`, `/code-simplify` and `/code-scrub` now run **in the current
  session** by default: the command resolves the scope, then queues the task as a
  user message and the agent works visibly. Add `sub` to hand the task to the
  isolated agent instead (`/code-review sub`, `/code-simplify sub --base main`).
- The in-session path writes a `submitted` journal entry; `/code-status` reports
  it, and a failed run is still delivered as a message.
- 70 deterministic checks.

## 0.10.0 — 2026-11-24

- Added `/pua [flavor]`: installs the PUA protocol into the current session — three
  red lines (evidence before "done", verify before blaming, exhaust the five steps
  before "I can't"), L0–L4 escalation, the five-step method, and the iceberg rule.
  `/pua list` lists the eight flavors; a flavor changes the tone, not the rules.
- The protocol lives in `agents/pua/` (AGENT.md, flavors, methodology, example).
- Case `10-pua-recovery`: a stale port in `.env.test` whose error looks like "the
  service is down"; the run has to change method and paste evidence instead of
  blaming the environment.
- 69 deterministic checks. The case is defined but has not been run against a model.

## 0.9.0 — 2026-11-24

- The three spawn commands settle immediately: the handler returns a receipt and
  the composer clears at once, instead of staying read-only for the whole run.
  The report is delivered afterwards as a queued user message (`agent.followup`)
  that tells the model to relay it verbatim — the shape `dsh-code-review` and
  `dsh-simplify` use.
- A failed run is delivered too, so a cleared box is never a silent box.
- `/code-status` and `/code-cancel` still work; the journal is unchanged.
- The message is built locally in `src/delivery.js` (mirroring
  `createUserMessage`) because a `link:`-installed plugin cannot resolve host
  packages from its real path.
- 62 deterministic checks.

## 0.8.1 — 2026-11-24

- Fixed `cannot get property "userQuestions" without inject`: the prompt helper
  read `ctx.userQuestions` directly, which Cordis rejects unless the service is
  declared in `inject`. The service is optional (headless hosts have no UI), so
  every access now goes through `ctx.get`.
- The eval harness now awaits the async tests it had been firing unawaited, so a
  late failure can no longer print "0 failed" and then exit 1. 61 checks, not 58.

## 0.8.0 — 2026-11-24

- Reverted the detached execution from 0.5.1. Without `input`, picking a command
  from the `/` menu executed it immediately and Tab acted like Enter, so there
  was no way to insert the token and keep typing. That is worse than the freeze
  it fixed.
- The three spawn commands declare `input` again, so `--files` / `--base` /
  `--commit` / `--apply` work again. The "report only or rewrite" question stays
  for runs that do not pass `--apply`.
- The known cost is documented rather than hidden: after Enter the composer
  stays read-only until the handler settles, which for a review is the whole
  run. The host ties insert-on-pick and execute-on-pick to the same flag; having
  both needs a client-side contribution.
- 57 deterministic checks; the guard now asserts that every command declares
  `input`.

## 0.7.0 — 2026-11-24

- `/code-simplify` learned from two real runs. The first (95 files, no test
  suite) produced 17 items that were mostly unused imports, pushed the
  interesting duplications into a flat "not handled" list, and claimed a full
  read of files it had only searched. The second run failed on anchors and on a
  file it could not write.
- The plan now ranks by value, groups mechanical items, and reports coverage as
  `read in full` / `searched only`.
- No gate, no apply: the project's tests, or a characterization baseline when
  there are none (compile + import smoke + real entry points with hashed output +
  a pinned input/output table). If no baseline can be built, the run returns the
  plan and names what is missing.
- Apply works in batches, re-runs the gate after each, confirms the anchor is
  unique, reads the edit back, and reports a failed write instead of retrying it.
- "Not handled" is classified: defect / behaviour-risk / too-big / intentional.
- 57 deterministic checks. The change is a protocol edit and has not been scored
  against the eval cases again.

## 0.6.0 — 2026-11-24

- `/code-caption` can dispatch subagents, under a two-lane rule: analysis is
  read-only and may fan out; build writes and needs exclusive paths, with shared
  files (barrels, indexes, configs, lockfiles, shared tests) owned by exactly one
  agent — normally the integrator. A brief that does not say what may be written
  is an invitation to collide.
- After merging, the integrator runs the whole gate: a green per-agent gate does
  not mean the merged tree is green. Each dispatch is recorded in the ledger
  (lane, paths, gate, merged or rejected).
- 56 deterministic checks. The dispatch behaviour is not yet measured by a model
  run: `09-caption-dispatch` is defined (two modules, one shared fixture and one
  barrel) but has never been scored, and `08-caption-loop` does not exercise it.

## 0.5.1 — 2026-11-24

- Fixed the composer keeping the text after Enter. `/code-review`,
  `/code-simplify` and `/code-scrub` declared `input`, which makes the client
  treat the line as a claimed command: the draft stays read-only until the
  handler settles — and these handlers await a whole subagent run. They now run
  detached: the token is consumed on Enter, the box clears, and the result
  arrives as a command flow node.
- Consequence: the three commands take no arguments any more. Scope is the
  existing picker; "report only or rewrite" is a second question. A regression
  test now fails if one of them declares `input` again.
- `/code-caption` keeps its `input` hint: its handler steers and returns
  immediately.

## 0.5.0 — 2026-11-24

- Added `/code-caption`: it installs an explicit working loop into the current
  session instead of spawning an agent. The loop is observe → one step → verify
  → prove a new guard → record a caption and commit → re-plan, and it exists
  because a long task loses the thread under compaction: which command ran, what
  it printed, which route already failed.
- The ledger (`docs/caption/<slug>.md`) is the durable memory, with one entry per
  iteration and an outcome of `done`, `dead end`, or `unverified`.
- This is the first command here that is not an isolated-agent pass, and the
  first that depends on `agent.steer`. The rest of the plugin is unchanged.
- Case `08-caption-loop`: two failing tests where the obvious fix leaves the
  second one red, so the run has to record a dead end instead of claiming a
  clean sweep.
- 53 deterministic checks.

## 0.4.0 — 2026-11-24

- Renamed to `@morning-start/dsh-code-toolkit` (plugin id
  `morning-start-code-toolkit`). "Code quality" described two of the three
  passes; a toolkit is what it is. Commands are unchanged.
- Display title is now 代码工具箱 / Code Toolkit, matching the scope: review,
  simplify, scrub.
- The rename is finished everywhere it is observable: the journal directory is
  `$DSH_HOME/code-toolkit/`, question ids are `code-toolkit-*`, and the command
  descriptions say "code-toolkit task". A test now fails if `code-quality`
  reappears outside this changelog, and another fails if `package.json`,
  `cordis.patch.yml`, and `index.js` disagree on the name.

## 0.3.0 — 2026-11-24

- Added `/code-scrub`: finds credentials, account identifiers, and local paths,
  and reports them masked — a report that repeats the secret has only moved the
  leak. `--apply` redacts with the replacement shape each file type needs, then
  verifies.
- The scrubber's hard part is the false positive: `process.env.API_KEY`,
  `<your-key>`, public author metadata, and `sk-test-not-real` are all decoys in
  case 07, which expects an empty report.
- 43 deterministic checks, seven fixture cases, and `evals/results/iteration-2.md`.

## 0.2.0 — 2026-11-24

- Personas are layered like a skill: `agents/<role>/AGENT.md` plus
  `references/` and `examples/` that the child agent reads on demand.
- Review output follows the Codex JSON schema; `src/report.js` parses it and
  renders priority tags with `file:line` links, falling back to the raw reply.
- Base-branch scope resolves the merge base, including the case where the local
  base is behind its upstream.
- Results are written to `$DSH_HOME/code-quality/`, so `/code-status` survives a
  restart and reports an interrupted run as interrupted.
- Locale follows the host's `locale.preference` across the eight official
  languages; an explicit `locale` in config still wins.
- Added `evals/`: 41 deterministic checks, five fixture cases with labels, a
  scorer, an acceptance protocol, and the first recorded iteration.

## 0.1.0

- First version: `/code-review`, `/code-simplify`, `/code-status`,
  `/code-cancel`, scope selection, and isolated spawn-agent execution.
