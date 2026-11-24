# False positives

Every entry here is something a naive scrubber reports and a human then has to
dismiss. Dismissal is cheap once; it is expensive when it happens on every run,
because the report stops being read.

## References are not values

```js
const key = process.env.API_KEY
const key = os.environ["API_KEY"]
key := os.Getenv("API_KEY")
apiKey: ${API_KEY}
```

These are the fix, not the problem. Never report them.

Also: a `.env` file that is **not** committed, a secret injected by CI, a
`vault:`/`secretsmanager:`/`sops:` reference, a Kubernetes `secretKeyRef`.

## Placeholders

Anything that says it is a placeholder:

- `<your-key>`, `<API_KEY>`, `${YOUR_TOKEN}`, `%API_KEY%`
- `YOUR_TOKEN_HERE`, `REPLACE_ME`, `changeme`, `todo`, `placeholder`
- `xxx`, `****`, `...`, `redacted`
- `sk-xxxx`, `sk-test`, `sk-dummy`, `fake-`, `mock-`, `sample-`
- a value whose length is far below the provider's real key length

An empty string is not a secret either: `"apiKey": ""`.

## Public metadata

These are meant to be public and appear in every repository:

- `author`, `maintainers`, `contributors` in `package.json`
- the copyright line and the license grant in `LICENSE`
- a contact address in `README`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
- repository, homepage, and issue URLs
- an npm scope (`@org/name`), a Docker Hub namespace, a GitHub org
- the git remote URL (it is a repository address, not a credential)

If a public contact address is the *only* identity in the repository, it is still
public. Report it at P3 only if the user asked for contact details specifically.

## Things that look like secrets and are not

| Looks like | Actually is | How to tell |
|---|---|---|
| `a3f9c2…` (40 hex chars) | a commit SHA or a file hash | `git log --all --oneline \| grep <prefix>`, or `sha256sum` of a file |
| `550e8400-e29b-…` | a UUID | version nibble, RFC 4122 shape |
| `eyJ…` in a test | a JWT fixture | decode the payload: `{"sub":"test"}`, `exp` in 1970 |
| `AKIA…` in docs | AWS's documented example | it appears in AWS's own docs; check the value against the documented one |
| `8.8.8.8`, `1.1.1.1` | public DNS | not RFC1918 |
| a base64 blob | an embedded image or font | decode the first bytes; `\x89PNG`, `\x00\x01\x00\x00` |
| `sk_test_…` (Stripe) | a published test key | Stripe documents test keys as public — P3 at most |
| `token: "test"` | a fixture | the value is a word, not a credential |

## Test fixtures

A test needs a value. These are normal:

```js
const client = new Client({ apiKey: 'test-key' })
const user = { email: 'test@example.com' }
expect(parse('Bearer abc123')).toBe(...)
```

Reserve a finding for a fixture that is **shaped like a live credential** — the
right prefix, the right length, and no `test`/`fake`/`mock` marker. Even then,
say "may be a fixture" in the body and prefer P2 over P0.

## Paths that carry no identity

`~/project`, `${HOME}/app`, `./src`, `/tmp/x`, `C:\Program Files\…`,
`/usr/local/bin` — none of these identify a person or a machine.

A path becomes a finding when it contains a **username**, a **machine name**, or
a **share** that is not public.

## Duplicates

One credential pasted into five files is one finding with five locations, not
five findings. The second copy is not a second problem; it is the same problem
with more places to fix. Report the highest-priority location and list the rest
in the body.

## When in doubt

Lower the priority and say what would settle it ("if this is the production
key, it is P0"). A wrong P0 is worse than a P3 the user can ignore.
