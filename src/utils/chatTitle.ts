import {AppState} from 'react-native';

import {chatSessionStore, modelStore, uiStore} from '../store';
import {getDeviceRamBand} from './lowDeviceProfile';
import {derivedText} from './chat';
import {ModelOrigin} from './types';

// Mirrors ChatSessionStore's private NEW_SESSION_TITLE / TITLE_LIMIT.
const NEW_SESSION_TITLE = 'New Session';
const TITLE_LIMIT = 40;
const TITLE_N_PREDICT = 16;

const inFlightTitles = new Set<string>();

function truncatedTitle(source: string): string {
  return source.length > TITLE_LIMIT
    ? `${source.substring(0, TITLE_LIMIT)}...`
    : source;
}

/**
 * True when the session title is still machine-made: either the default
 * "New Session" or the truncated first user message written by
 * ChatSessionStore.updateSessionTitle. User renames are never touched.
 */
function isAutoTitle(title: string, firstUserText: string): boolean {
  if (title === NEW_SESSION_TITLE) {
    return true;
  }
  return title === truncatedTitle(firstUserText);
}

function sanitizeTitle(raw: string): string {
  const firstLine = (raw || '').split('\n')[0].trim();
  const stripped = firstLine
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^[-*#>•\d.)\s]+/, '')
    .replace(/[.?!,;:]+$/, '')
    .trim();
  return stripped.length > TITLE_LIMIT
    ? stripped.substring(0, TITLE_LIMIT).trim()
    : stripped;
}

/**
 * Fire-and-forget LLM title upgrade after the first assistant reply.
 * Fully guarded and failure-silent: setting off, low-RAM device,
 * remote/no model, user-renamed title, backgrounded app, newer
 * messages, or a busy context all skip quietly.
 */
export async function maybeAutoTitleSession(sessionId: string): Promise<void> {
  try {
    if (!uiStore.autoGenerateTitles || inFlightTitles.has(sessionId)) {
      return;
    }
    const session = chatSessionStore.sessions.find(s => s.id === sessionId);
    if (!session) {
      return;
    }
    const firstUser = session.messages.find(
      m => m.type === 'text' && derivedText(m).trim().length > 0,
    );
    const firstUserText = firstUser ? derivedText(firstUser) : '';
    const firstAssistant = session.messages.find(
      m =>
        (m.type === 'assistant_turn' || m.type === 'text') &&
        m !== firstUser &&
        derivedText(m).trim().length > 0,
    );
    if (
      !firstUserText ||
      !firstAssistant ||
      !isAutoTitle(session.title, firstUserText)
    ) {
      return;
    }
    // Extra inference is skipped on low-RAM devices by design.
    const band = modelStore.deviceRamBand ?? (await getDeviceRamBand());
    if (band === 'low') {
      return;
    }
    const activeModel = modelStore.activeModel;
    const context = modelStore.context;
    if (!activeModel || activeModel.origin === ModelOrigin.REMOTE || !context) {
      return;
    }

    inFlightTitles.add(sessionId);
    try {
      const messageCount = session.messages.length;
      // Let the just-finished turn settle (flags clear, user may follow
      // up immediately). Re-validated below before spending inference.
      await new Promise(resolve => setTimeout(resolve, 2000));
      const fresh = chatSessionStore.sessions.find(s => s.id === sessionId);
      if (
        !fresh ||
        fresh.messages.length !== messageCount ||
        !isAutoTitle(fresh.title, firstUserText) ||
        chatSessionStore.isGenerating ||
        chatSessionStore.isStopping ||
        AppState.currentState !== 'active' ||
        modelStore.context !== context
      ) {
        return;
      }
      const assistantText = derivedText(firstAssistant);
      const prompt =
        'Write a very short chat title (max 6 words, no quotes) for this conversation.\n' +
        `User: ${firstUserText.substring(0, 300)}\n` +
        `Assistant: ${assistantText.substring(0, 300)}\nTitle:`;
      const result = await context.completion(
        {
          prompt,
          n_predict: TITLE_N_PREDICT,
          temperature: 0.3,
          stop: ['\n'],
        },
        undefined,
      );
      const title = sanitizeTitle(result?.text ?? '');
      if (title.length < 2) {
        return;
      }
      await chatSessionStore.updateSessionTitleBySessionId(sessionId, title);
    } finally {
      inFlightTitles.delete(sessionId);
    }
  } catch (error) {
    console.warn('[chatTitle] auto-title skipped:', error);
  }
}
