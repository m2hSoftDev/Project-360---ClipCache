import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getExportSourceBlob,
  isUsingEditedBlob,
  convertBlobToJpg,
  convertBlobToPng,
  copyBlobToClipboard,
  downloadBlob,
} from '@/sidepanel/lib/exportUtils';

describe('Phase 5 Export Utilities Tests (CLAUDE.md Phase 5)', () => {
  const originalBlob = new Blob(['original-pixel-data'], { type: 'image/png' });
  const editedBlob = new Blob(['edited-pixel-data'], { type: 'image/png' });

  describe('1. Export format choice (edited vs original)', () => {
    it('selects editedBlob when edited version exists on capture', () => {
      const capture = {
        originalBlob,
        editedBlob,
      };

      const selected = getExportSourceBlob(capture);
      expect(selected).toBe(editedBlob);
      expect(isUsingEditedBlob(capture)).toBe(true);
    });

    it('falls back to originalBlob when editedBlob is null', () => {
      const capture = {
        originalBlob,
        editedBlob: null,
      };

      const selected = getExportSourceBlob(capture);
      expect(selected).toBe(originalBlob);
      expect(isUsingEditedBlob(capture)).toBe(false);
    });

    it('falls back to originalBlob when editedBlob is undefined', () => {
      const capture = {
        originalBlob,
      };

      const selected = getExportSourceBlob(capture);
      expect(selected).toBe(originalBlob);
      expect(isUsingEditedBlob(capture)).toBe(false);
    });
  });

  describe('2. JPG export fills white background for transparent areas', () => {
    it('fills transparent areas with solid white (#ffffff) and outputs image/jpeg', async () => {
      // 1. Create a 100x100 canvas with a transparent area and a colored square
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;

      // Clear entire canvas to transparent: [0, 0, 0, 0]
      ctx.clearRect(0, 0, 100, 100);

      // Draw a 30x30 blue square in the middle (40,40 to 70,70)
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(40, 40, 30, 30);

      // Verify that at (10, 10) the source is transparent
      const beforePixel = ctx.getImageData(10, 10, 1, 1).data;
      expect(beforePixel[3]).toBe(0); // alpha is 0 (transparent)

      // Convert canvas to source PNG Blob with pixelData
      const sourceBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });

      // 2. Run convertBlobToJpg
      const jpgBlob = await convertBlobToJpg(sourceBlob);

      // Verify blob mime type is image/jpeg
      expect(jpgBlob.type).toBe('image/jpeg');

      // 3. Inspect pixel data of resulting JPG blob
      const pixelData = (jpgBlob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData;
      expect(pixelData).toBeDefined();

      const testCanvas = document.createElement('canvas');
      testCanvas.width = 100;
      testCanvas.height = 100;
      (testCanvas as unknown as { _pixelData: Uint8ClampedArray })._pixelData = pixelData!;
      const testCtx = testCanvas.getContext('2d')!;

      // Transparent area at (10, 10) must now be solid white: [255, 255, 255, 255]
      const whiteAreaPixel = testCtx.getImageData(10, 10, 1, 1).data;
      expect(whiteAreaPixel[0]).toBe(255); // Red
      expect(whiteAreaPixel[1]).toBe(255); // Green
      expect(whiteAreaPixel[2]).toBe(255); // Blue
      expect(whiteAreaPixel[3]).toBe(255); // Alpha is fully opaque

      // Blue square area at (50, 50) must remain blue: [0, 0, 255, 255]
      const blueAreaPixel = testCtx.getImageData(50, 50, 1, 1).data;
      expect(blueAreaPixel[0]).toBe(0);
      expect(blueAreaPixel[1]).toBe(0);
      expect(blueAreaPixel[2]).toBe(255);
      expect(blueAreaPixel[3]).toBe(255);
    });
  });

  describe('3. Clipboard Copy & Download Helpers', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('successfully copies PNG blob to clipboard using navigator.clipboard.write', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          write: mockWrite,
        },
      });

      // Mock ClipboardItem constructor in Node/Vitest
      class MockClipboardItem {
        public types: Record<string, Blob>;
        constructor(types: Record<string, Blob>) {
          this.types = types;
        }
      }
      globalThis.ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;

      const result = await copyBlobToClipboard(originalBlob);
      expect(result.success).toBe(true);
      expect(mockWrite).toHaveBeenCalledTimes(1);
    });

    it('returns a clear error message when browser blocks clipboard write', async () => {
      const mockWrite = vi.fn().mockRejectedValue(new Error('Permission denied by browser policy'));
      Object.assign(navigator, {
        clipboard: {
          write: mockWrite,
        },
      });

      class MockClipboardItem {
        public types: Record<string, Blob>;
        constructor(types: Record<string, Blob>) {
          this.types = types;
        }
      }
      globalThis.ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;

      const result = await copyBlobToClipboard(originalBlob);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Clipboard access blocked');
      expect(result.error).toContain('Permission denied by browser policy');
    });

    it('returns a clear error when navigator.clipboard is not supported', async () => {
      Object.assign(navigator, {
        clipboard: undefined,
      });

      const result = await copyBlobToClipboard(originalBlob);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Clipboard API is not supported by your browser');
    });

    it('triggers document link click for local storage download', () => {
      const mockClick = vi.fn();
      const mockAppendChild = vi.spyOn(document.body, 'appendChild');
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild');

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName === 'a') {
          el.click = mockClick;
        }
        return el;
      });

      downloadBlob(originalBlob, 'test-download.png');

      expect(mockClick).toHaveBeenCalledTimes(1);
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
    });

    it('converts non-png blob to png before clipboard copy', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          write: mockWrite,
        },
      });

      class MockClipboardItem {
        public types: Record<string, Blob>;
        constructor(types: Record<string, Blob>) {
          this.types = types;
        }
      }
      globalThis.ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;

      const webpBlob = new Blob(['webp-data'], { type: 'image/webp' });
      const result = await copyBlobToClipboard(webpBlob);
      expect(result.success).toBe(true);
      expect(mockWrite).toHaveBeenCalledTimes(1);
    });
  });
});
