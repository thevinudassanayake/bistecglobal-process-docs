# ADR 0002: Host GreenChit on Azure App Service

**In short:** we run the whole system in one place on Azure, because it is the quickest and cheapest way to start.

## Status
Accepted (date: 2026-10-12)

## Context
- The brief says we can use App Service or Container Apps. App Service is Azure's ready-made place to run a web app. Container Apps is more flexible, but you have to split your system into small packages first.
- We guess the team is small, hasn't used containers much, and has a short deadline.
- Only BISTEC staff will use it. We guess fewer than 50 claims an hour, busier at month end. That is a guess, not in the brief, so we must check it with Finance.
- The brief wants GreenChit working 99.9% of the time during office hours (08:00 to 19:00, Monday to Friday), and Submit to feel quick (under 1.5 seconds for most people).
- The background work is small: the Notification worker (sends the Teams and email messages) and the Export job (makes the payroll file each night).
- We don't know how many staff there are, or whether other BISTEC tools will share this later.

The scores are in [trade-offs/hosting-options.md](../trade-offs/hosting-options.md): App Service 21, Container Apps 20.

## Decision
We choose **Azure App Service**. Everything runs on one plan (a group of rented servers): the API, the web app, the Notification worker and the Export job.

- Size P1v3, with two servers. If one breaks, the other keeps going.
- A test copy sits next to the real one. We try each new version there first, then swap it in.
- The Export job runs on one server only, so it never makes the file twice.

The scores were close, so the total is not the reason. Two things decided it: how fast we can get started, and how easy it is for a small team to run.

## Consequences
- **Easier:** quick first setup, one place to release, one place to read logs, one login setup.
- **Harder:** every change is released together. We can't give the Notification worker more power without giving it to everything. If we forget the "one server only" setting, the nightly file could be made twice.
- **Different:** the team won't learn containers on this project.
- **Uncomfortable:** the two jobs share servers with the API. If one of them gets busy (a big export or a burst of messages), claim submissions can slow down and miss the 1.5 second goal. We accept that for now. We will set an alert for when the servers are over 70% busy, and if it happens we will write a new file and move the jobs out.

## Alternatives considered
- **Container Apps, with each part on its own:** rejected, too much extra setup for a team this size. We will look again if the jobs hurt the API.
- **Azure Functions only:** rejected, because on the cheap plan they can start slowly and risk the 1.5 second goal. The plan that fixes this costs about the same as App Service, which the team knows better.
