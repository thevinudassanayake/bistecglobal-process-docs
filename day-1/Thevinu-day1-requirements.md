# LearnLanka — Requirements Document

## 1. Problem Statement
O/L and A/L students in Sri Lanka have no single trusted place to find a tutor who fits their subject, grade, language and budget. They message many tutors and go back and forth to agree a time. Tutors lose unpaid time making meeting links and chasing payments. LearnLanka gives students one place to find vetted tutors, book and pay for a 1-to-1 online class and join it by video, and pays tutors every week.

## 2. Personas
- **Student** – O/L or A/L student, often under 18.
  - *Goal:* find the right tutor and book without texting back and forth.
  - *Frustration:* wasting time on tutors who are too expensive, busy or unreliable.
- **Tutor** – teaches the O/L or A/L syllabus.
  - *Goal:* show free times, teach online, get paid weekly.
  - *Frustration:* unpaid admin and late payments.
- **Operations Admin** – LearnLanka staff.
  - *Goal:* only checked tutors go live, and every payout is correct.
  - *Frustration:* doing commission maths by hand.

## 3. Functional Requirements
**Student**
1. Search approved tutors by subject, grade, language (Sinhala, Tamil, English) and price band.
2. See "No tutors found" when nothing matches.
3. Book an open 1-hour slot and pay by card or eZ Cash.
4. See each booking's status (Waiting for tutor, Confirmed, Cancelled, Completed).
5. Get the video link for a confirmed booking.
6. Rate the tutor (1–5 stars, one-line comment) after a completed session.
7. Request deletion of personal data.
8. A student under 18 needs parent or guardian consent before an account is created.

**Tutor**
9. Sign up and submit qualifications for approval.
10. Publish, change and remove 1-hour slots; no slots in the past or overlapping.
11. Accept or decline a booking request.
12. Cancel a confirmed booking only if it starts in 12 hours or more.
13. Rate the student (1–5 stars, one-line comment) after a completed session.

**Ops Admin**
14. Approve or reject a new tutor, with a reason for rejection.
15. Review and approve the weekly payout before it is sent to the bank.
16. See open deletion requests and mark them done.

**System**
17. Hold a slot for one student while they pay; release it if payment fails or times out.
18. Send the booking request to the tutor only after payment succeeds.
19. Create a private video session when the tutor accepts.
20. Send SMS when a booking is confirmed, declined or cancelled, and before a session.
21. Auto-cancel a request if the tutor does not reply in time.
22. Fully refund the student if the tutor declines, does not reply, cancels or does not join.
23. Mark a session "Completed" only when both tutor and student joined the video call.
24. Keep 15% commission on each completed session; tutor payout is the other 85%, calculated weekly.
25. Send the approved payout to Sampath Vishwa for bank transfer.
26. Show all screens in Sinhala, Tamil and English.

## 4. Non-Functional Requirements
| Category | Metric | Target | How we'll measure it |
|---|---|---|---|
| Latency | Tutor search response, p95 | < 800 ms from a Sri Lankan ISP | Azure Application Insights |
| Availability | % successful booking-endpoint responses | ≥ 99.5% per calendar month | Azure Monitor + synthetic checks |
| Concurrency | Simultaneous video sessions | ≥ 200 in the first 6 months | Video provider dashboard |
| Privacy – consent | Accounts with recorded consent | 100% | Database check |
| Privacy – deletion | Deletion requests done in time | 100% within 30 days (example, see Ambiguity #7) | Admin request log |
| Payment data | Card/eZ Cash details stored by us | 0 records (PayHere holds them; we keep only payment ID, amount, status) | Database schema check |

**Constraints (fixed by the brief):** mobile-first (80%+ Android); Azure (App Service, SQL, Blob); video by Daily.co or 100ms; PayHere for payments; Sampath Vishwa for payouts.

## 5. Assumptions
1. An Ops Admin checks tutor qualifications by hand before a tutor appears in search. (#1)
2. The student pays when requesting a booking, not after the tutor accepts. (#5)
3. The tutor has 24 hours to reply, then the request is cancelled and refunded. (#4)
4. A slot is held for 15 minutes while the student pays.
5. "Completed" means both people joined; the video provider tells us who joined. (#2)
6. A tutor cannot cancel inside 12 hours on the platform; they contact the Ops Admin. (#3)
7. Students follow the same 12-hour cancel rule with a full refund; a student no-show is not "Completed" and its money outcome is undecided. (#6)
8. We build a responsive website, not a native app. (#11)
9. Users sign up with mobile number and an SMS code (so an SMS gateway is needed).
10. An Ops Admin approves payouts; the payout file goes to the bank by SFTP. (#10)

## 6. Out of Scope
1. Native mobile apps (Android APK or iOS).
2. Rescheduling a booking (cancel and rebook instead).
3. Chat between students and tutors outside the video call.
4. Group classes.
5. Recording video sessions.
6. Discounts and promo codes.
