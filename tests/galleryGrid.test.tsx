import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GalleryGrid } from '@/sidepanel/components/GalleryGrid';
import { ScreenshotItem } from '@/shared/types';

// Configure act environment for React 18 in jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('GalleryGrid (Phase 3 Requirements)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-thumb-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const dummyCaptures: ScreenshotItem[] = [
    {
      id: 1,
      createdAt: 1776326400000,
      sourceUrl: 'https://example.com/one',
      pageTitle: 'First Capture',
      mode: 'visible',
      originalBlob: new Blob(['bytes1'], { type: 'image/png' }),
      editedBlob: null,
      editState: null,
      width: 1920,
      height: 1080,
      isEdited: false,
      parentId: null,
    },
    {
      id: 2,
      createdAt: 1776326500000,
      sourceUrl: 'https://example.com/two',
      pageTitle: 'Second Capture (Area Crop)',
      mode: 'area',
      originalBlob: new Blob(['bytes2'], { type: 'image/png' }),
      editedBlob: null,
      editState: null,
      width: 600,
      height: 400,
      isEdited: false,
      parentId: 1,
    },
  ];

  it('renders thumbnail grid using CSS grid with minmax(140px, 1fr)', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GalleryGrid
          captures={dummyCaptures}
          onSelectPreview={vi.fn()}
          onDeleteClick={vi.fn()}
        />
      );
    });

    const grid = container.querySelector('[data-testid="gallery-grid"]') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(140px, 1fr))');
  });

  it('each card shows image container with nothing overlapping the image, and a label bar below it', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GalleryGrid
          captures={dummyCaptures}
          onSelectPreview={vi.fn()}
          onDeleteClick={vi.fn()}
        />
      );
    });

    const card = container.querySelector('[data-testid="gallery-card-1"]');
    expect(card).toBeTruthy();

    // Check first child is image container
    const imageContainer = card!.firstElementChild as HTMLElement;
    expect(imageContainer).toBeTruthy();

    // Inside image container: ONLY an <img> (or placeholder). No text, badges, or buttons!
    const childrenInImageContainer = Array.from(imageContainer.children);
    expect(childrenInImageContainer.every((c) => c.tagName === 'IMG' || c.tagName === 'svg')).toBe(true);

    // Second child is the label bar below the image
    const labelBar = card!.children[1] as HTMLElement;
    expect(labelBar).toBeTruthy();

    // Mode is VISIBLE in uppercase
    expect(labelBar.textContent).toContain('VISIBLE');

    // Size in pixels
    expect(labelBar.textContent).toContain('1920 × 1080 px');

    // Delete button exists in the label bar
    const deleteBtn = labelBar.querySelector('[data-testid="delete-card-1"]');
    expect(deleteBtn).toBeTruthy();
  });

  it('clicking card triggers onSelectPreview', async () => {
    const onSelectPreviewMock = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <GalleryGrid
          captures={dummyCaptures}
          onSelectPreview={onSelectPreviewMock}
          onDeleteClick={vi.fn()}
        />
      );
    });

    const card = container.querySelector('[data-testid="gallery-card-1"]') as HTMLElement;
    await act(async () => {
      card.click();
    });

    expect(onSelectPreviewMock).toHaveBeenCalledWith(dummyCaptures[0]);
  });

  it('clicking delete button triggers onDeleteClick without triggering onSelectPreview', async () => {
    const onSelectPreviewMock = vi.fn();
    const onDeleteClickMock = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <GalleryGrid
          captures={dummyCaptures}
          onSelectPreview={onSelectPreviewMock}
          onDeleteClick={onDeleteClickMock}
        />
      );
    });

    const deleteBtn = container.querySelector('[data-testid="delete-card-1"]') as HTMLButtonElement;
    await act(async () => {
      deleteBtn.click();
    });

    expect(onDeleteClickMock).toHaveBeenCalledWith(dummyCaptures[0]);
    expect(onSelectPreviewMock).not.toHaveBeenCalled();
  });
});
