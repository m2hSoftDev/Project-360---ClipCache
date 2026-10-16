import { addScreenshot, getScreenshotCount } from '@/sidepanel/lib/db';
import { checkCaptureLimit, FREE_PLAN_LIMIT } from './limits';
import { ScreenshotItem } from '@/shared/types';
import { logger } from '@/shared/logger';

/**
 * Checks if a URL cannot be captured due to browser security restrictions.
 * Per CLAUDE.md: chrome://, edge://, and Chrome Web Store pages cannot be captured.
 */
export function isRestrictedUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://') ||
    url.includes('chromewebstore.google.com') ||
    url.includes('chrome.google.com/webstore')
  );
}

/**
 * Converts a data URL (e.g. from captureVisibleTab) into a native Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Reads width and height of an image Blob, supporting both Service Worker (createImageBitmap)
 * and DOM (Image) environments.
 */
export async function getBlobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      // Fall through to Image fallback
    }
  }

  if (typeof Image !== 'undefined') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        URL.revokeObjectURL(url);
        resolve({ width, height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for dimensions'));
      };
      img.src = url;
    });
  }

  return { width: 1280, height: 720 };
}

export interface CaptureActionResult {
  success: boolean;
  screenshotId?: number;
  error?: string;
  item?: ScreenshotItem;
}

/**
 * Captures the currently active tab using chrome.tabs.captureVisibleTab.
 * Strictly adheres to CLAUDE.md:
 * - No picker or user prompt
 * - Checks free plan limit (20)
 * - Blocks restricted chrome:// / store pages with clear message
 * - Auto-saves to Dexie with mode: 'visible' before returning
 */
export async function captureVisibleTabAction(): Promise<CaptureActionResult> {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs?.captureVisibleTab) {
      throw new Error('Chrome tabs capture API is not available in this context.');
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || activeTab.id === undefined) {
      return { success: false, error: 'No active tab found to capture.' };
    }

    // 1. Check restricted URLs
    if (isRestrictedUrl(activeTab.url)) {
      const msg = 'chrome://, edge://, and Chrome Web Store pages cannot be captured.';
      logger.warn(msg, activeTab.url);
      return { success: false, error: msg };
    }

    // 2. Check free plan limits
    const currentCount = await getScreenshotCount();
    const limitCheck = checkCaptureLimit(currentCount, false);
    if (!limitCheck.allowed) {
      const msg =
        limitCheck.message ||
        `Free limit reached (${FREE_PLAN_LIMIT}/${FREE_PLAN_LIMIT}). Delete a capture to add a new one.`;
      logger.warn(msg);
      return { success: false, error: msg };
    }

    // 3. Capture visible tab with NO picker
    const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: 'png',
    });

    const blob = dataUrlToBlob(dataUrl);
    const { width, height } = await getBlobDimensions(blob);

    // 4. Auto-save to Dexie conforming to CLAUDE.md schema
    const newItem: Omit<ScreenshotItem, 'id'> = {
      createdAt: Date.now(),
      sourceUrl: activeTab.url || '',
      pageTitle: activeTab.title || 'Captured Tab',
      mode: 'visible',
      originalBlob: blob,
      editedBlob: null,
      editState: null,
      width,
      height,
      isEdited: false,
      parentId: null,
    };

    const id = await addScreenshot(newItem);
    const savedItem: ScreenshotItem = { ...newItem, id };

    logger.info(`Visible tab captured successfully, id=${id}`);
    return { success: true, screenshotId: id, item: savedItem };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to capture visible tab.';
    logger.error('Visible tab capture error', error);
    return { success: false, error: errorMsg };
  }
}
