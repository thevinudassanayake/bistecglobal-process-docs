# ADR 0003: Use Azure SQL Database for claims and the audit log

**In short:** we keep claims and their history in a table-style database, because the two must always be saved together.

## Status
Accepted (date: 2026-10-12)

## Context
- The brief says Azure SQL or Cosmos DB.
- Our data fits in tables. A claim has a person, a manager, a status and receipts. Every status change also adds a history line.
- A status change and its history line must be saved together, or not at all. A new status with no history line would break the audit rule.
- The questions we ask are things like "claims waiting for this manager" and "approved claims not yet exported".
- The history has to be tamper-proof (we can tell if anyone changed it) and kept for 7 years.
- We guess the team knows SQL and .NET better than Cosmos DB.
- We don't know how many claims there will be. We guess thousands a year, not millions, so size is not a big worry.

## Decision
We choose **Azure SQL Database**, a small size to start with (2 cores).

- The history is kept in a special "ledger" table. It only lets you add rows, and any change or delete would show up.
- A claim update and its history line are saved in a single step.
- Backups are kept for 7 years, as well as the normal short-term backups.
- Receipt pictures are not in the database. Only their names and locations are (see ADR 0004).

## Consequences
- **Easier:** claims and history can't get out of step. The manager's list and the payroll file are simple questions to ask. The team knows the tools.
- **Harder:** changing the tables later needs careful steps. To handle more load, we buy a bigger size.
- **Different:** the history table is built differently from the others, and can't be edited like them.
- **Uncomfortable:** a ledger row can never be fixed or deleted. If we write a wrong history line, or someone asks us to delete their personal data, we can't. So we keep very little in those rows (just IDs, status, time and reason), and we must check with Finance and legal how the 7-year rule and privacy requests fit together.

## Alternatives considered
- **Cosmos DB:** rejected, because it is built for a different kind of data, and our questions need things linked together. It would be harder to design and to pay for. Its strengths (huge worldwide scale, flexible shapes) are not needed here.
- **Azure SQL plus a locked copy of the history in Blob Storage:** rejected, because we would have two places to keep matching. The ledger gives the same protection inside the database.
- **PostgreSQL:** rejected, because the team knows SQL Server, and the ledger feature exists only in Azure SQL.
