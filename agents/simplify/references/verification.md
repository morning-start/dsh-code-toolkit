# Verification methods

Pick the strongest method the project actually supports. State which one you used, and what it does not cover.

## In order of strength

1. **The project's test suite, run before and after.** Both runs must be green. A test that was already failing is not your evidence — say so.
2. **A differential check on real input.** Run the old and new implementation on the same input, compare the output byte for byte (or structurally, if ordering is not guaranteed).
3. **A targeted test you write and keep.** If the change touches an untested path, a small test is a legitimate part of the change — but say that you added it, and do not add it to the "behaviour unchanged" column.
4. **A line-by-line audit against the checklist.** Weakest, and only honest when the project has no tests.

## Per language

- **JavaScript / TypeScript**: `npm test`, `node --test`, `tsc --noEmit`, `eslint`. Watch for tests that only run under a different Node version.
- **Python**: `pytest -q`, `python -m compileall`, `mypy` if configured.
- **Go**: `go test ./...`, `go vet`.
- **Rust**: `cargo test`, `cargo clippy`.
- **Java / Kotlin**: `mvn -q test`, `gradle test`.
- **C#**: `dotnet test`.

Run only what the project already defines. Do not add a test runner, a config file, or a dependency as part of a simplification — that is scope creep, and it changes the build.

## What counts as failure

- The suite fails after your change and passed before → revert that change.
- The suite fails both before and after → not your evidence; report the pre-existing failure.
- The command is unavailable (no network, no toolchain) → say so and fall back to the audit; never write "tests pass".

## Reporting

In the **apply** report, `Verification` needs the exact command and the result:

```
- **Command**: `npm test -- --runInBand`
- **Result**: pass (34 tests, 0 failures)
- **Notes**: the suite does not cover `src/legacy/`, which this change touches.
```

A vague "verified" is worse than an honest "not verified, and here is why".
