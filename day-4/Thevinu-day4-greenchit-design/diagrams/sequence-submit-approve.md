# Sequence — Submit and Approve a Claim

**Author:** Thevinu · **Status:** Draft · **Part:** Deliverable 2 (sequence diagrams)

A sequence diagram shows one user journey in time order, from top to bottom. Each vertical line is one participant. Every participant name is the same as the box name in the container diagram (`Thevinu-day4-greenchit-design.md`).

## How to read the arrows

| Arrow | Meaning | Example |
|-------|---------|---------|
| Solid line, closed head | **Synchronous.** The caller waits for the answer. | `Web app` sends `POST /claims` and waits |
| Dashed line, closed head | The **return** to a synchronous call. | `201 Created` |
| Solid line, open head | **Asynchronous.** The sender does not wait. | `Publish claim.submitted` to the Message queue |
| Dashed line with a cross | A **failed** call or an error. | Receipt upload times out |
| `alt` box | Either-or branches. The error paths sit here. | Teams works, or Teams fails |

## 1. Happy path

The staff member submits a claim with receipts. The manager is told and approves.

![Happy path](sequence-submit-approve.png)

```mermaid
sequenceDiagram
  actor U as Staff (claimant)
  participant FE as Web app
  participant API as Claims API
  participant DB as Claims database
  participant BLOB as Receipt storage
  participant SB as Message queue
  participant W as Notification worker
  participant TEAMS as Microsoft Teams
  actor MGR as Line manager

  Note over U,API: Part 1 - Staff submit a claim
  U->>FE: Fill in claim, attach receipts, tap "Submit claim"
  FE->>API: POST /claims (JWT, claim details, receipt file names)
  activate API
  API->>API: Check token, role and claim rules
  API->>DB: INSERT claim (status=Draft) + audit row
  DB-->>API: claim id 1042
  API-->>FE: 201 Created (claim id, signed upload URLs)
  deactivate API
  loop each receipt file (up to 5, 10 MB each)
    FE->>BLOB: PUT file using signed URL
    BLOB-->>FE: 201 Created
  end
  FE->>API: POST /claims/1042/submit (JWT)
  activate API
  API->>BLOB: Check all receipts arrived
  BLOB-->>API: All files present
  API->>DB: UPDATE status=Submitted + audit row
  DB-->>API: OK
  API-)SB: Publish claim.submitted
  API-->>FE: 200 OK (status=Submitted)
  deactivate API
  FE-->>U: Show "Claim submitted"

  Note over SB,MGR: Part 2 - The manager is told (the user is no longer waiting)
  W->>SB: Receive next message
  SB-->>W: claim.submitted
  W->>TEAMS: Post Adaptive Card to the manager (webhook)
  TEAMS-->>W: 200 OK
  W->>SB: Complete message
  TEAMS-)MGR: Card appears in Teams

  Note over MGR,API: Part 3 - The manager approves
  MGR->>FE: Open claim, tap "Approve"
  FE->>API: POST /claims/1042/approve (JWT)
  activate API
  API->>API: Check token, manager of this claimant, status=Submitted
  API->>DB: UPDATE status=Approved + audit row
  DB-->>API: OK
  API-)SB: Publish claim.approved
  API-->>FE: 200 OK (status=Approved)
  deactivate API
  FE-->>MGR: Show "Approved"
```

What to notice:
- **Parts 1 and 3 are synchronous.** The user waits and gets an answer. The claim is saved as a Draft first, and becomes Submitted only after the receipts have arrived.
- **The receipt files go straight to Receipt storage** with a signed URL. They do not pass through the Claims API.
- **Part 2 is asynchronous.** The Claims API publishes the event and replies to the user at once. The Notification worker tells the manager later.

## 2. Error path: the receipt upload fails after the claim was created

![Receipt upload fails](sequence-error-receipt-upload-fails.png)

```mermaid
sequenceDiagram
  actor U as Staff (claimant)
  participant FE as Web app
  participant API as Claims API
  participant DB as Claims database
  participant BLOB as Receipt storage

  U->>FE: Tap "Submit claim" with 2 receipts
  FE->>API: POST /claims (JWT, claim details, receipt file names)
  API->>DB: INSERT claim (status=Draft) + audit row
  DB-->>API: claim id 1042
  API-->>FE: 201 Created (claim id, signed upload URLs)
  FE->>BLOB: PUT receipt files using signed URLs
  alt all receipts uploaded
    BLOB-->>FE: 201 Created (each file)
    FE->>API: POST /claims/1042/submit (JWT)
    API->>BLOB: Check all receipts arrived
    BLOB-->>API: All files present
    API->>DB: UPDATE status=Submitted + audit row
    API-->>FE: 200 OK (status=Submitted)
  else upload fails (connection dropped, file too large or malware found)
    BLOB--xFE: Error or timeout (the app cannot tell if the file arrived)
    FE->>API: POST /claims/1042/submit (JWT, the API checks the files)
    API->>BLOB: Check all receipts arrived
    BLOB-->>API: A file is missing
    API->>DB: UPDATE status=Draft, reason="upload_failed" + audit row
    API-->>FE: 502 Bad Gateway (Retry-After: 5)
    FE-->>U: "Upload failed. Claim saved as a draft. Try again."
  end
```

What to notice:
- The claim was saved as a Draft before the upload started, so nothing the user typed is lost.
- On failure the claim goes back to `Draft` with the reason `upload_failed`, the audit log records it, and the user gets `502` with `Retry-After`. The user can try again without retyping.

## 3. Error path: Teams fails, so the email is sent

![Teams fails](sequence-error-teams-fails.png)

```mermaid
sequenceDiagram
  participant SB as Message queue
  participant W as Notification worker
  participant TEAMS as Microsoft Teams
  participant EMAIL as Email service
  actor MGR as Line manager

  W->>SB: Receive next message
  SB-->>W: claim.submitted
  W->>TEAMS: Post Adaptive Card to the manager (webhook)
  alt Teams accepts the card
    TEAMS-->>W: 200 OK
    W->>SB: Complete message
    TEAMS-)MGR: Card appears in Teams
  else Teams fails (error or timeout, after 3 tries)
    TEAMS--xW: 5xx or timeout
    W->>EMAIL: Send email to the manager (SMTP)
    alt email accepted
      EMAIL-->>W: Accepted
      W->>SB: Complete message
      EMAIL-)MGR: Email arrives
    else email also fails
      EMAIL--xW: Error
      W->>SB: Abandon message (it returns to the queue)
      Note over SB,TEAMS: After 10 failed deliveries the message moves<br/>to the dead-letter queue and an alert fires
    end
  end
```

What to notice:
- The email is sent **only** if Teams fails, never both.
- If the email also fails, the message returns to the queue and is tried again. After 10 failed deliveries it moves to the dead-letter queue and an alert fires, so a lost notification is never silent.

## Assumptions

- **Draft first.** The claim is saved as a Draft, the receipts are uploaded, and a second call (`/submit`) makes it Submitted. This is how the design lets an upload fail without losing the claim.
- **Receipt check.** The Claims API asks Receipt storage whether all files arrived before it accepts the submit. The container diagram arrow is labelled "Issues signed URLs, checks uploads".
- **`502` for a failed upload** follows the brief's example. A `409` or `422` would also be reasonable.
- **Retries.** Three tries on Teams, and 10 delivery attempts before the dead-letter queue, are my starting numbers. They can change in a later ADR.
- **Not shown:** the sign-in with Entra ID happens before this journey. The token in each request is the `JWT`. The approved claim reaching payroll is the Export job, a separate journey.
- The worker also tells the claimant when the claim is approved. It works the same way as the manager's notification, so it is not repeated.
