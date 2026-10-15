# Receipt Categoriser — Spec Review

**Author:** Thevinu · **Status:** Draft, waiting for the other pair's review

> **Read this first.** The brief asks for a review **given to** and **received from** another pair. I haven't had either yet, so those parts are **blank**, and nothing in them is made up. What is real: 9 problems in **my own spec**, found by the AI agent's questions and by me. They are not counted as peer feedback.

## Setup

- **Other pair:** ______
- **Their spec version (commit hash):** ______
- **My spec version:** v0.7

Kinds of problem ("smell"): **vague** (no number or clear meaning), **hidden assumption** (obvious to me, never written down), **embedded solution** (says how, not what).

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Smells found in their spec | 5+ | Not yet |
| Smells found in mine | 3+ | 9 (by the AI agent's questions and my own reading, see below) |
| Acceptance criteria you pushed back on | 1+ | Not yet |
| Reviewer disagreements that produced a real change | 1+ | Not yet |

## Smells found in my spec

| # | Section | Kind | Quote | Suggested rewrite |
|---|---------|------|-------|-------------------|
| 1 | Contract | Hidden assumption | "does not belong to this claim" | "A file belongs to claim 1042 if its path starts with `claim-1042/`." (done) |
| 2 | Contract | Vague | "The file is JPEG or PNG" | "...decided by the file name ending (`.jpg`, `.jpeg`, `.png`). We don't open the file." (done) |
| 3 | Contract | Hidden assumption | (nothing about which error comes first) | "Order of checks: the switch, the input (400), storage (404), the size (413), then the outside services." (done) |
| 4 | Contract | Hidden assumption | "If Azure OpenAI gives an error..." | "...or gives a category that is not one of the five, or a confidence outside 0.0 to 1.0, use the backup rules." (done) |
| 5 | Backup rules | Vague | "the most matching words wins" | "...the most **different** listed words wins. A word counts once." (done) |
| 6 | Contract | Vague | "(the text cannot be found or parsed)" | "(no words, or only blank space)" (done) |
| 7 | Why | Hidden assumption | "...a wrong category means Finance has to fix the claim later" | **This was my assumption, not from the brief.** I removed it. The brief doesn't say what happens to a wrong category. (done) |
| 8 | Why | Vague | "at least 70 out of 100 suggestions are accepted" | It is a guess. I kept it as "proposed" and added open question 7. |
| 9 | Contract | Vague | "under 4 seconds for 95 out of 100 calls" | There is no way to check it. Better: "...measured by a test of 50 calls at once before release." Not done yet. |

Count by kind: vague 5 (numbers 2, 5, 6, 8, 9), hidden assumption 4 (numbers 1, 3, 4, 7).

## Feedback given (their spec)

_To fill in after I read their spec._

- **Strengths (3):** ______
- **Risks (3):** ______

| # | Reviewer | Section | Smell type | Quote | Suggested rewrite |
|---|----------|---------|------------|-------|-------------------|
| 1 | given to | ______ | ______ | ______ | ______ |
| 2 | given to | ______ | ______ | ______ | ______ |
| 3 | given to | ______ | ______ | ______ | ______ |

## Feedback received (my spec)

_To fill in after they read my spec._

- **Strengths:** ______
- **Risks:** ______
- **Rewrites I accepted and rewrites I pushed back on, and why:** ______

| # | Reviewer | Section | Smell type | Quote | Suggested rewrite |
|---|----------|---------|------------|-------|-------------------|
| 1 | received from | ______ | ______ | ______ | ______ |
| 2 | received from | ______ | ______ | ______ | ______ |

## Reflection

- **Which smell did my spec have most?** Hidden assumptions and vague wording. The two AI sessions asked 14 questions between them, and nearly all pointed at something I never wrote down because it felt obvious.
- **What surprised me?** The AI stayed close to the spec. When it went off track, it was usually where my spec had a gap. So most "AI mistakes" were my spec's mistakes.
- **Which smell was easiest to spot in someone else's spec?** ______ (to fill in after I review theirs)
