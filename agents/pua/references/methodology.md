# The 7-point checklist (L3)

Source: https://github.com/tanweai/pua (MIT) — the checklist shape. Run it when
the same kind of attempt has failed four times, and paste the answers.

1. **Read the error again, word by word.** Every noun in the message is a fact
   you may have skipped: a path, a port, a version, a permission, a key name.
2. **Find the real log.** Not the console summary — the log the failing component
   itself writes. If you do not know where it is, that is the next task.
3. **Check the assumption you have not checked.** The one you would bet on is
   usually the one that is wrong. Name it, then test it directly.
4. **Compare with the working case.** A minimal working example, a sibling
   module, the previous commit. Diff the two configurations, not the symptoms.
5. **Read the source of the thing that fails.** The library, the CLI, the
   handler. Ten minutes of reading beats an hour of guessing.
6. **Change one variable.** If two things changed, you learn nothing. Revert one,
   re-run, then swap.
7. **Write down what would prove you wrong.** Then go look for it. If you cannot
   state the disproof, you are not testing, you are hoping.

## After it works

- Paste the command and its output — the one that failed before and passes now.
- Run the neighbouring checks (iceberg rule): the same pattern elsewhere, the
  full suite, the build.
- Record what misled you. That sentence saves the next hour.

## When the checklist itself fails

Escalate to L4: stop editing, instrument the system (logs, a minimal repro, a
bisect), and report the boundary you hit with the evidence that proves it. "I
cannot from here, and here is the proof" is a valid end state; "I cannot" is not.
