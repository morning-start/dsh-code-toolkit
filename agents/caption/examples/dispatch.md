# Example: a safe split, and an unsafe one

## The repository

```
src/auth/login.js      failing test: expired tokens are accepted
src/billing/invoice.js failing test: rounding drops a cent
src/index.js           barrel that re-exports both modules
test/shared.js         helper both test files import
```

Task: make the suite green without changing the public API.

## Safe: analysis in parallel, writes with one owner each

**Round 1 — two analysis agents, read-only.**

```markdown
- Lane: analysis (read-only)
- Task: why does `login.js` accept expired tokens, and what is the smallest fix?
- May read: src/auth/, test/auth.test.js
- May write: none
- Output: findings with file:line; say what you could not determine
```

The second brief is identical for `src/billing/`. Both run at once because
neither writes anything. They come back with `src/auth/login.js:14` (expiry
compared with `>` instead of `<=`) and `src/billing/invoice.js:22` (`Math.floor`
where `Math.round` is needed), plus the note that `test/shared.js` builds the
fixtures both tests use.

**Round 2 — two build agents with disjoint write sets.**

```markdown
- Lane: build (writes)
- Task: fix the expiry comparison in src/auth/login.js
- May write: src/auth/
- Must not touch: src/index.js, test/shared.js, src/billing/
- Gate: `node --test test/auth.test.js` → expected 4 pass, 0 fail
- Output: changed files, gate output, anything unverified
```

The billing brief mirrors it with `src/billing/`. Neither may touch the barrel or
the shared helper — those are yours.

**Round 3 — the integrator (you).** If a module needs a new export, you edit
`src/index.js`. Then run the whole suite: `node --test` → 12 pass, 0 fail.

Ledger:

```markdown
## 4. Dispatch: auth and billing in parallel
- Lane: build ×2, disjoint paths (src/auth/, src/billing/)
- Gate per agent: `node --test test/<module>.test.js` → green, exit 0
- Shared files: src/index.js, test/shared.js — edited by me, not dispatched
- Merged: yes; full gate `node --test` → 12 pass, exit 0
- Outcome: done
```

## Unsafe: the same task, dispatched carelessly

```markdown
- Task: make the failing tests pass. You own src/ and test/.
```

Two agents with the same brief. Both open `src/index.js` to add an export, both
edit `test/shared.js` to add a fixture. Agent B's write lands last, so agent A's
export disappears; both report "green" because each ran only its own test file.
The merged tree fails, and the failure points at a line neither agent remembers
writing.

What made it unsafe was not the parallelism — it was the **absence of exclusive
ownership**: the brief gave both agents the same paths, so the conflict was
designed in. The fix is not "dispatch less", it is "give every writer its own
paths and keep the shared ones".

## Rules the two cases illustrate

- Read-only work can always fan out; writing work cannot share a path.
- Shared files get exactly one owner — the integrator.
- Per-agent green ≠ merged green; the integrator runs the full gate.
- A dispatched agent that needs a shared file reports it instead of editing it.
