import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ClipCacheDatabase,
  addScreenshot,
  getScreenshot,
  getAllScreenshots,
  deleteScreenshot,
  getScreenshotCount,
  clearAllScreenshots,
  getSetting,
  setSetting,
  updateScreenshot,
  getScreenshotsByMode,
  getShortcuts,
  saveShortcut,
  DEFAULT_SHORTCUTS,
  getLinkedChildrenCount,
} from '@/sidepanel/lib/db';
import { ScreenshotItem } from '@/shared/types';

describe('Dexie DB Helpers', () => {
  let testDb: ClipCacheDatabase;

  beforeEach(() => {
    testDb = new ClipCacheDatabase(`TestDB_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  const createDummyItem = (overrides?: Partial<ScreenshotItem>): Omit<ScreenshotItem, 'id'> => ({
    createdAt: Date.now(),
    sourceUrl: 'https://example.com/page',
    pageTitle: 'Example Domain',
    mode: 'visible',
    originalBlob: new Blob(['fake-image-bytes'], { type: 'image/png' }),
    editedBlob: null,
    editState: null,
    width: 1920,
    height: 1080,
    isEdited: false,
    ...overrides,
  });

  it('saves screenshot and returns auto-incremented ID', async () => {
    const item = createDummyItem();
    const id = await addScreenshot(item, testDb);
    expect(id).toBeGreaterThan(0);

    const count = await getScreenshotCount(testDb);
    expect(count).toBe(1);
  });

  it('retrieves saved screenshot by ID', async () => {
    const item = createDummyItem({ pageTitle: 'Unique Page Title' });
    const id = await addScreenshot(item, testDb);

    const loaded = await getScreenshot(id, testDb);
    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(id);
    expect(loaded?.pageTitle).toBe('Unique Page Title');
    expect(loaded?.width).toBe(1920);
    expect(loaded?.height).toBe(1080);
    expect(loaded?.mode).toBe('visible');
  });

  it('retrieves all screenshots sorted newest first', async () => {
    const now = Date.now();
    await addScreenshot(createDummyItem({ createdAt: now - 2000, pageTitle: 'Oldest' }), testDb);
    await addScreenshot(createDummyItem({ createdAt: now, pageTitle: 'Newest' }), testDb);
    await addScreenshot(createDummyItem({ createdAt: now - 1000, pageTitle: 'Middle' }), testDb);

    const all = await getAllScreenshots(testDb);
    expect(all).toHaveLength(3);
    expect(all[0].pageTitle).toBe('Newest');
    expect(all[1].pageTitle).toBe('Middle');
    expect(all[2].pageTitle).toBe('Oldest');
  });

  it('deletes screenshot by ID', async () => {
    const id1 = await addScreenshot(createDummyItem({ pageTitle: 'Keep' }), testDb);
    const id2 = await addScreenshot(createDummyItem({ pageTitle: 'Delete' }), testDb);

    expect(await getScreenshotCount(testDb)).toBe(2);

    await deleteScreenshot(id2, testDb);

    expect(await getScreenshotCount(testDb)).toBe(1);
    expect(await getScreenshot(id2, testDb)).toBeUndefined();
    expect(await getScreenshot(id1, testDb)).toBeDefined();
  });

  it('clears all screenshots', async () => {
    await addScreenshot(createDummyItem(), testDb);
    await addScreenshot(createDummyItem(), testDb);
    expect(await getScreenshotCount(testDb)).toBe(2);

    await clearAllScreenshots(testDb);
    expect(await getScreenshotCount(testDb)).toBe(0);
  });

  it('manages settings via getSetting and setSetting', async () => {
    const defaultTheme = await getSetting('theme', 'dark', testDb);
    expect(defaultTheme).toBe('dark');

    await setSetting('theme', 'light', testDb);
    const updatedTheme = await getSetting('theme', 'dark', testDb);
    expect(updatedTheme).toBe('light');
  });

  it('updates existing screenshot with new fields', async () => {
    const id = await addScreenshot(createDummyItem({ pageTitle: 'Initial Title' }), testDb);

    const editedBlob = new Blob(['edited-bytes'], { type: 'image/png' });
    await updateScreenshot(
      id,
      {
        pageTitle: 'Updated Title',
        isEdited: true,
        editedBlob,
        editState: JSON.stringify({ version: '5.3.0', objects: [] }),
      },
      testDb
    );

    const updated = await getScreenshot(id, testDb);
    expect(updated).toBeDefined();
    expect(updated?.pageTitle).toBe('Updated Title');
    expect(updated?.isEdited).toBe(true);
    expect(updated?.editedBlob).toBeDefined();
    expect(updated?.editState).toContain('5.3.0');
  });

  it('throws error when trying to update non-existent screenshot', async () => {
    await expect(
      updateScreenshot(99999, { pageTitle: 'Non-existent' }, testDb)
    ).rejects.toThrow('Could not update screenshot in storage');
  });

  it('filters screenshots by capture mode', async () => {
    await addScreenshot(createDummyItem({ mode: 'visible', pageTitle: 'Visible 1' }), testDb);
    await addScreenshot(createDummyItem({ mode: 'area', pageTitle: 'Area 1' }), testDb);
    await addScreenshot(createDummyItem({ mode: 'window', pageTitle: 'Window 1' }), testDb);
    await addScreenshot(createDummyItem({ mode: 'area', pageTitle: 'Area 2' }), testDb);

    const areaCaptures = await getScreenshotsByMode('area', testDb);
    expect(areaCaptures).toHaveLength(2);
    expect(areaCaptures.every((c) => c.mode === 'area')).toBe(true);

    const windowCaptures = await getScreenshotsByMode('window', testDb);
    expect(windowCaptures).toHaveLength(1);
    expect(windowCaptures[0].pageTitle).toBe('Window 1');
  });

  it('stores and retrieves user preferred keyboard shortcuts', async () => {
    const shortcuts = await getShortcuts(testDb);
    expect(shortcuts).toEqual(DEFAULT_SHORTCUTS);
    expect(shortcuts.screenCapture).toBe('Alt+Shift+S');

    // Customize shortcut
    const updated = await saveShortcut('screenCapture', 'Ctrl+Shift+S', testDb);
    expect(updated.screenCapture).toBe('Ctrl+Shift+S');

    // Verify persisted in DB
    const fetchedAgain = await getShortcuts(testDb);
    expect(fetchedAgain.screenCapture).toBe('Ctrl+Shift+S');
  });

  it('stores area crop screenshot conforming to CLAUDE.md schema', async () => {
    const croppedBlob = new Blob(['cropped-png-data'], { type: 'image/png' });
    const cropItem: Omit<ScreenshotItem, 'id'> = {
      createdAt: Date.now(),
      sourceUrl: 'https://example.com/test',
      pageTitle: 'Test Page (Cropped)',
      mode: 'area',
      originalBlob: croppedBlob,
      editedBlob: null,
      editState: null,
      width: 480,
      height: 320,
      isEdited: false,
    };

    const id = await addScreenshot(cropItem, testDb);
    const saved = await getScreenshot(id, testDb);

    expect(saved).toBeDefined();
    expect(saved?.mode).toBe('area');
    expect(saved?.width).toBe(480);
    expect(saved?.height).toBe(320);
    expect(saved?.editedBlob).toBeNull();
    expect(saved?.editState).toBeNull();
    expect(saved?.isEdited).toBe(false);
  });

  it('deleting a record removes both originalBlob and any edit or crop children linked by parentId', async () => {
    // 1. Create parent capture
    const parentBlob = new Blob(['parent-image-bytes'], { type: 'image/png' });
    const parentId = await addScreenshot(
      createDummyItem({ pageTitle: 'Parent Screenshot', originalBlob: parentBlob }),
      testDb
    );

    // 2. Create two children linked by parentId (e.g. area crops)
    const child1Blob = new Blob(['child-1-bytes'], { type: 'image/png' });
    const child1Id = await addScreenshot(
      createDummyItem({
        pageTitle: 'Parent Screenshot (Crop 1)',
        mode: 'area',
        originalBlob: child1Blob,
        parentId,
      }),
      testDb
    );

    const child2Blob = new Blob(['child-2-bytes'], { type: 'image/png' });
    const child2Id = await addScreenshot(
      createDummyItem({
        pageTitle: 'Parent Screenshot (Crop 2)',
        mode: 'area',
        originalBlob: child2Blob,
        parentId,
      }),
      testDb
    );

    // 3. Create unrelated capture
    const unrelatedId = await addScreenshot(
      createDummyItem({ pageTitle: 'Unrelated Capture', parentId: null }),
      testDb
    );

    // Verify initial count and child count
    expect(await getScreenshotCount(testDb)).toBe(4);
    expect(await getLinkedChildrenCount(parentId, testDb)).toBe(2);

    // 4. Delete the parent record
    const deletedIds = await deleteScreenshot(parentId, testDb);

    // Deleted IDs must include the parent and both children
    expect(deletedIds).toContain(parentId);
    expect(deletedIds).toContain(child1Id);
    expect(deletedIds).toContain(child2Id);
    expect(deletedIds).toHaveLength(3);

    // 5. Verify records and blobs are completely removed from DB
    expect(await getScreenshot(parentId, testDb)).toBeUndefined();
    expect(await getScreenshot(child1Id, testDb)).toBeUndefined();
    expect(await getScreenshot(child2Id, testDb)).toBeUndefined();

    // 6. Unrelated screenshot must remain intact
    const remaining = await getScreenshot(unrelatedId, testDb);
    expect(remaining).toBeDefined();
    expect(remaining?.pageTitle).toBe('Unrelated Capture');
    expect(await getScreenshotCount(testDb)).toBe(1);
  });

  it('deleting a child crop directly removes only that child, leaving parent intact', async () => {
    const parentId = await addScreenshot(
      createDummyItem({ pageTitle: 'Root Parent' }),
      testDb
    );

    const child1Id = await addScreenshot(
      createDummyItem({ pageTitle: 'Child 1', parentId }),
      testDb
    );

    const child2Id = await addScreenshot(
      createDummyItem({ pageTitle: 'Child 2', parentId }),
      testDb
    );

    expect(await getScreenshotCount(testDb)).toBe(3);

    // Delete Child 1 only
    const deletedIds = await deleteScreenshot(child1Id, testDb);
    expect(deletedIds).toEqual([child1Id]);

    // Parent and Child 2 must remain
    expect(await getScreenshot(child1Id, testDb)).toBeUndefined();
    expect(await getScreenshot(parentId, testDb)).toBeDefined();
    expect(await getScreenshot(child2Id, testDb)).toBeDefined();
    expect(await getScreenshotCount(testDb)).toBe(2);
  });

  it('deleting parent cascades to grandchildren (chained crops)', async () => {
    const parentId = await addScreenshot(
      createDummyItem({ pageTitle: 'Grandparent' }),
      testDb
    );

    const childId = await addScreenshot(
      createDummyItem({ pageTitle: 'Parent Crop', parentId }),
      testDb
    );

    const grandChildId = await addScreenshot(
      createDummyItem({ pageTitle: 'Sub-Crop of Child', parentId: childId }),
      testDb
    );

    expect(await getScreenshotCount(testDb)).toBe(3);

    // Deleting root parent cascades down the entire hierarchy
    const deletedIds = await deleteScreenshot(parentId, testDb);
    expect(deletedIds).toContain(parentId);
    expect(deletedIds).toContain(childId);
    expect(deletedIds).toContain(grandChildId);
    expect(deletedIds).toHaveLength(3);

    expect(await getScreenshotCount(testDb)).toBe(0);
  });

  it('enforces 20-item free plan limit before saving via addScreenshot', async () => {
    // Save 20 items up to the limit
    for (let i = 1; i <= 20; i++) {
      await addScreenshot(createDummyItem({ pageTitle: `Capture #${i}` }), testDb);
    }

    expect(await getScreenshotCount(testDb)).toBe(20);

    // 21st item should be blocked with exact required message
    await expect(
      addScreenshot(createDummyItem({ pageTitle: 'Capture #21 (Should Fail)' }), testDb)
    ).rejects.toThrowError(
      'Free limit reached (20/20). Delete a capture to add a new one.'
    );

    // Count must remain 20
    expect(await getScreenshotCount(testDb)).toBe(20);
  });
});

