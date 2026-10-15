# Receipt Categoriser — Spec Review

**Author:** Thevinu · **Status:** Draft, waiting for the other pair's review

> **Read this first.** The brief asks for a review **given to** another pair and a review **received from** another pair. I haven't had either yet. Those parts are **blank on purpose**, and nothing in them is made up. The rest is real: the 9 problems in **my own spec** that the AI agent's questions and my own reading found.

## Setup

- **The other pair:** ______ (to fill in)
- **Their spec version (commit hash):** ______ (to fill in)
- **My spec version:** v0.6

**The three kinds of problem (called "smells" in the course):**
- **Vague:** a word with no number or clear meaning, like "fast".
- **Hidden assumption:** something I thought was obvious, so I never wrote it down.
- **Embedded solution:** the spec says **how** to build something when it should only say **what** is needed.

## Results Summary

| What we count | Target | What I have |
|---------------|--------|-------------|
| Problems found in their spec | 5 or more | Not yet. I need their spec. |
| Problems found in mine | 3 or more | **9** (found by the AI agent's questions and my own reading, see below) |
| Acceptance criteria I pushed back on | 1 or more | Not yet. I need a reviewer. |
| Disagreements with a reviewer that led to a real change | 1 or more | Not yet. I need a reviewer. |

## Problems found in my spec

Numbers 1 to 6 came from the two AI sessions (`ai-session/response-1.md` and `response-2.md`). Numbers 7 to 9 I found myself when I read the spec again. **None of these is feedback from another pair**, and I have not counted them as that.

| # | Section | Kind | What my spec said | Better wording |
|---|---------|------|-------------------|----------------|
| 1 | Contract, Errors | **Hidden assumption** | "does not belong to this claim" | "A file belongs to claim 1042 if its path starts with `claim-1042/`." (done in v0.2) |
| 2 | Contract, Inputs | **Vague** | "The file is JPEG or PNG" | "...decided by the end of the file name (`.jpg`, `.jpeg` or `.png`, capital letters don't matter). We don't open the file." (done in v0.2) |
| 3 | Contract, Errors | **Hidden assumption** | (nothing about which error comes first) | "The checks run in this order: the switch, then the input (400), then storage (404), then the size (413), then the outside services." (done in v0.2) |
| 4 | Contract, AI problems | **Hidden assumption** | "If Azure OpenAI gives an error (such as 503)..." | "If the AI gives a category that is not one of the five, or a confidence outside 0.0 to 1.0, treat it as a failure and use the backup rules." (done in v0.2, and it is now an extra test) |
| 5 | Backup rules | **Vague** | "The category with the most matching words wins." | "...the most **different** listed words wins. A word counts once, however many times it appears." (done in v0.3) |
| 6 | Contract, Outputs | **Vague** | "(the text cannot be found or parsed)" | "(no words are found, or only blank space)" (done in v0.3) |
| 7 | Why | **Vague** | "at least 70% of suggestions are accepted" | The 70% is a guess. I kept it as a proposal and added open question 8, because nobody can say if 70% is good without a starting figure. |
| 8 | Contract, The switch | **Embedded solution** | "The key is in Azure App Configuration" | The product name came from the brief, so I kept it. The key name is my own choice. Next time I would write "a switch called `receipt-categoriser`" and put the product name in a decision record. |
| 9 | Contract, AI problems | **Vague** | "under 4 seconds for 95 out of 100 calls" | There is no way to check it. Better: "...measured by a test of 50 calls at once, before release." Not done yet. |

**Count by kind:** vague 5, hidden assumption 3, embedded solution 1.

## Feedback given (their spec)

_To fill in after I read the other pair's spec. Nothing is written here yet._

- **Good things (3):** ______
- **Risks (3):** ______
- **Better wording (3 pairs of "before" and "after"):** see the table

| # | Who | Section | Kind | What it said | Better wording |
|---|-----|---------|------|--------------|----------------|
| 1 | given to | ______ | ______ | ______ | ______ |
| 2 | given to | ______ | ______ | ______ | ______ |
| 3 | given to | ______ | ______ | ______ | ______ |

## Feedback received (my spec)

_To fill in after the other pair reads my spec. Nothing is written here yet._

- **Good things:** ______
- **Risks:** ______
- **Wording I accepted, wording I did not accept, and why:** ______

| # | Who | Section | Kind | What it said | Better wording |
|---|-----|---------|------|--------------|----------------|
| 1 | received from | ______ | ______ | ______ | ______ |
| 2 | received from | ______ | ______ | ______ | ______ |

## What I learned

**Which kind of problem did my spec have most?** Vague wording, with hidden assumptions close behind. The two AI sessions asked 14 questions between them. Nearly every one pointed at something I never wrote down because it felt obvious to me. "Belongs to this claim" and "JPEG or PNG" are good examples. I knew what I meant, but the spec didn't say it.

**What surprised me.** The AI did not invent wild features. It stayed close to the spec. When it went off track, it was nearly always where my spec had a gap, and it filled the gap with a sensible guess. So most "AI mistakes" were really my spec's mistakes. The one real mistake of the AI's own was ignoring my instruction to list its questions before writing code.

**Which kind was easiest to spot in someone else's spec?** ______ (to fill in after I review their spec)

**One thing I will do differently.** Before I send a spec to an AI, I will read each sentence and ask: "what would a stranger have to guess here?"
