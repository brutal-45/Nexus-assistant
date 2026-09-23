import type {Pal} from '../types/pal';
import type {Model} from './types';
import {generateFinalSystemPrompt} from './palshub-template-parser';
import {LEGACY_DEFAULT_SYSTEM_PROMPTS, NEXUS_ASSISTANT_IDENTITY} from './chat';

export interface SystemPromptDependencies {
  pal?: Pal | null;
  model?: Model | null;
}

/**
 * Resolves the system prompt based on priority:
 * 1. Pal's system prompt (with parameter rendering if needed)
 * 2. Model's chat template system prompt — unless it is blank or one of
 *    the legacy shipped defaults that made models announce a foreign
 *    identity (H2O Danube, "Qwen, created by Alibaba Cloud", ...)
 * 3. The canonical Nexus identity prompt, so the assistant always
 *    introduces itself as Nexus and never echoes a trained-in model name
 *    such as BounsiAI — for every model, on every install (including
 *    models downloaded before this behavior existed).
 */
export function resolveSystemPrompt(
  dependencies: SystemPromptDependencies,
): string {
  const {pal, model} = dependencies;

  // Priority 1: Pal's system prompt
  if (pal?.systemPrompt) {
    // Check if the pal has parameters that need rendering
    if (pal.parameters && Object.keys(pal.parameters).length > 0) {
      return generateFinalSystemPrompt(pal.systemPrompt, pal.parameters);
    } else {
      return pal.systemPrompt;
    }
  }

  // Priority 2: Model's chat template system prompt.
  // Blank whitespace and legacy shipped defaults (which taught the model a
  // foreign identity) are treated as "no custom prompt" and fall through.
  const templatePrompt = model?.chatTemplate?.systemPrompt;
  if (
    templatePrompt &&
    templatePrompt.trim().length > 0 &&
    !LEGACY_DEFAULT_SYSTEM_PROMPTS.has(templatePrompt)
  ) {
    return templatePrompt;
  }

  // Priority 3: Canonical Nexus identity
  return NEXUS_ASSISTANT_IDENTITY;
}

type ChatMessage = {role: string; content?: unknown};

/**
 * Fold the system prompt + every talent fragment into ONE leading system
 * message; a second system message makes strict chat templates raise.
 */
export function assembleMessages(
  systemMessages: Array<{role: 'system'; content: string}>,
  systemPromptFragments: string[],
  followingMessages: ChatMessage[],
): ChatMessage[] {
  const parts = [
    ...systemMessages.map(msg => msg.content),
    ...systemPromptFragments,
  ].filter(part => part.trim().length > 0);

  const leadingSystemMessage: ChatMessage[] = parts.length
    ? [{role: 'system', content: parts.join('\n\n')}]
    : [];

  const messages = [...leadingSystemMessage, ...followingMessages];

  if (__DEV__) {
    const systemPositions = messages
      .map((msg, index) => (msg.role === 'system' ? index : -1))
      .filter(index => index >= 0);
    if (
      systemPositions.length > 1 ||
      (systemPositions.length === 1 && systemPositions[0] !== 0)
    ) {
      console.error(
        'assembleMessages: chat templates require at most one leading system ' +
          `message, but found system messages at [${systemPositions.join(', ')}].`,
      );
    }
  }

  return messages;
}

/**
 * Resolves system prompt and formats it as a system message array.
 * Always returns exactly one leading system message: the resolution
 * fallback is the non-empty Nexus identity prompt (see
 * `resolveSystemPrompt`), which guarantees a stable assistant identity
 * for every model.
 */
export function resolveSystemMessages(
  dependencies: SystemPromptDependencies,
): Array<{role: 'system'; content: string}> {
  const systemPrompt = resolveSystemPrompt(dependencies);

  if (!systemPrompt.trim()) {
    return [];
  }

  return [
    {
      role: 'system' as const,
      content: systemPrompt,
    },
  ];
}
