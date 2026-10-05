# BookSwap — Mock Smoke Test Report

## Setup

Run from the `day-2` folder, the one that holds the `.yaml` file. Node.js 20 LTS (last run on 20.20.2).

```bash
# 1. Validate the spec
npx @apidevtools/swagger-cli validate Thevinu-day2-bookswap-openapi.yaml
# 2. Start the mock on port 4010
npx @stoplight/prism-cli mock Thevinu-day2-bookswap-openapi.yaml --port 4010
# 3. In another terminal, run the five requests below
```

- The lesson's `npx @stoplight/prism mock` fails with a 404, because that package does not exist. The real package is `@stoplight/prism-cli`.
- Requests were sent with `curl`. There is no Postman or Bruno collection; the exact commands are in the table.
- On Windows PowerShell, quotes inside `-d '...'` get stripped and the mock answers `400 Invalid JSON`. Save the body to a file and send it with `--data-binary "@body.json"` instead.
- Prism only checks that an `Authorization` header is present, not that the JWT is valid. I used `Authorization: Bearer test-token`.

## Tests

| # | Endpoint | Method | Body / Params | Expected status | Actual status |
|---|----------|--------|---------------|-----------------|---------------|
| 1 | `/books` | GET | `page=1&pageSize=20` | 200 | **200** |
| 2 | `/books` | POST | `{"title":"The Road to Wigan Pier","author":"George Orwell","isbn":"9780141036687","condition":"good"}` | 201 | **201** |
| 3 | `/books` | POST | same body, `title` removed | 400 or 422 | **422** |
| 4 | `/books/999/borrow-requests` | POST | `{}` with `Authorization: Bearer test-token` | 201 | **201** |
| 5 | `/books` | GET | no `Authorization` header | 401 | **401** |

Example command (test 3):

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST http://127.0.0.1:4010/books \
  -H "Authorization: Bearer test-token" -H "Content-Type: application/json" \
  -d '{"author":"George Orwell","isbn":"9780141036687","condition":"good"}'
```

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Tests run | 5 | 5 |
| Tests passing against the mock | 5 | 5 |
| Endpoints with explicit error responses | 4+ | 12 of 12 |

## Findings

1. **The mock ignores pagination.** Test 1 asked for `pageSize=20` and got `"pageSize":1,"total":0` with one item. Prism returns fixed sample data built from the schema, and the spec has no examples, so the numbers contradict each other.
2. **Every error shows the same body.** Test 5 (a 401) returned `validation_failed` / `title is required`. The sample text comes from the shared `Error` schema, so it is wrong for every error except a missing title.
3. **Sample IDs are meaningless.** Every `id` came back as `-9007199254740991` (the smallest 64-bit number), although the path parameters in the spec require IDs of 1 or more.
4. **The mock cannot test business rules.** Test 4 returned 201 for book 999, which does not exist. The 404 and 409 responses can only be seen by forcing them with a `Prefer: code=409` header; I checked this and it returns 409.
5. **Awkward to call.** There is no way to list only my own books, because `GET /books` has no owner filter. (Adding a photo is a second call by design, since a 5 MB file should not travel inside JSON.)

## Spec changes you would make

Line numbers refer to `Thevinu-day2-bookswap-openapi.yaml`.

1. Lines 487–489 (`Page` properties): add `example: 1` to `page`, `example: 20` to `pageSize` and `example: 42` to `total`, so the sample page is consistent.
2. Lines 523–524 (`Error`): delete the two `example` values. In `components.responses` (lines 346–370), add a response-level `example` to each: `unauthorized` / `Missing or invalid token` under `Unauthorized` (line 351), and likewise for `NotFound`, `Forbidden` and the others.
3. Lines 389, 417, 439, 459, 477 (`id` in `Member`, `Book`, `BorrowRequest`, `Loan`, `Notification`): add `example: 101` to each.
4. After line 41 (`GET /books` parameters): add a `mine` boolean query parameter (`schema: { type: boolean, default: false }`) that returns only books owned by the caller.
