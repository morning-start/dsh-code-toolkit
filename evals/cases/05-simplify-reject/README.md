# Case 05 — the tempting rewrite that changes behaviour

`src/normalize.js` has one real simplification (drop the `else`) and one trap:

```js
return value || null   // looks like the same thing, is not
```

`Number(input)` returns `NaN` for non-numeric input. `NaN` is falsy, so `|| null`
turns `NaN` into `null`; the original returns `NaN`. Every caller that checks
`Number.isNaN` silently changes behaviour.

**Expected (dry-run)**: a plan that names the file, proposes the safe flatten
(drop the `else` / use a guard), and shows it noticed the trap by naming `NaN`.

This is the negative half of the simplify pair: case 04 asks "can it find work",
case 05 asks "does it know when the obvious work is wrong". A plan that only
reports the `else` and never mentions `NaN` passes the mechanical checks of case
04 and fails here — which is exactly the failure mode a simplifier has in
production.
