# AI Implementation Report

**Author:** Thevinu · **Spec:** `spec/spec.md` · **Tests:** `node --test`, 15 of 15 pass

## How the session was run

- The AI agent was a **separate Claude agent** that saw only the prompt. It had no access to this conversation or to my other files. It could read and write only inside this repo folder.
- Each prompt followed the same spec-led template (`src/ai-implementation-prompt.md`): the constraints first, then the whole spec and acceptance criteria pasted in, and a "Do now" line that names which criteria to build.
- The prompts and answers are saved word for word: `prompt-1.md`, `response-1.md`, `prompt-2.md`, `response-2.md`. A line at the top of each prompt gives the repo folder.
- After each pass I **ran the tests and read the code myself** before accepting anything.

## The reviews

| # | What I asked the AI | What it produced | Did it match the spec? | My fix or follow-up |
|---|---------------------|------------------|------------------------|---------------------|
| 1 | Build the main flow: AC-01, 02, 03 (AI path and the 0.6 line) and AC-08, 09 (input errors) | `types.ts`, `categoriser.ts`, `llm-categoriser.ts`, the fakes and 7 passing tests. It listed 9 questions and 9 assumptions. | **Mostly.** No invented response fields, no new dependencies, only the allowed files. Three small deviations (see below). | Fixed the **spec**, not the code. Wrote spec v0.2: defined "belongs to this claim", the file type rule, the order of checks, the rule for an unusable AI answer (new AC-13), rounding and the id format. |
| 2 | Build the rest: AC-04, 05, 06, 07, 10, 11, 12, 13 (fallback, timeouts, unreadable receipts, privacy, switch, final choice) | `rule-based-categoriser.ts`, timeouts and answer checks in `llm-categoriser.ts`, and 8 new tests. All 15 pass. | **Mostly.** One clear deviation from my instructions, and three places where it filled a gap in the spec (see below). | Ran tests myself. Broke the code five ways in a scratch copy to check the tests notice (all five caught). Wrote spec v0.3 to close the three gaps. |
| 3 | (My own check, no AI) Read all the code against the spec | I found no extra response fields, no extra error codes, and no outside services called by the rule-based path. | Yes | None needed. |

## Where the AI deviated

1. **Pass 2 skipped an instruction.** I asked it to list the ambiguities and assumptions **before** writing code. It wrote the code first, and said so in its answer ("I did not write the ambiguities and assumptions list before the code"). The list it gave afterwards was useful, but the order I asked for was not followed. I did nothing in the code. Lesson: with a one-shot agent, the "ask before you code" step cannot work, because nobody can answer it. The questions need a separate first prompt.
2. **Pass 1 went one line beyond the files rule.** I allowed `package.json` for "a test script only". It also added `"type": "module"`, and said so itself. The line is harmless and it removes a Node warning, so **I kept it**.
3. **Pass 1 added two optional test hooks** (`now` and `newId`) to the list of outside services. The spec did not ask for them. They help the tests and do nothing else, so **I kept them**.
4. **Pass 1 made up a rule** for "belongs to this claim" (the path starts with `claim-{id}/`). It was a sensible guess, but the spec did not say it. This was a gap in **my spec**, so I wrote the rule into spec v0.2.
5. **Pass 2 chose how to count words** for the fallback (different words, not repeats), chose what `recordDecision` receives, and decided what "cannot be read" means. All three were gaps in my spec. I wrote them into v0.3, so there **the spec caught up with the code**. That is the opposite of spec-first, and I am saying it plainly.

## What the tests do and do not prove

- All 13 acceptance criteria have a test. Two have extra checks (exactly 10 MB, and a file missing from storage).
- The five deliberate bugs I tried: the 0.6 line moved, the size check off by one, the file name added to an event, the fallback confidence changed, and the AI time limit raised. Each made a test fail. A run with no change stayed green.
- **Not proven:** anything about real Azure services. The 4 second limit is only checked with a fake slow AI service. The real time, the real cost per suggestion, and the real quality of the category answers are all unknown.
- The AC-05 test uses a real timer, so it takes 2 seconds. That is slow for a test but not wrong.

## What I would do next

1. Resolve the open questions in the spec with Finance and the Claims API owner (the 0.6 line, where the final choice is recorded, the cost per suggestion).
2. Add a real Azure OpenAI and Document Intelligence client behind the same plain-object interfaces, and measure the real time.
3. Make the AC-05 test fast by letting the test set the time limit.
