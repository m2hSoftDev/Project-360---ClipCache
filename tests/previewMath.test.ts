import { describe, it, expect } from 'vitest';
import { calculatePreviewDimensions } from '@/sidepanel/lib/previewMath';

describe('Preview Size Calculation Regression Tests', () => {
  it('scales down widescreen 1080p image to fit 360 px side panel width', () => {
    const natural = { width: 1920, height: 1080 };
    const containerWidth = 360;

    const result = calculatePreviewDimensions(natural, containerWidth);

    expect(result.displayWidth).toBe(360);
    // 1080 * (360 / 1920) = 202.5 -> rounds to 203
    expect(result.displayHeight).toBe(203);
    expect(result.scale).toBeCloseTo(360 / 1920, 4);

    // Aspect ratio preservation check
    const naturalRatio = natural.width / natural.height;
    const previewRatio = result.displayWidth / result.displayHeight;
    expect(previewRatio).toBeCloseTo(naturalRatio, 2);
  });

  it('scales image correctly at minimum side panel width (320 px)', () => {
    const natural = { width: 1920, height: 1080 };
    const containerWidth = 320;

    const result = calculatePreviewDimensions(natural, containerWidth);

    expect(result.displayWidth).toBe(320);
    expect(result.displayHeight).toBe(180);
    expect(result.scale).toBeCloseTo(320 / 1920, 4);
  });

  it('scales image correctly at maximum side panel width (500 px)', () => {
    const natural = { width: 1920, height: 1080 };
    const containerWidth = 500;

    const result = calculatePreviewDimensions(natural, containerWidth);

    expect(result.displayWidth).toBe(500);
    // 1080 * (500 / 1920) = 281.25 -> rounds to 281
    expect(result.displayHeight).toBe(281);
    expect(result.scale).toBeCloseTo(500 / 1920, 4);
  });

  it('maintains 1:1 scale when image is smaller than container width', () => {
    const natural = { width: 250, height: 150 };
    const containerWidth = 360;

    const result = calculatePreviewDimensions(natural, containerWidth);

    expect(result.displayWidth).toBe(250);
    expect(result.displayHeight).toBe(150);
    expect(result.scale).toBe(1);
  });

  it('handles portrait screenshots properly', () => {
    const natural = { width: 1080, height: 1920 };
    const containerWidth = 360;

    const result = calculatePreviewDimensions(natural, containerWidth);

    expect(result.displayWidth).toBe(360);
    expect(result.displayHeight).toBe(640);
    expect(result.scale).toBeCloseTo(360 / 1080, 4);
  });

  it('scales tall full-page capture to panel width maintaining full aspect ratio', () => {
    // e.g. a 1200x6000 long webpage capture
    const natural = { width: 1200, height: 6000 };
    const containerWidth = 360;

    const result = calculatePreviewDimensions(natural, containerWidth);

    expect(result.displayWidth).toBe(360);
    // 6000 * (360 / 1200) = 1800
    expect(result.displayHeight).toBe(1800);
    expect(result.scale).toBe(0.3);
  });

  it('safely handles non-positive or invalid inputs without throwing or producing NaN', () => {
    expect(calculatePreviewDimensions({ width: 0, height: 0 }, 360)).toEqual({
      displayWidth: 0,
      displayHeight: 0,
      scale: 1,
    });

    expect(calculatePreviewDimensions({ width: 1920, height: 1080 }, 0)).toEqual({
      displayWidth: 0,
      displayHeight: 0,
      scale: 1,
    });

    expect(calculatePreviewDimensions({ width: -100, height: -100 }, 360)).toEqual({
      displayWidth: 0,
      displayHeight: 0,
      scale: 1,
    });
  });
});
