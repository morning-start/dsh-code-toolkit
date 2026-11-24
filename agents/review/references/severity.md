# Severity

Priority answers one question: **how soon must a human act?** It is not a measure of how clever the finding is, and not a reward for finding something obscure.

## P0 — drop everything

Blocking release, operations, or ordinary use. Reserve it for defects that need no assumption about input to be wrong.

- Data loss, corruption, or an irreversible write on a normal path
- Authentication or authorization bypass; secrets written to a log or a response
- A crash or hang on the main path
- A contract break every caller hits: changed response shape, changed exception type callers catch, removed field

A P0 that requires an exotic configuration is a P1.

## P1 — fix next cycle

A real bug that a real user or caller can reach, but not on every path.

- Null/undefined handling that fails on an input the API accepts
- Off-by-one at a boundary the caller can hit
- Unhandled rejection or error path that leaves state inconsistent
- Resource leak, missing timeout, unbounded growth under load
- Race between two operations that can overlap in practice
- A migration or schema change that breaks readers

## P2 — fix eventually

Costs someone time later, with a concrete mechanism.

- Two copies of a rule that will drift apart
- A name that says the opposite of what the code does
- A branch with no test that a refactor will silently break
- An abstraction that hides the only place a value is validated

## P3 — nice to have

Only where the project states a convention, or where the code is genuinely hard to read. Never report P3 for taste.

## Calibration

- If you are debating between two levels, pick the lower one and say what would raise it.
- A finding whose trigger you cannot name is not a P0, it is not a finding.
- Five P1s is a normal review. Five P0s usually means the change should not have been proposed, so check your reasoning before claiming it.
- Severity is about consequence, not about how hard the fix is. A one-line fix for data loss is still P0.
