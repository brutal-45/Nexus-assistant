/**
 * Tests for UpdateService — version comparison, asset picking and the
 * check/notify decision tree. The device-info fixture reports version
 * 1.0.0, so release payloads are built relative to that.
 */

import DeviceInfo from 'react-native-device-info';

import {
  checkForUpdates,
  compareVersions,
  fetchLatestRelease,
  pickAssetUrl,
  presentUpdateDialog,
  skipVersion,
} from '../updates';
import {safeAlert} from '../../utils/safeAlert';

jest.mock('../../utils/safeAlert', () => ({
  safeAlert: jest.fn(),
}));

// NOTE: the repo's shared AsyncStorage mock wrapper is self-referential
// (moduleNameMapper's unanchored key also matches the `jest/...` subpath it
// tries to re-export), so we provide a local in-memory implementation.
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete mockStorage[key];
    }),
  },
}));

const STORAGE_KEY = '@nexus/update-check';
const CURRENT_VERSION = DeviceInfo.getVersion(); // '1.0.0' (fixture)

const updateStrings = {
  availableTitle: 'Update available',
  availableMessage: 'Nexus {{version}} is ready (you have {{current}}).',
  download: 'Download',
  later: 'Later',
  skipVersion: 'Skip this version',
  upToDateTitle: 'You are up to date',
  upToDateMessage: 'Nexus {{version}} is the latest version.',
  checkFailedTitle: 'Update check failed',
  checkFailedMessage: 'Could not check for updates.',
};

const releasePayload = (tag: string, assets: any[] = []) => ({
  ok: true,
  json: async () => ({
    tag_name: tag,
    html_url: 'https://github.com/brutal-45/Nexus-assistant/releases/latest',
    assets,
  }),
});

const mockFetchRelease = (payload: any) => {
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue(payload);
};

const seedStorage = async (state: {
  lastCheckAt: number;
  skippedVersion: string | null;
}) => {
  mockStorage[STORAGE_KEY] = JSON.stringify(state);
};

beforeEach(async () => {
  jest.clearAllMocks();
  Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  (global.fetch as jest.Mock) = jest.fn();
});

describe('compareVersions', () => {
  it('orders dotted versions numerically, not lexically', () => {
    expect(compareVersions('1.9.9', '1.18.0')).toBeLessThan(0);
    expect(compareVersions('1.18.1', '1.18.0')).toBeGreaterThan(0);
  });

  it('treats v-prefixed tags and missing segments as equal', () => {
    expect(compareVersions('1.18.0', 'v1.18.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });

  it('ignores pre-release suffixes on the numeric core', () => {
    expect(compareVersions('1.2.0-beta', '1.2.0')).toBe(0);
  });
});

describe('pickAssetUrl', () => {
  // The jest react-native preset sets Platform.OS to 'ios'.
  const assets = [
    {
      name: 'Nexus-v1.1.0.apk',
      browser_download_url: 'https://example/Nexus.apk',
    },
    {
      name: 'Nexus-v1.1.0.ipa',
      browser_download_url: 'https://example/Nexus.ipa',
    },
  ];

  it('prefers the platform asset (ipa under the ios test platform)', () => {
    expect(pickAssetUrl(assets, 'https://fallback')).toBe(
      'https://example/Nexus.ipa',
    );
  });

  it('falls back to the release page when no matching asset exists', () => {
    expect(pickAssetUrl([], 'https://fallback')).toBe('https://fallback');
    expect(pickAssetUrl(undefined, 'https://fallback')).toBe(
      'https://fallback',
    );
  });
});

describe('fetchLatestRelease', () => {
  it('parses the tag and chooses the asset', async () => {
    mockFetchRelease(
      releasePayload('v1.1.0', [
        {
          name: 'Nexus-v1.1.0.ipa',
          browser_download_url: 'https://example/Nexus.ipa',
        },
      ]),
    );

    const latest = await fetchLatestRelease();
    expect(latest).toEqual({
      version: '1.1.0',
      downloadUrl: 'https://example/Nexus.ipa',
      releasePageUrl:
        'https://github.com/brutal-45/Nexus-assistant/releases/latest',
    });
  });

  it('returns null on network failure', async () => {
    (global.fetch as jest.Mock) = jest
      .fn()
      .mockRejectedValue(new Error('offline'));
    await expect(fetchLatestRelease()).resolves.toBeNull();
  });

  it('returns null on non-OK responses', async () => {
    mockFetchRelease({ok: false, json: async () => ({})});
    await expect(fetchLatestRelease()).resolves.toBeNull();
  });
});

describe('checkForUpdates', () => {
  it('reports update-available when the latest release is newer', async () => {
    mockFetchRelease(releasePayload('v1.1.0'));

    const result = await checkForUpdates();
    expect(result.status).toBe('update-available');
    expect(result.currentVersion).toBe(CURRENT_VERSION);
    expect(result.latest?.version).toBe('1.1.0');
  });

  it('reports up-to-date when versions match', async () => {
    mockFetchRelease(releasePayload(`v${CURRENT_VERSION}`));

    const result = await checkForUpdates();
    expect(result.status).toBe('up-to-date');
  });

  it('reports error when the check fails', async () => {
    (global.fetch as jest.Mock) = jest
      .fn()
      .mockRejectedValue(new Error('offline'));

    const result = await checkForUpdates();
    expect(result.status).toBe('error');
  });

  it('throttles automatic checks to once per interval', async () => {
    await seedStorage({lastCheckAt: Date.now(), skippedVersion: null});

    const result = await checkForUpdates();
    expect(result.status).toBe('skipped-by-throttle');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('force bypasses the throttle', async () => {
    await seedStorage({lastCheckAt: Date.now(), skippedVersion: null});
    mockFetchRelease(releasePayload('v1.1.0'));

    const result = await checkForUpdates({force: true});
    expect(result.status).toBe('update-available');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('does not re-report a version the user skipped', async () => {
    await skipVersion('1.1.0');
    mockFetchRelease(releasePayload('v1.1.0'));

    const result = await checkForUpdates();
    expect(result.status).toBe('skipped-by-user');
  });

  it('prompts again for an even newer version after a skip', async () => {
    await skipVersion('1.1.0');
    mockFetchRelease(releasePayload('v1.2.0'));

    const result = await checkForUpdates();
    expect(result.status).toBe('update-available');
    expect(result.latest?.version).toBe('1.2.0');
  });
});

describe('presentUpdateDialog', () => {
  it('renders the version placeholders and marks "skip" destructive', () => {
    presentUpdateDialog(
      updateStrings,
      {
        version: '1.1.0',
        downloadUrl: 'https://example/Nexus.ipa',
        releasePageUrl: 'https://example/release',
      },
      CURRENT_VERSION,
    );

    expect(safeAlert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = (safeAlert as jest.Mock).mock.calls[0];

    expect(title).toBe('Update available');
    expect(message).toBe('Nexus 1.1.0 is ready (you have 1.0.0).');

    const [later, skip, download] = buttons;
    expect(later.text).toBe('Later');
    expect(skip.text).toBe('Skip this version');
    expect(skip.style).toBe('destructive');
    expect(download.text).toBe('Download');
  });

  it('persists the skipped version when skip is pressed', async () => {
    presentUpdateDialog(
      updateStrings,
      {version: '1.1.0', downloadUrl: 'u', releasePageUrl: 'r'},
      CURRENT_VERSION,
    );
    const [, , buttons] = (safeAlert as jest.Mock).mock.calls[0];
    await buttons[1].onPress?.();

    const result = await checkForUpdates();
    expect(result.status).not.toBe('update-available');
  });
});
