/**
 * UpdateService — lets already-installed ("downloaded") devices know when a
 * newer Nexus build is available.
 *
 * The app checks the GitHub Releases feed of this repository for the latest
 * published release and compares it against the running app version. When a
 * newer version exists, a dialog offers a one-tap download link (APK on
 * Android, IPA on iOS — falling back to the release page when no matching
 * asset is attached yet).
 *
 * Behavior is deliberately quiet:
 * - Automatic checks happen at most once every 24 hours and say nothing
 *   when the device is up to date or offline.
 * - "Skip this version" suppresses the prompt for that specific version
 *   until an even newer one is published.
 * - Manual checks (About screen → "Check for updates") bypass the throttle
 *   and always report the outcome, including failures.
 */

import {Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

import {hfUserAgent} from '../utils/hfUserAgent';
import {safeAlert} from '../utils/safeAlert';

export const UPDATE_REPO = 'brutal-45/Nexus-assistant';

const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
const LATEST_RELEASE_PAGE_URL = `https://github.com/${UPDATE_REPO}/releases/latest`;

const STORAGE_KEY = '@nexus/update-check';
const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

/** Subset of the l10n `updates` section this service needs. */
export interface UpdateStrings {
  availableTitle: string;
  availableMessage: string;
  download: string;
  later: string;
  skipVersion: string;
  upToDateTitle: string;
  upToDateMessage: string;
  checkFailedTitle: string;
  checkFailedMessage: string;
}

export interface LatestRelease {
  /** Bare semver of the latest release, e.g. "1.18.0". */
  version: string;
  /** Direct download URL of the platform asset, or the release page. */
  downloadUrl: string;
  /** Human-readable release page. */
  releasePageUrl: string;
}

export type UpdateCheckStatus =
  | 'update-available'
  | 'up-to-date'
  | 'skipped-by-throttle'
  | 'skipped-by-user'
  | 'error';

export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  currentVersion: string;
  latest?: LatestRelease;
}

interface StoredUpdateState {
  lastCheckAt: number;
  skippedVersion: string | null;
}

const renderTemplate = (
  template: string,
  values: Record<string, string>,
): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(value),
    template,
  );

/**
 * Compare two dotted versions numerically: 1.18.0 > 1.9.9.
 * Returns a negative number when a < b, 0 when equal, positive when a > b.
 * Pre-release suffixes ("1.2.0-beta") compare by their numeric core only.
 */
export const compareVersions = (a: string, b: string): number => {
  const core = (v: string) =>
    v
      .trim()
      .replace(/^[vV]/, '')
      .split('-')[0]
      .split('.')
      .map(part => parseInt(part, 10) || 0);

  const pa = core(a);
  const pb = core(b);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

/** Picks the best asset download URL for the current platform. */
export const pickAssetUrl = (
  assets: Array<{name?: string; browser_download_url?: string}> | undefined,
  fallbackUrl: string,
): string => {
  if (!assets || assets.length === 0) {
    return fallbackUrl;
  }

  const wantedExtension = Platform.OS === 'ios' ? '.ipa' : '.apk';
  const match = assets.find(asset =>
    (asset.name ?? '').toLowerCase().endsWith(wantedExtension),
  );
  return match?.browser_download_url ?? fallbackUrl;
};

/** Fetch the latest published release from GitHub (null on any failure). */
export const fetchLatestRelease = async (): Promise<LatestRelease | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': hfUserAgent(),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const tag: string | undefined = data?.tag_name ?? data?.name;
    if (!tag) {
      return null;
    }

    const releasePageUrl =
      typeof data?.html_url === 'string' && data.html_url
        ? data.html_url
        : LATEST_RELEASE_PAGE_URL;

    return {
      version: tag.replace(/^[vV]/, ''),
      downloadUrl: pickAssetUrl(data?.assets, releasePageUrl),
      releasePageUrl,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const readStoredState = async (): Promise<StoredUpdateState> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {lastCheckAt: 0, skippedVersion: null};
    }
    const parsed = JSON.parse(raw);
    return {
      lastCheckAt:
        typeof parsed?.lastCheckAt === 'number' ? parsed.lastCheckAt : 0,
      skippedVersion:
        typeof parsed?.skippedVersion === 'string'
          ? parsed.skippedVersion
          : null,
    };
  } catch {
    return {lastCheckAt: 0, skippedVersion: null};
  }
};

const writeStoredState = async (state: StoredUpdateState): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage hiccups are non-fatal: the worst case is an extra prompt.
  }
};

/** Remembers that the user skipped `version`. */
export const skipVersion = async (version: string): Promise<void> => {
  const state = await readStoredState();
  await writeStoredState({...state, skippedVersion: version});
};

/**
 * Check whether a newer release exists.
 *
 * Unless `force` is set (manual button), the network request only fires
 * when the previous check is older than 24 h, and a version the user chose
 * to skip is reported as `skipped-by-user` without prompting again.
 */
export const checkForUpdates = async (
  options: {force?: boolean} = {},
): Promise<UpdateCheckResult> => {
  const currentVersion = DeviceInfo.getVersion();
  const state = await readStoredState();

  if (
    !options.force &&
    state.lastCheckAt > 0 &&
    Date.now() - state.lastCheckAt < AUTO_CHECK_INTERVAL_MS
  ) {
    return {status: 'skipped-by-throttle', currentVersion};
  }

  const latest = await fetchLatestRelease();
  await writeStoredState({...state, lastCheckAt: Date.now()});

  if (!latest) {
    return {status: 'error', currentVersion};
  }
  if (compareVersions(currentVersion, latest.version) >= 0) {
    return {status: 'up-to-date', currentVersion, latest};
  }
  if (!options.force && state.skippedVersion === latest.version) {
    return {status: 'skipped-by-user', currentVersion, latest};
  }
  return {status: 'update-available', currentVersion, latest};
};

/** Show the "Update available" dialog with Download / Skip / Later. */
export const presentUpdateDialog = (
  strings: UpdateStrings,
  latest: LatestRelease,
  currentVersion: string,
): void => {
  safeAlert(
    strings.availableTitle,
    renderTemplate(strings.availableMessage, {
      version: latest.version,
      current: currentVersion,
    }),
    [
      {text: strings.later, style: 'cancel'},
      {
        text: strings.skipVersion,
        style: 'destructive',
        onPress: () => {
          skipVersion(latest.version);
        },
      },
      {
        text: strings.download,
        onPress: () => {
          Linking.openURL(latest.downloadUrl).catch(() =>
            Linking.openURL(latest.releasePageUrl).catch(() => {}),
          );
        },
      },
    ],
  );
};

/** Manual-check feedback: the running build is the newest one. */
export const presentUpToDateDialog = (
  strings: UpdateStrings,
  currentVersion: string,
): void => {
  safeAlert(
    strings.upToDateTitle,
    renderTemplate(strings.upToDateMessage, {version: currentVersion}),
  );
};

/** Manual-check feedback: the check itself failed (usually offline). */
export const presentCheckFailedDialog = (strings: UpdateStrings): void => {
  safeAlert(strings.checkFailedTitle, strings.checkFailedMessage);
};
