import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, SlidersHorizontal, Info, Columns } from 'lucide-react';

export interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalBlob: Blob;
  editedBlob?: Blob | null;
  pageTitle?: string;
  width: number;
  height: number;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  originalBlob,
  editedBlob,
  pageTitle,
  width,
  height,
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [editedUrl, setEditedUrl] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Allocate and revoke object URLs for both blobs cleanly
  useEffect(() => {
    if (!isOpen) return;

    const origUrl = URL.createObjectURL(originalBlob);
    setOriginalUrl(origUrl);

    let editUrl = '';
    if (editedBlob) {
      editUrl = URL.createObjectURL(editedBlob);
      setEditedUrl(editUrl);
    } else {
      setEditedUrl('');
    }

    return () => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(origUrl);
        if (editUrl) URL.revokeObjectURL(editUrl);
      }
    };
  }, [isOpen, originalBlob, editedBlob]);

  // Compute slider percentage from pointer coordinates
  const updateSliderFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const rawX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (rawX / rect.width) * 100));
    setSliderPosition(Math.round(percentage));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateSliderFromClientX(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture might have ended
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare View"
      data-testid="compare-modal"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 animate-fadeIn"
    >
      {/* Header */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-brand-500/20 text-brand-400">
            <Columns className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-white truncate">
              Compare Before & After
            </h2>
            <p className="text-[10px] text-slate-400 truncate">
              {pageTitle || 'Capture'} • {width} × {height} px
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          data-testid="compare-close-button"
          aria-label="Close compare view"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start p-3 bg-slate-950">
        {!editedBlob ? (
          /* Empty state message per CLAUDE.md Phase 5 */
          <div
            data-testid="compare-no-edits-message"
            className="my-auto max-w-xs text-center p-6 rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Info className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              No edits yet. Edit and save first.
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Use the editing tools (draw, arrow, text, blur) and save your capture to view the before and after comparison.
            </p>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors"
            >
              Back to Editor
            </button>
          </div>
        ) : (
          /* Draggable Before / After Slider */
          <div className="w-full flex flex-col items-center gap-2">
            {/* Instruction & Slider Percentage */}
            <div className="w-full flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Drag slider or click image to compare</span>
              <span className="font-mono text-brand-400 font-semibold">
                {sliderPosition}% Original
              </span>
            </div>

            {/* Slider Container - Scales to panel width and never clips the image */}
            <div
              ref={containerRef}
              data-testid="compare-slider-container"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative w-full max-w-full select-none cursor-ew-resize overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-2xl"
              style={{ touchAction: 'none' }}
            >
              {/* Accessible range input */}
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={(e) => setSliderPosition(Number(e.target.value))}
                aria-label="Before after comparison slider"
                className="sr-only"
              />

              {/* Bottom Image: Edited (After) */}
              <img
                src={editedUrl}
                alt="Edited (After)"
                data-testid="compare-after-image"
                className="block w-full h-auto max-w-full pointer-events-none select-none"
              />

              {/* Top Image: Original (Before) clipped via slider position */}
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden select-none"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                <img
                  src={originalUrl}
                  alt="Original (Before)"
                  data-testid="compare-before-image"
                  className="block w-full h-auto max-w-full pointer-events-none select-none"
                />
              </div>

              {/* Draggable Divider Line and Knob */}
              <div
                data-testid="compare-divider-handle"
                className="absolute top-0 bottom-0 pointer-events-none flex items-center justify-center"
                style={{
                  left: `${sliderPosition}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {/* Vertical Line */}
                <div className="w-0.5 h-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)]" />

                {/* Handle Knob */}
                <div className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-brand-600 text-white shadow-xl border-2 border-white flex items-center justify-center">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-2 left-2 pointer-events-none px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white tracking-wider uppercase border border-white/10">
                Original
              </div>
              <div className="absolute top-2 right-2 pointer-events-none px-2 py-0.5 rounded bg-brand-900/80 backdrop-blur-sm text-[10px] font-bold text-brand-200 tracking-wider uppercase border border-brand-500/20">
                Edited
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
