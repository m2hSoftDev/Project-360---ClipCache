import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeleteConfirmModal } from '@/sidepanel/components/DeleteConfirmModal';
import { ScreenshotItem } from '@/shared/types';

// Configure act environment for React 18 in jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DeleteConfirmModal (Phase 3 Confirmation Dialog)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const dummyCapture: ScreenshotItem = {
    id: 10,
    createdAt: Date.now(),
    sourceUrl: 'https://example.com',
    pageTitle: 'Sample Page',
    mode: 'visible',
    originalBlob: new Blob(['sample']),
    editedBlob: null,
    editState: null,
    width: 1920,
    height: 1080,
    isEdited: false,
  };

  it('displays confirmation explanation mentioning originalBlob and parentId children', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DeleteConfirmModal
          isOpen={true}
          capture={dummyCapture}
          linkedCount={2}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    const desc = container.querySelector('#delete-dialog-desc');
    expect(desc).toBeTruthy();
    expect(desc?.textContent).toContain(
      'Deleting this record removes both originalBlob and any edit or crop children linked by parentId.'
    );
    expect(desc?.textContent).toContain('2 linked crops/edits');
  });

  it('triggers onConfirm when confirm button is clicked', async () => {
    const onConfirmMock = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DeleteConfirmModal
          isOpen={true}
          capture={dummyCapture}
          linkedCount={0}
          onConfirm={onConfirmMock}
          onCancel={vi.fn()}
        />
      );
    });

    const confirmBtn = container.querySelector('[data-testid="confirm-delete-button"]') as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();

    await act(async () => {
      confirmBtn.click();
    });

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });

  it('triggers onCancel when Cancel button is clicked', async () => {
    const onCancelMock = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DeleteConfirmModal
          isOpen={true}
          capture={dummyCapture}
          linkedCount={0}
          onConfirm={vi.fn()}
          onCancel={onCancelMock}
        />
      );
    });

    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel'
    );
    expect(cancelBtn).toBeTruthy();

    await act(async () => {
      cancelBtn!.click();
    });

    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});
