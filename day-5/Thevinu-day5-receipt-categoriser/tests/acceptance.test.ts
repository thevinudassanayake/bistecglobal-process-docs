import { test } from "node:test";
import assert from "node:assert/strict";
import { categorise, recordDecision } from "../src/categoriser.ts";
import { makeDeps } from "./fakes.ts";

const req = (receiptFile?: string, claimId = "1042") => ({
  claimId,
  body: receiptFile === undefined ? {} : { receiptFile },
});
const FILE = "claim-1042/receipt.jpg";

test("AC-01 happy path: clear meal", async () => {
  const { deps, calls } = makeDeps();
  const r = await categorise(req(FILE), deps);
  assert.equal(r.status, 200);
  assert.partialDeepStrictEqual(r.body, {
    category: "Meals",
    confidence: 0.86,
    source: "llm",
    needsReview: false,
    message: null,
  });
  const ev = calls.events.find((e) => e.name === "categoriser.suggested");
  assert.ok(ev);
  assert.equal(ev.props.category, "Meals");
  assert.equal(ev.props.confidence, 0.86);
  assert.equal(ev.props.source, "llm");
});

test("AC-02 ambiguous receipt", async () => {
  const { deps } = makeDeps({
    text: "restaurant meal and a box of pens",
    llm: { category: "Other", confidence: 0.45, tokens: 90 },
  });
  const r = await categorise(req(FILE), deps);
  assert.equal(r.status, 200);
  assert.partialDeepStrictEqual(r.body, { category: "Other", confidence: 0.45, needsReview: true });
});

test("AC-03 boundary: 0.60 is not review, 0.59 is", async () => {
  for (const [c, expected] of [[0.6, false], [0.59, true]] as const) {
    const { deps } = makeDeps({ llm: { category: "Meals", confidence: c, tokens: 1 } });
    const r = await categorise(req(FILE), deps);
    assert.equal((r.body as any).needsReview, expected, `confidence ${c}`);
  }
});

test("AC-04 AI unavailable: fallback", async () => {
  const { deps } = makeDeps({ llmFails: true, text: "City Taxi, Highway Toll, Total LKR 1,800" });
  const r = await categorise(req(FILE), deps);
  assert.equal(r.status, 200);
  assert.partialDeepStrictEqual(r.body, { category: "Travel", confidence: 0.5, source: "rule-based", needsReview: true });
  const none = makeDeps({ llmFails: true, text: "Total LKR 100 thank you" });
  const r2 = await categorise(req(FILE), none.deps);
  assert.partialDeepStrictEqual(r2.body, { category: "Other", confidence: 0.2, source: "rule-based" });
});

test("AC-05 AI too slow: fallback within 4 s", async () => {
  const { deps } = makeDeps({ llmDelayMs: 2500, text: "City Taxi, Highway Toll" });
  const t0 = Date.now();
  const r = await categorise(req(FILE), deps);
  assert.ok(Date.now() - t0 < 4000);
  assert.equal(r.status, 200);
  assert.equal((r.body as any).source, "rule-based");
});

test("AC-06 receipt cannot be read", async () => {
  const { deps, calls } = makeDeps({ text: null });
  const r = await categorise(req(FILE), deps);
  assert.equal(r.status, 200);
  assert.partialDeepStrictEqual(r.body, {
    category: "Other",
    confidence: 0,
    source: "rule-based",
    needsReview: true,
    message: "We couldn't read this receipt. Please choose a category.",
  });
  assert.equal(calls.llm, 0);
  assert.equal(calls.events.find((e) => e.name === "categoriser.suggested")!.props.outcome, "unreadable");
});

test("AC-07 text reader unavailable", async () => {
  const { deps } = makeDeps({ readerFails: true });
  const r = await categorise(req(FILE), deps);
  assert.equal(r.status, 502);
  assert.equal((r.body as any).error, "upstream_unavailable");
});

test("AC-10 no personal data in events", async () => {
  const text = "Nimal Perera, Card ending 4242, Green Leaf Restaurant";
  const { deps, calls } = makeDeps({ text });
  await categorise(req(FILE), deps);
  const ev = calls.events.find((e) => e.name === "categoriser.suggested")!;
  const json = JSON.stringify(ev.props);
  for (const bad of ["Nimal", "Perera", "4242", "Card", "receipt.jpg", "claim-1042/", "Green Leaf"]) {
    assert.ok(!json.includes(bad), bad);
  }
  assert.deepEqual(Object.keys(ev.props).sort(), [
    "category", "claimId", "confidence", "durationMs", "llmTokens",
    "needsReview", "outcome", "source", "suggestionId",
  ]);
});

test("AC-11 feature switch off", async () => {
  const { deps, calls } = makeDeps({ enabled: false });
  const r = await categorise(req(FILE), deps);
  assert.equal(r.status, 404);
  assert.equal((r.body as any).error, "feature_disabled");
  assert.equal(calls.reader + calls.llm + calls.storage, 0);
  assert.equal(calls.events.length, 0);
});

test("AC-12 final choice is logged", async () => {
  for (const [final, accepted] of [["Meals", true], ["Travel", false]] as const) {
    const { deps, calls } = makeDeps();
    await recordDecision(
      { suggestionId: "s-1", claimId: "1042", suggestedCategory: "Meals", finalCategory: final },
      deps,
    );
    assert.equal(calls.events.length, 1);
    assert.equal(calls.events[0]!.name, "categoriser.decided");
    assert.partialDeepStrictEqual(calls.events[0]!.props, {
      suggestionId: "s-1", suggestedCategory: "Meals", finalCategory: final, accepted,
    });
  }
});

test("AC-13 unusable AI answer: fallback", async () => {
  for (const llm of [
    { category: "Groceries", confidence: 0.9, tokens: 5 },
    { category: "Meals", confidence: 1.4, tokens: 5 },
  ]) {
    const { deps } = makeDeps({ llm, text: "City Taxi, Highway Toll" });
    const r = await categorise(req(FILE), deps);
    const b = r.body as any;
    assert.equal(r.status, 200);
    assert.equal(b.source, "rule-based");
    assert.ok(["Meals", "Travel", "Lodging", "Office Supplies", "Other"].includes(b.category));
    assert.ok(b.confidence <= 0.5);
  }
});

test("AC-08 file too large", async () => {
  const { deps, calls } = makeDeps({ files: { [FILE]: 10_485_761 } });
  const r = await categorise(req(FILE), deps);
  assert.equal(r.status, 413);
  assert.equal((r.body as any).error, "too_large");
  assert.equal(calls.reader, 0);
  assert.equal(calls.llm, 0);
});

test("AC-08 exactly 10 MB is accepted", async () => {
  const { deps } = makeDeps({ files: { [FILE]: 10_485_760 } });
  assert.equal((await categorise(req(FILE), deps)).status, 200);
});

test("AC-09 bad input", async () => {
  const { deps } = makeDeps({ files: { [FILE]: 10, "claim-1042/a.gif": 10, "claim-2000/a.jpg": 10 } });
  for (const f of [undefined, "claim-1042/a.gif", "claim-2000/a.jpg"]) {
    const r = await categorise(req(f), deps);
    assert.equal(r.status, 400, String(f));
    assert.equal((r.body as any).error, "bad_input");
  }
});

test("AC-09 file not in storage", async () => {
  const { deps } = makeDeps();
  const r = await categorise(req("claim-1042/missing.png"), deps);
  assert.equal(r.status, 404);
  assert.equal((r.body as any).error, "receipt_not_found");
});
