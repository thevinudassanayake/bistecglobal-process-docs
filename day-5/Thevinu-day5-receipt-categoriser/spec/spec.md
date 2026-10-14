# Receipt Categoriser — Feature Spec v0.3

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
- The file is JPEG or PNG, at most 10 MB (10,485,760 bytes). "JPEG or PNG" is decided by the file ending (`.jpg`, `.jpeg` or `.png`, ignoring capitals). Version 1 does not look inside the file.
- A file belongs to claim 1042 when its path starts with `claim-1042/`.

### Outputs
`200 OK` with:

```json
{
  "suggestionId": "a UUID",
  "category": "Meals | Travel | Lodging | Office Supplies | Other",
  "confidence": 0.84,
  "source": "llm | rule-based",
  "needsReview": false,
  "message": null
}
```

- `confidence` is a number from 0.0 to 1.0, rounded to two decimals.
- `needsReview` is `true` when `confidence` is **below 0.6**. At exactly 0.6 it is `false`.
- `message` is `null`, except when the receipt cannot be read (see below).

**Receipt cannot be read** (Document Intelligence returns no text, or only blank text): still `200 OK`, with `category` "Other", `confidence` 0.0, `source` "rule-based", `needsReview` true, and `message` "We couldn't read this receipt. Please choose a category."

### Errors
All errors return `{ "error": "<code>", "message": "<text>" }`. The `message` wording is for people and may change. Tests check the `error` code.

| Status | `error` code | When |
|--------|--------------|------|
| 400 | `bad_input` | `receiptFile` is missing, is not JPEG or PNG, or does not belong to this claim |
| 404 | `receipt_not_found` | The file does not exist in Receipt storage |
| 404 | `feature_disabled` | The feature switch is off |
| 413 | `too_large` | The stored file is over 10 MB |
| 502 | `upstream_unavailable` | Document Intelligence (the text reader) is down |

Checks run in this order: the feature switch, then the input (400), then the storage lookup (404), then the size (413), then the outside services.

### Rules when the AI service has a problem
- If Azure OpenAI fails (error such as 503) or takes **longer than 2.0 seconds**, use the **rule-based fallback** below. The call still returns 200.
- If Azure OpenAI answers with a category that is not one of the five, or a confidence outside 0.0 to 1.0, treat it as a failure and use the rule-based fallback.
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

The category with the most **different** listed words wins. A word counts once, however many times it appears. Two or more matches gives confidence **0.5**. One match gives **0.4**. No match, or a tie, gives "Other" with confidence **0.2**. The source is `rule-based`.

### Side effects
Both events go to Application Insights as `customEvents`.

- **`categoriser.suggested`**, sent before the response is returned: `suggestionId`, `claimId`, `category`, `confidence`, `source`, `needsReview`, `outcome` ("suggested" or "unreadable"), `durationMs`, `llmTokens` (0 when the AI was not used).
- **`categoriser.decided`**, sent when the claimant submits the claim. The submit step passes in `suggestionId`, `claimId`, `suggestedCategory` and `finalCategory`; `accepted` is worked out from the last two. The event holds: `suggestionId`, `claimId`, `suggestedCategory`, `finalCategory`, `accepted` (true when both are the same).
- **Never in an event:** names, card numbers, receipt text, the image, or the file name.

### The feature switch
The Azure App Configuration key is `receipt-categoriser`. It is read on every call. When it is off, the call returns 404 `feature_disabled` and calls no outside service.

## 4. Acceptance criteria

See `Thevinu-day5-receipt-categoriser-acceptance.md`. There are 13, AC-01 to AC-13.

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

## Changes from v0.1

Made after the first AI session listed its questions about the spec (see `ai-session/response-1.md`):

1. Defined what "belongs to this claim" means (the path prefix).
2. Said that the file type is decided by the file ending, not the contents.
3. Gave the order in which the checks run.
4. Added a rule for an AI answer we cannot use, with AC-13.
5. Said that `confidence` is rounded to two decimals, that `suggestionId` is a UUID, and that tests check the `error` code, not the message wording.

### Changes from v0.2

Made after the second AI session. They describe what the tested code does, so here the spec caught up with the code:

1. "Most matching words" now means the most different listed words.
2. "Cannot be read" now means no text or only blank text.
3. Said what the submit step passes to the `categoriser.decided` event.
