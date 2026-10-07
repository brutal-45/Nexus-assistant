import DeviceInfo from 'react-native-device-info';

import {ContextInitParams} from './types';

/**
 * RAM bands for device-performance profiling. Thresholds mirror the
 * bundled device-rule classifier (rules.android/ios.json): anything under
 * 4 GiB is a low-end device where stock init params (2k context, f16 KV
 * cache, 512 ubatch) risk OOM kills.
 */
export type RamBand = 'low' | 'medium' | 'high';

export const LOW_RAM_THRESHOLD_BYTES = 4 * 1024 * 1024 * 1024;
export const HIGH_RAM_THRESHOLD_BYTES = 8 * 1024 * 1024 * 1024;

export function getRamBand(totalMemoryBytes: number): RamBand {
  if (!Number.isFinite(totalMemoryBytes) || totalMemoryBytes <= 0) {
    // Unknown RAM: fail open to medium (stock params) rather than
    // degrading a capable device or OOMing a weak one blindly.
    return 'medium';
  }
  if (totalMemoryBytes < LOW_RAM_THRESHOLD_BYTES) {
    return 'low';
  }
  if (totalMemoryBytes < HIGH_RAM_THRESHOLD_BYTES) {
    return 'medium';
  }
  return 'high';
}

export async function getDeviceRamBand(): Promise<RamBand> {
  try {
    const totalMemory = await DeviceInfo.getTotalMemory();
    return getRamBand(totalMemory);
  } catch (error) {
    console.warn('[lowDeviceProfile] RAM read failed:', error);
    return 'medium';
  }
}

export async function isLowRamDevice(): Promise<boolean> {
  return (await getDeviceRamBand()) === 'low';
}

/**
 * Recommended context-init overrides per RAM band. Only the low band
 * diverges from stock: a 1k context + smaller batches keeps sub-4GB
 * devices stable while staying user-overridable in Settings. Cache
 * types are deliberately untouched (they are flash-attention-gated
 * elsewhere in the app).
 *
 * @param band - device RAM band
 * @param recommendedThreads - perf-cluster thread count (see
 *   getRecommendedThreadCount); capped at 4 on low-RAM devices where
 *   extra threads add heat without speed on weak cores.
 */
export function getRamBandInitOverrides(
  band: RamBand,
  recommendedThreads: number,
): Partial<ContextInitParams> {
  const threads = Math.max(
    1,
    Math.min(recommendedThreads, band === 'low' ? 4 : recommendedThreads),
  );
  if (band !== 'low') {
    return {n_threads: threads};
  }
  return {
    n_ctx: 1024,
    n_batch: 256,
    n_ubatch: 256,
    n_threads: threads,
    image_max_tokens: 256,
  };
}
