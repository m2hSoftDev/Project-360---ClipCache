import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

export interface DiscardModalProps {
  isOpen: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

export const DiscardModal: React.FC<DiscardModalProps> = ({
  isOpen,
  onDiscard,
  onKeepEditing,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onKeepEditing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onKeepEditing]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-dialog-title"
      aria-describedby="discard-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onKeepEditing();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-5 flex flex-col gap-4 text-slate-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="discard-dialog-title" className="text-sm font-bold text-white">
                Discard changes?
              </h3>
              <p className="text-[11px] text-slate-400">
                You have unsaved edits on this capture.
              </p>
            </div>
          </div>
          <button
            onClick={onKeepEditing}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p id="discard-dialog-desc" className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          Leaving now will lose any drawings, shapes, or edits you made since your last save.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            onClick={onKeepEditing}
            data-testid="discard-keep-editing-button"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Keep Editing
          </button>
          <button
            onClick={onDiscard}
            data-testid="discard-confirm-button"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 active:scale-[0.98] transition-all"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
};
