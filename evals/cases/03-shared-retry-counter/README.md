# Case 03 — shared retry counter

A "cleanup" that hoists the loop counter to module scope. The diff is four lines
and reads like a simplification; the defect is a second call.

**Expected**: one P1 on `src/socket.js`, anywhere in lines 1–7, explaining that
the counter is now shared across calls.

This is the case that separates reviewers that read the hunk from reviewers that
reason about call order. A reviewer that only reads the diff sees a smaller
function. A reviewer that asks "what happens on the second call" sees it.
