# Case 01 — dropped default parameter

A two-file change. `src/server.js` removes the `= {}` default from `header` and
starts dereferencing `header.cwd`; `src/cli.js` still calls `startSession(store)`
with no header.

**Expected**: one P1 finding on `src/server.js:3`, naming the call site that now
throws. One extra finding is tolerated (a reviewer may also flag the redundant
`header` field), but a report that misses the crash fails.

This is the canonical "looks like a tidy-up, breaks a caller" case. The diff
alone does not show the problem — the call site does, which is why the persona
must read callers rather than review the hunk in isolation.
