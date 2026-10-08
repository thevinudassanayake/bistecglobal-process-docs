# BookSwap — Security Review of the API

**Author:** Thevinu · **Status:** Draft · **Scenario:** BookSwap grows to 200 buildings. A Sunday newspaper article brings 10 times the normal traffic for 4 hours.

## 1. What I reviewed

I read the Day 2 design like an attacker would, and asked "where could someone abuse this?". I also ran a free scanner (OWASP ZAP) against the fake API from Day 2. No real code exists yet, so this is a review of the design.

**Words used**
- **BOLA:** the API checks you are signed in, but not that the thing you asked for is yours.
- **Injection:** text typed by a user is treated as a command by the database or by another system.
- **PII:** personal data, such as addresses, phone numbers and email addresses.
- **JWT:** a digital pass the app sends with every request to prove who is signed in.
- **Severity:** **High** means a member can see or change other people's data, or the main protection can be skipped, with little effort. **Medium** means real harm, but it needs an account or another weakness. **Low** means a small effect.

**Result:** 8 findings. 2 High, 5 Medium, 1 Low.

## 2. Review table

| Category | Question | Finding | Severity | Mitigation |
|----------|----------|---------|----------|------------|
| Authn | Is every non-public endpoint protected by JWT? | Yes on paper, but how the token is checked is not written down (SEC-01). | Medium | Check signature, issuer, audience and expiry. Reject tokens that last over 1 hour. |
| Authz | Does every `/{id}`-shaped endpoint check object ownership? | No. Any member can read any book's loan history, and reach books in other buildings by ID (SEC-02). | **High** | Put the ownership and building check inside the database query. Answer `404` when it is not theirs. |
| Injection | Are all DB queries parameterised? | Not shown for search. Member-typed text also goes into emails (SEC-03). | Medium | Parameterised queries, a low-rights database login, and escaping in email templates. |
| Secrets | Where are connection strings stored? | The design never says (SEC-04). | Medium | Azure Key Vault, read with a managed identity. No `.env` file in production. |
| Transport | Is TLS enforced at Front Door? | Not specified. The App Service can also be called directly, skipping Front Door (SEC-05). ZAP found two header problems (SEC-06). | **High** | Allow only Front Door to reach the App Service. HTTPS only, TLS 1.2 or newer. |
| Rate limit | Are auth and write endpoints rate-limited? | Only per client address. Nothing per member (SEC-07). | Medium | Limits per member in the API, answering `429`. |
| PII | What PII appears in responses, logs, or queues? | Responses are clean. Logs and queue messages can hold personal data (SEC-08). | Medium | Log only allowed fields. Queue messages carry IDs, not email addresses. |

## 3. Findings

Each finding has the problem, the fix, and who owns the fix.

**SEC-01 · The token checks are not written down · Authn · Medium**
- **Problem:** the OpenAPI file only says `bearerFormat: JWT`.
- **Fix:** verify the signature with Entra's public keys. Accept only `RS256` and reject `alg: none`. Check the issuer, the audience and the expiry. Reject any token that lasts over 3,600 seconds. Test with forged and expired tokens.
- **Owner:** API lead.

**SEC-02 · Anyone can read another book's loan history · Authz · High**
- **Problem:** `GET /books/{bookId}/loans` (OpenAPI lines 144–161) has no ownership check. `GET /books/{bookId}` and `POST /books/{bookId}/borrow-requests` have no building check. The write endpoints answer `403` for "not yours", which shows an attacker that the ID exists.
- **Example (BOLA):** Member B (Building B) has a valid token. Book 1042 belongs to Member A (Building A). Member B sends:

  ```
  GET https://api.bookswap.local/books/1042/loans
  Authorization: Bearer <Member B's valid token>
  ```

  The design answers `200` with the borrowers' names, for example `{"items":[{"borrower":{"id":305,"displayName":"Kamal S."},"status":"out"}]}`. Book IDs are plain numbers, so B can try 1, 2, 3 and so on.
- **Fix:** put the check in the query: `... FROM loans l JOIN books b ON b.id = l.book_id WHERE l.book_id = @bookId AND b.owner_id = @callerId`. Add `AND building_id = @callerBuilding` to the book lookups. If no row comes back, answer `404`.
- **Owner:** API lead.

**SEC-03 · Typed text is used unsafely · Injection · Medium**
- **Problem:** the search text goes into a SQL query, and the Day 2 design never shows that query. Titles and authors typed by members also go into HTML emails, so a title containing a link could send a phishing message to a whole building.
- **Example:** `GET /books?search=x'; DROP TABLE books;--`
- **Fix:** pass the search text as a parameter (`WHERE b.building_id = @b AND (b.title LIKE @p OR ...)`), and give the API's database login only select, insert and update rights. Escape all member text in the email templates, and reject `<` and `>` when saving.
- **Owner:** API lead and email worker developer.

**SEC-04 · The design never says where secrets live · Secrets · Medium**
- **Problem:** the system needs at least five: the database, Redis, Service Bus, Blob Storage and the email service.
- **Fix:** keep them in Azure Key Vault, read by the App Service through a managed identity. Where Azure allows it (SQL, Blob, Service Bus), use the managed identity itself, so there is no secret. No `.env` file in production. Rotate every 90 days.
- **Owner:** cloud engineer.

**SEC-05 · The App Service can be called directly, skipping Front Door · Transport · High**
- **Problem:** the firewall and the request limits live in Front Door, but the App Service has its own public address.
- **Example:** `https://bookswap-api.azurewebsites.net/books` reaches the API with no firewall and no limit.
- **Fix:** add an access restriction that allows only Front Door (service tag `AzureFrontDoor.Backend`), and require the header `X-Azure-FDID` to match our Front Door's ID.
- **Owner:** cloud engineer.

**SEC-06 · Header problems found by ZAP · Transport · Low**
- **Problem:** the fake API sends `Access-Control-Allow-Origin: *`, so any website may read its replies. Its replies also carry no cache rules. TLS settings are not written down either.
- **Fix:** at Front Door use HTTPS only and TLS 1.2 or newer. Send no CORS headers, or list only the exact websites that need them. Send `Cache-Control: no-store` on replies that depend on who is signed in.
- **Owner:** cloud engineer.

**SEC-07 · No limits per member · Rate limit · Medium**
- **Problem:** Front Door limits each client address (120 writes a minute), but nothing limits each member. Day 2 answers `409` for a second request for the same book, but a member can still ask for every other book an owner has.
- **Example:** a member loops `POST /books/{bookId}/borrow-requests` over an owner's 20 books, then over many owners. Each one creates a notification and an email, so owners are flooded and BookSwap's email address earns a spam reputation.
- **Fix:** limits counted per member in the API: at most 10 new borrow requests an hour, at most 3 open requests to the same owner, 30 listings a day and 20 photo uploads an hour. Over the limit, answer `429` with `Retry-After`.
- **Owner:** API lead.

**SEC-08 · Personal data can end up in logs and queue messages · PII · Medium**
- **Problem:** (a) an error handler logs the whole request when validation fails, including a message where someone typed a phone number. (b) Debug logging writes request headers, so the `Authorization` token is stored and could be replayed for up to an hour. (c) Queue messages carry the member's email address and sit in Service Bus for up to 2 days.
- **Fix:** use one logging function that accepts only `requestId`, `memberId`, route, status, duration and event name. Never log bodies, headers, search text, tokens, addresses, phone numbers or email addresses. Switch off body capture in Application Insights. Queue messages carry only `memberId` and book IDs, and the worker looks up the email address when it sends.
- **Owner:** API lead and email worker developer.

**Already good:** the `Member` object has only `id` and `displayName`. Addresses and phone numbers are never returned.

## 4. ZAP baseline scan

- **What I ran:** OWASP ZAP 2.17.0 baseline scan, in Docker, against the Prism fake API on 5 October 2026. The report is attached: `Thevinu-day3-zap-baseline-report.html`.
- **Result:** 65 checks passed, 0 failed, 2 alerts. One Medium (**Cross-Domain Misconfiguration**) and one Informational (**Storable and Cacheable Content**).
- **Finding I discuss:** the Medium alert is `Access-Control-Allow-Origin: *` on every reply. ZAP rates it Medium because a web browser would let any website read the data. I rate it Low for BookSwap because our client is a mobile app, not a browser. The real API should still not send it (SEC-06).
- **What the scan could not do:** it found only 3 addresses, and all returned `404`, because the fake API has no front page. It also had no login token. **So it says nothing about BOLA, injection or the real endpoints.** Those findings come from reading the design.

## 5. What I could not cover

- No real code exists, so I could not check how tokens are validated or how queries are built.
- The fake API runs no database, so injection and BOLA cannot be tested against it. Once a test version of the real API exists, run ZAP's API scan with a valid token.
