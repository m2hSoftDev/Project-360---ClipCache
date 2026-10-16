/**
 * Pure functions for crop coordinate math, scaling, and bounds clamping.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Normalizes two points into a rectangle with non-negative width/height
 * and top-left coordinates.
 */
export function normalizeRect(start: Point, current: Point): Rect {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);

  return { x, y, width, height };
}

/**
 * Clamps a rectangle to stay within the given boundary dimensions [0, 0, bounds.width, bounds.height].
 */
export function clampRect(rect: Rect, bounds: Dimensions): Rect {
  const clampedX = Math.max(0, Math.min(rect.x, bounds.width));
  const clampedY = Math.max(0, Math.min(rect.y, bounds.height));

  const maxWidth = Math.max(0, bounds.width - clampedX);
  const maxHeight = Math.max(0, bounds.height - clampedY);

  const clampedWidth = Math.max(0, Math.min(rect.width, maxWidth));
  const clampedHeight = Math.max(0, Math.min(rect.height, maxHeight));

  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
    width: Math.round(clampedWidth),
    height: Math.round(clampedHeight),
  };
}

/**
 * Computes scale factors between displayed element size and natural image resolution.
 */
export function computeDisplayToNaturalScale(
  displaySize: Dimensions,
  naturalSize: Dimensions
): { scaleX: number; scaleY: number } {
  if (displaySize.width <= 0 || displaySize.height <= 0) {
    return { scaleX: 1, scaleY: 1 };
  }

  return {
    scaleX: naturalSize.width / displaySize.width,
    scaleY: naturalSize.height / displaySize.height,
  };
}

/**
 * Transforms a rectangle from display/client coordinates to natural image coordinates.
 */
export function scaleRectToNatural(
  displayRect: Rect,
  displaySize: Dimensions,
  naturalSize: Dimensions
): Rect {
  const { scaleX, scaleY } = computeDisplayToNaturalScale(displaySize, naturalSize);

  const scaled: Rect = {
    x: displayRect.x * scaleX,
    y: displayRect.y * scaleY,
    width: displayRect.width * scaleX,
    height: displayRect.height * scaleY,
  };

  return clampRect(scaled, naturalSize);
}

/**
 * Validates whether a crop rectangle meets the minimum width and height threshold.
 */
export function isValidCrop(rect: Rect, minSize = 5): boolean {
  return rect.width >= minSize && rect.height >= minSize;
}

/**
 * Checks if a 2D point lies inside the given rectangle boundaries.
 */
export function isPointInsideRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Returns a simplified, human-readable aspect ratio label for given dimensions (e.g. "16:9", "4:3", "1:1").
 */
export function getAspectRatioLabel(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '0:0';

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const roundedW = Math.round(width);
  const roundedH = Math.round(height);
  const divisor = gcd(roundedW, roundedH);

  const ratioW = roundedW / divisor;
  const ratioH = roundedH / divisor;

  // Approximate common standards when numbers get large
  const decimal = roundedW / roundedH;
  if (Math.abs(decimal - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(decimal - 4 / 3) < 0.05) return '4:3';
  if (Math.abs(decimal - 1) < 0.02) return '1:1';
  if (Math.abs(decimal - 3 / 2) < 0.05) return '3:2';
  if (Math.abs(decimal - 21 / 9) < 0.05) return '21:9';

  return `${ratioW}:${ratioH}`;
}

/**
 * Crops a given image source using canvas and returns a Blob.
 */
export async function cropImageToBlob(
  sourceImage: HTMLImageElement | ImageBitmap,
  cropRect: Rect,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<Blob> {
  if (cropRect.width <= 0 || cropRect.height <= 0) {
    throw new Error('Crop rectangle width and height must be greater than zero');
  }

  const canvas = document.createElement('canvas');
  canvas.width = cropRect.width;
  canvas.height = cropRect.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to obtain 2D canvas context for crop');
  }

  ctx.drawImage(
    sourceImage,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas toBlob failed to produce a valid image'));
      }
    }, mimeType);
  });
}

/**
 * Convenience helper to crop a Blob directly and return a cropped Blob.
 */
export async function cropBlobToBlob(
  sourceBlob: Blob,
  cropRect: Rect,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(sourceBlob);

    img.onload = async () => {
      try {
        const cropped = await cropImageToBlob(img, cropRect, mimeType);
        URL.revokeObjectURL(objectUrl);
        resolve(cropped);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image blob for cropping'));
    };

    img.src = objectUrl;
  });
}

