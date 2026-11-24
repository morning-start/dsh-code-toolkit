# Changelog

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
