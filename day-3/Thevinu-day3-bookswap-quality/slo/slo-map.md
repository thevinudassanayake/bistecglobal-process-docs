# BookSwap — SLI/SLO Map

**Author:** Thevinu · **Status:** Draft · **Scenario:** BookSwap grows to 200 buildings. A Sunday newspaper article brings 10 times the normal traffic for 4 hours.

## How to read this

- **SLI** is what we measure. **SLO** is the target. **Error budget** is what we may miss. A 99% target leaves a budget of 1%, which is 1 miss in 100.
- **Window** is the period we count over. "Rolling 28 days" means always the last 28 days.
- A caller's mistake (a `4xx` reply) is not counted. A server failure (`5xx`) or a timeout is counted.
- The Sunday spike is inside the 28 days.
- Nothing is built yet. These are targets, not measurements.

## 1. NFR inventory

| # | NFR (source) | What the member sees |
|---|--------------|----------------------|
| N1 | Search under 300 ms at p95, for a building of up to 5,000 books (Day 2) | Search feels instant. |
| N2 | 99% of searches under 800 ms over 28 days, even at 10× traffic and with Redis empty or down (Day 3) | Search never gets stuck. |
| N3 | Listing succeeds 99.9% of the time, even during the spike and if email is down (Day 2, Day 3) | Listing a book works. |
| N4 | A repeated listing request never makes a second listing (Day 3) | One tap gives one book. |
| N5 | Photo uploads up to 5 MB, JPEG or PNG (Day 2) | My photo uploads. |
| N6 | Photos are never stored in the application database (Day 2) | Not visible. It keeps the system fast. |
| N7 | In-app notifications arrive within 2 seconds (Day 2) | The owner sees my request at once. |
| N8 | The email digest is best-effort (Day 2) | The weekly email may be a little late. |
| N9 | No address or phone number is returned, and nobody sees another member's loan history (Day 2, Day 3) | My private details stay private. |
| N10 | Every endpoint except `/health` needs a valid JWT (Day 3) | Only signed-in members get in. |
| N11 | Tokens expire within 1 hour (Day 3) | A stolen token stops working soon. |
| N12 | A complete outage of the listings endpoint (`/books`) pages the on-call engineer within 3 minutes (Day 3) | Someone starts fixing it fast. |
| N13 | Every login failure and every loan creation or return is logged with a request ID and member ID (Day 3) | Not visible. It lets us investigate. |

## 2. SLI / SLO table

S1 measures N1, S2 measures N2, and so on. Section 5 shows how to measure each one.

| # | SLI (what we measure) | Measurement source | SLO target | Window | Error budget |
|---|-----------------------|--------------------|-----------:|--------|--------------|
| S1 | Of all searches (`GET /books`), the share that succeeded in under 300 ms | Application Insights `requests` | 95% | Rolling 28 days | 5 in 100 |
| S2 | Of all searches, the share that succeeded in under 800 ms, spike included. Search does not use Redis, so an empty or broken Redis does not change it. | `requests` | 99% | Rolling 28 days | 1 in 100 |
| S3 | Of all listing requests (`POST /books`), the share that succeeded, even in the spike or an email outage | `requests` | 99.9% | Rolling 28 days | 1 in 1,000 (about 40 minutes of total failure) |
| S4 | The number of times one `Idempotency-Key` created more than one listing | `traces` | 0 | Rolling 28 days | None |
| S5 | Of valid photo uploads, the share that returned `200` | `requests` | 99% | Rolling 28 days | 1 in 100 |
| S6 | The number of photo or binary columns in the database | Database check | 0 | Every release, and weekly | None |
| S7 | Of test notifications (a robot sends one every 5 minutes), the share the owner could read within 2 seconds | `traces` | 99% | Rolling 28 days | 1 in 100 |
| S8 | Of digest emails queued, the share sent within 24 hours | `traces` | 95% | Rolling 28 days | 5 in 100 |
| S9 | The number of replies containing an address, a phone number, or another member's loan history | Release test and a daily robot, in `traces` | 0 | Every release, and daily | None |
| S10 | The number of success replies (outside `/health`) with no signed-in member | `requests` | 0 | Rolling 28 days | None |
| S11 | Of accepted tokens, the share that last 3,600 seconds or less | `traces` | 100% | Rolling 28 days | None |
| S12 | Minutes from the start of a `/books` outage until the page reaches the on-call engineer | Alert history, in a monthly drill | 3 minutes or less | Monthly drill, and every outage | None |
| S13 | Of loan creations and returns in the database, the share with an audit log line that has a request ID and a member ID | Database compared with `traces` | 99.9% | Rolling 28 days | 1 in 1,000 |

**Why these targets**
- Search has two targets because they catch different problems. S1 keeps it feeling fast. S2 keeps almost everything usable on the worst day.
- Listing is the strictest (99.9%) because without it the app is useless. Photos and the weekly email can miss a little.
- Leaks, duplicates and missing logins have a budget of **zero**, because they are defects.

## 3. Error budget policy

| When | What stops |
|------|------------|
| **Half of a budget is used** | No risky changes (database changes, library upgrades). |
| **A budget is used up** | **Feature work stops.** Only fixes and rollbacks ship, until the cause is fixed and 25% of the budget is back. |
| **A zero budget is broken** (S4, S6, S9, S10, S11) | It is an incident. Nothing ships until it is fixed. |
| **Friday 18:00 before the spike** | Only fixes ship until the spike is over. |

The engineering lead declares and lifts a freeze. The on-call engineer can roll back a release at any time.

## 4. Out of budget right now

I would bet we cannot meet S3 and S4 today, because Day 2 has no idempotency key (so one repeated request makes a second listing), there is one database, and nobody has load-tested 10× traffic.

## 5. How each one is measured

All queries are for Application Insights.

**S1, S2, S3, S5.** Use this query and change the two parts in the table.

```kusto
requests
| where timestamp > ago(28d)
| where name == "<ROUTE>"
| where resultCode !startswith "4"
| summarize good = countif(<GOOD>), total = count()
| extend sli = 100.0 * good / total
```

| SLI | `<ROUTE>` | `<GOOD>` |
|-----|-----------|----------|
| S1 | `GET /books` | `resultCode startswith "2" and duration < 300` |
| S2 | `GET /books` | `resultCode startswith "2" and duration < 800` |
| S3 | `POST /books` | `resultCode startswith "2"` |
| S5 | `PUT /books/:bookId/photo` | `resultCode == "200"` |

**S4: duplicate listings.** The answer must be no rows.

```kusto
traces
| where timestamp > ago(28d)
| where tostring(customDimensions.event) == "listing.created"
| summarize creations = count() by key = tostring(customDimensions.idempotencyKey)
| where creations > 1
```

**S6: photo columns.** Run in the database. The answer must be 0.

```sql
SELECT COUNT(*) AS binary_columns
FROM INFORMATION_SCHEMA.COLUMNS
WHERE DATA_TYPE IN ('image', 'varbinary', 'binary');
```

**S7: notification speed.** A robot makes a test borrow request and logs how many milliseconds passed until the owner could read the notification.

```kusto
traces
| where timestamp > ago(28d)
| where tostring(customDimensions.event) == "probe.notification"
| summarize good = countif(toint(customDimensions.delayMs) <= 2000), total = count()
| extend sli = 100.0 * good / total
```

**S8: digest emails sent within 24 hours**

```kusto
let queued = traces
    | where timestamp > ago(28d)
    | where tostring(customDimensions.event) == "digest.enqueued"
    | project messageId = tostring(customDimensions.messageId), queuedAt = timestamp;
let sent = traces
    | where timestamp > ago(28d)
    | where tostring(customDimensions.event) == "email.sent"
    | project messageId = tostring(customDimensions.messageId), sentAt = timestamp;
queued
| join kind=leftouter (sent) on messageId
| summarize good = countif(isnotnull(sentAt) and sentAt - queuedAt <= 24h), total = count()
| extend sli = 100.0 * good / total
```

**S9: leaks.** The release test and the daily robot log `fail` if a reply has an address, a phone number, or another member's loan history. The answer must be 0.

```kusto
traces
| where timestamp > ago(1d)
| where tostring(customDimensions.event) in ("probe.privacy", "probe.authz.loan_history")
| summarize violations = countif(tostring(customDimensions.result) == "fail")
```

**S10: success replies with no signed-in member.** The answer must be 0.

```kusto
requests
| where timestamp > ago(28d)
| where name !startswith "GET /health"
| where resultCode startswith "2"
| where isempty(tostring(customDimensions.memberId))
| count
```

**S11: token lifetime**

```kusto
traces
| where timestamp > ago(28d)
| where tostring(customDimensions.event) == "auth.ok"
| summarize good = countif(toint(customDimensions.tokenLifetimeSec) <= 3600), total = count()
| extend sli = 100.0 * good / total
```

**S12: drill.** Take the `/books` endpoint down in a test environment and time how long until the page arrives.

**S13: audit log.** Count the audit lines, then count the loan events in the database. The share is the first number divided by the second.

```kusto
traces
| where timestamp > ago(28d)
| where tostring(customDimensions.event) in ("loan.created", "loan.returned")
| where isnotempty(tostring(customDimensions.requestId)) and isnotempty(tostring(customDimensions.memberId))
| count
```

```sql
SELECT (SELECT COUNT(*) FROM loans WHERE created_at >= DATEADD(day, -28, SYSUTCDATETIME()))
     + (SELECT COUNT(*) FROM loans WHERE returned_at >= DATEADD(day, -28, SYSUTCDATETIME())) AS loan_events;
```

## 6. Assumptions

- The API names requests by route pattern (for example `GET /books/:bookId`) and writes the log fields used above. A failed login with no readable token logs `memberId` as `anonymous`. Audit events are never sampled.
- Search reads only the caller's own building (at most 5,000 books). This holds only if each book row carries its building and that column is indexed. Without the index, each search would read every book (up to 1,000,000 in the worst case), and S2 would be at risk.
- Day 2 has no `Idempotency-Key` header, no `/health` endpoint and no monitoring. S4, S10 and S12 depend on them. Day 2 also lets any member read a book's loan history, and S9 assumes only the owner may.
- The table and column names in the SQL (`loans`, `created_at`, `returned_at`) are examples.
