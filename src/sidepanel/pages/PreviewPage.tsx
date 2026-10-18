import React, { useState, useRef } from 'react';
import { ScreenshotItem, CaptureMode } from '@/shared/types';
import { EditorToolbar, EditorTool } from '@/sidepanel/components/EditorToolbar';
import { EditorCanvas, EditorCanvasHandle } from '@/sidepanel/components/EditorCanvas';
import { DiscardModal } from '@/sidepanel/components/DiscardModal';
import { updateScreenshot, addScreenshot } from '@/sidepanel/lib/db';
import { AlertBanner, AlertType } from '@/sidepanel/components/AlertBanner';
import { ArrowLeft, Trash2, GitCompare, Download, Copy } from 'lucide-react';
import { CompareModal } from '@/sidepanel/components/CompareModal';
import {
  getExportSourceBlob,
  convertBlobToJpg,
  downloadBlob,
  copyBlobToClipboard,
} from '@/sidepanel/lib/exportUtils';

export interface PreviewPageProps {
  capture: ScreenshotItem;
  onBack: () => void;
  onDeleteClick: (capture: ScreenshotItem) => void;
}

const getModeBadgeClass = (mode: CaptureMode): string => {
  switch (mode) {
    case 'area':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'window':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'full':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'visible':
    default:
      return 'bg-brand-500/10 text-brand-400 border-brand-500/20';
  }
};

export const PreviewPage: React.FC<PreviewPageProps> = ({
  capture,
  onBack,
  onDeleteClick,
}) => {
  const canvasRef = useRef<EditorCanvasHandle>(null);

  // Active Tool & Styling
  const [activeTool, setActiveTool] = useState<EditorTool>(null);
  const [strokeColor, setStrokeColor] = useState<string>('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);

  // History & Unsaved Changes
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Crop & Text specific state
  const [hasCropSelection, setHasCropSelection] = useState<boolean>(false);
  const [isTypingText, setIsTypingText] = useState<boolean>(false);

  // Modals & Alerts
  const [isDiscardOpen, setIsDiscardOpen] = useState<boolean>(false);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [alert, setAlert] = useState<{ type: AlertType; message: string } | null>(null);

  const formattedCreatedTime = new Date(capture.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Export handlers (Phase 5): Download PNG/JPG, Copy to Clipboard
  const handleDownload = async (format: 'png' | 'jpg') => {
    setIsExporting(true);
    setAlert(null);
    try {
      const sourceBlob = getExportSourceBlob(capture);
      const safeTitle = (capture.pageTitle || 'screenshot')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 30);
      const filename = `${safeTitle}-${capture.id || Date.now()}.${format}`;

      if (format === 'jpg') {
        const jpgBlob = await convertBlobToJpg(sourceBlob);
        downloadBlob(jpgBlob, filename);
      } else {
        downloadBlob(sourceBlob, filename);
      }

      setAlert({
        type: 'success',
        message: `Saved ${format.toUpperCase()} to local disk successfully!`,
      });
    } catch (err) {
      setAlert({
        type: 'error',
        message: err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}.`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyClipboard = async () => {
    setIsExporting(true);
    setAlert(null);
    try {
      const sourceBlob = getExportSourceBlob(capture);
      const res = await copyBlobToClipboard(sourceBlob);
      if (res.success) {
        setAlert({
          type: 'success',
          message: 'Copied PNG screenshot to clipboard!',
        });
      } else {
        setAlert({
          type: 'error',
          message: res.error || 'Failed to copy to clipboard.',
        });
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: err instanceof Error ? err.message : 'Clipboard write failed.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 1. Save: exports canvas at natural size, writes to same Dexie record, leaves originalBlob unchanged
  const handleSave = async () => {
    if (!capture.id || !canvasRef.current || isSaving) return;
    setIsSaving(true);
    setAlert(null);

    try {
      const { blob: editedBlob, editState } = await canvasRef.current.save();
      await updateScreenshot(capture.id, {
        editedBlob,
        editState,
        isEdited: true,
      });

      setActiveTool(null);
      setHasUnsavedChanges(false);
      setAlert({
        type: 'success',
        message: 'Edits saved successfully at full natural resolution!',
      });
    } catch (err) {
      setAlert({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save edits.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Reset: restores canvas to original unmodified capture and clears edited record in Dexie if edited
  const handleReset = async () => {
    if (!canvasRef.current) return;
    canvasRef.current.reset();
    setActiveTool(null);
    setHasUnsavedChanges(false);
    if (capture.isEdited && capture.id) {
      await updateScreenshot(capture.id, {
        editedBlob: null,
        editState: null,
        isEdited: false,
      });
      setAlert({
        type: 'info',
        message: 'Reverted back to original unmodified capture.',
      });
    }
  };

  // 2. Crop: saves cropped area as a NEW record with parentId set to original
  const handleApplyCrop = async () => {
    if (!capture.id || !canvasRef.current) return;
    try {
      const cropRect = canvasRef.current.getActiveCropRect();
      const croppedBlob = await canvasRef.current.applyCrop();
      if (!croppedBlob || !cropRect) return;

      const newCropItem: Omit<ScreenshotItem, 'id'> = {
        createdAt: Date.now(),
        sourceUrl: capture.sourceUrl,
        pageTitle: `${capture.pageTitle || 'Capture'} (Crop)`,
        mode: 'area',
        originalBlob: croppedBlob,
        editedBlob: null,
        editState: null,
        width: cropRect.width,
        height: cropRect.height,
        isEdited: false,
        parentId: capture.id,
      };

      const newId = await addScreenshot(newCropItem);
      setActiveTool(null);
      setAlert({
        type: 'success',
        message: `Cropped area saved as new screenshot #${newId} with parentId ${capture.id}!`,
      });
    } catch (err) {
      setAlert({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to crop image.',
      });
    }
  };

  // 3. Back: prompts if unsaved changes exist
  const handleBack = () => {
    if (hasUnsavedChanges) {
      setIsDiscardOpen(true);
    } else {
      onBack();
    }
  };

  return (
    <div
      data-testid="preview-page"
      className="flex flex-col min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white"
    >
      {/* Top Header: Title, mode, size, and created time above the image */}
      <header className="px-3.5 py-3 bg-slate-900 border-b border-slate-800 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBack}
              title="Back to gallery"
              aria-label="Back to gallery"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2
              data-testid="preview-title"
              className="text-xs font-bold text-white truncate max-w-[220px]"
              title={capture.pageTitle || 'Untitled Capture'}
            >
              {capture.pageTitle || 'Untitled Capture'}
            </h2>
          </div>

          <button
            onClick={() => onDeleteClick(capture)}
            title="Delete this capture"
            aria-label="Delete capture"
            data-testid="preview-delete-button"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-950/70 border border-rose-900/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>

        {/* Metadata Bar */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-400">
          <span
            data-testid="preview-mode"
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getModeBadgeClass(
              capture.mode
            )}`}
          >
            {capture.mode.toUpperCase()}
          </span>

          <span data-testid="preview-size" className="font-mono text-slate-300">
            {capture.width} × {capture.height} px
          </span>

          <span className="text-slate-600">•</span>

          <span data-testid="preview-created-time" className="text-slate-400">
            {formattedCreatedTime}
          </span>
        </div>

        {/* Phase 5 Action Bar: Compare View & Local Storage Export */}
        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={() => {
                if (!capture.editedBlob) {
                  setAlert({
                    type: 'info',
                    message: 'No edits yet. Edit and save first.',
                  });
                  return;
                }
                setIsCompareOpen(true);
              }}
              disabled={!capture.editedBlob}
              data-testid="preview-compare-button"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors shrink-0 ${
                capture.editedBlob
                  ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-sm'
                  : 'bg-slate-800/80 text-slate-500 opacity-60 cursor-not-allowed'
              }`}
              title={
                capture.editedBlob
                  ? 'Compare original vs edited version'
                  : 'No edits yet. Edit and save first.'
              }
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare</span>
            </button>

            {!capture.editedBlob && (
              <span
                data-testid="compare-no-edits-hint"
                className="text-[10px] text-slate-500 truncate"
              >
                No edits yet. Edit and save first.
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => void handleDownload('png')}
              disabled={isExporting}
              data-testid="preview-export-png"
              aria-label="Download PNG"
              title="Download PNG to local disk (edited if available, otherwise original)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3 text-slate-400" />
              <span>PNG</span>
            </button>

            <button
              onClick={() => void handleDownload('jpg')}
              disabled={isExporting}
              data-testid="preview-export-jpg"
              aria-label="Download JPG"
              title="Download JPG to local disk with white background"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3 text-slate-400" />
              <span>JPG</span>
            </button>

            <button
              onClick={() => void handleCopyClipboard()}
              disabled={isExporting}
              data-testid="preview-export-copy"
              aria-label="Copy to Clipboard"
              title="Copy PNG blob to clipboard"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3 text-slate-400" />
              <span>Copy</span>
            </button>
          </div>
        </div>
      </header>

      {/* Preview / Editor Toolbar (Phase 4: all tools enabled in exact order) */}
      <EditorToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        canUndo={canUndo}
        canRedo={canRedo}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        onReset={() => void handleReset()}
        onSave={() => void handleSave()}
        onBack={handleBack}
        strokeColor={strokeColor}
        onChangeColor={setStrokeColor}
        strokeWidth={strokeWidth}
        onChangeStrokeWidth={setStrokeWidth}
        hasActiveCropSelection={hasCropSelection}
        onApplyCrop={() => void handleApplyCrop()}
        onCancelCrop={() => canvasRef.current?.cancelCrop()}
        isTypingText={isTypingText}
        onConfirmText={() => canvasRef.current?.confirmText()}
      />

      {/* Alerts */}
      {alert && (
        <div className="p-3">
          <AlertBanner
            type={alert.type}
            message={alert.message}
            onDismiss={() => setAlert(null)}
          />
        </div>
      )}

      {/* Fabric.js Canvas Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start bg-slate-950">
        <EditorCanvas
          ref={canvasRef}
          capture={capture}
          activeTool={activeTool}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          onHistoryChange={(undoable, redoable, unsaved) => {
            setCanUndo(undoable);
            setCanRedo(redoable);
            setHasUnsavedChanges(unsaved);
          }}
          onCropSelectionChange={setHasCropSelection}
          onTypingTextChange={setIsTypingText}
        />
      </main>

      {/* Discard Changes Confirmation Modal */}
      <DiscardModal
        isOpen={isDiscardOpen}
        onDiscard={() => {
          setIsDiscardOpen(false);
          onBack();
        }}
        onKeepEditing={() => setIsDiscardOpen(false)}
      />

      {/* Compare Modal (Phase 5) */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        originalBlob={capture.originalBlob}
        editedBlob={capture.editedBlob}
        pageTitle={capture.pageTitle}
        width={capture.width}
        height={capture.height}
      />
    </div>
  );
};
