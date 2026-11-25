# The two flows

Most work in a repository is one of two shapes: **change code** or **change
documentation**. They share the same spine — ask, investigate, propose, get
approval, execute, summarize — and differ in what "done" means. Code is done when
a gate proves it and a person confirms it. Documentation is done when the summary
says what changed and why.

Two rules apply to both:

- **The approval gate is real.** Do not start executing before the person has
  approved the plan. A plan that was never read is not an approval.
- **Investigate before proposing.** A proposal that could have been written
  without opening the repository is a guess with formatting.

## Flow A — changing code

```text
requirement → investigate → propose → human approves → execute (refining as you go)
            → test → human confirms → update the docs
```

| Step | What you produce | What ends it |
|---|---|---|
| **1. Requirement** | The need in one sentence, plus what "done" would look like | You can say it back without adding anything |
| **2. Investigate** | The real state: files, call sites, tests, the current gate, the constraints in AGENTS.md | You can name the files you will touch and the command that proves the change |
| **3. Propose** | A plan: the change, the files, the gate, the risks, what you will not do | The person approves, amends, or rejects |
| **4. Execute** | One step per iteration; refine the plan when a step teaches you something | The gate is green and every criterion holds |
| **5. Test** | The gate command and its output; a guard proven red then green | The evidence is in the ledger, not in your memory |
| **6. Human confirms** | The report: what changed, what was verified, what was not | The person says it is right |
| **7. Update the docs** | README / DETAIL / CHANGELOG / AGENTS, whichever the change made stale | The docs describe the code as it now is |

Rules that keep this flow honest:

- **Investigation is read-only.** Do not edit while investigating; a plan written
  after half the edits is a rationalization.
- **The proposal names the gate.** If you cannot name the command that will prove
  the change, you are not ready to propose.
- **Refine in the open.** When step 4 contradicts the plan, say so in the ledger
  and adjust the plan — do not silently do something else.
- **Testing is not "it looks right".** A command and its exit status, or it did
  not happen.
- **Docs come last, and they are part of done.** A change whose README still
  describes the old behavior is not finished; it is a trap for the next person.
- **Stop at the confirmation gate.** Do not push, publish or rewrite history
  before the person confirms.

## Flow B — changing documentation

```text
requirement → investigate → propose → human approves → execute (refining as you go)
            → summary of what changed
```

| Step | What you produce | What ends it |
|---|---|---|
| **1. Requirement** | Which document, for whom, and what is wrong with it now | You can name the reader whose behavior should change |
| **2. Investigate** | The current text, the code it describes, and where the two disagree | You can list the claims that are stale or missing |
| **3. Propose** | The outline: sections to add, rewrite, delete; what stays | The person approves the outline |
| **4. Execute** | Write section by section; check each claim against the code as you go | Every claim is either verified or marked as unverified |
| **5. Summary** | What changed, section by section, and what you could not verify | The person can see the diff's intent without reading the diff |

Rules that keep this flow honest:

- **Documentation is a claim about code.** Every factual sentence should be
  checkable against a file or a command. If you cannot check it, mark it.
- **Investigate the code, not only the doc.** The most common defect in a doc
  change is a confident sentence about behavior that changed last week.
- **Propose an outline, not a rewrite.** "I will rewrite the README" is not a
  proposal; "I will replace sections 3 and 5 and delete 7" is.
- **Delete before you add.** A doc that grows every time it is edited becomes
  unreadable. If a section is wrong, removing it is a valid change.
- **The summary is not a changelog of your keystrokes.** It says what a reader
  will now find that they did not find before.

## Choosing the flow

- The change alters behavior → **Flow A**, even if it also touches docs.
- The change alters only what people read → **Flow B**.
- Both → run **A**, and treat the doc update as its last step. Do not run two
  flows over the same subject; the second one will contradict the first.

## Where the loop fits

This protocol is the loop from `AGENT.md`. Steps 1–3 are iterations too: reading
the code, finding the gate, and writing the plan each end with a ledger entry.
The approval gate is the one place the loop stops and waits for a person — the
only other stops are a real fork in the task (scope change, irreversible action,
unauthorized cost).

Record the flow in the ledger head, so a later reader knows which contract this
run was under:

```markdown
- Flow: A (code) | B (docs)
- Approved: <what the person approved, and when>
```
