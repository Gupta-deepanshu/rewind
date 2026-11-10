import { generateText, hasToolCall, isStepCount, jsonSchema, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { describeFilters } from "./comment";
import { CANARY, systemPrompt, userMessage } from "./prompt";
import { isEmpty, sanitizeFilters, SORTS, type Dropped, type Filters } from "./schema";
import { createLookupTools, Resolved, type Kind, type Lookups } from "./tools";

/**
 * One request, start to finish: the model looks names up with the tools, answers through
 * submit_filters, and the answer is validated and checked against the ids the tools returned.
 *
 * It never throws. Errors thrown inside a "use cache" function lose their type, so the result
 * says what happened instead, and the clerk can always tell the customer why it fell back.
 */

export type FallbackReason =
  /** No API key (or an unknown provider) is configured. */
  | "no_model"
  /** This visitor asked too often (the per-IP limit; checked by the caller). */
  | "rate_limited"
  /** The provider said no for now: the free tier's limits, or overload. */
  | "ai_busy"
  /** The provider's daily quota is used up (Gemini's free tier): the model is out until tomorrow. */
  | "ai_quota"
  | "timeout"
  | "ai_error"
  /** The model finished without calling submit_filters. */
  | "no_answer";

export type Interpretation =
  | {
      kind: "ok";
      filters: Filters;
      comment: string;
      /** Parts of the request that couldn't be used, e.g. ['"Jon Smithee"', "the rating"]. */
      dropped: string[];
      /** Nothing specific was asked for, so the defaults (popular and well rated) were used. */
      vague: boolean;
    }
  | { kind: "off_topic"; comment: string }
  | { kind: "fallback"; reason: FallbackReason };

/** What a vague request ("something good") gets: popular films most people liked. */
export const VAGUE_DEFAULTS: Partial<Filters> = { sort: "most_popular", minRating: 7, minVotes: 1000 };

export const VAGUE_COMMENT = "Nothing specific to go on, so here's what's popular and well liked right now.";
export const OFF_TOPIC_COMMENT =
  "I only know films, friend. Ask me for something like “70s sci-fi with a twist” and I'll check the shelves.";

const COMMENT_MAX = 160;

/**
 * The whole conversation with one model, lookups included. A typical request is 2–3 model turns
 * of 2–3s each on Gemini's free tier, so 8s (the first choice) cut off ordinary requests.
 */
export const DEFAULT_TIMEOUT_MS = 15_000;
/** A model with another one behind it gets less time and no retry: the next one is the retry. */
export const FAILOVER_TIMEOUT_MS = 10_000;

/**
 * The shape the model is asked to submit. Kept loose on purpose: sanitizeFilters checks it field
 * by field.
 *
 * The schema the model sees has no numeric bounds (ranges are in the descriptions instead;
 * sanitizeFilters enforces them). Zod 4 gives every z.int() the bounds ±9007199254740991, and
 * Groq compiles schemas into grammars to constrain the model's output: integer ranges make that
 * slow, and on this schema Groq often dropped the connection ("other side closed"). Gemini
 * didn't mind, so it went unnoticed until Groq was added.
 */
const ref = z.object({ id: z.int(), name: z.string() });
const AnswerSchema = z.object({
  intent: z.enum(["search", "vague", "off_topic"]),
  comment: z.string().describe("One short sentence in the clerk's voice, at most 140 characters"),
  unusable: z.array(z.string()).optional().describe("Parts of the request you couldn't turn into filters"),
  genres: z.array(ref).optional(),
  keywords: z.array(ref).optional(),
  people: z.array(ref.extend({ role: z.enum(["cast", "crew"]) })).optional(),
  releasedFrom: z.string().optional().describe("YYYY-MM-DD"),
  releasedTo: z.string().optional().describe("YYYY-MM-DD"),
  runtimeMin: z.int().optional().describe("minutes, 1 to 1000"),
  runtimeMax: z.int().optional().describe("minutes, 1 to 1000"),
  minRating: z.number().optional().describe("TMDB average rating, 0 to 10"),
  minVotes: z.int().optional().describe("0 or more"),
  language: z.string().optional().describe("ISO 639-1 code of the original language"),
  sort: z.enum(SORTS).optional(),
});

/** Removes "minimum" and "maximum" everywhere in a JSON schema. */
function withoutBounds(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(withoutBounds);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([k]) => k !== "minimum" && k !== "maximum")
      .map(([k, v]) => [k, withoutBounds(v)]),
  );
}

/** The JSON schema the model sees for submit_filters. Exported for tests. */
export const ANSWER_JSON_SCHEMA = withoutBounds(z.toJSONSchema(AnswerSchema, { target: "draft-7" })) as Record<string, unknown>;

/**
 * submit_filters has no `execute`: calling it ends the loop, and its input is the answer.
 * The SDK is given the JSON schema without a validator, so one bad field doesn't throw away
 * the whole answer; sanitizeFilters does the validating.
 */
const submitFilters = tool({
  description: "Submit the final search filters. Call this exactly once, after your lookups.",
  inputSchema: jsonSchema<unknown>(ANSWER_JSON_SCHEMA as Parameters<typeof jsonSchema>[0]),
});

/** A model to ask, with a name for the logs ("groq/openai/gpt-oss-120b"). */
export type ModelOption = { label: string; model: LanguageModel };

export type InterpretOptions = {
  /** The models to ask, in order (see model.ts). Empty when none is configured. */
  models: ModelOption[];
  lookups: Lookups;
  /** YYYY-MM-DD, for "the last five years" and the prompt. */
  today: string;
  /** Per model. Defaults to FAILOVER_TIMEOUT_MS while another model follows, else DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
  maxSteps?: number;
};

/**
 * Asks the models in order until one answers. Any failure moves on to the next (a quota, a busy
 * or slow provider, an error, a model that never submitted): each is a reason to try another
 * provider, not to give up. Only when all have failed does the result say why, using the last.
 */
export async function interpret(query: string, opts: InterpretOptions): Promise<Interpretation> {
  let result: Interpretation = { kind: "fallback", reason: "no_model" };
  for (const [i, m] of opts.models.entries()) {
    const next = opts.models[i + 1];
    result = await askOne(m, query, opts, next !== undefined);
    if (result.kind !== "fallback") return result;
    if (next) console.warn(`[ai-search] ${m.label} unavailable (${result.reason}), asking ${next.label}.`);
  }
  return result;
}

/** One conversation with one model. Each gets its own record of looked-up ids. */
async function askOne(m: ModelOption, query: string, opts: InterpretOptions, hasBackup: boolean): Promise<Interpretation> {
  const resolved = new Resolved();
  let answer: unknown;
  try {
    const result = await generateText({
      model: m.model,
      system: systemPrompt(opts.today),
      prompt: userMessage(query),
      tools: { ...createLookupTools(opts.lookups, resolved), submit_filters: submitFilters },
      toolChoice: "required",
      stopWhen: [hasToolCall("submit_filters"), isStepCount(opts.maxSteps ?? 6)],
      temperature: 0,
      maxRetries: hasBackup ? 0 : 1,
      timeout: opts.timeoutMs ?? (hasBackup ? FAILOVER_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
      onStepFinish: process.env.NODE_ENV === "development" ? (s) => logStep(m.label, s) : undefined,
    });
    answer = result.steps.flatMap((s) => s.toolCalls).find((c) => c.toolName === "submit_filters")?.input;
  } catch (e) {
    const reason = failureReason(e);
    // the network-level cause ("UND_ERR_SOCKET", "ECONNRESET"…) is what tells a dropped connection from a refusal
    const cause = (e as { cause?: { code?: string; message?: string } })?.cause;
    const detail = cause ? ` [cause: ${cause.code ?? ""} ${cause.message ?? ""}]` : "";
    console.error(`[ai-search] ${m.label} failed (${reason}).`, `${e instanceof Error ? e.message.slice(0, 300) : e}${detail}`);
    return { kind: "fallback", reason };
  }

  if (!answer || typeof answer !== "object") return { kind: "fallback", reason: "no_answer" };
  return readAnswer(answer as Record<string, unknown>, resolved);
}

/** Turns the model's submitted answer into an Interpretation. Exported for tests. */
export function readAnswer(answer: Record<string, unknown>, resolved: Resolved): Interpretation {
  if (answer.intent === "off_topic") return { kind: "off_topic", comment: OFF_TOPIC_COMMENT };

  const { filters, dropped } = sanitizeFilters(answer);
  const unresolved = keepResolved(filters, resolved);
  const unusable = (Array.isArray(answer.unusable) ? answer.unusable : [])
    .filter((u): u is string => typeof u === "string")
    .map(cleanText)
    .filter((u): u is string => Boolean(u))
    .slice(0, 3);
  const notes = unique([...dropped.map((d: Dropped) => d.what), ...unresolved, ...unusable]);

  if (answer.intent === "vague" || isEmpty(filters)) {
    return {
      kind: "ok",
      filters: { ...filters, ...VAGUE_DEFAULTS, sort: filters.sort ?? VAGUE_DEFAULTS.sort },
      comment: VAGUE_COMMENT,
      dropped: notes,
      vague: true,
    };
  }

  // the model's line describes what it meant to search; once something was dropped it no longer matches
  const own = notes.length ? undefined : cleanComment(answer.comment);
  return { kind: "ok", filters, comment: own ?? describeFilters(filters), dropped: notes, vague: false };
}

/**
 * Keeps only ids that a tool returned during this request, renamed to TMDB's spelling, and
 * returns the names of the ones it removed. This is what stops the model guessing ids.
 */
function keepResolved(f: Filters, resolved: Resolved): string[] {
  const removed: string[] = [];
  const keep = <T extends { id: number; name: string }>(kind: Kind, items: T[]): T[] =>
    items.flatMap((item) => {
      const name = resolved.name(kind, item.id);
      if (name === undefined) {
        removed.push(`"${item.name}"`);
        return [];
      }
      return [{ ...item, name }];
    });
  f.genres = keep("genres", f.genres);
  f.keywords = keep("keywords", f.keywords);
  f.people = keep("people", f.people);
  return removed;
}

const unique = (xs: string[]) => [...new Set(xs)];

/** Control characters and line breaks become spaces: the text is shown as one plain line. */
const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

function cleanText(s: string): string | undefined {
  return oneLine(s).slice(0, 80) || undefined;
}

/**
 * The model's comment, if it is safe to show: one plain line, no links, and no sign that the
 * model was talked into quoting or discussing its instructions.
 */
export function cleanComment(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = oneLine(raw);
  if (!t) return undefined;
  if (t.includes(CANARY) || /https?:|www\.|<\/?[a-z]/i.test(t)) return undefined;
  if (/\b(system prompt|my (instructions|rules|prompt)|these (instructions|rules)|as an ai|language model)\b/i.test(t)) return undefined;
  return t.length > COMMENT_MAX ? `${t.slice(0, COMMENT_MAX - 1).trimEnd()}…` : t;
}

/** In development, each model turn and the tools it called, in the terminal running `npm run dev`. */
function logStep(label: string, step: { toolCalls: { toolName: string; input: unknown }[]; finishReason: string; text: string }) {
  const calls = step.toolCalls.map((c) => `${c.toolName}(${JSON.stringify(c.input).slice(0, 120)})`).join(", ");
  console.log(`[ai-search] ${label} step: ${calls || `no tool call, text: ${JSON.stringify(step.text.slice(0, 120))}`} (${step.finishReason})`);
}

function failureReason(e: unknown): FallbackReason {
  type ApiError = { name?: string; message?: string; statusCode?: number };
  const err = e as ApiError & { lastError?: ApiError; cause?: { name?: string } };
  const status = err?.statusCode ?? err?.lastError?.statusCode;
  if (err?.name === "AbortError" || err?.name === "TimeoutError" || err?.cause?.name === "TimeoutError") return "timeout";
  // Gemini's free tier has a daily request quota as well as a per-minute one; only the daily one lasts
  if (status === 429 && /per ?day/i.test(`${err?.message ?? ""} ${err?.lastError?.message ?? ""}`)) return "ai_quota";
  if (status === 429 || status === 503) return "ai_busy";
  return "ai_error";
}
