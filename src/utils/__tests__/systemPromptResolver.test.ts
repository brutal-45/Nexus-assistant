import {
  assembleMessages,
  resolveSystemPrompt,
  resolveSystemMessages,
} from '../systemPromptResolver';
import {NEXUS_ASSISTANT_IDENTITY} from '../chat';
import type {Pal} from '../../types/pal';
import type {Model} from '../types';

describe('systemPromptResolver', () => {
  describe('resolveSystemPrompt', () => {
    it('should return parametrized pal system prompt when pal has parameters', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are {{name}}, a {{role}} in {{setting}}.',
        parameters: {
          name: 'Gandalf',
          role: 'wizard',
          setting: 'Middle-earth',
        },
      };

      const result = resolveSystemPrompt({pal: pal as Pal});

      expect(result).toBe('You are Gandalf, a wizard in Middle-earth.');
    });

    it('should return pal system prompt as-is when pal has no parameters', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are a helpful assistant.',
        parameters: {},
      };

      const result = resolveSystemPrompt({pal: pal as Pal});

      expect(result).toBe('You are a helpful assistant.');
    });

    it('should return pal system prompt as-is when pal has undefined parameters', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are a helpful assistant.',
        parameters: undefined,
      };

      const result = resolveSystemPrompt({pal: pal as Pal});

      expect(result).toBe('You are a helpful assistant.');
    });

    it('should fallback to model chat template when pal has no system prompt', () => {
      const pal: Partial<Pal> = {
        systemPrompt: undefined,
      };

      const activeModel: Partial<Model> = {
        chatTemplate: {
          systemPrompt: 'Model default system prompt',
          addGenerationPrompt: false,
          name: '',
          bosToken: '',
          eosToken: '',
          chatTemplate: '',
        },
      };

      const result = resolveSystemPrompt({
        pal: pal as Pal,
        model: activeModel as Model,
      });

      expect(result).toBe('Model default system prompt');
    });

    it('should fallback to model chat template when pal is null', () => {
      const activeModel: Partial<Model> = {
        chatTemplate: {
          systemPrompt: 'Model default system prompt',
          addGenerationPrompt: false,
          name: '',
          bosToken: '',
          eosToken: '',
          chatTemplate: '',
        },
      };

      const result = resolveSystemPrompt({
        pal: null,
        model: activeModel as Model,
      });

      expect(result).toBe('Model default system prompt');
    });

    it('should return the Nexus identity when no pal and no model system prompt', () => {
      const result = resolveSystemPrompt({
        pal: null,
        model: null,
      });

      expect(result).toBe(NEXUS_ASSISTANT_IDENTITY);
    });

    it('should return the Nexus identity when model has no chat template', () => {
      const activeModel: Partial<Model> = {
        chatTemplate: undefined,
      };

      const result = resolveSystemPrompt({
        pal: null,
        model: activeModel as Model,
      });

      expect(result).toBe(NEXUS_ASSISTANT_IDENTITY);
    });

    it('should replace legacy shipped defaults with the Nexus identity', () => {
      const legacyPrompts = [
        'You are a helpful assistant named H2O Danube3. You are precise, concise, and casual.',
        'You are a helpful assistant named H2O Danube2. You are precise, concise, and casual.',
        'You are a helpful conversational chat assistant. You are precise, concise, and casual.',
        'You are Qwen, created by Alibaba Cloud. You are a helpful assistant.',
        'You are Nexus, a private AI assistant that runs fully on-device. Be concise, friendly, and clear; if asked about live data, explain you work offline.',
      ];

      for (const systemPrompt of legacyPrompts) {
        const activeModel: Partial<Model> = {
          chatTemplate: {
            systemPrompt,
            addGenerationPrompt: false,
            name: '',
            bosToken: '',
            eosToken: '',
            chatTemplate: '',
          },
        };

        const result = resolveSystemPrompt({
          pal: null,
          model: activeModel as Model,
        });

        // A model downloaded on an older build must stop announcing the
        // legacy identity after the app updates.
        expect(result).toBe(NEXUS_ASSISTANT_IDENTITY);
      }
    });

    it('should keep a user-provided custom model system prompt', () => {
      const activeModel: Partial<Model> = {
        chatTemplate: {
          systemPrompt: 'You are a pirate. Arr.',
          addGenerationPrompt: false,
          name: '',
          bosToken: '',
          eosToken: '',
          chatTemplate: '',
        },
      };

      const result = resolveSystemPrompt({
        pal: null,
        model: activeModel as Model,
      });

      expect(result).toBe('You are a pirate. Arr.');
    });

    it('should prioritize pal system prompt over model system prompt', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'Pal system prompt',
        parameters: {},
      };

      const activeModel: Partial<Model> = {
        chatTemplate: {
          systemPrompt: 'Model system prompt',
          addGenerationPrompt: false,
          name: '',
          bosToken: '',
          eosToken: '',
          chatTemplate: '',
        },
      };

      const result = resolveSystemPrompt({
        pal: pal as Pal,
        model: activeModel as Model,
      });

      expect(result).toBe('Pal system prompt');
    });
  });

  describe('resolveSystemMessages', () => {
    it('should return system message array when system prompt exists', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are a helpful assistant.',
        parameters: {},
      };

      const result = resolveSystemMessages({pal: pal as Pal});

      expect(result).toEqual([
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
      ]);
    });

    it('should return the Nexus identity system message when nothing else is configured', () => {
      const result = resolveSystemMessages({
        pal: null,
        model: null,
      });

      expect(result).toEqual([
        {
          role: 'system',
          content: NEXUS_ASSISTANT_IDENTITY,
        },
      ]);
    });

    it('should return the Nexus identity system message when the template prompt is whitespace only', () => {
      const activeModel: Partial<Model> = {
        chatTemplate: {
          systemPrompt: '   \n\t  ',
          addGenerationPrompt: false,
          name: '',
          bosToken: '',
          eosToken: '',
          chatTemplate: '',
        },
      };

      const result = resolveSystemMessages({
        pal: null,
        model: activeModel as Model,
      });

      expect(result).toEqual([
        {
          role: 'system',
          content: NEXUS_ASSISTANT_IDENTITY,
        },
      ]);
    });

    it('should return system message array for parametrized pal', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are {{name}}, a {{role}}.',
        parameters: {
          name: 'Alice',
          role: 'teacher',
        },
      };

      const result = resolveSystemMessages({pal: pal as Pal});

      expect(result).toEqual([
        {
          role: 'system',
          content: 'You are Alice, a teacher.',
        },
      ]);
    });
  });

  describe('assembleMessages', () => {
    const sys = (content: string) => ({role: 'system' as const, content});
    const user = {role: 'user' as const, content: 'hello'};

    it('folds the pal prompt and every fragment into one leading system message', () => {
      const result = assembleMessages(
        [sys('Pal prompt')],
        ['FRAGMENT-A', 'FRAGMENT-B'],
        [user],
      );

      expect(result).toEqual([
        {role: 'system', content: 'Pal prompt\n\nFRAGMENT-A\n\nFRAGMENT-B'},
        user,
      ]);
    });

    it('emits the fragments as the sole system message when the pal has none', () => {
      const result = assembleMessages([], ['FRAGMENT'], [user]);

      expect(result).toEqual([{role: 'system', content: 'FRAGMENT'}, user]);
    });

    it('leaves the pal prompt untouched when no talent contributes a fragment', () => {
      const result = assembleMessages([sys('Pal prompt')], [], [user]);

      expect(result).toEqual([{role: 'system', content: 'Pal prompt'}, user]);
    });

    it('drops empty and whitespace-only parts', () => {
      const result = assembleMessages([sys('   ')], ['', '  ', 'REAL'], [user]);

      expect(result).toEqual([{role: 'system', content: 'REAL'}, user]);
    });

    it('produces no system message when there is nothing to say', () => {
      expect(assembleMessages([], [], [user])).toEqual([user]);
    });

    it('keeps the single system message leading, ahead of the conversation', () => {
      const history = [
        {role: 'assistant' as const, content: 'earlier reply'},
        user,
      ];
      const result = assembleMessages(
        [sys('Pal prompt')],
        ['FRAGMENT'],
        history,
      );

      expect(result[0]).toEqual({
        role: 'system',
        content: 'Pal prompt\n\nFRAGMENT',
      });
      expect(result.slice(1)).toEqual(history);
      expect(result.filter(msg => msg.role === 'system')).toHaveLength(1);
    });
  });
});
