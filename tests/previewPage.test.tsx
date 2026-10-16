import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PreviewPage } from '@/sidepanel/pages/PreviewPage';
import { ScreenshotItem } from '@/shared/types';

// Configure act environment for React 18 in jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PreviewPage Toolbar and Metadata (Phase 3 Requirements)', () => {
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

    const toolbarSection = container.querySelector('section[aria-label="Preview Toolbar"]');
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

  it('disables every toolbar button except Back with tooltip "Coming in Phase 4"', async () => {
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

    const toolbarSection = container.querySelector('section[aria-label="Preview Toolbar"]')!;
    const buttons = Array.from(toolbarSection.querySelectorAll('button'));

    // First 9 buttons: Crop, Blur, Draw, Text, Arrow, Undo, Redo, Reset, Save
    for (let i = 0; i < 9; i++) {
      const btn = buttons[i];
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('title')).toBe('Coming in Phase 4');
    }

    // 10th button: Back
    const backBtn = buttons[9];
    expect(backBtn.disabled).toBe(false);
    expect(backBtn.textContent?.trim()).toBe('Back');
  });

  it('calls onBack when the Back button is clicked', async () => {
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
