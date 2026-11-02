import { describe, it, expect } from 'vitest';
import { createBlurredRegionDataUrl, createBlurFabricObject } from '@/sidepanel/lib/blurMath';

describe('Blur Math and Region Masking (CLAUDE.md Phase 4)', () => {
  it('returns empty string for zero or negative dimensions', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;

    expect(createBlurredRegionDataUrl(canvas, { x: 0, y: 0, width: 0, height: 100 })).toBe('');
    expect(createBlurredRegionDataUrl(canvas, { x: 0, y: 0, width: 100, height: 0 })).toBe('');
    expect(createBlurredRegionDataUrl(canvas, { x: 0, y: 0, width: -10, height: -10 })).toBe('');
  });

  it('generates a valid image/png data URL for valid rectangular region', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 400, 300);

    const dataUrl = createBlurredRegionDataUrl(canvas, {
      x: 50,
      y: 50,
      width: 120,
      height: 80,
    });

    expect(dataUrl).toBeTruthy();
    expect(dataUrl.startsWith('data:image/png')).toBe(true);
  });

  it('createBlurFabricObject returns a Fabric.js Image positioned at the requested region', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, 200, 200);

    const rect = { x: 40, y: 60, width: 80, height: 50 };
    const dataUrl = createBlurredRegionDataUrl(canvas, rect);

    const fabricObj = await createBlurFabricObject(dataUrl, rect);

    expect(fabricObj).toBeDefined();
    expect(fabricObj.left).toBe(40);
    expect(fabricObj.top).toBe(60);
    expect(fabricObj.width).toBe(80);
    expect(fabricObj.height).toBe(50);
    expect(fabricObj.selectable).toBe(true);
  });
});
