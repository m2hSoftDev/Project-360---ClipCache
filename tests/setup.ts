import { Blob as NodeBlob } from 'node:buffer';

// 1. Ensure Node's native Blob is used so structuredClone in fake-indexeddb preserves Blobs
if (typeof NodeBlob !== 'undefined') {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  if (typeof window !== 'undefined') {
    (window as unknown as { Blob: typeof NodeBlob }).Blob = NodeBlob;
  }
}

// 2. Mock 2D Context for HTMLCanvasElement in jsdom environment for Fabric.js and composite export
if (typeof HTMLCanvasElement !== 'undefined') {
  const blobStore = new Map<
    string,
    { blob: Blob; pixelData?: Uint8ClampedArray; width?: number; height?: number }
  >();

  if (typeof URL !== 'undefined') {
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = function (blob: Blob): string {
      const url = origCreate
        ? origCreate.call(URL, blob)
        : `blob:mock-${Math.random()}`;
      blobStore.set(url, {
        blob,
        pixelData: (blob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData,
        width: (blob as unknown as { width?: number }).width,
        height: (blob as unknown as { height?: number }).height,
      });
      return url;
    };
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = function (url: string) {
        blobStore.delete(url);
      };
    }
  }

  // Intercept window.Image and globalThis.Image src assignment in jsdom to trigger onload with pixel data
  class MockImage {
    private _src = '';
    public width = 100;
    public height = 100;
    public onload: ((e: Event) => void) | null = null;
    public onerror: ((e: Event) => void) | null = null;
    public _pixelData?: Uint8ClampedArray;

    get src() {
      return this._src;
    }

    set src(url: string) {
      this._src = url;
      const entry = blobStore.get(url);
      if (entry && entry.pixelData) {
        this._pixelData = entry.pixelData;
        this.width = entry.width || 100;
        this.height = entry.height || 100;
      }
      setTimeout(() => {
        if (this.onload) {
          this.onload({} as Event);
        }
      }, 0);
    }
  }

  // @ts-expect-error override Image constructor in Node/jsdom test environment
  globalThis.Image = MockImage as unknown as typeof Image;
  if (typeof window !== 'undefined') {
    // @ts-expect-error override Image constructor in window
    window.Image = MockImage as unknown as typeof Image;
  }

  class MockCanvasRenderingContext2D {
    public canvas: HTMLCanvasElement;
    public fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
    public strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
    public lineWidth = 1;

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      this.ensurePixelData();
    }

    private ensurePixelData() {
      const w = Math.max(1, this.canvas.width || 1);
      const h = Math.max(1, this.canvas.height || 1);
      const current = (this.canvas as unknown as { _pixelData?: Uint8ClampedArray })._pixelData;
      if (!current || current.length !== w * h * 4) {
        (this.canvas as unknown as { _pixelData?: Uint8ClampedArray })._pixelData =
          new Uint8ClampedArray(w * h * 4);
      }
    }

    clearRect(x: number, y: number, w: number, h: number) {
      this.ensurePixelData();
      const data = (this.canvas as unknown as { _pixelData: Uint8ClampedArray })._pixelData;
      const canvasW = this.canvas.width;
      for (let row = Math.max(0, y); row < Math.min(this.canvas.height, y + h); row++) {
        for (let col = Math.max(0, x); col < Math.min(this.canvas.width, x + w); col++) {
          const idx = (row * canvasW + col) * 4;
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        }
      }
    }

    fillRect(x: number, y: number, w: number, h: number) {
      this.ensurePixelData();
      const data = (this.canvas as unknown as { _pixelData: Uint8ClampedArray })._pixelData;
      const canvasW = this.canvas.width;
      let [r, g, b, a] = [0, 0, 0, 255];
      if (typeof this.fillStyle === 'string') {
        const c = this.fillStyle.toLowerCase();
        if (c === '#ff0000' || c === 'red') [r, g, b, a] = [255, 0, 0, 255];
        else if (c === '#00ff00' || c === 'green') [r, g, b, a] = [0, 255, 0, 255];
        else if (c === '#0000ff' || c === 'blue') [r, g, b, a] = [0, 0, 255, 255];
      }
      for (let row = Math.max(0, y); row < Math.min(this.canvas.height, y + h); row++) {
        for (let col = Math.max(0, x); col < Math.min(this.canvas.width, x + w); col++) {
          const idx = (row * canvasW + col) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
    }

    drawImage(img: HTMLImageElement | HTMLCanvasElement, ..._args: unknown[]) {
      this.ensurePixelData();
      const destData = (this.canvas as unknown as { _pixelData: Uint8ClampedArray })._pixelData;
      const srcData = (img as unknown as { _pixelData?: Uint8ClampedArray })._pixelData;
      if (!srcData) return;

      for (let i = 0; i < destData.length && i < srcData.length; i += 4) {
        if (srcData[i + 3] > 0) {
          destData[i] = srcData[i];
          destData[i + 1] = srcData[i + 1];
          destData[i + 2] = srcData[i + 2];
          destData[i + 3] = srcData[i + 3];
        }
      }
    }

    getImageData(x: number, y: number, w: number, h: number) {
      this.ensurePixelData();
      const src = (this.canvas as unknown as { _pixelData: Uint8ClampedArray })._pixelData;
      const out = new Uint8ClampedArray(w * h * 4);
      const canvasW = this.canvas.width;
      let outIdx = 0;
      for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) {
          const idx = (row * canvasW + col) * 4;
          out[outIdx++] = src[idx] ?? 0;
          out[outIdx++] = src[idx + 1] ?? 0;
          out[outIdx++] = src[idx + 2] ?? 0;
          out[outIdx++] = src[idx + 3] ?? 0;
        }
      }
      return { data: out, width: w, height: h };
    }

    strokeRect() {}
    fillText() {}
    strokeText() {}
    measureText() {
      return { width: 0, height: 0 };
    }
    putImageData() {}
    createImageData() {
      return { data: new Uint8ClampedArray(4), width: 1, height: 1 };
    }
    setTransform() {}
    resetTransform() {}
    save() {}
    restore() {}
    beginPath() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    stroke() {}
    fill() {}
    arc() {}
    scale() {}
    translate() {}
    transform() {}
    rect() {}
    clip() {}
    createPattern() {
      return null;
    }
    createLinearGradient() {
      return { addColorStop: () => {} };
    }
    createRadialGradient() {
      return { addColorStop: () => {} };
    }
    setLineDash() {}
    getLineDash() {
      return [];
    }
    isPointInPath() {
      return false;
    }
  }

  HTMLCanvasElement.prototype.getContext = function (contextId: string) {
    if (contextId === '2d') {
      if (!(this as unknown as { _mockCtx?: MockCanvasRenderingContext2D })._mockCtx) {
        (this as unknown as { _mockCtx?: MockCanvasRenderingContext2D })._mockCtx =
          new MockCanvasRenderingContext2D(this);
      }
      return (this as unknown as { _mockCtx: MockCanvasRenderingContext2D })
        ._mockCtx as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toBlob = function (
    callback: BlobCallback,
    type = 'image/png'
  ) {
    const pixelData =
      (this as unknown as { _pixelData?: Uint8ClampedArray })._pixelData ||
      new Uint8ClampedArray(4);
    const blob = new Blob([pixelData], { type });
    (blob as unknown as { _pixelData?: Uint8ClampedArray })._pixelData = pixelData;
    (blob as unknown as { width?: number }).width = this.width;
    (blob as unknown as { height?: number }).height = this.height;
    callback(blob);
  };

  HTMLCanvasElement.prototype.toDataURL = function () {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  };
}
