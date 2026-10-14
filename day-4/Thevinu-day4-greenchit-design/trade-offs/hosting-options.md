# GreenChit — Hosting Options Compared

**Supports:** [ADR 0002](../adrs/0002-hosting-platform.md)

## The two options

- **Option A: App Service, everything together.** The API, the web app, the Notification worker and the Export job all run on one rented plan in Azure.
- **Option B: Container Apps, split up.** The web app, the API, the Notification worker and the Export job each run on their own. Each one has to be packaged first, the packages need a store, and the setup is written as code.

Scores go from 1 (bad) to 5 (good). Every score has a reason.

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

## Decision and why

**We choose App Service.** It wins 21 to 20, but the scores are so close that the total is not the reason. Two things decided it:

1. **How fast we can get started.** The business wants a working version soon, and the team hasn't used containers much. Option A skips the packaging, the store and the setup code.
2. **How easy it is for a small team to run.** One app with one release process is easier to look after than four.

Cost helped, but it did not decide it.

**What we give up:** releasing parts on their own, and growing parts on their own. Those are the two rows where Option B wins big.

**What would make us switch:** the two jobs slow down the API in real use, a change to one part keeps holding up the others, or the servers stay over 70% busy. Then we write a new ADR and move the two jobs to Container Apps first.
