# Prompt template for the AI coding agent

Use this for every implementation prompt. Write the constraints once, then paste the spec and the acceptance criteria below them. Change only the "Do now" line.

```
Repo folder: <full path of the repo folder>

You are implementing a feature in TypeScript. Below is the complete spec and
acceptance criteria. Implement the feature so that the acceptance criteria
listed under "Do now" can be made to pass with a small test runner.

Constraints:
- Language: TypeScript, run directly by Node 24 with no build step.
- Test runner: Node's built-in `node:test` and `node:assert`. Do not add any
  dependencies.
- Create or edit only these files inside the repo folder:
  src/types.ts, src/categoriser.ts, src/llm-categoriser.ts,
  src/rule-based-categoriser.ts, tests/fakes.ts, tests/acceptance.test.ts,
  package.json (a test script only). Touch nothing else, including spec/ and
  ai-session/.
- Do NOT invent fields, endpoints, error codes or behaviour that are not in
  the spec.
- Keep the AI path (llm-categoriser.ts) and the rule-based path
  (rule-based-categoriser.ts) in separate files.
- Every outside service (storage, text reader, AI service, feature switch,
  event logging) is passed in as a plain object. Write no real Azure code.
- Export `categorise(request, deps)` returning `{ status, body }`, and
  `recordDecision(input, deps)`.
- Before writing code, list any ambiguities in the spec you would want
  clarified. Then list the assumptions you made. Then write the code.
- Run the tests with `node --test` and report the result.

Do now: <list of AC numbers>

<paste spec.md>
<paste acceptance.md>
```
