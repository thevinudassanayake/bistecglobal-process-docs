# Receipt Categoriser — Acceptance Criteria

**Author:** Thevinu · **Status:** Draft · **Spec:** `Thevinu-day5-receipt-categoriser-spec.md` v0.7

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
**Given** the AI is answering 503, and the receipt words include "taxi" and "toll"
**When** the app makes the categorise call
**Then** the answer is 200 OK with `category` "Travel", `confidence` 0.5, `source` "rule-based" and `needsReview` true

## AC-04 receipt cannot be read
**Given** a stored image where the reader finds no words
**When** the app makes the categorise call
**Then** the answer is 200 OK with `category` "Other", `confidence` 0.0, `source` "rule-based", `needsReview` true and `message` "We couldn't read this receipt. Please choose a category."
**And** the `categoriser.suggested` log entry has `outcome` "unreadable"

## AC-05 file too big
**Given** a stored file of 10,485,761 bytes (one byte over 10 MB)
**When** the app makes the categorise call
**Then** the answer is 413 with `error` "too_large"

## AC-06 privacy: no personal details in the log
**Given** a receipt that says "Nimal Perera" and "Card ending 4242"
**When** the app makes the categorise call
**Then** the `categoriser.suggested` log entry holds no receipt words, no name, no card digits and no file name
**And** it holds only the fields listed in the spec
