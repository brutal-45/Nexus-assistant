package com.pocketpal

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.pocketpal.specs.NativeAppUpdateSpec
import java.io.File

/**
 * Direct in-app update: download the new APK with the system
 * DownloadManager and fire the package-installer intent when it lands.
 *
 * Notes on the design:
 * - The APK goes to the app-private `updates/` dir on external files
 *   storage, so no storage runtime permission is needed and FileProvider
 *   can expose it to the installer.
 * - DownloadManager already renders a system notification with progress —
 *   no in-app progress UI is required. The JS promise resolves as soon as
 *   the download is queued; completion handling (install intent, cleanup)
 *   happens natively in a broadcast receiver.
 * - Older APKs in updates/ are purged when a new download is queued so the
 *   dir cannot accumulate stale installers.
 */
@ReactModule(name = NativeAppUpdateSpec.NAME)
class AppUpdateModule(reactContext: ReactApplicationContext) :
    NativeAppUpdateSpec(reactContext) {

  companion object {
    private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
    private const val UPDATES_DIR = "updates"
  }

  /** downloadId -> the file being written (for the completion receiver). */
  private val pendingTargets = mutableMapOf<Long, File>()
  private var receiverRegistered = false

  override fun getName(): String = NativeAppUpdateSpec.NAME

  override fun canInstallPackages(promise: Promise) {
    try {
      val allowed =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          reactApplicationContext.packageManager.canRequestPackageInstalls()
        } else {
          // Unknown-sources for the whole device pre-API 26; no per-app gate.
          true
        }
      promise.resolve(allowed)
    } catch (e: Exception) {
      promise.reject("E_APP_UPDATE", e.message, e)
    }
  }

  override fun openInstallPermissionSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        promise.resolve(true)
        return
      }
      val intent =
        Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${reactApplicationContext.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_APP_UPDATE", e.message, e)
    }
  }

  override fun downloadAndInstall(url: String, fileName: String, promise: Promise) {
    try {
      // Defend against path traversal; only a bare *.apk filename is allowed.
      val safeName =
        fileName.substringAfterLast('/').substringAfterLast('\\').let {
          if (it.endsWith(".apk")) it else throw IllegalArgumentException("not an .apk filename")
        }

      val dir =
        reactApplicationContext.getExternalFilesDir(UPDATES_DIR)
          ?: File(reactApplicationContext.filesDir, UPDATES_DIR)
      dir.mkdirs()
      // Purge stale installers (previous versions, interrupted runs).
      dir.listFiles()?.forEach { it.delete() }

      val target = File(dir, safeName)

      ensureCompletionReceiver()

      val request =
        DownloadManager.Request(Uri.parse(url))
          .setTitle(safeName)
          .setDescription("Nexus update download")
          .setMimeType(APK_MIME_TYPE)
          .setNotificationVisibility(
            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED,
          )
          .setDestinationUri(Uri.fromFile(target))
          .setAllowedOverMetered(true)
          .setAllowedOverRoaming(true)

      val dm =
        reactApplicationContext.getSystemService(Context.DOWNLOAD_SERVICE)
          as DownloadManager
      val downloadId = dm.enqueue(request)
      synchronized(pendingTargets) { pendingTargets[downloadId] = target }

      promise.resolve("queued")
    } catch (e: Exception) {
      promise.reject("E_APP_UPDATE", e.message, e)
    }
  }

  private fun ensureCompletionReceiver() {
    if (receiverRegistered) {
      return
    }
    ContextCompat.registerReceiver(
      reactApplicationContext,
      downloadCompleteReceiver,
      IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
    receiverRegistered = true
    // Dev-mode note: a JS reload creates a fresh module instance and
    // registers another receiver; the old one is inert (its target map is
    // gone) and the process collects it on restart. Not worth an
    // invalidate() dance.
  }

  private val downloadCompleteReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) {
          return
        }
        val downloadId =
          intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
        val target: File
        synchronized(pendingTargets) {
          target = pendingTargets.remove(downloadId) ?: return
        }

        val dm =
          context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val cursor =
          dm.query(DownloadManager.Query().setFilterById(downloadId))
        try {
          val success =
            cursor != null &&
              cursor.moveToFirst() &&
              cursor.getInt(
                cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS),
              ) == DownloadManager.STATUS_SUCCESSFUL
          if (success && target.exists()) {
            launchInstaller(target)
          }
          // On failure DownloadManager's own system notification already
          // tells the user; the next update prompt can simply retry.
        } finally {
          cursor?.close()
        }
      }
    }

  private fun launchInstaller(apk: File) {
    val uri =
      FileProvider.getUriForFile(
        reactApplicationContext,
        "${reactApplicationContext.packageName}.fileprovider",
        apk,
      )
    val install =
      Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, APK_MIME_TYPE)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
    reactApplicationContext.startActivity(install)
  }
}
