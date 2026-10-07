import {
  getRamBand,
  getRamBandInitOverrides,
  getDeviceRamBand,
  isLowRamDevice,
} from '../lowDeviceProfile';

const GB = 1024 * 1024 * 1024;

describe('lowDeviceProfile', () => {
  describe('getRamBand', () => {
    it('classifies sub-4GB devices as low', () => {
      expect(getRamBand(2 * GB)).toBe('low');
      expect(getRamBand(3 * GB)).toBe('low');
      expect(getRamBand(4 * GB - 1)).toBe('low');
    });

    it('classifies 4-8GB devices as medium', () => {
      expect(getRamBand(4 * GB)).toBe('medium');
      expect(getRamBand(6 * GB)).toBe('medium');
      expect(getRamBand(8 * GB - 1)).toBe('medium');
    });

    it('classifies 8GB+ devices as high', () => {
      expect(getRamBand(8 * GB)).toBe('high');
      expect(getRamBand(12 * GB)).toBe('high');
    });

    it('fails open to medium on unknown RAM', () => {
      expect(getRamBand(0)).toBe('medium');
      expect(getRamBand(-1)).toBe('medium');
      expect(getRamBand(NaN)).toBe('medium');
    });
  });

  describe('getRamBandInitOverrides', () => {
    it('shrinks context and batches on the low band', () => {
      const overrides = getRamBandInitOverrides('low', 6);
      expect(overrides).toEqual({
        n_ctx: 1024,
        n_batch: 256,
        n_ubatch: 256,
        n_threads: 4,
        image_max_tokens: 256,
      });
    });

    it('caps threads at 4 on low-RAM devices', () => {
      expect(getRamBandInitOverrides('low', 8).n_threads).toBe(4);
      expect(getRamBandInitOverrides('low', 2).n_threads).toBe(2);
    });

    it('keeps stock context on medium/high bands', () => {
      expect(getRamBandInitOverrides('medium', 6)).toEqual({n_threads: 6});
      expect(getRamBandInitOverrides('high', 6)).toEqual({n_threads: 6});
    });
  });

  describe('device RAM helpers', () => {
    it('reads the band from DeviceInfo', async () => {
      const band = await getDeviceRamBand();
      expect(['low', 'medium', 'high']).toContain(band);
    });

    it('isLowRamDevice agrees with the band', async () => {
      const [band, isLow] = await Promise.all([
        getDeviceRamBand(),
        isLowRamDevice(),
      ]);
      expect(isLow).toBe(band === 'low');
    });
  });
});
