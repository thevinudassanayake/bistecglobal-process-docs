# BookSwap — Reliability Runbook v0.1

**Author:** Thevinu · **Status:** Draft · **Scenario:** BookSwap grows to 200 buildings. A Sunday newspaper article brings 10 times the normal traffic for 4 hours.

A runbook is the instruction sheet you open when something breaks. Every number here is a starting value for a system that is not built yet. A 10× load test must confirm them before the Friday freeze.

## 1. Settings used by all three failures

| Setting | Value | In plain words |
|---------|-------|----------------|
| Request deadline | 5 seconds | The API gives up on any request that takes longer. |
| **Timeout** | 1 second for database reads. 2 seconds for accepting a request or returning a loan. | If the database has not answered in time, stop waiting. |
| **Retry** | 3 tries in total, waiting 200 ms then 400 ms, plus up to 100 ms of random extra wait | Try again, waiting a little longer each time. The random wait stops thousands of phones retrying at the same moment. |
| What is retried | Only server errors (5xx), timeouts and network errors, and only reads or requests with an idempotency key | A caller's mistake (4xx) would fail every time, so it is never retried. |
| **Circuit breaker** | Opens after 5 failures in a row. Stays open 60 seconds for the database and 30 seconds for Redis. Then one test call. | Like a fuse. While it is open, the API stops calling the broken service and answers with an error at once. |
| **Idempotency key** | A random ID the app makes each time the member taps "List book". It is sent in an `Idempotency-Key` header and saved in the same database step as the listing. Kept for 24 hours. | If the same key arrives again, the API returns the first result and does not make a second listing. |

For one database read, the worst case is 3 × 1 s, plus 0.2 s and 0.4 s of waiting, plus up to 0.2 s of random wait. That is 3.8 seconds, inside the 5-second deadline.

## 2. Alerts used in this runbook

| ID | Alert | What fires it | Severity | Who is told |
|----|-------|---------------|----------|-------------|
| A1 | Books endpoint down | A test robot opens `GET /books` every minute from 3 places. 2 or more fail, twice in a row. (It uses `GET` because a test `POST` would create fake books. Write-only failures are caught by the listing alert in the observability plan.) | Sev1 | Pager and Teams |
| A2 | Database unreachable | Azure SQL metric `connection_failed` is above 5 in 2 minutes, or over half of database calls fail for 2 minutes | Sev1 | Pager and Teams |
| A3 | Redis down | Over 20% of Redis calls fail for 5 minutes, or the Redis metric `connectedclients` is below 1 for 5 minutes | Sev3 | Teams and a ticket |
| A4 | Too many server errors | Front Door metric `Percentage5XX` is above 1% (more than 1 in 100 replies) for 5 minutes | Sev2 | Pager and Teams |
| A5 | Servers overloaded | App Service metric `CpuPercentage` is above 85% for 10 minutes, or `HttpQueueLength` is above 100 for 5 minutes | Sev2 | Pager and Teams |
| A6 | Traffic spike started | Requests are more than 5 times the same time last week, for 10 minutes | Sev4 | Teams only |
| A7 | Emails stuck or late | Service Bus metric `ActiveMessages` is above 30,000 for 30 minutes, or `DeadletteredMessages` is above 0 | Sev3 | Teams and a ticket |

Sev1 and Sev2 page the on-call backend engineer first. If nobody acknowledges within 5 minutes, the engineering lead is paged.

## Failure 1: Azure SQL primary unavailable for 5 minutes

**In short:** after 5 failed calls the circuit breaker opens, so members get an error in under a second instead of a hang. Nothing is lost.

### What the user sees

- **Search, opening a book:** an error such as "We can't load books right now." It appears in about 1 second.
- **Listing a book:** "We couldn't save that yet." The app keeps what was typed and retries by itself with the same key, after 2, 4, 8, 16 and 30 seconds. It gives up after 2 minutes.
- **Emails already queued** keep being sent, because the queue does not need the database.

### Detection

**A2** (Azure SQL metric `connection_failed`) and **A1** (the `GET /books` test robot). A1 pages within about 3 minutes.

### Mitigation in design (timeouts, retries, circuit breaker, fallback)

1. **Timeout:** 1 second per read, so no request waits for the full 5 seconds. Without it, at 10× traffic every worker would be busy within seconds, even if the database is only slow.
2. **Retry:** 3 tries, waiting 200 ms and 400 ms.
3. **Circuit breaker:** after 5 failures in a row it opens for 60 seconds, and the API answers `503` with `Retry-After: 30` in milliseconds.
4. **Fallback:** a book opened in the last 60 seconds can still be read from Redis. Everything else shows the friendly error.
5. **Idempotency key:** the app retries the listing with the same key. If the database saved the first try just before it stopped, the repeat finds the key and returns that listing. Otherwise it creates the listing once.

### Manual response (who is paged, what they do)

1. The **on-call backend engineer** acknowledges within 5 minutes and opens the dashboard.
2. Check Azure Service Health for Azure SQL. If Azure reports an incident, wait and turn on the in-app banner.
3. If it lasts over 10 minutes, the **cloud engineer** opens a priority case with Microsoft. Day 2 has one database, so there is nothing to switch to.
4. **Do not restart the API copies.** They are healthy, and restarting only creates a rush of connections when the database returns.
5. After recovery, list one test book with a key and read it back.

### Post-incident actions

| Action | Owner |
|--------|-------|
| Write the timeline and cause, with no blame | On-call engineer |
| Add the `Idempotency-Key` header to `POST /books` in the OpenAPI file | API lead |

## Failure 2: Azure Cache for Redis is down

**In short:** members hardly notice. Search does not use Redis. Opening a book reads the database, so it is a little slower.

### What the user sees

- **Search, listing, borrowing:** no change.
- **Opening a book:** slightly slower, for example 40 ms from the database instead of 3 ms from Redis.

### Detection

**A3**, from the Redis call failures and the Azure metric `connectedclients`. It is a Sev3 ticket, because nothing is broken for members. Watch the database metric `cpu_percent`, because that is where the extra load goes.

### Mitigation in design (timeouts, retries, circuit breaker, fallback)

1. **Timeout:** 100 ms per Redis call (Redis normally answers in about 1 ms).
2. **No retry:** it would only add delay.
3. **Circuit breaker:** after 5 failures in a row it opens for 30 seconds, and the API stops waiting for Redis.
4. **Fallback:** read the database.
5. **The weekly digest builds each building's list once** and keeps it in memory. Otherwise 200 queries would become about 20,000 when Redis is down.
6. **Cache entries expire at a slightly random time** (60 seconds plus or minus 10), so when Redis returns empty, popular books do not all reload at once.

### Manual response (who is paged, what they do)

1. Nobody is woken up. The **on-call backend engineer** sees the ticket in working hours.
2. Check the Redis resource and Azure Service Health.
3. If the database `cpu_percent` stays above 70% for 5 minutes, ask the **cloud engineer** to scale the database up one size.
4. If Redis did not recover, restart it. It only holds copies, so an empty cache is fine.

### Post-incident actions

| Action | Owner |
|--------|-------|
| Run a 10× load test with Redis switched off. Search (S2) must still meet its target. | Cloud engineer |
| Add the random expiry and the one-list-per-building digest | API lead |

## Failure 3: Sunday tabloid spike — 10× sustained traffic

**In short:** we add servers before it starts, Azure adds more as the load rises, Front Door limits abusive clients, and emails wait on the queue.

### What the user sees

- **At the start:** a few seconds of slower replies while servers are added.
- **At the peak:** a few clients that send too many requests get `429` ("busy, try again soon"). The app retries by itself with the same key.
- **Emails** may arrive later.

### Detection

**A6** tells the team the spike has started (the Front Door metric `RequestCount`). **A4** pages if over 1% of replies are server errors. **A5** pages if the servers are overloaded. **A7** raises a ticket if the email queue grows past 30,000.

### Mitigation in design (autoscale, queue depth, throttling)

1. **Autoscale.** Normally 2 to 6 copies of the API. On Sunday from 08:00 to 16:00 (Colombo time) the minimum is 8, because new copies take minutes to start. During the spike, add 2 copies when CPU is above 60% for 3 minutes, then wait 3 minutes. The maximum is 20 copies.
2. **Queue depth.** Emails go on the Service Bus queue and are sent later. The email worker has its own plan and handles at most 10 messages at a time.
3. **Throttling.** Front Door lets each client address send up to 1,000 requests a minute, and up to 120 a minute of writes (`POST`, `PUT`, `PATCH`). Beyond that it answers `429` with `Retry-After`.
4. **Idempotency key.** If a listing times out or gets `429`, the app repeats it with the same key, so the member ends up with one listing.
5. **Timeouts and retries** are as in section 1. After `429` or `503` the app waits for `Retry-After` (at least 5 seconds), then 2, 4, 8, 16 and 30 seconds, each with up to 1 second of random extra wait, and gives up after 2 minutes.
6. **If the database nears its limit,** slow things down in this order: skip the weekly digest, pause the email worker, slow photo uploads. Never slow down search or listing.

### Manual response (who is paged, what they do)

1. **Friday:** start the change freeze at 18:00, run the 10× load test, and name an **event captain**.
2. **During the spike:** the event captain checks the dashboard every 15 minutes (copies, CPU, error rate, database `cpu_percent`, email queue).
3. If the copies are at their maximum for 10 minutes, the **engineering lead** may raise the maximum from 20 to 30.
4. If database `cpu_percent` stays above 80% for 5 minutes, start slowing things down in the order above.

### Post-incident actions

| Action | Owner |
|--------|-------|
| Compare the real peak with the 10× assumption and update the numbers in section 1 | Event captain |
| Move the weekly digest to a quiet hour for good | API lead |

## 3. Findings about the Day 2 design

I have not changed Day 2.

1. `POST /books` has no idempotency key.
2. No timeouts are defined. Day 2's retry waits (1, 2 and 4 seconds) are also too long for a person who is waiting.
3. The email worker is a WebJob, so it shares the API's servers.
4. There are no `/health` addresses, and Front Door is not in the diagram.

A fourth failure (a bad release) is an evening task and will use the same template.
