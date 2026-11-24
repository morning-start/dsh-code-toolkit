# A clean change

## The diff

```diff
--- a/src/format.js
+++ b/src/format.js
@@ -3,7 +3,7 @@
-export function fmtDuration(ms) {
+export function formatDuration(ms) {
   const seconds = Math.floor(ms / 1000)
   return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`
 }
--- a/src/index.js
+++ b/src/index.js
@@ -1,3 +1,3 @@
-import { fmtDuration } from './format.js'
+import { formatDuration } from './format.js'
-export const elapsed = (start) => fmtDuration(Date.now() - start)
+export const elapsed = (start) => formatDuration(Date.now() - start)
```

## The correct report

```json
{
  "findings": [],
  "overall_correctness": "patch is correct",
  "overall_explanation": "A pure rename: the definition and the single import are updated together, the behaviour is untouched, and no other caller references the old name.",
  "overall_confidence_score": 0.9
}
```

## Why this is the hard case

The temptation is to write something — a P3 about the missing JSDoc, a P2 about `Math.floor` being called twice. Both fail the gates: nothing would be fixed, and the second is a micro-optimisation with no path and no scale.

Verifying that there is no second caller is the work here. `grep -r fmtDuration` returning nothing outside these two files is what makes "patch is correct" an evidence-backed verdict rather than an impression.

If a caller in `src/legacy/` still used the old name, the same diff would produce a P0 — the rename would break at runtime, and that is exactly the kind of finding worth the author's time.
