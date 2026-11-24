# Acceptance: measuring the agents

The deterministic suite (`npm test`) proves the plugin's own machinery: the
prompt tree is intact, the parser survives hostile model output, the renderer
produces line-anchored links, prompt assembly is right. It cannot tell you
whether the persona makes a model review **well**.

This document is the loop for that second question. It is the same loop
`skill-creator` uses: run the agent on fixed cases, score it, change one thing,
run again.

## What is measured

| Metric | Meaning | Target |
|---|---|---|
| **Recall** | share of planted defects that were reported | 1.00 — a missed P1 is the failure that matters |
| **False positives** | findings on the clean case, plus extras on the others | 0 on the clean case |
| **Priority accuracy** | reported priority within one level of the label | all matched findings |
| **Format** | share of runs that produced parseable JSON | 1.00 preferred; text is scored as recall 0 |

A persona that finds everything but invents two findings per run is worse than
one that finds 80% and invents nothing, because the author stops reading.

## The cases

| Case | Mode | What it tests |
|---|---|---|
| `01-null-header` | review | a tidy-up that breaks an existing caller — needs call-site reading |
| `02-clean-rename` | review | the discipline to report nothing |
| `03-shared-retry-counter` | review | reasoning about the second call, not just the hunk |
| `04-simplify-nesting` | simplify | the plan must argue behaviour preservation, not just shorten code |
| `05-simplify-reject` | simplify | noticing that the obvious rewrite swallows `NaN` |
| `06-scrub-secrets` | scrub | three real leaks among four decoys; the report must stay masked |
| `07-scrub-clean` | scrub | env refs, placeholders and public metadata — report nothing |

Each case is a `before/` tree, an optional `after/` tree (the change), a
`README.md` explaining the trap, and `expected.json` with the labels.

## Running one iteration

```powershell
# 1. Materialise a case as a throwaway git repo with the change uncommitted
node evals/case-setup.mjs --case 01-null-header --out tmp/eval/01

# 2. Run the agent against it. With the persona:
#    point the child at agents/review/AGENT.md and tell it to follow it.
#    Baseline: the same task and the same output schema, no persona.
#    Save the raw reply verbatim:
#      tmp/eval/01/with/report.txt
#      tmp/eval/01/baseline/report.txt

# 3. Score both
node evals/score.mjs --case 01-null-header --report tmp/eval/01/with/report.txt
node evals/score.mjs --case 01-null-header --report tmp/eval/01/baseline/report.txt
```

Hold the output format constant between the two runs. If the baseline is allowed
to answer in prose, the comparison measures JSON compliance instead of review
quality, and the numbers become meaningless.

## What a run looks like

```
case 01-null-header (review) → PASS
  format=structured recall=1.00 precision=1.00 extra=0 priorityOk=1/1
  ✓ dropped-default-parameter (P1, off by 0)
```

A failing run names the miss:

```
case 03-shared-retry-counter (review) → FAIL
  format=structured recall=0.00 precision=1.00 extra=0 priorityOk=0/1
  ✗ module-level-retry-counter
```

## Changing the persona

Change one thing per iteration, then re-run every case. The cases are cheap; the
temptation to tune against a single failure is what makes a persona overfit.

Rules of thumb from the first iteration:

- **Missed a defect** → the persona is missing a *procedure* (where to look), not
  a rule. Add a step, not a warning.
- **Invented a finding** → the bar is too low or the output schema too inviting.
  Strengthen the gates; do not add "be conservative" (models cannot calibrate on
  an adjective).
- **Right finding, wrong priority** → the severity table needs a concrete anchor,
  not a stronger adjective.
- **Unparseable output** → the schema block drifted from what the parser accepts.
  Fix the block; do not relax the parser to hide it.

## Variance

A single run per case is a sample, not a measurement. Before drawing a
conclusion, run each case three times and compare. A persona that wins 2/3 is
not distinguishable from noise; a persona that wins 3/3 with the same failure
mode on the fourth is telling you something.

Record results as `iteration-N/<case>/<config>.json` (the `--json` output of
`score.mjs`) and keep the raw replies — the reply explains *why* a run failed,
and that is the only input to the next edit.

## What this loop cannot tell you

- Whether the review is useful on a real repository, at real size. The cases are
  ten lines; production diffs are not.
- Whether the child model behaves like the one you ship to users.
- Whether a finding is correct when the label itself is arguable. Case labels
  are the ground truth here, and they are ours.

Treat the numbers as a regression detector, not a quality certificate.
