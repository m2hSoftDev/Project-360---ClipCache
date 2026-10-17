import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor,
  Clipboard,
  UploadCloud,
  Keyboard,
  ShieldCheck,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  extractImageFromDataTransfer,
  processImageBlob,
  CaptureResult,
} from '@/sidepanel/lib/screenCapture';
import {
  captureVisibleTabAction,
} from '@/background/capture';
import {
  addScreenshot,
  getAllScreenshots,
  deleteScreenshot,
  getScreenshotCount,
  getLinkedChildrenCount,
} from '@/sidepanel/lib/db';
import { checkCaptureLimit, FREE_PLAN_LIMIT } from '@/background/limits';
import { ScreenshotItem, CaptureMode } from '@/shared/types';
import { AlertBanner, AlertType } from '@/sidepanel/components/AlertBanner';
import { AreaCropOverlay } from '@/sidepanel/components/AreaCropOverlay';
import { GalleryGrid } from '@/sidepanel/components/GalleryGrid';
import { PreviewPage } from '@/sidepanel/pages/PreviewPage';
import { DeleteConfirmModal } from '@/sidepanel/components/DeleteConfirmModal';

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const CapturePage: React.FC = () => {
  // Reactive screenshots query from Dexie via dexie-react-hooks
  const liveCaptures = useLiveQuery(() => getAllScreenshots(), []);
  const captures = liveCaptures || [];
  const captureCount = captures.length;

  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Active Area Crop Target
  const [cropTarget, setCropTarget] = useState<ScreenshotItem | null>(null);

  // Active Full-size Preview Target (Phase 3 Preview Page)
  const [previewTarget, setPreviewTarget] = useState<ScreenshotItem | null>(null);

  // Delete Confirmation Modal State (Phase 3)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    target: ScreenshotItem | null;
    linkedCount: number;
  }>({
    isOpen: false,
    target: null,
    linkedCount: 0,
  });
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Alerts
  const [alert, setAlert] = useState<{ type: AlertType; message: string } | null>(null);

  // Drag-and-drop state
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active shortcut loaded directly from chrome.commands.getAll() for 'capture-visible-v2'
  const [activeShortcut, setActiveShortcut] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const fetchShortcut = () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.commands?.getAll) {
          chrome.commands.getAll((commands) => {
            if (!isMounted) return;
            const cmd = commands?.find((c) => c.name === 'capture-visible-v2');
            if (cmd && cmd.shortcut) {
              setActiveShortcut(cmd.shortcut);
            } else {
              setActiveShortcut('Not set. Set it at chrome://extensions/shortcuts');
            }
          });
        } else {
          if (isMounted) setActiveShortcut('Not set. Set it at chrome://extensions/shortcuts');
        }
      } catch {
        if (isMounted) setActiveShortcut('Not set. Set it at chrome://extensions/shortcuts');
      }
    };

    fetchShortcut();

    const onFocus = () => fetchShortcut();
    const onVisibilityChange = () => {
      if (!document.hidden) fetchShortcut();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('mouseenter', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const interval = setInterval(fetchShortcut, 1000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('mouseenter', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  // Core save helper conforming to CLAUDE.md schema
  const saveCaptureToDexie = async (
    result: CaptureResult,
    customMode?: CaptureMode,
    parentId: number | null = null
  ): Promise<ScreenshotItem> => {
    // Check free plan limits
    const currentCount = await getScreenshotCount();
    const limitCheck = checkCaptureLimit(currentCount, false);

    if (!limitCheck.allowed) {
      const msg =
        limitCheck.message ||
        `Free limit reached (${FREE_PLAN_LIMIT}/${FREE_PLAN_LIMIT}). Delete a capture to add a new one.`;
      setAlert({ type: 'warning', message: msg });
      throw new Error(msg);
    }

    const newItem: Omit<ScreenshotItem, 'id'> = {
      createdAt: Date.now(),
      sourceUrl: result.sourceUrl,
      pageTitle: result.pageTitle,
      mode: customMode || result.mode,
      originalBlob: result.blob,
      editedBlob: null,
      editState: null,
      width: result.width,
      height: result.height,
      isEdited: false,
      parentId,
    };

    const id = await addScreenshot(newItem);
    return { ...newItem, id };
  };

  // 1. Capture Visible Tab via captureVisibleTab (NO picker prompt)
  const handleVisibleTabCapture = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setAlert(null);

    try {
      const result = await captureVisibleTabAction();

      if (!result.success || !result.item) {
        setAlert({
          type: 'error',
          message: result.error || 'Failed to capture visible tab.',
        });
        return;
      }

      setAlert({
        type: 'success',
        message: `Captured visible tab (${result.item.width}×${result.item.height}). Drag a rectangle to crop if desired!`,
      });

      // Automatically open area crop for newly captured image
      setCropTarget(result.item);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Visible tab capture failed.';
      setAlert({ type: 'error', message });
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  // Listen for background service worker capture broadcasts (Alt+Shift+S)
  useEffect(() => {
    const handleRuntimeMessage = (message: {
      type: string;
      success?: boolean;
      screenshotId?: number;
      error?: string;
    }) => {
      if (message.type === 'CAPTURE_RESPONSE') {
        if (message.success) {
          setAlert({
            type: 'success',
            message: 'Visible tab captured via Alt+Shift+S and saved to Dexie!',
          });
        } else if (message.error) {
          setAlert({
            type: 'error',
            message: message.error,
          });
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
      return () => chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    }
  }, []);

  // 2. Clipboard Paste Handler
  const handleProcessBlob = useCallback(
    async (blob: Blob, title = 'Pasted Capture', source = 'clipboard-paste') => {
      setIsCapturing(true);
      setAlert(null);

      try {
        const result = await processImageBlob(blob, title, source, 'visible');
        const saved = await saveCaptureToDexie(result, 'visible');

        setAlert({
          type: 'success',
          message: `Pasted image saved (${result.width}×${result.height}).`,
        });

        setCropTarget(saved);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to process image.';
        setAlert({ type: 'error', message });
      } finally {
        setIsCapturing(false);
      }
    },
    []
  );

  const handleClipboardClick = async () => {
    try {
      if (!navigator.clipboard?.read) {
        throw new Error('Please press Ctrl+V to paste directly into ClipCache.');
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (ACCEPTED_IMAGE_TYPES.includes(type)) {
            const blob = await item.getType(type);
            await handleProcessBlob(blob, 'Clipboard Image', 'clipboard-paste');
            return;
          }
        }
      }
      setAlert({
        type: 'warning',
        message: 'No image found in clipboard. Copy an image first, then click Paste or press Ctrl+V.',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Could not access clipboard.';
      setAlert({ type: 'warning', message: msg });
    }
  };

  // Global Paste (Ctrl+V) listener
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target?.tagName) || target?.isContentEditable) {
        return;
      }

      if (e.clipboardData) {
        const imageFile = extractImageFromDataTransfer(e.clipboardData);
        if (imageFile && ACCEPTED_IMAGE_TYPES.includes(imageFile.type)) {
          e.preventDefault();
          void handleProcessBlob(imageFile, imageFile.name || 'Pasted Image', 'clipboard-paste');
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handleProcessBlob]);


  // 3. File Drag-and-Drop Handlers strictly limited to PNG, JPG, and WebP
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer) {
      const imageFile = extractImageFromDataTransfer(e.dataTransfer);
      if (imageFile && ACCEPTED_IMAGE_TYPES.includes(imageFile.type)) {
        void handleProcessBlob(imageFile, imageFile.name, 'file-drop');
      } else {
        setAlert({
          type: 'warning',
          message: 'Only PNG, JPG, and WebP files are supported. Please drop a valid image file.',
        });
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        void handleProcessBlob(file, file.name, 'file-upload');
      } else {
        setAlert({
          type: 'warning',
          message: 'Only PNG, JPG, and WebP files are supported. Please choose a valid image file.',
        });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 4. Area Crop Save Callback (saves NEW record with parentId per CLAUDE.md)
  const handleSaveCroppedArea = async (
    croppedBlob: Blob,
    cropWidth: number,
    cropHeight: number
  ) => {
    if (!cropTarget) return;

    const cropResult: CaptureResult = {
      blob: croppedBlob,
      width: cropWidth,
      height: cropHeight,
      pageTitle: `${cropTarget.pageTitle} (Crop)`,
      sourceUrl: cropTarget.sourceUrl,
      mode: 'area',
    };

    await saveCaptureToDexie(cropResult, 'area', cropTarget.id ?? null);
    setAlert({
      type: 'success',
      message: `Cropped area saved as new screenshot (${cropWidth}×${cropHeight})!`,
    });
    setCropTarget(null);
  };

  // 5. Delete Capture Callback (With Confirmation Dialog & ParentId Cascade per Phase 3)
  const promptDelete = async (capture: ScreenshotItem) => {
    if (!capture.id) return;
    const linkedCount = await getLinkedChildrenCount(capture.id);
    setDeleteModal({
      isOpen: true,
      target: capture,
      linkedCount,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.target?.id) return;
    setIsDeleting(true);
    try {
      const targetId = deleteModal.target.id;
      const deletedIds = await deleteScreenshot(targetId);
      setAlert({
        type: 'info',
        message: `Deleted capture${
          deletedIds.length > 1 ? ` and ${deletedIds.length - 1} linked edit/crop items` : ''
        } from local storage.`,
      });
      if (previewTarget?.id === targetId) {
        setPreviewTarget(null);
      }
      if (cropTarget?.id === targetId) {
        setCropTarget(null);
      }
    } catch {
      setAlert({
        type: 'error',
        message: 'Failed to delete screenshot.',
      });
    } finally {
      setIsDeleting(false);
      setDeleteModal({ isOpen: false, target: null, linkedCount: 0 });
    }
  };

  // Preview Page View per CLAUDE.md Phase 3
  if (previewTarget) {
    const activeCapture = captures.find((c) => c.id === previewTarget.id) || previewTarget;
    return (
      <>
        <PreviewPage
          capture={activeCapture}
          onBack={() => setPreviewTarget(null)}
          onDeleteClick={(cap) => void promptDelete(cap)}
        />
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          capture={deleteModal.target}
          linkedCount={deleteModal.linkedCount}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal({ isOpen: false, target: null, linkedCount: 0 })}
          isDeleting={isDeleting}
        />
      </>
    );
  }

  const limitPercentage = Math.min(100, Math.round((captureCount / FREE_PLAN_LIMIT) * 100));

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 p-4 gap-4 selection:bg-brand-500 selection:text-white">
      {/* Header */}
      <header className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/25">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              ClipCache
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20">
                Phase 3
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Gallery & Preview</p>
          </div>
        </div>

        {/* Quota Badge & Shortcut Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer"
            title="Configure capture shortcut at chrome://extensions/shortcuts"
            data-testid="shortcut-badge"
          >
            <Keyboard className="w-3.5 h-3.5 text-brand-400" />
            <span className="font-mono text-[11px] font-semibold" data-testid="shortcut-label">
              {activeShortcut}
            </span>
          </button>

          {/* Show the free-plan count as "X / 20" at the top per CLAUDE.md Phase 3 */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
            title={`Free plan limit: ${captureCount} of ${FREE_PLAN_LIMIT} captures used`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium" data-testid="free-plan-count">
              {captureCount} / {FREE_PLAN_LIMIT}
            </span>
          </div>
        </div>
      </header>

      {/* Free Plan Limit Progress Bar */}
      <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            limitPercentage >= 90
              ? 'bg-rose-500'
              : limitPercentage >= 70
              ? 'bg-amber-500'
              : 'bg-gradient-to-r from-brand-500 to-cyan-400'
          }`}
          style={{ width: `${limitPercentage}%` }}
        />
      </div>

      {/* Alerts */}
      {alert && (
        <AlertBanner
          type={alert.type}
          message={alert.message}
          onDismiss={() => setAlert(null)}
        />
      )}

      {/* Active Area Crop View */}
      {cropTarget && (
        <section aria-label="Area Crop Interface">
          <AreaCropOverlay
            imageBlob={cropTarget.editedBlob || cropTarget.originalBlob}
            initialPageTitle={cropTarget.pageTitle}
            sourceUrl={cropTarget.sourceUrl}
            onSaveCropped={handleSaveCroppedArea}
            onCancelOrClose={() => setCropTarget(null)}
          />
        </section>
      )}

      {/* Main Capture Dashboard */}
      {!cropTarget && (
        <main className="flex flex-col gap-4">
          {/* Primary Action: Capture Visible Tab with Alt+Shift+S (NO picker) */}
          <button
            onClick={handleVisibleTabCapture}
            disabled={isCapturing}
            className="group relative flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-brand-900/40 via-slate-900 to-slate-900 border border-brand-500/30 hover:border-brand-500/60 shadow-xl shadow-brand-500/5 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-left overflow-hidden"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-brand-500/30 group-hover:scale-105 transition-transform shrink-0">
                <Monitor className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">
                    {isCapturing ? 'Capturing...' : 'Capture Visible Tab'}
                  </h2>
                  <span
                    data-testid="card-shortcut-label"
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30"
                  >
                    {activeShortcut}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">
                  Instant tab capture with no picker prompt (chrome.tabs.captureVisibleTab)
                </p>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 transition-colors shrink-0 ml-2" />
          </button>

          {/* Dual Dropzone / Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Clipboard Paste Box */}
            <div
              onClick={handleClipboardClick}
              className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all gap-2 text-center group"
            >
              <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 group-hover:scale-105 transition-transform">
                <Clipboard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                  Paste Clipboard
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">Ctrl+V</kbd> or click to paste
                </p>
              </div>
            </div>

            {/* Drag & Drop Upload Box — strictly listing PNG, JPG, or WebP per Item 3 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed transition-all gap-2 text-center cursor-pointer ${
                isDraggingOver
                  ? 'bg-brand-500/10 border-brand-400 text-brand-200 scale-[1.01]'
                  : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-200">
                  {isDraggingOver ? 'Drop image here' : 'Drop Image or Browse'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Accepts PNG, JPG, or WebP
                </p>
              </div>
            </div>
          </div>

          {/* Information Tip */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/30 border border-slate-800/50 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-brand-400 shrink-0" />
            <span>
              Click any capture below to open a full preview. Drag a box in Area Crop to save a new slice.
            </span>
          </div>

          {/* Capture Gallery using CSS grid minmax(140px, 1fr) per CLAUDE.md Phase 3 */}
          <section aria-label="Capture Gallery">
            <GalleryGrid
              captures={captures}
              onSelectPreview={(cap) => setPreviewTarget(cap)}
              onDeleteClick={(cap) => void promptDelete(cap)}
            />
          </section>
        </main>
      )}

      {/* Delete Confirmation Modal (Phase 3) */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        capture={deleteModal.target}
        linkedCount={deleteModal.linkedCount}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, target: null, linkedCount: 0 })}
        isDeleting={isDeleting}
      />


      {/* Footer */}
      <footer className="mt-auto pt-3 border-t border-slate-800/80 text-center flex items-center justify-between text-[11px] text-slate-500">
        <span>ClipCache • Phase 3 Gallery & Preview</span>
        <span>IndexedDB: Ready</span>
      </footer>
    </div>
  );
};

export default CapturePage;
