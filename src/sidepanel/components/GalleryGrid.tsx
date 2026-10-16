import React, { useEffect, useState } from 'react';
import { ScreenshotItem, CaptureMode } from '@/shared/types';
import { Trash2, Image as ImageIcon } from 'lucide-react';

export interface GalleryGridProps {
  captures: ScreenshotItem[];
  onSelectPreview: (capture: ScreenshotItem) => void;
  onDeleteClick: (capture: ScreenshotItem) => void;
}

interface GalleryCardProps {
  capture: ScreenshotItem;
  onPreview: () => void;
  onDelete: () => void;
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

const GalleryCard: React.FC<GalleryCardProps> = ({ capture, onPreview, onDelete }) => {
  const [thumbUrl, setThumbUrl] = useState<string>('');

  // Object URLs: create with URL.createObjectURL and call URL.revokeObjectURL when component unmounts
  useEffect(() => {
    const blobToDisplay = capture.editedBlob || capture.originalBlob;
    const url = URL.createObjectURL(blobToDisplay);
    setThumbUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [capture]);

  const formattedDate = new Date(capture.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      onClick={onPreview}
      data-testid={`gallery-card-${capture.id}`}
      className="group flex flex-col rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer select-none"
    >
      {/* 1. Thumbnail image container — Per CLAUDE.md: NOTHING overlaps the image */}
      <div className="relative w-full h-28 bg-slate-950 flex items-center justify-center overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={capture.pageTitle || 'Capture thumbnail'}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <ImageIcon className="w-6 h-6 text-slate-700" />
        )}
      </div>

      {/* 2. Label bar BELOW the image — Mode (VISIBLE, WINDOW, FULL, AREA), date, size, and delete */}
      <div className="p-2.5 flex flex-col gap-1.5 bg-slate-900 border-t border-slate-800/80">
        {/* Top row of label bar: Mode badge and delete button */}
        <div className="flex items-center justify-between gap-1">
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getModeBadgeClass(
              capture.mode
            )}`}
          >
            {capture.mode.toUpperCase()}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete capture"
            aria-label={`Delete capture ${capture.pageTitle || ''}`}
            data-testid={`delete-card-${capture.id}`}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Title */}
        <h4
          className="text-[11px] font-medium text-slate-200 truncate"
          title={capture.pageTitle}
        >
          {capture.pageTitle || 'Untitled Capture'}
        </h4>

        {/* Date and Size in pixels */}
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>{formattedDate}</span>
          <span className="font-mono">{capture.width} × {capture.height} px</span>
        </div>
      </div>
    </div>
  );
};

export const GalleryGrid: React.FC<GalleryGridProps> = ({
  captures,
  onSelectPreview,
  onDeleteClick,
}) => {
  if (captures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-500">
          <ImageIcon className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-slate-300">No captures in gallery</p>
        <p className="text-[11px] text-slate-500 max-w-[220px]">
          Take a screenshot, paste from clipboard, or drop an image to populate your local gallery.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Capture Gallery ({captures.length})
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">Dexie IndexedDB</span>
      </div>

      {/* Responsive thumbnail grid using CSS grid with minmax(140px, 1fr) */}
      <div
        data-testid="gallery-grid"
        className="grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        }}
      >
        {captures.map((capture) => (
          <GalleryCard
            key={capture.id}
            capture={capture}
            onPreview={() => onSelectPreview(capture)}
            onDelete={() => onDeleteClick(capture)}
          />
        ))}
      </div>
    </div>
  );
};
