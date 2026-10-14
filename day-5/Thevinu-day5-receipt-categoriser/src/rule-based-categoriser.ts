import type { Category } from "./types.ts";

const WORDS: Record<Exclude<Category, "Other">, string[]> = {
  Meals: ["restaurant", "cafe", "lunch", "dinner", "breakfast", "meal", "pizza", "burger", "coffee"],
  Travel: ["taxi", "uber", "pickme", "fuel", "petrol", "diesel", "toll", "parking", "flight", "bus", "train"],
  Lodging: ["hotel", "hostel", "lodge", "room", "night", "stay"],
  "Office Supplies": ["stationery", "paper", "pen", "pencil", "printer", "toner", "ink", "folder"],
};

// Rule-based path only. No AI service is touched here.
export function categoriseByRules(text: string): { category: Category; confidence: number } {
  const tokens = new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  let best: Category = "Other";
  let bestCount = 0;
  let tie = false;
  for (const [cat, words] of Object.entries(WORDS) as [Category, string[]][]) {
    const count = words.filter((w) => tokens.has(w)).length;
    if (count > bestCount) {
      best = cat;
      bestCount = count;
      tie = false;
    } else if (count > 0 && count === bestCount) {
      tie = true;
    }
  }
  if (bestCount === 0 || tie) return { category: "Other", confidence: 0.2 };
  return { category: best, confidence: bestCount >= 2 ? 0.5 : 0.4 };
}
