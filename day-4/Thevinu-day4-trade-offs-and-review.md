# GreenChit — Trade-offs and Design Review

**Author:** Thevinu · **Status:** Draft · **Part:** Deliverable 4 (trade-off table and design review)

## Setup

- **Two options** for where GreenChit runs on Azure:
  - **Option A: App Service, everything together.** The API, the web app, the Notification worker and the Export job run on one rented plan.
  - **Option B: Container Apps, split up.** The web app, the API, the Notification worker and the Export job each run on their own.
- **What matters most to the business:** GreenChit is a small internal tool that Finance wants working soon, and a small team will run it. So **how fast we can get started** and **how easy it is for a small team to run** count the most. Cost comes next. Releasing parts on their own and handling growth matter less at this size.
- Scores go from 1 (bad) to 5 (good). The reason for every score is in the table. The same table is in `Thevinu-day4-greenchit-design/trade-offs/hosting-options.md`, which supports ADR 0002.

## Scores

| Quality attribute | A: App Service | Why A | B: Container Apps | Why B |
|-------------------|:---:|-------|:---:|-------|
| Time to first deploy | 5 | One place to set up and one button to release. Test copies are built in. | 2 | We'd have to package each part, set up a store for the packages, and write setup code before we could release anything. |
| Cost (low spend) | 5 | One rented plan pays for everything. | 2 | At least one copy of four separate apps always running, plus the package store. |
| Easy for a small team to run | 4 | Few things to watch and one place to read logs. We lose a point because the two jobs share servers with the API. | 3 | Clear separation, but more things to look after. |
| Releasing parts on their own | 1 | Any change releases the whole thing together. | 5 | Each part can be released alone. |
| Handling growth | 2 | It grows as one block. We can't give only the Notification worker more power. | 5 | Each part grows on its own, and the Notification worker can grow when messages pile up. |
| Same login rules everywhere | 4 | One app, one login check, one setup. | 3 | Every separate part has to check logins, so the rules could slowly drift apart. |
| **Total** | **21** | | **20** | |

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Quality attributes scored | 6 | 6 |
| Cells with a written justification | 12 | 12 |
| Decision-affecting attributes identified | 2-3 | 2 (time to first deploy, easy for a small team to run) |

## Decision and rationale

**We choose Option A, App Service.** It wins 21 to 20, but the scores are so close that the total is not the reason. Two things decided it:

1. **How fast we can get started.** The business wants a working version soon, and the team hasn't used containers much. Option A skips the packaging, the store and the setup code.
2. **How easy it is for a small team to run.** One app with one release process is easier to look after than four.

Cost helped, but it did not decide it.

**What we give up:** releasing parts on their own, and growing parts on their own. Those are the two rows where Option B wins big.

**What would make us switch:** the two jobs slow down the API in real use, a change to one part keeps holding up the others, or the servers stay over 70% busy. Then we write a new ADR and move the two jobs to Container Apps first.

**An honest note about the scores:** I started from the example scores in the Day 4 brief, then wrote my own reason for each one. The two I'm least sure about are "Easy for a small team to run" for A (4) and "Same login rules everywhere" for B (3). After a night's sleep I will re-read the table, change one score, and write down why.

## Self-check before the review

This is **my own check**, using the five review questions. It is not feedback from another pair.

| Question | My honest answer |
|----------|------------------|
| Does the design solve the problem in the brief? | Mostly. Submitting, approving, notifying, the audit log and the payroll file are all covered. Two gaps: "ask for more information" has no sequence diagram, and the brief doesn't say who marks a claim as Paid. |
| Did we think about what can go wrong? | Two things: a receipt upload failing, and Teams failing. Not covered yet: the database being down, and the API crashing after it saves a claim but before it leaves the note for the manager (this is written up as an open risk in the design pack). The Day 3 plan was for BookSwap, so it hasn't been applied to GreenChit. |
| Are the trade-offs clear? | Yes. Every ADR lists the options we turned down. Only the hosting choice has a scored table. |
| Could a new engineer pick this up? | For the design, yes. The README gives a reading order. There are no build or release instructions yet, which is fine at this stage. |
| Where would I push back? | (1) The 1.5 second Submit goal can't be true for the whole journey once the upload and the virus check are included (ADR 0004). (2) The two jobs share servers with the API (ADR 0002). (3) The locked history rows can never be erased, which may clash with privacy requests (ADR 0003). |

## Design review feedback (received from another pair)

_To be filled in after the review session. Don't write anything here that a reviewer didn't actually say._

- **Reviewed by:** ______
- **Date:** ______

**3 strengths**
1. ______
2. ______
3. ______

**3 weaknesses or risks**
1. ______
2. ______
3. ______

**2 improvements** (each says which file, which section, and what to change)
1. File: ______ · Section: ______ · Change: ______
2. File: ______ · Section: ______ · Change: ______

**My reply:** for each point, say what I accept, what I push back on, and why.

## Design review feedback (given to another pair)

_To be filled in after I have read the other pair's design pack._

- **Pack reviewed (pair and project):** ______
- **Date:** ______

**3 strengths**
1. ______
2. ______
3. ______

**3 weaknesses or risks**
1. ______
2. ______
3. ______

**2 improvements** (each says which file, which section, and what to change)
1. File: ______ · Section: ______ · Change: ______
2. File: ______ · Section: ______ · Change: ______

*Drafted with AI assistance (Claude). The review sections stay blank until real feedback exists.*
