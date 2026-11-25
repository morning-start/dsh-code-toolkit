# Iteration 4 — the seven commands in a real host

Iterations 1–3 scored model replies against eval cases. This one is different:
it asks whether the commands **work when a real `dsh web` host runs them** —
registration, delivery, journal, cancellation, and the child-agent path. No eval
case was scored; nothing here measures persona quality.

## Setup

| Item | Value |
|---|---|
| Host | `dsh web`, isolated `DSH_HOME` at `tmp/iso-home`, profile `iso-codetk` |
| Port | 3099 (first pass), 3100 (later passes); desktop profile untouched |
| Workspace | `tmp/iso-ws` — a small git repo the caption run built (`src/hello.js`, `test/hello.test.js`, a ledger) |
| Driver | gateway `session/create` + `commands/execute`, then the session log decompressed and read event by event |
| Model | the host's configured route; the first pass had no usable key and every turn failed with `MISSING_CREDENTIAL` |

## What each command did

| Command | Passes | Result |
|---|---|---|
| `/code-status` | no record / submitted / running | ✅ all three states read correctly |
| `/code-caption <task>` | first run, second run, empty input | ✅ protocol steered; second run carried only the task; empty input fell back to "continue" |
| `/code-review` | inline ×2, `sub` ×2 | ✅ inline queued both; `sub` refused the second with the busy message |
| `/code-review sub` | once the ACL was fixed | ✅ child ran, report came back through `agent.followup`, journal reached `finished` |
| `/code-scrub report` | clean repository | ✅ no findings, patterns in the report masked |
| `/code-simplify report` | clean repository | ✅ 0 simplification points, one candidate rejected on the "≥3 occurrences" rule |
| `/code-simplify` | apply | ✅ 0 changes, gate green, `git status` / `git diff` shown as proof |
| `/pua list` | — | ✅ eight flavors |
| `/pua huawei` | — | ✅ 3 324-character protocol steered, flavor applied |
| `/code-cancel` | no task / task running | ✅ both messages correct |

## What the caption run actually did

This is the only cell that shows the protocol changing behaviour in a live host,
so it is worth recording in detail:

1. `glob docs/caption/*.md` → empty; read `references/loop.md` and `examples/loop.md`.
2. Ran the gate on an empty workspace: `node --test` → `tests 0, pass 0, exit 0`,
   and **called it out as a vacuous green** — not evidence of anything.
3. Wrote the ledger head (task / criteria / gate) before writing code.
4. Test first: wrote `test/hello.test.js`, watched it go red for a missing module.
5. Wrote `src/hello.js`, gate green.
6. **Proved the guard**: broke `greet`, saw two assertions fail, restored, saw green.
7. Committed; `git diff` clean.
8. Recorded a dead end: bare `node --test` hits `spawn EPERM` in the sandbox, so
   the gate became `node --test --test-isolation=none`.

Steps 2, 6 and 8 are the ones a baseline run does not usually produce.

## What went wrong (and what it cost)

- **No usable model key in the isolated home.** The copied `.credentials.yaml`
  held OAuth grants, not the key the `deepseek-official` route needs; every turn
  died with `MISSING_CREDENTIAL`. Nothing about the plugin could be judged from
  that pass. Fixed by configuring a model in the instance.
- **Windows ACL blocked the workspace.** `SetNamedSecurityInfoW failed (Win32 5)`
  on `tmp/iso-ws`; the first `sub` run hung on an approval prompt and never
  released its slot. Fixed with the ACL diagnostic; the hang motivated
  `runTimeoutMinutes`.
- **Two instances on one home.** A second `dsh web` on port 3099 failed with
  `EADDRINUSE` — the port was held by a process started with the desktop binary's
  CLI path. Stopped by PID; no process was killed by name.

## Caveats

- **No scored comparison.** This iteration says "the commands work", not "the
  personas are better". Iterations 1–3 carry the quality evidence.
- **The driver is the gateway, not the UI.** The `/` menu, the receipt bubble and
  the rendering of a delivered report were never seen by a human.
- **`runTimeoutMinutes` is covered by a unit test only.** The hang that motivated
  it was observed, but the release itself was not watched in a live host.
- **One workspace, one model.** `iso-ws` is four files; a real repository would
  exercise scope resolution and the gate far harder.

## Next round's one thing

Run the same seven commands against a **real repository** (this one), with the
`/` menu driven by hand for at least `/code-review` and `/code-caption`, and
record the screenshots. Everything above was driven by API calls; the one thing
still unproven is that a person can find and use the commands.
