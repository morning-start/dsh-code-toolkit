# Case 06 — secrets that should be reported

A small repository with three real problems and four decoys:

| Path | What | Expected |
|---|---|---|
| `.env` (committed) | `DB_PASSWORD=hunter2` | **P0** |
| `docs/setup.md:4` | a personal address on an internal domain | **P1** |
| `.vscode/settings.json:3` | `C:\Users\alice\…` in a committed editor setting | **P2** |
| `src/client.js`, `src/config.js` | `process.env.API_KEY` | no finding — this is the fix |
| `.env.example` | `<your-key>` and a `<password>` placeholder | no finding |
| `package.json` | a public author address and repository URL | no finding |

**Expected**: the three findings above, in that order, each masked in the body.
One extra finding is tolerated; a report that misses the password fails.

The committed `.env` is the realistic case: a file everyone treats as local, that
is in fact in the repository. `hunter2` is a well-known joke password, so it is
safe to commit as a fixture and still obviously a password to a reader.

The decoys matter as much as the findings. A scrubber that flags
`process.env.API_KEY` because the variable name contains "KEY", or the author
field because it contains an email, is reporting things the user already knows
are fine — and after two of those, the report stops being read.

**Also checks**: the body must not contain the raw value. `expected.json` lists
`mustNotLeak` (`hunter2`, `jane.doe`, `alice`), and the scorer fails the run if
any of them appears anywhere in the reply. A scrub report that repeats the
secret has only moved the leak — the session transcript, the log, and whatever
the user pastes next all keep a copy.
