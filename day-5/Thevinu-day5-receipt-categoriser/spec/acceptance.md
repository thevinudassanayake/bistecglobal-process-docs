# Receipt Categoriser — Acceptance Criteria

**Author:** Thevinu · **Status:** Draft · **Spec:** `Thevinu-day5-receipt-categoriser-spec.md` v0.3

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

## AC-13 AI service gives an answer we cannot use
**Given** Azure OpenAI answers with the category "Groceries", or with confidence 1.4
**When** the claimant calls the categorise endpoint
**Then** the response is 200 OK with `source` "rule-based"
**And** the `category` is one of the five categories and `confidence` is 0.5 or less
