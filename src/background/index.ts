import { logger } from '@/shared/logger';

/**
 * ClipCache Background Service Worker
 *
 * Configures side panel behavior to open when user clicks the extension toolbar icon.
 * Maintains zero state in memory per architecture rules.
 */

const configureSidePanel = async (): Promise<void> => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    logger.info('Side panel behavior set: openPanelOnActionClick enabled');
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
