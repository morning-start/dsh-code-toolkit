# Applying a redaction

Redaction is the easy part. Keeping the project working afterwards is the job.

## Principles

1. **Replace the value, keep the structure.** The quotes, the key name, the indentation, the surrounding comment stay. The diff should be one token wide.
2. **Keep the file valid.** A `.json` file must still parse; a `.yml` must still load; a `.env` must still be readable by the loader.
3. **Prefer the mechanism the project already uses.** If the codebase reads `process.env.X` elsewhere, use it here. If it uses a config loader, use that. Do not introduce a secret manager in a redaction.
4. **One file at a time, one value at a time.** Verify after each; a bulk rewrite that breaks the build cannot be bisected.
5. **Never touch history.** Rewriting commits is a separate operation with its own risks. Say that the credential is still in history and must be rotated.

## Replacement by file type

| File | Replace with | Example |
|---|---|---|
| `.env`, `.env.local` | empty value or `<your-key>` placeholder | `API_KEY=` |
| `.env.example`, `.env.sample` | a placeholder, never a real value | `API_KEY=<your-key>` |
| `.json` config | empty string or placeholder | `"apiKey": ""` |
| `.yml` / `.yaml` | `${API_KEY}` if the consumer interpolates, otherwise `""` | `apiKey: ${API_KEY}` |
| JS / TS source | `process.env.API_KEY` (add the guard the file's style uses) | `const apiKey = process.env.API_KEY` |
| Python source | `os.environ["API_KEY"]` (import `os` if missing) | |
| Go source | `os.Getenv("API_KEY")` | |
| Java / Kotlin | `System.getenv("API_KEY")` | |
| Shell | `${API_KEY:?API_KEY is required}` | |
| Markdown / docs | `<redacted>` or `example-key` | |
| Test fixture | a clearly fake value with a marker | `'test-key-not-real'` |
| Local path | `~` or `<home>` or `process.cwd()` | `path.join(os.homedir(), 'app')` |
| Email in docs | the project's public contact, or remove | |

Name the variable after the key that held it: `STRIPE_SECRET_KEY` → `STRIPE_SECRET_KEY`, not `API_KEY`.

## Do not

- Do not redact a value that the code compares against a constant (a test fixture, a checksum) without checking the test still passes.
- Do not turn a string literal into an env read in a file that runs in the browser — it will be `undefined` at runtime and the build may still succeed.
- Do not add a dependency to do this.
- Do not delete a file to remove a secret. It is still in history, and now the project is broken.

## Verification

1. **The literal is gone.** Grep for a masked fragment of it (first 4 + last 2 characters, or the distinctive middle), not the whole value — a grep command containing the secret is another copy of the secret.
2. **The file still parses.** `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"` for JSON; the project's own config loader when there is one.
3. **The project still runs.** The test suite if there is one; otherwise the build; otherwise say you could not.
4. **Nothing else moved.** `git diff --stat` should show only the files you touched, and each diff should be one token wide.

## What redaction does not fix

- The credential is still in `git log`, in every clone, and in every backup. **It must be rotated at the provider.** Say this in the report, every time, without exception.
- A published package, a CI log, a screenshot, and a chat transcript keep their copy.
- A committed `.env` may already have been indexed by a third party.

Redaction stops the bleeding. Rotation is the treatment.
