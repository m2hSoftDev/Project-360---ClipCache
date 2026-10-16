import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scissors,
  RotateCcw,
  X,
  Sparkles,
} from 'lucide-react';
import {
  Point,
  Rect,
  Dimensions,
  normalizeRect,
  clampRect,
  scaleRectToNatural,
  isValidCrop,
  getAspectRatioLabel,
  cropBlobToBlob,
} from '@/sidepanel/lib/cropMath';

interface AreaCropOverlayProps {
  imageBlob: Blob;
  initialPageTitle: string;
  sourceUrl: string;
  onSaveCropped: (croppedBlob: Blob, cropWidth: number, cropHeight: number) => Promise<void>;
  onCancelOrClose: () => void;
}

export const AreaCropOverlay: React.FC<AreaCropOverlayProps> = ({
  imageBlob,
  initialPageTitle,
  onSaveCropped,
  onCancelOrClose,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState<Dimensions>({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState<Dimensions>({ width: 0, height: 0 });

  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Drag a rectangle across the image to crop');

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Initialize image blob URL
  useEffect(() => {
    const url = URL.createObjectURL(imageBlob);
    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageBlob]);

  // Update display dimensions when image loads or resizes
  const updateDisplaySize = useCallback(() => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setDisplaySize({ width: rect.width, height: rect.height });
      setNaturalSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    }
  }, []);

  const handleImageLoad = () => {
    updateDisplaySize();
  };

  useEffect(() => {
    window.addEventListener('resize', updateDisplaySize);
    return () => window.removeEventListener('resize', updateDisplaySize);
  }, [updateDisplaySize]);

  // Mouse & Touch coordinate helper
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return null;
    }

    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));

    return { x, y };
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCoordinates(e);
    if (!pt || !imgRef.current) return;

    // Prevent default touch scrolling while cropping
    if ('touches' in e) {
      e.stopPropagation();
    }

    setStartPoint(pt);
    setIsDragging(true);
    setCropRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
    setStatusMessage('Dragging selection...');
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !startPoint || !imgRef.current) return;

    const pt = getCoordinates(e);
    if (!pt) return;

    const raw = normalizeRect(startPoint, pt);
    const clamped = clampRect(raw, displaySize);
    setCropRect(clamped);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    setStartPoint(null);

    if (cropRect && isValidCrop(cropRect, 12)) {
      setStatusMessage('Crop ready! Click "Save Cropped Area" or drag again to re-select.');
    } else {
      setCropRect(null);
      setStatusMessage('Drag a rectangle across the image to crop');
    }
  };

  // Compute natural crop coordinates
  const naturalCropRect =
    cropRect && displaySize.width > 0 && displaySize.height > 0
      ? scaleRectToNatural(cropRect, displaySize, naturalSize)
      : null;

  const handleSave = async () => {
    if (!naturalCropRect || !isValidCrop(naturalCropRect, 5)) {
      return;
    }

    setIsSaving(true);
    setStatusMessage('Saving cropped screenshot...');

    try {
      const croppedBlob = await cropBlobToBlob(imageBlob, naturalCropRect, 'image/png');
      await onSaveCropped(croppedBlob, naturalCropRect.width, naturalCropRect.height);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Crop processing failed.';
      setStatusMessage(`Error: ${msg}`);
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setCropRect(null);
    setStatusMessage('Drag a rectangle across the image to crop');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20 shrink-0">
            <Scissors className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white truncate">Area Crop</h3>
            <p className="text-[10px] text-slate-400 truncate">
              Original: {naturalSize.width} × {naturalSize.height} px
            </p>
          </div>
        </div>

        <button
          onClick={onCancelOrClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Done / Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
        <span className="text-slate-300 font-medium truncate flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-brand-400 shrink-0" />
          {statusMessage}
        </span>

        {naturalCropRect && (
          <span className="font-mono text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20 shrink-0">
            {naturalCropRect.width} × {naturalCropRect.height} px (
            {getAspectRatioLabel(naturalCropRect.width, naturalCropRect.height)})
          </span>
        )}
      </div>

      {/* Image Crop Viewport */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-slate-950 flex items-center justify-center p-3 overflow-hidden select-none touch-none"
      >
        <div className="relative inline-block max-w-full max-h-full shadow-lg rounded-md overflow-hidden bg-slate-900">
          {imageUrl && (
            <img
              ref={imgRef}
              src={imageUrl}
              alt={initialPageTitle}
              onLoad={handleImageLoad}
              className="max-h-[50vh] max-w-full block object-contain pointer-events-none"
            />
          )}

          {/* Interactive Drag Surface */}
          <div
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            className="absolute inset-0 cursor-crosshair z-10"
          >
            {/* Darkened mask around the selection */}
            {cropRect && cropRect.width > 0 && cropRect.height > 0 && (
              <>
                {/* Top mask */}
                <div
                  className="absolute bg-slate-950/70 pointer-events-none transition-none"
                  style={{ top: 0, left: 0, width: '100%', height: cropRect.y }}
                />
                {/* Bottom mask */}
                <div
                  className="absolute bg-slate-950/70 pointer-events-none transition-none"
                  style={{
                    top: cropRect.y + cropRect.height,
                    left: 0,
                    width: '100%',
                    bottom: 0,
                  }}
                />
                {/* Left mask */}
                <div
                  className="absolute bg-slate-950/70 pointer-events-none transition-none"
                  style={{
                    top: cropRect.y,
                    left: 0,
                    width: cropRect.x,
                    height: cropRect.height,
                  }}
                />
                {/* Right mask */}
                <div
                  className="absolute bg-slate-950/70 pointer-events-none transition-none"
                  style={{
                    top: cropRect.y,
                    left: cropRect.x + cropRect.width,
                    right: 0,
                    height: cropRect.height,
                  }}
                />

                {/* The Crop Box */}
                <div
                  className="absolute border-2 border-brand-400 shadow-[0_0_0_1px_rgba(0,0,0,0.6)] pointer-events-none"
                  style={{
                    top: cropRect.y,
                    left: cropRect.x,
                    width: cropRect.width,
                    height: cropRect.height,
                  }}
                >
                  {/* Rule-of-thirds grid */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                    <div className="border-r border-b border-brand-300 border-dashed" />
                    <div className="border-r border-b border-brand-300 border-dashed" />
                    <div className="border-b border-brand-300 border-dashed" />
                    <div className="border-r border-b border-brand-300 border-dashed" />
                    <div className="border-r border-b border-brand-300 border-dashed" />
                    <div className="border-b border-brand-300 border-dashed" />
                    <div className="border-r border-brand-300 border-dashed" />
                    <div className="border-r border-brand-300 border-dashed" />
                    <div />
                  </div>

                  {/* Corner Handles */}
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-brand-500 rounded-sm shadow" />
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-brand-500 rounded-sm shadow" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-brand-500 rounded-sm shadow" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-brand-500 rounded-sm shadow" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-between p-3 bg-slate-900 border-t border-slate-800 gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReset}
            disabled={!cropRect || isSaving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          <button
            onClick={onCancelOrClose}
            disabled={isSaving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Keep Full Image
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={!cropRect || !isValidCrop(cropRect, 10) || isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-brand-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95"
        >
          <Scissors className="w-3.5 h-3.5" />
          {isSaving ? 'Cropping...' : 'Save Cropped Area'}
        </button>
      </div>
    </div>
  );
};
