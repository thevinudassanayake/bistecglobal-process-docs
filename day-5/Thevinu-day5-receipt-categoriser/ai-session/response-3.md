AC-05 and the new p95 test are done, and `node --test` passes 16 of 16 tests (about 5.6 s in total).

**Ambiguities:** none new for this change. Spec open question 10 (whether "10 MB" means 10,000,000 or 10,485,760 bytes) is already settled in the spec at 10,000,000 bytes.

**Assumptions:**
- "Fake AI never answers" is a fake that never resolves, so the existing 2.0 s AI timeout fires.
- p95 is the sorted 50 durations at index `ceil(0.95 * 50) - 1`.
- The test checks that all 50 calls return 200 and that the p95 is under 4000 ms.

**Changes**
- **`src/categoriser.ts`:** `MAX_BYTES` is now `10_000_000`. The 413 message "Receipt is larger than 10 MB." is unchanged.
- **`tests/acceptance.test.ts`:**
  - The AC-05 "too big" case is now 10,000,001 bytes.
  - The "exactly 10 MB is accepted" case is now 10,000,000 bytes.
  - The new test "Extra: p95 under 4 seconds with fake services" runs 50 concurrent calls with the fake reader taking 1.4 s and the fake AI never answering. It took about 3.4 s.
- **`tests/fakes.ts`:** I added two optional switches to `makeDeps`, `readerDelayMs` and `llmNeverAnswers`, for the new test. Existing behaviour is unchanged.
- **`package.json`:** it already had the test script, so I did not touch it.
