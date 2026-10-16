import { describe, it, expect } from 'vitest';
import {
  normalizeRect,
  clampRect,
  computeDisplayToNaturalScale,
  scaleRectToNatural,
  isValidCrop,
  isPointInsideRect,
  getAspectRatioLabel,
  cropImageToBlob,
} from '@/sidepanel/lib/cropMath';

describe('cropMath', () => {
  describe('normalizeRect', () => {
    it('normalizes normal top-left to bottom-right drag', () => {
      const rect = normalizeRect({ x: 10, y: 20 }, { x: 110, y: 120 });
      expect(rect).toEqual({ x: 10, y: 20, width: 100, height: 100 });
    });

    it('normalizes reverse bottom-right to top-left drag', () => {
      const rect = normalizeRect({ x: 150, y: 200 }, { x: 50, y: 80 });
      expect(rect).toEqual({ x: 50, y: 80, width: 100, height: 120 });
    });

    it('normalizes top-right to bottom-left drag', () => {
      const rect = normalizeRect({ x: 200, y: 10 }, { x: 50, y: 60 });
      expect(rect).toEqual({ x: 50, y: 10, width: 150, height: 50 });
    });

    it('handles zero drag', () => {
      const rect = normalizeRect({ x: 42, y: 42 }, { x: 42, y: 42 });
      expect(rect).toEqual({ x: 42, y: 42, width: 0, height: 0 });
    });
  });

  describe('clampRect', () => {
    const bounds = { width: 500, height: 400 };

    it('keeps valid rectangle within bounds unchanged', () => {
      const rect = clampRect({ x: 50, y: 50, width: 200, height: 150 }, bounds);
      expect(rect).toEqual({ x: 50, y: 50, width: 200, height: 150 });
    });

    it('clamps negative origin coordinates to zero', () => {
      const rect = clampRect({ x: -20, y: -30, width: 100, height: 100 }, bounds);
      expect(rect.x).toBe(0);
      expect(rect.y).toBe(0);
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(100);
    });

    it('clamps width when exceeding right edge', () => {
      const rect = clampRect({ x: 400, y: 50, width: 200, height: 100 }, bounds);
      expect(rect.x).toBe(400);
      expect(rect.width).toBe(100); // 500 - 400 = 100
    });

    it('clamps height when exceeding bottom edge', () => {
      const rect = clampRect({ x: 50, y: 350, width: 100, height: 150 }, bounds);
      expect(rect.y).toBe(350);
      expect(rect.height).toBe(50); // 400 - 350 = 50
    });

    it('clamps rectangle larger than entire bounds', () => {
      const rect = clampRect({ x: -50, y: -50, width: 1000, height: 1000 }, bounds);
      expect(rect).toEqual({ x: 0, y: 0, width: 500, height: 400 });
    });

    it('clamps rectangle completely beyond bounds', () => {
      const rect = clampRect({ x: 600, y: 500, width: 100, height: 100 }, bounds);
      expect(rect.x).toBe(500);
      expect(rect.y).toBe(400);
      expect(rect.width).toBe(0);
      expect(rect.height).toBe(0);
    });
  });

  describe('computeDisplayToNaturalScale', () => {
    it('computes 1:1 scale when display matches natural resolution', () => {
      const scale = computeDisplayToNaturalScale(
        { width: 800, height: 600 },
        { width: 800, height: 600 }
      );
      expect(scale).toEqual({ scaleX: 1, scaleY: 1 });
    });

    it('computes 2x scale for downscaled display', () => {
      const scale = computeDisplayToNaturalScale(
        { width: 400, height: 300 },
        { width: 800, height: 600 }
      );
      expect(scale).toEqual({ scaleX: 2, scaleY: 2 });
    });

    it('handles zero display dimensions gracefully', () => {
      const scale = computeDisplayToNaturalScale(
        { width: 0, height: 0 },
        { width: 800, height: 600 }
      );
      expect(scale).toEqual({ scaleX: 1, scaleY: 1 });
    });
  });

  describe('scaleRectToNatural', () => {
    it('scales crop coordinates accurately to natural resolution', () => {
      const displaySize = { width: 300, height: 200 };
      const naturalSize = { width: 1200, height: 800 }; // 4x scale
      const displayCrop = { x: 10, y: 20, width: 50, height: 40 };

      const naturalCrop = scaleRectToNatural(displayCrop, displaySize, naturalSize);
      expect(naturalCrop).toEqual({
        x: 40,
        y: 80,
        width: 200,
        height: 160,
      });
    });

    it('handles non-uniform scaling (different scaleX and scaleY)', () => {
      const displaySize = { width: 500, height: 200 };
      const naturalSize = { width: 1000, height: 800 }; // scaleX = 2, scaleY = 4
      const displayCrop = { x: 25, y: 15, width: 100, height: 50 };

      const naturalCrop = scaleRectToNatural(displayCrop, displaySize, naturalSize);
      expect(naturalCrop).toEqual({
        x: 50,
        y: 60,
        width: 200,
        height: 200,
      });
    });
  });

  describe('isValidCrop', () => {
    it('returns true for dimensions >= minSize', () => {
      expect(isValidCrop({ x: 0, y: 0, width: 10, height: 10 }, 5)).toBe(true);
    });

    it('returns false for dimensions < minSize', () => {
      expect(isValidCrop({ x: 0, y: 0, width: 4, height: 10 }, 5)).toBe(false);
      expect(isValidCrop({ x: 0, y: 0, width: 10, height: 3 }, 5)).toBe(false);
      expect(isValidCrop({ x: 0, y: 0, width: 0, height: 0 }, 5)).toBe(false);
    });

    it('respects custom minSize parameter', () => {
      expect(isValidCrop({ x: 0, y: 0, width: 15, height: 15 }, 20)).toBe(false);
      expect(isValidCrop({ x: 0, y: 0, width: 25, height: 20 }, 20)).toBe(true);
    });
  });

  describe('isPointInsideRect', () => {
    const rect = { x: 50, y: 50, width: 100, height: 100 };

    it('returns true when point is clearly inside', () => {
      expect(isPointInsideRect({ x: 75, y: 75 }, rect)).toBe(true);
    });

    it('returns true when point is on the boundary edge', () => {
      expect(isPointInsideRect({ x: 50, y: 50 }, rect)).toBe(true);
      expect(isPointInsideRect({ x: 150, y: 150 }, rect)).toBe(true);
    });

    it('returns false when point is outside', () => {
      expect(isPointInsideRect({ x: 40, y: 75 }, rect)).toBe(false);
      expect(isPointInsideRect({ x: 160, y: 75 }, rect)).toBe(false);
      expect(isPointInsideRect({ x: 75, y: 200 }, rect)).toBe(false);
    });
  });

  describe('getAspectRatioLabel', () => {
    it('detects standard 16:9 widescreen ratio', () => {
      expect(getAspectRatioLabel(1920, 1080)).toBe('16:9');
      expect(getAspectRatioLabel(1280, 720)).toBe('16:9');
    });

    it('detects standard 4:3 ratio', () => {
      expect(getAspectRatioLabel(1024, 768)).toBe('4:3');
      expect(getAspectRatioLabel(800, 600)).toBe('4:3');
    });

    it('detects 1:1 square ratio', () => {
      expect(getAspectRatioLabel(500, 500)).toBe('1:1');
    });

    it('detects 21:9 ultrawide ratio', () => {
      expect(getAspectRatioLabel(2560, 1080)).toBe('21:9');
    });

    it('returns 0:0 for non-positive dimensions', () => {
      expect(getAspectRatioLabel(0, 100)).toBe('0:0');
      expect(getAspectRatioLabel(100, 0)).toBe('0:0');
      expect(getAspectRatioLabel(-50, -50)).toBe('0:0');
    });
  });

  describe('cropImageToBlob error handling', () => {
    it('rejects with error when crop width or height is zero or negative', async () => {
      const dummyImg = {} as HTMLImageElement;
      await expect(
        cropImageToBlob(dummyImg, { x: 0, y: 0, width: 0, height: 50 })
      ).rejects.toThrow('Crop rectangle width and height must be greater than zero');

      await expect(
        cropImageToBlob(dummyImg, { x: 0, y: 0, width: 50, height: -10 })
      ).rejects.toThrow('Crop rectangle width and height must be greater than zero');
    });
  });
});
