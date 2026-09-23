import {
  LEGACY_DEFAULT_SYSTEM_PROMPTS,
  NEXUS_ASSISTANT_IDENTITY,
  isShippedDefaultSystemPrompt,
  sanitizeAssistantIdentity,
} from '../assistantIdentity';

describe('NEXUS_ASSISTANT_IDENTITY', () => {
  it('introduces the assistant as Nexus', () => {
    expect(NEXUS_ASSISTANT_IDENTITY).toMatch(/You are Nexus/);
    expect(NEXUS_ASSISTANT_IDENTITY).toMatch(/only name is Nexus/);
  });

  it('does not mention foreign assistant names (small models copy them)', () => {
    expect(NEXUS_ASSISTANT_IDENTITY).not.toMatch(
      /bounsi|pocketpal|qwen|gemma|phi|llama|danube|smollm|deepseek|chatgpt|claude|gemini/i,
    );
  });
});

describe('isShippedDefaultSystemPrompt', () => {
  it('treats blank prompts as shipped defaults', () => {
    expect(isShippedDefaultSystemPrompt(undefined)).toBe(true);
    expect(isShippedDefaultSystemPrompt(null)).toBe(true);
    expect(isShippedDefaultSystemPrompt('')).toBe(true);
    expect(isShippedDefaultSystemPrompt('   \n\t  ')).toBe(true);
  });

  it('treats every legacy shipped default as a shipped default', () => {
    for (const prompt of LEGACY_DEFAULT_SYSTEM_PROMPTS) {
      expect(isShippedDefaultSystemPrompt(prompt)).toBe(true);
    }
  });

  it('replaces a You-are prompt that still names BounsiAI', () => {
    expect(
      isShippedDefaultSystemPrompt(
        'You are BounsiAI, a helpful assistant.',
      ),
    ).toBe(true);
    expect(
      isShippedDefaultSystemPrompt(
        'You are PocketPal AI running on your phone.',
      ),
    ).toBe(true);
  });

  it('keeps a user-authored custom prompt', () => {
    expect(isShippedDefaultSystemPrompt('You are a pirate. Arr.')).toBe(
      false,
    );
    expect(
      isShippedDefaultSystemPrompt(
        'You are a coding tutor who explains things simply.',
      ),
    ).toBe(false);
  });
});

describe('sanitizeAssistantIdentity', () => {
  it('rewrites BounsiAI greetings to Nexus', () => {
    expect(
      sanitizeAssistantIdentity(
        "Hi! I'm BounsiAI, how can I help you today?",
      ),
    ).toBe("Hi! I'm Nexus, how can I help you today?");
    expect(
      sanitizeAssistantIdentity('Hello, I am Bounsi AI.'),
    ).toBe('Hello, I am Nexus.');
    expect(sanitizeAssistantIdentity('My name is bounsiai.')).toBe(
      'My name is Nexus.',
    );
  });

  it('rewrites PocketPal greetings to Nexus', () => {
    expect(sanitizeAssistantIdentity("I'm PocketPal AI.")).toBe(
      "I'm Nexus.",
    );
    expect(sanitizeAssistantIdentity('I am PocketPal.')).toBe('I am Nexus.');
  });

  it('rewrites trained-in model self-intros (Qwen, Gemma, …)', () => {
    expect(
      sanitizeAssistantIdentity(
        'Hello, I am Qwen, created by Alibaba Cloud.',
      ),
    ).toBe('Hello, I am Nexus.');
    expect(sanitizeAssistantIdentity("Hi, I'm Gemma. How can I help?")).toBe(
      "Hi, I'm Nexus. How can I help?",
    );
    expect(
      sanitizeAssistantIdentity('I am a large language model trained by Google.'),
    ).toBe('I am Nexus, a private on-device assistant.');
  });

  it('is idempotent and leaves already-correct Nexus text alone', () => {
    const greeting = "Hi! I'm Nexus, how can I help you today?";
    expect(sanitizeAssistantIdentity(greeting)).toBe(greeting);
    expect(
      sanitizeAssistantIdentity(sanitizeAssistantIdentity("I'm BounsiAI.")),
    ).toBe("I'm Nexus.");
  });

  it('does not rewrite unrelated uses of common words', () => {
    expect(
      sanitizeAssistantIdentity('The llama is a South American camelid.'),
    ).toBe('The llama is a South American camelid.');
  });

  it('handles empty input', () => {
    expect(sanitizeAssistantIdentity('')).toBe('');
  });
});
