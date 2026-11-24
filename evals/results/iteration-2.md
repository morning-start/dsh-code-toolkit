# Iteration 2 — the scrub role

- Date: 2026-11-24
- Host: DeepSeek Harness `0.2.2-rc.5`
- Configs: `with` = `agents/scrub/AGENT.md`; `baseline` = same task and same JSON schema, no persona
- Runs: 1 per case per config
- Scope: the two new cases only. Cases 01–05 were not re-run.

## Results

| Case | Config | Format | Recall | Precision | Priority | Leaks | Verdict |
|---|---|---|---|---|---|---|---|
| 06-scrub-secrets | with | structured | 1.00 | 1.00 | 3/3 | 0 | PASS |
| 06-scrub-secrets | baseline | structured | 1.00 | 1.00 | 3/3 | 0 | PASS |
| 07-scrub-clean | with | structured | — | 1.00 | — | 0 | PASS |
| 07-scrub-clean | baseline | structured | — | 1.00 | — | 0 | PASS |

No mechanical discrimination. Both configs found all three planted leaks at the
right priority, ignored all four decoys, and masked every value.

## What the numbers hide

The replies differ in a way the scorer does not measure. `with` ends with an
`overall_explanation` that **enumerates the decoys it dismissed**:

> The things that look like secrets but are not were deliberately left alone:
> the `process.env.API_KEY` reads … are references, the `<your-key>` /
> `<password>` values in `.env.example` are placeholders, and the `author` field
> in `package.json` is public package metadata.

It also carries three `limitations`: the `.env` blob is already in history, the
password may be a fixture (which would drop it to P3, though the tracked `.env`
still should not ship), and nothing else was excluded.

`baseline` reached the same verdict with the same masking, but did not say what
it had decided *not* to report, and did not separate "may be a fixture" from the
finding itself.

For a scanner, the dismissed list is the difference between "I checked and it is
fine" and "I did not look". That is worth a metric — see below.

## Why the cases did not discriminate

The three leaks are the textbook ones: a committed `.env`, an internal email, a
`C:\Users\` path. A capable model finds them without a persona. The cases earn
their place as regression guards, not as evidence that the persona helps.

The decoys are the interesting half, and both configs handled them — which means
`references/false-positives.md` is currently redundant with what the model
already knows. If a harder case shows the model flagging `<your-key>`, that file
becomes load-bearing.

## Next iteration

1. **Score dismissed decoys.** Count how many of a case's `decoys` list appear in
   the reply as explicit non-findings. It is the metric this iteration needed and
   could not see.
2. **Make case 06 harder.** One credential duplicated across five files, where
   the right answer is one finding with five locations rather than five findings;
   and a placeholder with the right prefix and length (`sk-` + 40 chars) that
   must stay at P3 or below.
3. **Add an apply case.** `--apply` is implemented and completely untested: a
   redaction that breaks the JSON it edits, or that leaves the literal in place,
   would pass every current check.
4. **Run through the real spawn path** — still a subagent proxy.

## Raw material

Replies are under `tmp/eval/<case>/<config>/report.txt` (not shipped).
