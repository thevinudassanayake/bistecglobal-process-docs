# LearnLanka — Ambiguity Hunt Log

## Brief reference
Ambiguous phrases are in **bold**, with the finding number.

LearnLanka is a Colombo-based startup that connects O/L and A/L students with **vetted tutors** [#1] for one-to-one online sessions. They have a one-paragraph brief, no diagrams, and **three contradictory expectations from the founders** [#13].

- Students must be able to search for tutors by subject, grade, language (Sinhala, Tamil, English), and **price band** [#15]
- Students must be able to **book a 1-hour session with a tutor and pay** [#5, #6] via card or eZ Cash
- Tutors must be able to publish availability slots, **accept or decline bookings** [#4], and **cancel with at least 12 hours notice** [#3]
- The platform must charge a **15% commission** [#9] on every **completed session** [#2] and **pay tutors weekly via bank transfer** [#10]
- Privacy: comply with Sri Lanka Personal Data Protection Act 2022 — **consent capture** [#8], **deletion request flow** [#7]
- Tutor search results: returned in under 800 ms at the 95th percentile **from a Sri Lankan ISP** [#14]
- **Mobile-first product — at least 80% of usage is expected on Android devices** [#11]
- Video calling will be outsourced to a third-party (**Daily.co or 100ms** [#12])

## Findings
| # | Quote | Why ambiguous | Clarification question | Priority |
|---|-------|---------------|------------------------|----------|
| 1 | "vetted tutors" | Not clear what "vetted" means or who checks. Unqualified tutors could teach students. | Which documents must a tutor provide, and who approves them? | H |
| 2 | "completed session" | Commission and payout depend on it. If it only means the slot time ended, a tutor who never joined still gets paid. | Is a session "completed" when the slot ends, or only when both people joined the call? | H |
| 3 | "cancel with at least 12 hours notice" | Only covers the normal case. Nothing on a late cancel or a tutor no-show, and the student's money is involved. | If a tutor cancels within 12 hours or does not show, does the student get a full refund and does the tutor face any penalty? | H |
| 4 | "accept or decline bookings" | A tutor may never reply while the student's money is stuck. | How many hours does a tutor have to reply before the request is cancelled and refunded? | H |
| 5 | "book a 1-hour session with a tutor and pay" | Does not say when the student pays: at request or after the tutor accepts. This changes the whole refund flow. | Is the student charged at request time or only after the tutor accepts? | H |
| 6 | "book a 1-hour session" | Nothing about a student cancelling or not showing up. | Can a student cancel, and what refund do they get? If a student does not join, is the tutor still paid? | H |
| 7 | "deletion request flow" | The law says delete on request, but we must keep payment records for accounting. The two clash. | Do we delete everything, or remove personal details and keep payment records? Within how many days? | H |
| 8 | "consent capture" | Most students are under 18 and the brief does not say who consents. | For under-18s, must a parent or guardian give consent before the account is created? | H |
| 9 | "15% commission" | Does not say whether the PayHere fee comes out of the 15% or the tutor's 85%. | Is the PayHere fee paid from LearnLanka's 15% or from the tutor's share? | M |
| 10 | "pay tutors weekly via bank transfer" | No payout day or cut-off, no word on approval, and no way of sending it to Sampath Vishwa (API, file or portal). | Which day and cut-off time? Does an Ops Admin approve first? How does Sampath Vishwa accept a bulk payout? | M |
| 11 | "Mobile-first … Android devices" | Could mean a mobile website or a native Android app, which are very different builds. | Is launch a responsive website or a Play Store app? | H |
| 12 | "Daily.co or 100ms" | The video provider is not chosen and the two have different setups and prices. | Which provider will we use and who decides? | M |
| 13 | "three contradictory expectations from the founders" | The brief never says what they are, so we might pick a side by accident. | What are the three conflicting expectations and who has the final say? | H |
| 14 | "from a Sri Lankan ISP" | Speed depends on the network; no ISP or connection type is named. | Which ISP and connection (for example Dialog 4G) is the 800 ms target tested on? | M |
| 15 | "price band" | The bands are not defined. | Which bands should students filter by (for example under Rs 1,000 / 1,000–2,000 / over 2,000)? | L |

**Priority:** H = affects money, law, safety or the design. M = affects planning or measurement. L = a detail that can be decided later.

## Results Summary
| Metric | Target | Achieved |
|--------|--------|----------|
| Items found | 10+ | 15 |
| High-priority items | 3+ | 10 (#1–8, #11, #13) |
| Items convertible to test cases | 5+ | 8 (#2, 3, 4, 5, 6, 7, 9, 10) |

These 8 become test cases once answered, for example "no tutor reply after 24 hours means auto-cancel and refund".

## Top 3 questions to ask the founders
1. What makes a session "completed": the slot ending, or both people joining? (#2)
2. Is the student charged at request time or after the tutor accepts? (#5)
3. How long does a tutor have to reply before the request is cancelled and refunded? (#4)

## Reflection
**What kind of ambiguity tripped me up most?** The "what if it does not happen?" cases: a tutor who never replies, a late cancel, a no-show. The brief only describes the happy path. I found them by following one booking from search to payout and asking "what if this step fails?".

**Which question is most likely to change the architecture?** #2. If "completed" only means the slot ended, a simple timer is enough. If both people must join, we need attendance data from the video provider before calculating commission and payouts. That is a new integration. Guessing wrong means paying tutors for classes that never happened, and it costs far more to fix after the system is built than to ask now.
