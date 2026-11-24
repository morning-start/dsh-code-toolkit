# Output contract

The harness parses your reply and renders it as a review report. It reads **one JSON object**; anything else becomes plain text and loses the priority tags and file links.

## Shape

```json
{
  "findings": [
    {
      "title": "[P1] Guard against a missing session before reading cwd",
      "body": "`session.header.cwd` is optional...",
      "confidence_score": 0.8,
      "priority": 1,
      "code_location": {
        "absolute_file_path": "E:\\work\\app\\src\\run.js",
        "line_range": { "start": 41, "end": 43 }
      }
    }
  ],
  "overall_correctness": "patch is incorrect",
  "overall_explanation": "The change drops the null check before dereferencing the session header.",
  "overall_confidence_score": 0.8,
  "limitations": []
}
```

## Field rules

| Field | Rule |
|---|---|
| `title` | ≤ 80 characters, imperative. A leading `[P1]` tag is allowed but optional — the renderer adds one from `priority`. |
| `body` | One paragraph of Markdown. Explain **why**, not just where. |
| `confidence_score` | `0.0`–`1.0`. Below `0.5` you are guessing; consider dropping the finding instead. |
| `priority` | Integer `0`–`3`. Omit it when you genuinely cannot place it. |
| `code_location.absolute_file_path` | A path you actually opened. |
| `code_location.line_range` | `{ "start": n, "end": m }`, `1 ≤ start ≤ end`, short. |
| `overall_correctness` | Exactly `"patch is correct"` or `"patch is incorrect"`. |
| `overall_explanation` | 1–3 sentences justifying the verdict. |
| `limitations` | Optional array of strings. |

## Common rejections

- **Markdown fence around the JSON.** The parser recovers from it, but a fence plus commentary often means the object is truncated. Emit bare JSON.
- **Findings with no `code_location`.** The parser drops them — they cannot be rendered as a location.
- **`line_range` as a string** (`"41-43"`). Accepted for tolerance, but prefer the object.
- **A whole file as the range.** Ranges over 10 lines are rejected by review convention; the author cannot tell which line is wrong.
- **Prose before the object.** Everything outside the object is ignored, so a summary written outside it is lost.

## When nothing is wrong

```json
{
  "findings": [],
  "overall_correctness": "patch is correct",
  "overall_explanation": "The change is a pure rename with tests updated to match.",
  "overall_confidence_score": 0.9
}
```
