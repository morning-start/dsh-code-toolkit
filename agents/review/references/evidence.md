# Evidence

A finding without a path to the defect is a guess with a line number attached. Before you write one down, you must be able to answer: **what input, state, or call sequence reaches this line and then goes wrong?**

## What counts as evidence

- **A call path**: `handler → validate → save`, with the file and line where each step loses the guarantee.
- **A concrete input**: the value, the shape, the empty case, the encoding that breaks it.
- **A test that would fail**: describe the assertion you would write.
- **A contract**: the interface, the schema, the documented promise that the change breaks, and who relies on it.
- **A repository rule**: the instruction file and line that states the invariant.

## What does not count

- "This looks risky."
- "Other code might depend on it" — name the code.
- "In some cases this could be slow" — give the scale and the path.
- A pattern you dislike with no consequence attached.
- A finding copied from a linter's style rule the project does not enforce.

## Procedure when evidence is missing

1. Search the call sites (`grep` for the symbol, not the file name). If there is one caller, read it.
2. Read the tests that touch this code. A passing test that contradicts your theory means your theory is wrong, or the test is.
3. If the path is still hypothetical, downgrade or drop. Record it in `limitations` if the uncertainty itself matters to the author.

## Reachability

The same defect is P0 or P3 depending on who can reach it. Trace at least one route from an entry point (HTTP handler, CLI command, exported API, UI event) to the defective line. If every route is behind a feature flag that is off, say so.

## Reporting limits

When you could not check something that a reader would assume you checked — a generated file, a vendored dependency, a test suite that needs credentials — write it in `limitations`. An honest gap is worth more than a confident silence.
