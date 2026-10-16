import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { fabric } from 'fabric';
import { ScreenshotItem } from '@/shared/types';
import { EditorTool } from './EditorToolbar';
import { computeCanvasLayout } from '@/sidepanel/lib/exportMath';
import { EditorHistory } from '@/sidepanel/lib/editorHistory';
import { cropBlobToBlob, Rect } from '@/sidepanel/lib/cropMath';
import { dataUrlToBlob } from '@/background/capture';

export interface EditorCanvasHandle {
  undo: () => void;
  redo: () => void;
  reset: () => void;
  save: () => Promise<{ blob: Blob; editState: string }>;
  applyCrop: () => Promise<Blob | null>;
  cancelCrop: () => void;
  confirmText: () => void;
  getActiveCropRect: () => Rect | null;
}

export interface EditorCanvasProps {
  capture: ScreenshotItem;
  activeTool: EditorTool;
  strokeColor: string;
  strokeWidth: number;
  onHistoryChange: (canUndo: boolean, canRedo: boolean, hasUnsaved: boolean) => void;
  onCropSelectionChange: (hasSelection: boolean) => void;
  onTypingTextChange: (isTyping: boolean) => void;
}

export const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(
  (
    {
      capture,
      activeTool,
      strokeColor,
      strokeWidth,
      onHistoryChange,
      onCropSelectionChange,
      onTypingTextChange,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const historyRef = useRef<EditorHistory>(new EditorHistory(30));
    const isApplyingHistoryRef = useRef<boolean>(false);
    const [imageUrl, setImageUrl] = useState<string>('');

    // Crop selection state
    const cropRectShapeRef = useRef<fabric.Rect | null>(null);

    // Arrow drawing state
    const arrowDragRef = useRef<{
      isDrawing: boolean;
      startX: number;
      startY: number;
      line: fabric.Line | null;
      head: fabric.Triangle | null;
    }>({
      isDrawing: false,
      startX: 0,
      startY: 0,
      line: null,
      head: null,
    });

    // Blur dragging state
    const blurDragRef = useRef<{
      isDrawing: boolean;
      startX: number;
      startY: number;
      rect: fabric.Rect | null;
    }>({
      isDrawing: false,
      startX: 0,
      startY: 0,
      rect: null,
    });

    // 1. Manage image URL lifecycle
    useEffect(() => {
      const blob = capture.editedBlob || capture.originalBlob;
      const url = URL.createObjectURL(blob);
      setImageUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }, [capture]);

    // Push canvas state to history
    const recordHistory = () => {
      if (isApplyingHistoryRef.current || !fabricCanvasRef.current) return;
      const json = JSON.stringify(fabricCanvasRef.current.toJSON());
      historyRef.current.push(json);
      onHistoryChange(
        historyRef.current.canUndo,
        historyRef.current.canRedo,
        true
      );
    };

    // 2. Initialize Fabric.js Canvas
    useEffect(() => {
      if (!canvasElRef.current || !containerRef.current || !imageUrl) return;

      const containerWidth = containerRef.current.clientWidth || 360;
      const layout = computeCanvasLayout(
        { width: capture.width, height: capture.height },
        containerWidth
      );

      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: layout.displayWidth,
        height: layout.displayHeight,
        selection: true,
        preserveObjectStacking: true,
      });

      canvas.setZoom(layout.scale);
      fabricCanvasRef.current = canvas;

      // Load existing editState or set initial image background
      if (capture.editState) {
        try {
          isApplyingHistoryRef.current = true;
          canvas.loadFromJSON(capture.editState, () => {
            canvas.renderAll();
            isApplyingHistoryRef.current = false;
            historyRef.current.clear();
            historyRef.current.push(JSON.stringify(canvas.toJSON()));
            onHistoryChange(false, false, false);
          });
        } catch {
          loadBackground();
        }
      } else {
        loadBackground();
      }

      function loadBackground() {
        fabric.Image.fromURL(imageUrl, (bgImg) => {
          if (!fabricCanvasRef.current) return;
          bgImg.set({ selectable: false, evented: false });
          canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas));
          historyRef.current.clear();
          historyRef.current.push(JSON.stringify(canvas.toJSON()));
          onHistoryChange(false, false, false);
        });
      }

      // Event listeners for history recording
      canvas.on('object:added', (e) => {
        // Exclude temporary preview helpers
        if ((e.target as unknown as { isTempHelper?: boolean })?.isTempHelper) return;
        recordHistory();
      });
      canvas.on('object:modified', recordHistory);
      canvas.on('object:removed', (e) => {
        if ((e.target as unknown as { isTempHelper?: boolean })?.isTempHelper) return;
        recordHistory();
      });

      return () => {
        canvas.dispose();
        fabricCanvasRef.current = null;
        historyRef.current.clear();
      };
    }, [imageUrl]);

    // 3. ResizeObserver to keep canvas sized to panel width per CLAUDE.md
    useEffect(() => {
      if (!containerRef.current) return;

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newWidth = Math.round(entry.contentRect.width);
          if (newWidth > 0 && fabricCanvasRef.current) {
            const layout = computeCanvasLayout(
              { width: capture.width, height: capture.height },
              newWidth
            );
            fabricCanvasRef.current.setWidth(layout.displayWidth);
            fabricCanvasRef.current.setHeight(layout.displayHeight);
            fabricCanvasRef.current.setZoom(layout.scale);
            fabricCanvasRef.current.renderAll();
          }
        }
      });

      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [capture.width, capture.height]);

    // 4. Update Drawing Mode and Active Tool Bindings
    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const zoom = canvas.getZoom() || 1;

      // Clean up previous crop shape if changing away from crop
      if (activeTool !== 'crop' && cropRectShapeRef.current) {
        canvas.remove(cropRectShapeRef.current);
        cropRectShapeRef.current = null;
        onCropSelectionChange(false);
      }

      if (activeTool === 'draw') {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = strokeColor;
        canvas.freeDrawingBrush.width = strokeWidth / zoom;
      } else {
        canvas.isDrawingMode = false;
      }
    }, [activeTool, strokeColor, strokeWidth]);

    // 5. Tool Interactions: Arrow, Blur, Text, Crop
    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const handleMouseDown = (opt: fabric.IEvent) => {
        const pointer = canvas.getPointer(opt.e);

        // A. Arrow Tool
        if (activeTool === 'arrow') {
          canvas.selection = false;
          arrowDragRef.current.isDrawing = true;
          arrowDragRef.current.startX = pointer.x;
          arrowDragRef.current.startY = pointer.y;

          const line = new fabric.Line(
            [pointer.x, pointer.y, pointer.x, pointer.y],
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth / canvas.getZoom(),
              selectable: false,
              evented: false,
            }
          );
          (line as unknown as { isTempHelper: boolean }).isTempHelper = true;

          const head = new fabric.Triangle({
            left: pointer.x,
            top: pointer.y,
            originX: 'center',
            originY: 'center',
            width: (strokeWidth * 3) / canvas.getZoom(),
            height: (strokeWidth * 3) / canvas.getZoom(),
            fill: strokeColor,
            selectable: false,
            evented: false,
          });
          (head as unknown as { isTempHelper: boolean }).isTempHelper = true;

          arrowDragRef.current.line = line;
          arrowDragRef.current.head = head;
          canvas.add(line, head);
        }

        // B. Blur Tool (Pixelate for instant performance on large images)
        if (activeTool === 'blur') {
          canvas.selection = false;
          blurDragRef.current.isDrawing = true;
          blurDragRef.current.startX = pointer.x;
          blurDragRef.current.startY = pointer.y;

          const previewRect = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'rgba(56, 189, 248, 0.15)',
            stroke: '#0284c7',
            strokeWidth: 1 / canvas.getZoom(),
            strokeDashArray: [4, 4],
            selectable: false,
            evented: false,
          });
          (previewRect as unknown as { isTempHelper: boolean }).isTempHelper = true;
          blurDragRef.current.rect = previewRect;
          canvas.add(previewRect);
        }

        // C. Crop Tool
        if (activeTool === 'crop') {
          canvas.selection = false;
          if (cropRectShapeRef.current) {
            canvas.remove(cropRectShapeRef.current);
          }

          const cropRect = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'rgba(14, 165, 233, 0.2)',
            stroke: '#0284c7',
            strokeWidth: 2 / canvas.getZoom(),
            strokeDashArray: [5, 5],
            selectable: true,
            hasRotatingPoint: false,
          });
          (cropRect as unknown as { isTempHelper: boolean }).isTempHelper = true;
          cropRectShapeRef.current = cropRect;
          canvas.add(cropRect);
        }

        // D. Text Tool
        if (activeTool === 'text') {
          // If not clicking on an existing text object, create one
          if (!opt.target || !(opt.target instanceof fabric.IText)) {
            const textObj = new fabric.IText('Type text here', {
              left: pointer.x,
              top: pointer.y,
              fill: strokeColor,
              fontSize: 20 / canvas.getZoom(),
              fontFamily: 'sans-serif',
              selectable: true,
            });
            canvas.add(textObj);
            canvas.setActiveObject(textObj);
            textObj.enterEditing();
            textObj.selectAll();
            onTypingTextChange(true);
            recordHistory();
          }
        }
      };

      const handleMouseMove = (opt: fabric.IEvent) => {
        const pointer = canvas.getPointer(opt.e);
        const mouseEvent = opt.e as MouseEvent;

        // Arrow update
        if (activeTool === 'arrow' && arrowDragRef.current.isDrawing) {
          const { startX, startY, line, head } = arrowDragRef.current;
          if (line && head) {
            line.set({ x2: pointer.x, y2: pointer.y });
            const dx = pointer.x - startX;
            const dy = pointer.y - startY;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
            head.set({ left: pointer.x, top: pointer.y, angle });
            canvas.renderAll();
          }
        }

        // Blur rect update
        if (activeTool === 'blur' && blurDragRef.current.isDrawing) {
          const { startX, startY, rect } = blurDragRef.current;
          if (rect) {
            const left = Math.min(startX, pointer.x);
            const top = Math.min(startY, pointer.y);
            const width = Math.abs(pointer.x - startX);
            const height = Math.abs(pointer.y - startY);
            rect.set({ left, top, width, height });
            canvas.renderAll();
          }
        }

        // Crop rect update
        if (activeTool === 'crop' && cropRectShapeRef.current && mouseEvent.buttons === 1) {
          const crop = cropRectShapeRef.current;
          const startX = crop.left || 0;
          const startY = crop.top || 0;
          const left = Math.min(startX, pointer.x);
          const top = Math.min(startY, pointer.y);
          const width = Math.abs(pointer.x - startX);
          const height = Math.abs(pointer.y - startY);
          crop.set({ left, top, width, height });
          canvas.renderAll();
          const hasSelection = width > 10 && height > 10;
          onCropSelectionChange(hasSelection);
        }
      };

      const handleMouseUp = () => {
        // Arrow finalize
        if (activeTool === 'arrow' && arrowDragRef.current.isDrawing) {
          arrowDragRef.current.isDrawing = false;
          const { line, head } = arrowDragRef.current;
          if (line && head) {
            canvas.remove(line, head);
            // Create united group so it acts as a single shape
            const arrowGroup = new fabric.Group([line, head], {
              selectable: true,
            });
            canvas.add(arrowGroup);
            canvas.setActiveObject(arrowGroup);
            canvas.renderAll();
            recordHistory();
          }
        }

        // Blur finalize
        if (activeTool === 'blur' && blurDragRef.current.isDrawing) {
          blurDragRef.current.isDrawing = false;
          const tempRect = blurDragRef.current.rect;
          if (tempRect) {
            canvas.remove(tempRect);
            const left = tempRect.left || 0;
            const top = tempRect.top || 0;
            const width = tempRect.width || 0;
            const height = tempRect.height || 0;

            if (width >= 8 && height >= 8) {
              // Apply region pixelate filter for fast, robust blurring
              fabric.Image.fromURL(imageUrl, (regionImg) => {
                regionImg.set({
                  left,
                  top,
                  cropX: left,
                  cropY: top,
                  width,
                  height,
                  selectable: true,
                });
                // Pixelate filter is instantaneous on large images
                const pixelateFilter = new fabric.Image.filters.Pixelate({
                  blocksize: 8,
                });
                regionImg.filters = [pixelateFilter];
                regionImg.applyFilters();
                canvas.add(regionImg);
                canvas.setActiveObject(regionImg);
                canvas.renderAll();
                recordHistory();
              });
            }
          }
        }

        // Crop finalize
        if (activeTool === 'crop' && cropRectShapeRef.current) {
          const width = cropRectShapeRef.current.width || 0;
          const height = cropRectShapeRef.current.height || 0;
          const hasSelection = width > 10 && height > 10;
          onCropSelectionChange(hasSelection);
        }
      };

      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);

      return () => {
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
      };
    }, [activeTool, strokeColor, strokeWidth, imageUrl]);

    // Imperative methods exposed via ref
    useImperativeHandle(ref, () => ({
      undo: () => {
        const state = historyRef.current.undo();
        if (state && fabricCanvasRef.current) {
          isApplyingHistoryRef.current = true;
          fabricCanvasRef.current.loadFromJSON(state, () => {
            fabricCanvasRef.current?.renderAll();
            isApplyingHistoryRef.current = false;
            onHistoryChange(
              historyRef.current.canUndo,
              historyRef.current.canRedo,
              true
            );
          });
        }
      },
      redo: () => {
        const state = historyRef.current.redo();
        if (state && fabricCanvasRef.current) {
          isApplyingHistoryRef.current = true;
          fabricCanvasRef.current.loadFromJSON(state, () => {
            fabricCanvasRef.current?.renderAll();
            isApplyingHistoryRef.current = false;
            onHistoryChange(
              historyRef.current.canUndo,
              historyRef.current.canRedo,
              true
            );
          });
        }
      },
      reset: () => {
        if (!fabricCanvasRef.current || !imageUrl) return;
        fabricCanvasRef.current.clear();
        fabric.Image.fromURL(imageUrl, (bgImg) => {
          if (!fabricCanvasRef.current) return;
          bgImg.set({ selectable: false, evented: false });
          fabricCanvasRef.current.setBackgroundImage(
            bgImg,
            fabricCanvasRef.current.renderAll.bind(fabricCanvasRef.current)
          );
          recordHistory();
        });
      },
      save: async () => {
        if (!fabricCanvasRef.current) {
          throw new Error('Canvas not ready for export');
        }

        const canvas = fabricCanvasRef.current;
        const zoom = canvas.getZoom() || 1;
        const multiplier = 1 / zoom;

        // Export at full natural resolution
        const dataUrl = canvas.toDataURL({
          format: 'png',
          multiplier,
        });

        const blob = dataUrlToBlob(dataUrl);
        const editState = JSON.stringify(canvas.toJSON());
        onHistoryChange(historyRef.current.canUndo, historyRef.current.canRedo, false);

        return { blob, editState };
      },
      applyCrop: async () => {
        if (!cropRectShapeRef.current) return null;
        const shape = cropRectShapeRef.current;
        const naturalRect: Rect = {
          x: Math.round(shape.left || 0),
          y: Math.round(shape.top || 0),
          width: Math.round(shape.width || 0),
          height: Math.round(shape.height || 0),
        };

        const sourceBlob = capture.editedBlob || capture.originalBlob;
        const croppedBlob = await cropBlobToBlob(sourceBlob, naturalRect);

        // Clean up crop selection
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.remove(shape);
          cropRectShapeRef.current = null;
          onCropSelectionChange(false);
        }

        return croppedBlob;
      },
      cancelCrop: () => {
        if (cropRectShapeRef.current && fabricCanvasRef.current) {
          fabricCanvasRef.current.remove(cropRectShapeRef.current);
          cropRectShapeRef.current = null;
          onCropSelectionChange(false);
          fabricCanvasRef.current.renderAll();
        }
      },
      confirmText: () => {
        if (!fabricCanvasRef.current) return;
        const active = fabricCanvasRef.current.getActiveObject();
        if (active instanceof fabric.IText) {
          active.exitEditing();
          fabricCanvasRef.current.discardActiveObject();
          fabricCanvasRef.current.renderAll();
          onTypingTextChange(false);
          recordHistory();
        }
      },
      getActiveCropRect: () => {
        if (!cropRectShapeRef.current) return null;
        return {
          x: Math.round(cropRectShapeRef.current.left || 0),
          y: Math.round(cropRectShapeRef.current.top || 0),
          width: Math.round(cropRectShapeRef.current.width || 0),
          height: Math.round(cropRectShapeRef.current.height || 0),
        };
      },
    }));

    return (
      <div
        ref={containerRef}
        data-testid="editor-canvas-container"
        className="w-full flex items-center justify-center overflow-auto p-3 bg-slate-950"
      >
        <div className="relative border border-slate-800 rounded-lg shadow-2xl overflow-hidden bg-slate-900">
          <canvas ref={canvasElRef} data-testid="fabric-editor-canvas" />
        </div>
      </div>
    );
  }
);
