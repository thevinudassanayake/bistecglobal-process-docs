# Receipt Categoriser — Spec Review

**Author:** Thevinu · **Status:** Draft, waiting for the other pair's review

> **Read this first.** The brief asks for a review **given to** and **received from** another pair. I haven't had either yet, so those parts are **blank**, and nothing in them is made up. What is real: 9 problems in **my own spec**, found by the AI agent's questions and by me. They are not counted as peer feedback.

## Setup

- **Other pair:** ______
- **Their spec version (commit hash):** ______
- **My spec version:** v0.9 (the first review was on v0.7, the second on v0.8)

Kinds of problem ("smell"): **vague** (no number or clear meaning), **hidden assumption** (obvious to me, never written down), **embedded solution** (says how, not what).

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Smells found in their spec | 5+ | Not yet |
| Smells found in mine | 3+ | 14: 9 from the AI sessions and my own reading, 5 from the review I received |
| Acceptance criteria you pushed back on | 1+ | 2 (AC-03 "invented rules", and adding more criteria) |
| Reviewer disagreements that produced a real change | 1+ | 2 (AC-03, and the 10 MB limit, see below) |

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

> **Who wrote this review?** Thevinu pasted it into our chat on 2026-10-15, and it is not named. **Fill in the reviewer before you hand this in.** If it came from an AI tool and not from another pair, say so here, because the brief asks for feedback from another pair.

- **Reviewer:** ______ (not named)
- **Spec version reviewed:** v0.7, then v0.8

**Strengths (their words)**
1. "It's improved" compared with the earlier version.
2. "Your six criteria are a solid foundation."
3. "Privacy is improved."

**Risks**
1. The 4 second requirement is not checked anywhere. The 5 second log limit is a different measurement.
2. The backup rules are not in the brief.
3. Reader failure and reader down are not told apart, "10 MB" is unclear, and the privacy criterion can't prove data stays in the tenant.

| # | Reviewer | Section | Smell type | Quote | Suggested rewrite | What I did |
|---|----------|---------|------------|-------|-------------------|------------|
| 1 | received from | Contract and AC-01 | Vague | "under 4 seconds for 95 out of 100 calls" | Say how it is verified. | **Accepted.** A table in Section 4 says it is checked by a load test of 50 calls at once on the real services. |
| 2 | received from | AC-03 | Embedded solution | "taxi" and "toll" give "Travel", confidence exactly 0.5 | Remove the invented mapping unless the spec defines it. | **Partly accepted.** The mapping was already defined in the spec, so I kept it, but I marked it as our own proposal (open question 9). I loosened AC-03 to what the brief says: `rule-based` and confidence 0.5 or less. |
| 3 | received from | AC-04 | Hidden assumption | "the reader finds no words" | Tell an unreadable image from a reader that is down. | **Accepted.** AC-04 now says the reader works but finds no words, and that a reader that is down gives 502. |
| 4 | received from | AC-05 | Vague | "one byte over 10 MB" | Decide MB or MiB and use it everywhere. | **Accepted.** The spec says 10 MB means 10,485,760 bytes everywhere. Open question 10 asks if it should be 10,000,000. |
| 5 | received from | AC-06 | Hidden assumption | "no personal details in the log" | List the allowed fields. Say how "stays in the tenant" is checked. | **Accepted.** AC-06 lists the field names. The tenant rule is now a release check in the Section 4 table. |

**Where I disagreed.** The review says the feature switch and the accept or change choice are "missing entirely", and suggests adding them. I did **not** add more criteria. Both are already checked by tests ("switch off", "final choice is logged"), and the spec just didn't show the link. The review itself says every requirement doesn't need its own criterion. So I added the table in Section 4 that links every requirement in the brief to its check. That was the real change.

**Second round (on spec v0.8).** The same reviewer repeated four points and found no new ones. This is what changed:

| Point | What I did |
|-------|------------|
| "10 MB" is 10,000,000 bytes, not 10,485,760 | **Accepted. This was a real disagreement.** In round one I chose 10 MiB. I changed the spec to 10,000,000 bytes, then had the AI agent change the code and tests (`prompt-3.md`). Open question 10 now asks if the business means 10 MiB. |
| The 4 second p95 needs a performance test | **Accepted.** Added a test with fake services (50 calls at once, a slow reader, an AI that never answers). The real-service load test is still needed and is in the spec. |
| Define the 502 answer, and the unreadable case, explicitly | **Accepted.** The spec now has an example 502 answer, and says an unreadable receipt is a different case. |
| The tenant boundary must be handled separately | **Accepted.** The spec has a "Data boundary" rule and a three-step release check. |
| The switch, and accepting or changing the suggestion, must be covered in tests | **Already done.** The extra tests "switch off" and "final choice is logged" cover them. No new criteria. |

## Reflection

- **Which smell did my spec have most?** Hidden assumptions and vague wording. The review agreed: its five points were two hidden assumptions, two vague wordings and one invented rule. The two AI sessions asked 14 questions between them, and nearly all pointed at something I never wrote down because it felt obvious.
- **What surprised me?** The AI stayed close to the spec. When it went off track, it was usually where my spec had a gap. So most "AI mistakes" were my spec's mistakes.
- **Which smell was easiest to spot in someone else's spec?** ______ (to fill in after I review theirs)
