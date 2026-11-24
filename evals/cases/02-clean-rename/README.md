# Case 02 — clean rename

A pure rename: the definition and its single import move from `fmtDuration` to
`formatDuration`, with no other caller in the tree.

**Expected**: zero findings, `overall_correctness: "patch is correct"`.

This case measures false positives, which is the number that decides whether a
reviewer is worth running at all. A report that flags "missing JSDoc", "duplicate
`Math.floor` call", or "name could be shorter" fails the case even though each
finding looks harmless in isolation.
