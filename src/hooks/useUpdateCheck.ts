/**
 * useUpdateCheck — automatic "new version available" notification.
 *
 * A few seconds after app start (never blocking startup or onboarding),
 * devices that already have Nexus installed check GitHub Releases once per
 * day. When a newer version exists the user gets a dialog with a direct
 * download link; otherwise (up to date, offline, throttled, skipped) the
 * check stays completely silent.
 */

import * as React from 'react';

import {l10n} from '../locales';
import {uiStore} from '../store';
import {checkForUpdates, presentUpdateDialog} from '../services/updates';

// Fire after first frame + startup work so the prompt never races the
// onboarding flow, model loading, or a deep link.
const AUTO_CHECK_DELAY_MS = 8000;

export const useUpdateCheck = (): void => {
  React.useEffect(() => {
    if (__E2E__) {
      return;
    }

    const timer = setTimeout(() => {
      (async () => {
        try {
          if (!uiStore.hasCompletedOnboarding) {
            return;
          }
          const strings = l10n[uiStore.language]?.updates ?? l10n.en.updates;
          const result = await checkForUpdates();
          if (result.status === 'update-available' && result.latest) {
            presentUpdateDialog(strings, result.latest, result.currentVersion);
          }
        } catch (error) {
          console.warn('Automatic update check failed:', error);
        }
      })();
    }, AUTO_CHECK_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);
};
