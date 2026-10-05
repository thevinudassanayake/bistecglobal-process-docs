# BookSwap — Storage and Cache Decisions

**Author:** Thevinu · **Status:** Proposed for review · **Scope:** where each kind of data is kept, what we keep quick copies of, and what goes on a queue.

**Summary:** All records live in Azure SQL, which is our one trusted copy of the data. Photos go in Blob Storage. Redis keeps two kinds of short-lived copies so common reads are fast. Service Bus holds email jobs, so members never wait for an email to be sent.

## 1. Data inventory

This is a list of everything BookSwap has to remember. The counts are my best guess for the first year across all buildings (about 100 buildings, about 100 members in each). They are only estimates, but they show the size of the job.

"Read-heavy" means the data is looked at many more times than it is changed. "Balanced" means reads and changes happen about equally often.

| Data type | Example record | Volume estimate (1 year) | Read/write ratio |
|-----------|----------------|--------------------------|------------------|
| Member profile | name, building, address, phone | ~10,000 | read-heavy |
| Book listing | title, author, ISBN, condition, available | ~50,000 | read-heavy |
| Book photo | one JPEG or PNG, up to 5 MB | ~50,000 files, about 75 GB (50,000 × ~1.5 MB) | saved once, viewed many times |
| Borrow request | "member X asks for book Y", status | ~100,000 | balanced |
| Loan | book, borrower, status (out, returned, overdue), dates | ~60,000 | balanced: written when accepted and when returned, read by both people and in the book history |
| Notification | "Kamal asked to borrow …" | ~200,000 (one per request, one per decision) | saved once, read once |
| Email job | weekly digest or event email | ~720,000 (10,000 members × 52 weeks = 520,000 digests, plus ~200,000 event emails) | saved once, sent once |

## 2. Storage selection

For each kind of data: where it lives, why, and why not the other options.

| Data type | Where | Why this choice | Why not the others |
|-----------|-------|-----------------|--------------------|
| Member profile | Azure SQL | A member is linked to their books and loans. Address and phone are kept here only, and the API never sends them out. | Cosmos DB gives us nothing here, and it cannot link members to books easily. Entra External ID only stores the login, not our member details. |
| Book listing | Azure SQL | Each book is linked to its owner, and we search and filter it by title, author, ISBN and condition. A search only covers one building (at most 5,000 books), so SQL never has to look at more than 5,000 rows. That should finish within 300 ms for 95 out of 100 searches ("p95"); we will confirm this with a load test. | Azure AI Search would be a second system to keep in step for only 5,000 books per building. Cosmos DB is a poor fit because books link to owners and loans. |
| Book photo | Azure Blob Storage | Photos are big files. Only the photo's web address is saved in the book's row, and the app loads the picture from that address. | Keeping photos inside the database would add about 75 GB to it, which makes it slower and more expensive to back up. |
| Borrow request and loan | Azure SQL | When the owner accepts, three things must change together: the request becomes accepted, a loan is created, and the book becomes unavailable. SQL does these as one all-or-nothing step. "Overdue" is not stored: a loan is overdue when its status is `out` and its due date has passed. | Cosmos DB only guarantees all-or-nothing inside one document, so one of the three changes could succeed while another fails. Redis and queues can lose data, and these are important records. |
| Notification | Azure SQL | A small row, shown newest first. It is saved in the same all-or-nothing step as the request, so it exists the moment the request does (our target is 2 seconds). | A queue deletes a message once it is read, so it could not show past notifications. Another database would be extra work for tiny, simple rows. |
| Email job | Azure Service Bus | It holds the job until the email is sent, then it is gone. Retries and a "problem pile" for failed jobs come built in. | Using a database table as a job list would mean writing our own retry code. |

**Source of truth** means the copy we trust. It is Azure SQL for all records and Blob Storage for photo files. Redis holds copies, and Service Bus holds jobs that are waiting. Neither of those is ever the only copy of anything, so losing them loses no data.

## 3. Cache plan

A cache keeps quick copies of data that people ask for again and again, so we don't ask the database every time. We use Redis for this.

**What we copy, and for how long**

| Key | What it holds | Kept for | Why |
|-----|---------------|----------|-----|
| `book:{bookId}` | one book's details | 60 seconds | Members open the same books again and again, and books rarely change. We expect most opens to be served from the cache, which we will check after launch. |
| `recent:{buildingId}` | the 10 newest books in one building | 5 minutes | The weekly digest needs the same list for every member of a building. We build it once and reuse it, which is about 99 cache hits for every 100 members. A list that is 5 minutes old does no harm in a weekly email. |

**Keeping copies fresh:** whenever a book changes, we delete its cached copy straight away. That covers editing it, accepting a borrow request, and marking a loan returned, because each of these changes whether the book is available. The time limit is only a safety net.

**What we do not cache**
- **Search results** (`GET /books?search=…`): there are too many different searches for the cache to help, and SQL should be fast enough on its own.
- **Availability checks** when someone requests a book, accepting a request, and loans: these always read SQL, so nobody borrows a book that is already out.
- **Member profiles:** they hold an address and a phone number.

**If Redis is down:** the API reads from SQL instead. It is slower, but nothing breaks.

**How it works, in short** (the "cache-aside" pattern): look in the cache first. If the book is not there, read it from the database and save a copy in the cache. When a book changes, delete its copy.

```js
async function getBook(bookId) {
  const key = `book:${bookId}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);          // found in the cache

  const row = await db.query("SELECT * FROM books WHERE id = @id", { id: bookId });
  if (!row) return null;

  // keep the copy for 60 seconds; deleting it on every change keeps it fresh
  await redis.set(key, JSON.stringify(row), "EX", 60);
  return row;
}

async function updateBook(bookId, patch) {
  const updated = await db.update("books", bookId, patch);
  await redis.del(`book:${bookId}`);              // the next read loads fresh data from SQL
  return updated;
}
```

## 4. Queue plan

A queue is a list of jobs waiting to be done. We use Azure Service Bus.

**What goes on the queue**
- **The weekly digest:** a weekly timer in the API service gets the building's 10 newest books (from `recent:{buildingId}`) and puts one message per member on the queue, with the 10 books inside. Each message has the ID `digest:{memberId}:{week}`. If two copies of the API both fire the timer, the second copy of each message is dropped.
- **Event emails:** after a borrow request is saved, or when it is accepted or declined, the API puts an email job on the queue.
- The email worker takes jobs off the queue and sends each email through Azure Communication Services.

**Why use a queue:** sending an email is slow and sometimes fails. If the API waited for it, listing a book or asking to borrow one would fail whenever the email service had a problem. Instead, these calls only save to SQL and put a job on the queue, so they work even when email is down. In-app notifications do not use the queue. They are saved to SQL in the same step as the event, so nothing can delay them past the 2-second target.

**If the worker is down for 30 minutes:** the jobs wait in the queue and nothing is lost. When the worker starts again, it sends them. Members still get their in-app notifications the whole time. Digest emails are best-effort, so a late one is fine.

**When something goes wrong**
- If an email fails to send, Service Bus tries again. After 5 failed attempts, the job moves to a separate "problem pile" called the dead-letter queue.
- An alert goes off whenever anything is in the problem pile. A developer finds the cause, then sends the email again or throws it away.
- A job can occasionally be delivered twice, so duplicate detection is switched on. A rare double email is acceptable.
- A job that waits more than 2 days is thrown away, because an old digest is no longer useful.

## 5. Retry policy for server errors

If a call fails with a server error (a 5xx code) or takes too long, the API tries again up to 3 times, waiting 1, 2 and 4 seconds with a small random extra delay, and it never retries a client mistake (a 4xx code). It only retries calls that are safe to repeat, such as reads and uploading a photo to the same place; it does not automatically retry creating a borrow request or a loan, so nobody gets a duplicate. If the retries run out, the API answers `503` (service unavailable), except that a Redis failure falls back to SQL, and a failed email goes back to Service Bus's own retry and problem-pile handling.
