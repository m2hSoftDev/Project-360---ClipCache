import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PreviewPage } from '@/sidepanel/pages/PreviewPage';
import { ScreenshotItem } from '@/shared/types';

// Configure act environment for React 18 in jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PreviewPage Toolbar and Metadata (Phase 4 Enabled Editor)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
    global.URL.revokeObjectURL = vi.fn();

    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const dummyCapture: ScreenshotItem = {
    id: 42,
    createdAt: 1776326400000, // Oct 16, 2026
    sourceUrl: 'https://example.com/test-page',
    pageTitle: 'Test Page Heading',
    mode: 'visible',
    originalBlob: new Blob(['preview-image'], { type: 'image/png' }),
    editedBlob: null,
    editState: null,
    width: 1920,
    height: 1080,
    isEdited: false,
    parentId: null,
  };

  it('renders metadata above the image: title, mode, size, and created time', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <PreviewPage
          capture={dummyCapture}
          onBack={vi.fn()}
          onDeleteClick={vi.fn()}
        />
      );
    });

    const titleEl = container.querySelector('[data-testid="preview-title"]');
    expect(titleEl?.textContent).toBe('Test Page Heading');

    const modeEl = container.querySelector('[data-testid="preview-mode"]');
    expect(modeEl?.textContent).toBe('VISIBLE');

    const sizeEl = container.querySelector('[data-testid="preview-size"]');
    expect(sizeEl?.textContent).toContain('1920 × 1080 px');

    const createdEl = container.querySelector('[data-testid="preview-created-time"]');
    expect(createdEl?.textContent).toBeTruthy();

    const deleteBtn = container.querySelector('[data-testid="preview-delete-button"]');
    expect(deleteBtn).toBeTruthy();
  });

  it('renders toolbar buttons in EXACT required order: Crop, Blur, Draw, Text, Arrow, Undo, Redo, Reset, Save, Back', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <PreviewPage
          capture={dummyCapture}
          onBack={vi.fn()}
          onDeleteClick={vi.fn()}
        />
      );
    });

    const toolbarSection = container.querySelector('section[aria-label="Editor Toolbar"]');
    expect(toolbarSection).toBeTruthy();

    const buttons = Array.from(toolbarSection!.querySelectorAll('button'));
    const expectedOrder = [
      'Crop',
      'Blur',
      'Draw',
      'Text',
      'Arrow',
      'Undo',
      'Redo',
      'Reset',
      'Save',
      'Back',
    ];

    expect(buttons.map((b) => b.textContent?.trim())).toEqual(expectedOrder);
  });

  it('confirms editing tools are operational and no button has "Coming in Phase 4"', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <PreviewPage
          capture={dummyCapture}
          onBack={vi.fn()}
          onDeleteClick={vi.fn()}
        />
      );
    });

    const toolbarSection = container.querySelector('section[aria-label="Editor Toolbar"]')!;
    const buttons = Array.from(toolbarSection.querySelectorAll('button'));

    // Verify NONE of the buttons have the Phase 3 placeholder tooltip
    for (const btn of buttons) {
      expect(btn.getAttribute('title')).not.toContain('Coming in Phase 4');
    }

    // Interactive tools must be enabled
    const cropBtn = container.querySelector('[data-testid="preview-toolbar-crop"]') as HTMLButtonElement;
    const blurBtn = container.querySelector('[data-testid="preview-toolbar-blur"]') as HTMLButtonElement;
    const drawBtn = container.querySelector('[data-testid="preview-toolbar-draw"]') as HTMLButtonElement;
    const textBtn = container.querySelector('[data-testid="preview-toolbar-text"]') as HTMLButtonElement;
    const arrowBtn = container.querySelector('[data-testid="preview-toolbar-arrow"]') as HTMLButtonElement;
    const resetBtn = container.querySelector('[data-testid="preview-toolbar-reset"]') as HTMLButtonElement;
    const saveBtn = container.querySelector('[data-testid="preview-toolbar-save"]') as HTMLButtonElement;
    const backBtn = container.querySelector('[data-testid="preview-toolbar-back"]') as HTMLButtonElement;

    expect(cropBtn.disabled).toBe(false);
    expect(blurBtn.disabled).toBe(false);
    expect(drawBtn.disabled).toBe(false);
    expect(textBtn.disabled).toBe(false);
    expect(arrowBtn.disabled).toBe(false);
    expect(resetBtn.disabled).toBe(false);
    expect(saveBtn.disabled).toBe(false);
    expect(backBtn.disabled).toBe(false);
  });

  it('calls onBack when Back is clicked with no unsaved changes', async () => {
    const onBackMock = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PreviewPage
          capture={dummyCapture}
          onBack={onBackMock}
          onDeleteClick={vi.fn()}
        />
      );
    });

    const backBtn = container.querySelector('[data-testid="preview-toolbar-back"]') as HTMLButtonElement;
    expect(backBtn).toBeTruthy();

    await act(async () => {
      backBtn.click();
    });

    expect(onBackMock).toHaveBeenCalledTimes(1);
  });

  it('creates object URL on open and revokes it on unmount', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PreviewPage
          capture={dummyCapture}
          onBack={vi.fn()}
          onDeleteClick={vi.fn()}
        />
      );
    });

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(dummyCapture.originalBlob);

    await act(async () => {
      root.unmount();
    });

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
  });
});
