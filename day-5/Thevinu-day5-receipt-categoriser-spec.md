# Receipt Categoriser — Feature Spec v0.5

**Author:** Thevinu · **Status:** Draft · **Date:** 2026-10-15 · **For:** GreenChit (Day 4 design pack)

*The rules and numbers are the same as v0.3. Later versions only changed the wording and cut the acceptance criteria to six.*

## 1. Why

Today the person making a claim picks the category (Meals, Travel and so on) by hand for every receipt. This is slow. When they pick the wrong one, Finance has to fix the claim later.

The Receipt Categoriser reads the receipt and suggests a category. Most of the time the person only has to say "yes".

**How we will know it works (proposed):** at least 70 out of 100 suggestions are accepted without a change. We count this from the "decided" log entries in Section 3. We don't know today's starting figure, so 70 is a guess (see open question 8).

## 2. Scope

**In scope**
1. One new call: "suggest a category for this receipt". The receipt is already uploaded.
2. Logging each suggestion, and what the person finally chose.
3. A switch that turns the feature off without a new release.

**What it touches (from the Day 4 diagrams)**
- **Claims API:** a new part inside it, called "Categoriser".
- **Receipt storage:** read only. The Categoriser reads the receipt from storage. The picture is never sent through the API (ADR 0004).
- **New outside services:** Azure AI Document Intelligence (reads the words on the receipt), Azure OpenAI (suggests the category), Azure App Configuration (holds the switch) and Application Insights (keeps the logs).
- **Web app:** shows the suggestion and the "Needs review" label. The screen design is a separate ticket.

**Not touched:** the Claims database (a claim already has a category field), the Message queue, the Notification worker and the Export job.

## 3. Contract (what goes in and what comes out)

### Inputs (what the app sends)
The app sends `POST /claims/{claimId}/receipts/categorise` with the name of the receipt file:

```json
{ "receiptFile": "claim-1042/taxi.jpg" }
```

Rules:
- The person is signed in, owns that claim, and the claim is still a Draft. The existing Auth part checks this.
- The file was already uploaded with the signed link and passed the virus check (ADR 0004).
- The file must be a JPEG or PNG, and at most 10 MB (10,485,760 bytes). We decide the type by the end of the file name: `.jpg`, `.jpeg` or `.png`, capital letters don't matter. We don't open the file to check.
- A file belongs to claim 1042 if its path starts with `claim-1042/`.

### Outputs (what comes back when it works)
Status `200 OK` with:

```json
{
  "suggestionId": "a UUID (a long unique code)",
  "category": "Meals | Travel | Lodging | Office Supplies | Other",
  "confidence": 0.84,
  "source": "llm | rule-based",
  "needsReview": false,
  "message": null
}
```

- `confidence` is how sure the system is. It is a number from 0.0 to 1.0, rounded to 2 decimals.
- `needsReview` is `true` when `confidence` is **below 0.6**. Exactly 0.6 is not below, so it is `false`.
- `source` says who made the suggestion: `llm` (the AI) or `rule-based` (the backup rules).
- `message` is `null`, except when the receipt cannot be read.

**If the receipt cannot be read** (no words are found, or only blank space): still `200 OK`, with `category` "Other", `confidence` 0.0, `source` "rule-based", `needsReview` true, and `message` "We couldn't read this receipt. Please choose a category."

### Errors (what comes back when it fails)
An error looks like `{ "error": "<code>", "message": "<text>" }`. The message text is for people and may change. Tests check the code.

| Status | `error` code | When |
|--------|--------------|------|
| 400 | `bad_input` | `receiptFile` is missing, is not a JPEG or PNG, or belongs to another claim |
| 404 | `receipt_not_found` | The file is not in Receipt storage |
| 404 | `feature_disabled` | The switch is off |
| 413 | `too_large` | The stored file is over 10 MB |
| 502 | `upstream_unavailable` | The service that reads the words (Document Intelligence) is down |

The checks run in this order: the switch, then the input (400), then storage (404), then the size (413), then the outside services.

### If the AI has a problem
- If Azure OpenAI gives an error (such as 503) or takes **more than 2.0 seconds**, use the **backup rules** below. The call still returns 200.
- If Azure OpenAI gives an answer we can't use (a category that is not one of the five, or a confidence outside 0.0 to 1.0), treat it as a failure and use the backup rules.
- Document Intelligence may take up to **1.5 seconds**. If it fails or is slower, return 502.
- The whole call should take **under 4 seconds for 95 out of 100 calls**.

### The backup rules
Look for these whole words in the receipt words, ignoring capital letters:

| Category | Words |
|----------|-------|
| Meals | restaurant, cafe, lunch, dinner, breakfast, meal, pizza, burger, coffee |
| Travel | taxi, uber, pickme, fuel, petrol, diesel, toll, parking, flight, bus, train |
| Lodging | hotel, hostel, lodge, room, night, stay |
| Office Supplies | stationery, paper, pen, pencil, printer, toner, ink, folder |

For each category, count how many **different** listed words appear. A word counts once, however many times it appears. The category with the highest count wins.

- 2 or more words: confidence **0.5**.
- 1 word: confidence **0.4**.
- No words, or a tie: category "Other", confidence **0.2**.

The `source` is `rule-based`.

### Side effects (what else happens: the log entries)
Two log entries are sent to Application Insights.

- **"suggested"** (`categoriser.suggested`), sent before the answer goes back. It holds: `suggestionId`, `claimId`, `category`, `confidence`, `source`, `needsReview`, `outcome` ("suggested" or "unreadable"), `durationMs` (how long the call took) and `llmTokens` (how much AI was used, 0 if the AI was not used).
- **"decided"** (`categoriser.decided`), sent when the person submits the claim. The submit step passes in four things: `suggestionId`, `claimId`, `suggestedCategory` and `finalCategory`. The entry holds those four plus `accepted`, which is true when the last two are the same.
- **Never in a log entry:** names, card numbers, the receipt words, the picture, or the file name.

### The switch
The switch is the key `receipt-categoriser` in Azure App Configuration. It is checked on every call. When it is off, the call returns 404 `feature_disabled` and calls no outside service.

## 4. Acceptance criteria

See `Thevinu-day5-receipt-categoriser-acceptance.md`. There are 6 (AC-01 to AC-06). They cover the main cases.

The other rules in this spec are **not** written as criteria, but the code still checks them with extra tests: the exact 0.6 edge, the 2 second AI limit, the reading service being down, bad input, the switch being off, the final-choice log, and an AI answer we can't use.

## 5. Examples

**Example 1: a clear meal (happy path)**
The receipt says "Green Leaf Restaurant, Lunch for 2, Total LKR 2,400". The AI says Meals, 0.86.

```json
{ "category": "Meals", "confidence": 0.86, "source": "llm", "needsReview": false, "message": null }
```

**Example 2: a mixed receipt (not clear)**
The receipt has a restaurant meal and a box of pens. The AI says Other, 0.45.

```json
{ "category": "Other", "confidence": 0.45, "source": "llm", "needsReview": true, "message": null }
```

**Example 3: file too big (error)**
`receiptFile` points to a 15 MB file.

```json
HTTP 413  { "error": "too_large", "message": "Receipt is larger than 10 MB." }
```

**Example 4: AI is down (backup rules)**
Azure OpenAI answers 503. The receipt says "City Taxi, Highway Toll, Total LKR 1,800".

```json
{ "category": "Travel", "confidence": 0.5, "source": "rule-based", "needsReview": true, "message": null }
```

## 6. Out of scope

1. Several receipts in one call.
2. Submitting a claim without the person confirming the category.
3. Learning from changes people make. Version 1 only logs them.
4. Receipts in Sinhala or Tamil. Version 1 is English only.
5. Filling in the amount or date from the receipt.
6. Changing the list of five categories.
7. The design of the Web app screen.
8. Connecting to the real Azure services. The first version is tested with fake ones.

## 7. Open questions

1. **The 0.6 line.** The brief says "below 0.6 is Needs review" and also asks what the line should be. We start with 0.6. Finance must confirm it once we see real data.
2. **Where do we record the final choice?** We suggest the existing submit step sends the "decided" log entry. The owner of the Claims API must confirm this, and the entry's name.
3. **Does it fit in 4 seconds?** The 1.5 and 2.0 second limits are guesses. We must measure the real services.
4. **Should we learn from changes in version 1?** We suggest only logging them.
5. **Cost.** How do we check the LKR 5 limit for each suggestion? We suggest logging `llmTokens` so Finance can work it out. The price must be confirmed.
6. **AI problem.** Should we try the AI once more before using the backup rules? We suggest no, to protect the 4 second limit.
7. **Log details.** Is it fine that the file name is not logged, even though it would help support?
8. **Starting figure.** How many claims does Finance change today? Without it, the 70% target is a guess.
9. **A failed log.** If sending a log entry fails, should the person still get the suggestion? We suggest yes.

## Change history

- **v0.1 to v0.2** (after the first AI session asked questions): said what "belongs to this claim" means, that the file type comes from the file name, the order of the checks, what to do with an AI answer we can't use, the rounding, and that tests check the error code.
- **v0.2 to v0.3** (after the second AI session): "most matching words" now means the most different words, "cannot be read" now means no words or only blank space, and what the submit step passes to the "decided" entry. These describe what the tested code already did, so here the spec caught up with the code.
- **v0.3 to v0.4:** plainer wording only. No rule or number changed.
- **v0.4 to v0.5:** cut the acceptance criteria from 13 to the six main ones. No rule changed. The other seven are now extra tests in the code.
