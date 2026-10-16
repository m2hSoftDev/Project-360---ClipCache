import React, { useEffect, useState, useRef } from 'react';
import { ScreenshotItem } from '@/shared/types';
import { X, Scissors, Trash2, Eye } from 'lucide-react';
import { calculatePreviewDimensions } from '@/sidepanel/lib/previewMath';

interface ImagePreviewModalProps {
  capture: ScreenshotItem | null;
  onClose: () => void;
  onCrop: (capture: ScreenshotItem) => void;
  onDelete: (id: number) => Promise<void>;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  capture,
  onClose,
  onCrop,
  onDelete,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [observedDimensions, setObservedDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Manage object URL lifecycle per CLAUDE.md rule 6
  useEffect(() => {
    if (!capture) {
      setImageUrl('');
      return;
    }

    const blob = capture.editedBlob || capture.originalBlob;
    const url = URL.createObjectURL(blob);
    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [capture]);

  // Use ResizeObserver to read displayed image/container size per CLAUDE.md layout rule 3
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setObservedDimensions({
          width: Math.round(width),
          height: Math.round(height),
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [capture]);

  if (!capture) return null;

  // Compute calculated preview dimensions based on observed container width
  const calculated = calculatePreviewDimensions(
    { width: capture.width, height: capture.height },
    observedDimensions.width || 360
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Top Header */}
      <header className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20 shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 id="preview-title" className="text-xs font-bold text-white truncate">
              {capture.pageTitle || 'Screenshot Preview'}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-brand-400">
                {capture.mode}
              </span>
              <span>•</span>
              <span>
                Natural: {capture.width}×{capture.height} px
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close preview"
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* ResizeObserver Info Bar */}
      <div className="px-3.5 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate">
          Displayed: {calculated.displayWidth}×{calculated.displayHeight} px
        </span>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
          Scale: {(calculated.scale * 100).toFixed(0)}%
        </span>
      </div>

      {/* Centered Scrollable Image Container per CLAUDE.md layout rule 2 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-3 flex items-center justify-center bg-slate-950"
      >
        {imageUrl && (
          <img
            ref={imgRef}
            src={imageUrl}
            alt={capture.pageTitle || 'Screenshot full preview'}
            className="max-w-full h-auto object-contain mx-auto block rounded-lg border border-slate-800 shadow-2xl"
          />
        )}
      </div>

      {/* Bottom Action Bar */}
      <footer className="flex items-center justify-between p-3 bg-slate-900 border-t border-slate-800">
        <button
          onClick={async () => {
            if (capture.id) {
              await onDelete(capture.id);
              onClose();
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-white hover:bg-rose-950/80 border border-rose-900/40 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onCrop(capture);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
          >
            <Scissors className="w-3.5 h-3.5" />
            Crop Area
          </button>
        </div>
      </footer>
    </div>
  );
};
