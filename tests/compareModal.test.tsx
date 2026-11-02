import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CompareModal } from '@/sidepanel/components/CompareModal';

// Configure act environment for React 18 in jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Phase 5 Compare View Tests (CLAUDE.md Phase 5)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    global.URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-compare-${blob.type}`);
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const originalBlob = new Blob(['original-img'], { type: 'image/png' });
  const editedBlob = new Blob(['edited-img'], { type: 'image/png' });

  it('renders nothing when isOpen is false', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CompareModal
          isOpen={false}
          onClose={vi.fn()}
          originalBlob={originalBlob}
          editedBlob={editedBlob}
          width={1920}
          height={1080}
        />
      );
    });

    expect(container.querySelector('[data-testid="compare-modal"]')).toBeNull();
  });

  it('shows "No edits yet. Edit and save first." when editedBlob is null', async () => {
    const onClose = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CompareModal
          isOpen={true}
          onClose={onClose}
          originalBlob={originalBlob}
          editedBlob={null}
          width={1920}
          height={1080}
        />
      );
    });

    const modal = container.querySelector('[data-testid="compare-modal"]');
    expect(modal).toBeTruthy();

    const emptyMsg = container.querySelector('[data-testid="compare-no-edits-message"]');
    expect(emptyMsg).toBeTruthy();
    expect(emptyMsg?.textContent).toContain('No edits yet. Edit and save first.');

    // Slider should not be rendered
    expect(container.querySelector('[data-testid="compare-slider-container"]')).toBeNull();

    // Clicking close button triggers onClose
    const closeBtn = container.querySelector('[data-testid="compare-close-button"]') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    await act(async () => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders draggable before/after slider when editedBlob exists and allocates object URLs', async () => {
    const onClose = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CompareModal
          isOpen={true}
          onClose={onClose}
          originalBlob={originalBlob}
          editedBlob={editedBlob}
          pageTitle="Full Tab Capture"
          width={1920}
          height={1080}
        />
      );
    });

    const modal = container.querySelector('[data-testid="compare-modal"]');
    expect(modal).toBeTruthy();

    // Should NOT show no edits message
    expect(container.querySelector('[data-testid="compare-no-edits-message"]')).toBeNull();

    // Slider container, both before and after images, and divider handle must be rendered
    const sliderContainer = container.querySelector('[data-testid="compare-slider-container"]');
    expect(sliderContainer).toBeTruthy();

    const beforeImage = container.querySelector('[data-testid="compare-before-image"]') as HTMLImageElement;
    const afterImage = container.querySelector('[data-testid="compare-after-image"]') as HTMLImageElement;
    const dividerHandle = container.querySelector('[data-testid="compare-divider-handle"]');

    expect(beforeImage).toBeTruthy();
    expect(afterImage).toBeTruthy();
    expect(dividerHandle).toBeTruthy();

    // Both images must have w-full max-w-full and h-auto to scale to panel width without clipping
    expect(beforeImage.className).toContain('w-full');
    expect(beforeImage.className).toContain('max-w-full');
    expect(afterImage.className).toContain('w-full');
    expect(afterImage.className).toContain('max-w-full');

    // Both URLs should have been allocated
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(originalBlob);
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(editedBlob);
  });

  it('allows adjusting slider position and revokes object URLs on unmount', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CompareModal
          isOpen={true}
          onClose={vi.fn()}
          originalBlob={originalBlob}
          editedBlob={editedBlob}
          width={1920}
          height={1080}
        />
      );
    });

    const rangeInput = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(rangeInput).toBeTruthy();
    expect(rangeInput.value).toBe('50');

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    await act(async () => {
      if (nativeSetter) {
        nativeSetter.call(rangeInput, '75');
      } else {
        rangeInput.value = '75';
      }
      rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
      rangeInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(rangeInput.value).toBe('75');
    expect(container.textContent).toContain('75% Original');

    // Unmount and verify revokeObjectURL is called
    await act(async () => {
      root.unmount();
    });

    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });
});
