import Dexie, { type Table } from 'dexie';
import { ScreenshotItem, SettingItem, CaptureMode } from '@/shared/types';
import { logger } from '@/shared/logger';
import { checkCaptureLimit, FREE_PLAN_LIMIT } from '@/background/limits';

export interface UserShortcuts {
  screenCapture: string;
  [key: string]: string;
}

export const DEFAULT_SHORTCUTS: UserShortcuts = {
  screenCapture: 'Alt+Shift+S',
};

/**
 * Dexie.js database schema for ClipCache
 *
 * Adheres strictly to the data model in CLAUDE.md:
 * - Table `screenshots`: id (auto), createdAt, sourceUrl, pageTitle,
 *   mode ('visible'|'window'|'full'|'area'), originalBlob, editedBlob|null,
 *   editState (Fabric JSON)|null, width, height, isEdited.
 * - Table `settings`: key, value (theme, shortcuts).
 */
export class ClipCacheDatabase extends Dexie {
  screenshots!: Table<ScreenshotItem, number>;
  settings!: Table<SettingItem, string>;

  constructor(dbName = 'ClipCacheDB') {
    super(dbName);
    this.version(1).stores({
      screenshots: '++id, createdAt, mode, isEdited, parentId',
      settings: 'key',
    });
  }
}


export const db = new ClipCacheDatabase();

/**
 * Saves a new screenshot to IndexedDB.
 * Enforces the free-plan limit before any save per CLAUDE.md Phase 3.
 */
export async function addScreenshot(
  item: Omit<ScreenshotItem, 'id'>,
  database: ClipCacheDatabase = db,
  isPaid = false
): Promise<number> {
  const currentCount = await database.screenshots.count();
  const limitCheck = checkCaptureLimit(currentCount, isPaid);
  if (!limitCheck.allowed) {
    const errorMsg =
      limitCheck.message ||
      `Free limit reached (${FREE_PLAN_LIMIT}/${FREE_PLAN_LIMIT}). Delete a capture to add a new one.`;
    logger.warn(`Save rejected: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const id = await database.screenshots.add(item as ScreenshotItem);
    logger.info(`Screenshot saved with ID: ${id}`);
    return id;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Free limit reached')) {
      throw error;
    }
    logger.error('Failed to save screenshot to IndexedDB', error);
    throw new Error('Could not save screenshot. Storage may be full or restricted.');
  }
}

/**
 * Retrieves a single screenshot by its ID.
 */
export async function getScreenshot(
  id: number,
  database: ClipCacheDatabase = db
): Promise<ScreenshotItem | undefined> {
  try {
    return await database.screenshots.get(id);
  } catch (error) {
    logger.error(`Failed to retrieve screenshot with ID: ${id}`, error);
    throw new Error('Could not load screenshot from storage.');
  }
}

/**
 * Retrieves all screenshots sorted by creation time descending (newest first).
 */
export async function getAllScreenshots(
  database: ClipCacheDatabase = db
): Promise<ScreenshotItem[]> {
  try {
    return await database.screenshots.orderBy('createdAt').reverse().toArray();
  } catch (error) {
    logger.error('Failed to retrieve all screenshots', error);
    throw new Error('Could not load screenshot gallery.');
  }
}

/**
 * Deletes a screenshot by ID.
 * Deleting a record removes both originalBlob and any edit or crop
 * children linked by parentId, after confirmation per CLAUDE.md Phase 3.
 *
 * @returns Array of deleted screenshot IDs.
 */
export async function deleteScreenshot(
  id: number,
  database: ClipCacheDatabase = db
): Promise<number[]> {
  try {
    return await database.transaction('rw', database.screenshots, async () => {
      const allScreenshots = await database.screenshots.toArray();
      const idsToDelete = new Set<number>([id]);

      let added = true;
      while (added) {
        added = false;
        for (const item of allScreenshots) {
          if (
            item.id !== undefined &&
            item.parentId !== null &&
            item.parentId !== undefined &&
            idsToDelete.has(item.parentId) &&
            !idsToDelete.has(item.id)
          ) {
            idsToDelete.add(item.id);
            added = true;
          }
        }
      }

      const idList = Array.from(idsToDelete);
      await database.screenshots.bulkDelete(idList);
      logger.info(`Screenshot deleted with ID: ${id} and linked children: [${idList.join(', ')}]`);
      return idList;
    });
  } catch (error) {
    logger.error(`Failed to delete screenshot with ID: ${id}`, error);
    throw new Error('Could not delete screenshot from storage.');
  }
}

/**
 * Gets count of child screenshots linked to a parent screenshot.
 */
export async function getLinkedChildrenCount(
  parentId: number,
  database: ClipCacheDatabase = db
): Promise<number> {
  try {
    const all = await database.screenshots.toArray();
    const childIds = new Set<number>();
    let added = true;
    while (added) {
      added = false;
      for (const item of all) {
        if (
          item.id !== undefined &&
          item.parentId !== null &&
          item.parentId !== undefined &&
          (item.parentId === parentId || childIds.has(item.parentId)) &&
          !childIds.has(item.id)
        ) {
          childIds.add(item.id);
          added = true;
        }
      }
    }
    return childIds.size;
  } catch (error) {
    logger.error(`Failed to count linked children for parent ${parentId}`, error);
    return 0;
  }
}

/**
 * Gets total count of stored screenshots.
 */
export async function getScreenshotCount(
  database: ClipCacheDatabase = db
): Promise<number> {
  try {
    return await database.screenshots.count();
  } catch (error) {
    logger.error('Failed to get screenshot count', error);
    throw new Error('Could not determine screenshot count.');
  }
}

/**
 * Clears all screenshots (useful for testing or manual wipe).
 */
export async function clearAllScreenshots(
  database: ClipCacheDatabase = db
): Promise<void> {
  try {
    await database.screenshots.clear();
    logger.info('All screenshots cleared');
  } catch (error) {
    logger.error('Failed to clear screenshots', error);
    throw new Error('Could not clear screenshot storage.');
  }
}

/**
 * Retrieves a setting value by key.
 */
export async function getSetting<T>(
  key: string,
  defaultValue: T,
  database: ClipCacheDatabase = db
): Promise<T> {
  try {
    const entry = await database.settings.get(key);
    return entry ? (entry.value as T) : defaultValue;
  } catch (error) {
    logger.error(`Failed to get setting "${key}"`, error);
    return defaultValue;
  }
}

/**
 * Saves a setting value.
 */
export async function setSetting<T>(
  key: string,
  value: T,
  database: ClipCacheDatabase = db
): Promise<void> {
  try {
    await database.settings.put({ key, value });
    logger.info(`Setting updated: ${key}`);
  } catch (error) {
    logger.error(`Failed to save setting "${key}"`, error);
    throw new Error('Could not save setting to storage.');
  }
}

/**
 * Updates an existing screenshot by ID.
 */
export async function updateScreenshot(
  id: number,
  changes: Partial<ScreenshotItem>,
  database: ClipCacheDatabase = db
): Promise<void> {
  try {
    const updated = await database.screenshots.update(id, changes);
    if (updated === 0) {
      throw new Error(`Screenshot with ID ${id} not found.`);
    }
    logger.info(`Screenshot updated with ID: ${id}`);
  } catch (error) {
    logger.error(`Failed to update screenshot with ID: ${id}`, error);
    throw new Error('Could not update screenshot in storage.');
  }
}

/**
 * Retrieves screenshots filtered by capture mode.
 */
export async function getScreenshotsByMode(
  mode: CaptureMode,
  database: ClipCacheDatabase = db
): Promise<ScreenshotItem[]> {
  try {
    return await database.screenshots
      .where('mode')
      .equals(mode)
      .reverse()
      .sortBy('createdAt');
  } catch (error) {
    logger.error(`Failed to retrieve screenshots with mode: ${mode}`, error);
    throw new Error('Could not load screenshots for the selected mode.');
  }
}

/**
 * Retrieves user preferred shortcuts from settings, falling back to defaults.
 */
export async function getShortcuts(
  database: ClipCacheDatabase = db
): Promise<UserShortcuts> {
  return await getSetting<UserShortcuts>('shortcuts', DEFAULT_SHORTCUTS, database);
}

/**
 * Saves a user preferred keyboard shortcut.
 */
export async function saveShortcut(
  action: string,
  shortcut: string,
  database: ClipCacheDatabase = db
): Promise<UserShortcuts> {
  const current = await getShortcuts(database);
  const updated = { ...current, [action]: shortcut };
  await setSetting('shortcuts', updated, database);
  return updated;
}

