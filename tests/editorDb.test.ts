import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ClipCacheDatabase,
  addScreenshot,
  getScreenshot,
  updateScreenshot,
  getScreenshotCount,
} from '@/sidepanel/lib/db';
import { ScreenshotItem } from '@/shared/types';

describe('Editor DB Operations (CLAUDE.md Phase 4)', () => {
  let testDb: ClipCacheDatabase;

  beforeEach(() => {
    testDb = new ClipCacheDatabase(`EditorTestDB_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  const createDummyCapture = (
    overrides?: Partial<ScreenshotItem>
  ): Omit<ScreenshotItem, 'id'> => ({
    createdAt: Date.now(),
    sourceUrl: 'https://example.com/editor-test',
    pageTitle: 'Original Webpage Capture',
    mode: 'visible',
    originalBlob: new Blob(['original-unmodified-bytes'], { type: 'image/png' }),
    editedBlob: null,
    editState: null,
    width: 1920,
    height: 1080,
    isEdited: false,
    parentId: null,
    ...overrides,
  });

  it('save leaves originalBlob completely unchanged and stores editedBlob + editState', async () => {
    const originalBlob = new Blob(['original-unmodified-bytes'], {
      type: 'image/png',
    });
    const id = await addScreenshot(
      createDummyCapture({ originalBlob }),
      testDb
    );

    const initial = await getScreenshot(id, testDb);
    expect(initial).toBeDefined();
    expect(initial?.isEdited).toBe(false);
    expect(initial?.editedBlob).toBeNull();
    expect(initial?.editState).toBeNull();

    // Perform an edit save
    const editedBlob = new Blob(['edited-fabric-canvas-bytes'], {
      type: 'image/png',
    });
    const editState = JSON.stringify({
      version: '5.5.2',
      objects: [{ type: 'rect', fill: 'red' }],
    });

    await updateScreenshot(
      id,
      {
        editedBlob,
        editState,
        isEdited: true,
      },
      testDb
    );

    const saved = await getScreenshot(id, testDb);
    expect(saved).toBeDefined();
    expect(saved?.id).toBe(id);
    expect(saved?.isEdited).toBe(true);
    expect(saved?.editedBlob).toBeDefined();
    expect(saved?.editState).toBe(editState);

    // CRITICAL: Verify originalBlob is completely intact and unchanged
    const originalText = await saved!.originalBlob.text();
    expect(originalText).toBe('original-unmodified-bytes');

    const editedText = await saved!.editedBlob!.text();
    expect(editedText).toBe('edited-fabric-canvas-bytes');
    expect(originalText).not.toBe(editedText);
  });

  it('crop creates a NEW record with parentId and leaves original capture untouched', async () => {
    const originalBlob = new Blob(['original-full-capture'], { type: 'image/png' });
    const originalId = await addScreenshot(
      createDummyCapture({
        pageTitle: 'Base Full Capture',
        originalBlob,
        width: 1920,
        height: 1080,
      }),
      testDb
    );

    expect(await getScreenshotCount(testDb)).toBe(1);

    // Crop in editor saves as a NEW record with parentId set to originalId
    const croppedBlob = new Blob(['cropped-slice-bytes'], { type: 'image/png' });
    const croppedItem: Omit<ScreenshotItem, 'id'> = {
      createdAt: Date.now(),
      sourceUrl: 'https://example.com/editor-test',
      pageTitle: 'Base Full Capture (Crop)',
      mode: 'area',
      originalBlob: croppedBlob,
      editedBlob: null,
      editState: null,
      width: 400,
      height: 300,
      isEdited: false,
      parentId: originalId,
    };

    const croppedId = await addScreenshot(croppedItem, testDb);

    expect(await getScreenshotCount(testDb)).toBe(2);
    expect(croppedId).not.toBe(originalId);

    // Verify cropped record
    const croppedRecord = await getScreenshot(croppedId, testDb);
    expect(croppedRecord).toBeDefined();
    expect(croppedRecord?.parentId).toBe(originalId);
    expect(croppedRecord?.mode).toBe('area');
    expect(croppedRecord?.width).toBe(400);
    expect(croppedRecord?.height).toBe(300);
    expect(await croppedRecord!.originalBlob.text()).toBe('cropped-slice-bytes');

    // Verify original record is completely untouched
    const originalRecord = await getScreenshot(originalId, testDb);
    expect(originalRecord).toBeDefined();
    expect(originalRecord?.parentId).toBeNull();
    expect(originalRecord?.mode).toBe('visible');
    expect(originalRecord?.width).toBe(1920);
    expect(originalRecord?.height).toBe(1080);
    expect(await originalRecord!.originalBlob.text()).toBe('original-full-capture');
  });
});
