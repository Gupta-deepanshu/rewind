/** @jest-environment node */
import { DEFAULT_MODELS, modelsFromEnv } from "./model";

const labels = (env: Record<string, string>) => modelsFromEnv(env).map((m) => m.label);

describe("modelsFromEnv", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("has no models without a key, so the clerk falls back to the rules", () => {
    expect(modelsFromEnv({})).toEqual([]);
  });

  it("uses every provider with a key, Groq first (it has the bigger free allowance)", () => {
    expect(labels({ GOOGLE_GENERATIVE_AI_API_KEY: "g" })).toEqual([`google/${DEFAULT_MODELS.google}`]);
    expect(labels({ GOOGLE_GENERATIVE_AI_API_KEY: "g", GROQ_API_KEY: "q" })).toEqual([`groq/${DEFAULT_MODELS.groq}`, `google/${DEFAULT_MODELS.google}`]);
  });

  it("asks AI_PROVIDER first, keeping the others as backups", () => {
    expect(labels({ GOOGLE_GENERATIVE_AI_API_KEY: "g", GROQ_API_KEY: "q", AI_PROVIDER: "Google" })).toEqual([
      `google/${DEFAULT_MODELS.google}`,
      `groq/${DEFAULT_MODELS.groq}`,
    ]);
  });

  it("takes each provider's model from its own variable", () => {
    expect(labels({ GROQ_API_KEY: "q", GROQ_MODEL: "llama-3.3-70b-versatile", GOOGLE_GENERATIVE_AI_API_KEY: "g", GOOGLE_MODEL: "gemini-3.5-flash-lite" })).toEqual([
      "groq/llama-3.3-70b-versatile",
      "google/gemini-3.5-flash-lite",
    ]);
  });

  it("skips a chosen provider without a key (and says so), still using the others", () => {
    expect(labels({ AI_PROVIDER: "groq", GOOGLE_GENERATIVE_AI_API_KEY: "g" })).toEqual([`google/${DEFAULT_MODELS.google}`]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("GROQ_API_KEY isn't set"));
  });

  it("warns about an unknown provider and keeps the default order", () => {
    expect(labels({ AI_PROVIDER: "someone-else", GROQ_API_KEY: "q" })).toEqual([`groq/${DEFAULT_MODELS.groq}`]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown AI_PROVIDER "someone-else"'));
  });
});
