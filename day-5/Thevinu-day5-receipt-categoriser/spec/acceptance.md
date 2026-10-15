# Receipt Categoriser — Acceptance Criteria

**Author:** Thevinu · **Status:** Draft · **Spec:** `Thevinu-day5-receipt-categoriser-spec.md` v0.5

Each criterion is a short story: **Given** (the starting situation), **When** (what happens), **Then** (what we must see). You can check each one from the outside, by the answer that comes back or by the log entries that were sent.

There are six. Together they cover the happy path, an unclear case, the AI being down, an unreadable receipt, a file that is too big, and privacy.

## AC-01 Happy path: a clear meal receipt
**Given** the switch is on, and a stored JPEG receipt for claim 1042 that is a restaurant lunch bill of LKR 2,400, and the AI says Meals with confidence 0.86
**When** the person calls `POST /claims/1042/receipts/categorise` with that file
**Then** the answer is 200 OK with `category` "Meals", `confidence` 0.86, `source` "llm" and `needsReview` false
**And** a "suggested" log entry was sent with the same category, confidence and source

## AC-02 Not clear: a mixed receipt
**Given** a stored receipt with both a restaurant meal and a box of pens, and the AI says Other with confidence 0.45
**When** the person makes the categorise call
**Then** the answer is 200 OK with `category` "Other", `confidence` 0.45 and `needsReview` true

## AC-03 The AI is down: use the backup rules
**Given** the AI is answering 503, and the receipt words include "taxi" and "toll"
**When** the person makes the categorise call
**Then** the answer is 200 OK with `category` "Travel", `confidence` 0.5, `source` "rule-based" and `needsReview` true
**And** if the receipt has none of the listed words, the `category` is "Other" and the `confidence` is 0.2

## AC-04 The receipt cannot be read
**Given** a stored image where the reading service finds no words
**When** the person makes the categorise call
**Then** the answer is 200 OK with `category` "Other", `confidence` 0.0, `source` "rule-based", `needsReview` true and `message` "We couldn't read this receipt. Please choose a category."
**And** the AI was not called, and the log entry has `outcome` "unreadable"

## AC-05 The file is too big
**Given** a stored file of 10,485,761 bytes (one byte over 10 MB)
**When** the person makes the categorise call
**Then** the answer is 413 with `error` "too_large"
**And** neither the reading service nor the AI was called

## AC-06 Privacy: no personal details in the log
**Given** a receipt that says "Nimal Perera" and "Card ending 4242"
**When** the person makes the categorise call
**Then** the "suggested" log entry holds no receipt words, no name, no card digits and no file name
**And** it holds only the fields listed in the spec
