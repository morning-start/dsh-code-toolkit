# Case 07 — a repository that looks suspicious and is clean

Every file here contains something that pattern-matching flags:

| Candidate | Why it is not a finding |
|---|---|
| `process.env.API_KEY` | a reference to the environment — this is the fix |
| `API_KEY=<your-key>` | a placeholder; the angle brackets say so |
| `postgres://app:<password>@localhost/app` | `localhost`, and the password is a placeholder |
| `"author": "Jane Doe <jane@example.com>"` | package metadata is meant to be public |
| `github.com/acme/widgets` | a repository address, not a credential |
| `sk-test-not-real` | `test` and `not-real` markers; the value is words |

**Expected**: zero findings, `overall_correctness: "patch is correct"`.

This is the case that decides whether the scrubber is usable. Each of these is
individually forgivable to flag; together they are why people stop running a
scanner. The bar: if a maintainer would say "obviously not a secret", it is not a
finding.

The hard call is `sk-test-not-real`. It starts with a provider prefix, so a naive
pattern matches. It sits in a sentence that introduces it as a fixture, and the
value says `not-real`. Report it and you have a false positive on the first run
of every project that documents its test keys.
