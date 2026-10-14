import type { Category, Deps, LlmResult } from "./types.ts";

export const LLM_TIMEOUT_MS = 2000;
const CATEGORIES: readonly string[] = ["Meals", "Travel", "Lodging", "Office Supplies", "Other"];

// AI path only. Returns null when the AI service failed, was too slow, or
// gave an answer we cannot use; the caller then uses the rule-based fallback.
export async function categoriseWithLlm(text: string, deps: Deps): Promise<LlmResult | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("llm timeout")), LLM_TIMEOUT_MS);
    });
    const r = await Promise.race([deps.llm.categorise(text), timeout]);
    if (
      !r ||
      typeof r.category !== "string" ||
      !CATEGORIES.includes(r.category) ||
      typeof r.confidence !== "number" ||
      !Number.isFinite(r.confidence) ||
      r.confidence < 0 ||
      r.confidence > 1
    ) {
      return null;
    }
    return { category: r.category as Category, confidence: r.confidence, tokens: Number(r.tokens) || 0 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
