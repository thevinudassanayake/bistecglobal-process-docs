# BookSwap — Storage and Cache Decisions

**Author:** Thevinu · **Status:** Proposed for review · **Scope:** where each kind of data lives, what is cached, and what goes on a queue.

**Summary:** Azure SQL is the single source of truth for all records. Photos go to Blob Storage. Redis holds two short-lived copies for fast reads. Service Bus carries email work so the user never waits on email.

## 1. Data inventory

Volumes are estimates for year one across all buildings (about 100 buildings).

| Data type | Example record | Volume estimate (1y) | Read/write ratio |
|-----------|----------------|----------------------|------------------|
| Member profile | name, building, address, phone | ~10,000 | read-heavy |
| Book listing | title, author, ISBN, condition, available | ~50,000 | read-heavy |
| Book photo | one JPEG/PNG, up to 5 MB | ~50,000 files (~75 GB at ~1.5 MB each) | write once, read many |
| Borrow request | member X asks for book Y, status | ~100,000 | balanced |
| Loan | book, borrower, out/returned/overdue, dates | ~60,000 | write-heavy, read for history |
| Notification | "Kamal asked to borrow …" | ~200,000 (one per request, one per decision) | write once, read once |
| Email jobs | weekly digest, event emails | ~720,000 (10,000 members × 52 weeks = 520,000 digests, plus ~200,000 event emails) | write once, read once |

## 2. Storage selection

| Data type | Chosen store | Why this store | Why not the alternatives |
|-----------|--------------|----------------|--------------------------|
| Member profile | Azure SQL | Related to books and loans by foreign key. Address and phone live here only; the API never returns them. | Cosmos DB: no flexible-schema need, and no joins to books. Entra External ID: holds the login only, not our profile data. |
| Book listing | Azure SQL | Owner foreign key; filtering by condition and searching title/author/ISBN with indexes. Search is always limited to one building (≤ 5,000 rows), so SQL never scans more than 5,000 rows and an index on building and condition narrows it further. This is expected to meet 300 ms p95; confirm with a load test. | Azure AI Search: a second system to keep in sync for 5,000 rows per building. Cosmos DB: listings join to owners and loans. |
| Book photo | Azure Blob Storage | Large binary files. Only the blob URL is saved in the book row, and the app loads the photo from that URL. | Database BLOB: ~75 GB would bloat SQL size, backups and cost. |
| Borrow request and Loan | Azure SQL | Accepting a request must create the loan and mark the book unavailable in one transaction (all or nothing). Overdue is a query: status `out` and due date passed. | Cosmos DB: atomic only inside one document, so the three changes could part-succeed. Redis or queue: can lose data, not a record. |
| Notification | Azure SQL | Small rows read newest-first per member. Written in the same transaction as the event, so it exists the moment the request exists (2 s target). | Queue: a message disappears once read, so it cannot show history. Cosmos DB: an extra database for tiny, simple rows. |
| Email jobs | Azure Service Bus (in flight only) | Holds work until it is sent, then it is gone. Retries and dead-lettering built in. | Database table as a queue: needs custom polling and retry code. |

**Source of truth:** Azure SQL for every record, Blob Storage for photo files. Redis holds copies and Service Bus holds in-flight work. Neither is ever the only copy of anything.

## 3. Cache plan

**What is hot enough to cache**

| Key | Content | TTL | Why |
|-----|---------|-----|-----|
| `book:{bookId}` | one book's details | 60 s | Members open the same books repeatedly; edits are rare. We expect most reads to be hits (an estimate to check after launch). |
| `recent:{buildingId}` | the 10 newest books in a building | 5 min | The weekly digest needs it for every member of a building. It is built once, then reused (about 99 hits per 100 members). A 5-minute-old list is harmless. |

**Invalidation:** every change to a book deletes `book:{bookId}`. That means editing it, accepting a borrow request, and marking a loan returned, because each changes `available`. The TTL is only a safety net.

**When not to cache**
- Search results (`GET /books?search=…`): too many different queries to hit often, and SQL is expected to meet 300 ms on its own.
- Availability checks on `POST /borrow-requests`, accepting a request, and loans: always read SQL, so no one borrows a book that is already out.
- Member profiles: they hold address and phone.

**If Redis is down:** the API reads SQL directly. It is slower, but nothing breaks.

**Cache-aside pseudocode**

```js
async function getBook(bookId) {
  const key = `book:${bookId}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);          // hit

  const row = await db.query("SELECT * FROM books WHERE id = @id", { id: bookId });
  if (!row) return null;

  // TTL 60s: details rarely change; delete-on-write keeps it fresh
  await redis.set(key, JSON.stringify(row), "EX", 60);
  return row;
}

async function updateBook(bookId, patch) {
  const updated = await db.update("books", bookId, patch);
  await redis.del(`book:${bookId}`);              // next read reloads from SQL
  return updated;
}
```

## 4. Queue plan

**What goes on the queue (Azure Service Bus)**
- **Weekly digest:** a weekly timer in the API service reads `recent:{buildingId}` and puts one message per member on the queue, with the 10 books inside. The message ID is `digest:{memberId}:{week}`, so if two API copies both fire, the duplicate is dropped.
- **Event emails:** after the SQL commit for a borrow request, accept or decline, the API puts an email message on the queue.
- The email worker reads the queue and sends each email through Azure Communication Services.

Why: sending email is slow and can fail. With the queue, `POST /books` and `POST /borrow-requests` only write to SQL, so they succeed even if the email service is down. In-app notifications skip the queue. They are written to SQL in the same transaction, so there is no extra hop that could miss the 2-second target.

**If the consumer is down for 30 minutes:** messages wait in the queue and nothing is lost. When the consumer restarts, it sends them. Users still get in-app notifications the whole time. Digest emails are best-effort, so a late digest is fine.

**Failures**
- A failed send is retried by Service Bus. After 5 failed attempts the message moves to the dead-letter queue (DLQ).
- An alert fires when the DLQ has any message. A developer checks the cause and re-sends or discards.
- Delivery is at-least-once, so duplicate detection is on for the queue. A rare duplicate email is acceptable.
- Messages expire after 2 days, because an old digest is no longer useful.

## 5. Retry policy for 5xx errors

The API service retries a call that fails with a 5xx error or a timeout up to 3 times, waiting 1 s, 2 s and 4 s with a little random jitter, and it never retries a 4xx error. Only calls that are safe to repeat are retried (reads, and a photo upload to the same blob path); creating a borrow request or a loan is not retried automatically, so no one gets a duplicate. If the retries run out, the API returns 503 to the app, except that a Redis failure falls back to SQL and a failed email send goes back to Service Bus's own retry and dead-letter handling.
