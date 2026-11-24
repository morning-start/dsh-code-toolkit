# Pattern families

Grep one family at a time, then read the surrounding lines. A hit is a candidate, not a finding.

## Credentials

| Family | What to look for | Notes |
|---|---|---|
| Provider keys | prefixes such as `sk-`, `sk-ant-`, `ghp_`, `gho_`, `github_pat_`, `xoxb-`, `xoxp-`, `AKIA`, `ASIA`, `AIza`, `glpat-`, `npm_`, `dckr_pat_`, `hf_` | The prefix identifies the provider; the length confirms it is not a placeholder |
| Bearer tokens | `Authorization: Bearer …`, `"token": "…"`, `token=` | A token in a curl example is still a token if it is real |
| Private keys | `-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----` | Report the header only; never the body |
| Certificates with key material | `-----BEGIN CERTIFICATE-----` **plus** a key in the same file | A bare certificate is public |
| Connection strings | `postgres://user:<password>@host`, `mysql://`, `mongodb+srv://`, `redis://:<password>@`, `amqp://`, `smtp://`, `jdbc:` | The password sits between `:` and `@` |
| Cloud / service secrets | `AWS_SECRET_ACCESS_KEY`, `AZURE_*_KEY`, `SENDGRID_API_KEY`, `STRIPE_SECRET_KEY`, `TWILIO_AUTH_TOKEN`, `FIREBASE_*`, `SUPABASE_SERVICE_ROLE` | The name tells you it is a secret; the value tells you whether it is one |
| Webhooks | `https://hooks.slack.com/services/…`, `https://discord.com/api/webhooks/…`, `https://outlook.office.com/webhook/…` | The URL path is the credential |
| JWTs | `eyJ` followed by base64url segments, three dot-separated parts | Decode the header only to confirm; never paste the payload |
| Signing material | `BEGIN PGP PRIVATE KEY`, `.p12`, `.pfx`, `.keystore`, `.jks` paths that are committed | Report the path, not the bytes |

## Accounts and identity

| Family | What to look for |
|---|---|
| Email | `[\w.+-]+@[\w-]+\.[\w.]+` — then judge: `example.com`, `test@`, `noreply@` are public |
| Internal hostnames | `*.internal`, `*.corp`, `*.local`, `*.lan`, a bare hostname with no dot |
| Internal IPs | `10.`, `192.168.`, `172.16.`–`172.31.` |
| Account / tenant ids | `account_id`, `tenant`, `org_id`, `customer_id` with a literal value |
| Usernames | `user=`, `username:`, `USER=`, `whoami`, a name in a path segment |
| Personal data | a real full name next to a role or an address, phone numbers in `+CC` form, postal addresses, national id patterns |

## Local environment

| Family | What to look for |
|---|---|
| Windows home | `C:\Users\<name>\`, `%USERPROFILE%`, `D:\Users\…` |
| POSIX home | `/home/<name>/`, `/Users/<name>/`, `~/…` is fine — it has no identity |
| UNC paths | `\\host\share\…` |
| Machine names | `COMPUTERNAME`, a hostname in a log sample, `.local` mDNS names |
| Editor / IDE state | `.vscode/settings.json` with an absolute path, `.idea/` files |

## How to grep without leaking

Use patterns that match structure, not values, and keep the results out of your report:

```bash
git ls-files | grep -vE '^(node_modules|vendor)/'
grep -rnE '(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,})' --include='*.{js,ts,json,yml,md}' .
grep -rnE 'BEGIN [A-Z ]*PRIVATE KEY' .
grep -rnE '[A-Za-z0-9_]+://[^:/\s]+:[^@/\s]+@' .
grep -rnE 'C:\\\\Users\\\\[^\\\\]+|/home/[^/]+/|/Users/[^/]+/' .
```

Prefer `git ls-files` over `find`: it respects `.gitignore`, so you do not audit the build output.
