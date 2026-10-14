# Receipt Categoriser (GreenChit)

A first version of the feature that suggests an expense category (Meals, Travel, Lodging, Office Supplies or Other) for an uploaded receipt, with a confidence score.

## Run the tests

1. Install Node 24 or newer. Nothing else is needed.
2. Open a terminal in this folder.
3. Run `node --test`
4. You should see **15 tests pass**. One of them waits about 2 seconds on purpose.

## What is here

| Folder | What it holds |
|--------|---------------|
| `spec/` | The feature spec (`spec.md`) and the 13 acceptance criteria (`acceptance.md`). |
| `src/` | The code. `categoriser.ts` is the main flow, `llm-categoriser.ts` is the AI path, `rule-based-categoriser.ts` is the fallback. `ai-implementation-prompt.md` is the prompt template. |
| `tests/` | One test for each acceptance criterion, plus two extra checks. |
| `ai-session/` | The two prompts sent to the AI agent and its answers, word for word, and `implementation-report.md`. |

## What is real and what is not

- **Stand-ins only.** The tests use fake versions of Azure OpenAI, Document Intelligence, App Configuration, Receipt storage and Application Insights. No real Azure code exists yet.
- The code, the tests and the saved answers were produced by a separate AI agent that saw only the prompt. The spec, the prompts and the checks of its work are mine. `ai-session/implementation-report.md` says where the agent went off the spec.
