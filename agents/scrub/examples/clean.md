# A clean repository

## What it looks like

```js
// src/client.js
const apiKey = process.env.API_KEY
if (!apiKey) throw new Error('API_KEY is not set')
```

```text
# .env.example
API_KEY=<your-key>
DATABASE_URL=postgres://app:<password>@localhost/app
```

```json
// package.json
{ "author": "Jane Doe <jane@example.com>", "repository": "github.com/org/app" }
```

```text
docs/setup.md
  Questions? Open an issue.
  Tests use a fixture key: sk-test-not-real
```

## The correct report

```json
{
  "findings": [],
  "overall_correctness": "patch is correct",
  "overall_explanation": "No live credentials or personal data. Every candidate is an environment reference, a documented placeholder, public project metadata, or a value marked as a test fixture.",
  "overall_confidence_score": 0.9,
  "limitations": ["Skipped node_modules and .git."]
}
```

## Why each candidate was dismissed

| Candidate | Why it is not a finding |
|---|---|
| `process.env.API_KEY` | a reference to the environment, not a value — this is the fix |
| `API_KEY=<your-key>` | a placeholder; the angle brackets say so |
| `postgres://app:<password>@localhost` | `localhost`, and the password is a placeholder |
| `"author": "Jane Doe <jane@example.com>"` | package metadata is meant to be public |
| `github.com/org/app` | a repository address, not a credential |
| `sk-test-not-real` | `test` marker, and the value is words |

## Why this case is hard

An empty report is easy to produce and easy to get wrong. The failure modes:

- Flagging `process.env.API_KEY` because the variable name contains "KEY".
- Flagging the author field because it contains an email.
- Flagging `<your-key>` because it is on the line after `API_KEY=`.
- Flagging `sk-test-not-real` because it starts with `sk-`.

Each one is individually forgivable. Together they make the tool something people
stop running. The bar is: if a maintainer would say "obviously not a secret",
it is not a finding.

## The one judgement call

`sk-test-not-real` in docs could be read as a leaked test key. It is reported
here as nothing, because the value contains the word `not-real` and the sentence
introduces it as a fixture. If the same string appeared in `src/config.js`
without that sentence, it would be a P3 — "looks like a test key, confirm it is
not the live one" — not a P0.
