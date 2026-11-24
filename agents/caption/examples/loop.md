# Example: a healthy run

Task: `sum()` returns `NaN` for empty input, and the test suite fails.

Ledger head:

```markdown
# Caption: sum() empty input

- Task: make `sum()` return 0 for an empty list without changing existing results.
- Criteria: full suite green; `sum([])` is `0`; `sum([1,'2'])` still throws.
- Gate: `node --test`
```

Entries:

```markdown
## 1. Reproduce the failure
- Saw: `node --test` → 3 pass, 1 fail; the failing case is `sum([])`.
- Decided: confirm the failing case before touching code, so the gate is known to be real.
- Did: nothing changed.
- Evidence: `node --test` → `not ok 4 - sum([]) is 0`, exit 1.
- Outcome: done

## 2. Guard the existing contract
- Saw: `sum` currently accepts numeric strings and throws on non-numeric.
- Decided: add a test for `sum([1,'2'])` first, so a fix cannot quietly coerce strings.
- Did: added one test in `test/sum.test.js`.
- Evidence: `node --test` → 3 pass, 2 fail (the new one fails too: current code returns `3`).
- Outcome: unverified — the new assertion is wrong; the current behavior is coercion, so the test documents behavior that does not exist yet.

## 3. Correct the guard
- Saw: entry 2's new test asserted a throw that the code never promised.
- Decided: the contract is "strings are coerced"; test that instead of inventing a stricter one.
- Did: rewrote the assertion to `assert.equal(sum([1,'2']), 3)`.
- Evidence: `node --test` → 4 pass, 1 fail (only `sum([])`).
- Outcome: done

## 4. Fix the empty case
- Saw: `reduce` without an initial value throws on an empty array.
- Decided: pass `0` as the initial value; one line, no other behavior changes.
- Did: `src/sum.js` — `reduce(fn, 0)`.
- Evidence: `node --test` → 5 pass, 0 fail, exit 0.
- Outcome: done

## 5. Prove the new guard
- Saw: entry 3's test is the only thing pinning coercion.
- Decided: break `sum([1,'2'])` on purpose and confirm entry 3 goes red.
- Did: changed `+value` to `value` temporarily.
- Evidence: `node --test` → `not ok 3 - coerces numeric strings`; restored; `node --test` → 5 pass.
- Outcome: done
```

Closing entry:

```markdown
## Close
- Gate: `node --test` → 5 pass, 0 fail, exit 0.
- Criteria: suite green ✓; `sum([]) === 0` ✓; coercion preserved ✓.
- Dead ends: none.
- Unverified: none.
```

Why this is healthy: the gate runs before the change, a wrong assumption is
recorded instead of hidden, the new guard is proven by breaking it, and the
closing entry states the criteria rather than "done".
