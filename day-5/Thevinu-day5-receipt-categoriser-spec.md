# Receipt Categoriser — Feature Spec v0.7

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
- The file is a JPEG or PNG, at most 10 MB (10,485,760 bytes). The type is decided by the file name ending (`.jpg`, `.jpeg`, `.png`, capital letters don't matter).
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
- **Backup rules:** look for these whole words in the receipt words, ignoring capitals.

| Category | Words |
|----------|-------|
| Meals | restaurant, cafe, lunch, dinner, breakfast, meal, pizza, burger, coffee |
| Travel | taxi, uber, pickme, fuel, petrol, diesel, toll, parking, flight, bus, train |
| Lodging | hotel, hostel, lodge, room, night, stay |
| Office Supplies | stationery, paper, pen, pencil, printer, toner, ink, folder |

Count the **different** listed words for each category (a word counts once). The highest count wins. 2 or more words: confidence 0.5. One word: 0.4. No words, or a tie: "Other" with 0.2.

## 4. Acceptance criteria

See `Thevinu-day5-receipt-categoriser-acceptance.md`. There are 6 (AC-01 to AC-06). The other rules above are checked by extra tests in the code.

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
