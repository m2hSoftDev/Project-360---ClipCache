import { logger } from '@/shared/logger';
import { captureVisibleTabAction } from './capture';
import { ExtensionMessage } from '@/shared/messages';

/**
 * ClipCache Background Service Worker
 *
 * - Configures side panel behavior to open when user clicks the extension toolbar icon.
 * - Handles Alt+Shift+S shortcut via chrome.commands.onCommand (calls captureVisibleTab with no picker).
 * - Maintains zero state in memory per architecture rules; reads and writes Dexie directly.
 */

const configureSidePanel = async (): Promise<void> => {
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      logger.info('Side panel behavior set: openPanelOnActionClick enabled');
    }
  } catch (error: unknown) {
    logger.error('Failed to set side panel behavior', error);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  logger.info('ClipCache extension installed');
  void configureSidePanel();
});

// Configure immediately on startup
void configureSidePanel();

/**
 * Global Keyboard Shortcut Listener (Alt+Shift+S)
 * Captures the visible tab with no picker, auto-saves to Dexie, and opens/notifies the side panel.
 */
chrome.commands.onCommand.addListener(async (command) => {
  logger.info(`Received command: ${command}`);

  if (command === 'capture_visible') {
    const result = await captureVisibleTabAction();

    // Broadcast result to active extension pages / sidepanel
    try {
      await chrome.runtime.sendMessage({
        type: 'CAPTURE_RESPONSE',
        success: result.success,
        screenshotId: result.screenshotId,
        error: result.error,
      });
    } catch {
      // Side panel might be closed; opening it below
    }

    // Ensure side panel is opened
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.windowId && chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId: activeTab.windowId });
      }
    } catch (panelError) {
      logger.warn('Could not auto-open side panel', panelError);
    }
  }
});

/**
 * Typed message listener for requests from sidepanel
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'CAPTURE_REQUEST' && message.mode === 'visible') {
    void captureVisibleTabAction().then((result) => {
      sendResponse({
        type: 'CAPTURE_RESPONSE',
        success: result.success,
        screenshotId: result.screenshotId,
        error: result.error,
      });
    });
    return true; // Keep message channel open for async response
  }
});
