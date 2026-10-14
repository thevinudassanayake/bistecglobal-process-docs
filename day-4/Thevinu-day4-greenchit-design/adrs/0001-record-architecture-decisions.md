# ADR 0001: Record architecture decisions

**In short:** we write down every big design decision, and the reason for it, in a short file.

## Status
Accepted (date: 2026-10-12)

## Context
- GreenChit will be built and looked after by a team, and people will come and go.
- The audit log has to be kept for 7 years. So the system will be around much longer than the people who designed it.
- When we decide something in a meeting, we forget the reason a few months later. Then we argue about it all over again.
- We don't know yet how many big decisions there will be. We guess about ten in the first six months.

## Decision
From now on, we write each big design decision as one short file in the `adrs` folder.

- The files are numbered in order: 0001, 0002 and so on. A number is never used twice.
- Every file has the same five parts: Status, Context, Decision, Consequences and Alternatives. It should fit on a phone screen, about 500 words.
- We write it on the day we decide, not later.
- A teammate reads it before it is added, the same way they would check code.
- We never delete an old file. If we change our mind, we write a new file and mark the old one "Replaced by ADR 000X".

## Consequences
- **Easier:** a new person can read why things are the way they are. Arguments end faster because the answer is written down.
- **Harder:** writing a page for every big decision takes time, even in a busy week.
- **Different:** a decision isn't final until it is written down and a teammate has read it.
- **Uncomfortable:** the files can get out of date without anyone noticing. A wrong file that still says "Accepted" is worse than no file, because people will trust it. So whoever changes the design must also update the matching file, and the person checking must look for that.

## Alternatives considered
- **A page in a wiki:** rejected, because it sits away from the code and nobody notices when it gets out of date.
- **Only meeting notes:** rejected, because nobody reads them a month later.
- **Nothing written:** rejected, because we would repeat the same arguments every time the team changes.
