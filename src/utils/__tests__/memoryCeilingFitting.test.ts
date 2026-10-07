import {
  getMemoryCeilingBytes,
  computeFittingContextSize,
  getModelMemoryRequirement,
} from '../memoryEstimator';
import {Model} from '../types';
import {createDefaultContextInitParams} from '../contextInitParamsVersions';

describe('memory ceiling + context auto-fit', () => {
  describe('getMemoryCeilingBytes', () => {
    it('prefers the max of live calibration signals', () => {
      expect(
        getMemoryCeilingBytes({
          totalMemoryBytes: 8e9,
          largestSuccessfulLoad: 2e9,
          availableMemoryCeiling: 3e9,
        }),
      ).toBe(3e9);
    });

    it('uses a single calibration signal when only one exists', () => {
      expect(
        getMemoryCeilingBytes({
          totalMemoryBytes: 8e9,
          largestSuccessfulLoad: 2e9,
        }),
      ).toBe(2e9);
    });

    it('falls back to min(60% RAM, RAM - 1.2GB) on cold start', () => {
      expect(getMemoryCeilingBytes({totalMemoryBytes: 8e9})).toBe(8e9 * 0.6);
      // RAM - 1.2GB wins on small devices: 2GB -> min(1.2GB, 0.8GB).
      expect(getMemoryCeilingBytes({totalMemoryBytes: 2e9})).toBe(0.8e9);
    });

    it('never goes negative', () => {
      expect(getMemoryCeilingBytes({totalMemoryBytes: 1e9})).toBe(0);
      expect(getMemoryCeilingBytes({totalMemoryBytes: NaN})).toBe(0);
    });
  });

  describe('computeFittingContextSize', () => {
    const model = {
      id: 'fit-model',
      name: 'Fit Model',
      size: 2 * 1e9,
      isDownloaded: true,
      ggufMetadata: {
        architecture: 'llama',
        n_layers: 28,
        n_embd: 3072,
        n_head: 24,
        n_head_kv: 8,
        n_vocab: 128256,
        n_embd_head_k: 128,
        n_embd_head_v: 128,
      },
    } as Model;

    it('returns the current context when it already fits', () => {
      const params = {
        ...createDefaultContextInitParams(),
        n_ctx: 1024,
      };
      const fit = computeFittingContextSize(model, params, 10e9);
      expect(fit?.n_ctx).toBe(1024);
    });

    it('walks down the ladder to the largest fitting size', () => {
      const params = {
        ...createDefaultContextInitParams(),
        n_ctx: 4096,
      };
      const fit = computeFittingContextSize(model, params, 2.8e9);
      expect(fit).not.toBeNull();
      expect(fit!.n_ctx).toBeLessThan(4096);
      // The estimate at the fitted size is within budget...
      expect(fit!.estimatedBytes).toBeLessThanOrEqual(2.8e9);
      // ...and matches the estimator for that size.
      expect(fit!.estimatedBytes).toBe(
        getModelMemoryRequirement(model, undefined, {
          ...params,
          n_ctx: fit!.n_ctx,
        }),
      );
      // ...while the next rung up would exceed it.
      const ladder = [4096, 3072, 2048, 1536, 1024, 768, 512];
      const nextUp = ladder[ladder.indexOf(fit!.n_ctx) - 1];
      if (nextUp !== undefined && nextUp <= 4096) {
        expect(
          getModelMemoryRequirement(model, undefined, {
            ...params,
            n_ctx: nextUp,
          }),
        ).toBeGreaterThan(2.8e9);
      }
    });

    it('returns null when nothing fits', () => {
      const params = {
        ...createDefaultContextInitParams(),
        n_ctx: 4096,
      };
      // Weights alone (2GB x 1.1) exceed this ceiling.
      expect(computeFittingContextSize(model, params, 1e9)).toBeNull();
    });

    it('returns null without GGUF metadata', () => {
      const params = createDefaultContextInitParams();
      const noMeta = {...model, ggufMetadata: undefined} as unknown as Model;
      expect(computeFittingContextSize(noMeta, params, 10e9)).toBeNull();
    });

    it('returns null for non-positive ceilings', () => {
      const params = createDefaultContextInitParams();
      expect(computeFittingContextSize(model, params, 0)).toBeNull();
      expect(computeFittingContextSize(model, params, -5)).toBeNull();
    });
  });
});
