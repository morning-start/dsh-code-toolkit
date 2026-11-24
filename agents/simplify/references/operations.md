# The six operations, in depth

Each operation lists what qualifies, what it looks like, and the test that decides whether it is in scope.

## 1. Remove redundancy

**Qualifies**: unreachable branches, unused imports and variables, assignments overwritten before any read, duplicated conditionals, a helper that only forwards its arguments, copy-pasted blocks that must stay in sync.

**Does not qualify**: code that looks unused but is reachable through reflection, string lookup, dynamic import, a public export, or a framework convention. Check before deleting.

**Test**: delete it, then prove nothing reads it. `grep` for the identifier; check the package's public surface; run the tests.

## 2. Flatten nesting

**Qualifies**: early returns replacing `if (ok) { …entire body… }`, `continue` replacing a wrapping `if` in a loop, a pyramid of four or more levels, a pass-through function whose only statement is a call.

**Does not qualify**: flattening that moves a side effect before a guard and changes what runs on the error path.

**Test**: every early return must preserve the same set of effects in the same order on every path. Draw the before/after paths for the error case, not just the happy case.

## 3. Improve readability

**Qualifies**: a name that describes the type instead of the meaning (`data`, `tmp`, `res2`); a boolean parameter that makes call sites unreadable (`save(x, true, false)`); a single-use temporary that only obscures the expression; related statements scattered by unrelated ones.

**Does not qualify**: renaming a public symbol (that is a breaking change, not a simplification); renaming to a longer name that says the same thing.

**Test**: the new name must let a reader skip the definition. If they still have to look, it is not clearer.

## 4. Clean comments

**Qualifies**: `// increment i`, commented-out code, a changelog in the file header, a comment that contradicts the code, a doc block whose parameters no longer exist.

**Does not qualify**: anything explaining *why* — a workaround, a non-obvious constraint, a link to an issue, a unit, a magic constant's origin, a warning about ordering.

**Test**: if removing the comment would let a future reader "fix" the code into a bug, keep it.

## 5. Sharpen logs

**Qualifies**: `console.log('done')` with no subject; a log that fires on a path where nothing failed; an error logged without the operation, the key, or the cause; a level that misleads (`info` for a failed write).

**Does not qualify**: changing log *content* that tests assert on, or that an operator greps for. Check the tests and the runbooks first.

**Test**: from the log line alone, can someone locate the problem? If not, it needs the object, the key, the count, or the reason.

## 6. Drop self-proving tests

**Qualifies**: `expect(true).toBe(true)`, an assertion on a mock's own return value, a test that asserts a constant equals itself, a snapshot nobody reads, a test that passes when the implementation is deleted.

**Does not qualify**: a test that looks trivial but pins a contract (an error message, a status code, a serialization shape), or a branch that is only covered here.

**Test**: break the implementation deliberately — if the test still passes, it was never testing anything.
