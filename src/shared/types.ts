/**
 * Core type definitions for ClipCache
 */

export type CaptureMode = 'visible' | 'window' | 'full' | 'area';

export interface ScreenshotItem {
  id?: number;
  createdAt: number;
  sourceUrl: string;
  pageTitle: string;
  mode: CaptureMode;
  originalBlob: Blob;
  editedBlob: Blob | null;
  editState: string | null; // Serialized Fabric.js JSON
  width: number;
  height: number;
  isEdited: boolean;
  parentId?: number | null;
}

export interface SettingItem {
  key: string;
  value: unknown;
}
