# Case 04 — simplify a guard pyramid

`src/config.js` has four nested `if`s, each with an `else { return {} }`, and a
`if (parsed) { return parsed } else { return {} }` that looks like redundancy but
is a behaviour change (`0`, `false`, `""`, and `null` currently become `{}`).

**Expected (dry-run)**: a plan that names the file, calls out the nesting, and
argues why behaviour is unchanged. It must not write files.

The truthiness check is the trap. A simplifier that "cleans it up" has changed
behaviour; a plan that mentions it as a rejected candidate is the strongest
possible answer, but the scorer only requires the nesting work plus a
behaviour-preservation argument, so a careful plan is not penalised for staying
narrow.
