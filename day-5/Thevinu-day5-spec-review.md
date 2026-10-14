# Receipt Categoriser — Spec Review

**Author:** Thevinu · **Status:** Draft, waiting for the peer review

> **Read this first.** The brief asks for a review **given to** and **received from** another pair. I haven't had either yet, so those parts are **blank on purpose** and nothing in them is invented. What I did fill in is real: the problems in **my own spec** that the AI agent's questions exposed, and my own reading of the brief.

## Setup

- **Reviewer pair:** ______ (to fill in)
- **Spec version reviewed (their commit hash):** ______ (to fill in)
- **My spec version:** v0.3

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Smells found in their spec | 5+ | Not yet. Waiting for their spec. |
| Smells found in mine | 3+ | **9** (found by the AI agent's questions and by my own reading, see below) |
| Acceptance criteria you pushed back on | 1+ | Not yet. Needs a reviewer. |
| Reviewer disagreements that produced a real change | 1+ | Not yet. Needs a reviewer. |

## Smells found in my spec

The first six came from the two AI agent sessions (`ai-session/response-1.md` and `response-2.md`). The last three I found myself when re-reading. They are **not** peer feedback, and I have not counted them as that.

| # | Section | Smell type | Quote from my spec | Suggested rewrite |
|---|---------|------------|--------------------|-------------------|
| 1 | Contract, Errors | **Hidden assumption** | "does not belong to this claim" | "A file belongs to claim 1042 when its path starts with `claim-1042/`." (done in v0.2) |
| 2 | Contract, Inputs | **Vague** | "The file is JPEG or PNG" | "...decided by the file ending (`.jpg`, `.jpeg` or `.png`, ignoring capitals). Version 1 does not look inside the file." (done in v0.2) |
| 3 | Contract, Errors | **Hidden assumption** | (nothing said about which error comes first) | "Checks run in this order: the feature switch, then the input (400), then the storage lookup (404), then the size (413), then the outside services." (done in v0.2) |
| 4 | Contract, Rules | **Hidden assumption** | "If Azure OpenAI fails (error such as 503)..." | "If Azure OpenAI answers with a category that is not one of the five, or a confidence outside 0.0 to 1.0, treat it as a failure and use the rule-based fallback." (done in v0.2, with AC-13) |
| 5 | Rule-based fallback | **Vague** | "The category with the most matching words wins." | "...the most **different** listed words wins. A word counts once, however many times it appears." (done in v0.3) |
| 6 | Contract, Outputs | **Vague** | "(the text cannot be found or parsed)" | "(Document Intelligence returns no text, or only blank text)" (done in v0.3) |
| 7 | Why | **Vague** | "at least 70% of suggestions are accepted" | The 70% is a guess. I kept it as a proposal and added open question 8, because without a starting figure nobody can say if 70% is good. |
| 8 | Contract, Inputs | **Embedded solution** | "The Azure App Configuration key is `receipt-categoriser`." | The product name came from the brief's constraints, so I left it. The key name is my own choice. If I wrote it again I would say "a switch named `receipt-categoriser`" and move the product name to an ADR. |
| 9 | Contract, Rules | **Vague** | "under 4 seconds for 95 out of 100 requests" | It has no way to check it. A better line: "...measured by a load test of 50 calls at once, run before release." Not done yet. |

**Count by type:** hidden assumption 3, vague 5, embedded solution 1.

## Feedback given (their spec)

_To be filled in after I have read the other pair's spec. Nothing is written here yet._

- **Strengths (3):** ______
- **Risks (3):** ______
- **Concrete rewrites (3 quoted before and after pairs):** ______

| # | Reviewer | Section | Smell type | Quote | Suggested rewrite |
|---|----------|---------|------------|-------|-------------------|
| 1 | given to | ______ | ______ | ______ | ______ |
| 2 | given to | ______ | ______ | ______ | ______ |
| 3 | given to | ______ | ______ | ______ | ______ |

## Feedback received (my spec)

_To be filled in after the other pair has read my spec. Nothing is written here yet._

- **Strengths:** ______
- **Risks:** ______
- **Rewrites I accepted and rewrites I pushed back on, and why:** ______

| # | Reviewer | Section | Smell type | Quote | Suggested rewrite |
|---|----------|---------|------------|-------|-------------------|
| 1 | received from | ______ | ______ | ______ | ______ |
| 2 | received from | ______ | ______ | ______ | ______ |

## Reflection

**Which kind of smell did my spec suffer most from?** Vagueness, and hidden assumptions close behind. The two AI sessions asked 14 questions between them, and almost every one pointed at something I had not written down because it felt obvious to me. "Belongs to this claim" and "JPEG or PNG" are good examples: I knew what I meant, but the spec did not say it.

**What surprised me.** The AI agent did not invent wild features. It stuck to the spec closely. When it went off the track, it was nearly always in a spot where my spec had a gap, and it filled the gap with a sensible guess. So most "AI mistakes" were really spec mistakes. The one real mistake of the agent's own was ignoring my instruction to list questions before coding.

**Which kind was easiest to spot in someone else's spec?** ______ (to fill in after I review their spec)

**One thing I will do differently.** Before sending any spec to an agent, I will read each sentence and ask "what would a stranger have to guess here?".
