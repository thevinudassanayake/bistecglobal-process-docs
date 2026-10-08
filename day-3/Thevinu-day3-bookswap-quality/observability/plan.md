# BookSwap — Observability Plan

**Author:** Thevinu · **Status:** Draft · **Scenario:** BookSwap grows to 200 buildings. A Sunday newspaper article brings 10 times the normal traffic for 4 hours.

Nothing is built yet, so nothing here has been run. The queries are untested and the thresholds are starting values. The alert rules are in `observability/alerts.yaml`.

## The idea in plain words

| Kind | What it is | The question it answers |
|------|-----------|--------------------------|
| **Log** | One line of text for each important thing that happened | What happened? |
| **Metric** | A number measured over time | How often, and how fast? |
| **Trace** | One request followed through every part it touched | Where did the time go? |

**The rule:** alert on metrics, debug with logs, find the cause with traces.

**Severity:** **Sev1** (outage or exposed personal data) and **Sev2** (serious) page the on-call engineer at any hour. **Sev3** is a team message and a ticket. **Sev4** is information only.

## Setup

### Logs: Azure Monitor Logs

- **Where:** the API and the email worker write JSON log lines. They are stored in Azure Monitor Logs (the Log Analytics workspace behind Application Insights). The tables used are `requests`, `traces` and `dependencies`.
- **Fields on every line:** `timestamp`, `event`, `requestId`, `memberId` (the word `anonymous` when the token cannot be read), `route`, `status` and `durationMs`.
- **Events:** `auth.failed`, `auth.ok`, `listing.created`, `loan.created`, `loan.returned`, `digest.enqueued`, `email.sent`, and the robot checks `probe.notification`, `probe.privacy`, `probe.authz.loan_history` and `probe.audit`.
- **Retention:** 90 days. The audit events (`auth.failed`, `loan.created`, `loan.returned`) are kept 12 months.

### Metrics: Azure Application Insights

- **Request metrics** (how many, how long) and **dependency metrics** (every call to SQL, Redis, Blob Storage, Service Bus and the email service) come from `requests` and `dependencies`.
- **Azure metrics:** Front Door (`RequestCount`, `Percentage5XX`), App Service (`CpuPercentage`, `HttpQueueLength`), Azure SQL (`cpu_percent`, `connection_failed`), Redis (`connectedclients`) and Service Bus (`ActiveMessages`, `DeadletteredMessages`).
- **Custom metrics** (counts only): `bookswap.listings.created`, `bookswap.borrow_requests.created`, `bookswap.loans.created`.

### Traces: Application Insights distributed tracing

- Every request gets an ID (`operation_Id`) that follows it through the API, SQL, Redis and Blob Storage, and into the queue message, so the email worker's work joins the same trace.
- **Sample rate: 100%.** The SLO queries count rows, and sampling would make the counts wrong. If cost becomes a problem, move the audit events to their own table, use 25% sampling, and count with `sum(itemCount)`.

### What is redacted before anything is logged

All logging goes through one function that accepts only the fields above.

- **Never logged:** passwords, tokens, request and response bodies, search text, addresses, phone numbers, email addresses, borrow messages and book titles.
- **Logged only as an ID:** the member, book, loan and message.
- A test writes a fake token and a fake phone number through the logger and checks that neither comes out. Application Insights IP masking stays on.

## Signals

| # | Signal type | Source | What it answers | Sample query / metric name |
|---|-------------|--------|-----------------|----------------------------|
| 1 | Metric | Application Insights `requests` | How slow is search? (p95 per minute) | Query 1 |
| 2 | Metric | Application Insights `requests` | What share of listing requests succeed? | Query 2 |
| 3 | Metric | Service Bus | How many email jobs are waiting? | `ActiveMessages` |
| 4 | Log | Application Insights `traces` | Who failed to sign in, and how often? | Query 3 |
| 5 | Log | Application Insights `traces` | Who created or returned which loan? (the audit trail) | Query 4 |
| 6 | Trace | Application Insights `requests` and `dependencies` | Where did a slow request spend its time: SQL, Redis or code? | Query 5 |
| 7 | Trace | Application Insights `dependencies` | How often do SQL and Redis calls fail? | `dependencies` where `type` is SQL or Redis and `success == false` |

**Query 1: search speed, p95 per minute**

```kusto
requests
| where timestamp > ago(1h) and name == "GET /books"
| summarize p95 = percentile(duration, 95) by bin(timestamp, 1m)
```

**Query 2: listing success rate, per 5 minutes**

```kusto
requests
| where timestamp > ago(6h) and name == "POST /books" and resultCode !startswith "4"
| summarize successRate = 100.0 * countif(resultCode startswith "2") / count() by bin(timestamp, 5m)
```

**Query 3: sign-in failures with the member ID**

```kusto
traces
| where timestamp > ago(1h) and tostring(customDimensions.event) == "auth.failed"
| summarize failures = count() by bin(timestamp, 5m), memberId = tostring(customDimensions.memberId)
```

**Query 4: the audit trail for loans**

```kusto
traces
| where timestamp > ago(1d)
| where tostring(customDimensions.event) in ("loan.created", "loan.returned")
| project timestamp, event = tostring(customDimensions.event), requestId = tostring(customDimensions.requestId), memberId = tostring(customDimensions.memberId)
```

**Query 5: where slow book-opens spent their time**

```kusto
let slow = requests
    | where timestamp > ago(1h) and name == "GET /books/:bookId" and duration > 800
    | project operation_Id;
dependencies
| where timestamp > ago(1h)
| join kind=inner (slow) on operation_Id
| summarize dependencyMs = sum(duration) by operation_Id, type
```

## Dashboards

**Health dashboard (for operations).** The top tile says "Healthy", "Degraded" or "Down" (no alert, a Sev3 alert, or a Sev1 or Sev2 alert firing). Under it: (1) the `GET /books` test result, (2) search speed against 300 ms and 800 ms, (3) the share of server errors, (4) the listing success rate, (5) number of API copies, CPU and database `cpu_percent`, (6) email queue size. Someone new can read it and say whether the system is healthy in under 5 minutes.

**Business dashboard (for the product owner).** Listings, borrow requests and loans per day, from the custom metrics. It contains no personal data.

## Results Summary

These count what the plan covers. Nothing has been measured.

| Metric | Target | Achieved (in the plan) |
|--------|--------|------------------------|
| SLOs covered by an alert | 100% | 100% (13 of 13) |
| Alerts with a clear runbook link | 100% | 100% (15 of 15) |
| Dashboards for ops | 1 health, 1 business | 1 health and 1 business designed, not built |

| SLO | Alerts that protect it |
|-----|------------------------|
| S1 Search under 300 ms | A5, A8 |
| S2 Search under 800 ms | A2, A3, A4, A5, A8 |
| S3 Listing succeeds | A1, A2, A4, A9 |
| S4 No duplicate listings | A14 |
| S5 Photo uploads work | A10 |
| S6 No photos in the database | A14 |
| S7 Notification within 2 seconds | A11 |
| S8 Digest emails delivered | A7 |
| S9 No leaks | A12 |
| S10 Every request has a signed-in member | A13 |
| S11 Tokens last 1 hour or less | A14 |
| S12 Outage paged within 3 minutes | A1 (and the monthly drill) |
| S13 Audit log is complete | A15 |

## Alert proposal

Sev1 and Sev2 go to the **pager and Teams**. Sev3 goes to **Teams and a ticket**. Sev4 goes to **Teams** only. The exact queries are in `observability/alerts.yaml`.

| Alert | Condition | Severity | Notification | Runbook |
|-------|-----------|----------|--------------|---------|
| A1 Books endpoint down | The `GET /books` test fails from 2 or more of 3 places, twice in a row | Sev1 | Pager and Teams | `reliability/runbook.md#failure-1-azure-sql-primary-unavailable-for-5-minutes` |
| A2 Database unreachable | `connection_failed` above 5 in 2 minutes, or over half of SQL calls failing for 2 minutes | Sev1 | Pager and Teams | `reliability/runbook.md#failure-1-azure-sql-primary-unavailable-for-5-minutes` |
| A3 Redis down | Over 20% of Redis calls failing for 5 minutes, or `connectedclients` below 1 | Sev3 | Teams and ticket | `reliability/runbook.md#failure-2-azure-cache-for-redis-is-down` |
| A4 Too many server errors | `Percentage5XX` above 1% for 5 minutes | Sev2 | Pager and Teams | `observability/plan.md#card-1-slow-or-failing` |
| A5 Servers overloaded | `CpuPercentage` above 85% for 10 minutes, or `HttpQueueLength` above 100 for 5 minutes | Sev2 | Pager and Teams | `reliability/runbook.md#failure-3-sunday-tabloid-spike--10-sustained-traffic` |
| A6 Traffic spike started | Requests over 5 times the same time last week, for 10 minutes | Sev4 | Teams | `reliability/runbook.md#failure-3-sunday-tabloid-spike--10-sustained-traffic` |
| A7 Emails stuck or late | `ActiveMessages` above 30,000 for 30 minutes, or any dead-letter message | Sev3 | Teams and ticket | `observability/plan.md#card-4-email-trouble` |
| A8 Search too slow | Over 3% of searches are not a success under 800 ms, over 10 minutes (allowed: 1%) | Sev2 | Pager and Teams | `observability/plan.md#card-1-slow-or-failing` |
| A9 Listings failing | Over 1% of listing requests fail, over 5 minutes (allowed: 0.1%) | Sev2 | Pager and Teams | `observability/plan.md#card-1-slow-or-failing` |
| A10 Photo uploads failing | Over 5% of valid photo uploads fail, over 30 minutes | Sev3 | Teams and ticket | `observability/plan.md#card-1-slow-or-failing` |
| A11 Notifications slow | 3 or more of the last 12 robot checks took over 2 seconds | Sev3 | Teams and ticket | `observability/plan.md#card-1-slow-or-failing` |
| A12 Personal data leaked | A test or the daily robot found an address, phone number or another member's loan history in a reply | Sev1 | Pager and Teams | `observability/plan.md#card-2-leaks` |
| A13 Request without login | Any success reply outside `/health` with no member ID | Sev1 | Pager and Teams | `observability/plan.md#card-2-leaks` |
| A14 Release rule broken | A duplicate listing, a photo column in the database, or a token lasting over 3,600 seconds | Sev3 | Teams and ticket | `observability/plan.md#card-3-rule-broken` |
| A15 Audit log gap | The daily check finds a gap over 0.1% | Sev3 | Teams and ticket | `observability/plan.md#card-3-rule-broken` |

## Response cards

The runbook already covers the database, Redis and the spike. These short cards cover the other alerts.

### Card 1: Slow or failing

*A4, A8, A9, A10, A11.*
1. Open the health dashboard. Find what is slow or failing, and when it started.
2. If a release went out just before, roll it back. Otherwise check the database and Redis (A2, A3) and the spike (A6).
3. Apply the error budget policy in the SLO map.

### Card 2: Leaks

*A12, A13.*
1. These are real incidents. Tell the engineering lead at once.
2. If it is still happening, switch the endpoint off with its feature flag, so it returns `503`.
3. Release nothing until it is fixed and a test proves it.

### Card 3: Rule broken

*A14, A15.*
1. Stop the next release.
2. Find which check failed (a repeated idempotency key, a photo column, a long-lived token, or loan events with no audit line), and fix it.
3. Add a test that would have caught it.

### Card 4: Email trouble

*A7.*
1. Check that the email worker is running and the email service is up.
2. Read why any dead-letter messages failed. Send them again if the cause is fixed, or throw them away.

## What we are deliberately NOT alerting on

If the team can ignore an alert, it should not be an alert.

1. **One slow request.** A few are expected. The allowed 1% covers them, and A8 fires only when it becomes a pattern.
2. **A CPU spike that goes away in a few minutes.** Autoscale handles it. A5 waits 10 minutes.
3. **Single 4xx replies** (a wrong book ID, bad input, an expired token). They are the caller's mistakes.
4. **A Redis outage by itself, or the spike itself.** The design survives them, so they are a ticket or a message, not a page.

## Limits

- Nothing has been run. You can check the query syntax in the Application Insights demo (`aka.ms/aidemoapp`), but its data is not BookSwap's.
- The thresholds are starting values. The 10× load test will show whether they are too tight or too loose.
- The robot checks and the idempotency key do not exist in Day 2. A11, A12, A14 and A15 depend on them.
- The dashboards are designed, not built. The one-page paper sketch is still an evening task.
