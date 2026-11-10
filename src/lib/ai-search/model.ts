import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

/**
 * Which models the clerk asks, in order, from the environment. If the first is out of quota,
 * busy, too slow or broken, the clerk asks the next (see interpret.ts), and only after the last
 * does it fall back to the rule-based parser.
 *
 * This is the only file that knows about providers: adding one is an entry in PROVIDERS.
 *
 *   GROQ_API_KEY                   free key from GroqCloud (console.groq.com/keys)
 *   GOOGLE_GENERATIVE_AI_API_KEY   free key from Google AI Studio (aistudio.google.com)
 *   AI_PROVIDER                    optional: which provider to ask first ("groq" or "google")
 *   GROQ_MODEL / GOOGLE_MODEL      optional: a model other than the defaults below
 *
 * Every provider with a key is used. Without AI_PROVIDER, Groq goes first: its free tier allows
 * far more requests a day than Gemini's (about 20 for its Flash model in testing, and a search
 * makes 2–3). No key at all means no model, and the clerk uses the rules.
 */

type Env = Record<string, string | undefined>;

const PROVIDERS = {
  groq: {
    keyVar: "GROQ_API_KEY",
    modelVar: "GROQ_MODEL",
    // an open-weights model that is good at tool calling, and fast on Groq
    defaultModel: "openai/gpt-oss-120b",
    create: (apiKey: string, modelId: string): LanguageModel => createGroq({ apiKey })(modelId),
  },
  google: {
    keyVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    modelVar: "GOOGLE_MODEL",
    // A pinned version, not the "-latest" alias: answers stay comparable between eval runs, and
    // in testing (Nov 2026) the alias and newer versions were often overloaded or timed out.
    defaultModel: "gemini-3.5-flash",
    create: (apiKey: string, modelId: string): LanguageModel => createGoogleGenerativeAI({ apiKey })(modelId),
  },
} as const;

export type Provider = keyof typeof PROVIDERS;

/** In the order they're asked when AI_PROVIDER isn't set. */
const DEFAULT_ORDER = Object.keys(PROVIDERS) as Provider[];

export const DEFAULT_MODELS = Object.fromEntries(DEFAULT_ORDER.map((p) => [p, PROVIDERS[p].defaultModel])) as Record<Provider, string>;

export type ModelChoice = {
  provider: Provider;
  modelId: string;
  /** "groq/openai/gpt-oss-120b", for logs and the eval report. */
  label: string;
  model: LanguageModel;
};

const isProvider = (p: string): p is Provider => p in PROVIDERS;

/** Every configured model, in the order the clerk should ask them. */
export function modelsFromEnv(env: Env = process.env): ModelChoice[] {
  const first = env.AI_PROVIDER?.trim().toLowerCase();
  let order = DEFAULT_ORDER;
  if (first) {
    if (isProvider(first)) order = [first, ...DEFAULT_ORDER.filter((p) => p !== first)];
    else console.error(`[ai-search] Unknown AI_PROVIDER "${first}" (use ${DEFAULT_ORDER.join(" or ")}); using the default order.`);
    if (isProvider(first) && !env[PROVIDERS[first].keyVar]) {
      console.error(`[ai-search] AI_PROVIDER is "${first}" but ${PROVIDERS[first].keyVar} isn't set; skipping it.`);
    }
  }

  return order.flatMap((provider) => {
    const { keyVar, modelVar, defaultModel, create } = PROVIDERS[provider];
    const apiKey = env[keyVar];
    if (!apiKey) return [];
    const modelId = env[modelVar] || defaultModel;
    return [{ provider, modelId, label: `${provider}/${modelId}`, model: create(apiKey, modelId) }];
  });
}
