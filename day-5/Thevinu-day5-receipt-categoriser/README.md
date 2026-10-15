# Receipt Categoriser (GreenChit)

A first version of a feature that suggests a category for an uploaded receipt (Meals, Travel, Lodging, Office Supplies or Other), with a score for how sure it is.

## Run the tests

1. Install Node 24 or newer. Nothing else is needed.
2. Open a terminal in this folder.
3. Run `node --test`
4. You should see **15 tests pass**. One of them waits about 2 seconds on purpose.

## What is in each folder

| Folder | What is in it |
|--------|---------------|
| `spec/` | The spec (`spec.md`) and the 6 acceptance criteria (`acceptance.md`). |
| `src/` | The code. `categoriser.ts` is the main flow. `llm-categoriser.ts` asks the AI. `rule-based-categoriser.ts` is the backup that looks for words. `ai-implementation-prompt.md` is the message template we gave the AI agent. |
| `tests/` | The tests. |
| `ai-session/` | The two messages sent to the AI agent and its answers, word for word, plus `implementation-report.md`. |

## What the tests do

Azure is not connected yet. So each test uses **fake services** (in `tests/fakes.ts`) that give the answers we choose. A test does three things: it sets up the fake answers, runs the code once, and checks what came back and what was logged.

**The 6 acceptance criteria** (one test each, named AC-01 to AC-06):

| Test | What it checks, in plain words |
|------|-------------------------------|
| AC-01 | A clear meal receipt gives Meals, 0.86, from the AI, and one log entry. |
| AC-02 | A mixed receipt gives a low score (0.45), so it is marked "Needs review". |
| AC-03 | When the AI is down, the backup rules pick the category from words like "taxi" and "toll". |
| AC-04 | When the receipt can't be read, the answer is "Other" with a clear message, and the AI is never asked. |
| AC-05 | A file one byte over 10 MB is refused. |
| AC-06 | The log entry holds no name, card number, receipt words or file name. |

**9 extra tests** (named "Extra"). They check other rules in the spec:

| Test | What it checks, in plain words |
|------|-------------------------------|
| Extra: 0.60 is not review, 0.59 is | The exact edge of the "Needs review" line. |
| Extra: AI too slow | After 2 seconds the backup rules answer, and the whole call is under 4 seconds. |
| Extra: reading service unavailable | If the reading service is down, the answer is a 502 error. |
| Extra: exactly 10 MB is accepted | A file of exactly 10 MB is fine. |
| Extra: bad input | A missing file name, a `.gif`, or another claim's file gets a 400 error. |
| Extra: file not in storage | A file that isn't there gets a 404 error. |
| Extra: switch off | With the switch off, the answer is 404 and nothing else is called. |
| Extra: final choice is logged | The final choice is logged, and `accepted` is true only when it matches the suggestion. |
| Extra: unusable AI answer | If the AI gives a made-up category or a score of 1.4, the backup rules are used. |

## What is real and what is not

- **Fake services only.** No real Azure code exists yet. The speed, the cost and the quality of the AI answers are not tested.
- A separate AI agent wrote the code and the tests. It saw only the messages we sent it. The spec, the messages, and the checking of its work are mine. `ai-session/implementation-report.md` says where the agent went off the spec.
- The code and tests are exactly as the agent wrote them. Only the spec and the other documents were rewritten in plainer words.
