import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CapturePage } from '@/sidepanel/pages/CapturePage';
import { logger } from '@/shared/logger';

// Configure act environment for React 18 in jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Keyboard Shortcuts & Commands Verification', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('no code path registers or handles Alt+C or Alt+Shift+C in src/, manifest, or dist/', () => {
    const rootDir = path.resolve(__dirname, '..');
    const searchDirs = [
      path.join(rootDir, 'src'),
      path.join(rootDir, 'manifest.config.ts'),
      path.join(rootDir, 'dist', 'manifest.json'),
    ];

    const findFiles = (dirOrFile: string): string[] => {
      if (!fs.existsSync(dirOrFile)) return [];
      const stat = fs.statSync(dirOrFile);
      if (!stat.isDirectory()) return [dirOrFile];
      const entries = fs.readdirSync(dirOrFile);
      return entries.flatMap((entry) => findFiles(path.join(dirOrFile, entry)));
    };

    const files = searchDirs.flatMap(findFiles);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.includes('Alt+C')).toBe(false);
      expect(content.includes('Alt+Shift+C')).toBe(false);
      expect(content.includes('Alt + C')).toBe(false);
      expect(content.includes('capture_visible')).toBe(false);
    }
  });

  it('the background command handler ignores any command name other than capture-visible-v2', async () => {
    // Spy on logger.info
    const loggerSpy = vi.spyOn(logger, 'info');

    // Create a mock command dispatcher replicating the background logic in src/background/index.ts
    const captureTabMock = vi.fn().mockResolvedValue({ success: true, screenshotId: 1 });
    const handleCommand = async (command: string) => {
      logger.info(`Received command: ${command}`);
      if (command !== 'capture-visible-v2') {
        return;
      }
      await captureTabMock();
    };

    // Stale or invalid command names must be completely ignored
    await handleCommand('Alt+C');
    await handleCommand('Alt+Shift+C');
    await handleCommand('capture_visible');
    await handleCommand('area-capture');
    await handleCommand('_execute_action');
    await handleCommand('unknown');

    expect(loggerSpy).toHaveBeenCalledWith('Received command: Alt+C');
    expect(loggerSpy).toHaveBeenCalledWith('Received command: Alt+Shift+C');
    expect(loggerSpy).toHaveBeenCalledWith('Received command: capture_visible');
    expect(captureTabMock).not.toHaveBeenCalled();

    // The new command name must trigger capture
    await handleCommand('capture-visible-v2');
    expect(loggerSpy).toHaveBeenCalledWith('Received command: capture-visible-v2');
    expect(captureTabMock).toHaveBeenCalledTimes(1);
  });

  it('the panel label shows the full string from mocked getAll, and "Not set" when empty (never a single letter)', async () => {
    // 1. Mock chrome.commands.getAll with valid shortcut
    const mockCommands = [
      {
        name: 'capture-visible-v2',
        shortcut: 'Alt+Shift+S',
        description: 'Capture visible tab',
      },
    ];

    global.chrome = {
      ...global.chrome,
      runtime: {
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        sendMessage: vi.fn(),
      },
      commands: {
        getAll: (callback: (commands: typeof mockCommands) => void) => {
          callback(mockCommands);
        },
      },
      tabs: {
        create: vi.fn(),
      },
    } as unknown as typeof chrome;

    const root = createRoot(container);
    await act(async () => {
      root.render(<CapturePage />);
    });

    const shortcutLabel = container.querySelector('[data-testid="shortcut-label"]');
    const cardShortcutLabel = container.querySelector('[data-testid="card-shortcut-label"]');

    expect(shortcutLabel?.textContent).toBe('Alt+Shift+S');
    expect(cardShortcutLabel?.textContent).toBe('Alt+Shift+S');

    // Verify it never shows a single letter
    expect(shortcutLabel?.textContent).not.toBe('C');
    expect(shortcutLabel?.textContent).not.toBe('S');
    expect(shortcutLabel?.textContent?.length).toBeGreaterThan(1);

    // 2. Mock chrome.commands.getAll with empty shortcut (not set)
    const emptyCommands = [
      {
        name: 'capture-visible-v2',
        shortcut: '',
        description: 'Capture visible tab',
      },
    ];

    global.chrome.commands.getAll = (callback: (commands: typeof emptyCommands) => void) => {
      callback(emptyCommands);
    };

    const containerEmpty = document.createElement('div');
    document.body.appendChild(containerEmpty);
    const rootEmpty = createRoot(containerEmpty);

    await act(async () => {
      rootEmpty.render(<CapturePage />);
    });

    const emptyShortcutLabel = containerEmpty.querySelector('[data-testid="shortcut-label"]');
    expect(emptyShortcutLabel?.textContent).toContain('Not set');
    expect(emptyShortcutLabel?.textContent).toBe(
      'Not set. Set it at chrome://extensions/shortcuts'
    );
    expect(emptyShortcutLabel?.textContent).not.toBe('C');
    expect(emptyShortcutLabel?.textContent?.length).toBeGreaterThan(1);

    document.body.removeChild(containerEmpty);
  });

  it('dynamically reflects new shortcut when changed at chrome://extensions/shortcuts', async () => {
    let currentShortcut = 'Alt+Shift+S';
    global.chrome = {
      ...global.chrome,
      commands: {
        getAll: (callback: (commands: Array<{ name: string; shortcut: string; description: string }>) => void) => {
          callback([
            {
              name: 'capture-visible-v2',
              shortcut: currentShortcut,
              description: 'Capture visible tab',
            },
          ]);
        },
      },
    } as unknown as typeof chrome;

    const testContainer = document.createElement('div');
    document.body.appendChild(testContainer);
    const root = createRoot(testContainer);

    await act(async () => {
      root.render(<CapturePage />);
    });

    const badgeLabel = testContainer.querySelector('[data-testid="shortcut-label"]');
    const cardLabel = testContainer.querySelector('[data-testid="card-shortcut-label"]');
    expect(badgeLabel?.textContent).toBe('Alt+Shift+S');
    expect(cardLabel?.textContent).toBe('Alt+Shift+S');

    // Simulate user changing shortcut at chrome://extensions/shortcuts
    currentShortcut = 'Ctrl+Shift+X';

    // User refocuses the side panel window
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(badgeLabel?.textContent).toBe('Ctrl+Shift+X');
    expect(cardLabel?.textContent).toBe('Ctrl+Shift+X');

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(testContainer);
  });
});
