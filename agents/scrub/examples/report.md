# A worked report

## The repository

```
src/config.js      apiKey: 'sk-…'                       ← live key, 48 chars
docs/setup.md      Contact ops at j…@ex…ple.com
.vscode/settings.json   "python.defaultInterpreterPath": "C:\\Users\\<user>\\…"
src/client.js      apiKey: process.env.API_KEY  ← the fix, not a finding
.env.example       API_KEY=<your-key>           ← placeholder, not a finding
```

## The correct report

```json
{
  "findings": [
    {
      "title": "[P0] Remove the live provider key from src/config.js",
      "body": "`apiKey` is a string literal shaped like a live provider key (`sk-ab…9f`, 48 chars). It ships in the bundle, in every clone, and in the git history. Read it from `process.env.API_KEY` the way `src/client.js` already does, and rotate the key — removing it here does not remove it from history.",
      "confidence_score": 0.95,
      "priority": 0,
      "code_location": { "absolute_file_path": "E:\\app\\src\\config.js", "line_range": { "start": 7, "end": 7 } }
    },
    {
      "title": "[P1] Replace the personal contact address in docs/setup.md",
      "body": "A personal address (`j…@ex…ple.com`) is given as the operations contact. Use a shared alias or the project's public contact so the page does not publish an individual's mailbox.",
      "confidence_score": 0.8,
      "priority": 1,
      "code_location": { "absolute_file_path": "E:\\app\\docs\\setup.md", "line_range": { "start": 22, "end": 22 } }
    },
    {
      "title": "[P2] Drop the local interpreter path from the committed VS Code settings",
      "body": "`.vscode/settings.json` pins `C:\\Users\\<user>\\…`, which exposes the developer's OS username and breaks for everyone else. Remove the key, or make it relative to the workspace.",
      "confidence_score": 0.9,
      "priority": 2,
      "code_location": { "absolute_file_path": "E:\\app\\.vscode\\settings.json", "line_range": { "start": 3, "end": 3 } }
    }
  ],
  "overall_correctness": "patch is incorrect",
  "overall_explanation": "One live credential, one personal address, and one local path are committed. The key must be rotated, not only removed.",
  "overall_confidence_score": 0.9,
  "limitations": ["Skipped .git and node_modules; no history rewrite attempted."]
}
```

## Why it works

- Every value is **masked**; the report can be pasted anywhere.
- Each finding says what the value *is* (kind, length, shape), which is what the
  reader needs to confirm it without seeing it.
- The P0 names the rotation requirement — the part a scrubber cannot do.
- `src/client.js` and `.env.example` are absent, because they are the fix and a
  placeholder.

## What a bad report looks like

> Found hardcoded key `sk-…` in `src/config.js:7`. Also `j…@ex…ple.com`.

Two problems, and the second is worse than the first: the key is now in the
report, the transcript, and the issue the user opens with it. **A report that
repeats the secret has not fixed anything.**

> `[P0] Possible credential in src/config.js` — with no line, no kind, no shape.

Unactionable. The reader cannot tell whether to drop everything or ignore it.
