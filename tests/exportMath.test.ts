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

  it('export: output dimensions equal natural width and height, and image pixels include original background', async () => {
    const { fabric } = await import('fabric');
    const { exportCompositeImage } = await import('@/sidepanel/lib/exportMath');

    // 1. Create a 100x100 solid-red fixture canvas
    const fixtureCanvas = document.createElement('canvas');
    fixtureCanvas.width = 100;
    fixtureCanvas.height = 100;
    const fixtureCtx = fixtureCanvas.getContext('2d')!;
    fixtureCtx.fillStyle = '#ff0000';
    fixtureCtx.fillRect(0, 0, 100, 100);

    const fixtureBlob = await new Promise<Blob>((resolve) => {
      fixtureCanvas.toBlob((b) => resolve(b!), 'image/png');
    });

    // 2. Create Fabric canvas and add an annotation
    const fabricCanvasEl = document.createElement('canvas');
    fabricCanvasEl.width = 100;
    fabricCanvasEl.height = 100;
    const fabricCanvas = new fabric.Canvas(fabricCanvasEl, { width: 100, height: 100 });
    const rect = new fabric.Rect({ left: 10, top: 10, width: 20, height: 20, fill: 'blue' });
    fabricCanvas.add(rect);

    // 3. Composite original fixture blob with Fabric annotations
    const exportedBlob = await exportCompositeImage(fixtureBlob, fabricCanvas, 100, 100);

    // 4. Assert exported blob dimensions equal natural width and height
    expect((exportedBlob as unknown as { width: number }).width).toBe(100);
    expect((exportedBlob as unknown as { height: number }).height).toBe(100);

    // 5. Assert background pixel (at 80, 80 where no annotation was placed) is red and not transparent
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 100;
    testCanvas.height = 100;
    const testCtx = testCanvas.getContext('2d')!;
    const pixelData = (exportedBlob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData;
    if (pixelData) {
      (testCanvas as unknown as { _pixelData: Uint8ClampedArray })._pixelData = pixelData;
    }
    const bgPixel = testCtx.getImageData(80, 80, 1, 1).data;
    expect(bgPixel[0]).toBe(255); // Red channel
    expect(bgPixel[3]).toBe(255); // Alpha channel is 255 (not transparent)

    fabricCanvas.dispose();
  });
});

