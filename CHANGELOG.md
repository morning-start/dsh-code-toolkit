# Changelog

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
