# AI Implementation Report

**Author:** Thevinu · **Result:** 16 of 16 tests pass (`node --test`)

## How it worked

- The AI was a **separate Claude agent**. It saw only the message I sent. It could only change files in this repo folder.
- Each message had the rules first, then the whole spec and acceptance criteria, then a "Do now" line. The template is `src/ai-implementation-prompt.md`.
- Messages and answers are saved word for word: `prompt-1.md` to `prompt-3.md` and `response-1.md` to `response-3.md`.
- After each round I ran the tests and read the code myself.

## The rounds

| # | What I asked | What it produced | Did it match the spec? | My fix |
|---|--------------|------------------|------------------------|--------|
| 1 | The main flow: the AI path, the 0.6 line, and bad input | The main code, fake services and 7 passing tests | **Mostly.** 3 small slips (below). | I fixed the **spec**: defined "belongs to this claim", how the file type is decided, the order of checks, and an AI answer we can't use. |
| 2 | The rest: backup rules, time limits, unreadable receipts, privacy, the switch, the final choice | The backup rules, time limits and 8 more tests. All 15 pass. | **Mostly.** One broken instruction and 3 gaps it filled itself (below). | I broke the code on purpose 5 ways to check the tests notice. They did. I fixed the spec again. |
| 3 | After a review of the spec: change the size limit to 10,000,000 bytes, and add a test that 50 calls at once finish with a p95 under 4 seconds | The new limit, the two size tests changed, the p95 test, and two optional switches in the fake services. 16 pass. | **Yes.** No deviation this round. | I changed the **spec first** (10 MB = 10,000,000 bytes), then the code. I broke the code 3 more ways to check. |
| 4 | (No AI) I read all the code against the spec | No extra fields, no extra error codes | Yes | None |

The sessions used a list of 13 acceptance criteria, which is why the saved messages show 13. Afterwards I cut the file to the six the brief asks for. The seven I removed became "Extra" tests. I only renamed test titles, and no test logic changed.

## Where the AI went off the spec

1. **Round 2 ignored an instruction.** I asked it to list its questions **before** writing code. It wrote the code first and said so. A one-shot agent can't wait for answers, so "ask first" needs its own message.
2. **Round 1 added `"type": "module"`** to `package.json`, beyond the "test script only" rule. It told me. It is harmless, so I kept it.
3. **Round 1 added two optional test helpers** (a clock and an ID maker) that the spec didn't ask for. I kept them.
4. **Round 1 made up "belongs to this claim"** (the path starts with `claim-{number}/`). The spec never said it. My gap, so I wrote it into the spec.
5. **Round 2 chose three things the spec left open:** count different words, not repeats; what the "decided" step receives; what "cannot be read" means. My gaps. I wrote them into the spec after the code, so the spec caught up with the code. That is the opposite of spec-first.

## What the tests prove

- Each of the 6 criteria has a test, and 10 extra tests cover the other rules.
- In round 2 I broke the code 5 ways (moving the 0.6 line, a size check one byte off, the file name in a log entry, a changed backup score, a longer AI time limit). A test failed each time. In round 3 I broke it 3 more ways (the old size limit, a size limit one byte too low, and an AI time limit of 10 seconds). Each failed a test, including the new p95 test. A run with no change stayed green.
- **Not proven:** anything about real Azure. The p95 test uses fake services, so it only shows that our own time limits (1.5 s and 2.0 s) add up to under 4 seconds. The real speed, cost and AI quality are unknown, and the 4 second limit still needs a load test on the real services before release.
