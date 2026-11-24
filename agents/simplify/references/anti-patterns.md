# Anti-patterns

Source: the code-simplifier agent in `anthropics/claude-plugins-official` (`plugins/code-simplifier/agents/code-simplifier.md`, commit `5cec6716`), plus the failure modes seen when a simplifier runs unattended. The "balance" section is that agent's, restated.

## Smuggling a behaviour change

"While I'm here, this condition should also check for `undefined`." It may well be right — and it is still not a simplification. A behaviour change needs its own task, its own review, and its own tests. Mixing it in means the diff cannot be verified as behaviour-preserving, and the reviewer cannot tell which change caused a regression.

## Scope creep

Touching files outside the given scope, or "cleaning up" a neighbour function. The plan stops being reviewable, and every extra file multiplies the risk without adding value. Note it under "Not handled".

## Over-simplification

Shorter but harder to read. Dense one-liners, chained array methods four levels deep, a clever reduce replacing a loop a junior can follow. The measure is not line count — it is the time the next reader needs. If comprehension cost rises, revert.

Signals: you needed a scratchpad to write it; the diff is smaller but you cannot explain it in one sentence; you would not want to debug it at 3am.

## Simplifying into an abstraction

Adding a helper, a base class, a strategy object, or a config flag is **new** complexity. It is only a simplification when it removes more complexity than it adds — usually when the same pattern already appears three or more times.

## Deleting necessary context

The comment explaining the workaround, the oddly named boundary constant, the deliberate ordering of two statements. These are the highest-value lines in the file. A simplifier that deletes them makes the code smaller and the system worse.

## Nested ternaries

```js
const label = a ? 'x' : b ? 'y' : c ? 'z' : 'w'
```

Not terser logic — a puzzle. Use `if`/`else`, `switch`, or a lookup table. The same applies to chained `??`/`||` where the fallback order carries meaning.

## Premature micro-optimisation

Replacing a clear loop with a bit trick, caching a value computed once, inlining a call for speed. Unless the task names a performance problem with a measurement, this is a behaviour-adjacent change with no evidence behind it.

## Rewriting instead of simplifying

The diff replaces 40 lines with 40 different lines. Nothing got clearer; the reviewer now has to re-review everything. A simplification should shrink the diff or make it obviously equivalent.

## The balance rule

Avoid over-simplification that would: reduce clarity or maintainability; create clever solutions that are hard to understand; combine unrelated concerns into one function; remove helpful abstractions; prioritise "fewer lines" over readability; or make the code harder to debug or extend.
