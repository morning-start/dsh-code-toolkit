# Writing an expert

An expert is a paragraph in a brief, not a file. It has one job: make a child
agent that cannot see this conversation behave like a specialist instead of a
generalist who happened to be handed a task.

The failure mode is always the same. A vague brief gets a vague answer, the
parent reads it as "nothing found", and the slice is quietly unverified. The
expert paragraph is what prevents that.

## The five parts

Every expert description has these, in this order. Omit one and the child fills
the gap with its own defaults.

1. **Identity and bar.** Who it is and what standard it holds. Not "you are a
   senior engineer" — that is a costume. "You audit migrations for irreversible
   operations; a migration that cannot be rolled back is a defect, not a
   preference" is a bar.
2. **What it looks at.** The exact inputs: which paths, which files, which
   commands. A specialist is defined by its inputs more than by its adjectives.
3. **What counts as a finding.** The criteria, with the threshold spelled out.
   "Flag any `ALTER` that drops a column or narrows a type" beats "look for
   risky migrations".
4. **What is not a finding.** The exclusion list. This is the part people skip,
   and it is the part that decides whether the report is usable. Name the
   tempting false positives explicitly.
5. **Output shape.** One line per finding, or a table, or a verdict plus
   evidence. Fixed shape, so the parent can merge N experts without reading N
   essays.

## Rules that make an expert usable

- **One question.** An expert that is asked two things answers the easier one.
  If the slice needs two questions, that is two experts.
- **Give it the evidence path, not the answer.** "Check whether `resolve()` can
  return null by reading its callers" produces work. "Is there a null bug?"
  produces a guess.
- **State the bar, not the vibe.** "Be thorough" and "be careful" are not
  instructions a model can follow; a threshold is.
- **Name the false positives.** The expert should know what a plausible-looking
  non-finding looks like in this codebase, or it will report them.
- **Make the output copy-pasteable.** The parent merges by reading; a shape that
  cannot be merged is a shape that will be summarized badly.
- **No delegation.** The expert reports; it does not spawn. Depth is the
  parent's decision, not the child's.
- **Read-only unless stated.** An expert that writes needs an explicit path
  list; without one it reports.

## A worked example

Weak:

```markdown
You are an expert code reviewer. Review the migrations for problems.
```

Strong:

```markdown
You audit database migrations for irreversible operations. A migration that
cannot be rolled back on a live table is a defect, not a style choice.

Look at: `migrations/**/*.sql` and the models they touch under `src/models/`.
Read the migration, then the model, then any caller that writes to the table.

A finding is: a DROP COLUMN, a type narrowing, a NOT NULL added without a
default, or a rename done in one step on a table with more than one writer.
Not a finding: adding an index, adding a nullable column, a backfill that runs
in batches, or anything the file's own comment marks as a staged rollout.

Output one line per finding: `<file>:<line> — <operation> — <why it cannot be
rolled back>`. If nothing qualifies, output `no findings` and the commands you
ran. Do not edit anything.
```

The difference is not length. The weak version leaves the child to invent the
bar, the inputs, the threshold and the shape; the strong one leaves it only the
work.

## Sizing

- **One expert per question**, and a question small enough that its answer fits
  in a screen. If the answer would need a section, split it.
- **Two to four experts in parallel** is the useful range. Past that the briefs
  cost more than the work, and the merge becomes the bottleneck.
- **The parent keeps the shared files.** Experts read them; the parent writes
  them. An expert that needs a shared file edited reports the need.

## What the ledger records

One line per dispatch, with the expert's name so the next iteration can tell
which expert was wrong:

```markdown
- Dispatch: migration-auditor (analysis, migrations/**, read-only) → 3 findings, merged 2
```

If an expert's findings keep getting rejected at merge, the expert paragraph is
wrong, not the child. Fix the bar or the exclusion list, and say which in the
next entry.
