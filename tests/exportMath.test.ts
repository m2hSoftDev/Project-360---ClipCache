import { describe, it, expect } from 'vitest';
import {
  computeCanvasLayout,
  calculateExportDimensions,
  isNaturalResolutionPreserved,
} from '@/sidepanel/lib/exportMath';

describe('Editor Canvas Export Size & Scaling Tests (CLAUDE.md Phase 4)', () => {
  it('export size uses natural pixels (1920x1080), not display size (360px)', () => {
    const natural = { width: 1920, height: 1080 };
    const containerWidth = 360;

    const layout = computeCanvasLayout(natural, containerWidth);

    // Display size in panel
    expect(layout.displayWidth).toBe(360);
    expect(layout.displayHeight).toBe(202.5);
    expect(layout.scale).toBeCloseTo(360 / 1920, 4);

    // Export multiplier must upscale display size back to natural resolution
    expect(layout.exportMultiplier).toBeCloseTo(1920 / 360, 4);

    const exported = calculateExportDimensions(
      { width: layout.displayWidth, height: layout.displayHeight },
      layout.exportMultiplier
    );

    // Assert exported size matches natural pixels
    expect(exported.width).toBe(1920);
    expect(exported.height).toBe(1080);
    expect(
      isNaturalResolutionPreserved(
        { width: layout.displayWidth, height: layout.displayHeight },
        natural,
        layout.exportMultiplier
      )
    ).toBe(true);
  });

  it('preserves natural 4K resolution (3840x2160) when displayed in narrow 320px panel', () => {
    const natural = { width: 3840, height: 2160 };
    const containerWidth = 320;

    const layout = computeCanvasLayout(natural, containerWidth);

    expect(layout.displayWidth).toBe(320);
    expect(layout.displayHeight).toBe(180);

    const exported = calculateExportDimensions(
      { width: layout.displayWidth, height: layout.displayHeight },
      layout.exportMultiplier
    );

    expect(exported.width).toBe(3840);
    expect(exported.height).toBe(2160);
    expect(
      isNaturalResolutionPreserved(
        { width: layout.displayWidth, height: layout.displayHeight },
        natural,
        layout.exportMultiplier
      )
    ).toBe(true);
  });

  it('keeps 1:1 natural scale when image is smaller than panel container', () => {
    const natural = { width: 250, height: 150 };
    const containerWidth = 360;

    const layout = computeCanvasLayout(natural, containerWidth);

    expect(layout.displayWidth).toBe(250);
    expect(layout.displayHeight).toBe(150);
    expect(layout.scale).toBe(1);
    expect(layout.exportMultiplier).toBe(1);

    const exported = calculateExportDimensions(
      { width: layout.displayWidth, height: layout.displayHeight },
      layout.exportMultiplier
    );

    expect(exported.width).toBe(250);
    expect(exported.height).toBe(150);
  });

  it('preserves natural resolution for very tall full-page captures (1200x6000)', () => {
    const natural = { width: 1200, height: 6000 };
    const containerWidth = 360;

    const layout = computeCanvasLayout(natural, containerWidth);

    expect(layout.displayWidth).toBe(360);
    expect(layout.displayHeight).toBe(1800);

    const exported = calculateExportDimensions(
      { width: layout.displayWidth, height: layout.displayHeight },
      layout.exportMultiplier
    );

    expect(exported.width).toBe(1200);
    expect(exported.height).toBe(6000);
    expect(
      isNaturalResolutionPreserved(
        { width: layout.displayWidth, height: layout.displayHeight },
        natural,
        layout.exportMultiplier
      )
    ).toBe(true);
  });
});
