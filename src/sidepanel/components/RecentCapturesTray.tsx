import React, { useEffect, useState } from 'react';
import { ScreenshotItem } from '@/shared/types';
import { Scissors, Trash2, Image as ImageIcon } from 'lucide-react';

interface RecentCapturesTrayProps {
  captures: ScreenshotItem[];
  onSelectForCrop: (capture: ScreenshotItem) => void;
  onSelectPreview: (capture: ScreenshotItem) => void;
  onDeleteCapture: (id: number) => Promise<void>;
}

interface ThumbnailCardProps {
  capture: ScreenshotItem;
  onCrop: () => void;
  onPreview: () => void;
  onDelete: () => void;
}

const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  capture,
  onCrop,
  onPreview,
  onDelete,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string>('');

  useEffect(() => {
    const blobToDisplay = capture.editedBlob || capture.originalBlob;
    const url = URL.createObjectURL(blobToDisplay);
    setThumbUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [capture]);

  const formatTimestamp = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getModeBadge = (mode: string) => {
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

  return (
    <div
      onClick={onPreview}
      className="group flex flex-col rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 overflow-hidden shadow-md cursor-pointer transition-all hover:shadow-brand-500/10"
    >
      {/* Pure Thumbnail Container — per Item 1, NOTHING may overlap the image */}
      <div className="relative h-24 bg-slate-950 flex items-center justify-center overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={capture.pageTitle || 'Capture thumbnail'}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <ImageIcon className="w-6 h-6 text-slate-600" />
        )}
      </div>

      {/* Bar BELOW each thumbnail containing the Mode label and actions per Item 1 */}
      <div className="p-2 flex flex-col gap-1.5 bg-slate-900 border-t border-slate-800/80">
        {/* Mode label & actions bar */}
        <div className="flex items-center justify-between gap-1">
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getModeBadge(
              capture.mode
            )}`}
          >
            {capture.mode}
          </span>

          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onCrop}
              title="Crop screenshot"
              className="p-1 rounded text-slate-400 hover:text-brand-300 hover:bg-slate-800 transition-colors"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              title="Delete screenshot"
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title & dimensions */}
        <h4
          className="text-[11px] font-semibold text-slate-200 truncate"
          title={capture.pageTitle}
        >
          {capture.pageTitle || 'Untitled Capture'}
        </h4>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>
            {capture.width}×{capture.height}
          </span>
          <span>{formatTimestamp(capture.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};

export const RecentCapturesTray: React.FC<RecentCapturesTrayProps> = ({
  captures,
  onSelectForCrop,
  onSelectPreview,
  onDeleteCapture,
}) => {
  if (captures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-500">
          <ImageIcon className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-slate-300">No captures yet</p>
        <p className="text-[11px] text-slate-500 max-w-[200px]">
          Captured screens, pasted images, and cropped areas will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Recent Captures ({captures.length})
        </h3>
        <span className="text-[10px] text-slate-500">Saved in Dexie</span>
      </div>

      {/* Grid: uses CSS grid with minmax(140px, 1fr) per Item 2 so all cards fit in a 360 px panel */}
      <div
        className="grid gap-2.5"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        }}
      >
        {captures.slice(0, 8).map((cap) => (
          <ThumbnailCard
            key={cap.id}
            capture={cap}
            onPreview={() => onSelectPreview(cap)}
            onCrop={() => onSelectForCrop(cap)}
            onDelete={() => {
              if (cap.id) onDeleteCapture(cap.id);
            }}
          />
        ))}
      </div>
    </div>
  );
};
