# ADR 0004: Store receipts in Blob Storage, with signed links and a virus check

**In short:** pictures go straight from the phone to Azure's file storage using a one-time link, and every file is virus-checked before the claim can be submitted.

## Status
Accepted (date: 2026-10-12)

## Context
- A claim has 1 to 5 receipt pictures, up to 10 MB each. Uploading must still work on a shaky connection.
- The brief says to use Azure Blob Storage with signed URLs. A signed URL is a web address that has the permission built in.
- The pictures come from staff phones, and managers and Finance open them. One bad file could reach several people.
- Only the claimant, their manager, Finance and the audit role may see a receipt.
- A signed link can't limit file size, so we check size separately.
- We don't know how long a virus check takes. We guess a few seconds.

## Decision
We keep receipts in a **private Blob Storage folder**. The API never carries the pictures.

- The API gives out **one signed link per picture**. Each link works for one exact place only, and stops after 10 minutes.
- The web app uploads straight to storage, in small pieces. If one piece fails, only that piece is sent again.
- Only JPEG and PNG pictures. The web app checks the 10 MB limit before sending, and the API checks again when it confirms the file arrived.
- **Microsoft Defender for Storage** (Azure's virus checker) scans each file. A claim can only be Submitted when every file is clean.
- A file with a virus is deleted, and the claim stays a Draft with the reason `upload_failed`.
- Viewing uses a read-only link that lasts 5 minutes, given only to people allowed to see that receipt.

## Consequences
- **Easier:** the API stays light, each picture can be retried on its own, and files are never public.
- **Harder:** submitting now waits for the virus check. If it is still running, the API says "try again in 5 seconds" and the web app retries for up to 30 seconds.
- **Different:** one more Azure service to set up and pay for.
- **Uncomfortable:** the brief wants "tap Submit to confirmation" in under 1.5 seconds. With an upload and a virus check in the middle, that can't be true for the whole journey. We read it as only the two calls to the API (save the draft, then submit). We must agree this with Finance before we build.

## Alternatives considered
- **Send pictures through the API:** rejected, because up to 50 MB per claim would load the API, and a dropped connection would restart everything.
- **Public links:** rejected, because anyone with a link could see a receipt.
- **Our own virus checker (like ClamAV):** rejected, because it needs containers, which goes against ADR 0002.
- **No virus check:** rejected, because the files come from personal phones and several people open them.
