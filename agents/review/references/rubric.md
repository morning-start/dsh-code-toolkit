# The review bar

Source: OpenAI Codex review guidelines, `codex-rs/prompts/src/review_request.rs` at commit `a592c38c16cdd7623dacc9168926ebccedfb67d3`, Apache-2.0. Reproduced in substance and reorganised; the eight gates and the comment rules below are that rubric's content, not ours.

## Is it a bug?

1. It meaningfully impacts the accuracy, performance, security, or maintainability of the code.
2. It is discrete and actionable — not a general complaint about the codebase or a bundle of unrelated issues.
3. Fixing it does not demand rigor the rest of the codebase does not have. A repository of one-off scripts does not need exhaustive validation.
4. It was introduced in this change. Pre-existing bugs are not this review's business.
5. The original author would likely fix it if they were told.
6. It does not rely on unstated assumptions about the codebase or the author's intent.
7. "This might disrupt something else" is not enough — name the code that is provably affected.
8. It is clearly not an intentional change by the author.

If any gate fails, drop the candidate. The cost of a false finding is that the author stops reading the report.

## How many findings

Report every finding the author would fix if they knew about it. If there is none they would definitely want to see, report none. Do not stop at the first qualifying finding, and do not pad the list to look productive.

## How to write one

1. Be clear about **why** it is a bug, not just where.
2. Communicate severity honestly. Do not inflate a nit into a P0.
3. Keep the body to one paragraph, no line breaks inside a sentence.
4. Quote at most three lines of code, in inline code or a fenced block.
5. State the scenario, environment, or input required to trigger it — early, so severity is readable.
6. Tone: matter-of-fact. Not accusatory, not congratulatory.
7. The author should grasp it without close reading.
8. No flattery. No "Great work, but…", no "Thanks for…".

## Repository conventions

Project instruction files change the bar: `AGENTS.override.md` beats `AGENTS.md`, which beats configured fallback names such as `CLAUDE.md`; a more specific file beats a more general one, and the user's stated review scope beats both.

Read the instruction files that apply to the changed files. A finding is **rule-supported** when that guidance contributes something repository-specific — a scope, an invariant, a remedy, a convention, a required confirmation — beyond generic correctness advice. When a finding is rule-supported, cite the file and the smallest line range in the body. Do not fabricate citations, and do not invent findings just because a rule file exists.

## Boundaries

- Ignore trivial style unless it obscures meaning or violates a documented standard.
- One comment per distinct issue. Deduplicate by changed location and by defect, not by wording.
- Never produce a fix diff. A suggestion, described in a sentence, is the ceiling.
