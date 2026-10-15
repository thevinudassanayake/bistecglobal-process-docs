# Receipt Categoriser (GreenChit)

Suggests a category (Meals, Travel, Lodging, Office Supplies or Other) for an uploaded receipt, with a score for how sure it is.

## Run the tests

1. Install Node 24 or newer. Nothing else is needed.
2. Open a terminal in this folder.
3. Run `node --test`
4. You should see **15 tests pass**. One waits about 2 seconds on purpose.

## Folders

| Folder | What is in it |
|--------|---------------|
| `spec/` | The spec and the 6 acceptance criteria. |
| `src/` | The code: `categoriser.ts` (main flow), `llm-categoriser.ts` (the AI), `rule-based-categoriser.ts` (the backup rules), `types.ts`, and `ai-implementation-prompt.md` (the message template given to the AI agent). |
| `tests/` | The tests, and `fakes.ts` (fake versions of the Azure services). |
| `ai-session/` | The messages sent to the AI agent and its answers, word for word, and `implementation-report.md`. |

## What the tests check

Azure is not connected, so each test uses fake services that give the answers we choose. The test runs the code once and checks the answer and the log.

| Test | What it checks |
|------|----------------|
| AC-01 | A clear meal receipt gives Meals, 0.86, from the AI, and a log entry. |
| AC-02 | A mixed receipt gives a low score (0.45), so "Needs review". |
| AC-03 | When the AI is down, the backup rules choose Travel from "taxi" and "toll". |
| AC-04 | An unreadable receipt gives "Other" and a clear message. |
| AC-05 | A file one byte over 10 MB is refused. |
| AC-06 | The log entry holds no name, card number, receipt words or file name. |
| 9 "Extra" tests | The other rules in the spec: the exact 0.6 edge, an AI that is too slow, the reader being down, exactly 10 MB, bad input, a missing file, the switch off, the final-choice log, and an unusable AI answer. |

## What is real and what is not

- Only fake services are used. No real Azure code exists, so the real speed, cost and AI quality are not tested.
- A separate AI agent wrote the code and tests, exactly as saved. The spec, the messages and the checking are mine.
