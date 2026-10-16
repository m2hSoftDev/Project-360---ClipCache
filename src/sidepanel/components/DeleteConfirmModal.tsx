import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { ScreenshotItem } from '@/shared/types';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  capture: ScreenshotItem | null;
  linkedCount: number;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  capture,
  linkedCount,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen || !capture) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-5 flex flex-col gap-4 text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-dialog-title" className="text-sm font-bold text-white">
                Delete Screenshot?
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                {capture.pageTitle || 'Untitled Capture'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Explanation per CLAUDE.md Phase 3 */}
        <div id="delete-dialog-desc" className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <p>
            Are you sure you want to delete this capture?
          </p>
          <p className="mt-2 text-rose-300/90 font-medium">
            Deleting this record removes both originalBlob and any edit or crop children linked by parentId.
          </p>
          {linkedCount > 0 && (
            <p className="mt-2 text-amber-400 font-semibold text-[11px] bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              ⚠️ Note: This capture has {linkedCount} linked {linkedCount === 1 ? 'crop/edit' : 'crops/edits'} that will also be permanently deleted.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void onConfirm()}
            disabled={isDeleting}
            data-testid="confirm-delete-button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};
