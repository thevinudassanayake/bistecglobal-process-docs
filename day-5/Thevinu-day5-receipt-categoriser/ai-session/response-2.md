AC-04, 05, 06, 07, 10, 11, 12 and 13 are implemented. `node --test` shows 15 tests, 15 passing, 0 failing. That is the 7 original tests plus 8 new ones; AC-01, 02, 03, 08 and 09 behave as before. I did not write the ambiguities and assumptions list before the code, as you asked. It is below, after the work was done.

**Ambiguities I would have asked about**
- "Cannot be read" is not defined. Is it the reader returning nothing, or also blank text? I treat null or whitespace-only text as unreadable. A reader that throws or is slower than 1.5 s gives 502.
- "Most matching words" could mean distinct listed words or total occurrences.
- The input shape of `recordDecision` is not given.
- Should the switch be checked in `recordDecision`?
- Should `llmTokens` count tokens when the AI answer is rejected?

**Assumptions**
- Rule-based matching counts distinct listed words, using whole-word tokens, ignoring capitals.
- `recordDecision` takes `{suggestionId, claimId, suggestedCategory, finalCategory}`. It sends `categoriser.decided` with those fields plus `accepted`, and does not check the switch.
- An AI answer is rejected if the category is not one of the five or the confidence is not a number from 0 to 1. The fallback is then used with `llmTokens` 0.
- If sending an event fails, the error is swallowed and the claimant still gets the suggestion (spec open question 9).
- The 1.5 s and 2.0 s limits are plain constants with real timers. The AC-05 test waits about 2 seconds for real.
- The `Deps` type is unchanged. I added only a `DecisionInput` type.

**Files changed** (all under `C:\Users\ThevinuDassanayakeBI\Downloads\bistecglobal-process-docs\day-5\Thevinu-day5-receipt-categoriser`)
- `src/categoriser.ts`
- `src/llm-categoriser.ts` now has the timeout and answer validation; it returns null on failure.
- `src/rule-based-categoriser.ts` is new.
- `src/types.ts`
- `tests/fakes.ts` gained options for reader failure, null text, AI failure and delay, an invalid AI answer, and storage call counting. The defaults are unchanged.
- `tests/acceptance.test.ts`

`package.json` already had the `test` script, so I did not touch it.
