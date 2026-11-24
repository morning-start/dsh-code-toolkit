# Changelog

## 0.4.0 — 2026-11-24

- Renamed to `@morning-start/dsh-code-toolkit` (plugin id
  `morning-start-code-toolkit`). "Code quality" described two of the three
  passes; a toolkit is what it is. Commands are unchanged.
- Display title is now 代码工具箱 / Code Toolkit, matching the scope: review,
  simplify, scrub.

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
