# A dry-run plan

## The code

```js
export async function loadConfig(path) {
  if (path) {
    if (fs.existsSync(path)) {
      const raw = fs.readFileSync(path, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed) {
        return parsed
      } else {
        return {}
      }
    } else {
      return {}
    }
  } else {
    return {}
  }
}
```

## The correct plan

```markdown
# Simplification plan · src/config.js

## Summary
- Files read in full: 1
- Files searched only: 0
- Simplification points: 2 (structural: 1, mechanical: 1)
- Gate: `node --test` (2 tests, both green before the change)

## Plan

### 1. src/config.js:2–13 — flatten the guard pyramid
- **Type**: nesting
- **Now**: four nested `if`s, each with an `else { return {} }`
- **Change to**: `if (!path || !fs.existsSync(path)) return {}` followed by the read and parse
- **Why behaviour is unchanged**: every branch that returned `{}` still returns `{}`; the only path that reaches `readFileSync` is unchanged; no side effect moves before a guard
- **Risk**: low

### 2. src/config.js:7–10 — drop the truthiness check on `parsed`
- **Type**: redundancy
- **Now**: `if (parsed) { return parsed } else { return {} }`
- **Change to**: `return parsed`
- **Why behaviour is unchanged**: `JSON.parse` returns an object, an array, a primitive, `null`, or throws. It never returns a falsy object, and a falsy primitive (`0`, `false`, `""`, `null`) currently becomes `{}` — which *does* change behaviour
- **Risk**: **high — rejected**

## Not handled
- **behaviour-risk** — `JSON.parse` throwing on malformed input is unchanged; adding a `try/catch` would change the error contract.
```

## What this plan demonstrates

Point 2 is the interesting one: it looks like a redundancy, and it is a behaviour change. A plan that only lists the changes it intends to make is not a plan — it must also show the candidates it rejected and why. That is what makes the dry-run reviewable before any file is touched.

## What a bad plan looks like

> - Simplifies `loadConfig` by removing unnecessary nesting.
> - Improves readability.

No line numbers, no argument for behaviour preservation, no rejected candidates. It cannot be reviewed, so it cannot be approved.
