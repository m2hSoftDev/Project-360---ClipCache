/**
 * Math and scaling utilities for Fabric.js canvas display and natural-size image export.
 * Per CLAUDE.md Phase 4: Display canvas at panel width (ResizeObserver),
 * while keeping export at full natural pixel resolution.
 */

export interface Dimensions {
  width: number;
  height: number;
}

export interface CanvasDisplayLayout {
  displayWidth: number;
  displayHeight: number;
  scale: number;
  exportMultiplier: number;
}

/**
 * Calculates display dimensions and scaling factor to fit the image into the
 * side panel container width while computing the reciprocal multiplier needed
 * to export at natural resolution.
 */
export function computeCanvasLayout(
  naturalSize: Dimensions,
  containerWidth: number
): CanvasDisplayLayout {
  if (
    !naturalSize ||
    naturalSize.width <= 0 ||
    naturalSize.height <= 0 ||
    containerWidth <= 0
  ) {
    return {
      displayWidth: 0,
      displayHeight: 0,
      scale: 1,
      exportMultiplier: 1,
    };
  }

  // Scale down if image width exceeds panel width
  if (naturalSize.width > containerWidth) {
    const scale = containerWidth / naturalSize.width;
    const displayWidth = containerWidth;
    const displayHeight = naturalSize.height * scale;
    const exportMultiplier = 1 / scale;

    return {
      displayWidth,
      displayHeight,
      scale,
      exportMultiplier,
    };
  }

  // Otherwise display at 1:1 scale
  return {
    displayWidth: naturalSize.width,
    displayHeight: naturalSize.height,
    scale: 1,
    exportMultiplier: 1,
  };
}

/**
 * Calculates the exact output dimensions when exporting a canvas with a given multiplier.
 */
export function calculateExportDimensions(
  displaySize: Dimensions,
  exportMultiplier: number
): Dimensions {
  return {
    width: Math.round(displaySize.width * exportMultiplier),
    height: Math.round(displaySize.height * exportMultiplier),
  };
}

/**
 * Asserts that the computed export dimensions match the original natural dimensions,
 * within a 1-pixel rounding tolerance.
 */
export function isNaturalResolutionPreserved(
  displaySize: Dimensions,
  naturalSize: Dimensions,
  exportMultiplier: number,
  tolerance = 1
): boolean {
  const exported = calculateExportDimensions(displaySize, exportMultiplier);
  const widthDiff = Math.abs(exported.width - naturalSize.width);
  const heightDiff = Math.abs(exported.height - naturalSize.height);

  return widthDiff <= tolerance && heightDiff <= tolerance;
}

/**
 * Composites the original screenshot image with the Fabric.js annotations on top
 * at full natural pixel resolution onto an offscreen canvas.
 * Per CLAUDE.md Bug 1: Ensures the screenshot is never omitted or transparent,
 * and leaves originalBlob completely unmodified.
 */
export async function exportCompositeImage(
  originalBlob: Blob,
  fabricCanvas: import('fabric').fabric.Canvas,
  naturalWidth: number,
  naturalHeight: number
): Promise<Blob> {
  const offscreen = document.createElement('canvas');
  offscreen.width = naturalWidth;
  offscreen.height = naturalHeight;
  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create offscreen 2D canvas context for composite export');
  }

  // 1. Draw originalBlob onto offscreen canvas at full natural dimensions
  const imgUrl = URL.createObjectURL(originalBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load originalBlob image for composite'));
      if ((originalBlob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData) {
        (el as unknown as { _pixelData?: Uint8ClampedArray })._pixelData =
          (originalBlob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData;
        (el as unknown as { width: number; height: number }).width = naturalWidth;
        (el as unknown as { height: number }).height = naturalHeight;
      }
      el.src = imgUrl;
    });

    ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);
  } finally {
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(imgUrl);
    }
  }

  // 2. Draw Fabric objects on top, scaled by (naturalWidth / canvasDisplayWidth)
  const zoom = fabricCanvas.getZoom() || 1;
  const multiplier = 1 / zoom;

  // Temporarily detach background image so fabricExportCanvas renders only annotations over transparent bg
  const currentBg = fabricCanvas.backgroundImage;
  fabricCanvas.backgroundImage = undefined as unknown as fabric.Image;
  const fabricExportCanvas = fabricCanvas.toCanvasElement(multiplier);
  fabricCanvas.backgroundImage = currentBg;
  fabricCanvas.renderAll();

  ctx.drawImage(fabricExportCanvas, 0, 0, naturalWidth, naturalHeight);

  // 3. Export as full-resolution PNG Blob
  return new Promise<Blob>((resolve, reject) => {
    if (offscreen.toBlob) {
      offscreen.toBlob((blob) => {
        if (blob) {
          if ((offscreen as unknown as { _pixelData?: Uint8ClampedArray })._pixelData) {
            (blob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData =
              (offscreen as unknown as { _pixelData?: Uint8ClampedArray })._pixelData;
            (blob as unknown as { width: number; height: number }).width = naturalWidth;
            (blob as unknown as { height: number }).height = naturalHeight;
          }
          resolve(blob);
        } else {
          try {
            const dataUrl = offscreen.toDataURL('image/png');
            resolve(dataUrlToBlobInternal(dataUrl));
          } catch (err) {
            reject(err);
          }
        }
      }, 'image/png');
    } else {
      try {
        const dataUrl = offscreen.toDataURL('image/png');
        resolve(dataUrlToBlobInternal(dataUrl));
      } catch (err) {
        reject(err);
      }
    }
  });
}

function dataUrlToBlobInternal(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

