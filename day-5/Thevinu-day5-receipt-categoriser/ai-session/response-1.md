AC-01, AC-02, AC-03, AC-08 and AC-09 are implemented, and `node --test` shows 7 tests pass and 0 fail with no warnings. The tests are one per criterion, plus an extra check that exactly 10,485,760 bytes is accepted and an extra 404 check for a file missing from storage. I wrote this out in the order you asked: ambiguities and assumptions first, then the code.

**Ambiguities I would want clarified**
1. "Belongs to this claim" is not defined. The example `claim-1042/taxi.jpg` for claim 1042 suggests a path prefix, but the spec never says so.
2. The order of checks is not stated. AC-11 says no outside service is called when the switch is off, and AC-09 puts 400 before 404.
3. "JPEG or PNG" could mean the extension or the file contents. AC-09 only mentions the `.gif` extension.
4. Which error messages to use is open. Only the 413 text is given ("Receipt is larger than 10 MB.").
5. What happens when the claim is not a Draft, or the caller is not the claimant. The spec delegates this to the existing Auth component.
6. What the AI service returns, in particular whether it can return a category outside the five. The spec does not say.
7. How `llmTokens` is obtained (see assumption 7).
8. Whether `confidence` is rounded by us or already has two decimals.
9. What `suggestionId` should look like. The spec says only "a unique text id".

**Assumptions I made**
1. A file belongs to claim X if its path starts with `claim-X/`.
2. Check order is: switch off gives 404 `feature_disabled`, then `receiptFile` missing, then bad extension, then wrong claim (all 400 `bad_input`), then storage lookup (404 `receipt_not_found`), then size (413). Only then are the text reader and AI called.
3. File type is checked by extension, case-insensitive: `.jpg`, `.jpeg` or `.png`.
4. Size is checked against 10,485,760 bytes, and exactly that size is allowed.
5. Error messages are my own wording, apart from the 413 text.
6. Confidence is rounded to two decimals, and `needsReview` is `confidence < 0.6`.
7. The AI stand-in returns `{category, confidence, tokens}`, and `tokens` is sent as `llmTokens` on the event.
8. `suggestionId` is a UUID from `crypto.randomUUID`. A test can override it through `deps.newId`.
9. Outside services are plain objects:
   - `featureSwitch.isEnabled(key)`
   - `storage.getFileInfo(path)`, returning `{sizeBytes}` or `null`
   - `textReader.readText(path)`
   - `llm.categorise(text)`
   - `events.track(name, props)`
   - optional `now` and `newId`

**What I deliberately did not build**
- **Other criteria:** nothing for AC-04 to AC-07, AC-10, AC-11 or AC-12. The switch check is in only because AC-11 needs it first.
- **Fallback, timeout and read errors:** `llm-categoriser.ts` just calls the AI service, with no timeout, fallback or error handling. The text reader and AI calls have no failure handling either.
- **`rule-based-categoriser.ts`:** not created, because it belongs to AC-04 and AC-05.
- **`recordDecision`:** exported as requested, but it throws "not implemented (AC-12)".
- **Event fields:** the `categoriser.suggested` event already carries the spec's fields, with `outcome` always "suggested" for now.

I added `"type": "module"` to `package.json` along with the test script, to stop Node's module-type warning. That is one line beyond a test script alone.

Files, all in `C:\Users\ThevinuDassanayakeBI\Downloads\bistecglobal-process-docs\day-5\Thevinu-day5-receipt-categoriser\`:
- `src\types.ts`
- `src\categoriser.ts`
- `src\llm-categoriser.ts`
- `tests\fakes.ts`
- `tests\acceptance.test.ts`
- `package.json`

I did not touch `spec/` or `ai-session/`. `src/ai-implementation-prompt.md` was already in `src/` and is untouched.
