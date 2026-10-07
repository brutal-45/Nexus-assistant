import type {TurboModule} from 'react-native';
import {Platform, TurboModuleRegistry} from 'react-native';

/**
 * NativeAppUpdate — Android-only direct in-app update support.
 *
 * Downloads the release APK with the system DownloadManager (shows its own
 * notification with progress) and hands the finished file to the Android
 * package installer via FileProvider. iOS has no self-update path; the JS
 * layer falls back to opening the release page in the browser there.
 */
export interface Spec extends TurboModule {
  /**
   * True when the app may request installs from unknown sources
   * (Android 8+). Always true on older versions.
   */
  canInstallPackages(): Promise<boolean>;

  /**
   * Opens Android's "Install unknown apps" settings screen for this app so
   * the user can grant the one-time permission. Resolves false if the
   * screen could not be opened.
   */
  openInstallPermissionSettings(): Promise<boolean>;

  /**
   * Queues `url` with the system DownloadManager into the app-private
   * updates/ directory. Resolves "queued" as soon as the download is
   * enqueued; when it finishes, the install intent is fired natively.
   * Rejects only when the download could not be queued at all.
   */
  downloadAndInstall(url: string, fileName: string): Promise<string>;
}

// Only exists on Android; null elsewhere (same pattern as NativeDownloadModule).
export default Platform.OS === 'android'
  ? TurboModuleRegistry.getEnforcing<Spec>('AppUpdateModule')
  : (null as any as Spec);
