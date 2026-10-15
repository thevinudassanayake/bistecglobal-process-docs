import { randomUUID } from "node:crypto";
import type { Category, CategoriseRequest, CategoriseResponse, DecisionInput, Deps } from "./types.ts";
import { categoriseWithLlm } from "./llm-categoriser.ts";
import { categoriseByRules } from "./rule-based-categoriser.ts";

export const MAX_BYTES = 10_000_000;
const READER_TIMEOUT_MS = 1500;
const UNREADABLE_MESSAGE = "We couldn't read this receipt. Please choose a category.";
export const REVIEW_THRESHOLD = 0.6;
const FEATURE_KEY = "receipt-categoriser";

const err = (status: number, error: string, message: string): CategoriseResponse => ({
  status,
  body: { error, message },
});

export async function categorise(request: CategoriseRequest, deps: Deps): Promise<CategoriseResponse> {
  const now = deps.now ?? Date.now;
  const start = now();

  if (!(await deps.featureSwitch.isEnabled(FEATURE_KEY))) {
    return err(404, "feature_disabled", "This feature is not available.");
  }

  const file = request.body?.receiptFile;
  if (typeof file !== "string" || file === "") {
    return err(400, "bad_input", "receiptFile is required.");
  }
  if (!/\.(jpe?g|png)$/i.test(file)) {
    return err(400, "bad_input", "Receipt must be a JPEG or PNG file.");
  }
  if (!file.startsWith(`claim-${request.claimId}/`)) {
    return err(400, "bad_input", "Receipt does not belong to this claim.");
  }

  const info = await deps.storage.getFileInfo(file);
  if (!info) return err(404, "receipt_not_found", "Receipt not found.");
  if (info.sizeBytes > MAX_BYTES) return err(413, "too_large", "Receipt is larger than 10 MB.");

  let text: string | null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("reader timeout")), READER_TIMEOUT_MS);
    });
    text = await Promise.race([deps.textReader.readText(file), timeout]);
  } catch {
    return err(502, "upstream_unavailable", "The text reader is unavailable.");
  } finally {
    clearTimeout(timer);
  }

  const suggestionId = (deps.newId ?? randomUUID)();
  let category: Category;
  let confidence: number;
  let source: "llm" | "rule-based";
  let outcome: "suggested" | "unreadable";
  let tokens = 0;
  let message: string | null = null;

  if (text === null || text.trim() === "") {
    category = "Other";
    confidence = 0;
    source = "rule-based";
    outcome = "unreadable";
    message = UNREADABLE_MESSAGE;
  } else {
    outcome = "suggested";
    const llm = await categoriseWithLlm(text, deps);
    if (llm) {
      ({ category, confidence, tokens } = llm);
      source = "llm";
    } else {
      ({ category, confidence } = categoriseByRules(text));
      source = "rule-based";
    }
  }

  confidence = Math.round(confidence * 100) / 100;
  const needsReview = confidence < REVIEW_THRESHOLD;

  await safeTrack(deps, "categoriser.suggested", {
    suggestionId,
    claimId: request.claimId,
    category,
    confidence,
    source,
    needsReview,
    outcome,
    durationMs: now() - start,
    llmTokens: tokens,
  });

  return { status: 200, body: { suggestionId, category, confidence, source, needsReview, message } };
}

export async function recordDecision(input: DecisionInput, deps: Deps): Promise<void> {
  await safeTrack(deps, "categoriser.decided", {
    suggestionId: input.suggestionId,
    claimId: input.claimId,
    suggestedCategory: input.suggestedCategory,
    finalCategory: input.finalCategory,
    accepted: input.suggestedCategory === input.finalCategory,
  });
}

// A failed log must not stop the claimant getting the suggestion (spec open question 9).
async function safeTrack(deps: Deps, name: string, props: Record<string, unknown>): Promise<void> {
  try {
    await deps.events.track(name, props);
  } catch {
    // ignored by design
  }
}
