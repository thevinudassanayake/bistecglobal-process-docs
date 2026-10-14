export type Category = "Meals" | "Travel" | "Lodging" | "Office Supplies" | "Other";

export interface CategoriseRequest {
  claimId: string;
  body: { receiptFile?: string } | null | undefined;
}

export interface SuggestionBody {
  suggestionId: string;
  category: Category;
  confidence: number;
  source: "llm" | "rule-based";
  needsReview: boolean;
  message: string | null;
}

export interface ErrorBody {
  error: string;
  message: string;
}

export interface CategoriseResponse {
  status: number;
  body: SuggestionBody | ErrorBody;
}

export interface LlmResult {
  category: Category;
  confidence: number;
  tokens: number;
}

export interface DecisionInput {
  suggestionId: string;
  claimId: string;
  suggestedCategory: Category;
  finalCategory: Category;
}

export interface Deps {
  featureSwitch: { isEnabled(key: string): Promise<boolean> };
  storage: { getFileInfo(path: string): Promise<{ sizeBytes: number } | null> };
  textReader: { readText(path: string): Promise<string | null> };
  llm: { categorise(text: string): Promise<LlmResult> };
  events: { track(name: string, properties: Record<string, unknown>): void | Promise<void> };
  now?: () => number;
  newId?: () => string;
}
