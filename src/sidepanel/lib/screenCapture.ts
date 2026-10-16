import { logger } from '@/shared/logger';
import { CaptureMode } from '@/shared/types';

export interface CaptureResult {
  blob: Blob;
  width: number;
  height: number;
  pageTitle: string;
  sourceUrl: string;
  mode: CaptureMode;
}

/**
 * Captures screen, window, or tab using navigator.mediaDevices.getDisplayMedia.
 * Stops all tracks immediately after grabbing the single frame.
 */
export async function captureDisplayMedia(): Promise<CaptureResult> {
  if (!navigator?.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen capture API is not supported in this environment or context.');
  }

  let stream: MediaStream | null = null;
  const video = document.createElement('video');

  try {
    // Calling getDisplayMedia without restricting displaySurface lets user choose
    // between screen, window, or browser tab.
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
      },
      audio: false,
    });

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track available from captured media stream.');
    }

    // Determine capture mode based on displaySurface settings if available
    const settings = typeof videoTrack.getSettings === 'function' ? videoTrack.getSettings() : {};
    let mode: CaptureMode = 'visible';
    if (settings.displaySurface === 'window') {
      mode = 'window';
    } else if (settings.displaySurface === 'monitor') {
      mode = 'visible';
    }

    video.srcObject = stream;
    video.muted = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(reject);
      };
      video.onerror = () => reject(new Error('Failed to load video stream frame.'));
    });

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) {
      throw new Error('Captured stream produced zero dimensions. Please select an active display.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to initialize 2D canvas context for capture.');
    }

    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to encode canvas to PNG blob.'));
      }, 'image/png');
    });

    // Query active tab info for context metadata
    let sourceUrl = 'display-media';
    let pageTitle = 'Screen Capture';

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.url) sourceUrl = activeTab.url;
        if (activeTab?.title) pageTitle = activeTab.title;
      }
    } catch (tabError) {
      logger.warn('Could not query active tab info', tabError);
    }

    logger.info(`Captured frame: ${width}x${height} (mode: ${mode})`);
    return { blob, width, height, pageTitle, sourceUrl, mode };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Screen capture was cancelled or permission was denied. Please allow sharing in the prompt to capture.');
      }
      if (error.name === 'AbortError') {
        throw new Error('Screen capture request was aborted before completion.');
      }
    }
    logger.error('Screen capture error', error);
    throw error;
  } finally {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    video.srcObject = null;
  }
}

/**
 * Loads an image Blob and extracts its natural dimensions into a standardized CaptureResult.
 */
export async function processImageBlob(
  blob: Blob,
  title = 'Image Capture',
  source = 'file-upload',
  mode: CaptureMode = 'visible'
): Promise<CaptureResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);

      if (width === 0 || height === 0) {
        reject(new Error('Selected image has invalid zero dimensions.'));
        return;
      }

      resolve({
        blob,
        width,
        height,
        pageTitle: title,
        sourceUrl: source,
        mode,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image file. It may be corrupt or in an unsupported format.'));
    };

    img.src = url;
  });
}

/**
 * Reads an image from the system clipboard using the modern Clipboard API.
 */
export async function readImageFromClipboardApi(): Promise<CaptureResult> {
  if (!navigator?.clipboard?.read) {
    throw new Error('Clipboard API is unavailable in this environment. Please press Ctrl+V to paste directly.');
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          return await processImageBlob(blob, 'Clipboard Image', 'clipboard-paste', 'visible');
        }
      }
    }
    throw new Error('No image found in clipboard. Please copy an image first (Ctrl+C / PrtScn), then try again or press Ctrl+V.');
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Clipboard access was denied. Please press Ctrl+V directly to paste.');
      }
      throw error;
    }
    throw new Error('Could not access clipboard.');
  }
}

/**
 * Extracts the first valid image File from a DataTransfer object (drag-and-drop or paste).
 */
export function extractImageFromDataTransfer(dataTransfer: DataTransfer): File | null {
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (file.type.startsWith('image/')) {
        return file;
      }
    }
  }

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }

  return null;
}
