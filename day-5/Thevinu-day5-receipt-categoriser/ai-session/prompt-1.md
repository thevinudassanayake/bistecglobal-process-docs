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
- Run the tests with `node --test` and report the result.

Do now: AC-01, AC-02, AC-03, AC-08, AC-09. Do not write code for the other criteria yet.

# Receipt Categoriser — Feature Spec v0.1

**Author:** Thevinu · **Status:** Draft · **Date:** 2026-10-14 · **For:** GreenChit (Day 4 design pack)

## 1. Why

Today a claimant picks the expense category by hand for every receipt. It is slow, and a wrong category means Finance has to fix the claim later. The Receipt Categoriser reads the receipt and suggests a category, so the claimant usually only has to confirm it.

**Metric (proposed):** at least 70% of suggestions are accepted without a change, measured from the `categoriser.decided` events. We have no starting figure yet (see open question 8).

## 2. Scope

**In scope**
1. One new call that suggests a category for one receipt that is already uploaded.
2. Logging each suggestion, and the claimant's final choice.
3. A switch that turns the feature off without a new release.

**What it touches (from the Day 4 diagrams)**
- **Claims API:** a new component, "Categoriser", inside it.
- **Receipt storage:** read only. The categoriser reads the stored receipt. The picture is never sent through the API (ADR 0004).
- **New outside systems:** Azure AI Document Intelligence (reads the text), Azure OpenAI (suggests the category), Azure App Configuration (the switch) and Application Insights (the logs).
- **Web app:** shows the suggestion and the "Needs review" label. The screen design is a separate ticket.

**Not touched:** the Claims database (the claim already has a category field), the Message queue, the Notification worker, the Export job.

## 3. Contract

### Inputs
`POST /claims/{claimId}/receipts/categorise` with this body:

```json
{ "receiptFile": "claim-1042/taxi.jpg" }
```

- The caller is signed in and is the claimant of that claim, and the claim is a Draft. The existing Auth component checks this.
- The file was already uploaded with the signed link and passed the virus check (ADR 0004).
- The file is JPEG or PNG, at most 10 MB (10,485,760 bytes).

### Outputs
`200 OK` with:

```json
{
  "suggestionId": "a unique text id",
  "category": "Meals | Travel | Lodging | Office Supplies | Other",
  "confidence": 0.84,
  "source": "llm | rule-based",
  "needsReview": false,
  "message": null
}
```

- `confidence` is a number from 0.0 to 1.0 with two decimals.
- `needsReview` is `true` when `confidence` is **below 0.6**. At exactly 0.6 it is `false`.
- `message` is `null`, except when the receipt cannot be read (see below).

**Receipt cannot be read** (the text cannot be found or parsed): still `200 OK`, with `category` "Other", `confidence` 0.0, `source` "rule-based", `needsReview` true, and `message` "We couldn't read this receipt. Please choose a category."

### Errors
All errors return `{ "error": "<code>", "message": "<text>" }`.

| Status | `error` code | When |
|--------|--------------|------|
| 400 | `bad_input` | `receiptFile` is missing, is not JPEG or PNG, or does not belong to this claim |
| 404 | `receipt_not_found` | The file does not exist in Receipt storage |
| 404 | `feature_disabled` | The feature switch is off |
| 413 | `too_large` | The stored file is over 10 MB |
| 502 | `upstream_unavailable` | Document Intelligence (the text reader) is down |

### Rules when the AI service has a problem
- If Azure OpenAI fails (error such as 503) or takes **longer than 2.0 seconds**, use the **rule-based fallback** below. The call still returns 200.
- Document Intelligence may take up to **1.5 seconds**. If it fails or is slower, return 502.
- The whole call should finish in **under 4 seconds for 95 out of 100 requests**.

### Rule-based fallback
Look for these whole words in the receipt text, ignoring capitals:

| Category | Words |
|----------|-------|
| Meals | restaurant, cafe, lunch, dinner, breakfast, meal, pizza, burger, coffee |
| Travel | taxi, uber, pickme, fuel, petrol, diesel, toll, parking, flight, bus, train |
| Lodging | hotel, hostel, lodge, room, night, stay |
| Office Supplies | stationery, paper, pen, pencil, printer, toner, ink, folder |

The category with the most matching words wins. Two or more matches gives confidence **0.5**. One match gives **0.4**. No match, or a tie, gives "Other" with confidence **0.2**. The source is `rule-based`.

### Side effects
Both events go to Application Insights as `customEvents`.

- **`categoriser.suggested`**, sent before the response is returned: `suggestionId`, `claimId`, `category`, `confidence`, `source`, `needsReview`, `outcome` ("suggested" or "unreadable"), `durationMs`, `llmTokens` (0 when the AI was not used).
- **`categoriser.decided`**, sent when the claimant submits the claim: `suggestionId`, `claimId`, `suggestedCategory`, `finalCategory`, `accepted` (true when both are the same).
- **Never in an event:** names, card numbers, receipt text, the image, or the file name.

### The feature switch
The Azure App Configuration key is `receipt-categoriser`. It is read on every call. When it is off, the call returns 404 `feature_disabled` and calls no outside service.

## 4. Acceptance criteria

See `Thevinu-day5-receipt-categoriser-acceptance.md`. There are 12, AC-01 to AC-12.

## 5. Examples

**Example 1: clear meal (happy path)**
Receipt text: "Green Leaf Restaurant, Lunch for 2, Total LKR 2,400". The AI says Meals, 0.86.

```json
{ "category": "Meals", "confidence": 0.86, "source": "llm", "needsReview": false, "message": null }
```

**Example 2: mixed receipt (ambiguous)**
Receipt text has a restaurant meal and a box of pens. The AI says Other, 0.45.

```json
{ "category": "Other", "confidence": 0.45, "source": "llm", "needsReview": true, "message": null }
```

**Example 3: file too large (error)**
`receiptFile` points to a 15 MB file.

```json
HTTP 413  { "error": "too_large", "message": "Receipt is larger than 10 MB." }
```

**Example 4: AI service down (fallback)**
Azure OpenAI answers 503. Receipt text: "City Taxi, Highway Toll, Total LKR 1,800".

```json
{ "category": "Travel", "confidence": 0.5, "source": "rule-based", "needsReview": true, "message": null }
```

## 6. Out of scope

1. Several receipts in one call.
2. Submitting a claim without the claimant confirming the category.
3. Learning from overrides. Version 1 only logs them.
4. Receipts in Sinhala or Tamil. Version 1 is English only.
5. Filling in the amount or date from the receipt.
6. Changing the list of five categories.
7. The design of the Web app screen.
8. Connecting to the real Azure services. The first version is tested with stand-ins.

## 7. Open questions

1. **Threshold.** The brief says "below 0.6 is Needs review" and also asks what the threshold should be. We start with 0.6. Finance must confirm it once we see real data.
2. **Where is the final choice recorded?** We propose the existing submit step sends `categoriser.decided`. The owner of the Claims API must confirm this and the event name.
3. **Does it fit in 4 seconds?** The 1.5 s and 2.0 s limits are guesses. We need to measure the real services.
4. **Learn from overrides in version 1?** We propose only logging them.
5. **Cost.** How do we check the LKR 5 limit per suggestion? We propose logging `llmTokens` so Finance can work it out. The price per token must be confirmed.
6. **AI outage.** Should we try the AI once more before falling back? We propose no, to protect the 4 second limit.
7. **Event details.** Is it acceptable that no file name is logged, even though it would help support?
8. **Starting figure.** What share of claims are changed by Finance today? Without it the 70% target is a guess.
9. **A failed log.** If sending an event fails, should the claimant still get the suggestion? We propose yes.
# Receipt Categoriser — Acceptance Criteria

**Author:** Thevinu · **Status:** Draft · **Spec:** `Thevinu-day5-receipt-categoriser-spec.md` v0.1

Every criterion can be checked from outside the code: by the response, or by the events that were sent.

## AC-01 happy path: clear meal receipt
**Given** the feature switch is on, and a stored JPEG receipt for claim 1042 whose text is a restaurant lunch bill of LKR 2,400, and Azure OpenAI answers Meals with confidence 0.86
**When** the claimant calls `POST /claims/1042/receipts/categorise` with that file
**Then** the response is 200 OK with `category` "Meals", `confidence` 0.86, `source` "llm" and `needsReview` false
**And** a `categoriser.suggested` event has been sent with the same category, confidence and source

## AC-02 ambiguous receipt
**Given** a stored receipt whose text has both a restaurant meal and a box of pens, and Azure OpenAI answers Other with confidence 0.45
**When** the claimant calls the categorise endpoint
**Then** the response is 200 OK with `category` "Other", `confidence` 0.45 and `needsReview` true

## AC-03 boundary: exactly 0.6
**Given** Azure OpenAI answers Meals with confidence 0.60
**When** the claimant calls the categorise endpoint
**Then** the response has `needsReview` false
**And** with confidence 0.59 the response has `needsReview` true

## AC-04 AI service unavailable: fallback
**Given** Azure OpenAI is answering 503, and the receipt text contains the words "taxi" and "toll"
**When** the claimant calls the categorise endpoint
**Then** the response is 200 OK with `category` "Travel", `confidence` 0.5, `source` "rule-based" and `needsReview` true
**And** if the receipt text has no listed word, the `category` is "Other" and `confidence` is 0.2

## AC-05 AI service too slow: fallback inside the time limit
**Given** Azure OpenAI takes longer than 2.0 seconds to answer
**When** the claimant calls the categorise endpoint
**Then** the response is 200 OK with `source` "rule-based"
**And** the whole call finishes in under 4 seconds

## AC-06 receipt cannot be read
**Given** a stored image whose text Document Intelligence cannot find or parse
**When** the claimant calls the categorise endpoint
**Then** the response is 200 OK with `category` "Other", `confidence` 0.0, `source` "rule-based", `needsReview` true and `message` "We couldn't read this receipt. Please choose a category."
**And** Azure OpenAI was not called, and the event has `outcome` "unreadable"

## AC-07 text reader unavailable
**Given** Document Intelligence is down
**When** the claimant calls the categorise endpoint
**Then** the response is 502 with `error` "upstream_unavailable"

## AC-08 file too large
**Given** a stored file of 10,485,761 bytes
**When** the claimant calls the categorise endpoint
**Then** the response is 413 with `error` "too_large"
**And** neither Document Intelligence nor Azure OpenAI was called

## AC-09 bad input
**Given** a request with no `receiptFile`, or a file ending in `.gif`, or a file that belongs to a different claim
**When** the claimant calls the categorise endpoint
**Then** the response is 400 with `error` "bad_input"
**And** if the file does not exist in storage, the response is 404 with `error` "receipt_not_found"

## AC-10 privacy: no personal data in events
**Given** a receipt whose text contains the name "Nimal Perera" and "Card ending 4242"
**When** the claimant calls the categorise endpoint
**Then** the `categoriser.suggested` event contains no part of the receipt text, no name, no card digits and no file name
**And** it contains only the fields listed in the spec

## AC-11 feature switch off
**Given** the feature switch `receipt-categoriser` is off
**When** the claimant calls the categorise endpoint
**Then** the response is 404 with `error` "feature_disabled"
**And** no outside service was called and no event was sent

## AC-12 final choice is logged
**Given** a suggestion with `suggestionId` "s-1" and category "Meals"
**When** the claim is submitted with the final category "Meals"
**Then** a `categoriser.decided` event is sent with `accepted` true
**And** when the final category is "Travel" instead, the event has `accepted` false, `suggestedCategory` "Meals" and `finalCategory` "Travel"
