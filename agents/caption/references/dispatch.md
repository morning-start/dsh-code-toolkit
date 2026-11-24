# Dispatch: parallel work without collisions

## When parallel actually helps

Parallelism pays when the slices can be **decided independently** and their write
sets are **disjoint**. It does not pay when:

- the slices share a file, a schema, or a generated artifact;
- every slice needs the same gate run (you will run it N+1 times anyway);
- the work is one coupled change (a rename, a signature change) — that is one
  step, no matter how many files it touches;
- you would spend more on briefs and merges than on the work.

The default is one agent: you. Dispatch is for width, not for speed.

## Two lanes

### Analysis lane — read-only, fan out freely

Use it to answer independent questions in parallel: "how does module A handle
errors", "which call sites break if B changes", "does the config layer read this
key". Each agent returns findings with `file:line`, the command or read that
produced them, and what it could not determine.

Rules:

- No writes, no `git add`, no formatting. An analysis agent that edits has
  broken the lane.
- One question per agent; a broad question comes back broad.
- Findings are inputs, not verdicts: you decide what they mean together.

### Build lane — writes, exclusive ownership

Use it only when the write sets are disjoint and each slice has its own gate.

- Each agent owns an explicit list of paths. Ownership is exclusive for the whole
  dispatch: two agents never touch the same file, even at different times.
- **Shared files belong to one owner** — normally you: barrels and index files,
  package manifests, lockfiles, config, shared test helpers, generated code.
- A build agent runs its own gate, but its green does not mean the merged tree is
  green. You run the whole gate after merging.

## Partitioning

Partition by module or directory, not by line range. Two agents editing different
regions of one file is still two writers on one path, and the second write wins.

If a slice needs a shared file, it reports the need instead of editing: "adding
the export requires `src/index.js`, which is outside my scope". You make that
edit, or you widen the scope and re-brief.

## The brief

Every dispatch states, in the prompt:

```markdown
- Lane: analysis (read-only) | build (writes)
- Task: one sentence
- May read: <paths or "the repository">
- May write: <exact paths, or "none">
- Must not touch: <shared files, other slices>
- Gate: `<command>` (build lane only; the exact command and its expected shape)
- Output: findings with file:line and evidence | changed files + gate output
- If blocked: stop and report the blocker; do not edit outside scope
```

A brief that omits "may write" is not a brief; it is an invitation to collide.

## Merging

1. Read each result against its brief. An agent that wrote outside its scope has
   produced a conflict, not a contribution — inspect `git status` before trusting
   it.
2. Merge the smallest set that satisfies the criteria.
3. Run the whole gate. A red merged gate is expected sometimes: two locally
   correct changes can still disagree at the seam.
4. Resolve contradictions yourself; do not ask the two agents to negotiate.
5. Record one ledger entry per dispatch: agent, lane, paths, gate, merged or
   rejected, and why.

## Failure handling

- **Agent hit a blocker** (missing dependency, out-of-scope file): record it as a
  dead end, then either widen the scope and re-brief, or do that step yourself.
- **Two analyses disagree**: that is the interesting case — resolve it with a
  third read, not by majority.
- **A build agent's gate stays red**: do not re-dispatch the same brief. Shrink
  the slice or take it back.
- **An agent's report is thin**: the brief was thin. Fix the brief, not the agent.

## What not to parallelize

- A change whose blast radius is the whole repository (rename, dependency bump).
- Anything that edits the same test file every slice depends on.
- Migration or schema changes where order matters.
- Work you have not yet split into slices with disjoint write sets — dispatch
  then produces collisions, not speed.
