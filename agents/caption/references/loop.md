# The loop in depth

## Why a loop and not a plan

A plan is a hypothesis about how the work divides. It is written before the code
answers back. The loop is how the hypothesis gets corrected: every iteration
ends with evidence, and evidence is allowed to contradict the plan. When it
does, update the plan — do not protect it.

The failure mode this prevents is the one where a plan of seven batches is
executed faithfully while the third batch quietly changed the shape of the
problem, and batches four through seven build on an assumption that stopped
being true.

## Why the ledger is external

Long tasks get compacted. After compaction you keep a summary, not the detail:
which command was run, what it printed, which attempt already failed. A summary
will happily lose exactly that. The ledger is the part you can re-read.

Two rules follow:

- Read the ledger at the start of every iteration, not once at the start.
- Write the entry at the end of every iteration, even when the iteration failed —
  especially then.

## Sizing a step

A step is well sized when its outcome is one of: a claim proven, a claim
refuted, or one behavior changed. If you cannot state the gate for a step before
doing it, the step is too big or too vague.

Split when:

- two files change for unrelated reasons;
- the gate would need to be run twice to know which half broke it;
- you catch yourself writing "and also" in the step description.

## When the gate stays red

Three iterations on the same red gate is a signal, not a grind. In order:

1. Re-read the failure output, not the summary of it.
2. Check whether the gate itself is wrong (a stale expectation, a test that
   locks the old behavior). If the behavior changed on purpose, update the
   assertion — and say so in the ledger.
3. Shrink the step until the red is reproducible in isolation.
4. If it is still red, record it as a dead end with the exact command and
   output, and pick a different route. A recorded dead end is progress; an
   unrecorded one is a future repeat.

## When a change has more than one mirror

Some changes must land in several places that are maintained by hand: an enum
and its runtime list, a type and its validator, a command and its documentation.
A change that updates one mirror looks green until the second reader runs.

Before the step, list the mirrors. In the gate, include whatever reads the
second mirror. If no such check exists, that is the finding: add the guard, and
prove it fails when a mirror is missing.

## Recovering after compaction

1. Read the ledger head: task, criteria, gate.
2. Read the last two entries: what was settled, what was open.
3. Run the gate once. The result tells you whether the last entry's claim still
   holds.
4. Continue from the open item, not from the beginning.

## Ending

The loop ends when the criteria hold. Then write the closing entry: gate output,
criteria status, dead ends, unverified list. If a criterion cannot be checked in
this environment, it stays unverified and is reported as such — a task is not
"done" because the remaining work is invisible.
