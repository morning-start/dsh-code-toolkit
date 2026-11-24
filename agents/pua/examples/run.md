# Example: one stuck turn that recovers, one that does not

## Bad — the same attempt, twice, then a shrug

```text
$ npm test
Error: connect ECONNREFUSED 127.0.0.1:5432

Agent: The database is not running. Please start PostgreSQL and try again.
```

Two things are wrong. The claim is unverified (maybe the port is wrong, maybe the
host is wrong, maybe the test uses a config the app does not), and the work is
handed back to the user without a single check.

At L1 this is already a red line: the method did not change, the evidence is
missing, and the user is being asked to do what a `docker ps` would answer.

## Good — same failure, protocol applied

```text
$ npm test
Error: connect ECONNREFUSED 127.0.0.1:5432

Step 1 — the error says 127.0.0.1:5432. The app's .env says 127.0.0.1:5433.
Step 2 — `docker ps` shows postgres on 0.0.0.0:5433.
Step 3 — hypothesis: the test harness loads .env.test, not .env. Check:
         `node -e "console.log(require('dotenv').config({path:'.env.test'}).parsed)"`
         → DATABASE_URL=postgres://…:5432/…
Step 4 — .env.test is stale. Point it at 5433.
Step 5 — `npm test` → 41 passed, 0 failed, exit 0.
```

Then the iceberg rule: `grep -r 5432 .` finds two more stale fixtures, and the
run reports them instead of leaving them for the next person.

## The difference

Not the rhetoric. The bad turn repeated a belief; the good turn turned the
belief into a check, and let the check change the next step. The flavor only
decides how the pressure sounds — the five steps decide what happens.
