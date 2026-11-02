import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { fabric } from 'fabric';
import { ScreenshotItem } from '@/shared/types';
import { EditorTool } from './EditorToolbar';
import { computeCanvasLayout, exportCompositeImage } from '@/sidepanel/lib/exportMath';
import { EditorHistory } from '@/sidepanel/lib/editorHistory';
import { cropBlobToBlob, Rect } from '@/sidepanel/lib/cropMath';
import { createArrowObjects, computeArrowAngle } from '@/sidepanel/lib/arrowMath';
import { createBlurredRegionDataUrl, createBlurFabricObject } from '@/sidepanel/lib/blurMath';

export interface EditorCanvasHandle {
  undo: () => void;
  redo: () => void;
  reset: () => void;
  save: () => Promise<{ blob: Blob; editState: string | null }>;
  applyCrop: () => Promise<Blob | null>;
  cancelCrop: () => void;
  confirmText: () => void;
  getActiveCropRect: () => Rect | null;
  deleteSelected: () => void;
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

    const sourceImageRef = useRef<HTMLImageElement | null>(null);

    // 1. Manage image URL lifecycle: derived from editedBlob (if finalized) or originalBlob
    useEffect(() => {
      const sourceBlob = capture.editedBlob || capture.originalBlob;
      const url = URL.createObjectURL(sourceBlob);
      setImageUrl(url);

      const img = new Image();
      img.onload = () => {
        sourceImageRef.current = img;
      };
      img.src = url;

      return () => {
        URL.revokeObjectURL(url);
      };
    }, [capture.id, capture.editedBlob, capture.originalBlob]);

    const serializeCanvasState = (canvas: fabric.Canvas): string => {
      const json = canvas.toJSON() as Record<string, unknown>;
      delete json.backgroundImage;
      delete json.background;
      return JSON.stringify(json);
    };

    // Push canvas state to history without dead blob URLs
    const recordHistory = () => {
      if (isApplyingHistoryRef.current || !fabricCanvasRef.current) return;
      historyRef.current.push(serializeCanvasState(fabricCanvasRef.current));
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

      const applyBackgroundImage = (callback?: () => void) => {
        fabric.Image.fromURL(imageUrl, (bgImg) => {
          if (!fabricCanvasRef.current || !bgImg) {
            if (callback) callback();
            return;
          }
          bgImg.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
          });
          canvas.setBackgroundImage(bgImg, () => {
            canvas.renderAll();
            if (callback) callback();
          });
        });
      };

      // Load existing editState and always ensure the original screenshot is loaded as background
      if (capture.editState) {
        let parsed: any = null;
        try {
          parsed =
            typeof capture.editState === 'string'
              ? JSON.parse(capture.editState)
              : capture.editState;
          if (parsed && typeof parsed === 'object') {
            delete parsed.backgroundImage;
            delete parsed.background;
          }
        } catch {
          parsed = null;
        }

        if (parsed) {
          isApplyingHistoryRef.current = true;
          canvas.loadFromJSON(parsed, () => {
            applyBackgroundImage(() => {
              isApplyingHistoryRef.current = false;
              canvas.renderAll();
              historyRef.current.clear();
              historyRef.current.push(serializeCanvasState(canvas));
              onHistoryChange(false, false, false);
            });
          });
        } else {
          applyBackgroundImage(() => {
            historyRef.current.clear();
            historyRef.current.push(serializeCanvasState(canvas));
            onHistoryChange(false, false, false);
          });
        }
      } else {
        applyBackgroundImage(() => {
          historyRef.current.clear();
          historyRef.current.push(serializeCanvasState(canvas));
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

        // A. Arrow Tool (Bug 2: Head placed at pointer end with originX center, originY top)
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
              strokeLineCap: 'round',
            }
          );
          (line as unknown as { isTempHelper: boolean }).isTempHelper = true;

          const headSize = Math.max((strokeWidth * 3) / canvas.getZoom(), 12 / canvas.getZoom());
          const head = new fabric.Triangle({
            left: pointer.x,
            top: pointer.y,
            originX: 'center',
            originY: 'top',
            width: headSize,
            height: headSize,
            fill: strokeColor,
            angle: 0,
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
            const dx = pointer.x - startX;
            const dy = pointer.y - startY;
            const dist = Math.hypot(dx, dy) || 1;
            const ux = dx / dist;
            const uy = dy / dist;
            const zoom = canvas.getZoom() || 1;
            const headSize = Math.max((strokeWidth * 3) / zoom, 16 / zoom);
            const lineEndDist = Math.min(dist * 0.8, headSize * 0.7);

            line.set({
              x1: startX,
              y1: startY,
              x2: pointer.x - ux * lineEndDist,
              y2: pointer.y - uy * lineEndDist,
            });
            const angle = computeArrowAngle({ x: startX, y: startY }, { x: pointer.x, y: pointer.y });
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

      const handleMouseUp = (opt: fabric.IEvent) => {
        const pointer = canvas.getPointer(opt.e);

        // Arrow finalize: create unified group with head tip at drag end point
        if (activeTool === 'arrow' && arrowDragRef.current.isDrawing) {
          arrowDragRef.current.isDrawing = false;
          const { startX, startY, line, head } = arrowDragRef.current;
          if (line && head) {
            canvas.remove(line, head);
            const dist = Math.hypot(pointer.x - startX, pointer.y - startY);
            if (dist > 5) {
              const { group } = createArrowObjects(
                { x: startX, y: startY },
                { x: pointer.x, y: pointer.y },
                strokeColor,
                strokeWidth,
                canvas.getZoom()
              );
              canvas.add(group);
              canvas.setActiveObject(group);
              canvas.renderAll();
              recordHistory();
            }
          }
        }

        // Blur finalize
        if (activeTool === 'blur' && blurDragRef.current.isDrawing) {
          blurDragRef.current.isDrawing = false;
          const tempRect = blurDragRef.current.rect;
          if (tempRect) {
            canvas.remove(tempRect);
            const left = Math.round(tempRect.left || 0);
            const top = Math.round(tempRect.top || 0);
            const width = Math.round(tempRect.width || 0);
            const height = Math.round(tempRect.height || 0);

            if (width >= 8 && height >= 8) {
              const bgElement = (canvas.backgroundImage as fabric.Image)?.getElement() as
                | HTMLImageElement
                | undefined;
              const sourceImg = sourceImageRef.current || bgElement;

              if (sourceImg) {
                const rect = { x: left, y: top, width, height };
                const dataUrl = createBlurredRegionDataUrl(sourceImg, rect);
                if (dataUrl) {
                  createBlurFabricObject(dataUrl, rect)
                    .then((blurObj) => {
                      canvas.add(blurObj);
                      canvas.setActiveObject(blurObj);
                      canvas.renderAll();
                      recordHistory();
                    })
                    .catch(() => {});
                }
              }
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

    const executeUndo = () => {
      const state = historyRef.current.undo();
      if (state && fabricCanvasRef.current) {
        const canvas = fabricCanvasRef.current;
        isApplyingHistoryRef.current = true;
        canvas.loadFromJSON(state, () => {
          fabric.Image.fromURL(imageUrl, (bgImg) => {
            if (fabricCanvasRef.current && bgImg) {
              bgImg.set({
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
              });
              canvas.setBackgroundImage(bgImg, () => {
                canvas.renderAll();
                isApplyingHistoryRef.current = false;
                onHistoryChange(
                  historyRef.current.canUndo,
                  historyRef.current.canRedo,
                  true
                );
              });
            } else {
              canvas.renderAll();
              isApplyingHistoryRef.current = false;
              onHistoryChange(
                historyRef.current.canUndo,
                historyRef.current.canRedo,
                true
              );
            }
          });
        });
      }
    };

    const executeRedo = () => {
      const state = historyRef.current.redo();
      if (state && fabricCanvasRef.current) {
        const canvas = fabricCanvasRef.current;
        isApplyingHistoryRef.current = true;
        canvas.loadFromJSON(state, () => {
          fabric.Image.fromURL(imageUrl, (bgImg) => {
            if (fabricCanvasRef.current && bgImg) {
              bgImg.set({
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
              });
              canvas.setBackgroundImage(bgImg, () => {
                canvas.renderAll();
                isApplyingHistoryRef.current = false;
                onHistoryChange(
                  historyRef.current.canUndo,
                  historyRef.current.canRedo,
                  true
                );
              });
            } else {
              canvas.renderAll();
              isApplyingHistoryRef.current = false;
              onHistoryChange(
                historyRef.current.canUndo,
                historyRef.current.canRedo,
                true
              );
            }
          });
        });
      }
    };

    const deleteSelected = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const activeObj = canvas.getActiveObject();
      if (!activeObj) return;

      // Bug 4: Ignore if text is currently being edited
      const isTextEditing =
        (activeObj instanceof fabric.IText && activeObj.isEditing) ||
        (activeObj as unknown as { isEditing?: boolean })?.isEditing;
      if (isTextEditing) return;

      if (activeObj instanceof fabric.ActiveSelection) {
        activeObj.forEachObject((obj) => {
          canvas.remove(obj);
        });
        canvas.discardActiveObject();
      } else {
        canvas.remove(activeObj);
        canvas.discardActiveObject();
      }
      canvas.renderAll();
      // Note: canvas.remove triggers 'object:removed', which calls recordHistory()
    };

    // Keyboard Shortcuts (Bug 3: Ctrl+Z/Cmd+Z, Ctrl+Y/Redo, Bug 4: Delete key)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const activeObj = canvas.getActiveObject();
        const isTextEditing =
          (activeObj instanceof fabric.IText && activeObj.isEditing) ||
          (activeObj as unknown as { isEditing?: boolean })?.isEditing;

        // Bug 4: Delete / Backspace removes active object (ignore when editing text so typing works)
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (!isTextEditing && activeObj) {
            e.preventDefault();
            deleteSelected();
          }
          return;
        }

        // Bug 3: Ignore undo/redo keys while a text box is in edit mode
        if (isTextEditing) {
          return;
        }

        const isCtrlOrMeta = e.ctrlKey || e.metaKey;

        // Undo: Ctrl+Z or Cmd+Z (without Shift)
        if (isCtrlOrMeta && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
          e.preventDefault();
          executeUndo();
          return;
        }

        // Redo: Ctrl+Y, Cmd+Y, or Ctrl+Shift+Z, Cmd+Shift+Z
        const isRedoKey =
          (isCtrlOrMeta && (e.key === 'y' || e.key === 'Y')) ||
          (isCtrlOrMeta && e.shiftKey && (e.key === 'z' || e.key === 'Z'));

        if (isRedoKey) {
          e.preventDefault();
          executeRedo();
          return;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, []);

    // Imperative methods exposed via ref
    useImperativeHandle(ref, () => ({
      undo: executeUndo,
      redo: executeRedo,
      deleteSelected,
      reset: () => {
        if (!fabricCanvasRef.current) return;
        const canvas = fabricCanvasRef.current;

        // Clear all active annotations
        const objects = canvas.getObjects().slice();
        objects.forEach((obj) => canvas.remove(obj));

        // Revert background to original unmodified capture (capture.originalBlob)
        const origUrl = URL.createObjectURL(capture.originalBlob);
        fabric.Image.fromURL(origUrl, (bgImg) => {
          if (!fabricCanvasRef.current || !bgImg) return;
          bgImg.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
          });
          canvas.setBackgroundImage(bgImg, () => {
            canvas.renderAll();
            URL.revokeObjectURL(origUrl);
          });
          const origImg = new Image();
          origImg.onload = () => {
            sourceImageRef.current = origImg;
          };
          origImg.src = origUrl;

          historyRef.current.clear();
          onHistoryChange(false, false, false);
        });
      },
      save: async () => {
        if (!fabricCanvasRef.current) {
          throw new Error('Canvas not ready for export');
        }

        const canvas = fabricCanvasRef.current;

        // Discard any active selection so selection handles are removed from the export and screen
        canvas.discardActiveObject();

        const baseBlob = capture.editedBlob || capture.originalBlob;

        // Offscreen composite export containing base image at natural size + Fabric annotations
        const blob = await exportCompositeImage(
          baseBlob,
          canvas,
          capture.width,
          capture.height
        );

        // Make the final output fully static and finalized:
        // Clear all active annotation objects from the canvas since they are baked into the image
        const objects = canvas.getObjects().slice();
        objects.forEach((obj) => {
          canvas.remove(obj);
        });

        // Set the newly finalized composite blob as the static background
        const finalizedUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          fabric.Image.fromURL(finalizedUrl, (bgImg) => {
            if (fabricCanvasRef.current && bgImg) {
              bgImg.set({
                left: 0,
                top: 0,
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
              });
              canvas.setBackgroundImage(bgImg, () => {
                canvas.renderAll();
                resolve();
              });
            } else {
              resolve();
            }
          });
        });

        const finalizedImg = new Image();
        finalizedImg.onload = () => {
          sourceImageRef.current = finalizedImg;
        };
        finalizedImg.src = finalizedUrl;

        historyRef.current.clear();
        onHistoryChange(false, false, false);

        return { blob, editState: null };
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
