# Caption loop

You are running one long task with an explicit loop. The task is hard but
already defined; what usually goes wrong is not the design — it is losing the
thread: doing work you cannot prove, repeating a dead end you already hit, or
reporting done when part of it was never checked. The loop is the countermeasure.

## The loop

Repeat until the acceptance criteria hold. Do not treat these as phases that run
once; every iteration goes through all of them.

1. **Read the ledger first.** The ledger is the only memory that survives
   compaction. If it exists, read the last entry before anything else, and never
   re-derive what it already settled.
2. **Observe the real state.** Run the check that would prove the current claim,
   or read the file you are about to change. Work from the repository, not from
   your memory of the conversation.
3. **Choose one step.** The smallest action that changes what you know or what
   the code does. One change per iteration: if a step needs two unrelated edits,
   it is two steps.
4. **Act.** Read before you edit. Make the anchor unique before you replace it —
   a loose anchor silently deletes the wrong block. After writing, read the
   changed region back.
5. **Verify.** Run the gate. The gate is a command whose exit status decides, not
   your opinion. A red gate is data, not failure: diagnose, adjust, and run the
   next iteration.
6. **Prove a new guard.** When you add a test, a check, or a guard, show it can
   fail: break the thing it protects, watch it go red, restore it, watch it go
   green. A guard you never saw fail is decoration.
7. **Record one caption entry, then commit.** Append to the ledger: what you
   saw, what you decided, what you did, the command and its result, and the
   outcome. Commit the batch while the gate is green.
8. **Re-plan.** Update what is settled, what is still open, and the next step.
   If a step changed the shape of the task, say so instead of pressing on.

## Rules that make the loop honest

- **Never claim without evidence.** "Tests pass" is a command and its output,
  not a sentence.
- **Keep the unverified list.** Anything you did not run, did not see, or could
  not reproduce goes there, and it stays in the final report.
- **Dead ends are first-class.** Record the attempt, the command, and why it
  failed, so the next iteration does not repeat it.
- **One gate per iteration.** Do not batch five changes and then test; a red
  result then tells you nothing.
- **Stop on criteria, not on the list.** The task ends when the acceptance
  criteria hold, not when the to-do list is empty.
- **Ask only at real forks.** Changing scope, an irreversible action, or a cost
  the user did not authorize — stop and ask. Everything else: continue.

## The ledger

Write the ledger to `docs/caption/<slug>.md`, creating the directory if needed.
Keep the head of the file as the contract: the task in one sentence, the
acceptance criteria, and the gate command. Then one entry per iteration:

```markdown
## 3. <short title>
- Saw: <the state that made this the next step>
- Decided: <why this step, and what it would prove>
- Did: <files touched, commands run>
- Evidence: `<command>` → <result, exit status>
- Outcome: done | dead end | unverified
```

## When the task ends

Report what changed, the gate output, each criterion and whether it holds, the
dead ends, and the unverified list. Do not summarize the loop away — the user
needs to see what was not checked.

## Reference files

| File | Read it when |
| --- | --- |
| `references/loop.md` | A step stalls, the gate stays red, or you need to split a step |
| `references/evidence.md` | Choosing a gate, proving a guard, or recording a dead end |
| `examples/loop.md` | You want the shape of a healthy run before writing entries |
| `examples/theater.md` | The run feels busy but nothing is being proven |
