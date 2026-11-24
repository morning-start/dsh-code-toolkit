# Behaviour preservation checklist

"Behaviour is unchanged" is a claim. This is the list you check before making it.

## The silent ones

These change without a visible error, and no test may catch them.

| # | What | Why it bites |
|---|---|---|
| 1 | **Exception type** | Callers catch `TypeError`; you changed it to `Error`. The `catch` no longer runs. |
| 2 | **Exception message** | Tests, logs, and user-facing errors assert on the text. |
| 3 | **Side-effect order** | Two writes swapped look equivalent until the second one throws. |
| 4 | **Boundary values** | `>` vs `>=`, `Math.floor` vs `Math.round`, `slice(0, n)` vs `slice(0, n + 1)`. |
| 5 | **Falsy handling** | `if (x)` vs `if (x !== undefined)` — `0`, `''`, and `NaN` fall on different sides. |
| 6 | **Null vs undefined** | `??` and `||` are not the same; `JSON.stringify` omits one and keeps the other. |
| 7 | **Iteration order** | `Object.keys` order, `Map` insertion order, `sort` stability. |
| 8 | **Floating point** | Reordering additions changes the last digits; `toFixed` rounds differently at `.5`. |
| 9 | **String encoding** | Normalisation, trailing whitespace, `\r\n` vs `\n`, BOM. |
| 10 | **Time zone** | `new Date(str)` parses as local or UTC depending on the format. |
| 11 | **Log content and level** | Tests and alerting rules match on it. |
| 12 | **Concurrency** | Removing an `await` reorders two operations that were serialised. |
| 13 | **Laziness** | A getter turned into a value evaluates eagerly and may throw earlier. |
| 14 | **Mutation** | Returning a copy instead of the same object breaks identity checks. |
| 15 | **Public surface** | Renaming an export, changing a default, removing a re-export. |

## Procedure

1. **Enumerate the observable surface** of what you are touching: return values, thrown errors, side effects, mutations, logs, timing.
2. **Diff your change against that list**, item by item. Most items are "not applicable" — say which.
3. **For each applicable item**, state why it is unchanged. "It looks the same" is not an argument.
4. **Check the callers** of anything whose signature or error behaviour you touched.
5. **Run what exists**: unit tests, type check, lint. A green suite is evidence, not proof — note what it does not cover.

## When the project has no tests

Then verification is manual and must be stated as such: read the diff line by line against this checklist, and describe the input you would use to exercise the changed path. Never claim "tests pass" when there are none.

## Refuse rather than guess

If you cannot argue that one of items 1–15 is unchanged, do not make the change. Report it under "Not handled" with the reason. A skipped simplification costs nothing; a silent behaviour change costs a production incident.
