import type { Deps, LlmResult } from "../src/types.ts";

export interface Calls {
  reader: number;
  llm: number;
  storage: number;
  events: { name: string; props: Record<string, any> }[];
}

export function makeDeps(opts: {
  enabled?: boolean;
  files?: Record<string, number>;
  text?: string | null;
  readerFails?: boolean;
  llm?: LlmResult | { category: string; confidence: number; tokens: number };
  llmFails?: boolean;
  llmDelayMs?: number;
} = {}): { deps: Deps; calls: Calls } {
  const calls: Calls = { reader: 0, llm: 0, storage: 0, events: [] };
  const files = opts.files ?? { "claim-1042/receipt.jpg": 1000 };
  const deps: Deps = {
    featureSwitch: { isEnabled: async () => opts.enabled ?? true },
    storage: {
      getFileInfo: async (p) => {
        calls.storage++;
        return p in files ? { sizeBytes: files[p]! } : null;
      },
    },
    textReader: {
      readText: async () => {
        calls.reader++;
        if (opts.readerFails) throw new Error("503 reader down");
        if (opts.text === null) return null;
        return opts.text ?? "Green Leaf Restaurant, Lunch for 2, Total LKR 2,400";
      },
    },
    llm: {
      categorise: async () => {
        calls.llm++;
        if (opts.llmDelayMs) await new Promise((r) => setTimeout(r, opts.llmDelayMs));
        if (opts.llmFails) throw new Error("503 openai down");
        return (opts.llm ?? { category: "Meals", confidence: 0.86, tokens: 120 }) as LlmResult;
      },
    },
    events: { track: (name, props) => { calls.events.push({ name, props }); } },
  };
  return { deps, calls };
}
