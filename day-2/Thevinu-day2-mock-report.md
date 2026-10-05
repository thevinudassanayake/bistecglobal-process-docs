# BookSwap — Mock Smoke Test Report

## Setup

I tested the API plan (the OpenAPI file) before anyone builds the real API. For this I used **Prism**, a tool that reads the plan and acts as a fake API on my own computer. The fake API has no database. It answers every request with made-up sample data, so these tests show whether the plan is usable, not whether real features work.

I ran everything from the `day-2` folder, using Node.js 20 or newer (last run on Node 24) in Windows PowerShell.

```powershell
# 1. Check the plan is valid
npx.cmd @apidevtools/swagger-cli validate Thevinu-day2-bookswap-openapi.yaml

# 2. Start the fake API on port 4010 (leave this window open)
npx.cmd @stoplight/prism-cli mock Thevinu-day2-bookswap-openapi.yaml --port 4010

# 3. In a second window, run the five tests
npx.cmd newman run Thevinu-day2-bookswap.postman_collection.json
```

**Collection:** `Thevinu-day2-bookswap.postman_collection.json` has the five requests with a check for each expected status code. It can be imported into Postman or Bruno, or run from the command line as in step 3. My run: 5 requests, 7 checks, 0 failed.

Things I learned while setting up:
- The command in the lesson, `npx @stoplight/prism mock`, does not work, because that package does not exist. The real one is `@stoplight/prism-cli`.
- In Windows PowerShell, plain `npx` can be blocked by the script policy. Typing `npx.cmd` instead works.
- When using curl, quotes inside `-d '...'` get removed and the mock answers `400 Invalid JSON`. Save the body in a file and send it with `--data-binary "@body.json"`.
- Prism only checks that an `Authorization` header is there. It does not check the JWT, so I used `Authorization: Bearer test-token`.

I did this work with help from an AI assistant (Claude Code), which ran the commands on my computer and helped me write this report.

## Tests

| # | Request | What I sent | Expected | Actual | What it shows |
|---|---------|-------------|----------|--------|---------------|
| 1 | `GET /books` | `page=1&pageSize=20` | 200 | **200** | Searching works |
| 2 | `POST /books` | a full book: title, author, isbn, condition | 201 | **201** | Listing a book works |
| 3 | `POST /books` | the same book with the title removed | 400 or 422 | **422** | **Negative test:** a missing field is refused |
| 4 | `POST /books/999/borrow-requests` | an empty body `{}` and a token | 201 | **201** | Asking to borrow works |
| 5 | `GET /books` | no `Authorization` header | 401 | **401** | **Negative test:** a missing token is refused |

Test 3 as a PowerShell command:

```powershell
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST http://127.0.0.1:4010/books -H "Authorization: Bearer test-token" -H "Content-Type: application/json" --data-binary "@bad.json"
```

where `bad.json` contains `{"author":"George Orwell","isbn":"9780141036687","condition":"good"}`.

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Tests run | 5 | 5 |
| Tests passing against the mock | 5 | 5 |
| Endpoints with explicit error responses | 4+ | 12 of 12 |

The plan has 12 endpoints (each combination of address and method, like `GET /books`), and every one lists its possible error replies, such as 401, 403, 404, 409 or 422.

## Findings

What the mock showed me that the plan alone did not:

1. **The mock ignores what I ask for.** Test 1 asked for 20 books per page and got `"pageSize":1,"total":0` with one book in the list. The plan has no sample values, so Prism invents each number on its own and they contradict each other.
2. **Every error has the same text.** The 401 in test 5 said `title is required`. The same sample text appears for every error, so it is wrong for all of them except a missing title.
3. **Sample IDs are nonsense.** Every `id` came back as `-9007199254740991`, which is not a number anyone would use as an ID.
4. **The mock cannot check real rules.** Test 4 returned 201 for book 999, which does not exist. A real API would say 404. I could still see the plan's other replies by adding a header: `Prefer: code=404` gave me a 404, and `Prefer: code=409` gave me a 409. So the plan does define those replies.

Endpoints that feel awkward to call:

- **No way to list only my own books.** `GET /books` has no owner filter.
- **A notification cannot open its request.** A notification has `bookId` but no request id, so the app would have to list my pending requests and match them by book. If two people asked for the same book, it could pick the wrong one.
- **Adding a photo is a second call.** I think this is right, because a 5 MB photo should not travel inside the JSON.

## Spec changes you would make

Each change is in `Thevinu-day2-bookswap-openapi.yaml`, and the line numbers are for the file as it is now.

1. **Lines 487–489 (`Page`):** add `example: 1` to `page`, `example: 20` to `pageSize` and `example: 42` to `total`, so the sample page agrees with itself.
2. **Lines 523–524 (`Error`):** remove the two `example` values. Then give each shared reply in lines 346–370 its own example. For instance, under `Unauthorized` (line 351) use code `unauthorized` and message `Missing or invalid token`, and do the same for `NotFound`, `Forbidden` and the others.
3. **Lines 389, 417, 439, 459, 477 (`id` in `Member`, `Book`, `BorrowRequest`, `Loan` and `Notification`):** add `example: 101` to each.
4. **After line 41 (`GET /books` parameters):** add a `mine` yes/no parameter (`schema: { type: boolean, default: false }`) that returns only the books I own.
5. **After line 480 (`Notification`):** add `requestId` (`type: integer, format: int64`) so a notification can open the exact request it is about.
