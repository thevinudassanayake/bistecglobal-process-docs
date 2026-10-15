# Receipt Categoriser — Acceptance Criteria

**Author:** Thevinu · **Status:** Draft · **Spec:** `Thevinu-day5-receipt-categoriser-spec.md` v0.4

Each criterion is a short story: **Given** (the starting situation), **When** (what happens), **Then** (what we must see). You can check each one from the outside, by the answer that comes back or by the log entries that were sent.

## AC-01 Happy path: a clear meal receipt
**Given** the switch is on, and a stored JPEG receipt for claim 1042 that is a restaurant lunch bill of LKR 2,400, and the AI says Meals with confidence 0.86
**When** the person calls `POST /claims/1042/receipts/categorise` with that file
**Then** the answer is 200 OK with `category` "Meals", `confidence` 0.86, `source` "llm" and `needsReview` false
**And** a "suggested" log entry was sent with the same category, confidence and source

## AC-02 Not clear: a mixed receipt
**Given** a stored receipt with both a restaurant meal and a box of pens, and the AI says Other with confidence 0.45
**When** the person makes the categorise call
**Then** the answer is 200 OK with `category` "Other", `confidence` 0.45 and `needsReview` true

## AC-03 The edge: exactly 0.6
**Given** the AI says Meals with confidence 0.60
**When** the person makes the categorise call
**Then** the answer has `needsReview` false
**And** if the confidence is 0.59 instead, the answer has `needsReview` true

## AC-04 The AI is down: use the backup rules
**Given** the AI is answering 503, and the receipt words include "taxi" and "toll"
**When** the person makes the categorise call
**Then** the answer is 200 OK with `category` "Travel", `confidence` 0.5, `source` "rule-based" and `needsReview` true
**And** if the receipt has none of the listed words, the `category` is "Other" and the `confidence` is 0.2

## AC-05 The AI is too slow: use the backup rules in time
**Given** the AI takes more than 2.0 seconds to answer
**When** the person makes the categorise call
**Then** the answer is 200 OK with `source` "rule-based"
**And** the whole call takes under 4 seconds

## AC-06 The receipt cannot be read
**Given** a stored image where the reading service finds no words
**When** the person makes the categorise call
**Then** the answer is 200 OK with `category` "Other", `confidence` 0.0, `source` "rule-based", `needsReview` true and `message` "We couldn't read this receipt. Please choose a category."
**And** the AI was not called, and the log entry has `outcome` "unreadable"

## AC-07 The reading service is down
**Given** the service that reads the words (Document Intelligence) is down
**When** the person makes the categorise call
**Then** the answer is 502 with `error` "upstream_unavailable"

## AC-08 The file is too big
**Given** a stored file of 10,485,761 bytes (one byte over 10 MB)
**When** the person makes the categorise call
**Then** the answer is 413 with `error` "too_large"
**And** neither the reading service nor the AI was called

## AC-09 Bad input
**Given** a request with no `receiptFile`, or a file name ending in `.gif`, or a file that belongs to a different claim
**When** the person makes the categorise call
**Then** the answer is 400 with `error` "bad_input"
**And** if the file is not in storage, the answer is 404 with `error` "receipt_not_found"

## AC-10 Privacy: no personal details in the log
**Given** a receipt that says "Nimal Perera" and "Card ending 4242"
**When** the person makes the categorise call
**Then** the "suggested" log entry holds no receipt words, no name, no card digits and no file name
**And** it holds only the fields listed in the spec

## AC-11 The switch is off
**Given** the switch `receipt-categoriser` is off
**When** the person makes the categorise call
**Then** the answer is 404 with `error` "feature_disabled"
**And** no outside service was called and no log entry was sent

## AC-12 The final choice is logged
**Given** a suggestion with `suggestionId` "s-1" and category "Meals"
**When** the claim is submitted with the final category "Meals"
**Then** a "decided" log entry is sent with `accepted` true
**And** if the final category is "Travel" instead, the entry has `accepted` false, `suggestedCategory` "Meals" and `finalCategory` "Travel"

## AC-13 The AI gives an answer we can't use
**Given** the AI answers with the category "Groceries", or with confidence 1.4
**When** the person makes the categorise call
**Then** the answer is 200 OK with `source` "rule-based"
**And** the `category` is one of the five categories and the `confidence` is 0.5 or less
