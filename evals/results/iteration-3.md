# Iteration 3 — caption loop

## What was run

One case, two configurations, same task, same closing-report instruction
("what changed, the command and its output, anything you did not check"):

- **with**: the agent was told to read `agents/caption/AGENT.md` and follow it —
  the same text `/code-caption` steers into the session.
- **baseline**: the same task, no protocol.

Case `08-caption-loop`: `node --test` has two failing cases; the obvious fix
(`Number.isNaN` after coercion) leaves `sum([true])` red, so the run either hits
a dead end or has to reject booleans up front.

| Case | Config | Gate named | Mutation proof | Dead end / unverified | Result |
|---|---|---|---|---|---|
| 08 | with | ✓ | ✓ (broke coercion, broke boolean rejection) | ✓ (inline `node -e` quoting) | **PASS** |
| 08 | baseline | ✓ | ✗ | ✓ (unverified list) | **FAIL** |

## What actually differed

Not the fix: both produced a correct `toNumber`-style validator, both ran the
suite, both reported an unverified list. The difference is what the run did to
**know** its guard works.

- **with**: ran the gate before changing anything (3 pass / 2 fail, exit 1);
  after the fix, broke coercion on purpose, watched `coerces numeric strings`
  go red, restored; broke boolean rejection, watched it go red, restored; wrote
  `docs/caption/sum-coercion-guard.md` with five entries and a closing entry;
  committed. It also recorded a dead end — two failed attempts at an inline
  `node --input-type=module -e` check before switching to a temp `.mjs` file.
- **baseline**: one clean edit, one gate run afterwards, an ad-hoc `node -e`
  spot check, and a well-written unverified section. It never observed a failure
  of the guard it relied on.

The baseline was competent. It failed only the group that asks for a guard to be
seen failing — which is exactly what the protocol adds.

## Caveats

- **One sample per cell.** The difference is large and structural, but this is
  n=1; a second run could easily land differently.
- **The scorer reads words, not the ledger.** "反证 / 故意破坏 / 故意放行" are
  lexical markers. A run that performed a mutation test but described it as
  "reverted the experiment" would score as if it had not.
- **The first version of the groups measured vocabulary.** With
  `["evidence", "证据"]` as a group, both runs failed — the baseline had given a
  command and its output but never used the word. Groups were changed to gate /
  mutation proof / dead-end-or-unverified, which is a behavioural claim, not a
  synonym check. This is tightening, not loosening: nothing was removed to make
  the treatment pass.
- **The dead-end group did not discriminate.** Both runs mentioned something
  unverified; the baseline's list was shorter but real.
- **Realism.** The eval agent was told to read `AGENT.md` as a file, not steered
  through `agent.steer` — the injected-message path is covered by the
  deterministic tests, not by this run.

## Next round's one thing

Score the **ledger file**, not the closing reply: check that
`docs/caption/*.md` exists, that its head carries task / criteria / gate, and
that every entry has all five fields with an outcome in
`done | dead end | unverified`. That is a structural check the baseline cannot
satisfy by accident, and it removes most of the lexical noise above. Then run
each cell three times and report the spread.
