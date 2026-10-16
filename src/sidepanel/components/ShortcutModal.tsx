import React, { useState, useEffect } from 'react';
import { Keyboard, X, RotateCcw, Check, Command } from 'lucide-react';
import { DEFAULT_SHORTCUTS, saveShortcut } from '@/sidepanel/lib/db';

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentShortcut: string;
  onShortcutSaved: (newShortcut: string) => void;
}

export const ShortcutModal: React.FC<ShortcutModalProps> = ({
  isOpen,
  onClose,
  currentShortcut,
  onShortcutSaved,
}) => {
  const [shortcut, setShortcut] = useState<string>(currentShortcut);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [tempCombo, setTempCombo] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setShortcut(currentShortcut);
  }, [currentShortcut]);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore lone modifier keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        const parts: string[] = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Command');
        setTempCombo(parts.join('+') + '+...');
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Command');

      let mainKey = e.key.toUpperCase();
      if (e.code.startsWith('Key')) {
        mainKey = e.code.replace('Key', '');
      } else if (e.code.startsWith('Digit')) {
        mainKey = e.code.replace('Digit', '');
      }

      parts.push(mainKey);
      const combo = parts.join('+');

      setShortcut(combo);
      setTempCombo('');
      setIsRecording(false);
      setFeedback('New shortcut recorded! Click "Save Shortcut" below.');
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isRecording]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      await saveShortcut('screenCapture', shortcut);
      onShortcutSaved(shortcut);
      setFeedback('Shortcut saved to Dexie settings successfully!');
      setTimeout(() => {
        onClose();
        setFeedback(null);
      }, 700);
    } catch {
      setFeedback('Failed to save shortcut to settings.');
    }
  };

  const handleReset = async () => {
    const def = DEFAULT_SHORTCUTS.screenCapture;
    setShortcut(def);
    try {
      await saveShortcut('screenCapture', def);
      onShortcutSaved(def);
      setFeedback('Reset to default shortcut (Alt+C).');
    } catch {
      setFeedback('Failed to reset shortcut.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Capture Shortcut</h2>
              <p className="text-[11px] text-slate-400">Custom keyboard trigger</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsRecording(false);
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            Press your preferred key combination to trigger instant screen/window capture when ClipCache is focused.
          </p>

          <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-slate-950 border border-slate-800/80 gap-3">
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {isRecording ? (
                <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-300 border border-brand-500/40 animate-pulse">
                  {tempCombo || 'Press keys now (e.g. Ctrl+Shift+S)...'}
                </span>
              ) : (
                shortcut.split('+').map((key, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-slate-100 shadow-sm"
                  >
                    {key === 'Command' && <Command className="w-3 h-3" />}
                    {key}
                  </span>
                ))
              )}
            </div>

            <button
              onClick={() => {
                setIsRecording(true);
                setTempCombo('');
                setFeedback('Press your desired combination...');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isRecording ? 'Listening for keys...' : 'Record New Shortcut'}
            </button>
          </div>

          {feedback && (
            <p className="text-[11px] text-center text-brand-400 font-medium">
              {feedback}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Default
          </button>

          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium shadow-md shadow-brand-500/20 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            Save Shortcut
          </button>
        </div>
      </div>
    </div>
  );
};
