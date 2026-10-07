/**
 * Canonical Nexus identity + output sanitizer.
 *
 * Small on-device models copy names they see in the system prompt, so the
 * identity string MUST NOT mention any other assistant or model (BounsiAI,
 * Qwen, PocketPal, ...). Already-downloaded models may still carry an older
 * prompt that listed those names; `isShippedDefaultSystemPrompt` treats those
 * as "no custom prompt" so `resolveSystemPrompt` substitutes this one.
 *
 * `sanitizeAssistantIdentity` is the last line of defence: if a model still
 * introduces itself as BounsiAI (or similar) on a greeting like "hi", the
 * name is rewritten to Nexus before the user sees or hears it.
 */

/** Short, name-free identity. Keep it short — it is prepended every turn. */
export const NEXUS_ASSISTANT_IDENTITY =
  'You are Nexus, a private AI assistant that runs fully on this device. ' +
  'Your only name is Nexus. Always introduce yourself as Nexus. ' +
  'Reply in the same language the user writes in. Be concise, friendly, and clear. ' +
  'You work fully offline.';

/**
 * Default prompts that shipped in older Nexus builds. Models downloaded
 * while those builds were installed still carry them in their persisted
 * chat template; an exact match is treated as "no custom prompt".
 */
export const LEGACY_DEFAULT_SYSTEM_PROMPTS: ReadonlySet<string> = new Set([
  'You are a helpful assistant named H2O Danube3. You are precise, concise, and casual.',
  'You are a helpful assistant named H2O Danube2. You are precise, concise, and casual.',
  'You are a helpful conversational chat assistant. You are precise, concise, and casual.',
  'You are Qwen, created by Alibaba Cloud. You are a helpful assistant.',
  'You are Nexus, a private AI assistant that runs fully on-device. Be concise, friendly, and clear; if asked about live data, explain you work offline.',
  // v1.18.0 identity — listed foreign names, which small models then repeated.
  'You are Nexus, a private AI assistant that runs fully on your device. ' +
    'Your name is Nexus: always introduce yourself as Nexus and never claim ' +
    'or imply any other assistant, app, company, or model name (names like ' +
    'Qwen, Gemma, Phi, Llama, Danube, SmolLM, DeepSeek, or BounsiAI are only ' +
    'engine details, never your name). ' +
    'Reply in the same language the user writes in, including Hindi and other ' +
    'Indian languages. Be concise, friendly, and clear. You work fully ' +
    'offline; if asked about live data, explain that you work offline.',
]);

/**
 * Names that must never appear as the assistant's identity. Matched
 * case-insensitively; longer spellings are listed first so "Bounsi AI"
 * is consumed before a leftover "Bounsi".
 */
const ALWAYS_REPLACE_NAMES: ReadonlyArray<RegExp> = [
  /\bBounsi\s*AI\b/gi,
  /\bBounsiai\b/gi,
  /\bBonusiai\b/gi,
  /\bBonus\s*AI\b/gi,
  /\bBounsi\b/gi,
  /\bPocket\s*Pal(?:\s*AI)?\b/gi,
];

const FOREIGN_NAME_IN_PROMPT =
  /\b(bounsi\s*ai|bounsiai|bonusiai|bonus\s*ai|pocket\s*pal|h2o danube)\b/i;

/**
 * Self-introduction of a trained-in model family. Captures the lead-in
 * ("I'm", "I am", "My name is", "This is") so we can keep it and swap
 * only the foreign name for Nexus.
 */
const SELF_INTRO_FOREIGN =
  /\b(I(?:['’]m| am)|[Mm]y name is|[Tt]his is)\s+(?:(?:a|an)\s+)?(?:helpful\s+)?(?:conversational\s+)?(?:AI\s+)?(?:assistant\s+)?(?:named\s+|called\s+)?(Qwen(?:\d+(?:\.\d+)?)?|Gemma(?:\s*\d+)?|Phi(?:-\d+(?:\s*Mini)?)?|Llama(?:\s*\d+(?:\.\d+)?)?|Danube\d*|SmolLM\d*|DeepSeek(?:[- ][A-Za-z0-9]+)?|H2O(?:\s*Danube\d*)?|Mistral(?:\s*\d+[A-Za-z]*)?|Ministral(?:\s*\d+[A-Za-z]*)?|ChatGPT|Claude|Gemini|Copilot)\b/gi;

const CREATED_BY_CLAUSE =
  /\bNexus,?\s+created by [A-Za-z][A-Za-z0-9 ,&]{0,40}/g;

const GENERIC_LLM_INTRO =
  /\bI am (?:a |an )?(?:large )?language model (?:created|trained|developed) by [^.]+/gi;

/**
 * True when `prompt` is blank, a shipped default, or a leftover identity
 * that taught the model a foreign name. Those all fall through to the
 * canonical Nexus identity. User-authored prompts (e.g. "You are a pirate")
 * return false and are kept.
 */
export function isShippedDefaultSystemPrompt(prompt?: string | null): boolean {
  if (!prompt || prompt.trim().length === 0) {
    return true;
  }
  if (LEGACY_DEFAULT_SYSTEM_PROMPTS.has(prompt)) {
    return true;
  }
  // Any "You are …" prompt that still names a foreign assistant.
  if (FOREIGN_NAME_IN_PROMPT.test(prompt) && /you are/i.test(prompt)) {
    return true;
  }
  return false;
}

/**
 * Rewrite assistant output so a greeting like "hi" never surfaces a
 * foreign model name. Safe to run on cumulative streaming text (the
 * replacement is idempotent).
 */
export function sanitizeAssistantIdentity(text: string): string {
  if (!text) {
    return text;
  }

  let result = text;
  for (const pattern of ALWAYS_REPLACE_NAMES) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, 'Nexus');
  }

  SELF_INTRO_FOREIGN.lastIndex = 0;
  result = result.replace(SELF_INTRO_FOREIGN, '$1 Nexus');

  CREATED_BY_CLAUSE.lastIndex = 0;
  result = result.replace(CREATED_BY_CLAUSE, 'Nexus');

  GENERIC_LLM_INTRO.lastIndex = 0;
  result = result.replace(
    GENERIC_LLM_INTRO,
    'I am Nexus, a private on-device assistant',
  );

  // Collapse "Nexus Nexus" if two replacements landed next to each other.
  result = result.replace(/\bNexus(?:\s+Nexus)+\b/g, 'Nexus');

  return result;
}
