# Evidence, gates, and dead ends

## What counts as evidence

Evidence is something another person could re-run and get the same answer. In
order of strength:

1. A command and its exit status (`node --test` → `pass 12 / fail 0`, exit 0).
2. A command and its output, quoted exactly, including the failing line.
3. A file read back after an edit, quoted.
4. A screenshot or rendered value, when the claim is visual.
5. Nothing. "I checked" is not a level of evidence.

Record the command, not the interpretation. `npm test` with no output is not
evidence that it passed; a truncated output is not evidence either.

## Choosing the gate

The gate is the command that would fail if the claim were false. Ask: "if I were
wrong, what would go red?" If the answer is "nothing", the gate is decorative.

- Behavior change → the test that exercises it.
- Guard or check added → the check itself, plus the proof below.
- Refactor with no behavior change → the full suite that covered it before.
- Documentation or contract → the checker that reads the document (link check,
  schema check, generated contract).
- Environment or wiring → the command that boots the thing and prints its state.

Prefer a gate with a real exit status. A gate whose output is piped into a
pager or a formatter can lose the exit code; run it bare, or check the status
explicitly.

## Proving a guard

A new guard is a claim about the future: "this cannot regress unnoticed". Prove
it the way you prove any claim:

1. Break exactly what the guard protects.
2. Run the guard. It must fail, and the failure must point at the broken thing.
3. Restore. Run again. It must pass.

If step 2 is green, the guard tests nothing — often because it matches a literal
that the code path never produces, or because the branch it checks is
unreachable.

Restoring is part of the proof, so make it reversible: record the exact line
before editing, or keep the edit as a single anchored replacement. A proof that
leaves the repository broken is worse than no proof.

## Recording a dead end

```markdown
- Outcome: dead end
- Command: `node --test test/a.test.js`
- Output: `TypeError: readFileSync is not defined` (the scratch script has no import)
- Why it failed: the one-liner was written inline and lost its imports
- Next: write the probe as a file instead of a one-liner
```

The command and the output are what make it useful. "Didn't work" costs the next
iteration the same discovery again.

## Two recurring self-inflicted failures

- **Loose anchors.** Replacing by a short string that appears twice deletes the
  wrong block, or deletes half of one. Confirm the anchor is unique (and that it
  is inside the function you meant) before replacing; read the region after.
- **Inline quoting.** Long `node -e` / shell one-liners lose quotes, backticks,
  and newlines in ways that look like logic errors. Write a small script file
  instead; it is faster than the third attempt at escaping.

## The unverified list

Keep it short, specific, and visible in the final report. Each item says what was
not checked and why it could not be:

- "Dark theme not checked — no dark renderer in this environment."
- "Migration path not run — requires a database this workspace does not have."
- "Real-device layout not checked — only the headless viewport was rendered."

An item on this list is honest. An item missing from it is a claim the user will
believe.
