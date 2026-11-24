# Example: checklist theater

The same task, run by a loop that looks busy but proves nothing.

```markdown
## 1. Fix sum
- Did: updated `src/sum.js`, added initial value, also cleaned up the tests and
  renamed `total` to `sum` for consistency.
- Evidence: tests pass.
- Outcome: done

## 2. Update docs
- Did: README examples.
- Evidence: looks right.
- Outcome: done

## 3. Final check
- Evidence: everything works.
- Outcome: done
```

What is wrong, line by line:

- **Three unrelated edits in one step.** The rename, the fix, and the test
  cleanup share one gate, so a red result would not say which one broke it.
- **"Tests pass" is not evidence.** No command, no output, no exit status. The
  suite may not even have been run.
- **No failure was ever observed.** The gate ran after the change, so nobody
  knows it would have failed before — the test may be asserting the new behavior
  into existence.
- **No dead ends.** Real runs hit at least one wrong assumption; a run with none
  usually means wrong turns were deleted from the story instead of recorded.
- **The ledger was written at the end.** It is a summary of memory, not a record
  of the work, so it cannot survive compaction or a second pair of eyes.
- **Nothing is unverified.** Either the run checked everything, including the
  docs and the rename, or it is hiding the gaps.

The tell: every entry says what was done, none says what would have proven it
wrong. When the ledger reads like a changelog instead of a sequence of
experiments, the loop is theater.
