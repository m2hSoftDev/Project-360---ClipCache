/**
 * Export utilities for Phase 5 (CLAUDE.md):
 * - Download PNG and JPG to local storage (disk).
 * - Chooses edited version if it exists, otherwise original.
 * - JPG export fills transparent areas with a solid white background.
 * - Copy to clipboard as PNG via navigator.clipboard.write with error reporting.
 */

export interface ExportSourceItem {
  originalBlob: Blob;
  editedBlob?: Blob | null;
}

/**
 * Returns the editedBlob if available, otherwise falls back to originalBlob.
 * Used for all Phase 5 exports (PNG, JPG, Clipboard).
 */
export function getExportSourceBlob(capture: ExportSourceItem): Blob {
  return capture.editedBlob || capture.originalBlob;
}

/**
 * Returns whether the active export is using the edited version.
 */
export function isUsingEditedBlob(capture: ExportSourceItem): boolean {
  return Boolean(capture.editedBlob);
}

/**
 * Internal helper to convert a data URL string to a typed Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/**
 * Loads an HTMLImageElement from a Blob.
 * Forwards mock pixelData in test environments.
 */
async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const imgUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image from blob'));
      if ((blob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData) {
        (img as unknown as { _pixelData?: Uint8ClampedArray })._pixelData =
          (blob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData;
        (img as unknown as { width: number; height: number }).width =
          (blob as unknown as { width?: number }).width || 100;
        (img as unknown as { height: number }).height =
          (blob as unknown as { height?: number }).height || 100;
      }
      img.src = imgUrl;
    });
  } finally {
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(imgUrl);
    }
  }
}

/**
 * Converts any image blob into a JPEG Blob.
 * Per CLAUDE.md Phase 5: Uses a solid white background (#ffffff) for transparent areas.
 */
export async function convertBlobToJpg(
  sourceBlob: Blob,
  quality = 0.92
): Promise<Blob> {
  const img = await loadImageFromBlob(sourceBlob);
  const width = img.naturalWidth || img.width || 100;
  const height = img.naturalHeight || img.height || 100;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas 2D context for JPG conversion');
  }

  // 1. Fill white background for transparent areas
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. Draw image on top of white background
  ctx.drawImage(img, 0, 0, width, height);

  // 3. Export as image/jpeg
  return new Promise<Blob>((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            if ((canvas as unknown as { _pixelData?: Uint8ClampedArray })._pixelData) {
              (blob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData =
                (canvas as unknown as { _pixelData?: Uint8ClampedArray })._pixelData;
              (blob as unknown as { width: number; height: number }).width = width;
              (blob as unknown as { height: number }).height = height;
            }
            resolve(blob);
          } else {
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', quality);
              resolve(dataUrlToBlob(dataUrl));
            } catch (err) {
              reject(err);
            }
          }
        },
        'image/jpeg',
        quality
      );
    } else {
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrlToBlob(dataUrl));
      } catch (err) {
        reject(err);
      }
    }
  });
}

/**
 * Ensures an image blob is in image/png format.
 */
export async function convertBlobToPng(sourceBlob: Blob): Promise<Blob> {
  if (sourceBlob.type === 'image/png') {
    return sourceBlob;
  }

  const img = await loadImageFromBlob(sourceBlob);
  const width = img.naturalWidth || img.width || 100;
  const height = img.naturalHeight || img.height || 100;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas 2D context for PNG conversion');
  }

  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrlToBlob(dataUrl));
          } catch (err) {
            reject(err);
          }
        }
      }, 'image/png');
    } else {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrlToBlob(dataUrl));
      } catch (err) {
        reject(err);
      }
    }
  });
}

/**
 * Triggers a browser file download saving the blob to local disk.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

export interface ClipboardResult {
  success: boolean;
  error?: string;
}

/**
 * Copies a PNG blob to the system clipboard via navigator.clipboard.write.
 * Per CLAUDE.md Phase 5: Shows a clear error if the browser blocks it.
 */
export async function copyBlobToClipboard(blob: Blob): Promise<ClipboardResult> {
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
      return {
        success: false,
        error:
          'Clipboard API is not supported by your browser or cannot be accessed in this context.',
      };
    }

    const pngBlob = await convertBlobToPng(blob);
    const clipboardItem = new ClipboardItem({ 'image/png': pngBlob });
    await navigator.clipboard.write([clipboardItem]);

    return { success: true };
  } catch (err) {
    const errorDetails =
      err instanceof Error ? err.message : 'Unknown clipboard error';
    return {
      success: false,
      error: `Clipboard access blocked: ${errorDetails}. Please ensure clipboard permissions are enabled.`,
    };
  }
}
