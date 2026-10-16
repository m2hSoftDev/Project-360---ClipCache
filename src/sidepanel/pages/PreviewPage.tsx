import React, { useEffect, useState, useRef } from 'react';
import { ScreenshotItem, CaptureMode } from '@/shared/types';
import {
  Crop,
  Droplet,
  PenTool,
  Type,
  ArrowRight,
  Undo2,
  Redo2,
  RotateCcw,
  Save,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { calculatePreviewDimensions } from '@/sidepanel/lib/previewMath';

export interface PreviewPageProps {
  capture: ScreenshotItem;
  onBack: () => void;
  onDeleteClick: (capture: ScreenshotItem) => void;
}

interface ToolbarButtonDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  tooltip: string;
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
  const [imageUrl, setImageUrl] = useState<string>('');
  const [containerWidth, setContainerWidth] = useState<number>(360);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Lifecycle: Create object URL on open, revoke on close per CLAUDE.md Side Panel rule 6
  useEffect(() => {
    const blobToDisplay = capture.editedBlob || capture.originalBlob;
    const url = URL.createObjectURL(blobToDisplay);
    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [capture]);

  // 2. ResizeObserver to dynamically read panel / container width per CLAUDE.md layout rules 2 & 3
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate displayed dimensions to verify scaling math
  const previewDim = calculatePreviewDimensions(
    { width: capture.width, height: capture.height },
    containerWidth
  );

  const formattedCreatedTime = new Date(capture.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // 3. Toolbar buttons in EXACT order per CLAUDE.md Phase 3:
  // Crop, Blur, Draw, Text, Arrow, Undo, Redo, Reset, Save, Back.
  // In Phase 3, every button except Back is disabled with tooltip "Coming in Phase 4".
  const toolbarButtons: ToolbarButtonDef[] = [
    {
      id: 'crop',
      label: 'Crop',
      icon: <Crop className="w-3.5 h-3.5" />,
      disabled: true,
      tooltip: 'Coming in Phase 4',
    },
    {
      id: 'blur',
      label: 'Blur',
      icon: <Droplet className="w-3.5 h-3.5" />,
      disabled: true,
      tooltip: 'Coming in Phase 4',
    },
    {
      id: 'draw',
      label: 'Draw',
      icon: <PenTool className="w-3.5 h-3.5" />,
      disabled: true,
      tooltip: 'Coming in Phase 4',
    },
    {
      id: 'text',
      label: 'Text',
      icon: <Type className="w-3.5 h-3.5" />,
      disabled: true,
      tooltip: 'Coming in Phase 4',
    },
    {
      id: 'arrow',
      label: 'Arrow',
      icon: <ArrowRight className="w-3.5 h-3.5" />,
      disabled: true,
      tooltip: 'Coming in Phase 4',
    },
    {
      id: 'undo',
      label: 'Undo',
      icon: <Undo2 className="w-3.5 h-3.5" />,
      disabled: true,
      tooltip: 'Coming in Phase 4',
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: <Redo2 className="w-3.5 h-3.5" />,
      disabled: true,
      tooltip: 'Coming in Phase 4',
    },
    {
      id: 'reset',
      label: 'Reset',
      icon: <RotateCcw className="w-3.5 h-3.5" />,
      disabled: true,
      tooltip: 'Coming in Phase 4',
    },
    {
      id: 'save',
      label: 'Save',
      icon: <Save className="w-3.5 h-3.5" />,
      disabled: true,
      tooltip: 'Coming in Phase 4',
    },
    {
      id: 'back',
      label: 'Back',
      icon: <ArrowLeft className="w-3.5 h-3.5" />,
      disabled: false,
      tooltip: 'Back to gallery',
    },
  ];

  return (
    <div
      data-testid="preview-page"
      className="flex flex-col min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white"
    >
      {/* Top Metadata Header: Title, mode, size, and created time above the image */}
      <header className="px-3.5 py-3 bg-slate-900 border-b border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onBack}
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

          {/* Delete button on Preview page */}
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

        {/* Metadata Bar: Mode, Size, Created Time */}
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
      </header>

      {/* Preview Toolbar (Editing tools shown but disabled per Phase 3) */}
      <section
        aria-label="Preview Toolbar"
        className="px-2 py-1.5 bg-slate-900/90 border-b border-slate-800/80 overflow-x-auto no-scrollbar flex items-center gap-1"
      >
        {toolbarButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={btn.id === 'back' ? onBack : undefined}
            disabled={btn.disabled}
            title={btn.tooltip}
            aria-label={btn.label}
            data-testid={`preview-toolbar-${btn.id}`}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
              btn.disabled
                ? 'opacity-40 cursor-not-allowed bg-slate-900/40 text-slate-500 border border-transparent'
                : 'bg-brand-600 hover:bg-brand-500 text-white shadow-sm cursor-pointer border border-brand-500/40 active:scale-95'
            }`}
          >
            {btn.icon}
            <span className="text-[11px]">{btn.label}</span>
          </button>
        ))}
      </section>

      {/* ResizeObserver Info Bar */}
      <div className="px-3.5 py-1 bg-slate-950/80 border-b border-slate-900 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>
          Viewport: {previewDim.displayWidth} × {previewDim.displayHeight} px
        </span>
        <span>Scale: {(previewDim.scale * 100).toFixed(0)}%</span>
      </div>

      {/* Scaled Image in scrollable container: never clipped per CLAUDE.md layout rule 2 */}
      <main
        ref={containerRef}
        data-testid="preview-image-container"
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col items-center justify-start bg-slate-950"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={capture.pageTitle || 'Capture full preview'}
            data-testid="preview-image"
            className="max-w-full h-auto block mx-auto object-contain rounded-lg border border-slate-800/80 shadow-2xl transition-all"
            style={{
              maxHeight: 'none', // Image is allowed to expand down in scrollable area
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-xs">
            Loading preview image...
          </div>
        )}
      </main>
    </div>
  );
};
