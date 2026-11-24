# Iteration 1 — first measurement

- Date: 2026-11-24
- Host: DeepSeek Harness `0.2.2-rc.5`
- Configs: `with` = persona from `agents/<role>/AGENT.md`; `baseline` = same task and same output schema, no persona
- Runs: 1 per case per config (a sample, not a measurement — see "Variance" in `ACCEPTANCE.md`)
- Note: case 05 was added after the first four were scored; it is the same host, same day, same protocol.

## Results

| Case | Mode | Config | Format | Recall | Precision | Priority | Verdict |
|---|---|---|---|---|---|---|---|
| 01-null-header | review | with | structured | 1.00 | 1.00 | 1/1 | PASS |
| 01-null-header | review | baseline | structured | 1.00 | 1.00 | 1/1 | PASS |
| 02-clean-rename | review | with | structured | — | 1.00 | — | PASS |
| 02-clean-rename | review | baseline | structured | — | 1.00 | — | PASS |
| 03-shared-retry-counter | review | with | structured | 1.00 | 1.00 | 1/1 | **PASS** |
| 03-shared-retry-counter | review | baseline | structured | 1.00 | 0.33 | 1/1 | **FAIL** |
| 04-simplify-nesting | simplify | with | — | — | — | — | PASS |
| 04-simplify-nesting | simplify | baseline | — | — | — | — | PASS |
| 05-simplify-reject | simplify | with | — | — | — | — | PASS |
| 05-simplify-reject | simplify | baseline | — | — | — | — | PASS |

`with`: 5/5. `baseline`: 4/5.

## What actually differed

Only case 03 discriminated, and not on recall — both found the defect. The
baseline reported **one defect as three findings**:

- `[P0] Keep the retry counter local so each call gets its full retry budget`
- `[P1] Avoid returning false without ever attempting a connection`
- `[P2] Do not share retry state across concurrent connections`

Same root cause, three entries. The persona produced one finding that names the
mechanism, the second-call path, and the concurrent-interleaving variant, plus a
`limitations` entry admitting there were no tests to run.

That is the effect the eight gates are supposed to have: not finding more, but
reporting the same thing once. Precision, not recall, is the metric that moved.

## Case 05: a qualitative gap the scorer cannot see

Both configs passed case 05, so it adds no mechanical signal — but the replies
differ in a way the metric ignores.

`with` produced three candidates: the safe `else` removal, the `|| null` rewrite
(**rejected**, with the `NaN` argument and a 21-input `Object.is` comparison),
and inlining the temporary (**rejected**, because `Number(obj)` re-invokes
`valueOf`). It also stated plainly that no test suite exists, so the comparison
table *is* the evidence.

`baseline` produced the same safe rewrite and also rejected `|| null` — but only
in "Not handled", as a footnote, with a looser argument (`''` and `-0` do not
actually diverge there). It did one thing, rejected one thing.

So the persona did not change the verdict; it changed the shape of the plan —
rejected candidates as first-class entries rather than footnotes. That is worth
measuring and currently is not.

## What did not discriminate

Cases 01, 02, 04, and 05 passed for both configs. 01 and 02 are still worth
keeping — they guard against regression in the other direction — but they carry
no signal about whether the persona helps, and must not be cited as evidence
that it does.

The first iteration says the harness works. It does not yet say the persona is
better; one discriminating case out of five is not enough to claim that.

## Next iteration

1. **Repeat each case three times.** One run per cell cannot separate a persona
   effect from sampling noise.
2. **Make case 02 harder.** Both configs reported nothing on a pure rename; the
   interesting failure is a clean change with one *plausible but wrong* finding
   available (an unused-looking export that is loaded dynamically). That is where
   the gates should earn their keep.
3. **Score rejected candidates in simplify plans.** Case 05's real difference is
   that the persona treats a rejected rewrite as a plan entry. Add a metric
   (`rejected` count, and whether the rejection names the input that would
   change) before adding more simplify cases — otherwise every new case will
   pass for both configs.
4. **Run through the real spawn path**, not subagents reading the persona file.
   This iteration is a proxy: the persona arrived as a tool read, not as an
   injected system-prompt section.

## Raw material

Replies and scores are under `tmp/eval/<case>/<config>/report.txt` (not shipped).
Re-score any of them with:

```powershell
node evals/score.mjs --case 03-shared-retry-counter --report tmp/eval/03-shared-retry-counter/with/report.txt
```
