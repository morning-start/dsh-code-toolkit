# Project conventions

The point of this file is that a simplifier should make code look **more** like its own repository, not more like the simplifier's taste.

## Read, in this order

1. `AGENTS.override.md` — highest precedence, usually local overrides.
2. `AGENTS.md` at the repository root, then in the nearest parent directory of the file you are editing.
3. `CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md` — configured fallbacks.
4. `CONTRIBUTING.md`, `STYLE.md`, lint config (`.eslintrc*`, `ruff.toml`, `rustfmt.toml`, `.editorconfig`).
5. The two or three files nearest the one you are editing — the strongest signal of all.

A more specific file beats a more general one. The user's explicit instruction beats every file.

## What to extract

- Formatting: quotes, semicolons, trailing commas, import order, line width.
- Naming: `camelCase` vs `snake_case`, verb-first function names, constant casing.
- Error handling: thrown errors vs result objects, error message style, whether `try/catch` is used at all.
- Logging: the logger, the level vocabulary, structured vs formatted.
- Comments: whether the project uses doc blocks, and in what shape.
- Tests: framework, file layout, naming, how mocks are built.

## Rules

- **Never introduce a second style.** If the file uses `function`, do not add arrow functions; if it uses `snake_case`, do not rename to `camelCase`.
- **Never "fix" a style the project has not declared wrong.** A style you dislike is not a finding.
- **A declared convention beats local inconsistency** only when the file is already the outlier; otherwise follow the file.
- **Lint config is the contract.** If the linter allows it, it is allowed.
- **Do not reformat untouched lines.** A diff that reformats a whole file hides the change you were asked to make.

## When conventions conflict

Say so in the plan and pick the narrower scope (the file over the repository), because the narrower one is what the reviewer will compare against.
