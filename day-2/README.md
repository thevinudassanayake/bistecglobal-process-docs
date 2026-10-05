# BookSwap — Day 2 Design

## How to read the container diagram

1. The Member uses the mobile app only; the app is the single entry point and calls the API service over HTTPS, after signing in with Microsoft Entra External ID to get a JWT.
2. Solid blue arrows are synchronous calls where the caller waits: the API service reads and writes Azure SQL, caches hot books in Redis, and stores photos in Blob Storage.
3. Dashed orange arrows are asynchronous: the API service drops email jobs on Azure Service Bus and moves on, without waiting for any email to be sent.
4. The email worker picks jobs up from the queue and sends them through Azure Communication Services, so listing a book or requesting a loan never depends on the email service being up.
5. Every arrow shows a verb and `[protocol | sync or async]`, and each box shows its technology and its job.

## Files

| File | What it is |
|------|------------|
| `Thevinu-day2-bookswap-openapi.yaml` | REST API design |
| `Thevinu-day2-storage-decisions.md` | Storage, cache and queue decisions |
| `Thevinu-day2-container-diagram.png` / `.drawio` | C4 Level 2 diagram and its editable source |
| `Thevinu-day2-mock-report.md` | Prism mock smoke test results |
| `Thevinu-day2-bookswap.postman_collection.json` | The five mock tests as a Postman collection (also runs with `newman`) |

These files were prepared with help from an AI assistant (Claude Code).
