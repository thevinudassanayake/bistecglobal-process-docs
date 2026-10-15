Repo folder: C:\Users\ThevinuDassanayakeBI\Downloads\bistecglobal-process-docs\day-5\Thevinu-day5-receipt-categoriser

You are implementing a feature in TypeScript. Below is the complete spec and
acceptance criteria. Implement the feature so that the acceptance criteria
listed under "Do now" can be made to pass with a small test runner.

Constraints:
- Language: TypeScript, run directly by Node 24 with no build step.
- Test runner: Node's built-in `node:test` and `node:assert`. Do not add any
  dependencies.
- Create or edit only these files inside the repo folder:
  src/types.ts, src/categoriser.ts, src/llm-categoriser.ts,
  src/rule-based-categoriser.ts, tests/fakes.ts, tests/acceptance.test.ts,
  package.json (a test script only). Touch nothing else, including spec/ and
  ai-session/.
- Do NOT invent fields, endpoints, error codes or behaviour that are not in
  the spec.
- Keep the AI path (llm-categoriser.ts) and the rule-based path
  (rule-based-categoriser.ts) in separate files.
- Every outside service (storage, text reader, AI service, feature switch,
  event logging) is passed in as a plain object. Write no real Azure code.
- Export `categorise(request, deps)` returning `{ status, body }`, and
  `recordDecision(input, deps)`.
- Before writing code, list any ambiguities in the spec you would want
  clarified. Then list the assumptions you made. Then write the code.
- The repo already contains the earlier work. Read src/ and tests/ first.
  Keep every other behaviour and test as it is. Only change what "Do now" says.
- Run the tests with `node --test` and report the result.

Do now: AC-05, and one new extra test. (1) The size limit is now 10,000,000 bytes (see Section 3, Inputs): change the limit, and change the two size tests so the "too big" case is 10,000,001 bytes and the "exactly at the limit" case is 10,000,000 bytes. (2) Add one new extra test named "Extra: p95 under 4 seconds with fake services", as described in the "Under 4 seconds" row of the table in Section 4. It may take about 3 seconds to run.

# Receipt Categoriser — Feature Spec v0.9

**Author:** Thevinu · **Status:** Draft · **Date:** 2026-10-15

## 1. Why

The person making a claim picks the expense category by hand for every receipt. This is slow, and they can pick the wrong one. The Receipt Categoriser reads the receipt and suggests a category, so the person usually only has to confirm it.

**Metric (proposed):** at least 70 out of 100 suggestions are accepted without a change. We count this from the "decided" log entry (Section 3). We have no starting figure, so 70 is a guess (open question 7).

## 2. Scope

**In scope**
1. One call that suggests a category for one uploaded receipt.
2. Logging each suggestion and the person's final choice.
3. A switch that turns the feature off without a new release.

**What it touches (Day 4 diagrams)**
- **Claims API:** a new part inside it, the "Categoriser".
- **Receipt storage:** read only. The Categoriser reads the receipt from storage.
- **New outside services:** Azure AI Document Intelligence (reads the words on the receipt), Azure OpenAI (suggests the category), Azure App Configuration (holds the switch) and Application Insights (keeps the logs).
- **Web app:** shows the suggestion and the "Needs review" label.

**Not touched:** the Claims database, the Message queue, the Notification worker and the Export job.

## 3. Contract

### Inputs
The Web app sends `POST /claims/{claimId}/receipts/categorise` with the receipt file name. It does this by itself, in the background, right after a receipt is uploaded. The person never makes this call.

```json
{ "receiptFile": "claim-1042/taxi.jpg" }
```

- The input is the receipt image and the claim ID. The brief sends the image in the call. Our ADR 0004 says pictures never pass through the API, so the call names the image already in Receipt storage.
- The file is a JPEG or PNG, at most 10 MB. In this spec **10 MB means 10,000,000 bytes**, as the brief says 10 MB, everywhere: the spec, the criteria, the tests and the code. The type is decided by the file name ending (`.jpg`, `.jpeg`, `.png`, capital letters don't matter).
- A file belongs to claim 1042 if its path starts with `claim-1042/`.
- The person is signed in, owns the claim, and the claim is a Draft. The Auth part already checks this.

### Outputs
`200 OK` with:

```json
{
  "suggestionId": "a UUID (a unique code)",
  "category": "Meals | Travel | Lodging | Office Supplies | Other",
  "confidence": 0.84,
  "source": "llm | rule-based",
  "needsReview": false,
  "message": null
}
```

- `confidence` is a number from 0.0 to 1.0, rounded to 2 decimals.
- `needsReview` is `true` when `confidence` is **below 0.6**. Exactly 0.6 is `false`.
- `source` is `llm` (the AI) or `rule-based` (the backup rules below).
- If the receipt cannot be read (no words, or only blank space): still `200 OK`, with `category` "Other", `confidence` 0.0, `source` "rule-based", `needsReview` true and `message` "We couldn't read this receipt. Please choose a category." In every other case `message` is `null`.

### Errors
An error is `{ "error": "<code>", "message": "<text>" }`. The text may change, the code will not.

| Status | `error` code | When |
|--------|--------------|------|
| 400 | `bad_input` | `receiptFile` is missing, is not a JPEG or PNG, or belongs to another claim |
| 404 | `receipt_not_found` | The file is not in Receipt storage |
| 404 | `feature_disabled` | The switch is off |
| 413 | `too_large` | The stored file is over 10 MB |
| 502 | `upstream_unavailable` | Document Intelligence (the reader) is down or takes over 1.5 seconds |

For example, when the reader is down: `HTTP 502  { "error": "upstream_unavailable", "message": "The text reader is unavailable." }`. (A reader that works but finds no words is a different case: it is the `200 OK` "cannot be read" answer in Outputs.)

### Side effects
Two log entries go to Application Insights as `customEvents`.

- **`categoriser.suggested`**, sent before the answer is returned: `suggestionId`, `claimId`, `category`, `confidence`, `source`, `needsReview`, `outcome` ("suggested" or "unreadable"), `durationMs`, `llmTokens` (0 if the AI was not used).
- **`categoriser.decided`**, sent when the person submits the claim: `suggestionId`, `claimId`, `suggestedCategory`, `finalCategory`, and `accepted` (true if the last two are the same).
- **Never in a log entry:** names, card numbers, receipt words, the picture or the file name.

### Rules
- **The switch** is the key `receipt-categoriser` in Azure App Configuration, checked on every call. When it is off, the call returns 404 `feature_disabled` and calls no outside service.
- **Order of checks:** the switch, then the input (400), then storage (404), then the size (413), then the outside services.
- **AI problem:** if Azure OpenAI gives an error, takes over 2.0 seconds, or gives an answer we can't use (a category that is not one of the five, or a confidence outside 0.0 to 1.0), use the backup rules. The call still returns 200.
- **Time:** the whole call takes under 4 seconds for 95 out of 100 calls.
- **Data boundary:** receipt words are sent only to Azure OpenAI and Azure AI Document Intelligence, and both are resources inside the BISTEC Azure tenant. Public OpenAI is not used.
- **Backup rules:** the brief only says the backup must be rule-based with a confidence of 0.5 or less. The words and scores below are **our own proposal** (open question 9). Look for these whole words in the receipt words, ignoring capitals.

| Category | Words |
|----------|-------|
| Meals | restaurant, cafe, lunch, dinner, breakfast, meal, pizza, burger, coffee |
| Travel | taxi, uber, pickme, fuel, petrol, diesel, toll, parking, flight, bus, train |
| Lodging | hotel, hostel, lodge, room, night, stay |
| Office Supplies | stationery, paper, pen, pencil, printer, toner, ink, folder |

Count the **different** listed words for each category (a word counts once). The highest count wins. 2 or more words: confidence 0.5. One word: 0.4. No words, or a tie: "Other" with 0.2.

## 4. Acceptance criteria

See `Thevinu-day5-receipt-categoriser-acceptance.md`. There are 6 (AC-01 to AC-06).

**How every requirement in the brief is checked.** Not every requirement needs its own criterion. This table says where each one is checked.

| Requirement from the brief | How it is checked |
|----------------------------|-------------------|
| Suggests one of the five categories, with a confidence | AC-01 |
| Below 0.6 is "Needs review" | AC-02, and the extra test for the exact 0.6 edge |
| The person can accept or change the suggestion, and the final choice is logged | Extra test "final choice is logged" (accepted, and changed) |
| A receipt that can't be read gives "Other" and a clear message | AC-04 |
| Reader (Document Intelligence) down gives 502 | Extra test "reading service unavailable" |
| Every suggestion is logged | AC-01 and AC-06 |
| Under 4 seconds for 95 out of 100 calls | **Two checks.** (1) An extra test with fake services, "p95 under 4 seconds with fake services": 50 calls at once, the fake reader takes 1.4 seconds and the fake AI never answers (the slowest allowed path). The p95 (the time that 95 out of 100 calls beat) must be under 4 seconds. This shows our own time limits add up. (2) Before release, the same 50-call test on the **real** services, because a fake test can't measure real speed. The log entry is a separate limit: within 5 seconds. |
| Keeps working when the AI has a short outage | AC-03, and the extra tests for a slow AI and an unusable AI answer |
| No personal details in the logs | AC-06 |
| Personal details must not leave the BISTEC Azure tenant | **Not a unit test.** The "Data boundary" rule in Section 3, checked before release: (1) the resource list shows the AI and the reader are inside the BISTEC tenant; (2) the Categoriser's settings point only to those two resources; (3) public OpenAI is not set up anywhere. |
| No more than LKR 5 per suggestion | **Not checked in code.** We log `llmTokens` and Finance works out the cost each month (open question 5). |
| The feature can be turned off without a deploy | Extra test "switch off" |

## 5. Examples

**Happy:** the receipt says "Green Leaf Restaurant, Lunch for 2, Total LKR 2,400". The AI says Meals, 0.86.

```json
{ "category": "Meals", "confidence": 0.86, "source": "llm", "needsReview": false, "message": null }
```

**Not clear:** the receipt has a restaurant meal and a box of pens. The AI says Other, 0.45.

```json
{ "category": "Other", "confidence": 0.45, "source": "llm", "needsReview": true, "message": null }
```

**Error:** `receiptFile` points to a 15 MB file.

```json
HTTP 413  { "error": "too_large", "message": "Receipt is larger than 10 MB." }
```

**AI is down:** Azure OpenAI answers 503. The receipt says "City Taxi, Highway Toll, Total LKR 1,800".

```json
{ "category": "Travel", "confidence": 0.5, "source": "rule-based", "needsReview": true, "message": null }
```

## 6. Out of scope

1. Several receipts in one call (batch upload).
2. Submitting a claim without the person confirming the category.
3. Learning from the changes people make. Version 1 only logs them.
4. Receipts in Sinhala or Tamil. Version 1 is English only.
5. Filling in the amount or date from the receipt.
6. Connecting to the real Azure services. The first version is tested with fake ones.

## 7. Open questions

1. **The 0.6 line.** What should the "Needs review" line be? We start at 0.6. Finance must confirm it once we see real data.
2. **Learn from changes (active learning) in version 1?** We suggest only logging them.
3. **Where is the final choice recorded?** We suggest the existing submit step sends the "decided" entry. The owner of the Claims API must confirm.
4. **Does it fit in 4 seconds?** The 1.5 and 2.0 second limits are guesses. We must measure the real services.
5. **Cost.** How do we check the LKR 5 limit for each suggestion? We suggest logging `llmTokens` so Finance can work it out.
6. **Automatic or a button?** The brief doesn't say when the suggestion is asked for. We assume the app asks by itself after each upload.
7. **Starting figure.** How often is the category wrong today? Without it, the 70% target is a guess.
8. **A failed log.** If sending a log entry fails, should the person still get the suggestion? We suggest yes.
9. **The backup rules.** The brief gives no word list or scores. Are our words and scores (Section 3, Rules) acceptable to the business?
10. **What does 10 MB mean?** We use 10,000,000 bytes, as the brief says 10 MB. Does the business mean 10 MiB (10,485,760 bytes) instead?
# Receipt Categoriser — Acceptance Criteria

**Author:** Thevinu · **Status:** Draft · **Spec:** `Thevinu-day5-receipt-categoriser-spec.md` v0.9

Each criterion is one story. **Given** is the starting situation. **When** is the one thing that happens. **Then** is what we must see from the outside: the answer, or the log entry.

## AC-01 happy path: clear meal receipt
**Given** the switch is on, and a stored JPEG receipt for claim 1042 that is a restaurant lunch bill of LKR 2,400, and the AI says Meals with confidence 0.86
**When** the app calls `POST /claims/1042/receipts/categorise` with that file
**Then** the answer is 200 OK with `category` "Meals", `confidence` 0.86, `source` "llm" and `needsReview` false
**And** a `categoriser.suggested` log entry with the same category, confidence and source is sent within 5 seconds

## AC-02 ambiguous receipt
**Given** a stored receipt with both a restaurant meal and a box of pens, and the AI says Other with confidence 0.45
**When** the app makes the categorise call
**Then** the answer is 200 OK with `category` "Other", `confidence` 0.45 and `needsReview` true

## AC-03 AI unavailable: backup rules
**Given** the AI is answering 503, and a stored receipt can be read
**When** the app makes the categorise call
**Then** the answer is 200 OK with `source` "rule-based" and `confidence` 0.5 or less
**And** the `category` is one of the five categories and `needsReview` is true

## AC-04 receipt cannot be read
**Given** a stored image where the reader works but finds no words (a reader that is down is a different case, answered with 502)
**When** the app makes the categorise call
**Then** the answer is 200 OK with `category` "Other", `confidence` 0.0, `source` "rule-based", `needsReview` true and `message` "We couldn't read this receipt. Please choose a category."
**And** the `categoriser.suggested` log entry has `outcome` "unreadable"

## AC-05 file too big
**Given** a stored file of 10,000,001 bytes (one byte over the limit of 10 MB = 10,000,000 bytes)
**When** the app makes the categorise call
**Then** the answer is 413 with `error` "too_large"

## AC-06 privacy: no personal details in the log
**Given** a receipt that says "Nimal Perera" and "Card ending 4242"
**When** the app makes the categorise call
**Then** the `categoriser.suggested` log entry holds no receipt words, no name, no card digits and no file name
**And** it holds only these fields: `suggestionId`, `claimId`, `category`, `confidence`, `source`, `needsReview`, `outcome`, `durationMs`, `llmTokens`
