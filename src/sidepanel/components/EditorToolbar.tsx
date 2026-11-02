import React from 'react';
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
  Check,
  X,
} from 'lucide-react';

export type EditorTool = 'crop' | 'blur' | 'draw' | 'text' | 'arrow' | null;

export interface EditorToolbarProps {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onSave: () => void;
  onBack: () => void;
  // Brush & shape settings
  strokeColor: string;
  onChangeColor: (color: string) => void;
  strokeWidth: number;
  onChangeStrokeWidth: (width: number) => void;
  // Crop specific
  hasActiveCropSelection: boolean;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
  // Text specific
  isTypingText: boolean;
  onConfirmText: () => void;
}

const COLOR_PRESETS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Black', hex: '#000000' },
];

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  isSaving,
  hasUnsavedChanges,
  onUndo,
  onRedo,
  onReset,
  onSave,
  onBack,
  strokeColor,
  onChangeColor,
  strokeWidth,
  onChangeStrokeWidth,
  hasActiveCropSelection,
  onApplyCrop,
  onCancelCrop,
  isTypingText,
  onConfirmText,
}) => {
  return (
    <div className="flex flex-col bg-slate-900 border-b border-slate-800">
      {/* 1. Main Toolbar - Buttons in EXACT order per CLAUDE.md Phase 4:
          Crop, Blur, Draw, Text, Arrow, Undo, Redo, Reset, Save, Back */}
      <section
        aria-label="Editor Toolbar"
        className="px-2 py-1.5 overflow-x-auto no-scrollbar flex items-center gap-1 bg-slate-900/90"
      >
        {/* 1. Crop */}
        <button
          onClick={() => onSelectTool(activeTool === 'crop' ? null : 'crop')}
          aria-label="Crop"
          data-testid="preview-toolbar-crop"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
            activeTool === 'crop'
              ? 'bg-brand-600 text-white shadow-sm ring-1 ring-brand-400'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
          }`}
          title="Crop image (saves as new screenshot with parentId)"
        >
          <Crop className="w-3.5 h-3.5" />
          <span className="text-[11px]">Crop</span>
        </button>

        {/* 2. Blur */}
        <button
          onClick={() => onSelectTool(activeTool === 'blur' ? null : 'blur')}
          aria-label="Blur"
          data-testid="preview-toolbar-blur"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
            activeTool === 'blur'
              ? 'bg-brand-600 text-white shadow-sm ring-1 ring-brand-400'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
          }`}
          title="Drag rectangle to blur sensitive area"
        >
          <Droplet className="w-3.5 h-3.5" />
          <span className="text-[11px]">Blur</span>
        </button>

        {/* 3. Draw */}
        <button
          onClick={() => onSelectTool(activeTool === 'draw' ? null : 'draw')}
          aria-label="Draw"
          data-testid="preview-toolbar-draw"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
            activeTool === 'draw'
              ? 'bg-brand-600 text-white shadow-sm ring-1 ring-brand-400'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
          }`}
          title="Freehand brush drawing"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span className="text-[11px]">Draw</span>
        </button>

        {/* 4. Text */}
        <button
          onClick={() => onSelectTool(activeTool === 'text' ? null : 'text')}
          aria-label="Text"
          data-testid="preview-toolbar-text"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
            activeTool === 'text'
              ? 'bg-brand-600 text-white shadow-sm ring-1 ring-brand-400'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
          }`}
          title="Click canvas to add text box"
        >
          <Type className="w-3.5 h-3.5" />
          <span className="text-[11px]">Text</span>
        </button>

        {/* 5. Arrow */}
        <button
          onClick={() => onSelectTool(activeTool === 'arrow' ? null : 'arrow')}
          aria-label="Arrow"
          data-testid="preview-toolbar-arrow"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
            activeTool === 'arrow'
              ? 'bg-brand-600 text-white shadow-sm ring-1 ring-brand-400'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white'
          }`}
          title="Drag on canvas to draw arrow"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span className="text-[11px]">Arrow</span>
        </button>

        <div className="w-px h-5 bg-slate-800 mx-0.5 shrink-0" />

        {/* 6. Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          data-testid="preview-toolbar-undo"
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
            canUndo
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white cursor-pointer'
              : 'opacity-40 cursor-not-allowed bg-slate-900/40 text-slate-500'
          }`}
          title="Undo last action (max 30 steps)"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span className="text-[11px]">Undo</span>
        </button>

        {/* 7. Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          data-testid="preview-toolbar-redo"
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
            canRedo
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white cursor-pointer'
              : 'opacity-40 cursor-not-allowed bg-slate-900/40 text-slate-500'
          }`}
          title="Redo action"
        >
          <Redo2 className="w-3.5 h-3.5" />
          <span className="text-[11px]">Redo</span>
        </button>

        {/* 8. Reset */}
        <button
          onClick={onReset}
          aria-label="Reset"
          data-testid="preview-toolbar-reset"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all shrink-0"
          title="Restore original image on canvas (does not delete saved edits)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="text-[11px]">Reset</span>
        </button>

        <div className="w-px h-5 bg-slate-800 mx-0.5 shrink-0" />

        {/* 9. Save */}
        <button
          onClick={onSave}
          disabled={isSaving}
          aria-label="Save"
          data-testid="preview-toolbar-save"
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all shrink-0 ${
            hasUnsavedChanges
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
          }`}
          title="Save edits to Dexie (exports full resolution PNG)"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="text-[11px]">{isSaving ? 'Saving...' : 'Save'}</span>
        </button>

        {/* 10. Back */}
        <button
          onClick={onBack}
          aria-label="Back"
          data-testid="preview-toolbar-back"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all shrink-0 ml-auto"
          title="Back to gallery (prompts if unsaved changes exist)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="text-[11px]">Back</span>
        </button>
      </section>

      {/* 2. Secondary Sub-Bar for Active Tool Options */}
      {(activeTool === 'draw' || activeTool === 'arrow' || activeTool === 'text') && (
        <div className="px-3 py-2 bg-slate-950/70 border-t border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          {/* Color presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Color:</span>
            <div className="flex items-center gap-1">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color.hex}
                  onClick={() => onChangeColor(color.hex)}
                  title={color.name}
                  className={`w-4 h-4 rounded-full border transition-transform ${
                    strokeColor === color.hex
                      ? 'scale-125 border-white ring-1 ring-white'
                      : 'border-slate-700 hover:scale-110'
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => onChangeColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                title="Custom color"
              />
            </div>
          </div>

          {/* Size slider */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Size:</span>
            <input
              type="range"
              min={1}
              max={30}
              value={strokeWidth}
              onChange={(e) => onChangeStrokeWidth(Number(e.target.value))}
              className="w-20 accent-brand-500 cursor-pointer"
            />
            <span className="font-mono text-[10px] text-slate-400 w-4">
              {strokeWidth}px
            </span>
          </div>

          {/* Text confirm helper */}
          {activeTool === 'text' && isTypingText && (
            <button
              onClick={onConfirmText}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-medium"
            >
              <Check className="w-3 h-3" />
              Confirm Text
            </button>
          )}
        </div>
      )}

      {/* Crop Confirmation Sub-Bar */}
      {activeTool === 'crop' && (
        <div className="px-3 py-2 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-300">
            {hasActiveCropSelection
              ? 'Selection ready. Save as new capture?'
              : 'Drag a rectangle on the image to select crop area.'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCancelCrop}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            <button
              onClick={onApplyCrop}
              disabled={!hasActiveCropSelection}
              data-testid="apply-crop-button"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-white text-[11px] font-bold ${
                hasActiveCropSelection
                  ? 'bg-brand-600 hover:bg-brand-500 cursor-pointer'
                  : 'bg-slate-800 opacity-50 cursor-not-allowed text-slate-500'
              }`}
            >
              <Check className="w-3 h-3" />
              Save Crop (New Record)
            </button>
          </div>
        </div>
      )}

      {/* Blur Tool Sub-Bar */}
      {activeTool === 'blur' && (
        <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-400">
          Drag a rectangle over the image to blur sensitive information.
        </div>
      )}
    </div>
  );
};
