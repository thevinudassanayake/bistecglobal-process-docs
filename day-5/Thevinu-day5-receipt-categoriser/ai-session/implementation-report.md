# AI Implementation Report

**Author:** Thevinu · **Result:** 15 of 15 tests pass (run `node --test`)

## How the session worked

- The AI was a **separate Claude agent**. It saw only the message I sent it. It could not see our chat or my other files, and it could only change files inside this folder.
- Each message had the same shape (the template is in `src/ai-implementation-prompt.md`): the rules first, then the whole spec and the acceptance criteria, then a line saying which criteria to build now.
- The messages and the agent's answers are saved word for word: `prompt-1.md`, `response-1.md`, `prompt-2.md`, `response-2.md`.
- After each round I **ran the tests and read the code myself** before I accepted it.

## What happened in each round

| # | What I asked | What the AI gave back | Did it match the spec? | What I did about it |
|---|--------------|-----------------------|------------------------|---------------------|
| 1 | Build the main flow: AC-01, 02, 03 (the AI path and the 0.6 line) and AC-08, 09 (bad input) | The main code, a fake-services helper and 7 passing tests. It also listed 9 questions and 9 guesses it had made. | **Mostly.** It added no extra fields, no extra tools and touched only the files I allowed. It made 3 small slips (see below). | I fixed the **spec**, not the code. In v0.2 I wrote down what "belongs to this claim" means, how the file type is decided, the order of the checks, what to do with an AI answer we can't use (new AC-13), the rounding and the code format. |
| 2 | Build the rest: AC-04, 05, 06, 07, 10, 11, 12, 13 (backup rules, time limits, unreadable receipts, privacy, the switch, the final choice) | The backup rules, the time limits, the answer checks and 8 new tests. All 15 pass. | **Mostly.** It broke one of my instructions, and it filled 3 gaps in the spec with its own choices (see below). | I ran the tests. I broke the code on purpose in 5 ways to see if the tests would notice (they did, every time). I wrote spec v0.3 to close the 3 gaps. |
| 3 | (No AI. My own check.) I read all the code against the spec. | No extra fields, no extra error codes, and the backup rules never call the AI. | Yes | Nothing to fix. |

**A note about numbers.** The AC numbers in this table come from the list of 13 criteria that the AI sessions used. After the sessions I cut the acceptance file down to the six main criteria, as the brief only asks for six. The seven I removed became "Extra" tests. I only renamed the test titles. No test logic changed, and all 15 still pass. The saved messages still show the 13 criteria, because that is what the AI was given.

## Where the AI went off the spec

1. **In round 2 it ignored an instruction.** I told it to list its questions and guesses **before** writing code. It wrote the code first, and said so itself. Lesson: a one-shot agent can't wait for answers, so "ask first" can't work. The questions need their own first message.
2. **In round 1 it went one line past the files rule.** I allowed `package.json` for "a test script only". It also added `"type": "module"`, and told me. The line is harmless and stops a warning, so I kept it.
3. **In round 1 it added two optional helpers for tests** (one for the clock, one for the ID). The spec didn't ask for them. They only help the tests, so I kept them.
4. **In round 1 it made up a rule** for "belongs to this claim": the file path starts with `claim-{number}/`. It was a sensible guess, but my spec never said it. That gap was **my fault**, so I put the rule into the spec.
5. **In round 2 it made three choices the spec left open:** how to count words for the backup rules (different words, not repeats), what the "decided" step receives, and what "cannot be read" means. All three gaps were **my fault**. I put them into v0.3. Here the spec caught up with the code, which is the opposite of spec-first. I am saying so plainly.

## What the tests prove, and what they don't

- Each of the 6 acceptance criteria has a test, and the 9 extra tests cover the other rules in the spec.
- The 5 ways I broke the code: moved the 0.6 line, made the size check one byte off, put the file name into a log entry, changed a backup score, and made the AI time limit much longer. Each one made a test fail. A run with no change stayed green.
- **Not proven:** anything about real Azure. The 4 second limit is only tested with a fake slow AI. The real speed, the real cost of each suggestion, and how good the real AI's answers are, are all unknown.
- The AC-05 test waits a real 2 seconds. That is slow for a test, but it is not wrong.

## What to do next

1. Get answers to the open questions in the spec from Finance and the owner of the Claims API (the 0.6 line, where to record the final choice, the cost of each suggestion).
2. Connect the real Azure OpenAI and Document Intelligence behind the same plain interfaces, and measure the real time.
3. Make the AC-05 test fast by letting the test set the time limit.
