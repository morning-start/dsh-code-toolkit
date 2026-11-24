# An apply report

## The change

```diff
--- a/src/socket.js
+++ b/src/socket.js
@@ -84,14 +84,11 @@
-  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
-    try {
-      await connect(url)
-      return true
-    } catch (error) {
-      if (attempt === MAX_RETRIES - 1) {
-        throw error
-      }
-    }
-  }
+  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
+    try {
+      await connect(url)
+      return true
+    } catch (error) {
+      if (attempt === MAX_RETRIES - 1) throw error
+    }
+  }
```

## The correct report

```markdown
# Simplification result · src/socket.js

## Changed

### 1. src/socket.js:88–97 — collapse the single-statement `if` in the retry loop
- **Type**: nesting
- **Change**: the `if (attempt === MAX_RETRIES - 1) { throw error }` block became a single-line guard
- **Verified by**: line-by-line audit — the throw still fires on exactly the last attempt, `error` is the same binding, and no statement moved across the `await`

## Verification
- **Gate**: `npm test -- src/socket.test.js`
- **Result**: pass (7 tests)
- **Notes**: the retry test asserts the final error propagates; it would fail if the guard moved outside the loop.

## Not handled
- **intentional** — the unused `MAX_RETRIES` re-export in `src/index.js` is outside the given scope.
```

## What makes it correct

- One change, one argument, one verification. The diff is small enough to audit.
- The verification names the test that would catch a mistake, not just "tests pass".
- "Not handled" records the out-of-scope find without touching it.

## What a bad apply report looks like

> Rewrote the retry loop for clarity. Tests pass.

Which loop? Which tests? What changed about the retry semantics? Unreviewable — and if the retry count silently became `MAX_RETRIES - 1`, nobody would know.
