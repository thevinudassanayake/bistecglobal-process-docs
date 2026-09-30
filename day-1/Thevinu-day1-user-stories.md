# LearnLanka — User Story Set v0.1

INVEST key: I Independent, N Negotiable, V Valuable, E Estimable, S Small, T Testable. `[x]` = passes, `[ ]` = does not, with the reason.

---

## Story 1: Search for a Tutor
**As a** Student
**I want** to search tutors by subject, grade, language and price band
**So that** I find a tutor who fits my needs and budget.

### Acceptance Criteria
- **Given** approved tutors exist for A/L Physics in English under Rs 1,500 **when** I search with those four filters **then** only matching tutors show and the first page loads within 800 ms.
- **Given** no approved tutor matches my filters **when** I search **then** I see "No tutors found".
- **Given** a tutor is not yet approved **when** I search for their subject **then** they do not appear.

*Traces to:* FR 1, 2 · NFR Latency

### INVEST self-check
`[x] I [x] N [x] V [x] E [x] S [x] T`

---

## Story 2: Book and Pay for a Slot
**As a** Student
**I want** to book an open 1-hour slot and pay by card or eZ Cash
**So that** my class time is secured.

### Acceptance Criteria
- **Given** I picked an open slot **when** my payment succeeds **then** the booking shows "Waiting for tutor" and no card details are stored by LearnLanka.
- **Given** I picked an open slot **when** my payment fails **then** no request goes to the tutor and the slot is open again.
- **Given** another student took the slot first **when** I try to pay **then** I am told it is unavailable and I am not charged.

*Traces to:* FR 3, 17, 18 · NFR Payment data

### INVEST self-check
`[x] I [x] N [x] V [x] E [ ] S [x] T`
- S not ticked: payment, slot hold and failure cases together are big; could split into "hold slot" and "pay".

---

## Story 3: Publish Available Slots
**As a** Tutor
**I want** to publish my free 1-hour slots
**So that** students only book me when I am free.

### Acceptance Criteria
- **Given** I am an approved tutor **when** I publish a future 1-hour slot **then** students can see and book it.
- **Given** I have a slot 4:00–5:00 PM **when** I publish 4:30–5:30 PM the same day **then** it is rejected as overlapping.
- **Given** a date in the past **when** I publish a slot **then** it is rejected.

*Traces to:* FR 10

### INVEST self-check
`[x] I [x] N [x] V [x] E [x] S [x] T`

---

## Story 4: Accept or Decline a Booking
**As a** Tutor
**I want** to accept or decline booking requests
**So that** I control my own schedule.

### Acceptance Criteria
- **Given** a paid request is waiting **when** I accept **then** the booking is "Confirmed" and both of us get the video link.
- **Given** a paid request is waiting **when** I decline **then** the booking is "Declined" and the student is fully refunded.
- **Given** I do not reply **when** the time limit passes **then** the booking is cancelled and the student is fully refunded.

*Traces to:* FR 11, 19, 21, 22

### INVEST self-check
`[x] I [x] N [x] V [ ] E [x] S [x] T`
- E not ticked: the reply time limit is unknown (Ambiguity #4); treated as a setting.

---

## Story 5: Rate the Tutor
**As a** Student
**I want** to rate my tutor 1–5 stars with a one-line comment
**So that** other students can judge the tutor before booking.

### Acceptance Criteria
- **Given** my session is "Completed" **when** I submit 4 stars and a comment **then** it is saved and the tutor's average rating updates.
- **Given** my session was cancelled or the tutor did not join **when** I try to rate **then** I am not allowed to.

*Traces to:* FR 6, 23

### INVEST self-check
`[x] I [x] N [x] V [x] E [x] S [x] T`

---

## Story 6: Approve Weekly Payouts
**As an** Ops Admin
**I want** to review a calculated weekly payout summary and approve it
**So that** tutors are paid correctly without hand calculations.

### Acceptance Criteria
- **Given** a tutor had 3 completed sessions at Rs 2,000 **when** I open the summary **then** it shows Rs 5,100 for the tutor and Rs 900 commission.
- **Given** a session was refunded **when** I open the summary **then** it is not included.
- **Given** I approved the summary **when** I confirm **then** the payout goes to Sampath Vishwa and each tutor shows "Sent".

*Traces to:* FR 15, 24, 25

### INVEST self-check
`[x] I [x] N [x] V [ ] E [ ] S [x] T`
- E not ticked: how Sampath Vishwa accepts payouts is unknown (Ambiguity #10).
- S not ticked: calculation, review and bank send could be split into "see summary" and "approve and send".
