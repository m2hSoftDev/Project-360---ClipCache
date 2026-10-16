import { Blob as NodeBlob } from 'node:buffer';

// 1. Ensure Node's native Blob is used so structuredClone in fake-indexeddb preserves Blobs
if (typeof NodeBlob !== 'undefined') {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  if (typeof window !== 'undefined') {
    (window as unknown as { Blob: typeof NodeBlob }).Blob = NodeBlob;
  }
}

// 2. Mock 2D Context for HTMLCanvasElement in jsdom environment for Fabric.js
if (typeof HTMLCanvasElement !== 'undefined') {
  const dummyContext = {
    canvas: null as unknown as HTMLCanvasElement,
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 0, height: 0 }),
    getImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }),
    putImageData: () => {},
    createImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }),
    setTransform: () => {},
    resetTransform: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    scale: () => {},
    translate: () => {},
    transform: () => {},
    rect: () => {},
    clip: () => {},
    createPattern: () => null,
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    setLineDash: () => {},
    getLineDash: () => [],
    isPointInPath: () => false,
  };

  HTMLCanvasElement.prototype.getContext = function (contextId: string) {
    if (contextId === '2d') {
      dummyContext.canvas = this;
      return dummyContext as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toDataURL = function () {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  };
}
